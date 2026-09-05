'use client';

/**
 * In-memory dataset hydrated from the deterministic generator, with an overlay of user changes
 * persisted to localStorage (and the Tauri store in the desktop shell). Reset clears the overlay.
 */
import { DEFAULT_CONFIG, DEMO_NOW_ISO, OPENING_STAGE, buildOpeningProcess, canOpenProcess, contextFor, detailLevelLabel, eligibilityFor, exclusionsRestingOn, clockRuleLabel, nextReference, registerUpdateLabel, openProcessesOfType, openingClassification, openingClockRuleIds, processLabel, isValidIso, membersOn, mergePeople, mergeRefusals, parseDemoNow, partyRegister, processesTouchedByHousehold, resolveNeedToKnow, roleLabel, unmergePeople, withPartyEntry, withRecordedInError, withVersion, proposalRefusals, proposeWrite, closurePayload, connectorsForIntent, episodePayload, CONNECTOR_IDS, authorisationRefusals, authoriseWrite, canTransition, echoedWrite, markAcknowledged, markDeadLetter, markSent, outboundIntentLabel, type OutboundWrite, type InboundChange, applyDeath, closeProcess, closeRefusals, closureReasonsFor, deathRefusals, reopenProcess, reopenRefusals, type CloseInput, type Correctable, type DeathConsequence, type DeathInput, type AuditEntry, type ChronologyEvent, type ClassifiedRecord, type Config, type ClockTrigger, type Dataset, type OpeningInput, type Action, type Agency, type ConnectorEvent, type ConnectorId, type Meeting, type Notification, type NotificationDraft, type Person, type PersonMerge, type Process, type ProcessType, type Relationship, type SharingRecord, type User, actionClockNotifications, actionNotifications, addressedTo, admissible, breakGlassNotifications, clockNotifications, inboxNotifications, informationRequestNotifications, matrixShareNotifications, meetingNotifications, nearMatchNotifications, processNotifications, sharingNotifications, agencyShort, applyTransition, buildMeeting, classificationFor, formatDate, heldTransitionFor, meetingTypeLabel, scheduleRoute, stagePayload, stageLabel, transitionById, transitionLabel, validateSchedule, type Creates, type InformationRequest, type MeetingType, type MissingThing, type PermissionDecision, type ScheduleInput, type TransitionOutcome } from '@mas/domain';
import { t } from '@mas/messages';
import { DEFAULT_SEED, buildDataset } from '@mas/mock-data';
import { APPEARANCE_KEY, useAppearance } from '@/lib/appearance';
import { useViewAs } from '@/lib/viewAs';
import { isSealedBlob, openLocal, sealLocal } from '@/lib/localStore';
import { appendAudit, auditDetailKey, emptyChain, type AuditChain } from '@/lib/auditChain';
import { buildVault, type Vault } from '@/lib/vault';
import { ESCROW_HOLDERS } from '@/lib/keyManagement';
import { encryptForGateway, platformViewOutbound } from '@mas/connectors';
import { generateKeyPair, type PublicKey } from '@mas/crypto';
import { create } from 'zustand';
import { listedNames } from '@/lib/selectors';
import { applyClockTransition, classificationRefusal, excludedRecipients, lawfulBasisFor, reasonRefusal, registerChanges, reverseNearMatches, sharingRecordFor, startedClocks, validateRecord, versionFor, type WriteEffect, type WriteRequest, type WriteResult, type WriteShare } from '@/lib/write';

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

/**
 * A named state, kept so a take can be repeated.
 *
 * Recording is the reason this exists. A demonstration that has just written a minute, promoted an
 * inbox item and moved the clock three weeks cannot be shot again without either resetting to seed,
 * which throws away the set-up as well as the take, or clicking through the set-up again and hoping
 * it lands the same way. A snapshot is the overlay and the session as they stand, so the presenter
 * can put the product back exactly where it was and go again.
 *
 * It is deliberately not the whole dataset: the dataset is a pure function of the seed and the
 * overlay, so storing the overlay stores the difference and nothing else, and a snapshot taken on
 * one build still applies on the next.
 */
export interface DemoSnapshot {
  name: string;
  at: string;
  overlay: Overlay;
  session: Session;
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
  setConfig: (config: Config) => void;
  /** Writes the ledger entry and the chained copy, and returns it so a caller can cite its id. */
  audit: (entry: Omit<AuditEntry, 'id' | 'synthetic' | 'at' | 'userId' | 'userName' | 'agency' | 'restricted'> & { id?: string; restricted?: boolean }) => AuditEntry | undefined;
  grantBreakGlass: (processId: string, category: string, reason: string) => void;
  setLiveClock: (v: boolean) => void;
  setDemoNow: (iso: string) => void;
  resetDemoNow: () => void;
  resetDemo: () => void;
  /**
   * The recipient's own state on a notification: read, all read, dismissed. Not audited, because
   * reading a pointer to a record is not reading the record; the record's own read is ledgered
   * when the person opens it (D-209).
   */
  markNotificationRead: (id: string) => void;
  markAllNotificationsRead: () => void;
  dismissNotification: (id: string) => void;
  /**
   * The clock engine's write: a warning for every running clock inside its rule's window, a breach
   * for every one past due, the same for every open action, and the escalation marker on an action
   * whose owner has been silent past the configured interval. Evaluated whenever the instant moves
   * and after any write that could start a clock, and safe to run again because every draft carries
   * a key the store refuses twice. The seeded state's standing warnings are in the seed itself,
   * already read, so a fresh seed writes nothing here and the overlay stays empty (D-208). Returns
   * how many it wrote.
   */
  evaluateClocks: () => number;
  /** Named states the presenter has kept, newest first. */
  snapshots: DemoSnapshot[];
  takeSnapshot: (name: string) => void;
  restoreSnapshot: (name: string) => void;
  deleteSnapshot: (name: string) => void;
  newId: (prefix: string) => string;
  /**
   * The one write pipeline (docs/RECORDS.md section 7). Every create and update goes through it,
   * rather than each call site reimplementing the consequences of a write and one of them forgetting.
   *
   * It is also the only way a record reaches the store from a screen. The raw `upsert` is private to
   * this module, and `apps/web/lib/write.test.ts` walks every source file to make sure it stays so.
   */
  write: <K extends Collection>(request: WriteRequest<K>) => WriteResult;
  /**
   * The other writer: a connector delivering what a source system said.
   *
   * A connector event or an inbound change is not a person's write, so it does not carry a person's
   * audit entry, a version, a clock or a chronology milestone: those belong to the review that
   * promotes, accepts or dismisses it, which is a `write`. What it does carry is the schema check and
   * the de-duplication on the far side's own reference, because a feed that replays is a feed.
   */
  receive: (record: Dataset['connectorEvents'][number] | Dataset['inbound'][number]) => { ok: boolean; errors: string[]; duplicate: boolean };
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
  /**
   * Household membership, which is dated rather than a list of names.
   *
   * Removing somebody sets an end date, because who lived where and when is exactly what a
   * chronology needs, and a household change writes a chronology entry on the person moved.
   */
  addToHousehold: (householdId: string, personId: string, from: string, note: string, notify: boolean) => WriteResult;
  endHouseholdMembership: (householdId: string, personId: string, to: string, reason: string) => WriteResult;
  setHouseholdLabel: (householdId: string, label: string) => WriteResult;
  /**
   * Relationships, stored once and read from both ends.
   *
   * `saveRelationship` covers creating and editing; `endRelationship` sets `to` and never deletes,
   * because a former partner is a former partner from a date and that date is often the most
   * important fact in the record. Both take the exclusion decisions the change implies, so the
   * consequence is decided at the point of saving rather than discovered afterwards.
   */
  saveRelationship: (relationship: Relationship, decisions?: PartyDecision[]) => WriteResult;
  endRelationship: (relationshipId: string, to: string, reason: string, decisions: PartyDecision[]) => WriteResult;
  /**
   * Opening a process, which is the moment the product's central promise either happens or does not.
   *
   * Everything in `docs/RECORDS.md` section 4.4 or the create fails cleanly: the reference, the
   * opening stage and its history entry, the clocks the trigger starts, the classification from the
   * derivation rules, the case-role register, the notifications with their lawful basis, a
   * chronology milestone on every subject and the audit entry.
   */
  openProcess: (request: OpenProcessRequest) => WriteResult & { process?: Process };
  /**
   * The terminal states, which are the other half of a records system and the half products skip.
   *
   * Nothing here deletes. `closeProcess` stops the clocks and writes the coded reason the national
   * return reads; `reopenProcess` resumes only the clocks the closure stopped; `recordInError` is
   * the terminal state for a record that should never have existed, which hides it from working
   * views and keeps it everywhere it has already been relied on; `recordDeath` is a flow with
   * consequences across every open case rather than a tick box on the person.
   */
  closeProcess: (processId: string, input: Omit<CloseInput, 'at' | 'byName' | 'byUserId'>) => WriteResult & { stopped?: ClockTrigger[] };
  reopenProcess: (processId: string, reason: string) => WriteResult & { resumed?: ClockTrigger[] };
  recordInError: (collection: Collection, id: string, reason: string) => WriteResult;
  recordDeath: (input: Omit<DeathInput, 'recordedAt' | 'byName' | 'byUserId'>) => WriteResult & { consequences?: DeathConsequence[] };
  /**
   * The outbound half of the connectors.
   *
   * Nothing writes automatically. `authoriseOutbound` is the only path out, it takes a purpose and a
   * lawful basis exactly as a share does, and the delivery states after it are visible rather than
   * inferred: a write that has not been acknowledged says so wherever it matters, because believing
   * the other agency knows when they do not is how an assumption reaches a significant case review.
   */
  authoriseOutbound: (id: string, purpose: string, lawfulBasisId: string) => WriteResult & { write?: OutboundWrite };
  parkOutbound: (id: string) => WriteResult;
  cancelOutbound: (id: string) => WriteResult;
  /**
   * Record a stage transition: the only route to a stage (D-211).
   *
   * The engine decides whether the decision may be recorded and what the record looks like after
   * it; this runs the consequences through the pipeline in order. The process write carries the
   * stage entry, the audit act, the milestone, the clocks completed and started, the rewrap, the
   * notifications and the connector proposal. Then each follow-on the engine named is its own
   * write with its own ledger line: the meeting, the plan and its actions, the information requests
   * on a lawful basis, the answer to a request, the closure, the linked case, the birth.
   */
  recordTransition: (processId: string, transitionId: string, input: unknown) => TransitionRecordResult;
  /**
   * Meetings (D-213). Scheduling routes through the engine where the tables schedule the type from
   * the case's stage and is a plain meeting write otherwise; a move and a cancellation each carry a
   * reason into the ledger and tell everybody invited; a meeting whose type fires no transition from
   * the case's stage is held here with its minute opened, and every other meeting is held by the
   * transition it fires, through `recordTransition`.
   */
  scheduleMeeting: (processId: string, type: MeetingType, input: ScheduleInput & { reconvenes?: string } & Record<string, unknown>) => TransitionRecordResult;
  rescheduleMeeting: (meetingId: string, change: { scheduledAt: string; location: string; reason: string }) => WriteResult;
  cancelMeeting: (meetingId: string, reason: string) => WriteResult;
  holdMeeting: (meetingId: string, note: string) => WriteResult;
  /** Accept a case opened in a source system, which creates the matching process here. */
  acceptInbound: (id: string) => WriteResult & { process?: Process };
  declineInbound: (id: string, reason: string) => WriteResult;
}

