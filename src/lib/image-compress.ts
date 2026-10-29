'use client';

/**
 * Downscale + re-encode a picked image so previews render fast and uploads are
 * small. Phone photos are often 3–12MB and slow to decode/send; this brings
 * them down to a few hundred KB. Honors EXIF orientation, and returns the
 * original untouched if it's already small or if anything goes wrong.
 */
export async function compressImage(file: File, maxDim = 1920, quality = 0.82): Promise<File> {
  if (!file.type.startsWith('image/')) return file;
  // Already small — not worth the work.
  if (file.size <= 600 * 1024) return file;

  try {
    const bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' } as ImageBitmapOptions);
    const scale = Math.min(1, maxDim / Math.max(bitmap.width, bitmap.height));
    const w = Math.max(1, Math.round(bitmap.width * scale));
    const h = Math.max(1, Math.round(bitmap.height * scale));

    const canvas = document.createElement('canvas');
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext('2d');
    if (!ctx) {
      bitmap.close?.();
      return file;
    }
    ctx.drawImage(bitmap, 0, 0, w, h);
    bitmap.close?.();

    const blob: Blob | null = await new Promise((resolve) => canvas.toBlob(resolve, 'image/jpeg', quality));
    if (!blob || blob.size >= file.size) return file; // no real gain — keep original
    const name = file.name.replace(/\.[^.]+$/, '') + '.jpg';
    return new File([blob], name, { type: 'image/jpeg' });
  } catch {
    return file;
  }
}

/** Per-send image quality the user can pick before sending. */
export type SendQuality = 'standard' | 'high' | 'original';

const QUALITY_PRESETS: Record<'standard' | 'high', { maxDim: number; quality: number }> = {
  // Data-friendly default (same as the historical auto-compress).
  standard: { maxDim: 1920, quality: 0.82 },
  // Sharper: bigger long edge and higher JPEG quality for text/detail.
  high: { maxDim: 2560, quality: 0.92 },
};

/**
 * Re-encode a picked image for sending at the chosen quality. 'original' sends
 * the file untouched (no downscale, EXIF preserved); 'standard'/'high' downscale
 * and re-encode to JPEG. Always falls back to the input on any failure.
 */
export async function compressImageForSend(file: File, quality: SendQuality): Promise<File> {
  if (quality === 'original') return file;
  const p = QUALITY_PRESETS[quality];
  return compressImage(file, p.maxDim, p.quality);
}
