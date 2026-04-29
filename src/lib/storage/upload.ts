'use client';

/**
 * Exporta helpers oficiales desde chatMedia.ts
 * (evita que imports viejos usen helpers incorrectos)
 */
export { uploadChatImage, uploadChatMedia, uploadChatAudio, createSignedChatMediaUrl } from '@/lib/storage/chatMedia';
