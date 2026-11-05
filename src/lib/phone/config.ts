// Phone verification gate (server-side). Adding/verifying a phone number is an
// OPTIONAL attribute of the existing (email) account — it never replaces email
// auth and never creates a second account. DISABLED by default. A local
// simulator (PHONE_PROVIDER=simulator) returns the code so the flow can be
// tested with no SMS/cost; a real SMS provider is a separate, pending adapter
// (SMS costs money) — see docs/PHONE.md.

export function phoneVerificationEnabled(): boolean {
  return process.env.PHONE_VERIFICATION_ENABLED === '1';
}

export function phoneProvider(): string {
  return (process.env.PHONE_PROVIDER || '').trim();
}

/** The only implemented "sender" is the local simulator. */
export function phoneSimulated(): boolean {
  return phoneVerificationEnabled() && phoneProvider() === 'simulator';
}
