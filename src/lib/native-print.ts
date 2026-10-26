'use client';

/**
 * Native print bridge (TokyPrint plugin — Android PrintManager / iOS
 * UIPrintInteractionController).
 *
 * A stock Capacitor WebView can't drive the OS printer from window.print(), so
 * without this the app can only share the file. This opens the real system
 * print dialog — available printers, "Save as PDF", copies, paper size — for
 * the RENDERED document:
 *   - images and parsed spreadsheets/Word docs go through printHtml
 *   - PDFs go through printPdf (printed as-is)
 *
 * The plugin only exists in a native build that was compiled with it, so
 * callers gate on `canNativePrint()` and keep the share-sheet fallback for the
 * web and for older app builds.
 */

import { registerPlugin, Capacitor } from '@capacitor/core';

interface TokyPrintPlugin {
  printHtml(opts: { html: string; name?: string }): Promise<void>;
  printPdf(opts: { base64: string; name?: string }): Promise<void>;
}

const TokyPrint = registerPlugin<TokyPrintPlugin>('TokyPrint');

export function canNativePrint(): boolean {
  return Capacitor.isNativePlatform() && Capacitor.isPluginAvailable('TokyPrint');
}

/** Read a Blob as a data: URL (keeps the `data:<mime>;base64,` prefix). */
function readDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(String(r.result || ''));
    r.onerror = () => reject(r.error || new Error('read failed'));
    r.readAsDataURL(blob);
  });
}

/** Bare base64 (no data: prefix), which the native side decodes directly. */
async function readBase64(blob: Blob): Promise<string> {
  const url = await readDataUrl(blob);
  const comma = url.indexOf(',');
  return comma >= 0 ? url.slice(comma + 1) : url;
}

export async function nativePrintHtml(html: string, name?: string): Promise<void> {
  await TokyPrint.printHtml({ html, name });
}

export async function nativePrintPdf(blob: Blob, name?: string): Promise<void> {
  const base64 = await readBase64(blob);
  await TokyPrint.printPdf({ base64, name });
}

/** Print an image by embedding it (as a data URL) in a minimal HTML page. */
export async function nativePrintImage(blob: Blob, name?: string): Promise<void> {
  const dataUrl = await readDataUrl(blob);
  const html =
    '<!DOCTYPE html><html><head><meta name="viewport" content="width=device-width">' +
    '<style>@page{margin:10mm}html,body{margin:0;padding:0}' +
    'img{display:block;width:100%;height:auto}</style></head>' +
    `<body><img src="${dataUrl}"></body></html>`;
  await TokyPrint.printHtml({ html, name });
}
