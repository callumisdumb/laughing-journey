'use client';

/**
 * In-memory dataset hydrated from the deterministic generator, with an overlay of user changes
 * persisted to localStorage (and the Tauri store in the desktop shell). Reset clears the overlay.
 */
import { DEFAULT_CONFIG, DEMO_NOW_ISO, isValidIso, mergePeople, mergeRefusals, parseDemoNow, roleLabel, unmergePeople, type AuditEntry, type ChronologyEvent, type ClassifiedRecord, type Config, type Dataset, type PersonMerge, type User } from '@mas/domain';
import { t } from '@mas/messages';
import { DEFAULT_SEED, buildDataset } from '@mas/mock-data';
import { APPEARANCE_KEY, useAppearance } from '@/lib/appearance';
import { isSealedBlob, openLocal, sealLocal } from '@/lib/localStore';
import { appendAudit, auditDetailKey, emptyChain, type AuditChain } from '@/lib/auditChain';
import { buildVault, type Vault } from '@/lib/vault';
import { create } from 'zustand';
import { classificationRefusal, excludedRecipients, reasonRefusal, startedClocks, validateRecord, type WriteEffect, type WriteRequest, type WriteResult } from '@/lib/write';

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
  /** Use the real clock instead of the demo instant. */
  liveClock: boolean;
  /**
   * The demo instant, which every statutory clock and every relative date is computed against.
   *
   * Settable rather than fixed, because the clocks are the part of this product that is hardest to
   * show standing still. "The inquiry decision is due in three days" is a number on a screen; moving
   * the clock four days and watching it go overdue, the band change and the worklist reorder is the
   * demonstration. It is one value, so nothing can be moved by half: a screen reading a different
   * instant from the clock beside it would be worse than a frozen one.
   */
  nowIso: string;
}

