'use client';

// Bridge to the native AudioRoute plugin (Android). On the web / iOS these are
// no-ops so callers can invoke them unconditionally. The plugin drives the
// platform AudioManager so the loudspeaker toggle actually works on Android,
// where the WebView supports neither setSinkId nor real loudspeaker routing.
import { registerPlugin, Capacitor } from '@capacitor/core';

export type CallOutput = 'earpiece' | 'speaker' | 'wired' | 'bluetooth';

interface AudioRoutePlugin {
  startCallAudio(): Promise<void>;
  setSpeakerphoneOn(options: { on: boolean }): Promise<{ on: boolean }>;
  listOutputs(): Promise<{ outputs: { type: CallOutput; active?: boolean }[] }>;
  setOutput(options: { type: CallOutput }): Promise<{ ok: boolean }>;
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

/** List available call audio outputs (empty off-native). */
export async function nativeListOutputs(): Promise<{ type: CallOutput; active?: boolean }[]> {
  if (!hasNativeAudioRoute()) return [];
  try {
    const res = await AudioRoute.listOutputs();
    return Array.isArray(res?.outputs) ? res.outputs : [];
  } catch {
    return [];
  }
}

/** Route call audio to a specific output. Returns true if applied. */
export async function nativeSetOutput(type: CallOutput): Promise<boolean> {
  if (!hasNativeAudioRoute()) return false;
  try {
    const res = await AudioRoute.setOutput({ type });
    return !!res?.ok;
  } catch {
    return false;
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
