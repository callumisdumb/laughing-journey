'use client';

import { localStorageStore, type Messages, type OverridesStore } from '@mas/messages';
import { detectShell } from '@/lib/desktop';

const STORAGE_KEY = 'mas.messages';

/** Electron: the preload bridge persists to the app data directory through the main process. */
function electronStore(): OverridesStore {
  const bridge = window.masDesktop?.overrides;
  if (!bridge) return localStorageStore(STORAGE_KEY);
  return {
    load: async () => {
      const raw = await bridge.load();
      return raw ? (JSON.parse(raw) as Messages) : {};
    },
    save: (overrides) => bridge.save(JSON.stringify(overrides)),
  };
}

/** Tauri: the store plugin keeps a JSON file in the app data directory, like window state and theme. */
function tauriStore(): OverridesStore {
  const fallback = localStorageStore(STORAGE_KEY);
  return {
    load: async () => {
      try {
        const { load } = await import('@tauri-apps/plugin-store');
        const store = await load('messages.json', { autoSave: true });
        return (await store.get<Messages>('overrides')) ?? {};
      } catch {
        return fallback.load();
      }
    },
    save: async (overrides) => {
      try {
        const { load } = await import('@tauri-apps/plugin-store');
        const store = await load('messages.json', { autoSave: true });
        await store.set('overrides', overrides);
        await store.save();
      } catch {
        await fallback.save(overrides);
      }
    },
  };
}

function pick(): OverridesStore {
  if (typeof window === 'undefined') return localStorageStore(STORAGE_KEY);
  const shell = detectShell();
  if (shell === 'electron') return electronStore();
  if (shell === 'tauri') return tauriStore();
  return localStorageStore(STORAGE_KEY);
}

/** One store per page load; the provider hydrates from it and writes only overridden keys to it. */
export const messagesStore: OverridesStore = pick();
