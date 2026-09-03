'use client';

/**
 * In-memory dataset hydrated from the deterministic generator, with an overlay of user changes
 * persisted to localStorage (and the Tauri store in the desktop shell). Reset clears the overlay.
 */
import { DEFAULT_CONFIG, demoNow, roleLabel, type AuditEntry, type Config, type Dataset, type User } from '@mas/domain';
import { DEFAULT_SEED, buildDataset } from '@mas/mock-data';
import { APPEARANCE_KEY, useAppearance } from '@/lib/appearance';
import { create } from 'zustand';

export type Collection = Exclude<keyof Dataset, 'meta'>;
type Overlay = Partial<Record<Collection, Record<string, unknown>>> & { config?: Config; removed?: Partial<Record<Collection, string[]>> };

export interface BreakGlassGrant {
  processId: string;
  /** One of config.breakGlassReasons. */
  category: string;
  reason: string;
  grantedAt: string;
  expiresAt: string;
}

export interface Session {
  userId: string | null;
  breakGlass: BreakGlassGrant[];
  /** Use the real clock instead of the fixed demo instant. */
  liveClock: boolean;
}

interface AppState {
  ready: boolean;
  data: Dataset;
  config: Config;
  session: Session;
  init: () => void;
  now: () => Date;
  currentUser: () => User | null;
  signIn: (userId: string, viaSwitch?: boolean) => void;
  signOut: () => void;
  upsert: <K extends Collection>(collection: K, record: Dataset[K][number]) => void;
  remove: (collection: Collection, id: string) => void;
  setConfig: (config: Config) => void;
  audit: (entry: Omit<AuditEntry, 'id' | 'synthetic' | 'at' | 'userId' | 'userName' | 'agency' | 'restricted'> & { restricted?: boolean }) => void;
  grantBreakGlass: (processId: string, category: string, reason: string) => void;
  setLiveClock: (v: boolean) => void;
  resetDemo: () => void;
  newId: (prefix: string) => string;
}

const OVERLAY_KEY = 'mas.overlay.v1';
const SESSION_KEY = 'mas.session';

const EMPTY: Dataset = {
  meta: { seed: DEFAULT_SEED, generatedAt: '', now: '', synthetic: true },
  organisations: [],
  teams: [],
  users: [],
  addresses: [],
  people: [],
  households: [],
  relationships: [],
  processes: [],
  events: [],
  analyses: [],
  meetings: [],
  actions: [],
  plans: [],
  riskAssessments: [],
  viewsRecords: [],
  lawfulBases: [],
  sharingRecords: [],
  informationRequests: [],
  connectorEvents: [],
  audit: [],
};

function readJson<T>(key: string): T | null {
  try {
    const raw = window.localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : null;
  } catch {
    return null;
  }
}

function writeJson(key: string, value: unknown): void {
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* storage unavailable */
  }
}

let overlay: Overlay = {};
let counter = 0;

function applyOverlay(data: Dataset, ov: Overlay): Dataset {
  const out: Dataset = { ...data };
  for (const key of Object.keys(ov) as Array<keyof Overlay>) {
    if (key === 'config' || key === 'removed') continue;
    const records = ov[key];
    if (!records) continue;
    const list = [...(out[key] as unknown[])] as Array<{ id: string }>;
    for (const [id, rec] of Object.entries(records)) {
      const i = list.findIndex((r) => r.id === id);
      if (i >= 0) list[i] = rec as { id: string };
      else list.unshift(rec as { id: string });
    }
    (out as unknown as Record<string, unknown>)[key] = list;
  }
  for (const [key, ids] of Object.entries(ov.removed ?? {})) {
    const list = (out[key as Collection] as Array<{ id: string }>).filter((r) => !ids?.includes(r.id));
    (out as unknown as Record<string, unknown>)[key] = list;
  }
  return out;
}

/**
 * Admin can set a default theme and density (config.defaults). They apply on a device that has no
 * appearance preference of its own yet; once a person picks a theme in Settings that choice wins.
 */
function applyConfiguredAppearanceDefaults(config: Config): void {
  if (typeof window === 'undefined') return;
  try {
    if (window.localStorage.getItem(APPEARANCE_KEY)) return;
  } catch {
    return;
  }
  const appearance = useAppearance.getState();
  if (appearance.theme !== config.defaults.theme) appearance.setTheme(config.defaults.theme);
  if (appearance.density !== config.defaults.density) appearance.setDensity(config.defaults.density);
}

