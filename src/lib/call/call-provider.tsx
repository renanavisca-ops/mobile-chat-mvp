'use client';

import { apiFetch } from '@/lib/api/client';
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
import {
  hasNativeAudioRoute,
  nativeStartCallAudio,
  nativeSetSpeakerphone,
  nativeStopCallAudio,
} from '@/lib/call/native-audio';
import { useT } from '@/lib/i18n/context';
import { screenShareSupported, captureScreenTrack, stopScreenCapture } from '@/lib/call/screen-share';
import { applyRemoteControl, RELAYED_KEYS, type RcMsg } from '@/lib/call/remote-control';
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
  ScreenShareIcon,
  ScreenShareOffIcon,
  HandPointerIcon,
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

/** A control/pointer event captured from the shared-screen tile, normalized. */
type TileInput = { kind: RcMsg['kind']; x?: number; y?: number; dy?: number };

/** Attaches a MediaStream to a <video> and shows an avatar fallback for audio. */
function RemoteTile({
  p,
  fill,
  register,
  screen,
  pointerActive,
  controlActive,
  onInput,
}: {
  p: Participant;
  fill?: boolean;
  register?: (el: HTMLVideoElement, attach: boolean) => void;
  // A screen share fits the whole surface (no crop) so coordinates map exactly.
  screen?: boolean;
  // Send pointer moves (helper is viewing the shared screen).
  pointerActive?: boolean;
  // Also relay clicks/scroll (helper has been granted control).
  controlActive?: boolean;
  onInput?: (e: TileInput) => void;
}) {
  const ref = useRef<HTMLVideoElement | null>(null);
  const lastPtr = useRef(0);
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

  // Map a mouse event to [0..1] coords over the ACTUAL video content, honoring
  // the object-contain letterboxing so a click lands where the helper aimed.
  const norm = (e: { clientX: number; clientY: number }): { x: number; y: number } | null => {
    const el = ref.current;
    if (!el) return null;
    const rect = el.getBoundingClientRect();
    const vw = el.videoWidth || rect.width;
    const vh = el.videoHeight || rect.height;
    if (!vw || !vh) return null;
    const scale = Math.min(rect.width / vw, rect.height / vh);
    const cw = vw * scale;
    const chh = vh * scale;
    const offX = (rect.width - cw) / 2;
    const offY = (rect.height - chh) / 2;
    const x = (e.clientX - rect.left - offX) / cw;
    const y = (e.clientY - rect.top - offY) / chh;
    if (x < 0 || y < 0 || x > 1 || y > 1) return null;
    return { x, y };
  };

  const capture = pointerActive || controlActive;

  return (
    <div className={`relative overflow-hidden bg-slate-900 ${fill ? 'h-full w-full' : 'aspect-square rounded-xl'}`}>
      <video
        ref={ref}
        autoPlay
        playsInline
        className={`h-full w-full ${screen ? 'object-contain' : 'object-cover'} ${hasVideo ? '' : 'invisible'}`}
      />
      {!hasVideo && (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-2">
          <div className="grid h-16 w-16 place-items-center rounded-full bg-slate-800 text-2xl text-slate-300">
            {(p.name || '?').charAt(0).toUpperCase()}
          </div>
        </div>
      )}
      {capture && (
        <div
          className={`absolute inset-0 z-[2] ${controlActive ? 'cursor-crosshair' : 'cursor-default'}`}
          onMouseMove={(e) => {
            if (!pointerActive && !controlActive) return;
            const now = Date.now();
            if (now - lastPtr.current < 90) return; // ~11/s, kind to the channel
            lastPtr.current = now;
            const c = norm(e);
            if (c) onInput?.({ kind: 'ptr', x: c.x, y: c.y });
          }}
          onMouseLeave={() => onInput?.({ kind: 'ptrgone' })}
          onClick={(e) => {
            if (!controlActive) return;
            const c = norm(e);
            if (c) onInput?.({ kind: 'click', x: c.x, y: c.y });
          }}
          onDoubleClick={(e) => {
            if (!controlActive) return;
            const c = norm(e);
            if (c) onInput?.({ kind: 'dblclick', x: c.x, y: c.y });
          }}
          onWheel={(e) => {
            if (!controlActive) return;
            const c = norm(e);
            if (c) onInput?.({ kind: 'scroll', x: c.x, y: c.y, dy: e.deltaY });
          }}
        />
      )}
      <span className="absolute bottom-1 left-2 z-[3] text-xs text-white/80 drop-shadow">{p.name}</span>
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

  // --- Screen share + remote assistance -------------------------------------
  // I am sharing my screen.
  const [screenSharing, setScreenSharing] = useState(false);
  // A peer is sharing their screen (their id), so I can view/point/control it.
  const [remoteSharing, setRemoteSharing] = useState<string | null>(null);
  // The call UI collapses to a floating bar while I share, so I can use Toky
  // behind it (and the helper can see/drive the real app, not the call screen).
  const [minimized, setMinimized] = useState(false);
  // A peer whose Toky *I* am currently driving (I'm the helper).
  const [controllingPeer, setControllingPeer] = useState<string | null>(null);
  // I asked this peer for control and am waiting for their answer.
  const [controlPending, setControlPending] = useState<string | null>(null);
  // A peer who is currently driving MY Toky (I granted them control).
  const [controlHostingFor, setControlHostingFor] = useState<string | null>(null);
  // An incoming request: this peer wants to control my Toky.
  const [controlRequestFrom, setControlRequestFrom] = useState<string | null>(null);
  // Live position (normalized) of the helper's pointer, shown on my screen.
  const [remotePtr, setRemotePtr] = useState<{ x: number; y: number } | null>(null);

  // Refs mirror the above so the once-created signaling handlers read live values.
  const screenSharingRef = useRef(false);
  const remoteSharingRef = useRef<string | null>(null);
  const controllingPeerRef = useRef<string | null>(null);
  const controlPendingRef = useRef<string | null>(null);
  const controlHostingForRef = useRef<string | null>(null);
  const screenTrackRef = useRef<MediaStreamTrack | null>(null);
  const shareRestoreRef = useRef<{
    via: 'replace' | 'add';
    cam: MediaStreamTrack | null;
    prevIsVideo: boolean;
    prevLocalHasVideo: boolean;
  } | null>(null);
  const canScreenShare = screenShareSupported();

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

  // Two ways to route call audio to the loudspeaker:
  //   - Native Android: the AudioRoute plugin drives the platform AudioManager
  //     (the WebView supports neither setSinkId nor real loudspeaker routing).
  //   - Web/desktop: HTMLMediaElement.setSinkId picks the output device.
  const nativeAudio = hasNativeAudioRoute();
  const speakerSupported =
    nativeAudio ||
    (typeof window !== 'undefined' &&
      typeof (HTMLMediaElement.prototype as unknown as { setSinkId?: unknown }).setSinkId === 'function');

  // Route every remote audio/video element to the chosen output device.
  const applySpeaker = useCallback(async (on: boolean) => {
    if (nativeAudio) {
      await nativeSetSpeakerphone(on);
      return;
    }
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
  }, [nativeAudio, speakerSupported]);

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

  // Keep refs in sync for the signaling handlers (created once, below).
  useEffect(() => {
    screenSharingRef.current = screenSharing;
  }, [screenSharing]);
  useEffect(() => {
    remoteSharingRef.current = remoteSharing;
  }, [remoteSharing]);
  useEffect(() => {
    controllingPeerRef.current = controllingPeer;
  }, [controllingPeer]);
  useEffect(() => {
    controlPendingRef.current = controlPending;
  }, [controlPending]);
  useEffect(() => {
    controlHostingForRef.current = controlHostingFor;
  }, [controlHostingFor]);

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
    try {
      screenTrackRef.current?.stop();
    } catch {}
    if (screenTrackRef.current) void stopScreenCapture();
    screenTrackRef.current = null;
    shareRestoreRef.current = null;
    localStreamRef.current?.getTracks().forEach((tr) => tr.stop());
    localStreamRef.current = null;
    // Restore the phone's normal audio state (undo MODE_IN_COMMUNICATION /
    // loudspeaker) now that the call is over.
    void nativeStopCallAudio();
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
    setScreenSharing(false);
    setRemoteSharing(null);
    setMinimized(false);
    setControllingPeer(null);
    setControlPending(null);
    setControlHostingFor(null);
    setControlRequestFrom(null);
    setRemotePtr(null);
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
      const res = await apiFetch('/api/turn', {
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
    // A peer started/stopped sharing their screen.
    ch.on('broadcast', { event: 'share' }, ({ payload }) => {
      if (payload.to !== myIdRef.current) return;
      const from = payload.from as string;
      const on = !!payload.on;
      if (on) {
        setRemoteSharing(from);
      } else {
        if (remoteSharingRef.current === from) setRemoteSharing(null);
        // If I was controlling them, that ends when their share ends.
        if (controllingPeerRef.current === from) setControllingPeer(null);
        if (controlPendingRef.current === from) setControlPending(null);
      }
    });
    // Remote-assistance events (pointer + control). See remote-control.ts.
    ch.on('broadcast', { event: 'rc' }, ({ payload }) => {
      if (payload.to !== myIdRef.current) return;
      handleRc(payload as RcMsg);
    });
  }

  // Apply one remote-assistance message. Runs on whichever side it's addressed
  // to; roles are enforced here so a peer can only drive me once I've granted it.
  function handleRc(msg: RcMsg) {
    switch (msg.kind) {
      case 'ptr':
        // Someone viewing MY shared screen is pointing — show the dot.
        if (screenSharingRef.current && msg.x != null && msg.y != null) {
          setRemotePtr({ x: msg.x, y: msg.y });
        }
        break;
      case 'ptrgone':
        setRemotePtr(null);
        break;
      case 'req':
        // A viewer asks to control my Toky — only valid while I'm sharing.
        if (screenSharingRef.current) setControlRequestFrom(msg.from);
        break;
      case 'grant':
        // My control request was accepted.
        if (controlPendingRef.current === msg.from) {
          setControlPending(null);
          setControllingPeer(msg.from);
        }
        break;
      case 'deny':
        if (controlPendingRef.current === msg.from) {
          setControlPending(null);
          setEndedNote(t('call.controlDenied'));
          window.setTimeout(() => setEndedNote(''), 3000);
        }
        break;
      case 'end':
        // The other side ended the session (in either role).
        if (controlHostingForRef.current === msg.from) {
          setControlHostingFor(null);
          setRemotePtr(null);
        }
        if (controllingPeerRef.current === msg.from) setControllingPeer(null);
        break;
      default:
        // click / dblclick / scroll / text / key — apply only if this peer
        // currently holds control of me.
        if (controlHostingForRef.current === msg.from) applyRemoteControl(msg);
    }
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
        // Enter native voice mode and honor the default speaker-on state.
        await nativeStartCallAudio();
        await applySpeaker(true); // speaker defaults on at call start
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
          void apiFetch('/api/push/call', {
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
      // Enter native voice mode and honor the default speaker-on state.
      await nativeStartCallAudio();
      await applySpeaker(true); // speaker defaults on at call start
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

  // Send a remote-assistance message to one peer over the call channel.
  function sendRc(to: string, kind: RcMsg['kind'], extra?: Partial<RcMsg>) {
    sendSignal('rc', { from: myIdRef.current, to, kind, ...extra });
  }

  // --- Screen share ---------------------------------------------------------
  async function startScreenShare() {
    if (screenSharing) return;
    if (!canScreenShare) {
      setErrText(t('call.screenShareUnsupported'));
      return;
    }
    try {
      const track = await captureScreenTrack();
      screenTrackRef.current = track;
      let via: 'replace' | 'add' = 'add';
      let cam: MediaStreamTrack | null = null;
      for (const [pid, pc] of pcsRef.current.entries()) {
        const sender = pc.getSenders().find((s) => s.track && s.track.kind === 'video');
        if (sender) {
          cam = sender.track; // the camera track, to restore on stop
          via = 'replace';
          await sender.replaceTrack(track);
        } else if (localStreamRef.current) {
          pc.addTrack(track, localStreamRef.current);
          const offer = await pc.createOffer();
          await pc.setLocalDescription(offer);
          sendSignal('offer', { from: myIdRef.current, to: pid, sdp: offer });
        }
      }
      shareRestoreRef.current = {
        via,
        cam,
        prevIsVideo: isVideo,
        prevLocalHasVideo: localHasVideo,
      };
      setLocalHasVideo(true);
      setIsVideo(true);
      setScreenSharing(true);
      setMinimized(true);
      for (const pid of pcsRef.current.keys()) sendSignal('share', { from: myIdRef.current, to: pid, on: true });
      // The browser's own "Stop sharing" ends the track — mirror that here.
      track.onended = () => {
        void stopScreenShare();
      };
    } catch (e: any) {
      // A user cancelling the picker throws too; only surface real errors.
      if (e?.name !== 'NotAllowedError' && e?.name !== 'AbortError') {
        setErrText(e?.message ?? String(e));
      }
    }
  }

  async function stopScreenShare() {
    const track = screenTrackRef.current;
    const restore = shareRestoreRef.current;
    if (!track) return;
    for (const [pid, pc] of pcsRef.current.entries()) {
      const sender = pc.getSenders().find((s) => s.track === track);
      if (!sender) continue;
      if (restore?.via === 'replace') {
        await sender.replaceTrack(restore.cam);
      } else {
        try {
          pc.removeTrack(sender);
        } catch {}
        const offer = await pc.createOffer();
        await pc.setLocalDescription(offer);
        sendSignal('offer', { from: myIdRef.current, to: pid, sdp: offer });
      }
    }
    try {
      track.stop();
    } catch {}
    void stopScreenCapture(); // release native MediaProjection (no-op on web)
    screenTrackRef.current = null;
    // Tell viewers, and end any control they held over me.
    for (const pid of pcsRef.current.keys()) sendSignal('share', { from: myIdRef.current, to: pid, on: false });
    if (controlHostingForRef.current) {
      sendRc(controlHostingForRef.current, 'end');
      setControlHostingFor(null);
    }
    setControlRequestFrom(null);
    setRemotePtr(null);
    setLocalHasVideo(restore?.prevLocalHasVideo ?? false);
    setIsVideo(restore?.prevIsVideo ?? false);
    shareRestoreRef.current = null;
    setScreenSharing(false);
    setMinimized(false);
  }

  // --- Remote control (co-browse of the Toky app) ---------------------------
  function requestControl() {
    if (!remoteSharing) return;
    setControlPending(remoteSharing);
    sendRc(remoteSharing, 'req');
  }

  function grantControl() {
    const who = controlRequestFrom;
    if (!who) return;
    setControlRequestFrom(null);
    setControlHostingFor(who);
    sendRc(who, 'grant');
  }

  function denyControl() {
    const who = controlRequestFrom;
    if (!who) return;
    setControlRequestFrom(null);
    sendRc(who, 'deny');
  }

  // The person being controlled ends it (always-available "stop" button).
  function endHostedControl() {
    const who = controlHostingForRef.current;
    if (who) sendRc(who, 'end');
    setControlHostingFor(null);
    setRemotePtr(null);
  }

  // The helper stops driving the other person's Toky.
  function stopControlling() {
    const who = controllingPeerRef.current;
    if (who) sendRc(who, 'end');
    setControllingPeer(null);
    setControlPending(null);
  }

  // Emit pointer/click/scroll captured over the shared-screen tile (helper side).
  function onTileInput(inp: { kind: RcMsg['kind']; x?: number; y?: number; dy?: number }) {
    const to = remoteSharing;
    if (!to) return;
    // Pointer is always allowed while viewing a share; the rest needs control.
    if ((inp.kind === 'ptr' || inp.kind === 'ptrgone') || controllingPeer === to) {
      sendRc(to, inp.kind, { x: inp.x, y: inp.y, dy: inp.dy });
    }
  }

  // While I'm controlling a peer, relay my keyboard to their focused field.
  useEffect(() => {
    if (!controllingPeer) return;
    const to = controllingPeer;
    const onKey = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey || e.altKey) return; // don't hijack shortcuts
      if (e.key.length === 1) {
        e.preventDefault();
        sendRc(to, 'text', { text: e.key });
      } else if (RELAYED_KEYS.has(e.key)) {
        e.preventDefault();
        sendRc(to, 'key', { key: e.key });
      }
    };
    window.addEventListener('keydown', onKey, true);
    return () => window.removeEventListener('keydown', onKey, true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [controllingPeer]);

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

      {/* Minimized call bar — shown while I share my screen, so the real Toky
          app is usable behind it (and visible/controllable to the helper). */}
      {phase === 'incall' && minimized && (
        <div className="fixed inset-x-0 bottom-0 z-[96] flex justify-center px-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
          <div className="toky-glass flex items-center gap-2 rounded-2xl border border-white/10 px-3 py-2 shadow-2xl">
            <span className="flex items-center gap-1.5 pl-1 pr-1 text-xs font-medium text-emerald-300">
              <ScreenShareIcon size={16} /> {t('call.sharingScreen')}
            </span>
            <button
              type="button"
              onClick={toggleMute}
              aria-label={muted ? t('call.unmute') : t('call.mute')}
              className={`grid h-10 w-10 place-items-center rounded-full ${
                muted ? 'bg-white text-slate-900' : 'bg-slate-800 text-white hover:bg-slate-700'
              }`}
            >
              {muted ? <MicOffIcon size={18} /> : <MicIcon size={18} />}
            </button>
            <button
              type="button"
              onClick={() => setMinimized(false)}
              className="rounded-full bg-slate-800 px-3 py-2 text-xs font-medium text-white hover:bg-slate-700"
            >
              {t('call.expand')}
            </button>
            <button
              type="button"
              onClick={() => void stopScreenShare()}
              className="rounded-full bg-slate-800 px-3 py-2 text-xs font-medium text-white hover:bg-slate-700"
            >
              {t('call.stopScreenShare')}
            </button>
            <button
              type="button"
              onClick={endCall}
              aria-label={t('call.hangUp')}
              className="grid h-10 w-10 place-items-center rounded-full bg-rose-600 text-white hover:bg-rose-500"
            >
              <PhoneOffIcon size={18} />
            </button>
          </div>
        </div>
      )}

      {/* The helper's live pointer, drawn over my whole viewport while I share. */}
      {phase === 'incall' && screenSharing && remotePtr && (
        <div
          className="pointer-events-none fixed z-[97]"
          style={{ left: `${remotePtr.x * 100}%`, top: `${remotePtr.y * 100}%`, transform: 'translate(-2px,-2px)' }}
        >
          <HandPointerIcon size={28} className="text-amber-400 drop-shadow-[0_1px_3px_rgba(0,0,0,0.8)]" />
        </div>
      )}

      {/* Persistent "someone is controlling my Toky" banner — always endable. */}
      {phase === 'incall' && controlHostingFor && (
        <div className="fixed inset-x-0 top-0 z-[98] flex justify-center px-3 pt-safe">
          <div className="mt-2 flex items-center gap-3 rounded-full border border-amber-500/40 bg-amber-950/90 px-4 py-2 text-sm text-amber-100 shadow-2xl backdrop-blur">
            <span className="relative flex h-2.5 w-2.5">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-amber-400 opacity-75" />
              <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-amber-400" />
            </span>
            <span className="font-medium">{t('call.beingControlled')}</span>
            <button
              type="button"
              onClick={endHostedControl}
              className="rounded-full bg-white px-3 py-1 text-xs font-semibold text-slate-900 hover:bg-slate-200"
            >
              {t('call.endControl')}
            </button>
          </div>
        </div>
      )}

      {/* Incoming request to control my Toky. */}
      {phase === 'incall' && controlRequestFrom && (
        <div className="fixed inset-0 z-[99] flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm">
          <div className="toky-glass toky-elev w-full max-w-xs rounded-3xl border border-slate-800 p-6 text-center">
            <div className="mx-auto grid h-14 w-14 place-items-center rounded-2xl bg-amber-500/20 text-amber-300">
              <HandPointerIcon size={26} />
            </div>
            <div className="mt-4 font-display text-lg font-bold text-slate-100">{t('call.controlRequestTitle')}</div>
            <p className="mt-1 text-sm text-slate-400">{t('call.controlRequestBody')}</p>
            <div className="mt-5 flex gap-3">
              <button
                type="button"
                onClick={denyControl}
                className="flex-1 rounded-xl border border-slate-700 bg-slate-900 px-3 py-2 text-sm font-medium text-slate-200 hover:bg-slate-800"
              >
                {t('call.controlDeny')}
              </button>
              <button
                type="button"
                onClick={grantControl}
                className="flex-1 rounded-xl bg-emerald-600 px-3 py-2 text-sm font-semibold text-white hover:bg-emerald-500"
              >
                {t('call.controlAllow')}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Incoming */}
      {phase === 'ringing' && incoming && (
        <div className="fixed inset-0 z-[95] flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm">
          <div className="toky-glass toky-elev w-full max-w-xs rounded-3xl border border-slate-800 p-7 text-center">
            <div className="relative mx-auto h-24 w-24">
              <span className="toky-grad absolute inset-0 animate-ping rounded-3xl opacity-30" />
              <div className="toky-grad toky-ring-brand relative grid h-24 w-24 place-items-center rounded-3xl text-3xl font-bold text-white">
                {(incoming.label || incoming.fromName || '?').charAt(0).toUpperCase()}
              </div>
            </div>
            <div className="mt-4 font-display text-xl font-bold text-slate-100">{incoming.label || incoming.fromName}</div>
            <div className="mt-0.5 flex items-center justify-center gap-1.5 text-sm text-slate-400">
              {incoming.video ? <VideoIcon size={15} /> : <PhoneIcon size={15} />}
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
      {phase === 'incall' && !minimized && (
        <div
          className="fixed inset-0 z-[95] flex flex-col bg-slate-950"
          style={{
            backgroundImage:
              'radial-gradient(40rem 40rem at 50% 12%, rgba(99,102,241,0.22), transparent 60%), radial-gradient(34rem 34rem at 80% 100%, rgba(56,189,248,0.14), transparent 55%)',
          }}
        >
          <div className="relative flex-1 overflow-hidden">
            {oneToOne ? (
              <>
                {remoteList[0] ? (
                  <RemoteTile
                    p={remoteList[0]}
                    fill
                    register={registerMediaEl}
                    screen={remoteSharing === remoteList[0].id}
                    pointerActive={remoteSharing === remoteList[0].id}
                    controlActive={controllingPeer === remoteList[0].id}
                    onInput={onTileInput}
                  />
                ) : (
                  <div className="flex h-full w-full flex-col items-center justify-center gap-4">
                    <div className="relative">
                      <span className="toky-grad absolute inset-0 animate-ping rounded-[2rem] opacity-20" />
                      <div className="toky-grad toky-ring-brand relative grid h-28 w-28 place-items-center rounded-[2rem] text-5xl font-bold text-white">
                        {(label || '?').charAt(0).toUpperCase()}
                      </div>
                    </div>
                    <div className="font-display text-xl font-bold text-slate-100">{label}</div>
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
          <div className="toky-glass flex items-center justify-center gap-4 border-t border-white/10 py-5 pb-[max(1.25rem,env(safe-area-inset-bottom))]">
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
            {canScreenShare && (
              <button
                type="button"
                onClick={() => (screenSharing ? void stopScreenShare() : void startScreenShare())}
                aria-label={screenSharing ? t('call.stopScreenShare') : t('call.screenShare')}
                title={screenSharing ? t('call.stopScreenShare') : t('call.screenShare')}
                className={`grid h-12 w-12 place-items-center rounded-full ${
                  screenSharing ? 'bg-white text-slate-900' : 'bg-slate-800 text-white hover:bg-slate-700'
                }`}
              >
                {screenSharing ? <ScreenShareOffIcon size={22} /> : <ScreenShareIcon size={22} />}
              </button>
            )}
            {oneToOne && remoteList[0] && remoteSharing === remoteList[0].id && (
              <button
                type="button"
                onClick={() => (controllingPeer ? stopControlling() : requestControl())}
                disabled={!!controlPending}
                aria-label={controllingPeer ? t('call.stopControlling') : t('call.requestControl')}
                title={controllingPeer ? t('call.stopControlling') : t('call.requestControl')}
                className={`grid h-12 w-12 place-items-center rounded-full disabled:opacity-50 ${
                  controllingPeer ? 'bg-emerald-500 text-white' : 'bg-slate-800 text-white hover:bg-slate-700'
                }`}
              >
                <HandPointerIcon size={22} />
              </button>
            )}
            <button
              type="button"
              onClick={endCall}
              aria-label={t('call.hangUp')}
              className="grid h-14 w-14 place-items-center rounded-full bg-rose-600 text-white shadow-[0_8px_22px_-8px_rgba(225,29,72,0.8)] hover:bg-rose-500"
            >
              <PhoneOffIcon size={24} />
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
