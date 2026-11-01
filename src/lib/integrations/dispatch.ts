import { sanitizeEventData, type IntegrationEventType } from './events';

/**
 * Local adapter: record an integration event to the outbox (`integration_events`)
 * for inspection and future delivery. This is the single seam producers call;
 * swapping in an external adapter later (webhook, CRM) does not touch producers.
 *
 * - `admin` is a Supabase service-role client (passed in so this stays testable
 *   and free of import side-effects).
 * - Best-effort: a failure here NEVER blocks the request that produced the event.
 * - Data is sanitized to non-sensitive scalars only (see events.ts).
 */
export async function recordIntegrationEvent(
  admin: { from: (t: string) => any },
  storeId: string | null | undefined,
  type: IntegrationEventType,
  data: Record<string, unknown> = {},
): Promise<void> {
  if (!storeId) return;
  try {
    await admin.from('integration_events').insert({
      store_id: storeId,
      type,
      data: sanitizeEventData(data),
    });
  } catch {
    // integrations must never break the originating request
  }
}
