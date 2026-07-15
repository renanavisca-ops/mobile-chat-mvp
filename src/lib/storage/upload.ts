'use client';

/**
 * Exporta helpers oficiales desde chatMedia.ts
 * (evita que imports viejos usen helpers incorrectos)
 */
export { uploadChatImage, uploadChatMedia, uploadChatAudio, uploadChatFile, createSignedChatMediaUrl } from '@/lib/storage/chatMedia';
export type { UploadedFile } from '@/lib/storage/chatMedia';
