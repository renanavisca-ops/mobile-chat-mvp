'use client';

/**
 * Screen capture for calls. On the web/desktop this uses the standard
 * getDisplayMedia picker (the browser shows its own "you are sharing" bar and a
 * stop control). Inside the native WebViews getDisplayMedia isn't available:
 * Android needs the MediaProjection API wired through native code (planned for
 * the next .aab) and iOS's WKWebView doesn't support it at all — so we feature
 * detect and only offer the button where it actually works.
 */

export function screenShareSupported(): boolean {
  try {
    return (
      typeof navigator !== 'undefined' &&
      !!navigator.mediaDevices &&
      typeof navigator.mediaDevices.getDisplayMedia === 'function'
    );
  } catch {
    return false;
  }
}

/**
 * Prompt the user to pick a screen/window/tab and return its video track.
 * Throws if the user cancels or capture fails (caller shows the message).
 */
export async function captureScreenTrack(): Promise<MediaStreamTrack> {
  const stream = await navigator.mediaDevices.getDisplayMedia({
    video: { frameRate: { ideal: 15, max: 30 } },
    audio: false,
  });
  const track = stream.getVideoTracks()[0];
  if (!track) {
    stream.getTracks().forEach((t) => t.stop());
    throw new Error('No screen track');
  }
  return track;
}
