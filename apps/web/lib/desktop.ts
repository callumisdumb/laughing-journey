'use client';

import { useEffect } from 'react';
import { useAppearance } from '@/lib/appearance';
import { useAppStore } from '@/lib/store';

/**
 * Desktop shell bridge. Both shells (Tauri 2 and the Electron fallback) send the same
 * `mas-menu` actions: reset-demo, toggle-theme, zoom-in, zoom-out, zoom-reset. In a plain
 * browser nothing is registered and the app behaves as before.
 */
export type MenuAction = 'reset-demo' | 'toggle-theme' | 'zoom-in' | 'zoom-out' | 'zoom-reset';

const ZOOM_KEY = 'mas.zoom';
const ZOOM_STEPS = [80, 90, 100, 110, 125, 150] as const;

interface ElectronBridge {
  onMenu: (handler: (action: string) => void) => () => void;
  shell: 'electron';
}

declare global {
  interface Window {
    masDesktop?: ElectronBridge;
    __TAURI_INTERNALS__?: unknown;
  }
}

export type DesktopShell = 'tauri' | 'electron' | 'browser';

export function detectShell(): DesktopShell {
  if (typeof window === 'undefined') return 'browser';
  if (window.__TAURI_INTERNALS__) return 'tauri';
  if (window.masDesktop?.shell === 'electron') return 'electron';
  return 'browser';
}

function readZoom(): number {
  try {
    const raw = window.localStorage.getItem(ZOOM_KEY);
    const n = raw ? Number(raw) : 100;
    return ZOOM_STEPS.includes(n as (typeof ZOOM_STEPS)[number]) ? n : 100;
  } catch {
    return 100;
  }
}

export function applyZoom(percent: number): void {
  document.documentElement.style.fontSize = percent === 100 ? '' : `${percent}%`;
  try {
    window.localStorage.setItem(ZOOM_KEY, String(percent));
  } catch {
    /* ignore: private mode or storage blocked */
  }
}

function stepZoom(direction: 1 | -1 | 0): void {
  if (direction === 0) {
    applyZoom(100);
    return;
  }
  const current = readZoom();
  const idx = ZOOM_STEPS.indexOf(current as (typeof ZOOM_STEPS)[number]);
  const next = ZOOM_STEPS[Math.min(ZOOM_STEPS.length - 1, Math.max(0, idx + direction))] ?? 100;
  applyZoom(next);
}

export function handleMenuAction(action: string): void {
  switch (action as MenuAction) {
    case 'reset-demo':
      useAppStore.getState().resetDemo();
      break;
    case 'toggle-theme': {
      const { theme, setTheme } = useAppearance.getState();
      const dark = theme === 'dark' || (theme === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches);
      setTheme(dark ? 'light' : 'dark');
      break;
    }
    case 'zoom-in':
      stepZoom(1);
      break;
    case 'zoom-out':
      stepZoom(-1);
      break;
    case 'zoom-reset':
      stepZoom(0);
      break;
    default:
      break;
  }
}

/** Subscribe to the shell's menu events. Returns an unsubscribe function. */
export function initDesktop(): () => void {
  if (typeof window === 'undefined') return () => undefined;
  applyZoom(readZoom());
  const shell = detectShell();
  document.documentElement.dataset.shell = shell;
  if (shell === 'electron' && window.masDesktop) {
    return window.masDesktop.onMenu(handleMenuAction);
  }
  if (shell === 'tauri') {
    let unlisten: (() => void) | undefined;
    let cancelled = false;
    import('@tauri-apps/api/event')
      .then(({ listen }) => listen<string>('mas-menu', (event) => handleMenuAction(event.payload)))
      .then((off) => {
        if (cancelled) off();
        else unlisten = off;
      })
      .catch(() => {
        /* the API is optional in the browser build */
      });
    return () => {
      cancelled = true;
      unlisten?.();
    };
  }
  return () => undefined;
}

export function useDesktop(): void {
  useEffect(() => initDesktop(), []);
}
