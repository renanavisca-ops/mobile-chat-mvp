import { generateDeviceBundle } from '@/lib/crypto/libsignal-adapter';
import type { LocalDeviceBundle } from '@/lib/crypto/types';

export async function createLocalDeviceBundle(): Promise<LocalDeviceBundle> {
  return generateDeviceBundle();
}