interface AppState {
  ready: boolean;
  data: Dataset;
  config: Config;
  /**
   * The encrypted store: ciphertext for every process record, wrapped to the principals the
   * need-to-know matrix entitles. Built beside the dataset so it is never rebuilt on a render.
   */
  vault: Vault;
  /** The signed, append-only audit chain, one entry per ledger entry. */
  chain: AuditChain;
  session: Session;
  init: () => void;
  now: () => Date;
  currentUser: () => User | null;
  signIn: (userId: string, viaSwitch?: boolean) => void;
  signOut: () => void;
  upsert: <K extends Collection>(collection: K, record: Dataset[K][number]) => void;
  remove: (collection: Collection, id: string) => void;
  setConfig: (config: Config) => void;
  /** Writes the ledger entry and the chained copy, and returns it so a caller can cite its id. */
  audit: (entry: Omit<AuditEntry, 'id' | 'synthetic' | 'at' | 'userId' | 'userName' | 'agency' | 'restricted'> & { restricted?: boolean }) => AuditEntry | undefined;
  grantBreakGlass: (processId: string, category: string, reason: string) => void;
  setLiveClock: (v: boolean) => void;
  setDemoNow: (iso: string) => void;
  resetDemoNow: () => void;
  resetDemo: () => void;
  newId: (prefix: string) => string;
  /**
   * The one write pipeline (docs/RECORDS.md section 7). Every create and update goes through it,
   * rather than each call site reimplementing the consequences of a write and one of them forgetting.
   */
  write: <K extends Collection>(request: WriteRequest<K>) => WriteResult;
  /**
   * Merging two person records, and taking a merge back.
   *
   * These sit beside `write` rather than inside it because a merge is not a record write: it
   * rewrites references across the whole dataset, and the pipeline's single-record shape cannot
   * express that. What they do share is everything that makes a write accountable, so both refuse
   * before they touch anything, both are audited, and both write to the surviving record's
   * chronology.
   */
  mergePerson: (survivorId: string, mergedId: string, reason: string) => WriteResult;
  unmergePerson: (mergeId: string, reason: string) => WriteResult;
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
  personMerges: [],
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

/**
 * The chronology entry a merge and an unmerge both write, on the surviving record.
 *
 * A merge is a fact about the person rather than an edit to a field, which is why it is on the list
 * of significant events in `docs/RECORDS.md` and a corrected typo is not. The unmerge is equally a
 * fact: the record was joined to another and then it was not, and a chronology that showed only the
 * merge would leave a reader believing the join still stands.
 */
function mergeEvent(get: () => AppState, user: User, merge: PersonMerge, kind: 'merged' | 'unmerged'): ChronologyEvent {
  const at = get().now().toISOString();
  const byName = `${user.givenName} ${user.familyName}`;
  const other = `${merge.mergedPerson.givenName} ${merge.mergedPerson.familyName}`;
  const reason = kind === 'merged' ? merge.reason : (merge.undoneReason ?? '');
  const title = kind === 'merged' ? t('person.merge.eventTitle', { name: other }) : t('person.merge.unmergeEventTitle', { name: other });
  return {
    id: get().newId('evt'),
    synthetic: true,
    subjectIds: [merge.survivorId],
    linkedProcessIds: [],
    occurredAt: at,
    recordedAt: at,
    recordedByUserId: user.id,
    recordedByName: byName,
    agency: user.agency,
    hasTime: true,
    approximate: false,
    sourceSystem: 'manual',
    eventType: kind === 'merged' ? 'record.merge' : 'record.unmerge',
    title,
    detail: kind === 'merged' ? t('person.merge.eventDetail', { reason, count: merge.repointed.length }) : t('person.merge.unmergeEventDetail', { reason, count: merge.repointed.length }),
    significance: 'high',
    linkedPersonIds: [],
    evidenceRefs: [],
    visibility: 'integrated',
    versions: [{ at, byName, change: title }],
  };
}

/**
 * The local store is encrypted at rest under a device key held in the OS keychain (see
 * lib/localStore.ts). What reaches disk is a nonce and a ciphertext: close the desktop app, open the
 * data file, and there is nothing to read.
 *
 * Before the device key is primed, and where no key can be had at all, nothing is written. A failure
 * to protect must not silently become a failure to encrypt, because the difference is invisible
 * until someone looks at the file.
 */
function readJson<T>(key: string): T | null {
  try {
    const raw = window.localStorage.getItem(key);
    if (!raw) return null;
    const parsed: unknown = JSON.parse(raw);
    if (isSealedBlob(parsed)) return openLocal<T>(key, parsed) ?? null;
    // A store written before the local store was encrypted, which every existing installation will
    // have. It is read once and immediately re-sealed, so the plaintext is gone by the next write
    // rather than persisting because nobody thought about the upgrade. Accepting it is bounded: it
    // only ever converts what is already on this device, and never weakens a record's own
    // encryption, which has no plaintext form anywhere.
    writeJson(key, parsed);
    return parsed as T;
  } catch {
    return null;
  }
}

function writeJson(key: string, value: unknown): void {
  try {
    const sealed = sealLocal(key, value);
    if (!sealed) return;
    window.localStorage.setItem(key, JSON.stringify(sealed));
  } catch {
    /* storage unavailable */
  }
}

let overlay: Overlay = {};
let counter = 0;

/**
 * Persist a change that rewrote the dataset rather than one record.
 *
 * `upsert` and `remove` are the right shape for almost everything, because almost everything writes
 * one record. A merge is not: it repoints references across processes, chronology, meetings, plans
 * and sharing, and then removes a person. Reloading the page after one and finding the merge half
 * undone would be worse than not persisting it at all.
 *
 * The diff is by object identity, which the merge's own walk makes reliable: it returns the same
 * object wherever nothing changed, so this writes exactly the records that moved. A record that
 * comes back after having been removed, which is what an unmerge does, is taken off the removed list
 * as well as written, because `applyOverlay` removes after it upserts and would otherwise filter it
 * straight back out.
 */
function persistDatasetChange(before: Dataset, after: Dataset): void {
  const removed = { ...(overlay.removed ?? {}) };
  for (const key of Object.keys(after) as Array<keyof Dataset>) {
    if (key === 'meta') continue;
    const collection: Collection = key;
    const was = before[collection] as Array<{ id: string }>;
    const now = after[collection] as Array<{ id: string }>;
    if (was === now) continue;

    const patch = { ...(overlay[collection] ?? {}) };
    const nowIds = new Set<string>();
    for (const record of now) {
      nowIds.add(record.id);
      const previous = was.find((r) => r.id === record.id);
      if (previous !== record) patch[record.id] = record;
    }
    const gone = was.filter((r) => !nowIds.has(r.id)).map((r) => r.id);
    if (gone.length > 0) removed[collection] = [...new Set([...(removed[collection] ?? []), ...gone])];
    const back = (removed[collection] ?? []).filter((id) => !nowIds.has(id));
    if (removed[collection] && back.length !== removed[collection].length) removed[collection] = back;

    overlay = { ...overlay, [collection]: patch };
  }
  overlay = { ...overlay, removed };
  writeJson(OVERLAY_KEY, overlay);
}

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
  vault: buildVault(EMPTY, DEFAULT_CONFIG),
  chain: emptyChain(),
  session: { userId: null, breakGlass: [], liveClock: false, nowIso: DEMO_NOW_ISO },
  init: () => {
    if (get().ready) return;
    const seed = process.env.NEXT_PUBLIC_SEED ?? DEFAULT_SEED;
    const base = buildDataset({ seed });
    overlay = readJson<Overlay>(OVERLAY_KEY) ?? {};
    const data = applyOverlay(base, overlay);
    const session = readJson<Session>(SESSION_KEY) ?? { userId: null, breakGlass: [], liveClock: false, nowIso: DEMO_NOW_ISO };
    const nowIso = new Date().toISOString();
    session.breakGlass = (session.breakGlass ?? []).filter((g) => g.expiresAt > nowIso);
    // Older persisted overlays may predate new configuration keys; defaults fill the gaps.
    const config: Config = overlay.config ? { ...DEFAULT_CONFIG, ...overlay.config } : DEFAULT_CONFIG;
    set({ data, config, vault: buildVault(data, config), session: { ...session, breakGlass: session.breakGlass, liveClock: session.liveClock ?? false, nowIso: session.nowIso ?? DEMO_NOW_ISO }, ready: true });
    applyConfiguredAppearanceDefaults(config);
  },
  now: () => (get().session.liveClock ? new Date() : parseDemoNow(get().session.nowIso)),
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
    if (!u) return undefined;
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
    // The signed, append-only chain runs beside the ledger: every entry carries the hash of its
    // predecessor and is signed by the actor's device key, so an entry cannot be edited or removed
    // without the Admin verification screen finding it (lib/auditChain.ts).
    set({ chain: appendAudit(get().chain, rec, auditDetailKey()) });
    return rec;
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
  /**
   * Move the demo clock. Absolute, so a jump forwards and a jump back are the same operation and
   * there is no accumulated drift from repeated relative moves. Setting it turns the live clock off,
   * because a demo instant that the real clock overwrites a second later is not a setting.
   */
  setDemoNow: (iso) => {
    // Refused rather than silently falling back to the seeded instant, which would look like the
    // control not working.
    if (!isValidIso(iso)) return;
    const session = { ...get().session, nowIso: iso, liveClock: false };
    set({ session });
    writeJson(SESSION_KEY, session);
  },
  resetDemoNow: () => {
    const session = { ...get().session, nowIso: DEMO_NOW_ISO };
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
    const rebuilt = buildDataset({ seed });
    set({ data: rebuilt, config: DEFAULT_CONFIG, vault: buildVault(rebuilt, DEFAULT_CONFIG) });
  },
  /**
   * The write pipeline, in the order docs/RECORDS.md section 7 sets out.
   *
   * Refusals come first and are total: nothing is written until every check has passed, so a failed
   * write leaves no half-record, no orphan audit entry and no clock counting down against something
   * that does not exist. Everything the pipeline then does is collected into the result, so the
   * screen can tell the practitioner what happened rather than each screen knowing in advance.
   */
  write: (request) => {
    const effects: WriteEffect[] = [];
    const errors: string[] = [];
    const { config, data } = get();
    const user = get().currentUser();

    if (!user) return { ok: false, errors: ['noUser'], nearMatches: [], effects };

    // 1. The schema, then the rules the schema cannot express, then the reason a correction needs.
    errors.push(...validateRecord(request.collection, request.record));
    errors.push(...(request.rules ?? []));
    const reasonError = reasonRefusal(request.intent, request.reason);
    if (reasonError) errors.push(reasonError);

    // 3. Classification, which may be raised and never quietly lowered.
    const existing = (data[request.collection] as Array<{ id: string }>).find((r) => r.id === (request.record as { id: string }).id);
    const downgrade = classificationRefusal(config, existing as ClassifiedRecord | undefined, request.record as ClassifiedRecord);
    if (downgrade) errors.push(downgrade);

    // 5. The exclusion register, before any recipient is added rather than after.
    let nearMatches: string[] = [];
    if (request.recipients && request.recipients.length > 0 && request.recipientProcess) {
      const check = excludedRecipients(request.recipientProcess, request.recipients, config, data.relationships);
      for (const name of check.refused) errors.push(`excluded:${name}`);
      nearMatches = check.nearMatches;
    }

    if (errors.length > 0) return { ok: false, errors, nearMatches, effects };

    // 10. Persist. Everything below this line has already been allowed to happen.
    get().upsert(request.collection, request.record);

    // 2. The audit entry, which every write has before it is useful.
    const audit = get().audit({
      act: request.act,
      targetType: request.targetType,
      targetId: (request.record as { id: string }).id,
      targetLabel: request.targetLabel,
      processId: request.processId,
      reason: request.reason,
    });
    if (audit) effects.push({ kind: 'audit', detail: audit.id });

    // 4. The wrap list, rebuilt where a process changed, because the entitled set can move with it.
    if (request.collection === 'processes') {
      set({ vault: buildVault(get().data, config) });
      effects.push({ kind: 'rewrap', detail: (request.record as { id: string }).id });
    }

    // 6. Clocks.
    effects.push(...startedClocks(config, request.clocks ?? [], get().now()));
    const clocksOn = request.clocksOn ?? request.processId;
    if (clocksOn && (request.clocks ?? []).length > 0) {
      const process = get().data.processes.find((p) => p.id === clocksOn);
      if (process) {
        const fresh = (request.clocks ?? []).filter((t) => !process.clocks.some((c) => c.id === t.id));
        if (fresh.length > 0) get().upsert('processes', { ...process, clocks: [...process.clocks, ...fresh] });
      }
    }

    // 7. A chronology event, where the change is a significant one and not otherwise.
    if (request.event) {
      const event: ChronologyEvent = {
        id: get().newId('evt'),
        synthetic: true,
        subjectIds: request.event.subjectIds,
        linkedProcessIds: request.event.linkedProcessIds ?? (request.processId ? [request.processId] : []),
        occurredAt: request.event.occurredAt ?? get().now().toISOString(),
        recordedAt: get().now().toISOString(),
        recordedByUserId: user.id,
        recordedByName: `${user.givenName} ${user.familyName}`,
        agency: user.agency,
        hasTime: true,
        approximate: false,
        sourceSystem: 'manual',
        eventType: request.event.eventType,
        title: request.event.title,
        detail: request.event.detail,
        significance: request.event.significance,
        linkedPersonIds: [],
        evidenceRefs: [],
        visibility: request.event.visibility ?? 'agency-only',
        versions: [{ at: get().now().toISOString(), byName: `${user.givenName} ${user.familyName}`, change: request.targetLabel }],
      };
      get().upsert('events', event);
      effects.push({ kind: 'event', detail: event.id });
    }

    // 8. The sharing the matrix requires, each already carrying its lawful basis.
    for (const share of request.shares ?? []) {
      effects.push({ kind: 'share', detail: `${share.recipientName}: ${share.reason}` });
    }

    // 9. Outbound connector proposals. The outbox, its delivery state, its idempotency key and its
    // authorisation are step 14; recorded here so the seam exists in one place rather than being
    // discovered at fifteen call sites when it does (D-113).
    for (const out of request.outbound ?? []) {
      effects.push({ kind: 'outbound', detail: `${out.connectorId}: ${out.summary}` });
    }

    return { ok: true, errors: [], nearMatches, effects, audit };
  },
  mergePerson: (survivorId, mergedId, reason) => {
    const { config, data } = get();
    const user = get().currentUser();
    if (!user) return { ok: false, errors: ['noUser'], nearMatches: [], effects: [] };

    const errors = mergeRefusals(data, survivorId, mergedId, reason);
    if (errors.length > 0) return { ok: false, errors, nearMatches: [], effects: [] };

    const survivor = data.people.find((p) => p.id === survivorId)!;
    const merged = data.people.find((p) => p.id === mergedId)!;
    const at = get().now().toISOString();
    const result = mergePeople(data, { id: get().newId('mrg'), survivorId, mergedId, at, byUserId: user.id, byName: `${user.givenName} ${user.familyName}`, reason });

    const next = { ...result.data, personMerges: [...data.personMerges, result.merge] };
    set({ data: next, vault: buildVault(next, config) });
    persistDatasetChange(data, next);

    const effects: WriteEffect[] = [{ kind: 'rewrap', detail: `${result.merge.repointed.length} references repointed` }];
    const audit = get().audit({ act: 'merge', targetType: 'person', targetId: survivorId, targetLabel: `${survivor.givenName} ${survivor.familyName}`, reason: t('person.merge.audit', { name: `${merged.givenName} ${merged.familyName}`, reason }) });
    if (audit) effects.push({ kind: 'audit', detail: audit.id });

    // A merge is a fact about the person, so it goes on the chronology of the record that survived.
    get().upsert('events', mergeEvent(get, user, result.merge, 'merged'));
    effects.push({ kind: 'event', detail: result.merge.id });

    return { ok: true, errors: [], nearMatches: [], effects, audit };
  },
  unmergePerson: (mergeId, reason) => {
    const { config, data } = get();
    const user = get().currentUser();
    if (!user) return { ok: false, errors: ['noUser'], nearMatches: [], effects: [] };

    const merge = data.personMerges.find((m) => m.id === mergeId);
    if (!merge) return { ok: false, errors: ['unmergeMissing'], nearMatches: [], effects: [] };
    if (merge.undoneAt) return { ok: false, errors: ['unmergeAlreadyUndone'], nearMatches: [], effects: [] };
    if (reason.trim().length < 10) return { ok: false, errors: ['unmergeReasonRequired'], nearMatches: [], effects: [] };

    const next = unmergePeople(data, merge, { at: get().now().toISOString(), reason });
    set({ data: next, vault: buildVault(next, config) });
    persistDatasetChange(data, next);

    const effects: WriteEffect[] = [{ kind: 'rewrap', detail: `${merge.repointed.length} references restored` }];
    const audit = get().audit({
      act: 'unmerge',
      targetType: 'person',
      targetId: merge.survivorId,
      targetLabel: `${merge.survivorBefore.givenName} ${merge.survivorBefore.familyName}`,
      reason: t('person.merge.unmergeAudit', { name: `${merge.mergedPerson.givenName} ${merge.mergedPerson.familyName}`, reason }),
    });
    if (audit) effects.push({ kind: 'audit', detail: audit.id });

    get().upsert('events', mergeEvent(get, user, merge, 'unmerged'));
    effects.push({ kind: 'event', detail: merge.id });

    return { ok: true, errors: [], nearMatches: [], effects, audit };
  },
  newId: (prefix) => {
    counter += 1;
    return `${prefix}_u${Date.now().toString(36)}${counter.toString(36)}`;
  },
}));

export function useData(): Dataset {
  return useAppStore((s) => s.data);
}

/**
 * The encrypted store.
 *
 * Built once when the dataset loads and held in the store beside it, rather than memoised in a hook:
 * building it costs a hybrid key pair per principal and a wrap per entitled principal per record,
 * and it must not happen again on every render.
 *
 * In production a client fetches ciphertext and holds only its own keys. Here it holds every key,
 * which is what lets the "What the host can see" screen draw both views side by side. The Security
 * page says so, rather than leaving the impression that a browser in the field would hold the whole
 * key set.
 */
export function useVault(): Vault {
  return useAppStore((s) => s.vault);
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
  const nowIso = useAppStore((s) => s.session.nowIso);
  return live ? new Date() : parseDemoNow(nowIso);
}
