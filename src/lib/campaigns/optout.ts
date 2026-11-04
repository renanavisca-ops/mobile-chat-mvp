// Pure keyword classifier for campaign consent (opt-in / opt-out), evaluated on
// a support-chat customer message. No I/O: it only looks at text that is already
// plain (support chats are never E2EE). Conservative on single words to avoid
// accidental opt-outs; phrases match by substring.

export type ConsentSignal = 'opt_in' | 'opt_out' | null;

// Opt-out takes priority. Bilingual (es/en). Single tokens require a whole-message
// match; multi-word phrases may appear anywhere in the message.
const OPT_OUT = ['baja', 'stop', 'unsubscribe', 'cancelar', 'darme de baja', 'no molestar', 'cancelar suscripcion', 'cancelar suscripción'];
const OPT_IN = ['alta', 'suscribir', 'subscribe', 'quiero ofertas', 'acepto promociones', 'acepto'];

function hit(text: string, tokens: string[]): boolean {
  for (const k of tokens) {
    if (k.includes(' ')) {
      if (text.includes(k)) return true;
    } else if (text === k) {
      return true;
    }
  }
  return false;
}

/** 'opt_out' / 'opt_in' / null for a customer message. Opt-out wins. */
export function classifyConsentKeyword(raw: string): ConsentSignal {
  const text = (raw || '').trim().toLowerCase();
  if (!text) return null;
  if (hit(text, OPT_OUT)) return 'opt_out';
  if (hit(text, OPT_IN)) return 'opt_in';
  return null;
}
