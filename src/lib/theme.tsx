'use client';

import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';

export type ThemePreference = 'auto' | 'dark' | 'light';
export type Accent = 'blue' | 'violet' | 'teal' | 'fuchsia';
export type FontScale = 'normal' | 'lg' | 'xl';

const KEY = 'toky_theme_prefs_v1';

type Prefs = {
  theme: ThemePreference;
  accent: Accent;
  highContrast: boolean;
  fontScale: FontScale;
};

const DEFAULTS: Prefs = { theme: 'auto', accent: 'blue', highContrast: false, fontScale: 'normal' };

function readPrefs(): Prefs {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return DEFAULTS;
    const parsed = JSON.parse(raw);
    return { ...DEFAULTS, ...parsed };
  } catch {
    return DEFAULTS;
  }
}

function systemPrefersDark(): boolean {
  return typeof window !== 'undefined' && window.matchMedia?.('(prefers-color-scheme: dark)').matches;
}

function apply(prefs: Prefs) {
  const html = document.documentElement;
  const resolvedTheme = prefs.theme === 'auto' ? (systemPrefersDark() ? 'dark' : 'light') : prefs.theme;
  html.dataset.theme = resolvedTheme;
  if (prefs.accent === 'blue') delete html.dataset.accent;
  else html.dataset.accent = prefs.accent;
  if (prefs.highContrast) html.dataset.contrast = 'high';
  else delete html.dataset.contrast;
  if (prefs.fontScale === 'normal') delete html.dataset.fontScale;
  else html.dataset.fontScale = prefs.fontScale;
}

type Ctx = Prefs & {
  setTheme: (t: ThemePreference) => void;
  setAccent: (a: Accent) => void;
  setHighContrast: (v: boolean) => void;
  setFontScale: (f: FontScale) => void;
};

const ThemeContext = createContext<Ctx>({
  ...DEFAULTS,
  setTheme: () => {},
  setAccent: () => {},
  setHighContrast: () => {},
  setFontScale: () => {},
});

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [prefs, setPrefs] = useState<Prefs>(DEFAULTS);

  useEffect(() => {
    const initial = readPrefs();
    setPrefs(initial);
    apply(initial);
  }, []);

  useEffect(() => {
    if (prefs.theme !== 'auto') return;
    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    const onChange = () => apply(prefs);
    mq.addEventListener('change', onChange);
    return () => mq.removeEventListener('change', onChange);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [prefs.theme]);

  const update = useCallback((patch: Partial<Prefs>) => {
    setPrefs((prev) => {
      const next = { ...prev, ...patch };
      try {
        localStorage.setItem(KEY, JSON.stringify(next));
      } catch {
        // ignore
      }
      apply(next);
      return next;
    });
  }, []);

  const value = useMemo<Ctx>(
    () => ({
      ...prefs,
      setTheme: (t) => update({ theme: t }),
      setAccent: (a) => update({ accent: a }),
      setHighContrast: (v) => update({ highContrast: v }),
      setFontScale: (f) => update({ fontScale: f }),
    }),
    [prefs, update]
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme() {
  return useContext(ThemeContext);
}
