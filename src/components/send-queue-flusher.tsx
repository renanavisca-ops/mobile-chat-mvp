'use client';

import { useEffect } from 'react';
import { startSendQueue } from '@/lib/send-queue';

/** Starts the offline send-queue flusher (online/focus events + periodic sweep)
 *  for the whole app. Renders nothing. */
export function SendQueueFlusher() {
  useEffect(() => startSendQueue(), []);
  return null;
}
