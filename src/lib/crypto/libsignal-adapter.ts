import * as libsignal from '@privacyresearch/libsignal-protocol-typescript';
import type { EncryptedEnvelope, LocalDeviceBundle } from '@/lib/crypto/types';

const PREKEY_BATCH = 25;

export async function generateDeviceBundle(): Promise<LocalDeviceBundle> {
  const identityKeyPair = await libsignal.KeyHelper.generateIdentityKeyPair();
  const registrationId = await libsignal.KeyHelper.generateRegistrationId();
  const signedPreKey = await libsignal.KeyHelper.generateSignedPreKey(identityKeyPair, 1);
  for (let i = 0; i < PREKEY_BATCH; i += 1) {
    await libsignal.KeyHelper.generatePreKey(i + 1);
  }

  return {
    registrationId,
    identityKey: Buffer.from(identityKeyPair.pubKey).toString('base64'),
    signedPreKeyId: signedPreKey.keyId,
    preKeyStartId: 1,
    generatedAt: new Date().toISOString()
  };
}

export async function encryptForSession(
  sessionCipher: { encrypt: (plainText: string) => Promise<{ type: number; body: string }> },
  plainText: string
): Promise<EncryptedEnvelope> {
  const result = await sessionCipher.encrypt(plainText);
  return {
    type: result.type === 3 ? 'prekey' : 'whisper',
    ciphertext: result.body
  };
}