export interface TransitionRecordResult extends WriteResult {
  outcome?: TransitionOutcome;
  /** What the engine said was missing, each with the action that creates it. */
  missing?: MissingThing[];
  permission?: PermissionDecision;
  /** The records the transition created beside the process. */
  created?: { meetingId?: string; planId?: string; actionIds: string[]; requestIds: string[]; processId?: string };
  /** Dialogs the engine offered next, for the screen to open. */
  offers?: Creates[];
  /** A meeting the engine asked to be rescheduled, for the screen to offer. */
  reschedule?: string;
}

export interface OpenProcessRequest extends OpeningInput {
  /** Set where an open case of the same type already exists and a second is being opened anyway. */
  secondCaseReason?: string;
}

/** A decision about whether an exclusion the change touches still stands, and why. */
export interface PartyDecision {
  processId: string;
  personId: string;
  stands: boolean;
  reason: string;
}

/**
 * What the audit ledger calls each collection.
 *
 * The ledger's `targetType` is a small, deliberate list rather than the collection name, because a
 * reader filtering the ledger is asking "show me everything about a person" and not "show me the
 * viewsRecords table". A collection with no natural heading files under `record`.
 */
const TARGET_TYPES: Record<Collection, AuditEntry['targetType']> = {
  organisations: 'config',
  teams: 'config',
  users: 'config',
  addresses: 'person',
  people: 'person',
  households: 'person',
  personMerges: 'person',
  relationships: 'person',
  processes: 'process',
  events: 'event',
  analyses: 'event',
  meetings: 'meeting',
  actions: 'process',
  plans: 'process',
  riskAssessments: 'process',
  viewsRecords: 'person',
  lawfulBases: 'sharing',
  sharingRecords: 'sharing',
  informationRequests: 'sharing',
  connectorEvents: 'inbox',
  outbox: 'sharing',
  inbound: 'inbox',
  audit: 'config',
  notifications: 'sharing',
};

/**
 * The gateway an outbound write is encrypted to: one per agency, holding that agency's key.
 *
 * Derived rather than configured, because the agency that owns a connector already decides which
 * gateway it runs behind and a second list would be a second answer to the same question. The key is
 * derived from the agency, which is the same construction the vault uses for every other principal.
 */
function gatewayFor(connectorId: ConnectorId): { agency: Agency; agencyKey: PublicKey } {
  const agency = CONNECTOR_AGENCY[connectorId];
  return { agency, agencyKey: generateKeyPair('agency', `p:agy:${agency}`).publicKey };
}

const CONNECTOR_AGENCY: Record<ConnectorId, Agency> = {
  'emis-web': 'health',
  eclipse: 'social-work',
  carefirst: 'social-work',
  ivpd: 'police',
  seemis: 'education',
  trakcare: 'health',
  morse: 'health',
  // The Public Guardian is a court office rather than an agency in this taxonomy, and it is
  // lookup only in either direction, so nothing is ever encrypted to its gateway.
  opg: 'court',
  scra: 'scra',
  visor: 'police',
};

/**
 * The process an inbound change would open, read from its own payload.
 *
 * The source system says what kind of episode it is in its own vocabulary, so the mapping is here
 * rather than guessed from the connector: a council system opens child protection and adult support
 * and protection episodes through the same feed.
 */
function inboundProcessType(change: InboundChange): ProcessType | null {
  const value = change.payload.find((f) => f.field === 'Episode.Type')?.value.toLowerCase();
  return value === 'asp' || value === 'cp' || value === 'marac' || value === 'mappa' || value === 'awi' ? value : null;
}

const OVERLAY_KEY = 'mas.overlay.v1';
const SESSION_KEY = 'mas.session';
const SNAPSHOT_KEY = 'mas.snapshots.v1';

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
  outbox: [],
  inbound: [],
  audit: [],
  notifications: [],
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

type Setter = (partial: Partial<AppState>) => void;

/**
 * The raw persist, private to this module on purpose.
 *
 * It used to be public, and eighteen screens called it directly while the handover said every write
 * went through the pipeline. A write that reaches here without going through `write` skips the audit
 * entry, the classification check, the exclusion check, the rewrap, the clocks and the chronology,
 * and nothing on the screen looks any different. So the only callers are the pipeline, the audit
 * ledger, the merge and the connector delivery path below, and `write.test.ts` walks every source
 * file to keep it that way.
 *
 * Nothing removes. A casework record is retired (D-148) or recorded in error (D-153), never deleted,
 * and the one whole-dataset change that does drop records, a person merge, goes through
 * `persistDatasetChange` so the overlay records what went and can put it back.
 */
function upsert<K extends Collection>(get: () => AppState, set: Setter, collection: K, record: Dataset[K][number]): void {
  const data = get().data;
  const list = [...(data[collection] as Array<{ id: string }>)];
  const i = list.findIndex((r) => r.id === (record as { id: string }).id);
  if (i >= 0) list[i] = record;
  else list.unshift(record);
  set({ data: { ...data, [collection]: list } });
  overlay = { ...overlay, [collection]: { ...(overlay[collection] ?? {}), [(record as { id: string }).id]: record } };
  writeJson(OVERLAY_KEY, overlay);
}

/**
 * Write the notifications a change implies (docs/RECORDS.md section 7, step 8).
 *
 * The drafts say who and what; this decides whether. The actor is never told about their own act,
 * an excluded party on the case is never a recipient, by the same check that refuses them as a share
 * recipient, and a draft whose key the store already holds is the same notification and is not
 * written twice. Nothing here composes text: the summary a person reads is rendered from the kind
 * and the source at read time (lib/notifications.ts), so a notification never carries content its
 * recipient's level would withhold.
 */
function notify(get: () => AppState, set: Setter, drafts: readonly NotificationDraft[], ctx: { actorUserId?: string; process?: Process }): Notification[] {
  const { data, config } = get();
  const at = get().now().toISOString();
  const held = new Set(data.notifications.map((n) => n.key));
  const written: Notification[] = [];
  for (const d of drafts) {
    if (held.has(d.key)) continue;
    const process = d.processId && d.processId !== ctx.process?.id ? data.processes.find((p) => p.id === d.processId) : ctx.process;
    if (!admissible(d, { actorUserId: ctx.actorUserId, process, exclusions: config.exclusions, relationships: data.relationships, users: data.users })) continue;
    held.add(d.key);
    const record: Notification = { ...d, id: get().newId('ntf'), synthetic: true, createdAt: at, createdByUserId: ctx.actorUserId };
    upsert(get, set, 'notifications', record);
    written.push(record);
  }
  return written;
}

