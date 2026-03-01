'use client';

/**
 * COMPATIBILITY SHIM (DO NOT DELETE):
 * This file used to contain a generic upload helper that:
 * - uploaded to `images/...` (NOT allowed by current RLS policies)
 * - returned publicUrl (bucket is private, so it doesn't apply)
 *
 * To avoid confusion and accidental wrong imports, we re-export the
 * correct chat-media helpers from chatMedia.ts.
 */

export { uploadChatImage, createSignedChatMediaUrl } from '@/lib/storage/chatMedia';
