declare module '@privacyresearch/libsignal-protocol-typescript' {
  export const KeyHelper: {
    generateIdentityKeyPair: () => Promise<{ pubKey: ArrayBuffer; privKey: ArrayBuffer }>;
    generateRegistrationId: () => Promise<number>;
    generateSignedPreKey: (
      identityKeyPair: { pubKey: ArrayBuffer; privKey: ArrayBuffer },
      signedPreKeyId: number
    ) => Promise<{ keyId: number }>;
    generatePreKey: (preKeyId: number) => Promise<{ keyId: number }>;
  };
}
