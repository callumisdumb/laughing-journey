'use client';

import { create } from 'zustand';

export type ThemePreference = 'light' | 'dark' | 'system';
export type Density = 'comfortable' | 'compact';

interface AppearanceState {
  theme: ThemePreference;
  density: Density;
  railCollapsed: boolean;
  drawerCollapsed: boolean;
  setTheme: (t: ThemePreference) => void;
  setDensity: (d: Density) => void;
  toggleRail: () => void;
  toggleDrawer: () => void;
  setDrawerCollapsed: (v: boolean) => void;
  hydrate: () => void;
}

const KEY = 'mas.appearance';
export const APPEARANCE_KEY = KEY;

function resolveTheme(pref: ThemePreference): 'light' | 'dark' {
  if (pref !== 'system') return pref;
  if (typeof window === 'undefined') return 'light';
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

export function applyAppearance(theme: ThemePreference, density: Density): void {
  if (typeof document === 'undefined') return;
  document.documentElement.dataset.theme = resolveTheme(theme);
  document.documentElement.dataset.themePreference = theme;
  document.documentElement.dataset.density = density;
}

function persist(state: Pick<AppearanceState, 'theme' | 'density' | 'railCollapsed' | 'drawerCollapsed'>): void {
  try {
    window.localStorage.setItem(KEY, JSON.stringify(state));
  } catch {
    /* storage may be unavailable */
  }
}

export const useAppearance = create<AppearanceState>((set, get) => ({
  theme: 'system',
  density: 'comfortable',
  railCollapsed: false,
  drawerCollapsed: false,
  setTheme: (theme) => {
    set({ theme });
    applyAppearance(theme, get().density);
    persist(get());
  },
  setDensity: (density) => {
    set({ density });
    applyAppearance(get().theme, density);
    persist(get());
  },
  toggleRail: () => {
    set({ railCollapsed: !get().railCollapsed });
    persist(get());
  },
  toggleDrawer: () => {
    set({ drawerCollapsed: !get().drawerCollapsed });
    persist(get());
  },
  setDrawerCollapsed: (v) => {
    set({ drawerCollapsed: v });
    persist(get());
  },
  hydrate: () => {
    if (typeof window === 'undefined') return;
    try {
      const raw = window.localStorage.getItem(KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as Partial<AppearanceState>;
        set({
          theme: parsed.theme ?? 'system',
          density: parsed.density ?? 'comfortable',
          railCollapsed: parsed.railCollapsed ?? false,
          drawerCollapsed: parsed.drawerCollapsed ?? false,
        });
      }
    } catch {
      /* ignore */
    }
    applyAppearance(get().theme, get().density);
    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    mq.addEventListener('change', () => applyAppearance(get().theme, get().density));
  },
}));

/** Inline script run before paint so the theme never flashes. Mirrors hydrate(). */
export const APPEARANCE_BOOT_SCRIPT = `(function(){try{var r=localStorage.getItem('${KEY}');var s=r?JSON.parse(r):{};var t=s.theme||'system';var d=s.density||'comfortable';var m=window.matchMedia('(prefers-color-scheme: dark)').matches;document.documentElement.dataset.theme=t==='system'?(m?'dark':'light'):t;document.documentElement.dataset.themePreference=t;document.documentElement.dataset.density=d;}catch(e){}})();`;
