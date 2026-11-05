// Integration delivery gate (server-side). The outbox (integration_events) is
// always populated, but DELIVERY to an external target (CRM / webhook / public
// API) is DISABLED by default and makes no external call. A local adapter can
// be turned on in dev/test to drain the outbox (mark delivered) so the flow can
// be exercised. A real webhook/CRM adapter is a separate, still-pending piece —
// see docs/INTEGRATIONS.md.

/** True only if outbox delivery was explicitly enabled by configuration. */
export function integrationsEnabled(): boolean {
  return process.env.INTEGRATIONS_ENABLED === '1';
}

/** The configured delivery target. 'local' is the only implemented adapter
 *  (drains the outbox without any network call). Anything else names a real
 *  target whose adapter is not implemented yet. Empty when unset. */
export function integrationsTarget(): string {
  return (process.env.INTEGRATIONS_TARGET || '').trim();
}
