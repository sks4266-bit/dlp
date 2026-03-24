import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';

type ThemeMode = 'light';

type UiPrefs = {
  theme: ThemeMode;
  scale: number;
  setTheme: (_theme: ThemeMode) => void;
  setScale: (scale: number) => void;
};

const SCALE_KEY = 'dlp_ui_scale';
const DEFAULT_PREFS: UiPrefs = {
  theme: 'light',
  scale: 1,
  setTheme: () => {},
  setScale: () => {}
};

const Ctx = createContext<UiPrefs>(DEFAULT_PREFS);

function clampScale(scale: number) {
  if (!Number.isFinite(scale)) return 1;
  return Math.max(0.9, Math.min(1.25, scale));
}

function applyLightMode() {
  if (typeof document === 'undefined') return;

  const root = document.documentElement;
  root.dataset.theme = 'light';
  root.style.colorScheme = 'light';

  try {
    localStorage.removeItem('dlp_ui_theme');
  } catch {
    // ignore storage issues
  }
}

function applyScale(scale: number) {
  if (typeof document === 'undefined') return;
  document.documentElement.style.setProperty('--ui-scale', String(clampScale(scale)));
}

export function UiPrefsProvider({ children }: { children: ReactNode }) {
  const [scale, setScaleState] = useState<number>(() => {
    try {
      return clampScale(Number(localStorage.getItem(SCALE_KEY) ?? 1));
    } catch {
      return 1;
    }
  });

  useEffect(() => {
    applyLightMode();
  }, []);

  useEffect(() => {
    applyScale(scale);
    try {
      localStorage.setItem(SCALE_KEY, String(clampScale(scale)));
    } catch {
      // ignore storage issues
    }
  }, [scale]);

  const value = useMemo<UiPrefs>(
    () => ({
      theme: 'light',
      scale,
      setTheme: () => applyLightMode(),
      setScale: (nextScale) => setScaleState(clampScale(nextScale))
    }),
    [scale]
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useUiPrefs() {
  return useContext(Ctx);
}