export const useAppStore = create<AppState>((set, get) => ({
  ready: false,
  data: EMPTY,
  config: DEFAULT_CONFIG,
  session: { userId: null, breakGlass: [], liveClock: false },
  init: () => {
    if (get().ready) return;
    const seed = process.env.NEXT_PUBLIC_SEED ?? DEFAULT_SEED;
    const base = buildDataset({ seed });
    overlay = readJson<Overlay>(OVERLAY_KEY) ?? {};
    const data = applyOverlay(base, overlay);
    const session = readJson<Session>(SESSION_KEY) ?? { userId: null, breakGlass: [], liveClock: false };
    const nowIso = new Date().toISOString();
    session.breakGlass = (session.breakGlass ?? []).filter((g) => g.expiresAt > nowIso);
    // Older persisted overlays may predate new configuration keys; defaults fill the gaps.
    const config: Config = overlay.config ? { ...DEFAULT_CONFIG, ...overlay.config } : DEFAULT_CONFIG;
    set({ data, config, session: { ...session, breakGlass: session.breakGlass, liveClock: session.liveClock ?? false }, ready: true });
    applyConfiguredAppearanceDefaults(config);
  },
  now: () => (get().session.liveClock ? new Date() : demoNow()),
  currentUser: () => {
    const id = get().session.userId;
    return id ? (get().data.users.find((u) => u.id === id) ?? null) : null;
  },
  signIn: (userId, viaSwitch = false) => {
    const previous = get().currentUser();
    const next = get().data.users.find((u) => u.id === userId);
    if (!next) return;
    const session = { ...get().session, userId };
    set({ session });
    writeJson(SESSION_KEY, session);
    try {
      window.localStorage.setItem('mas.lastPersona', userId);
    } catch {
      /* ignore */
    }
    const at = get().now().toISOString();
    const entry: AuditEntry = {
      id: get().newId('aud'),
      synthetic: true,
      at,
      userId: next.id,
      userName: `${next.givenName} ${next.familyName}`,
      agency: next.agency,
      act: viaSwitch ? 'persona-switch' : 'sign-in',
      targetType: 'session',
      targetId: next.id,
      targetLabel: viaSwitch && previous ? `Switched from ${previous.givenName} ${previous.familyName} (demo)` : `${roleLabel(next.roleId)} signed in (mock SSO)`,
      restricted: false,
    };
    get().upsert('audit', entry);
  },
  signOut: () => {
    const session = { ...get().session, userId: null, breakGlass: [] };
    set({ session });
    writeJson(SESSION_KEY, session);
  },
  upsert: (collection, record) => {
    const data = get().data;
    const list = [...(data[collection] as Array<{ id: string }>)];
    const i = list.findIndex((r) => r.id === (record as { id: string }).id);
    if (i >= 0) list[i] = record;
    else list.unshift(record);
    set({ data: { ...data, [collection]: list } });
    overlay = { ...overlay, [collection]: { ...(overlay[collection] ?? {}), [(record as { id: string }).id]: record } };
    writeJson(OVERLAY_KEY, overlay);
  },
  remove: (collection, id) => {
    const data = get().data;
    const list = (data[collection] as Array<{ id: string }>).filter((r) => r.id !== id);
    set({ data: { ...data, [collection]: list } });
    const removed = { ...(overlay.removed ?? {}) };
    removed[collection] = [...(removed[collection] ?? []), id];
    const col = { ...(overlay[collection] ?? {}) };
    delete col[id];
    overlay = { ...overlay, [collection]: col, removed };
    writeJson(OVERLAY_KEY, overlay);
  },
  setConfig: (config) => {
    set({ config });
    overlay = { ...overlay, config };
    writeJson(OVERLAY_KEY, overlay);
  },
  audit: (entry) => {
    const u = get().currentUser();
    if (!u) return;
    const rec: AuditEntry = {
      id: get().newId('aud'),
      synthetic: true,
      at: get().now().toISOString(),
      userId: u.id,
      userName: `${u.givenName} ${u.familyName}`,
      agency: u.agency,
      restricted: entry.restricted ?? false,
      ...entry,
    };
    get().upsert('audit', rec);
  },
  grantBreakGlass: (processId, category, reason) => {
    const now = get().now();
    const hours = get().config.breakGlassHours;
    const grant: BreakGlassGrant = { processId, category, reason, grantedAt: now.toISOString(), expiresAt: new Date(now.getTime() + hours * 3600 * 1000).toISOString() };
    const session = { ...get().session, breakGlass: [...get().session.breakGlass.filter((g) => g.processId !== processId), grant] };
    set({ session });
    writeJson(SESSION_KEY, session);
    const p = get().data.processes.find((x) => x.id === processId);
    get().audit({ act: 'break-glass', targetType: 'process', targetId: processId, targetLabel: p ? `${p.reference}: ${p.title}` : processId, processId, reason: `${category}: ${reason}`, restricted: true, expiresAt: grant.expiresAt });
  },
  setLiveClock: (v) => {
    const session = { ...get().session, liveClock: v };
    set({ session });
    writeJson(SESSION_KEY, session);
  },
  resetDemo: () => {
    overlay = {};
    try {
      window.localStorage.removeItem(OVERLAY_KEY);
    } catch {
      /* ignore */
    }
    const seed = process.env.NEXT_PUBLIC_SEED ?? DEFAULT_SEED;
    set({ data: buildDataset({ seed }), config: DEFAULT_CONFIG });
  },
  newId: (prefix) => {
    counter += 1;
    return `${prefix}_u${Date.now().toString(36)}${counter.toString(36)}`;
  },
}));

export function useData(): Dataset {
  return useAppStore((s) => s.data);
}

export function useConfig(): Config {
  return useAppStore((s) => s.config);
}

export function useCurrentUser(): User | null {
  const id = useAppStore((s) => s.session.userId);
  const users = useAppStore((s) => s.data.users);
  return id ? (users.find((u) => u.id === id) ?? null) : null;
}

export function useNow(): Date {
  const live = useAppStore((s) => s.session.liveClock);
  return live ? new Date() : demoNow();
}
