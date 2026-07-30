'use client';

// Bridge to the native AudioRoute plugin (Android). On the web / iOS these are
// no-ops so callers can invoke them unconditionally. The plugin drives the
// platform AudioManager so the loudspeaker toggle actually works on Android,
// where the WebView supports neither setSinkId nor real loudspeaker routing.
import { registerPlugin, Capacitor } from '@capacitor/core';

interface AudioRoutePlugin {
  startCallAudio(): Promise<void>;
  setSpeakerphoneOn(options: { on: boolean }): Promise<{ on: boolean }>;
  stopCallAudio(): Promise<void>;
}

const AudioRoute = registerPlugin<AudioRoutePlugin>('AudioRoute');

/** True only on the native Android shell, where the plugin is implemented. */
export function hasNativeAudioRoute(): boolean {
  try {
    return Capacitor.getPlatform() === 'android';
  } catch {
    return false;
  }
}

/** Enter WebRTC voice mode (routing + echo cancellation) at call start. */
export async function nativeStartCallAudio(): Promise<void> {
  if (!hasNativeAudioRoute()) return;
  try {
    await AudioRoute.startCallAudio();
  } catch {
    // best effort — never let audio routing break the call
  }
}

/** Toggle the loudspeaker. Returns the effective state, or null off-native. */
export async function nativeSetSpeakerphone(on: boolean): Promise<boolean | null> {
  if (!hasNativeAudioRoute()) return null;
  try {
    const res = await AudioRoute.setSpeakerphoneOn({ on });
    return typeof res?.on === 'boolean' ? res.on : on;
  } catch {
    return null;
  }
}

/** Restore normal audio state when the call ends. */
export async function nativeStopCallAudio(): Promise<void> {
  if (!hasNativeAudioRoute()) return;
  try {
    await AudioRoute.stopCallAudio();
  } catch {
    // best effort
  }
}
