/**
 * Runtime overrides. Three layers merge in order: the bundled catalogue, the local overrides file,
 * then session overrides (only the keys someone changed, persisted by the store the app supplies:
 * localStorage in the browser, the Tauri store or the Electron app data directory in the shells).
 */
import { BUNDLED, LOCAL_OVERRIDES, type Messages } from './catalogue';

export interface OverridesStore {
  load: () => Promise<Messages> | Messages;
  save: (overrides: Messages) => Promise<void> | void;
}

type Listener = () => void;

let session: Messages = {};
let merged: Messages = { ...BUNDLED, ...LOCAL_OVERRIDES };
let store: OverridesStore | undefined;
const listeners = new Set<Listener>();

function recompute(): void {
  merged = { ...BUNDLED, ...LOCAL_OVERRIDES, ...session };
  for (const l of listeners) l();
}

function persist(): void {
  void store?.save({ ...session });
}

/** The current merged messages (bundled, local file, session). */
export function currentMessages(): Messages {
  return merged;
}

/** The session overrides only, never a full copy. */
export function sessionOverrides(): Messages {
  return session;
}

export function getMessage(key: string): string | undefined {
  return merged[key];
}

export function defaultMessage(key: string): string | undefined {
  return LOCAL_OVERRIDES[key] ?? BUNDLED[key];
}

export function isOverridden(key: string): boolean {
  return key in session;
}

export function setOverride(key: string, value: string): void {
  if (value === defaultMessage(key)) delete session[key];
  else session = { ...session, [key]: value };
  recompute();
  persist();
}

export function resetOverride(key: string): void {
  if (!(key in session)) return;
  const next = { ...session };
  delete next[key];
  session = next;
  recompute();
  persist();
}

export function resetAllOverrides(): void {
  session = {};
  recompute();
  persist();
}

/** Replace every session override at once (import from JSON). Unknown keys are dropped. */
export function replaceOverrides(next: Messages): void {
  session = Object.fromEntries(Object.entries(next).filter(([k, v]) => k in BUNDLED && typeof v === 'string' && v !== defaultMessage(k)));
  recompute();
  persist();
}

export function subscribe(listener: Listener): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

/** Attach the persistence store and load what it holds. Safe to call once per app boot. */
export async function hydrateOverrides(next: OverridesStore): Promise<void> {
  store = next;
  try {
    const loaded = await next.load();
    session = Object.fromEntries(Object.entries(loaded ?? {}).filter(([k, v]) => k in BUNDLED && typeof v === 'string'));
  } catch {
    session = {};
  }
  recompute();
}

/** localStorage store for the browser. */
export function localStorageStore(storageKey = 'mas.messages'): OverridesStore {
  return {
    load: () => {
      try {
        const raw = window.localStorage.getItem(storageKey);
        return raw ? (JSON.parse(raw) as Messages) : {};
      } catch {
        return {};
      }
    },
    save: (overrides) => {
      try {
        if (Object.keys(overrides).length === 0) window.localStorage.removeItem(storageKey);
        else window.localStorage.setItem(storageKey, JSON.stringify(overrides));
      } catch {
        /* storage may be unavailable */
      }
    },
  };
}

/** A store that keeps nothing between reloads; tests and server rendering use it. */
export const memoryStore: OverridesStore = { load: () => ({}), save: () => undefined };
