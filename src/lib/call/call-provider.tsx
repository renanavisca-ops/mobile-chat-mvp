'use client';

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import type { RealtimeChannel } from '@supabase/supabase-js';
import { browserSupabase } from '@/lib/supabase/client';
import { logCallStart, logCallAnswered, logCallEnded } from '@/lib/db/calls';
import { isBlockedWith } from '@/lib/db/safety';
import { startRingtone, stopRingtone } from '@/lib/call/ringtone';
import { useT } from '@/lib/i18n/context';
import {
  PhoneIcon,
  PhoneOffIcon,
  VideoIcon,
  VideoOffIcon,
  MicIcon,
  MicOffIcon,
  SwitchCameraIcon,
  SpeakerIcon,
  SpeakerOffIcon,
} from '@/components/icons';

type Phase = 'idle' | 'ringing' | 'incall';

type StartOpts = {
  chatId: string;
  peerIds: string[];
  label: string;
  video: boolean;
  isGroup: boolean;
};

type CallContext = {
  startCall: (opts: StartOpts) => void;
  busy: boolean;
};

const Ctx = createContext<CallContext>({ startCall: () => {}, busy: false });

type Invite = {
  callId: string;
  chatId: string;
  from: string;
  fromName: string;
  video: boolean;
  isGroup: boolean;
  label: string;
};

type Participant = { id: string; name: string; stream: MediaStream | null };

const MEDIA = (video: boolean): MediaStreamConstraints => ({
  audio: true,
  video: video ? { width: { ideal: 1280 }, height: { ideal: 720 }, facingMode: 'user' } : false,
});

