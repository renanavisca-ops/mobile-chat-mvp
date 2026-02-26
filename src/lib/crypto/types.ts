export type LocalDeviceBundle = {
  registrationId: number;
  identityKey: string;
  signedPreKeyId: number;
  preKeyStartId: number;
  generatedAt: string;
};

export type EncryptedEnvelope = {
  type: 'prekey' | 'whisper';
  ciphertext: string;
};
