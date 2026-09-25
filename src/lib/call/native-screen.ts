'use client';

/**
 * Native Android screen capture, bridged to a WebRTC-usable MediaStreamTrack.
 *
 * The Capacitor WebView's Chromium has no getDisplayMedia, so the native
 * ScreenShare plugin (MediaProjection) streams JPEG frames up here; we paint
 * them onto a canvas and hand back canvas.captureStream()'s video track, which
 * plugs straight into the existing RTCPeerConnection. Modest fps/size — meant
 * for "show me your screen so I can help", not full-motion video.
 *
 * On the web this module is unused (screen-share.ts uses getDisplayMedia).
 */
import { registerPlugin, Capacitor, type PluginListenerHandle } from '@capacitor/core';

interface ScreenSharePlugin {
  isSupported(): Promise<{ supported: boolean }>;
  start(): Promise<void>;
  stop(): Promise<void>;
  addListener(
    event: 'frame',
    cb: (d: { data: string; width: number; height: number }) => void
  ): Promise<PluginListenerHandle>;
  addListener(event: 'stopped', cb: () => void): Promise<PluginListenerHandle>;
}

const ScreenShare = registerPlugin<ScreenSharePlugin>('ScreenShare');

let frameSub: PluginListenerHandle | null = null;
let stoppedSub: PluginListenerHandle | null = null;

export function nativeScreenSupported(): boolean {
  try {
    // Must be Android AND the native ScreenShare plugin must actually be present.
    // The remote-model app auto-loads new web code into the OLD shell, which has
    // no plugin yet — isPluginAvailable keeps the button hidden there until the
    // .aab that bundles the plugin ships.
    return Capacitor.getPlatform() === 'android' && Capacitor.isPluginAvailable('ScreenShare');
  } catch {
    return false;
  }
}

/** Fully stop native capture and drop listeners. Safe to call repeatedly. */
export async function nativeStopScreen(): Promise<void> {
  try {
    await frameSub?.remove();
  } catch {}
  try {
    await stoppedSub?.remove();
  } catch {}
  frameSub = null;
  stoppedSub = null;
  try {
    await ScreenShare.stop();
  } catch {}
}

/**
 * Ask for MediaProjection consent, start capture, and return the outgoing screen
 * track. Throws 'cancelled' if the user declines the system dialog. When native
 * capture ends on its own (e.g. the system stops the projection) the track fires
 * an `ended` event so the caller can tear the share down like the web path.
 */
export async function nativeCaptureScreenTrack(): Promise<MediaStreamTrack> {
  const canvas = document.createElement('canvas');
  canvas.width = 540;
  canvas.height = 960;
  const ctx = canvas.getContext('2d');
  const img = new Image();
  img.onload = () => {
    const w = img.naturalWidth || canvas.width;
    const h = img.naturalHeight || canvas.height;
    if (canvas.width !== w || canvas.height !== h) {
      canvas.width = w;
      canvas.height = h;
    }
    ctx?.drawImage(img, 0, 0, canvas.width, canvas.height);
  };

  // start() throws if the user cancels the consent dialog.
  await ScreenShare.start();

  const stream = canvas.captureStream(8);
  const track = stream.getVideoTracks()[0];
  if (!track) {
    await nativeStopScreen();
    throw new Error('No screen track');
  }

  frameSub = await ScreenShare.addListener('frame', ({ data }) => {
    img.src = 'data:image/jpeg;base64,' + data;
  });
  stoppedSub = await ScreenShare.addListener('stopped', () => {
    try {
      track.stop();
    } catch {}
    // Mirror the web track.onended contract so the provider tears down cleanly.
    try {
      track.dispatchEvent(new Event('ended'));
    } catch {}
    void nativeStopScreen();
  });

  return track;
}