export const useAppStore = create<AppState>((set, get) => ({
  ready: false,
  data: EMPTY,
  config: DEFAULT_CONFIG,
  vault: buildVault(EMPTY, DEFAULT_CONFIG),
  chain: emptyChain(),
  session: { userId: null, breakGlass: [], liveClock: false, nowIso: DEMO_NOW_ISO },
  snapshots: [],
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
    set({ data, config, vault: buildVault(data, config), session: { ...session, breakGlass: session.breakGlass, liveClock: session.liveClock ?? false, nowIso: session.nowIso ?? DEMO_NOW_ISO }, snapshots: readJson<DemoSnapshot[]>(SNAPSHOT_KEY) ?? [], ready: true });
    applyConfiguredAppearanceDefaults(config);
    // The seed carries its own standing warnings, read; anything that has fallen due since the
    // session's instant was last read is new and stays unread across a reload.
    get().evaluateClocks();
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
    upsert(get, set, 'audit', entry);
  },
  signOut: () => {
    const session = { ...get().session, userId: null, breakGlass: [] };
    set({ session });
    writeJson(SESSION_KEY, session);
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
      synthetic: true,
      at: get().now().toISOString(),
      userId: u.id,
      userName: `${u.givenName} ${u.familyName}`,
      agency: u.agency,
      restricted: entry.restricted ?? false,
      ...entry,
      id: entry.id ?? get().newId('aud'),
    };
    upsert(get, set, 'audit', rec);
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
    const entry = get().audit({ act: 'break-glass', targetType: 'process', targetId: processId, targetLabel: p ? `${p.reference}: ${p.title}` : processId, processId, reason: `${category}: ${reason}`, restricted: true, expiresAt: grant.expiresAt });
    // The lead of the case that was opened, and the escrow holders who answer for emergency access,
    // are told. The person who broke the glass is not: they know.
    if (p && entry) notify(get, set, breakGlassNotifications(p, entry.id, ESCROW_HOLDERS.map((h) => ({ agency: h.agency, roleId: h.roleId }))), { actorUserId: entry.userId, process: p });
  },
  setLiveClock: (v) => {
    const session = { ...get().session, liveClock: v };
    set({ session });
    writeJson(SESSION_KEY, session);
    get().evaluateClocks();
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
    // The clocks are re-read against the new instant, which is the whole point of moving it: a
    // deadline the jump has passed raises its breach now rather than on the next reload.
    get().evaluateClocks();
  },
  resetDemoNow: () => {
    const session = { ...get().session, nowIso: DEMO_NOW_ISO };
    set({ session });
    writeJson(SESSION_KEY, session);
    get().evaluateClocks();
  },
  /**
   * Back to the seed, deterministically.
   *
   * The single most important recording affordance, because state drifting between takes is what
   * ruins a shoot. So it clears more than the records: the demo clock goes back to its seeded
   * instant and any break-glass grant is dropped, both of which are exactly the state you least
   * want carried into the next take. A grant is an audited emergency access with a four hour
   * window, and one left standing from the previous run would make the next one look like access
   * the reader simply had. Sign-in and appearance are kept, because those are the presenter's
   * settings rather than the demonstration's state.
   */
  resetDemo: () => {
    overlay = {};
    try {
      window.localStorage.removeItem(OVERLAY_KEY);
    } catch {
      /* ignore */
    }
    const seed = process.env.NEXT_PUBLIC_SEED ?? DEFAULT_SEED;
    const rebuilt = buildDataset({ seed });
    const session = { ...get().session, breakGlass: [], nowIso: DEMO_NOW_ISO, liveClock: false };
    writeJson(SESSION_KEY, session);
    set({ data: rebuilt, config: DEFAULT_CONFIG, vault: buildVault(rebuilt, DEFAULT_CONFIG), session });
    // Every notification went with the overlay; the seed's own come back with it, and at the seeded
    // instant the clocks have nothing new to say, so the overlay stays empty after a reset.
    get().evaluateClocks();
  },
  markNotificationRead: (id) => {
    const n = get().data.notifications.find((x) => x.id === id);
    if (!n || n.readAt) return;
    upsert(get, set, 'notifications', { ...n, readAt: get().now().toISOString() });
  },
  markAllNotificationsRead: () => {
    const user = get().currentUser();
    if (!user) return;
    const at = get().now().toISOString();
    for (const n of get().data.notifications) {
      if (!n.readAt && !n.dismissedAt && addressedTo(n, user)) upsert(get, set, 'notifications', { ...n, readAt: at });
    }
  },
  dismissNotification: (id) => {
    const n = get().data.notifications.find((x) => x.id === id);
    if (!n || n.dismissedAt) return;
    const at = get().now().toISOString();
    upsert(get, set, 'notifications', { ...n, readAt: n.readAt ?? at, dismissedAt: at });
  },
  evaluateClocks: () => {
    const { data, config } = get();
    const now = get().now();
    const drafts = clockNotifications(data.processes, { config, now });
    const actions = actionClockNotifications(data.actions, data.processes, { config, now });
    drafts.push(...actions.drafts);
    // The escalation is recorded on the action itself, so the Actions screen and the print pack say
    // it happened without consulting the notifications. The lead's name is the record of who to.
    for (const action of actions.escalate) {
      const lead = get().data.users.find((u) => u.id === get().data.processes.find((p) => p.id === action.processId)?.leadUserId);
      if (!lead) continue;
      upsert(get, set, 'actions', { ...action, escalatedAt: now.toISOString(), escalatedToName: `${lead.givenName} ${lead.familyName}` });
    }
    return notify(get, set, drafts, {}).length;
  },
  takeSnapshot: (name) => {
    const trimmed = name.trim();
    if (!trimmed) return;
    // Round-tripped rather than referenced, so a later write cannot reach back into the snapshot.
    const snapshot: DemoSnapshot = { name: trimmed, at: get().now().toISOString(), overlay: JSON.parse(JSON.stringify(overlay)) as Overlay, session: { ...get().session } };
    const snapshots = [snapshot, ...get().snapshots.filter((s) => s.name !== trimmed)];
    writeJson(SNAPSHOT_KEY, snapshots);
    set({ snapshots });
  },
  restoreSnapshot: (name) => {
    const snapshot = get().snapshots.find((s) => s.name === name);
    if (!snapshot) return;
    overlay = JSON.parse(JSON.stringify(snapshot.overlay)) as Overlay;
    writeJson(OVERLAY_KEY, overlay);
    const seed = process.env.NEXT_PUBLIC_SEED ?? DEFAULT_SEED;
    const data = applyOverlay(buildDataset({ seed }), overlay);
    const config = overlay.config ? { ...DEFAULT_CONFIG, ...overlay.config } : DEFAULT_CONFIG;
    const session = { ...snapshot.session };
    writeJson(SESSION_KEY, session);
    set({ data, config, vault: buildVault(data, config), session });
    get().evaluateClocks();
  },
  deleteSnapshot: (name) => {
    const snapshots = get().snapshots.filter((s) => s.name !== name);
    writeJson(SNAPSHOT_KEY, snapshots);
    set({ snapshots });
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

    // 3. Classification, which may be raised and never quietly lowered. The one deliberate lower is
    // the override a named role records with a reason (D-082): it arrives under its own act, having
    // already passed `overrideDecision`, and is the only write this check lets through.
    const existing = (data[request.collection] as Array<{ id: string }>).find((r) => r.id === (request.record as { id: string }).id);
    const downgrade = request.act === 'classification-lower' ? null : classificationRefusal(config, existing as ClassifiedRecord | undefined, request.record as ClassifiedRecord);
    if (downgrade) errors.push(downgrade);

    // 5. The exclusion register, before any recipient is added rather than after.
    let nearMatches: string[] = [];
    if (request.recipients && request.recipients.length > 0 && request.recipientProcess) {
      const check = excludedRecipients(request.recipientProcess, request.recipients, config, data.relationships);
      for (const name of check.refused) errors.push(`excluded:${name}`);
      nearMatches = check.nearMatches;
    }

    // 8, checked early. A share has to rest on a lawful basis and belong to a case, and a request
    // that cannot satisfy both is refused whole rather than leaving a share with nothing under it.
    const processId = request.processId ?? (request.collection === 'processes' ? (request.record as { id: string }).id : undefined);
    const processBefore = processId ? data.processes.find((p) => p.id === processId) : undefined;
    if ((request.sharingRecords ?? []).length > 0) {
      if (!request.lawfulBasis) errors.push('sharesNeedLawfulBasis');
      if (!processBefore && request.collection !== 'processes') errors.push('sharesNeedProcess');
    }

    if (errors.length > 0) return { ok: false, errors, nearMatches, effects };

    const at = get().now().toISOString();
    const byName = `${user.givenName} ${user.familyName}`;

    // 2b. The record's own version history, before it is written, so the entry describes this change
    // rather than being appended to a record that has already moved on.
    const version = versionFor(request.collection, existing, request.record, {
      at,
      byUserId: user.id,
      byName,
      reason: request.reason,
      change: request.versionChange,
      intent: request.intent,
    });

    // 10. Persist. Everything below this line has already been allowed to happen.
    upsert(get, set, request.collection, version ? withVersion(request.record as Correctable, version) as Dataset[typeof request.collection][number] : request.record);
    if (version) effects.push({ kind: 'version', detail: version.change });

    // 2. The audit entry, which every write has before it is useful. Restricted where the case is,
    // unless the caller says otherwise, so a MAPPA write is never ledgered in the open by omission.
    const restricted = request.restricted ?? processBefore?.accessRestriction === 'restricted';
    const audit = get().audit({
      id: request.auditId,
      act: request.act,
      targetType: request.targetType,
      targetId: (request.record as { id: string }).id,
      targetLabel: request.targetLabel,
      processId: request.processId,
      reason: request.reason,
      restricted,
    });
    if (audit) effects.push({ kind: 'audit', detail: audit.id });

    // 4. The wrap list, rebuilt where a process changed, because the entitled set can move with it.
    if (request.collection === 'processes') {
      set({ vault: buildVault(get().data, config) });
      effects.push({ kind: 'rewrap', detail: (request.record as { id: string }).id });
    }

    // 5, in reverse. A hand-recorded register entry added by this write is checked against every
    // name already on a list for the case, and both the update and any resemblance are ledgered.
    if (request.collection === 'processes') {
      const process = request.record as Process;
      const changes = registerChanges((existing as Process | undefined)?.parties, process.parties);
      if (changes.added + changes.updated > 0) {
        const label = registerUpdateLabel({ parties: process.parties, added: changes.added, updated: changes.updated }, request.targetLabel);
        get().audit({ act: 'edit', targetType: 'process', targetId: process.id, targetLabel: label, processId: process.id, restricted });
        effects.push({ kind: 'register', detail: String(changes.added + changes.updated) });
        for (const match of reverseNearMatches(changes.entries, listedNames(get().data, process.id))) {
          get().audit({
            act: 'edit',
            targetType: 'process',
            targetId: process.id,
            targetLabel: t('sharing.nearMatch.audit.reverse', { entry: match.entry.name ?? '', count: match.names.length }),
            processId: process.id,
            reason: match.entry.reason ?? '',
            restricted,
          });
          effects.push({ kind: 'nearMatch', detail: match.names.join('; ') });
        }
      }
    }

    // 6. Clocks: the triggers this write starts, and the transition it applies.
    effects.push(...startedClocks(config, request.clocks ?? [], get().now()));
    const clocksOn = request.clocksOn ?? processId;
    let clocks: WriteResult['clocks'];
    if (clocksOn && ((request.clocks ?? []).length > 0 || request.clockTransition)) {
      const process = get().data.processes.find((p) => p.id === clocksOn);
      if (process) {
        // The transition first, then the fresh triggers: a write that completes a rule and starts it
        // again from a new instant (a rescheduled meeting's notice period) names the completion in
        // the transition and the new trigger in `clocks`, and the order is what keeps them apart.
        let next = [...process.clocks];
        if (request.clockTransition) {
          const applied = applyClockTransition(next, request.clockTransition, at, get().newId);
          next = applied.clocks;
          clocks = { completed: applied.completed, started: applied.started };
          for (const ruleId of applied.completed) effects.push({ kind: 'clock', detail: t('processes.clocks.effectCompleted', { rule: clockRuleLabel(ruleId) }) });
          for (const ruleId of applied.started) effects.push({ kind: 'clock', detail: t('processes.clocks.effectStarted', { rule: clockRuleLabel(ruleId) }) });
        }
        const fresh = (request.clocks ?? []).filter((trigger) => !next.some((c) => c.id === trigger.id));
        next = [...next, ...fresh];
        if (next.length !== process.clocks.length || next.some((c, i) => c !== process.clocks[i])) upsert(get, set, 'processes', { ...process, clocks: next });
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
      upsert(get, set, 'events', event);
      effects.push({ kind: 'event', detail: event.id });
    }

    // 8. The sharing the matrix requires, each already carrying its lawful basis. The basis is
    // written first, because a share with nothing under it is the thing the matrix exists to stop;
    // the notifications the resolver names are reported beside them.
    let shares: SharingRecord[] | undefined;
    if (request.lawfulBasis) {
      upsert(get, set, 'lawfulBases', lawfulBasisFor(request.lawfulBasis, user, at));
    }
    const shareOn = request.collection === 'processes' ? (request.record as Process) : processBefore;
    if (request.lawfulBasis && shareOn && (request.sharingRecords ?? []).length > 0) {
      shares = [];
      for (const input of request.sharingRecords ?? []) {
        const share = sharingRecordFor(input, shareOn, request.lawfulBasis.id, user, at, input.id ?? get().newId('shr'));
        upsert(get, set, 'sharingRecords', share);
        shares.push(share);
        effects.push({ kind: 'share', detail: `${share.recipient.name}: ${share.reason}` });
      }
    }
    for (const share of request.shares ?? []) {
      effects.push({ kind: 'share', detail: `${share.recipientName}: ${share.reason}` });
    }

    // 8, second half: who is told (D-207). Derived from what this write changed, never composed by
    // a screen. The need-to-know rows for the stage arrive as the shares above, the write's own
    // effects (an assignment, an invitation, a distribution, a member joining, a stage moving) as
    // the difference between the record before and after, and the request flows as the requests
    // themselves. The same exclusion check that refuses a share recipient refuses a recipient here.
    const recordId = (request.record as { id: string }).id;
    const drafts: NotificationDraft[] = [];
    const written = get().data;
    if (request.collection === 'processes') {
      const after = written.processes.find((p) => p.id === recordId);
      if (after) drafts.push(...processNotifications(existing as Process | undefined, after, { config }));
    } else if (request.collection === 'actions') {
      const after = written.actions.find((a) => a.id === recordId);
      if (after) drafts.push(...actionNotifications(existing as Action | undefined, after, { meetings: written.meetings, plans: written.plans }));
    } else if (request.collection === 'meetings') {
      const after = written.meetings.find((m) => m.id === recordId);
      if (after) drafts.push(...meetingNotifications(existing as Meeting | undefined, after, written.sharingRecords));
    } else if (request.collection === 'informationRequests') {
      const after = written.informationRequests.find((r) => r.id === recordId);
      if (after) drafts.push(...informationRequestNotifications(existing as InformationRequest | undefined, after));
    } else if (request.collection === 'sharingRecords') {
      const after = written.sharingRecords.find((r) => r.id === recordId);
      if (after) {
        drafts.push(...sharingNotifications(existing as SharingRecord | undefined, after));
        // A share the recipient has marked read is a notification they have read.
        if (after.status === 'read' && (existing as SharingRecord | undefined)?.status !== 'read') {
          const n = written.notifications.find((x) => x.key === `share:${after.id}:${after.recipient.userId ?? ''}`);
          if (n && !n.readAt) upsert(get, set, 'notifications', { ...n, readAt: at });
        }
      }
    }
    for (const share of shares ?? []) drafts.push(...sharingNotifications(undefined, share));
    if (shareOn && (request.shares ?? []).length > 0) drafts.push(...matrixShareNotifications(request.shares ?? [], shareOn, recordId));
    const processNow = request.collection === 'processes' ? written.processes.find((p) => p.id === recordId) : processBefore;
    if (nearMatches.length > 0 && processNow) drafts.push(...nearMatchNotifications(processNow, at));
    for (const n of notify(get, set, drafts, { actorUserId: user.id, process: processNow })) effects.push({ kind: 'notification', detail: n.kind });
    // A write that can start a clock is followed by a reading of the clocks, so a deadline that is
    // already inside its window when it starts raises its warning now rather than on the next tick.
    if (request.collection === 'processes' || request.collection === 'actions' || request.clockTransition || (request.clocks ?? []).length > 0) get().evaluateClocks();

    // 9. Outbound connector proposals, into the outbox. Proposed only: nothing leaves without a
    // named person authorising it, with a purpose and a lawful basis, because a write into another
    // organisation's record is a disclosure and that is what a disclosure carries.
    for (const out of request.outbound ?? []) {
      const refusals = proposalRefusals({ connectorId: out.connectorId, intent: out.intent, payload: out.payload });
      if (refusals.length > 0) {
        // A connector that will not take this write is a fact about the far side, not a failure of
        // this write. The record is already saved; the proposal simply is not made, and the effect
        // list says so rather than leaving a practitioner believing something is on its way.
        effects.push({ kind: 'outbound', detail: t('connectors.outbox.notProposed', { connector: out.connectorId, reason: refusals[0]! }) });
        continue;
      }
      const proposal = proposeWrite({
        id: get().newId('out'),
        connectorId: out.connectorId,
        intent: out.intent,
        subjectPersonId: request.event?.subjectIds[0] ?? (request.record as { id: string }).id,
        processId: request.processId,
        payload: out.payload,
        at: get().now().toISOString(),
        byName: `${user.givenName} ${user.familyName}`,
        discriminator: out.discriminator,
      });
      // The same logical write proposed twice replaces rather than duplicates, which is what the
      // idempotency key is for and the first place it earns its keep.
      const held = get().data.outbox.find((w) => w.idempotencyKey === proposal.idempotencyKey && w.state === 'proposed');
      upsert(get, set, 'outbox', held ? { ...proposal, id: held.id } : proposal);
      effects.push({ kind: 'outbound', detail: `${out.connectorId}: ${out.summary}` });
    }

    return { ok: true, errors: [], nearMatches, effects, audit, clocks, shares };
  },
  receive: (record) => {
    const collection: Collection = 'kind' in record ? 'inbound' : 'connectorEvents';
    const errors = validateRecord(collection, record);
    if (errors.length > 0) return { ok: false, errors, duplicate: false };
    // The far side's own reference is the identity. A feed that replays delivers the same change
    // twice, and the second copy is not a second change.
    const held = (get().data[collection] as Array<{ id: string; externalRef: string; connectorId: string }>).find((r) => r.id !== record.id && r.externalRef === record.externalRef && r.connectorId === record.connectorId);
    if (held) return { ok: true, errors: [], duplicate: true };
    upsert(get, set, collection, record);
    // The agency whose inbox reviews the delivery is told it has arrived. A system delivery has no
    // actor, so nobody is left out for having caused it.
    if (collection === 'connectorEvents') notify(get, set, inboxNotifications(record as ConnectorEvent), {});
    return { ok: true, errors: [], duplicate: false };
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
    upsert(get, set, 'events', mergeEvent(get, user, result.merge, 'merged'));
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

    upsert(get, set, 'events', mergeEvent(get, user, merge, 'unmerged'));
    effects.push({ kind: 'event', detail: merge.id });

    return { ok: true, errors: [], nearMatches: [], effects, audit };
  },
  addToHousehold: (householdId, personId, from, note, notify) => {
    const { config, data } = get();
    const household = data.households.find((h) => h.id === householdId);
    const person = data.people.find((p) => p.id === personId);
    if (!household || !person) return { ok: false, errors: ['householdMissing'], nearMatches: [], effects: [] };
    if (membersOn(household, from).some((m) => m.personId === personId)) return { ok: false, errors: ['householdAlreadyMember'], nearMatches: [], effects: [] };

    const name = `${person.givenName} ${person.familyName}`;
    const address = data.addresses.find((a) => a.id === household.addressId);
    const line = address ? [address.line1, address.town, address.postcode].filter(Boolean).join(', ') : (household.label ?? householdId);
    const touched = processesTouchedByHousehold(data, householdId, from, [personId]);

    const result = get().write({
      collection: 'households',
      record: { ...household, members: [...household.members, { personId, from }] },
      intent: 'update',
      act: 'edit',
      targetType: 'person',
      targetLabel: name,
      rules: [],
      event: {
        eventType: 'household.change',
        significance: 'high',
        visibility: 'integrated',
        title: t('person.household.eventJoin', { name, address: line }),
        detail: note.trim() || t('person.household.eventJoinDetail', { name, address: line, date: from }),
        subjectIds: [personId, ...membersOn(household, from).map((m) => m.personId)],
        occurredAt: `${from}T00:00:00Z`,
        linkedProcessIds: touched.map((p) => p.id),
      },
      // Telling the case members is offered rather than assumed, and it generates the sharing
      // records with the lawful basis the matrix names rather than leaving it to memory.
      shares: notify ? touched.flatMap((process) => notifyShares(process, config, t('person.household.eventJoin', { name, address: line }))) : [],
    });
    if (!result.ok) return result;

    // The person's own record follows the household, and the address history keeps the move.
    upsert(get, set, 'people', {
      ...person,
      householdId,
      addressHistory: person.addressHistory.some((a) => a.addressId === household.addressId && a.from === from) ? person.addressHistory : [{ addressId: household.addressId, from }, ...person.addressHistory],
    });
    return result;
  },
  endHouseholdMembership: (householdId, personId, to, reason) => {
    const { data } = get();
    const household = data.households.find((h) => h.id === householdId);
    const person = data.people.find((p) => p.id === personId);
    if (!household || !person) return { ok: false, errors: ['householdMissing'], nearMatches: [], effects: [] };
    if (reason.trim().length < 5) return { ok: false, errors: ['householdEndReasonRequired'], nearMatches: [], effects: [] };
    const running = household.members.filter((m) => m.personId === personId && !m.to);
    if (running.length === 0) return { ok: false, errors: ['householdNotAMember'], nearMatches: [], effects: [] };

    const name = `${person.givenName} ${person.familyName}`;
    const touched = processesTouchedByHousehold(data, householdId, to);
    const result = get().write({
      collection: 'households',
      record: { ...household, members: household.members.map((m) => (m.personId === personId && !m.to ? { ...m, to, endedReason: reason.trim() } : m)) },
      intent: 'update',
      act: 'edit',
      targetType: 'person',
      targetLabel: name,
      reason,
      event: {
        eventType: 'household.change',
        significance: 'high',
        visibility: 'integrated',
        title: t('person.household.eventLeave', { name }),
        detail: t('person.household.eventLeaveDetail', { name, date: to, reason: reason.trim() }),
        subjectIds: [personId, ...membersOn(household, to).map((m) => m.personId)],
        occurredAt: `${to}T00:00:00Z`,
        linkedProcessIds: touched.map((p) => p.id),
      },
    });
    if (!result.ok) return result;

    // The membership ended, so the person's own address period ends with it and the link is cleared.
    upsert(get, set, 'people', {
      ...person,
      householdId: undefined,
      addressHistory: person.addressHistory.map((a) => (a.addressId === household.addressId && !a.to ? { ...a, to } : a)),
    });
    return result;
  },
  setHouseholdLabel: (householdId, label) => {
    const household = get().data.households.find((h) => h.id === householdId);
    if (!household) return { ok: false, errors: ['householdMissing'], nearMatches: [], effects: [] };
    if (label.trim() === '') return { ok: false, errors: ['householdLabelRequired'], nearMatches: [], effects: [] };
    return get().write({
      collection: 'households',
      record: { ...household, label: label.trim() },
      intent: 'update',
      act: 'edit',
      targetType: 'person',
      targetLabel: label.trim(),
    });
  },
  saveRelationship: (relationship, decisions = []) => {
    const { data } = get();
    const user = get().currentUser();
    if (!user) return { ok: false, errors: ['noUser'], nearMatches: [], effects: [] };
    if (relationship.fromPersonId === relationship.toPersonId) return { ok: false, errors: ['relationshipSelf'], nearMatches: [], effects: [] };

    const from = data.people.find((p) => p.id === relationship.fromPersonId);
    const to = data.people.find((p) => p.id === relationship.toPersonId);
    if (!from || !to) return { ok: false, errors: ['relationshipPersonMissing'], nearMatches: [], effects: [] };

    const duplicate = data.relationships.some((r) => r.id !== relationship.id && r.type === relationship.type && ((r.fromPersonId === relationship.fromPersonId && r.toPersonId === relationship.toPersonId) || (r.fromPersonId === relationship.toPersonId && r.toPersonId === relationship.fromPersonId)));
    if (duplicate) return { ok: false, errors: ['relationshipDuplicate'], nearMatches: [], effects: [] };

    const result = get().write({
      collection: 'relationships',
      record: relationship,
      intent: data.relationships.some((r) => r.id === relationship.id) ? 'update' : 'create',
      act: data.relationships.some((r) => r.id === relationship.id) ? 'edit' : 'create',
      targetType: 'person',
      targetLabel: `${from.givenName} ${from.familyName} and ${to.givenName} ${to.familyName}`,
      rules: [],
    });
    if (!result.ok) return result;
    applyDecisions(get, set, decisions);
    return result;
  },
  endRelationship: (relationshipId, to, reason, decisions) => {
    const { data } = get();
    const relationship = data.relationships.find((r) => r.id === relationshipId);
    if (!relationship) return { ok: false, errors: ['relationshipMissing'], nearMatches: [], effects: [] };
    if (reason.trim().length < 5) return { ok: false, errors: ['relationshipEndReasonRequired'], nearMatches: [], effects: [] };
    if (relationship.from && to < relationship.from) return { ok: false, errors: ['relationshipEndBeforeStart'], nearMatches: [], effects: [] };

    const a = data.people.find((p) => p.id === relationship.fromPersonId);
    const b = data.people.find((p) => p.id === relationship.toPersonId);
    const label = a && b ? `${a.givenName} ${a.familyName} and ${b.givenName} ${b.familyName}` : relationshipId;

    // Every exclusion the ending touches must be decided, and the decision is written before the
    // relationship is, so a refused decision cannot leave the exclusion resting on nothing (D-132).
    const resting = exclusionsRestingOn(data, get().config, relationshipId);
    const undecided = resting.filter((change) => !decisions.some((d) => d.processId === change.process.id && d.personId === change.personId));
    if (undecided.length > 0) return { ok: false, errors: ['relationshipExclusionUndecided'], nearMatches: [], effects: [] };
    applyDecisions(get, set, decisions);

    return get().write({
      collection: 'relationships',
      record: { ...relationship, to, notes: [relationship.notes, reason.trim()].filter(Boolean).join(' ') },
      intent: 'update',
      act: 'edit',
      targetType: 'person',
      targetLabel: label,
      reason,
    });
  },
  openProcess: (request) => {
    const { config, data } = get();
    const user = get().currentUser();
    if (!user) return { ok: false, errors: ['noUser'], nearMatches: [], effects: [] };

    const decision = canOpenProcess(user.roleId, request.type);
    if (!decision.allowed) return { ok: false, errors: ['processNotYourRole'], nearMatches: [], effects: [] };

    const subjects = request.subjectIds.map((id) => data.people.find((p) => p.id === id)).filter((p): p is Person => p !== undefined);
    if (subjects.length === 0) return { ok: false, errors: ['processNoSubject'], nearMatches: [], effects: [] };

    const now = get().now();
    for (const subject of subjects) {
      if (!eligibilityFor(request.type, subject, now).eligible) return { ok: false, errors: ['processNotEligible'], nearMatches: [], effects: [] };
    }

    // A second open case of the same type is possible and takes an explicit reason, because it is
    // the commonest bad create after a duplicate person record.
    const existing = request.subjectIds.flatMap((id) => openProcessesOfType(data, id, request.type));
    if (existing.length > 0 && (request.secondCaseReason ?? '').trim().length < 10) {
      return { ok: false, errors: ['processAlreadyOpen'], nearMatches: [], effects: [] };
    }

    const at = request.at || now.toISOString();
    const byName = `${user.givenName} ${user.familyName}`;
    const reference = nextReference(data.processes, request.type, now);
    const { classification, restricted } = openingClassification(request.type);
    const subjectNames = subjects.map((p) => `${p.givenName} ${p.familyName}`).join(', ');

    // The clocks the trigger starts, built before the record so a refused write leaves nothing
    // counting down against a case that does not exist.
    const clocks: ClockTrigger[] = openingClockRuleIds(request).map((ruleId) => ({ id: get().newId('clk'), ruleId, triggeredAt: at }));

    const withClocks = buildOpeningProcess(
      {
        id: get().newId('prc'),
        reference,
        title: t('processes.open.caseTitle', { process: processLabel(request.type), name: subjectNames }),
        subjectIds: request.subjectIds,
        leadAgency: user.agency,
        leadUserId: user.id,
        stage: OPENING_STAGE[request.type],
        stageHistory: [{ stage: OPENING_STAGE[request.type], at, byUserId: user.id, byName, note: request.summary }],
        classification,
        accessRestriction: restricted ? 'restricted' : 'none',
        members: [{ userId: user.id, caseRole: roleLabel(user.roleId), agency: user.agency, since: at.slice(0, 10), reason: t('processes.open.leadReason') }],
        clocks,
        openedAt: at,
      },
      { ...request, at, byName, byUserId: user.id },
    );

    const shares = notifyShares(withClocks, config, t('processes.open.shareReason', { reference, process: processLabel(request.type) }));

    // The episode, proposed into every connector that would actually accept one. This is what makes
    // the product operationally real rather than a parallel system practitioners have to remember to
    // update, and the connectors that would refuse it are not asked, so nothing is claimed.
    const outbound = connectorsForIntent('open-process', CONNECTOR_IDS).map((connectorId) => ({
      connectorId,
      intent: 'open-process' as const,
      payload: episodePayload(withClocks, byName),
      summary: t('connectors.outbox.proposedEpisode', { reference }),
    }));

    const result = get().write({
      collection: 'processes',
      record: withClocks,
      outbound,
      intent: 'create',
      act: 'create',
      targetType: 'process',
      targetLabel: reference,
      processId: withClocks.id,
      reason: request.secondCaseReason,
      clocks,
      clocksOn: withClocks.id,
      shares,
      event: {
        eventType: 'process.referral',
        significance: 'high',
        visibility: 'integrated',
        title: t('processes.open.eventTitle', { process: processLabel(request.type), reference }),
        detail: request.summary,
        subjectIds: request.subjectIds,
        occurredAt: at,
        linkedProcessIds: [withClocks.id],
      },
    });

    return result.ok ? { ...result, process: withClocks } : result;
  },
  closeProcess: (processId, input) => {
    const { config, data } = get();
    const user = get().currentUser();
    if (!user) return { ok: false, errors: ['noUser'], nearMatches: [], effects: [] };

    const process = data.processes.find((p) => p.id === processId);
    if (!process) return { ok: false, errors: ['processMissing'], nearMatches: [], effects: [] };

    const at = get().now().toISOString();
    const byName = `${user.givenName} ${user.familyName}`;
    const full: CloseInput = { ...input, at, byUserId: user.id, byName };
    const errors = closeRefusals(process, full);
    if (errors.length > 0) return { ok: false, errors, nearMatches: [], effects: [] };

    const { process: closed, stopped } = closeProcess(process, full);
    const reason = closureReasonsFor(process.type).find((r) => r.id === input.reasonId);

    const result = get().write({
      collection: 'processes',
      record: closed,
      intent: 'close',
      act: 'close',
      targetType: 'process',
      targetLabel: t('processes.close.audit', { reference: process.reference, reason: reason?.label ?? input.reasonId }),
      processId: process.id,
      reason: input.note,
      versionChange: t('processes.close.version', { reason: reason?.label ?? input.reasonId }),
      // A case closed here and left open in the source system is exactly the divergence the
      // reconciliation screen exists to catch, so the closure is proposed outbound like the opening.
      outbound: connectorsForIntent('close-process', CONNECTOR_IDS).map((connectorId) => ({
        connectorId,
        intent: 'close-process' as const,
        payload: closurePayload(closed),
        summary: t('connectors.outbox.proposedClosure', { reference: process.reference }),
      })),
      // Everybody the matrix entitles hears that the case has closed, at the level it names. A case
      // that closes silently leaves four agencies still working to a plan nobody is coordinating.
      shares: notifyShares(closed, config, t('processes.close.shareWhat')),
      event: {
        eventType: 'social-work.allocation',
        significance: 'high',
        visibility: 'integrated',
        title: t('processes.close.eventTitle', { process: processLabel(process.type), reference: process.reference }),
        detail: t('processes.close.eventDetail', { reason: reason?.label ?? input.reasonId, note: input.note.trim() }),
        subjectIds: process.subjectIds,
        occurredAt: at,
        linkedProcessIds: [process.id],
      },
    });

    return result.ok ? { ...result, stopped } : result;
  },
  reopenProcess: (processId, reason) => {
    const { data } = get();
    const user = get().currentUser();
    if (!user) return { ok: false, errors: ['noUser'], nearMatches: [], effects: [] };

    const process = data.processes.find((p) => p.id === processId);
    if (!process) return { ok: false, errors: ['processMissing'], nearMatches: [], effects: [] };

    const at = get().now().toISOString();
    const byName = `${user.givenName} ${user.familyName}`;
    const input = { reason, at, byUserId: user.id, byName };
    const errors = reopenRefusals(process, input);
    if (errors.length > 0) return { ok: false, errors, nearMatches: [], effects: [] };

    const { process: reopened, resumed } = reopenProcess(process, input);

    const result = get().write({
      collection: 'processes',
      record: reopened,
      intent: 'reopen',
      act: 'reopen',
      targetType: 'process',
      targetLabel: t('processes.reopen.audit', { reference: process.reference }),
      processId: process.id,
      reason,
      versionChange: t('processes.reopen.version'),
      event: {
        eventType: 'social-work.allocation',
        significance: 'high',
        visibility: 'integrated',
        title: t('processes.reopen.eventTitle', { process: processLabel(process.type), reference: process.reference }),
        detail: reason.trim(),
        subjectIds: process.subjectIds,
        occurredAt: at,
        linkedProcessIds: [process.id],
      },
    });

    return result.ok ? { ...result, resumed } : result;
  },
  recordInError: (collection, id, reason) => {
    const { data } = get();
    const user = get().currentUser();
    if (!user) return { ok: false, errors: ['noUser'], nearMatches: [], effects: [] };

    const record = (data[collection] as Array<Correctable & { id: string }>).find((r) => r.id === id);
    if (!record) return { ok: false, errors: ['recordMissing'], nearMatches: [], effects: [] };
    if (record.recordedInError) return { ok: false, errors: ['alreadyRecordedInError'], nearMatches: [], effects: [] };
    if (reason.trim().length < 5) return { ok: false, errors: ['reasonRequired'], nearMatches: [], effects: [] };

    const at = get().now().toISOString();
    const marked = withRecordedInError(record, { at, byUserId: user.id, byName: `${user.givenName} ${user.familyName}`, reason: reason.trim() });

    return get().write({
      collection,
      record: marked as Dataset[typeof collection][number],
      intent: 'recorded-in-error',
      act: 'recorded-in-error',
      targetType: TARGET_TYPES[collection],
      targetLabel: t('common.recordedInError.audit', { collection }),
      reason,
      versionChange: t('common.recordedInError.version'),
    });
  },
  recordDeath: (input) => {
    const { data } = get();
    const user = get().currentUser();
    if (!user) return { ok: false, errors: ['noUser'], nearMatches: [], effects: [] };

    const person = data.people.find((p) => p.id === input.personId);
    const now = get().now();
    const full: DeathInput = { ...input, recordedAt: now.toISOString(), byUserId: user.id, byName: `${user.givenName} ${user.familyName}` };
    const errors = deathRefusals(person, full, now.toISOString().slice(0, 10));
    if (errors.length > 0) return { ok: false, errors, nearMatches: [], effects: [] };

    const result = applyDeath(data, full);
    const name = `${result.person.givenName} ${result.person.familyName}`;

    // The person first, then each case as its own write. One audit entry covering four closures
    // would be a death nobody could trace through the cases it closed.
    const wrote = get().write({
      collection: 'people',
      record: result.person,
      intent: 'update',
      act: 'edit',
      targetType: 'person',
      targetLabel: t('person.death.audit', { name, date: input.at }),
      reason: input.note,
      versionChange: t('person.death.version'),
      event: {
        eventType: 'family.death',
        significance: 'high',
        visibility: 'integrated',
        title: t('person.death.eventTitle', { name }),
        detail: input.note.trim(),
        subjectIds: [input.personId],
        occurredAt: `${input.at}T00:00:00Z`,
      },
    });
    if (!wrote.ok) return wrote;

    const effects = [...wrote.effects];
    for (const closed of result.processes) {
      const consequence = result.consequences.find((c) => c.processId === closed.id);
      const one = get().closeProcess(closed.id, { reasonId: consequence?.reasonId ?? '', note: input.note });
      effects.push(...one.effects);
    }

    return { ...wrote, effects, consequences: result.consequences };
  },
  authoriseOutbound: (id, purpose, lawfulBasisId) => {
    const { data } = get();
    const user = get().currentUser();
    if (!user) return { ok: false, errors: ['noUser'], nearMatches: [], effects: [] };

    const write = data.outbox.find((w) => w.id === id);
    if (!write) return { ok: false, errors: ['outboxMissing'], nearMatches: [], effects: [] };

    const at = get().now().toISOString();
    const input = { at, byUserId: user.id, byName: `${user.givenName} ${user.familyName}`, purpose, lawfulBasisId };
    const errors = authorisationRefusals(write, input);
    if (errors.length > 0) return { ok: false, errors, nearMatches: [], effects: [] };

    /*
     * Composed and encrypted here, in the browser, from records this user can decrypt.
     *
     * This is the encryption boundary holding in the outbound direction. If the payload were
     * composed platform-side, the platform would hold plaintext for exactly the records it claims
     * never to see, and bidirectionality would be the hole in the story rather than a feature.
     * `packages/connectors/src/gateway.test.ts` asserts the relayed envelope carries none of it.
     */
    const authorised = authoriseWrite(write, input);
    const target = gatewayFor(write.connectorId);
    const envelope = encryptForGateway(target, write.connectorId, {
      id: write.id,
      idempotencyKey: write.idempotencyKey,
      payload: JSON.stringify(write.payload),
      submittedAt: at,
    });
    const relayed = platformViewOutbound(envelope);

    // Sent, then acknowledged by the far side with its own identifier. In the mockup the gateway
    // answers immediately; the two states are still kept apart, because sent is not confirmed and a
    // product that collapsed them would be teaching the wrong thing about the one that matters.
    const sent = markSent(authorised, at, relayed.ciphertextBytes);
    const suffix = write.idempotencyKey.split(':').at(-1)?.slice(-4).toUpperCase() ?? '0000';
    const done = markAcknowledged(sent, at, `${write.connectorId.toUpperCase()}-${suffix}`);

    return get().write({
      collection: 'outbox',
      record: done,
      intent: 'update',
      act: 'share',
      targetType: 'sharing',
      targetLabel: t('connectors.outbox.audit', { connector: write.connectorId, intent: outboundIntentLabel(write.intent) }),
      processId: write.processId,
      reason: purpose,
      versionChange: t('connectors.outbox.version'),
    });
  },
  parkOutbound: (id) => {
    const write = get().data.outbox.find((w) => w.id === id);
    if (!write) return { ok: false, errors: ['outboxMissing'], nearMatches: [], effects: [] };
    if (!canTransition(write.state, 'dead-letter')) return { ok: false, errors: ['outboxNotAuthorisable'], nearMatches: [], effects: [] };
    return get().write({
      collection: 'outbox',
      record: markDeadLetter(write),
      intent: 'update',
      act: 'edit',
      targetType: 'sharing',
      targetLabel: t('connectors.outbox.parkedAudit', { connector: write.connectorId }),
      processId: write.processId,
      versionChange: t('connectors.outbox.parkedVersion'),
    });
  },
  cancelOutbound: (id) => {
    const write = get().data.outbox.find((w) => w.id === id);
    if (!write) return { ok: false, errors: ['outboxMissing'], nearMatches: [], effects: [] };
    if (!canTransition(write.state, 'cancelled')) return { ok: false, errors: ['outboxNotAuthorisable'], nearMatches: [], effects: [] };
    return get().write({
      collection: 'outbox',
      record: { ...write, state: 'cancelled' },
      intent: 'update',
      act: 'edit',
      targetType: 'sharing',
      targetLabel: t('connectors.outbox.cancelledAudit', { connector: write.connectorId }),
      processId: write.processId,
      versionChange: t('connectors.outbox.cancelledVersion'),
    });
  },
  recordTransition: (processId, transitionId, input) => {
    const { config, data } = get();
    const user = get().currentUser();
    if (!user) return { ok: false, errors: ['noUser'], nearMatches: [], effects: [] };
    const process = data.processes.find((p) => p.id === processId);
    if (!process) return { ok: false, errors: ['processMissing'], nearMatches: [], effects: [] };
    const transition = transitionById(transitionId);
    if (!transition) return { ok: false, errors: ['transitionMissing'], nearMatches: [], effects: [] };
    const at = get().now().toISOString();
    const byName = `${user.givenName} ${user.familyName}`;
    const applied = applyTransition(process, transition, input, { at, actor: { userId: user.id, name: byName, roleId: user.roleId, agency: user.agency }, newId: get().newId, subjectName: subjectNameOf(get, process) });
    if (!applied.ok) return { ok: false, errors: applied.errors, nearMatches: [], effects: [], missing: applied.missing, permission: applied.permission };
    const { outcome } = applied;

    // The people the decision puts on the case, before the write, so the rewrap and the stage-change
    // notifications see them as members.
    let after = outcome.process;
    const joining = outcome.addMembers.filter((m) => !after.members.some((existing) => existing.userId === m.userId) && data.users.some((u) => u.id === m.userId));
    if (joining.length > 0) after = { ...after, members: [...after.members, ...joining.map((m) => ({ userId: m.userId, caseRole: m.caseRole, agency: m.agency, since: at.slice(0, 10), reason: t('processes.transitions.audit.member', { role: m.caseRole, reason: m.reason }) }))] };

    // Clocks: a rule that is completed and started in the same decision restarts through the
    // transition, which completes before it starts; everything else starts as a trigger of its own
    // with its own instant and owner.
    const completes = outcome.clocks.completes;
    const restarts = outcome.clocks.starts.filter((s) => completes.includes(s.ruleId)).map((s) => s.ruleId);
    const fresh: ClockTrigger[] = outcome.clocks.starts
      .filter((s) => !completes.includes(s.ruleId) && !after.clocks.some((c) => c.ruleId === s.ruleId && !c.completedAt))
      .map((s) => ({ id: get().newId('clk'), ruleId: s.ruleId, triggeredAt: s.triggeredAt ?? at, ownerUserId: s.ownerUserId, note: outcome.clocks.note }));
    const stageChanged = after.stage !== process.stage;
    const requests = outcome.followOn.filter((f): f is Extract<typeof f, { kind: 'requests' }> => f.kind === 'requests');
    const lawfulBasisId = requests.length > 0 ? get().newId('lb') : undefined;

    const result = get().write({
      collection: 'processes',
      record: after,
      intent: 'update',
      act: stageChanged ? 'stage-change' : 'edit',
      targetType: 'process',
      targetLabel: outcome.summary,
      processId: process.id,
      versionChange: t('processes.transitions.version', { transition: transitionLabel(transition.id) }),
      clocks: fresh,
      clockTransition: completes.length > 0 || restarts.length > 0 ? { completes, starts: restarts, note: outcome.clocks.note ?? outcome.summary } : undefined,
      event: {
        eventType: outcome.eventType,
        significance: 'high',
        visibility: 'integrated',
        title: transitionLabel(transition.id),
        detail: outcome.summary,
        subjectIds: after.subjectIds,
        occurredAt: at,
        linkedProcessIds: [after.id],
      },
      lawfulBasis: lawfulBasisId ? { id: lawfulBasisId, purpose: t('processes.transitions.lawfulBasis.purpose', { reference: after.reference, stage: stageLabel(after.type, after.stage) }), necessity: t('processes.transitions.lawfulBasis.necessity'), processes: [after] } : undefined,
      outbound:
        stageChanged && outcome.outbound === 'stage-change'
          ? connectorsForIntent('stage-change', CONNECTOR_IDS).map((connectorId) => ({ connectorId, intent: 'stage-change' as const, payload: stagePayload(after), summary: t('connectors.outbox.proposedStage', { reference: after.reference, stage: stageLabel(after.type, after.stage) }), discriminator: after.stage }))
          : undefined,
    });
    if (!result.ok) return { ...result, outcome };

    const created: NonNullable<TransitionRecordResult['created']> = { actionIds: [], requestIds: [] };
    const offers: Creates[] = [];
    let reschedule: string | undefined;
    const effects = [...result.effects];
    const current = () => get().data.processes.find((p) => p.id === process.id) ?? after;
    for (const follow of outcome.followOn) {
      switch (follow.kind) {
        case 'meeting': {
          const written = get().write({ collection: 'meetings', record: follow.meeting, intent: 'create', act: 'create', targetType: 'meeting', targetLabel: t('processes.transitions.audit.meeting', { title: follow.meeting.title }), processId: process.id, recipients: follow.meeting.invitees.filter((i) => i.userId).map((i) => ({ userId: i.userId, name: i.name })), recipientProcess: current() });
          if (written.ok) created.meetingId = follow.meeting.id;
          effects.push(...written.effects);
          break;
        }
        case 'plan': {
          const written = get().write({ collection: 'plans', record: follow.plan, intent: 'create', act: 'create', targetType: 'process', targetLabel: t('processes.transitions.audit.plan', { title: follow.plan.title }), processId: process.id });
          if (written.ok) created.planId = follow.plan.id;
          effects.push(...written.effects);
          for (const action of follow.actions) {
            const one = get().write({ collection: 'actions', record: action, intent: 'create', act: 'create', targetType: 'process', targetLabel: t('processes.transitions.audit.action', { title: action.title, owner: action.ownerName }), processId: process.id });
            if (one.ok) created.actionIds.push(action.id);
            effects.push(...one.effects);
          }
          break;
        }
        case 'plan-review': {
          const plan = get().data.plans.find((p) => p.id === follow.planId);
          if (plan) {
            const label = t('processes.transitions.audit.planReview', { date: follow.reviewDate });
            effects.push(...get().write({ collection: 'plans', record: { ...plan, reviewDate: follow.reviewDate, status: 'reviewed' }, intent: 'update', act: 'edit', targetType: 'process', targetLabel: label, processId: process.id, versionChange: label }).effects);
          }
          break;
        }
        case 'requests': {
          const now = current();
          follow.agencies.forEach((agency, i) => {
            const request: InformationRequest = {
              id: follow.ids[i] ?? get().newId('req'),
              synthetic: true,
              processId: process.id,
              subjectId: now.subjectIds[0]!,
              fromAgency: user.agency,
              fromName: byName,
              fromUserId: user.id,
              toAgency: agency,
              toName: agencyShort(agency),
              purpose: follow.purpose,
              fields: [],
              lawfulBasisId: lawfulBasisId!,
              classification: classificationFor(config, now),
              accessRestriction: now.accessRestriction,
              status: 'open',
              createdAt: at,
              dueAt: follow.dueAt,
            };
            const one = get().write({ collection: 'informationRequests', record: request, intent: 'create', act: 'share', targetType: 'sharing', targetLabel: t('processes.transitions.audit.request', { agency: agencyShort(agency), purpose: follow.purpose }), processId: process.id });
            if (one.ok) created.requestIds.push(request.id);
            effects.push(...one.effects);
          });
          break;
        }
        case 'request-response': {
          const request = get().data.informationRequests.find((r) => r.id === follow.requestId);
          if (request && request.status === 'open') {
            const label = t('processes.transitions.audit.response', { summary: follow.text });
            effects.push(...get().write({ collection: 'informationRequests', record: { ...request, status: 'responded', response: { at, byName, text: follow.text, fieldsProvided: [] } }, intent: 'update', act: 'share', targetType: 'sharing', targetLabel: label, processId: process.id, versionChange: label }).effects);
          }
          break;
        }
        case 'close': {
          const closed = get().closeProcess(process.id, { reasonId: follow.reasonId, note: follow.note });
          effects.push(...closed.effects);
          if (!closed.ok) return { ...result, ok: false, errors: closed.errors, effects, outcome };
          break;
        }
        case 'open-process': {
          const opened = get().openProcess({ type: follow.type, subjectIds: follow.subjectIds, at, source: follow.source, sourceAgency: user.agency, summary: follow.summary, byName, byUserId: user.id });
          effects.push(...opened.effects);
          if (opened.ok && opened.process) {
            created.processId = opened.process.id;
            const parent = current();
            const links = parent.type === 'marac' ? { ...parent, detail: { ...parent.detail, links: { ...parent.detail.links, cpProcessId: opened.process.id } }, linkedProcessIds: [...parent.linkedProcessIds, opened.process.id] } : { ...parent, linkedProcessIds: [...parent.linkedProcessIds, opened.process.id] };
            const label = t('processes.transitions.audit.link', { reference: opened.process.reference });
            effects.push(...get().write({ collection: 'processes', record: links, intent: 'update', act: 'edit', targetType: 'process', targetLabel: label, processId: process.id, versionChange: label }).effects);
            const child = get().data.processes.find((p) => p.id === opened.process!.id);
            if (child) effects.push(...get().write({ collection: 'processes', record: { ...child, linkedProcessIds: [...child.linkedProcessIds, process.id] }, intent: 'update', act: 'edit', targetType: 'process', targetLabel: t('processes.transitions.audit.link', { reference: parent.reference }), processId: child.id, versionChange: t('processes.transitions.audit.link', { reference: parent.reference }) }).effects);
          }
          break;
        }
        case 'birth': {
          const person = get().data.people.find((p) => p.id === follow.personId);
          if (person) {
            const label = t('processes.transitions.audit.birth', { date: follow.bornAt.slice(0, 10) });
            effects.push(...get().write({ collection: 'people', record: { ...person, lifeStage: 'child', dateOfBirth: follow.bornAt.slice(0, 10) }, intent: 'update', act: 'edit', targetType: 'person', targetLabel: label, reason: label, versionChange: label }).effects);
          }
          break;
        }
        case 'offer':
          offers.push(follow.creates);
          break;
        case 'reschedule':
          reschedule = follow.meetingId;
          break;
      }
    }
    // The meeting the decision was recorded from is held by the same decision. Its outcome lives on
    // the case; the meeting says which transition it fired and when, opens its minute, and says so
    // when the decision was that it was inquorate and has to be reconvened.
    const firedFromId = transition.firedBy && typeof (input as { meetingId?: unknown } | null)?.meetingId === 'string' ? (input as { meetingId: string }).meetingId : undefined;
    const firedFrom = firedFromId ? get().data.meetings.find((m) => m.id === firedFromId) : undefined;
    if (firedFrom && firedFrom.status !== 'held' && firedFrom.status !== 'cancelled') {
      const inquorate = reschedule === firedFrom.id;
      const label = inquorate ? t('meetings.audit.inquorate', { title: firedFrom.title }) : t('meetings.audit.held', { title: firedFrom.title });
      const held = get().write({
        collection: 'meetings',
        record: { ...firedFrom, status: 'held', heldAt: at, transitionId: transition.id, minute: firedFrom.minute.status === 'not-started' ? { ...firedFrom.minute, status: 'draft', draftedAt: at } : firedFrom.minute, inquorate: inquorate ? { at, reason: outcome.summary } : firedFrom.inquorate },
        intent: 'update',
        act: 'edit',
        targetType: 'meeting',
        targetLabel: label,
        processId: process.id,
        versionChange: label,
      });
      effects.push(...held.effects);
    }
    return { ...result, effects, outcome, created, offers, reschedule };
  },
  scheduleMeeting: (processId, type, input) => {
    const user = get().currentUser();
    if (!user) return { ok: false, errors: ['noUser'], nearMatches: [], effects: [] };
    const process = get().data.processes.find((p) => p.id === processId);
    if (!process) return { ok: false, errors: ['processMissing'], nearMatches: [], effects: [] };
    if (process.status !== 'open') return { ok: false, errors: ['processNotOpen'], nearMatches: [], effects: [] };
    const route = scheduleRoute(process, type);
    if (route.kind === 'refused') return { ok: false, errors: [route.code], nearMatches: [], effects: [] };
    const { reconvenes, ...schedule } = input;
    const result = route.kind === 'transition' ? get().recordTransition(processId, route.transition.id, schedule) : scheduleOutsideTheEngine(get, process, type, schedule);
    // A meeting reconvening an inquorate one is written back onto the one it replaces.
    const previous = reconvenes ? get().data.meetings.find((m) => m.id === reconvenes) : undefined;
    if (result.ok && result.created?.meetingId && previous?.inquorate) {
      const label = t('meetings.audit.reconvened', { title: previous.title });
      result.effects.push(...get().write({ collection: 'meetings', record: { ...previous, inquorate: { ...previous.inquorate, reconvenedMeetingId: result.created.meetingId } }, intent: 'update', act: 'edit', targetType: 'meeting', targetLabel: label, processId: process.id, versionChange: label }).effects);
    }
    return result;
  },
  rescheduleMeeting: (meetingId, change) => {
    const user = get().currentUser();
    if (!user) return { ok: false, errors: ['noUser'], nearMatches: [], effects: [] };
    const meeting = get().data.meetings.find((m) => m.id === meetingId);
    if (!meeting) return { ok: false, errors: ['meetingMissing'], nearMatches: [], effects: [] };
    if (meeting.status !== 'scheduled') return { ok: false, errors: ['meetingNotScheduled'], nearMatches: [], effects: [] };
    const errors: string[] = [];
    if (!change.scheduledAt) errors.push('meetingDateRequired');
    if (change.reason.trim().length < 5) errors.push('rescheduleReasonRequired');
    if (errors.length > 0) return { ok: false, errors, nearMatches: [], effects: [] };
    const at = get().now().toISOString();
    const byName = `${user.givenName} ${user.familyName}`;
    const label = t('meetings.audit.rescheduled', { title: meeting.title, date: formatDate(change.scheduledAt), reason: change.reason });
    const notice = noticeClockFor(get, meeting);
    return get().write({
      collection: 'meetings',
      record: { ...meeting, scheduledAt: change.scheduledAt, location: change.location.trim() || meeting.location, reschedules: [...(meeting.reschedules ?? []), { from: meeting.scheduledAt, to: change.scheduledAt, fromLocation: meeting.location, reason: change.reason, at, byName, byUserId: user.id }] },
      intent: 'update',
      act: 'edit',
      targetType: 'meeting',
      targetLabel: label,
      processId: meeting.processId,
      reason: change.reason,
      versionChange: label,
      // A notice period counts back from the meeting, so it moves with it: the running one is
      // completed and a fresh one starts from the new date.
      clockTransition: notice ? { completes: [notice], note: t('meetings.change.clockMoved', { date: formatDate(change.scheduledAt) }) } : undefined,
      clocks: notice ? [{ id: get().newId('clk'), ruleId: notice, triggeredAt: change.scheduledAt, note: t('meetings.change.clockMoved', { date: formatDate(change.scheduledAt) }) }] : undefined,
    });
  },
  cancelMeeting: (meetingId, reason) => {
    const user = get().currentUser();
    if (!user) return { ok: false, errors: ['noUser'], nearMatches: [], effects: [] };
    const meeting = get().data.meetings.find((m) => m.id === meetingId);
    if (!meeting) return { ok: false, errors: ['meetingMissing'], nearMatches: [], effects: [] };
    if (meeting.status !== 'scheduled') return { ok: false, errors: ['meetingNotScheduled'], nearMatches: [], effects: [] };
    if (reason.trim().length < 5) return { ok: false, errors: ['meetingCancelReasonRequired'], nearMatches: [], effects: [] };
    const at = get().now().toISOString();
    const label = t('meetings.audit.cancelled', { title: meeting.title, reason });
    const notice = noticeClockFor(get, meeting);
    return get().write({
      collection: 'meetings',
      record: { ...meeting, status: 'cancelled', cancelledAt: at, cancelReason: reason },
      intent: 'update',
      act: 'edit',
      targetType: 'meeting',
      targetLabel: label,
      processId: meeting.processId,
      reason,
      versionChange: label,
      clockTransition: notice ? { completes: [notice], note: t('meetings.change.clockCancelled') } : undefined,
    });
  },
  holdMeeting: (meetingId, note) => {
    const user = get().currentUser();
    if (!user) return { ok: false, errors: ['noUser'], nearMatches: [], effects: [] };
    const meeting = get().data.meetings.find((m) => m.id === meetingId);
    if (!meeting) return { ok: false, errors: ['meetingMissing'], nearMatches: [], effects: [] };
    if (meeting.status !== 'scheduled' && meeting.status !== 'in-progress') return { ok: false, errors: ['meetingNotScheduled'], nearMatches: [], effects: [] };
    const process = get().data.processes.find((p) => p.id === meeting.processId);
    if (!process) return { ok: false, errors: ['processMissing'], nearMatches: [], effects: [] };
    // A meeting whose type fires a transition from this stage is held by that transition, so its
    // outcome is recorded once and on the case. This path is for the meetings the engine has no
    // view of, and it refuses the others rather than holding them with nothing decided.
    if (heldTransitionFor(process, meeting.type)) return { ok: false, errors: ['meetingHeldByTransition'], nearMatches: [], effects: [] };
    const at = get().now().toISOString();
    const label = t('meetings.audit.held', { title: meeting.title });
    return get().write({
      collection: 'meetings',
      record: { ...meeting, status: 'held', heldAt: at, minute: meeting.minute.status === 'not-started' ? { ...meeting.minute, status: 'draft', draftedAt: at } : meeting.minute },
      intent: 'update',
      act: 'edit',
      targetType: 'meeting',
      targetLabel: label,
      processId: meeting.processId,
      reason: note.trim() || undefined,
      versionChange: label,
    });
  },
  acceptInbound: (id) => {
    const { data } = get();
    const user = get().currentUser();
    if (!user) return { ok: false, errors: ['noUser'], nearMatches: [], effects: [] };

    const change = data.inbound.find((c) => c.id === id);
    if (!change) return { ok: false, errors: ['inboundMissing'], nearMatches: [], effects: [] };
    if (change.status !== 'pending') return { ok: false, errors: ['inboundAlreadyReviewed'], nearMatches: [], effects: [] };

    // An inbound change carrying an origin we issued is our own write coming back. Accepting it
    // would create a duplicate process and, with a feed running, a loop. So it is reconciled against
    // the write that produced it and never opened as a second case.
    const echo = echoedWrite(change, data.outbox);
    const at = get().now().toISOString();
    if (echo) {
      return get().write({
        collection: 'inbound',
        record: { ...change, status: 'reconciled', reviewedAt: at, reviewedByName: `${user.givenName} ${user.familyName}`, processId: echo.processId },
        intent: 'update',
        act: 'edit',
        targetType: 'inbox',
        targetLabel: t('connectors.inbound.echoAudit', { reference: change.externalRef }),
        versionChange: t('connectors.inbound.echoVersion'),
      });
    }

    if (!change.subjectPersonId) return { ok: false, errors: ['inboundNoSubject'], nearMatches: [], effects: [] };
    const type = inboundProcessType(change);
    if (!type) return { ok: false, errors: ['inboundNoType'], nearMatches: [], effects: [] };

    const opened = get().openProcess({
      type,
      subjectIds: [change.subjectPersonId],
      // The source system is the referrer, and its own reference is carried so the two records are
      // linked by something the far side recognises rather than by a name and a date.
      source: t('connectors.inbound.source', { system: change.connectorId }),
      sourceAgency: CONNECTOR_AGENCY[change.connectorId],
      sourceReference: change.externalRef,
      summary: t('connectors.inbound.openSummary', { system: change.connectorId, reference: change.externalRef }),
      at,
      byName: `${user.givenName} ${user.familyName}`,
      byUserId: user.id,
      // A case opened in the source system is not opened again for a person who already has one:
      // the reference from the far side is the reason a second is allowed, and it is on the record.
      secondCaseReason: t('connectors.inbound.secondCaseReason', { reference: change.externalRef }),
    });
    if (!opened.ok) return opened;

    const wrote = get().write({
      collection: 'inbound',
      record: { ...change, status: 'accepted', reviewedAt: at, reviewedByName: `${user.givenName} ${user.familyName}`, processId: opened.process?.id },
      intent: 'update',
      act: 'promote',
      targetType: 'inbox',
      targetLabel: t('connectors.inbound.acceptAudit', { reference: change.externalRef }),
      processId: opened.process?.id,
      versionChange: t('connectors.inbound.acceptVersion'),
    });
    return wrote.ok ? { ...wrote, process: opened.process } : wrote;
  },
  declineInbound: (id, reason) => {
    const user = get().currentUser();
    if (!user) return { ok: false, errors: ['noUser'], nearMatches: [], effects: [] };
    const change = get().data.inbound.find((c) => c.id === id);
    if (!change) return { ok: false, errors: ['inboundMissing'], nearMatches: [], effects: [] };
    if (change.status !== 'pending') return { ok: false, errors: ['inboundAlreadyReviewed'], nearMatches: [], effects: [] };
    if (reason.trim().length < 10) return { ok: false, errors: ['inboundDeclineReasonRequired'], nearMatches: [], effects: [] };

    return get().write({
      collection: 'inbound',
      record: { ...change, status: 'declined', reviewedAt: get().now().toISOString(), reviewedByName: `${user.givenName} ${user.familyName}`, declineReason: reason.trim() },
      intent: 'update',
      act: 'edit',
      targetType: 'inbox',
      targetLabel: t('connectors.inbound.declineAudit', { reference: change.externalRef }),
      reason,
      versionChange: t('connectors.inbound.declineVersion'),
    });
  },
  newId: (prefix) => {
    counter += 1;
    return `${prefix}_u${Date.now().toString(36)}${counter.toString(36)}`;
  },
}));

