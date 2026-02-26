export async function fingerprintFromIdentity(identityMaterial: string): Promise<string> {
  const bytes = new TextEncoder().encode(identityMaterial);
  const digest = await crypto.subtle.digest('SHA-256', bytes);
  const hex = Array.from(new Uint8Array(digest))
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join('')
    .slice(0, 60);
  return hex.match(/.{1,5}/g)?.join(' ') ?? '';
}
