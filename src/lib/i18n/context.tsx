'use client';

import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import en from './en';
import es from './es';
import type { Dictionary } from './en';

export type LangCode = 'en' | 'es';
export type LangPreference = 'auto' | LangCode;

const DICTS: Record<LangCode, Dictionary> = { en, es };
const PREF_KEY = 'toky_lang_pref';

function detectSystemLang(): LangCode {
  // Spanish-first (Guatemala launch): default to Spanish, and only use English
  // when the device explicitly prefers English.
  if (typeof navigator === 'undefined') return 'es';
  const langs = navigator.languages && navigator.languages.length ? navigator.languages : [navigator.language];
  for (const l of langs) {
    if (l && l.toLowerCase().startsWith('en')) return 'en';
  }
  return 'es';
}

function readPreference(): LangPreference {
  try {
    const raw = localStorage.getItem(PREF_KEY);
    if (raw === 'en' || raw === 'es' || raw === 'auto') return raw;
  } catch {
    // ignore
  }
  return 'auto';
}

function resolveLang(pref: LangPreference): LangCode {
  return pref === 'auto' ? detectSystemLang() : pref;
}

function get(dict: Dictionary, path: string): string | undefined {
  const parts = path.split('.');
  let cur: any = dict;
  for (const p of parts) {
    if (cur == null) return undefined;
    cur = cur[p];
  }
  return typeof cur === 'string' ? cur : undefined;
}

function interpolate(str: string, vars?: Record<string, string | number>): string {
  if (!vars) return str;
  return str.replace(/\{\{(\w+)\}\}/g, (_, key) => (key in vars ? String(vars[key]) : `{{${key}}}`));
}

type Ctx = {
  lang: LangCode;
  preference: LangPreference;
  setPreference: (p: LangPreference) => void;
  t: (key: string, vars?: Record<string, string | number>) => string;
};

const LanguageContext = createContext<Ctx>({
  lang: 'es',
  preference: 'auto',
  setPreference: () => {},
  t: (key: string) => key,
});

export function LanguageProvider({ children }: { children: ReactNode }) {
  // Start with 'es' (our default) so server and first client render match
  // (avoids hydration mismatch); resolve the real preference/system language
  // right after mount.
  const [preference, setPreferenceState] = useState<LangPreference>('auto');
  const [lang, setLang] = useState<LangCode>('es');
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    const pref = readPreference();
    setPreferenceState(pref);
    setLang(resolveLang(pref));
    setHydrated(true);
  }, []);

  // Re-resolve if the OS/browser language changes while on "auto".
  useEffect(() => {
    if (!hydrated || preference !== 'auto') return;
    const onChange = () => setLang(detectSystemLang());
    window.addEventListener('languagechange', onChange);
    return () => window.removeEventListener('languagechange', onChange);
  }, [hydrated, preference]);

  useEffect(() => {
    if (hydrated) document.documentElement.lang = lang;
  }, [lang, hydrated]);

  const setPreference = useCallback((p: LangPreference) => {
    try {
      localStorage.setItem(PREF_KEY, p);
    } catch {
      // ignore
    }
    setPreferenceState(p);
    setLang(resolveLang(p));
  }, []);

  const t = useCallback(
    (key: string, vars?: Record<string, string | number>) => {
      const dict = DICTS[lang];
      const value = get(dict, key) ?? get(en, key) ?? key;
      return interpolate(value, vars);
    },
    [lang]
  );

  const value = useMemo(() => ({ lang, preference, setPreference, t }), [lang, preference, setPreference, t]);

  return <LanguageContext.Provider value={value}>{children}</LanguageContext.Provider>;
}

export function useLanguage() {
  return useContext(LanguageContext);
}

export function useT() {
  return useContext(LanguageContext).t;
}

/**
 * Renders a translated string that may contain a single <b>...</b> segment
 * (used for short emphasis in onboarding/contacts/settings copy) without
 * dangerouslySetInnerHTML.
 */
export function TransBold({ text }: { text: string }) {
  const parts = text.split(/<b>(.*?)<\/b>/g);
  return (
    <>
      {parts.map((part, i) =>
        i % 2 === 1 ? <b key={i}>{part}</b> : <span key={i}>{part}</span>
      )}
    </>
  );
}