/**
 * The people the need-to-know matrix says must hear about a change, each with its lawful basis.
 *
 * The matrix already answers "who is entitled to know, at what level of detail, on what basis", so a
 * household change offering to tell the case members means running it rather than writing a second
 * list that would drift from the first. Excluded parties are never in the answer, because the
 * resolver takes the exclusions with it.
 */
function notifyShares(process: Process, config: Config, what: string): WriteShare[] {
  const resolution = resolveNeedToKnow(contextFor(process), config.needToKnow, config.exclusions);
  return resolution.recipients.map((recipient) => ({
    recipientName: recipient.label,
    reason: t('person.household.shareReason', { what, process: process.reference, level: detailLevelLabel(recipient.detailLevel) }),
    lawfulBasisId: recipient.lawfulBasisHint,
  }));
}

/**
 * Write the exclusion decisions a relationship change carries onto the processes they belong to.
 *
 * A decision that the exclusion stands is not a no-op. It moves the entry from being derived from a
 * relationship record to being written down with a name, a date and a reason on it, so it survives
 * whatever happens to the relationship next. A decision that it does not stand suppresses the
 * derived entry, and it is the only thing that does.
 */
function applyDecisions(get: () => AppState, set: Setter, decisions: PartyDecision[]): void {
  const user = get().currentUser();
  if (!user || decisions.length === 0) return;
  const byName = `${user.givenName} ${user.familyName}`;
  const on = get().now().toISOString().slice(0, 10);
  for (const decision of decisions) {
    const data = get().data;
    const process = data.processes.find((p) => p.id === decision.processId);
    if (!process) continue;
    const existing = partyRegister(process, data.relationships).find((p) => p.personId === decision.personId);
    if (!existing) continue;
    const entry = decision.stands
      ? { ...existing, source: 'manual' as const, stands: true, decidedAt: `${on}T00:00:00Z`, decidedByName: byName, decisionReason: decision.reason }
      : { ...existing, source: 'manual' as const, stands: false, decidedAt: `${on}T00:00:00Z`, decidedByName: byName, decisionReason: decision.reason };
    upsert(get, set, 'processes', { ...process, parties: withPartyEntry(process.parties, entry) });
    get().audit({
      act: 'edit',
      targetType: 'process',
      targetId: process.id,
      targetLabel: process.reference,
      processId: process.id,
      reason: decision.stands ? t('person.network.exclusionStandsAudit', { reason: decision.reason }) : t('person.network.exclusionLiftedAudit', { reason: decision.reason }),
    });
  }
}

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

