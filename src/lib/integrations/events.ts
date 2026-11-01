// Internal integration events (decoupled interface for future integrations).
// Producers emit these; a local adapter records them to the `integration_events`
// outbox. A future external adapter (e.g. a webhook deliverer) would read that
// outbox — that delivery is NOT built (see docs/INTEGRATIONS.md).
//
// SAFETY: event data is a WHITELIST of non-sensitive scalar metadata only. Any
// key not in ALLOWED_KEYS is dropped, so message content, credentials or other
// sensitive data can never end up in an event — even if a caller passes them.

export type IntegrationEventType =
  | 'support.chat_created'
  | 'support.message_received'
  | 'support.chat_status_changed'
  | 'support.chat_assigned'
  | 'support.rule_triggered';

export type EventScalar = string | number | boolean | null;

// Only ids, enums and booleans — never free text or message bodies.
export const ALLOWED_KEYS = new Set<string>([
  'chatId', 'customerId', 'agentId', 'messageId', 'labelId', 'ruleId', 'status', 'hasText', 'assigned',
]);

/** Keep only whitelisted scalar fields; drop everything else. */
export function sanitizeEventData(data: Record<string, unknown>): Record<string, EventScalar> {
  const out: Record<string, EventScalar> = {};
  for (const [k, v] of Object.entries(data || {})) {
    if (!ALLOWED_KEYS.has(k)) continue;
    if (v === null || typeof v === 'string' || typeof v === 'number' || typeof v === 'boolean') {
      out[k] = v;
    }
  }
  return out;
}
