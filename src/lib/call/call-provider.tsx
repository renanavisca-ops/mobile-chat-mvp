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

type Phase = 'idle' | 'calling' | 'ringing' | 'connecting' | 'connected';

type StartOpts = { peerId: string; peerName: string; video: boolean };

type CallContext = {
  startCall: (opts: StartOpts) => void;
  busy: boolean;
};

const Ctx = createContext<CallContext>({ startCall: () => {}, busy: false });

type Invite = { callId: string; from: string; fromName: string; video: boolean; sdp: RTCSessionDescriptionInit };

const MEDIA = (video: boolean): MediaStreamConstraints => ({
  audio: true,
  video: video ? { width: { ideal: 1280 }, height: { ideal: 720 }, facingMode: 'user' } : false,
});

export function CallProvider({ children }: { children: ReactNode }) {
  const t = useT();
  const supabase = browserSupabase();

  const [myId, setMyId] = useState<string | null>(null);
  const myNameRef = useRef<string>('');

  const [phase, setPhase] = useState<Phase>('idle');
  const [peerName, setPeerName] = useState('');
  const [isVideo, setIsVideo] = useState(false);
  const [muted, setMuted] = useState(false);
  const [cameraOff, setCameraOff] = useState(false);
  const [remoteHasVideo, setRemoteHasVideo] = useState(false);
  const [incoming, setIncoming] = useState<Invite | null>(null);
  const [errText, setErrText] = useState('');

  const pcRef = useRef<RTCPeerConnection | null>(null);
  const localStreamRef = useRef<MediaStream | null>(null);
  const sharedRef = useRef<RealtimeChannel | null>(null);
  const callIdRef = useRef<string | null>(null);
  const peerIdRef = useRef<string | null>(null);
  const remoteSetRef = useRef(false);
  const pendingIceRef = useRef<RTCIceCandidateInit[]>([]);

  const localVideoRef = useRef<HTMLVideoElement | null>(null);
  const remoteVideoRef = useRef<HTMLVideoElement | null>(null);

  // Identify the current user + cache their display name for outgoing invites.
  useEffect(() => {
    let alive = true;
    supabase.auth.getUser().then(async ({ data }) => {
      if (!alive) return;
      const u = data.user;
      setMyId(u?.id ?? null);
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
    });
    return () => {
      alive = false;
      sub.subscription.unsubscribe();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const cleanup = useCallback(() => {
    try {
      pcRef.current?.getSenders().forEach((s) => s.track?.stop());
      pcRef.current?.close();
    } catch {}
    pcRef.current = null;
    localStreamRef.current?.getTracks().forEach((tr) => tr.stop());
    localStreamRef.current = null;
    if (sharedRef.current) {
      void supabase.removeChannel(sharedRef.current);
      sharedRef.current = null;
    }
    callIdRef.current = null;
    peerIdRef.current = null;
    remoteSetRef.current = false;
    pendingIceRef.current = [];
    setPhase('idle');
    setIncoming(null);
    setMuted(false);
    setCameraOff(false);
    setRemoteHasVideo(false);
  }, [supabase]);

  // Attach streams to <video> elements whenever they mount.
  useEffect(() => {
    if (localVideoRef.current && localStreamRef.current) {
      localVideoRef.current.srcObject = localStreamRef.current;
    }
  }, [phase, cameraOff]);

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

  function sendShared(event: string, payload: Record<string, unknown>) {
    sharedRef.current?.send({ type: 'broadcast', event, payload });
  }

  // Fire-and-forget send to another user's personal channel (used for the
  // initial invite, before a shared call channel exists).
  function sendToUser(userId: string, event: string, payload: Record<string, unknown>) {
    const ch = supabase.channel(`call-user:${userId}`);
    ch.subscribe((status) => {
      if (status === 'SUBSCRIBED') {
        ch.send({ type: 'broadcast', event, payload });
        setTimeout(() => void supabase.removeChannel(ch), 1000);
      }
    });
  }

  function addIce(candidate: RTCIceCandidateInit) {
    const pc = pcRef.current;
    if (pc && remoteSetRef.current) {
      pc.addIceCandidate(new RTCIceCandidate(candidate)).catch(() => {});
    } else {
      pendingIceRef.current.push(candidate);
    }
  }

  function flushIce() {
    const pc = pcRef.current;
    if (!pc) return;
    for (const c of pendingIceRef.current) pc.addIceCandidate(new RTCIceCandidate(c)).catch(() => {});
    pendingIceRef.current = [];
  }

  function buildPc(iceServers: RTCIceServer[]): RTCPeerConnection {
    const pc = new RTCPeerConnection({ iceServers });
    pc.onicecandidate = (e) => {
      if (e.candidate) sendShared('ice', { candidate: e.candidate.toJSON() });
    };
    pc.ontrack = (e) => {
      const [stream] = e.streams;
      if (remoteVideoRef.current && stream) remoteVideoRef.current.srcObject = stream;
      setRemoteHasVideo(stream?.getVideoTracks().some((tr) => tr.enabled) ?? false);
    };
    pc.oniceconnectionstatechange = () => {
      const st = pc.iceConnectionState;
      if (st === 'connected' || st === 'completed') setPhase('connected');
      else if (st === 'failed' || st === 'disconnected' || st === 'closed') {
        // give a brief grace period for reconnection before tearing down
        if (st === 'failed') endCall(false);
      }
    };
    return pc;
  }

  // Join the shared per-call channel that both sides use for answer/ice/hangup.
  function joinShared(callId: string) {
    const ch = supabase.channel(`call:${callId}`, { config: { broadcast: { self: false } } });
    ch.on('broadcast', { event: 'answer' }, async ({ payload }) => {
      const pc = pcRef.current;
      if (!pc) return;
      await pc.setRemoteDescription(new RTCSessionDescription(payload.sdp as RTCSessionDescriptionInit));
      remoteSetRef.current = true;
      flushIce();
      setPhase('connecting');
    });
    ch.on('broadcast', { event: 'ice' }, ({ payload }) => addIce(payload.candidate as RTCIceCandidateInit));
    ch.on('broadcast', { event: 'hangup' }, () => endCall(false));
    ch.subscribe();
    sharedRef.current = ch;
  }

  const startCall = useCallback(
    async (opts: StartOpts) => {
      if (phase !== 'idle' || !myId) return;
      setErrText('');
      const callId = crypto.randomUUID();
      callIdRef.current = callId;
      peerIdRef.current = opts.peerId;
      setPeerName(opts.peerName);
      setIsVideo(opts.video);
      setPhase('calling');

      try {
        const stream = await navigator.mediaDevices.getUserMedia(MEDIA(opts.video));
        localStreamRef.current = stream;
        if (localVideoRef.current) localVideoRef.current.srcObject = stream;

        const iceServers = await getIceServers();
        const pc = buildPc(iceServers);
        pcRef.current = pc;
        stream.getTracks().forEach((tr) => pc.addTrack(tr, stream));

        joinShared(callId);

        const offer = await pc.createOffer();
        await pc.setLocalDescription(offer);

        sendToUser(opts.peerId, 'invite', {
          callId,
          from: myId,
          fromName: myNameRef.current,
          video: opts.video,
          sdp: offer,
        });
      } catch (e: any) {
        setErrText(e?.message ?? String(e));
        cleanup();
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [phase, myId]
  );

  async function acceptCall() {
    const inv = incoming;
    if (!inv) return;
    setIncoming(null);
    setPhase('connecting');
    setPeerName(inv.fromName);
    setIsVideo(inv.video);
    peerIdRef.current = inv.from;
    callIdRef.current = inv.callId;

    try {
      const stream = await navigator.mediaDevices.getUserMedia(MEDIA(inv.video));
      localStreamRef.current = stream;
      if (localVideoRef.current) localVideoRef.current.srcObject = stream;

      const iceServers = await getIceServers();
      const pc = buildPc(iceServers);
      pcRef.current = pc;
      stream.getTracks().forEach((tr) => pc.addTrack(tr, stream));

      await pc.setRemoteDescription(new RTCSessionDescription(inv.sdp));
      remoteSetRef.current = true;
      flushIce();

      const answer = await pc.createAnswer();
      await pc.setLocalDescription(answer);
      sendShared('answer', { sdp: answer });
    } catch (e: any) {
      setErrText(e?.message ?? String(e));
      sendShared('hangup', {});
      cleanup();
    }
  }

  function declineCall() {
    sendShared('hangup', {});
    cleanup();
  }

  function endCall(notify = true) {
    if (notify) sendShared('hangup', {});
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

  // Personal signaling channel: receive incoming invites.
  useEffect(() => {
    if (!myId) return;
    const ch = supabase.channel(`call-user:${myId}`, { config: { broadcast: { self: false } } });
    ch.on('broadcast', { event: 'invite' }, ({ payload }) => {
      const inv = payload as Invite;
      // If already in a call, auto-decline by telling the caller to hang up.
      if (phase !== 'idle') {
        const busyCh = supabase.channel(`call:${inv.callId}`);
        busyCh.subscribe((s) => {
          if (s === 'SUBSCRIBED') {
            busyCh.send({ type: 'broadcast', event: 'hangup', payload: {} });
            setTimeout(() => void supabase.removeChannel(busyCh), 1000);
          }
        });
        return;
      }
      setIncoming(inv);
      setPhase('ringing');
      callIdRef.current = inv.callId;
      peerIdRef.current = inv.from;
      // Join the shared channel now so ICE/hangup during ringing are captured.
      joinShared(inv.callId);
    });
    ch.subscribe();
    return () => {
      void supabase.removeChannel(ch);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [myId, phase]);

  const showOverlay = phase !== 'idle' && phase !== 'ringing';

  return (
    <Ctx.Provider value={{ startCall, busy: phase !== 'idle' }}>
      {children}

      {/* Incoming call */}
      {phase === 'ringing' && incoming && (
        <div className="fixed inset-0 z-[95] flex items-center justify-center bg-black/80 p-4">
          <div className="w-full max-w-xs rounded-2xl border border-slate-800 bg-slate-950 p-6 text-center shadow-xl">
            <div className="mx-auto grid h-20 w-20 place-items-center rounded-full bg-slate-800 text-3xl">
              {incoming.video ? '📹' : '📞'}
            </div>
            <div className="mt-3 text-lg font-semibold text-slate-100">{incoming.fromName}</div>
            <div className="text-sm text-slate-400">
              {incoming.video ? t('call.incomingVideo') : t('call.incomingAudio')}
            </div>
            <div className="mt-6 flex justify-center gap-6">
              <button
                type="button"
                onClick={declineCall}
                aria-label={t('call.decline')}
                className="grid h-14 w-14 place-items-center rounded-full bg-rose-600 text-2xl text-white hover:bg-rose-500"
              >
                📵
              </button>
              <button
                type="button"
                onClick={acceptCall}
                aria-label={t('call.accept')}
                className="grid h-14 w-14 place-items-center rounded-full bg-emerald-600 text-2xl text-white hover:bg-emerald-500"
              >
                ✅
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Active call overlay */}
      {showOverlay && (
        <div className="fixed inset-0 z-[95] flex flex-col bg-slate-950">
          <div className="relative flex-1 overflow-hidden">
            {/* Remote (also carries audio for audio-only calls) */}
            <video
              ref={remoteVideoRef}
              autoPlay
              playsInline
              className={`h-full w-full object-cover ${remoteHasVideo ? '' : 'invisible'}`}
            />
            {!remoteHasVideo && (
              <div className="absolute inset-0 flex flex-col items-center justify-center gap-3">
                <div className="grid h-24 w-24 place-items-center rounded-full bg-slate-800 text-4xl text-slate-300">
                  {(peerName || '?').charAt(0).toUpperCase()}
                </div>
                <div className="text-lg font-semibold text-slate-100">{peerName}</div>
              </div>
            )}

            {/* Local PiP */}
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

            {/* Status */}
            <div className="absolute left-0 right-0 top-6 text-center">
              <div className="text-base font-medium text-white drop-shadow">{peerName}</div>
              <div className="text-sm text-white/70 drop-shadow">
                {phase === 'calling'
                  ? t('call.calling')
                  : phase === 'connecting'
                  ? t('call.connecting')
                  : t('call.connected')}
              </div>
              {errText && <div className="mt-1 text-xs text-rose-300">{errText}</div>}
            </div>
          </div>

          {/* Controls */}
          <div className="flex items-center justify-center gap-5 bg-slate-950 py-5">
            <button
              type="button"
              onClick={toggleMute}
              aria-label={muted ? t('call.unmute') : t('call.mute')}
              className={`grid h-12 w-12 place-items-center rounded-full text-xl ${
                muted ? 'bg-white text-slate-900' : 'bg-slate-800 text-white hover:bg-slate-700'
              }`}
            >
              {muted ? '🔇' : '🎙️'}
            </button>
            {isVideo && (
              <button
                type="button"
                onClick={toggleCamera}
                aria-label={t('call.toggleCamera')}
                className={`grid h-12 w-12 place-items-center rounded-full text-xl ${
                  cameraOff ? 'bg-white text-slate-900' : 'bg-slate-800 text-white hover:bg-slate-700'
                }`}
              >
                {cameraOff ? '📷' : '📹'}
              </button>
            )}
            <button
              type="button"
              onClick={() => endCall(true)}
              aria-label={t('call.hangUp')}
              className="grid h-12 w-12 place-items-center rounded-full bg-rose-600 text-xl text-white hover:bg-rose-500"
            >
              📵
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
