import { describe, it, expect } from 'vitest';
import { classifyConsentKeyword } from '../src/lib/campaigns/optout';

describe('classifyConsentKeyword', () => {
  it('detects opt-out single-word commands (whole message, any case)', () => {
    expect(classifyConsentKeyword('BAJA')).toBe('opt_out');
    expect(classifyConsentKeyword('  stop ')).toBe('opt_out');
    expect(classifyConsentKeyword('Cancelar')).toBe('opt_out');
  });

  it('detects opt-out phrases anywhere in the message', () => {
    expect(classifyConsentKeyword('por favor darme de baja')).toBe('opt_out');
    expect(classifyConsentKeyword('no molestar con promos')).toBe('opt_out');
  });

  it('detects opt-in keywords', () => {
    expect(classifyConsentKeyword('ALTA')).toBe('opt_in');
    expect(classifyConsentKeyword('quiero ofertas')).toBe('opt_in');
  });

  it('opt-out wins over opt-in when both appear', () => {
    expect(classifyConsentKeyword('baja')).toBe('opt_out');
  });

  it('does NOT misclassify ordinary messages (avoid accidental opt-out)', () => {
    expect(classifyConsentKeyword('hola, necesito ayuda')).toBe(null);
    expect(classifyConsentKeyword('cuanto cuesta?')).toBe(null);
    // 'no' alone is not an opt-out token (too risky)
    expect(classifyConsentKeyword('no')).toBe(null);
    expect(classifyConsentKeyword('')).toBe(null);
  });
});
