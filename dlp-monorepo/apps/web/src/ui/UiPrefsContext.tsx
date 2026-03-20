import { createContext, useContext, useEffect, useMemo, useState } from 'react';

type ThemeMode = 'system' | 'light' | 'dark';

type UiPrefs = {
  theme: ThemeMode;
  scale: number; // 0.9 ~ 1.25
  setTheme: (t: ThemeMode) => void;
  setScale: (s: number) => void;
};

const Ctx = createContext<UiPrefs | null>(null);

const THEME_KEY = 'dlp_ui_theme';
const SCALE_KEY = 'dlp_ui_scale';

function getSystemTheme(): 'light' | 'dark' {
  if (typeof window === 'undefined') return 'light';
  return window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

function applyTheme(theme: ThemeMode) {
  const root = document.documentElement;
  const t = theme === 'system' ? getSystemTheme() : theme;
  root.dataset.theme = t;
}

function applyScale(scale: number) {
  const root = document.documentElement;
  root.style.setProperty('--ui-scale', String(scale));
}

export function UiPrefsProvider({ children }: { children: any }) {
  const [theme, setThemeState] = useState<ThemeMode>(() => {
    const t = localStorage.getItem(THEME_KEY) as ThemeMode | null;
    return t === 'light' || t === 'dark' || t === 'system' ? t : 'system';
  });

  const [scale, setScaleState] = useState<number>(() => {
    const raw = Number(localStorage.getItem(SCALE_KEY) ?? 1);
    if (!Number.isFinite(raw)) return 1;
    return Math.max(0.9, Math.min(1.25, raw));
  });

  useEffect(() => {
    applyTheme(theme);
    localStorage.setItem(THEME_KEY, theme);

    // react to system theme changes
    if (theme === 'system') {
      const mq = window.matchMedia('(prefers-color-scheme: dark)');
      const onChange = () => applyTheme('system');
      mq.addEventListener?.('change', onChange);
      return () => mq.removeEventListener?.('change', onChange);
    }
  }, [theme]);

  useEffect(() => {
    applyScale(scale);
    localStorage.setItem(SCALE_KEY, String(scale));
  }, [scale]);

  const value = useMemo<UiPrefs>(
    () => ({
      theme,
      scale,
      setTheme: setThemeState,
      setScale: (s) => setScaleState(Math.max(0.9, Math.min(1.25, s)))
    }),
    [theme, scale]
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useUiPrefs() {
  const v = useContext(Ctx);
  if (!v) throw new Error('UiPrefsProvider is missing');
  return v;
}