/** Attaches a MediaStream to a <video> and shows an avatar fallback for audio. */
function RemoteTile({
  p,
  fill,
  register,
}: {
  p: Participant;
  fill?: boolean;
  register?: (el: HTMLVideoElement, attach: boolean) => void;
}) {
  const ref = useRef<HTMLVideoElement | null>(null);
  useEffect(() => {
    if (ref.current && p.stream) ref.current.srcObject = p.stream;
  }, [p.stream]);
  // Register this element so the provider can route its audio output (speaker).
  useEffect(() => {
    const el = ref.current;
    if (el) register?.(el, true);
    return () => {
      if (el) register?.(el, false);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [register]);
  const hasVideo = p.stream?.getVideoTracks().some((t) => t.enabled) ?? false;
  return (
    <div className={`relative overflow-hidden bg-slate-900 ${fill ? 'h-full w-full' : 'aspect-square rounded-xl'}`}>
      <video ref={ref} autoPlay playsInline className={`h-full w-full object-cover ${hasVideo ? '' : 'invisible'}`} />
      {!hasVideo && (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-2">
          <div className="grid h-16 w-16 place-items-center rounded-full bg-slate-800 text-2xl text-slate-300">
            {(p.name || '?').charAt(0).toUpperCase()}
          </div>
        </div>
      )}
      <span className="absolute bottom-1 left-2 text-xs text-white/80 drop-shadow">{p.name}</span>
    </div>
  );
}

export function CallProvider({ children }: { children: ReactNode }) {
  const t = useT();
  const supabase = browserSupabase();

  const [myId, setMyId] = useState<string | null>(null);
  const myIdRef = useRef<string>('');
  const myNameRef = useRef<string>('');

  const [phase, setPhase] = useState<Phase>('idle');
  const phaseRef = useRef<Phase>('idle');
  const [label, setLabel] = useState('');
  const [isVideo, setIsVideo] = useState(false);
  // Whether OUR local stream currently has a video track. Distinct from isVideo
  // (which means "this call shows the video UI"): after a voice→video upgrade a
  // peer can be in video mode while still deciding to turn their own camera on.
  const [localHasVideo, setLocalHasVideo] = useState(false);
  const [muted, setMuted] = useState(false);
  const [cameraOff, setCameraOff] = useState(false);
  const [speakerOn, setSpeakerOn] = useState(true);
  const [incoming, setIncoming] = useState<Invite | null>(null);
  const [participants, setParticipants] = useState<Map<string, Participant>>(new Map());
  const [errText, setErrText] = useState('');
  // Brief banner shown after a call ends for a notable reason (e.g. rejected).
  const [endedNote, setEndedNote] = useState('');

  const pcsRef = useRef<Map<string, RTCPeerConnection>>(new Map());
  const remoteSetRef = useRef<Map<string, boolean>>(new Map());
  const pendingIceRef = useRef<Map<string, RTCIceCandidateInit[]>>(new Map());
  const localStreamRef = useRef<MediaStream | null>(null);
  const channelRef = useRef<RealtimeChannel | null>(null);
  const callIdRef = useRef<string | null>(null);
  const invitedRef = useRef<string[]>([]);
  // True when *this* device started the call, so only the caller stamps the
  // call log's end time (the caller owns the row).
  const wasCallerRef = useRef(false);
  const iceServersRef = useRef<RTCIceServer[]>([{ urls: 'stun:stun.cloudflare.com:3478' }]);
  const incomingCallIdRef = useRef<string | null>(null);
  const facingRef = useRef<'user' | 'environment'>('user');
  const hadPeersRef = useRef(false);
  const mediaElsRef = useRef<Set<HTMLVideoElement>>(new Set());

  const localVideoRef = useRef<HTMLVideoElement | null>(null);

  // setSinkId lets us pick the audio output device; absent on iOS Safari.
  const speakerSupported =
    typeof window !== 'undefined' &&
    typeof (HTMLMediaElement.prototype as unknown as { setSinkId?: unknown }).setSinkId === 'function';

  // Route every remote audio/video element to the chosen output device.
  const applySpeaker = useCallback(async (on: boolean) => {
    if (!speakerSupported) return;
    try {
      const devices = await navigator.mediaDevices.enumerateDevices();
      const outs = devices.filter((d) => d.kind === 'audiooutput');
      let sinkId = 'default';
      if (on) {
        const spk = outs.find((d) => /speaker|speakerphone/i.test(d.label));
        sinkId = spk?.deviceId ?? 'default';
      } else {
        const ear = outs.find((d) => /earpiece|receiver|handset|headphone|headset/i.test(d.label));
        sinkId = ear?.deviceId ?? 'default';
      }
      for (const el of mediaElsRef.current) {
        try {
          await (el as unknown as { setSinkId: (id: string) => Promise<void> }).setSinkId(sinkId);
        } catch {}
      }
    } catch {}
  }, [speakerSupported]);

  const registerMediaEl = useCallback(
    (el: HTMLVideoElement, attach: boolean) => {
      if (attach) {
        mediaElsRef.current.add(el);
        // Apply the current speaker choice to a newly-mounted remote tile.
        if (speakerSupported) void applySpeaker(speakerOn);
      } else {
        mediaElsRef.current.delete(el);
      }
    },
    [applySpeaker, speakerOn, speakerSupported]
  );

  const toggleSpeaker = useCallback(() => {
    if (!speakerSupported) {
      setErrText(t('call.speakerUnsupported'));
      return;
    }
    setSpeakerOn((prev) => {
      const next = !prev;
      void applySpeaker(next);
      return next;
    });
  }, [applySpeaker, speakerSupported, t]);

  function setPhaseBoth(p: Phase) {
    phaseRef.current = p;
    setPhase(p);
  }

  // Identify current user + cache display name.
  useEffect(() => {
    let alive = true;
    supabase.auth.getUser().then(async ({ data }) => {
      if (!alive) return;
      const u = data.user;
      setMyId(u?.id ?? null);
      myIdRef.current = u?.id ?? '';
      if (u) {
        const { data: prof } = await supabase
          .from('profiles')
          .select('username, display_name')
          .eq('id', u.id)
          .maybeSingle();
        myNameRef.current = prof?.display_name || prof?.username || 'Someone';
      }
    });
    const { data: sub } = supabase.auth.onAuthStateChange((_e, session) => {
      setMyId(session?.user?.id ?? null);
      myIdRef.current = session?.user?.id ?? '';
    });
    return () => {
      alive = false;
      sub.subscription.unsubscribe();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const teardownPeer = useCallback((pid: string) => {
    const pc = pcsRef.current.get(pid);
    if (pc) {
      try {
        // Detach senders first so closing this one peer never affects the
        // shared local mic/camera tracks used by the other peers.
        pc.getSenders().forEach((s) => {
          try {
            s.replaceTrack(null);
          } catch {}
        });
        pc.close();
      } catch {}
    }
    pcsRef.current.delete(pid);
    remoteSetRef.current.delete(pid);
    pendingIceRef.current.delete(pid);
    setParticipants((prev) => {
      const next = new Map(prev);
      next.delete(pid);
      return next;
    });
    // If everyone who had joined has now left, end the call for the last person.
    if (hadPeersRef.current && pcsRef.current.size === 0) {
      window.setTimeout(() => {
        if (pcsRef.current.size === 0) cleanupRef.current?.();
      }, 800);
    }
  }, []);

  // Forward ref so teardownPeer (defined before cleanup) can call it.
  const cleanupRef = useRef<(() => void) | null>(null);

  const cleanup = useCallback(() => {
    // Caller stamps the end time before we clear the call id.
    if (wasCallerRef.current && callIdRef.current) void logCallEnded(callIdRef.current);
    wasCallerRef.current = false;
    for (const pid of Array.from(pcsRef.current.keys())) {
      try {
        pcsRef.current.get(pid)?.close();
      } catch {}
    }
    pcsRef.current.clear();
    remoteSetRef.current.clear();
    pendingIceRef.current.clear();
    localStreamRef.current?.getTracks().forEach((tr) => tr.stop());
    localStreamRef.current = null;
    if (channelRef.current) {
      void supabase.removeChannel(channelRef.current);
      channelRef.current = null;
    }
    callIdRef.current = null;
    invitedRef.current = [];
    hadPeersRef.current = false;
    facingRef.current = 'user';
    mediaElsRef.current.clear();
    setParticipants(new Map());
    setIncoming(null);
    setMuted(false);
    setCameraOff(false);
    setSpeakerOn(true);
    setErrText('');
    setIsVideo(false);
    setLocalHasVideo(false);
    setPhaseBoth('idle');
  }, [supabase]);

  cleanupRef.current = cleanup;

  useEffect(() => {
    if (localVideoRef.current && localStreamRef.current) {
      localVideoRef.current.srcObject = localStreamRef.current;
    }
  }, [phase, cameraOff, participants]);

  async function getIceServers(): Promise<RTCIceServer[]> {
    try {
      const { data } = await supabase.auth.getSession();
      const res = await fetch('/api/turn', {
        method: 'POST',
        headers: { Authorization: `Bearer ${data.session?.access_token}` },
      });
      const json = await res.json();
      return (json.iceServers as RTCIceServer[]) ?? [{ urls: 'stun:stun.cloudflare.com:3478' }];
    } catch {
      return [{ urls: 'stun:stun.cloudflare.com:3478' }];
    }
  }

  function sendSignal(event: string, payload: Record<string, unknown>) {
    channelRef.current?.send({ type: 'broadcast', event, payload });
  }

  // One-off send to another user's personal channel (invite / cancel / decline).
  function sendToUser(userId: string, event: string, payload: Record<string, unknown>) {
    const ch = supabase.channel(`call-user:${userId}`);
    ch.subscribe((status) => {
      if (status === 'SUBSCRIBED') {
        ch.send({ type: 'broadcast', event, payload });
        setTimeout(() => void supabase.removeChannel(ch), 1000);
      }
    });
  }

  function setParticipantName(pid: string, name: string) {
    setParticipants((prev) => {
      const next = new Map(prev);
      const existing = next.get(pid);
      next.set(pid, { id: pid, name: name || existing?.name || '', stream: existing?.stream ?? null });
      return next;
    });
  }

  function addIce(pid: string, candidate: RTCIceCandidateInit) {
    const pc = pcsRef.current.get(pid);
    if (pc && remoteSetRef.current.get(pid)) {
      pc.addIceCandidate(new RTCIceCandidate(candidate)).catch(() => {});
    } else {
      const arr = pendingIceRef.current.get(pid) ?? [];
      arr.push(candidate);
      pendingIceRef.current.set(pid, arr);
    }
  }

  function flushIce(pid: string) {
    const pc = pcsRef.current.get(pid);
    if (!pc) return;
    for (const c of pendingIceRef.current.get(pid) ?? []) pc.addIceCandidate(new RTCIceCandidate(c)).catch(() => {});
    pendingIceRef.current.set(pid, []);
  }

  function createPeer(pid: string): RTCPeerConnection {
    const existing = pcsRef.current.get(pid);
    if (existing) return existing;
    const pc = new RTCPeerConnection({ iceServers: iceServersRef.current });
    localStreamRef.current?.getTracks().forEach((tr) => pc.addTrack(tr, localStreamRef.current!));
    pc.onicecandidate = (e) => {
      if (e.candidate) sendSignal('ice', { from: myIdRef.current, to: pid, candidate: e.candidate.toJSON() });
    };
    pc.ontrack = (e) => {
      const [stream] = e.streams;
      hadPeersRef.current = true;
      // If a peer starts sending video (e.g. they upgraded a voice call), flip
      // this side into the video UI so the remote video shows and the "switch
      // to video" control appears for us too.
      if (e.track.kind === 'video') setIsVideo(true);
      setParticipants((prev) => {
        const next = new Map(prev);
        const existingP = next.get(pid);
        next.set(pid, { id: pid, name: existingP?.name ?? '', stream: stream ?? null });
        return next;
      });
    };
    pc.oniceconnectionstatechange = () => {
      if (pc.iceConnectionState === 'failed') teardownPeer(pid);
    };
    pcsRef.current.set(pid, pc);
    return pc;
  }

  async function initiateOffer(pid: string) {
    const pc = createPeer(pid);
    const offer = await pc.createOffer();
    await pc.setLocalDescription(offer);
    sendSignal('offer', { from: myIdRef.current, to: pid, sdp: offer });
  }

  function handlePresenceSync() {
    const ch = channelRef.current;
    if (!ch) return;
    const state = ch.presenceState() as Record<string, Array<{ userId?: string; name?: string }>>;
    const present = new Set<string>();
    for (const key of Object.keys(state)) {
      if (key !== myIdRef.current) present.add(key);
    }
    // Tear down peers that left.
    for (const pid of Array.from(pcsRef.current.keys())) {
      if (!present.has(pid)) teardownPeer(pid);
    }
    // Connect to new peers; lower id initiates the offer (avoids glare).
    for (const pid of present) {
      const name = state[pid]?.[0]?.name ?? '';
      setParticipantName(pid, name);
      if (pcsRef.current.has(pid)) continue;
      createPeer(pid);
      if (myIdRef.current < pid) void initiateOffer(pid);
    }
  }

  function attachChannelHandlers(ch: RealtimeChannel) {
    ch.on('presence', { event: 'sync' }, handlePresenceSync);
    ch.on('presence', { event: 'leave' }, ({ leftPresences }: { leftPresences: Array<{ userId?: string }> }) => {
      for (const p of leftPresences) if (p.userId) teardownPeer(p.userId);
    });
    ch.on('broadcast', { event: 'offer' }, async ({ payload }) => {
      if (payload.to !== myIdRef.current) return;
      const from = payload.from as string;
      const pc = createPeer(from);
      await pc.setRemoteDescription(new RTCSessionDescription(payload.sdp as RTCSessionDescriptionInit));
      remoteSetRef.current.set(from, true);
      flushIce(from);
      const answer = await pc.createAnswer();
      await pc.setLocalDescription(answer);
      sendSignal('answer', { from: myIdRef.current, to: from, sdp: answer });
    });
    ch.on('broadcast', { event: 'answer' }, async ({ payload }) => {
      if (payload.to !== myIdRef.current) return;
      const from = payload.from as string;
      const pc = pcsRef.current.get(from);
      if (!pc) return;
      await pc.setRemoteDescription(new RTCSessionDescription(payload.sdp as RTCSessionDescriptionInit));
      remoteSetRef.current.set(from, true);
      flushIce(from);
    });
    ch.on('broadcast', { event: 'ice' }, ({ payload }) => {
      if (payload.to !== myIdRef.current) return;
      addIce(payload.from as string, payload.candidate as RTCIceCandidateInit);
    });
  }

  async function joinCall(callId: string) {
    const ch = supabase.channel(`call:${callId}`, {
      config: { presence: { key: myIdRef.current }, broadcast: { self: false } },
    });
    attachChannelHandlers(ch);
    ch.subscribe(async (status) => {
      if (status === 'SUBSCRIBED') {
        await ch.track({ userId: myIdRef.current, name: myNameRef.current });
      }
    });
    channelRef.current = ch;
  }

  const startCall = useCallback(
    async (opts: StartOpts) => {
      if (phaseRef.current !== 'idle' || !myIdRef.current || opts.peerIds.length === 0) return;
      setErrText('');
      const callId = crypto.randomUUID();
      callIdRef.current = callId;
      invitedRef.current = opts.peerIds;
      wasCallerRef.current = true;
      setLabel(opts.label);
      setIsVideo(opts.video);
      setPhaseBoth('incall');

      // Record the call in history (caller-side).
      void logCallStart({
        id: callId,
        chatId: opts.chatId,
        peerId: opts.isGroup ? null : opts.peerIds[0],
        isVideo: opts.video,
        isGroup: opts.isGroup,
      });

      try {
        const stream = await navigator.mediaDevices.getUserMedia(MEDIA(opts.video));
        localStreamRef.current = stream;
        setLocalHasVideo(opts.video);
        if (localVideoRef.current) localVideoRef.current.srcObject = stream;
        iceServersRef.current = await getIceServers();

        await joinCall(callId);

        for (const pid of opts.peerIds) {
          sendToUser(pid, 'invite', {
            callId,
            chatId: opts.chatId,
            from: myIdRef.current,
            fromName: myNameRef.current,
            video: opts.video,
            isGroup: opts.isGroup,
            label: opts.label,
          });
        }

        // Also push a notification so callees with the app closed get alerted.
        try {
          const { data: sess } = await supabase.auth.getSession();
          void fetch('/api/push/call', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${sess.session?.access_token}` },
            body: JSON.stringify({
              calleeIds: opts.peerIds,
              callerName: myNameRef.current,
              video: opts.video,
              chatId: opts.chatId,
            }),
          });
        } catch {
          // best-effort; realtime invite already sent
        }
      } catch (e: any) {
        setErrText(e?.message ?? String(e));
        cleanup();
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    []
  );

  async function acceptCall() {
    const inv = incoming;
    if (!inv) return;
    setIncoming(null);
    setLabel(inv.label);
    setIsVideo(inv.video);
    callIdRef.current = inv.callId;
    setPhaseBoth('incall');
    // Mark the call answered in history (callee-side).
    void logCallAnswered(inv.callId);
    try {
      const stream = await navigator.mediaDevices.getUserMedia(MEDIA(inv.video));
      localStreamRef.current = stream;
      setLocalHasVideo(inv.video);
      if (localVideoRef.current) localVideoRef.current.srcObject = stream;
      iceServersRef.current = await getIceServers();
      await joinCall(inv.callId);
    } catch (e: any) {
      setErrText(e?.message ?? String(e));
      cleanup();
    }
  }

  function declineCall() {
    const inv = incoming;
    if (inv) sendToUser(inv.from, 'declined', { callId: inv.callId, from: myIdRef.current });
    setIncoming(null);
    setPhaseBoth('idle');
  }

  function endCall() {
    // If still ringing others in a 1:1, tell them to stop ringing.
    if (invitedRef.current.length > 0) {
      for (const pid of invitedRef.current) sendToUser(pid, 'cancel', { callId: callIdRef.current });
    }
    cleanup();
  }

  function toggleMute() {
    const track = localStreamRef.current?.getAudioTracks()[0];
    if (!track) return;
    track.enabled = !track.enabled;
    setMuted(!track.enabled);
  }

  function toggleCamera() {
    const track = localStreamRef.current?.getVideoTracks()[0];
    if (!track) return;
    track.enabled = !track.enabled;
    setCameraOff(!track.enabled);
  }

  async function flipCamera() {
    if (!isVideo) return;
    const next = facingRef.current === 'user' ? 'environment' : 'user';
    try {
      const gum = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: { ideal: next } },
        audio: false,
      });
      const newTrack = gum.getVideoTracks()[0];
      if (!newTrack) return;
      newTrack.enabled = !cameraOff;

      // Swap the outgoing track on every peer connection.
      for (const pc of pcsRef.current.values()) {
        const sender = pc.getSenders().find((s) => s.track && s.track.kind === 'video');
        if (sender) await sender.replaceTrack(newTrack);
      }

      // Swap it into the local preview stream too.
      const local = localStreamRef.current;
      if (local) {
        const old = local.getVideoTracks()[0];
        if (old) {
          local.removeTrack(old);
          old.stop();
        }
        local.addTrack(newTrack);
        if (localVideoRef.current) localVideoRef.current.srcObject = local;
      }
      facingRef.current = next;
    } catch (e: any) {
      setErrText(e?.message ?? String(e));
    }
  }

  // Upgrade an ongoing voice call to video: capture a camera track, add it to
  // every peer connection, and renegotiate (send a fresh offer — the existing
  // offer/answer handlers complete it). The other side sees our video via
  // ontrack and flips into video mode automatically.
  async function upgradeToVideo() {
    if (localHasVideo) return;
    try {
      const gum = await navigator.mediaDevices.getUserMedia({
        video: { width: { ideal: 1280 }, height: { ideal: 720 }, facingMode: 'user' },
        audio: false,
      });
      const videoTrack = gum.getVideoTracks()[0];
      if (!videoTrack) return;

      const local = localStreamRef.current;
      if (local) {
        local.addTrack(videoTrack);
        if (localVideoRef.current) localVideoRef.current.srcObject = local;
      }

      // Add the track to each peer, then renegotiate with a new offer.
      for (const [pid, pc] of pcsRef.current.entries()) {
        const sender = pc.getSenders().find((s) => s.track && s.track.kind === 'video');
        if (sender) await sender.replaceTrack(videoTrack);
        else if (local) pc.addTrack(videoTrack, local);
        try {
          const offer = await pc.createOffer();
          await pc.setLocalDescription(offer);
          sendSignal('offer', { from: myIdRef.current, to: pid, sdp: offer });
        } catch (e: any) {
          setErrText(e?.message ?? String(e));
        }
      }

      facingRef.current = 'user';
      setCameraOff(false);
      setLocalHasVideo(true);
      setIsVideo(true);
    } catch (e: any) {
      setErrText(e?.message ?? String(e));
    }
  }

  // Personal signaling channel: incoming invites, cancels, declines.
  useEffect(() => {
    if (!myId) return;
    const ch = supabase.channel(`call-user:${myId}`, { config: { broadcast: { self: false } } });
    ch.on('broadcast', { event: 'invite' }, async ({ payload }) => {
      const inv = payload as Invite;
      if (phaseRef.current !== 'idle') {
        // Busy — auto-decline.
        sendToUser(inv.from, 'declined', { callId: inv.callId, from: myIdRef.current });
        return;
      }
      // Silently ignore calls from a blocked party (either direction).
      if (inv.from && (await isBlockedWith(inv.from).catch(() => false))) return;
      setIncoming(inv);
      setPhaseBoth('ringing');
    });
    ch.on('broadcast', { event: 'cancel' }, ({ payload }) => {
      if (phaseRef.current === 'ringing' && incomingCallIdRef.current === payload.callId) {
        setIncoming(null);
        setPhaseBoth('idle');
      }
    });
    ch.on('broadcast', { event: 'declined' }, ({ payload }) => {
      // In a 1:1 outgoing call, a decline ends it. In a group call, ignore.
      if (
        phaseRef.current === 'incall' &&
        invitedRef.current.length === 1 &&
        pcsRef.current.size === 0 &&
        callIdRef.current === payload.callId
      ) {
        setEndedNote(t('call.rejected'));
        window.setTimeout(() => setEndedNote(''), 3500);
        cleanup();
      }
    });
    ch.subscribe();
    return () => {
      void supabase.removeChannel(ch);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [myId]);

  // Mirror the incoming call id for the cancel handler.
  useEffect(() => {
    incomingCallIdRef.current = incoming?.callId ?? null;
  }, [incoming]);

  // Ring (sound + vibration) while an incoming call is waiting to be answered.
  useEffect(() => {
    if (phase === 'ringing' && incoming) startRingtone();
    else stopRingtone();
    return () => stopRingtone();
  }, [phase, incoming]);

  const remoteList = Array.from(participants.values());
  const totalTiles = remoteList.length + 1; // + me
  const oneToOne = remoteList.length <= 1;
  const status = remoteList.some((p) => p.stream)
    ? t('call.connected')
    : remoteList.length === 0
    ? t('call.calling')
    : t('call.connecting');

  return (
    <Ctx.Provider value={{ startCall, busy: phase !== 'idle' }}>
      {children}

      {endedNote && (
        <div className="fixed inset-x-0 top-4 z-[95] flex justify-center px-4">
          <div className="rounded-full border border-slate-700 bg-slate-900/95 px-4 py-2 text-sm text-slate-100 shadow-lg">
            {endedNote}
          </div>
        </div>
      )}

      {/* Incoming */}
      {phase === 'ringing' && incoming && (
        <div className="fixed inset-0 z-[95] flex items-center justify-center bg-black/80 p-4">
          <div className="w-full max-w-xs rounded-2xl border border-slate-800 bg-slate-950 p-6 text-center shadow-xl">
            <div className="mx-auto grid h-20 w-20 place-items-center rounded-full bg-slate-800 text-slate-200">
              {incoming.video ? <VideoIcon size={32} /> : <PhoneIcon size={32} />}
            </div>
            <div className="mt-3 text-lg font-semibold text-slate-100">{incoming.label || incoming.fromName}</div>
            <div className="text-sm text-slate-400">
              {incoming.isGroup
                ? t('call.incomingGroup', { name: incoming.fromName })
                : incoming.video
                ? t('call.incomingVideo')
                : t('call.incomingAudio')}
            </div>
            <div className="mt-6 flex justify-center gap-6">
              <button
                type="button"
                onClick={declineCall}
                aria-label={t('call.decline')}
                className="grid h-14 w-14 place-items-center rounded-full bg-rose-600 text-white hover:bg-rose-500"
              >
                <PhoneOffIcon size={24} />
              </button>
              <button
                type="button"
                onClick={acceptCall}
                aria-label={t('call.accept')}
                className="grid h-14 w-14 place-items-center rounded-full bg-emerald-600 text-white hover:bg-emerald-500"
              >
                {incoming.video ? <VideoIcon size={24} /> : <PhoneIcon size={24} />}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Active call */}
      {phase === 'incall' && (
        <div className="fixed inset-0 z-[95] flex flex-col bg-slate-950">
          <div className="relative flex-1 overflow-hidden">
            {oneToOne ? (
              <>
                {remoteList[0] ? (
                  <RemoteTile p={remoteList[0]} fill register={registerMediaEl} />
                ) : (
                  <div className="flex h-full w-full flex-col items-center justify-center gap-3">
                    <div className="grid h-24 w-24 place-items-center rounded-full bg-slate-800 text-4xl text-slate-300">
                      {(label || '?').charAt(0).toUpperCase()}
                    </div>
                    <div className="text-lg font-semibold text-slate-100">{label}</div>
                  </div>
                )}
                {localHasVideo && (
                  <video
                    ref={localVideoRef}
                    autoPlay
                    playsInline
                    muted
                    className={`absolute bottom-4 right-4 h-40 w-28 rounded-xl border border-slate-700 object-cover ${
                      cameraOff ? 'hidden' : ''
                    }`}
                  />
                )}
              </>
            ) : (
              <div
                className={`grid h-full w-full gap-1 p-1 ${totalTiles <= 4 ? 'grid-cols-2' : 'grid-cols-3'}`}
              >
                {remoteList.map((p) => (
                  <RemoteTile key={p.id} p={p} register={registerMediaEl} />
                ))}
                {/* Local tile */}
                <div className="relative aspect-square overflow-hidden rounded-xl bg-slate-900">
                  <video
                    ref={localVideoRef}
                    autoPlay
                    playsInline
                    muted
                    className={`h-full w-full object-cover ${localHasVideo && !cameraOff ? '' : 'invisible'}`}
                  />
                  {(!localHasVideo || cameraOff) && (
                    <div className="absolute inset-0 grid place-items-center">
                      <div className="grid h-16 w-16 place-items-center rounded-full bg-slate-800 text-2xl text-slate-300">
                        {(myNameRef.current || '?').charAt(0).toUpperCase()}
                      </div>
                    </div>
                  )}
                  <span className="absolute bottom-1 left-2 text-xs text-white/80 drop-shadow">{t('call.you')}</span>
                </div>
              </div>
            )}

            {/* Status */}
            <div className="absolute left-0 right-0 top-6 text-center">
              <div className="text-base font-medium text-white drop-shadow">{label}</div>
              <div className="text-sm text-white/70 drop-shadow">{status}</div>
              {errText && <div className="mt-1 text-xs text-rose-300">{errText}</div>}
            </div>
          </div>

          {/* Controls */}
          <div className="flex items-center justify-center gap-5 bg-slate-950 py-5">
            <button
              type="button"
              onClick={toggleMute}
              aria-label={muted ? t('call.unmute') : t('call.mute')}
              className={`grid h-12 w-12 place-items-center rounded-full ${
                muted ? 'bg-white text-slate-900' : 'bg-slate-800 text-white hover:bg-slate-700'
              }`}
            >
              {muted ? <MicOffIcon size={22} /> : <MicIcon size={22} />}
            </button>
            {!localHasVideo && (
              <button
                type="button"
                onClick={upgradeToVideo}
                aria-label={t('call.switchToVideo')}
                title={t('call.switchToVideo')}
                className="grid h-12 w-12 place-items-center rounded-full bg-slate-800 text-white hover:bg-slate-700"
              >
                <VideoIcon size={22} />
              </button>
            )}
            {localHasVideo && (
              <button
                type="button"
                onClick={toggleCamera}
                aria-label={t('call.toggleCamera')}
                className={`grid h-12 w-12 place-items-center rounded-full ${
                  cameraOff ? 'bg-white text-slate-900' : 'bg-slate-800 text-white hover:bg-slate-700'
                }`}
              >
                {cameraOff ? <VideoOffIcon size={22} /> : <VideoIcon size={22} />}
              </button>
            )}
            {localHasVideo && !cameraOff && (
              <button
                type="button"
                onClick={flipCamera}
                aria-label={t('call.flipCamera')}
                className="grid h-12 w-12 place-items-center rounded-full bg-slate-800 text-white hover:bg-slate-700"
              >
                <SwitchCameraIcon size={22} />
              </button>
            )}
            <button
              type="button"
              onClick={toggleSpeaker}
              aria-label={speakerOn ? t('call.speakerOn') : t('call.speakerOff')}
              className={`grid h-12 w-12 place-items-center rounded-full ${
                speakerOn ? 'bg-slate-800 text-white hover:bg-slate-700' : 'bg-white text-slate-900'
              } ${speakerSupported ? '' : 'opacity-50'}`}
            >
              {speakerOn ? <SpeakerIcon size={22} /> : <SpeakerOffIcon size={22} />}
            </button>
            <button
              type="button"
              onClick={endCall}
              aria-label={t('call.hangUp')}
              className="grid h-12 w-12 place-items-center rounded-full bg-rose-600 text-white hover:bg-rose-500"
            >
              <PhoneOffIcon size={22} />
            </button>
          </div>
        </div>
      )}
    </Ctx.Provider>
  );
}

export function useCall() {
  return useContext(Ctx);
}
