// Single source of truth for legal/compliance values so they aren't duplicated
// across pages, the consent gate, and the acceptance ledger. Bump termsVersion
// or privacyVersion whenever the corresponding document changes materially —
// users are then asked to accept again, and a new row is written to
// public.legal_acceptances.
export const LEGAL = {
  /** Display name of the operator (an individual, not a company). */
  operator: 'Toky Chat',
  /** Country where the operator is based (for legal identification). */
  country: 'Guatemala',
  /** Contact addresses. */
  privacyEmail: 'curiosidades2526@gmail.com',
  supportEmail: 'curiosidades2526@gmail.com',
  /** Minimum age to use the Service — kept consistent everywhere. */
  minAge: 13,
  /** Document versions (date-based). Bump on material change. */
  termsVersion: '2026-07-24',
  privacyVersion: '2026-07-24',
  /** Human-readable effective date shown on the documents. */
  effectiveDate: 'July 24, 2026',
  /** Days after which residual copies in backups are purged. */
  retentionDays: 90,
  /** Third-party processors actually used by the app. */
  providers: ['Supabase', 'Vercel', 'Firebase Cloud Messaging', 'Cloudflare'] as const,
} as const;
