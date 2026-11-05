// Campaign sending gate (server-side). Mass sending is DISABLED by default and
// no messaging provider is wired. A local SIMULATOR channel can be turned on in
// dev/test to exercise the full send flow without any external call. A real
// channel (SMS/WhatsApp/email) is a separate, still-pending adapter — see
// docs/CAMPAIGNS.md.

/** True only if campaign sending was explicitly enabled by configuration. */
export function campaignsSendingEnabled(): boolean {
  return process.env.CAMPAIGNS_ENABLED === '1';
}

/** The configured channel (e.g. 'simulator'). Empty when unset. */
export function campaignsChannel(): string {
  return (process.env.CAMPAIGNS_CHANNEL || '').trim();
}

/** The only channel implemented today is the local simulator. */
export function campaignsSimulated(): boolean {
  return campaignsSendingEnabled() && campaignsChannel() === 'simulator';
}
