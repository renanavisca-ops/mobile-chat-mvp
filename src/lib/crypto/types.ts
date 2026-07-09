export type LocalDeviceBundle = {
  registrationId: number;
  identityKey: string;
  signedPreKeyId: number;
  signedPreKeyPublic: string;
  signedPreKeySignature: string;
  preKeyStartId: number;
  generatedAt: string;
};

export type EncryptedEnvelope = {
  type: 'prekey' | 'whisper';
  ciphertext: string;
};
