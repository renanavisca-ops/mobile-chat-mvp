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
import { useT } from '@/lib/i18n/context';
import { PhoneIcon, PhoneOffIcon, VideoIcon, VideoOffIcon, MicIcon, MicOffIcon } from '@/components/icons';

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
function RemoteTile({ p, fill }: { p: Participant; fill?: boolean }) {
  const ref = useRef<HTMLVideoElement | null>(null);
  useEffect(() => {
    if (ref.current && p.stream) ref.current.srcObject = p.stream;
  }, [p.stream]);
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
  const [muted, setMuted] = useState(false);
  const [cameraOff, setCameraOff] = useState(false);
  const [incoming, setIncoming] = useState<Invite | null>(null);
  const [participants, setParticipants] = useState<Map<string, Participant>>(new Map());
  const [errText, setErrText] = useState('');

  const pcsRef = useRef<Map<string, RTCPeerConnection>>(new Map());
  const remoteSetRef = useRef<Map<string, boolean>>(new Map());
  const pendingIceRef = useRef<Map<string, RTCIceCandidateInit[]>>(new Map());
  const localStreamRef = useRef<MediaStream | null>(null);
  const channelRef = useRef<RealtimeChannel | null>(null);
  const callIdRef = useRef<string | null>(null);
  const invitedRef = useRef<string[]>([]);
  const iceServersRef = useRef<RTCIceServer[]>([{ urls: 'stun:stun.cloudflare.com:3478' }]);
  const incomingCallIdRef = useRef<string | null>(null);

  const localVideoRef = useRef<HTMLVideoElement | null>(null);

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
  }, []);

  const cleanup = useCallback(() => {
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
    setParticipants(new Map());
    setIncoming(null);
    setMuted(false);
    setCameraOff(false);
    setErrText('');
    setPhaseBoth('idle');
  }, [supabase]);

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
      setLabel(opts.label);
      setIsVideo(opts.video);
      setPhaseBoth('incall');

      try {
        const stream = await navigator.mediaDevices.getUserMedia(MEDIA(opts.video));
        localStreamRef.current = stream;
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
    try {
      const stream = await navigator.mediaDevices.getUserMedia(MEDIA(inv.video));
      localStreamRef.current = stream;
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

  // Personal signaling channel: incoming invites, cancels, declines.
  useEffect(() => {
    if (!myId) return;
    const ch = supabase.channel(`call-user:${myId}`, { config: { broadcast: { self: false } } });
    ch.on('broadcast', { event: 'invite' }, ({ payload }) => {
      const inv = payload as Invite;
      if (phaseRef.current !== 'idle') {
        // Busy — auto-decline.
        sendToUser(inv.from, 'declined', { callId: inv.callId, from: myIdRef.current });
        return;
      }
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
                  <RemoteTile p={remoteList[0]} fill />
                ) : (
                  <div className="flex h-full w-full flex-col items-center justify-center gap-3">
                    <div className="grid h-24 w-24 place-items-center rounded-full bg-slate-800 text-4xl text-slate-300">
                      {(label || '?').charAt(0).toUpperCase()}
                    </div>
                    <div className="text-lg font-semibold text-slate-100">{label}</div>
                  </div>
                )}
                {isVideo && (
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
                  <RemoteTile key={p.id} p={p} />
                ))}
                {/* Local tile */}
                <div className="relative aspect-square overflow-hidden rounded-xl bg-slate-900">
                  <video
                    ref={localVideoRef}
                    autoPlay
                    playsInline
                    muted
                    className={`h-full w-full object-cover ${isVideo && !cameraOff ? '' : 'invisible'}`}
                  />
                  {(!isVideo || cameraOff) && (
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
            {isVideo && (
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