/**
 * Who the screen is being drawn for.
 *
 * Usually the person signed in. Inside a two-persona panel it is that panel's persona, which is why
 * every screen works there without knowing a panel exists (lib/viewAs.tsx).
 */
export function useCurrentUser(): User | null {
  const viewAs = useViewAs();
  const sessionId = useAppStore((s) => s.session.userId);
  const users = useAppStore((s) => s.data.users);
  const id = viewAs ?? sessionId;
  return id ? (users.find((u) => u.id === id) ?? null) : null;
}

/**
 * The break-glass grants that apply to this screen.
 *
 * A grant is recorded against a process and a moment, not against a user, because the session it
 * belongs to is the only one that can hold it. That is fine until a screen is drawn for somebody
 * else: a grant Moira took on the MAPPA would otherwise open the record for every persona a panel
 * is set to, and the two-persona view would be demonstrating the opposite of what it claims. So a
 * panel drawn for anybody but the signed-in user holds none.
 */
export function useGrants(): BreakGlassGrant[] {
  const viewAs = useViewAs();
  const userId = useAppStore((s) => s.session.userId);
  const grants = useAppStore((s) => s.session.breakGlass);
  return viewAs && viewAs !== userId ? EMPTY_GRANTS : grants;
}

const EMPTY_GRANTS: BreakGlassGrant[] = [];

