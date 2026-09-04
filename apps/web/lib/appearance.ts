'use client';

import { create } from 'zustand';

export type ThemePreference = 'light' | 'dark' | 'system';
export type Density = 'comfortable' | 'compact';

interface AppearanceState {
  theme: ThemePreference;
  density: Density;
  /**
   * The recording preset (brief section G.4).
   *
   * Video compression is unkind to small type and to anything that moves for its own sake. The
   * preset raises the base type scale, forces comfortable density and stops the non-essential
   * animation, and it is a setting rather than a build so the same binary is both the product and
   * the thing being filmed.
   */
  recording: boolean;
  railCollapsed: boolean;
  drawerCollapsed: boolean;
  setTheme: (t: ThemePreference) => void;
  setDensity: (d: Density) => void;
  setRecording: (v: boolean) => void;
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

export function applyAppearance(theme: ThemePreference, density: Density, recording = false): void {
  if (typeof document === 'undefined') return;
  document.documentElement.dataset.theme = resolveTheme(theme);
  document.documentElement.dataset.themePreference = theme;
  document.documentElement.dataset.density = density;
  if (recording) document.documentElement.dataset.recording = 'true';
  else delete document.documentElement.dataset.recording;
}

function persist(state: Pick<AppearanceState, 'theme' | 'density' | 'recording' | 'railCollapsed' | 'drawerCollapsed'>): void {
  try {
    window.localStorage.setItem(KEY, JSON.stringify(state));
  } catch {
    /* storage may be unavailable */
  }
}

export const useAppearance = create<AppearanceState>((set, get) => ({
  theme: 'system',
  density: 'comfortable',
  recording: false,
  railCollapsed: false,
  drawerCollapsed: false,
  setTheme: (theme) => {
    set({ theme });
    applyAppearance(theme, get().density, get().recording);
    persist(get());
  },
  setDensity: (density) => {
    set({ density });
    applyAppearance(get().theme, density, get().recording);
    persist(get());
  },
  // Turning it on forces comfortable density, because the preset is one setting rather than a
  // reminder to change three, and compact type under video compression is the thing it exists for.
  setRecording: (recording) => {
    const density = recording ? 'comfortable' : get().density;
    set({ recording, density });
    applyAppearance(get().theme, density, recording);
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
          recording: parsed.recording ?? false,
          railCollapsed: parsed.railCollapsed ?? false,
          drawerCollapsed: parsed.drawerCollapsed ?? false,
        });
      }
    } catch {
      /* ignore */
    }
    applyAppearance(get().theme, get().density, get().recording);
    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    mq.addEventListener('change', () => applyAppearance(get().theme, get().density, get().recording));
  },
}));

/** Inline script run before paint so the theme never flashes. Mirrors hydrate(). */
export const APPEARANCE_BOOT_SCRIPT = `(function(){try{var r=localStorage.getItem('${KEY}');var s=r?JSON.parse(r):{};var t=s.theme||'system';var d=s.density||'comfortable';var m=window.matchMedia('(prefers-color-scheme: dark)').matches;document.documentElement.dataset.theme=t==='system'?(m?'dark':'light'):t;document.documentElement.dataset.themePreference=t;document.documentElement.dataset.density=d;if(s.recording)document.documentElement.dataset.recording='true';}catch(e){}})();`;