export function useNow(): Date {
  const live = useAppStore((s) => s.session.liveClock);
  const nowIso = useAppStore((s) => s.session.nowIso);
  return live ? new Date() : parseDemoNow(nowIso);
}

/** The notice clock a meeting of this type carries, where the process has one running. */
function noticeClockFor(get: () => AppState, meeting: Meeting): string | undefined {
  if (meeting.type !== 'cppm' && meeting.type !== 'pre-birth-cppm' && meeting.type !== 'cppm-review') return undefined;
  const process = get().data.processes.find((p) => p.id === meeting.processId);
  return process?.clocks.some((c) => c.ruleId === 'cp.cppm.notice' && !c.completedAt) ? 'cp.cppm.notice' : undefined;
}

/**
 * A meeting the engine has no view of at this stage: written through the pipeline like any other
 * record, the invitees checked against the register and told, and nothing on the case moved.
 */
function scheduleOutsideTheEngine(get: () => AppState, process: Process, type: MeetingType, input: ScheduleInput): TransitionRecordResult {
  const user = get().currentUser()!;
  const errors = validateSchedule(input);
  if (errors.length > 0) return { ok: false, errors, nearMatches: [], effects: [] };
  const at = get().now().toISOString();
  const meeting = buildMeeting(process, type, t('meetings.schedule.plainTitle', { type: meetingTypeLabel(type), title: subjectNameOf(get, process) }), input, { at, actor: { userId: user.id, name: `${user.givenName} ${user.familyName}`, roleId: user.roleId, agency: user.agency }, newId: get().newId });
  const result = get().write({
    collection: 'meetings',
    record: meeting,
    intent: 'create',
    act: 'create',
    targetType: 'meeting',
    targetLabel: t('processes.transitions.audit.meeting', { title: meeting.title }),
    processId: process.id,
    recipients: meeting.invitees.filter((i) => i.userId).map((i) => ({ userId: i.userId, name: i.name })),
    recipientProcess: process,
  });
  return { ...result, created: result.ok ? { meetingId: meeting.id, actionIds: [], requestIds: [] } : undefined };
}

/** The name a meeting or a plan on this case is titled after: the first subject, or the case title where there is none. */
function subjectNameOf(get: () => AppState, process: Process): string {
  const person = get().data.people.find((p) => p.id === process.subjectIds[0]);
  return person ? `${person.givenName} ${person.familyName}` : process.title;
}
