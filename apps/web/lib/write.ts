'use client';

import { classificationFor, classificationRank, computeClock, datasetSchema, findClockRule, isExcludedParty, mostRestrictedAccess, mostSensitiveClassification, nearMatchesOnList, nearMatchesOnRegister, normalisePartyName, workingCalendarFrom, type Agency, type AuditEntry, type CaseParty, type Classification, type ClassifiedRecord, type ChronologyEvent, type ClockTrigger, type Config, type Dataset, type DetailLevel, type LawfulBasisRecord, type NotificationRole, type Process, type ProcessType, type SharingRecord, type User } from '@mas/domain';
import { warrantsVersion, type ConnectorId, type OutboundIntent, type PayloadField, type RecordVersion } from '@mas/domain';
import type { Collection } from '@/lib/store';

/**
 * One write pipeline, which every create and update goes through.
 *
 * `docs/FUNCTIONALITY-AUDIT.md` counted twenty-nine places that mutated the store and forty-seven
 * that wrote an audit entry, and no rule connecting the two. That is how a product grows a fifteenth
 * create path that forgets to start a clock, and the failure is silent: the record is there, the
 * screen looks right, and the statutory deadline nobody is counting arrives anyway.
 *
 * So the consequences of a write live here rather than at each call site, and `docs/RECORDS.md`
 * section 7 lists them in order. A caller says what it is writing and why; the pipeline decides what
 * else must happen. Everything it does is reported back in the result, so a screen can show the
 * consequences rather than the caller having to know them: "one clock started, one chronology event
 * written, three people now entitled to read this" is what a practitioner needs to see after
 * pressing Save, and it is also what makes the pipeline's work checkable.
 */

/** Why the write is happening, which decides which consequences apply. */
export type WriteIntent = 'create' | 'update' | 'correct' | 'close' | 'reopen' | 'recorded-in-error';

export interface WriteEvent {
  /**
   * A significant event, per the list in docs/RECORDS.md. A corrected typo is not one.
   *
   * The caller says what kind of event it is and how significant, because it knows: an address move
   * is `move.address` and a household change is `household.change`, and a pipeline that guessed
   * would be filing every write under one taxonomy entry. What the pipeline enforces is that the
   * event is written at all, with the right author, agency and timestamp, and linked to the process.
   */
  eventType: ChronologyEvent['eventType'];
  significance: ChronologyEvent['significance'];
  visibility?: ChronologyEvent['visibility'];
  title: string;
  detail: string;
  subjectIds: string[];
  occurredAt?: string;
  linkedProcessIds?: string[];
}

export interface WriteShare {
  recipientUserId?: string;
  /** Where the matrix names a role rather than a person, so the notification reaches every holder. */
  toRole?: NotificationRole;
  recipientName: string;
  reason: string;
  /** The level the recipient is told at. Defaults to summary. */
  detailLevel?: DetailLevel;
  /** The lawful basis this share rests on. A share without one is not written. */
  lawfulBasisId: string;
}

export interface WriteOutbound {
  connectorId: ConnectorId;
  intent: OutboundIntent;
  /** The payload in the target system's own field names, already mapped. */
  payload: PayloadField[];
  /** What is proposed, in one line, for the effect list and the audit entry. */
  summary: string;
  /** Distinguishes two writes of the same intent about the same record, for the idempotency key. */
  discriminator?: string;
}

export interface WriteRequest<K extends Collection = Collection> {
  collection: K;
  record: Dataset[K][number];
  intent: WriteIntent;
  /** The audit act. Every write is audited before it is useful. */
  act: AuditEntry['act'];
  targetType: AuditEntry['targetType'];
  targetLabel: string;
  /** Required where the intent is a correction, a closure or a recorded-in-error. */
  reason?: string;
  processId?: string;
  /** Business rules the Zod schema cannot express. Any string returned refuses the write. */
  rules?: string[];
  /** Clock triggers this write starts, per the rule table. */
  clocks?: ClockTrigger[];
  /** The process the clocks attach to. Defaults to `processId`. */
  clocksOn?: string;
  /** A chronology event, where the change is a significant one and not otherwise. */
  event?: WriteEvent;
  /** Sharing the need-to-know matrix requires, each already carrying its lawful basis. */
  shares?: WriteShare[];
  /** Recipients being added, checked against the exclusion register before anything is written. */
  recipients?: Array<{ personId?: string; userId?: string; name?: string }>;
  /** The process the recipients are being added to, which is what an exclusion is keyed on. */
  recipientProcess?: Process;
  /** Outbound connector proposals. The outbox and its authorisation are step 14 (D-113). */
  outbound?: WriteOutbound[];
  /**
   * What changed, in a phrase, for the record's own version history.
   *
   * Optional because the pipeline can work it out: it diffs the record against the one already held
   * and names the fields that moved. A caller supplies one where the phrase a person would use is
   * not that list, which is most of the time: "Case closed" reads better than "status, closedAt,
   * closureReason, stage and clocks changed".
   */
  versionChange?: string;
  /**
   * Whether the audit entry is a restricted one. Left unset, the pipeline reads it off the process
   * the write belongs to, which is what every caller was computing by hand.
   */
  restricted?: boolean;
  /**
   * The id the audit entry will carry, allocated by the caller with `newId('aud')`.
   *
   * For the one case where the record has to cite its own audit entry: a classification override
   * keeps the id of the entry that authorised it (D-082). The entry is written after the record, so
   * the caller cannot learn the id from the result; it names it instead.
   */
  auditId?: string;
  /**
   * A lawful basis to write beside the record, for a share or for a chronology entry raised to the
   * integrated view. Built here from the purpose and the necessity a person typed, so the article
   * 6, 9 and 10 conditions and the statutory gateway come from one rule rather than three copies.
   */
  lawfulBasis?: LawfulBasisInput;
  /**
   * Sharing records to write, each at a recipient's detail level, resting on `lawfulBasis`. The
   * classification is captured from the process at the moment of the share (D-085), the author and
   * the time from the session, and nothing here can be written without a basis to rest on.
   */
  sharingRecords?: SharingInput[];
  /**
   * Clocks this write completes or starts on the process, beyond the triggers in `clocks`. A meeting
   * held names its type and the transition table decides; a distributed minute names the rule it
   * completes. Applied here so a screen never recomputes a clock list and writes it back.
   */
  clockTransition?: ClockTransition;
}

/** What a lawful basis record is built from. Everything else follows from the processes it covers. */
export interface LawfulBasisInput {
  /** Allocated by the caller, so the record resting on it can name it before either is written. */
  id: string;
  purpose: string;
  necessity: string;
  /** The processes the information belongs to. Decides the gateway, the classification and article 10. */
  processes: readonly Process[];
  /** The agency whose information it is, where that is not the author's own. */
  agency?: Agency;
}

/** A share the pipeline writes, at the recipient's detail level, resting on the request's lawful basis. */
export interface SharingInput {
  /** Allocated by the caller where another record has to cite it, such as a distribution entry. */
  id?: string;
  recipient: SharingRecord['recipient'];
  detailLevel: DetailLevel;
  fields?: string[];
  reason: string;
  summary: string;
  /** Sent at once, or queued for a person to send. Defaults to sent. */
  status?: 'queued' | 'sent';
  needToKnowRowId?: string;
}

/**
 * The rule ids a write completes and starts on its process, and the instant it does so. The stage
 * engine's tables decide these for a transition (D-211, D-213); a distributed minute names the
 * record clock it completes directly.
 */
export interface ClockTransition {
  completes?: string[];
  starts?: string[];
  at?: string;
  note?: string;
}

export interface WriteEffect {
  kind: 'audit' | 'clock' | 'event' | 'share' | 'rewrap' | 'classification' | 'outbound' | 'version' | 'register' | 'nearMatch' | 'notification';
  detail: string;
}

export interface WriteResult {
  ok: boolean;
  /** Why the write was refused. Empty when it succeeded. */
  errors: string[];
  /** Names from the exclusion register that resemble a recipient, for the confirmation step. */
  nearMatches: string[];
  /** What the pipeline did, in the order it did it, for the toast and for the tests. */
  effects: WriteEffect[];
  audit?: AuditEntry;
  /** The clock rules a transition completed and started, by rule id, for the toast that names them. */
  clocks?: { completed: string[]; started: string[] };
  /** The sharing records written, in the order requested. */
  shares?: SharingRecord[];
}

/**
 * Step 1, first half. The schema is the source of truth, so a record that does not satisfy it never
 * reaches the store. Validated against the collection's own element schema rather than the whole
 * dataset, which would mean re-parsing every record in the product on every keystroke.
 */
export function validateRecord(collection: Collection, record: unknown): string[] {
  const shape = datasetSchema.shape as Record<string, { element?: unknown }>;
  const array = shape[collection] as { element?: { safeParse: (v: unknown) => { success: boolean; error?: { issues: Array<{ path: PropertyKey[]; message: string }> } } } } | undefined;
  const element = array?.element;
  if (!element) return [];
  const parsed = element.safeParse(record);
  if (parsed.success) return [];
  return (parsed.error?.issues ?? []).map((issue) => (issue.path.length > 0 ? `${issue.path.join('.')}: ${issue.message}` : issue.message));
}

/**
 * Step 3. A classification may be raised and may not be quietly lowered.
 *
 * The check is against what the record's own links imply, not against what it said a moment ago: a
 * person record with a MAPPA case behind it cannot be written down to Official however it arrived.
 * A deliberate lower goes through `overrideDecision` (D-082), which requires a named role and a
 * reason, and this refuses everything else.
 */
export function classificationRefusal(config: Config, before: ClassifiedRecord | undefined, after: ClassifiedRecord): string | null {
  // Not every collection carries a classification. A household, a relationship and a person record
  // do not: the marking is on the process and the records it links to, and a check that assumed
  // otherwise read `undefined.handling` and took the screen down rather than refusing anything.
  if (!before || !isClassified(before) || !isClassified(after)) return null;
  const was = classificationFor(config, before);
  const now = classificationFor(config, after);
  return classificationRank(now) < classificationRank(was) ? 'classificationDowngrade' : null;
}

/** True where a record actually carries the marking the classification rules read. */
function isClassified(record: ClassifiedRecord | undefined): record is ClassifiedRecord {
  return record !== undefined && typeof record.classification === 'object' && record.classification !== null && Array.isArray(record.classification.handling);
}

/**
 * Step 5. Nobody the exclusion register names is added as a recipient without somebody saying so.
 *
 * Exact matches refuse outright. Resembling names are returned rather than refused, because the
 * register is a list somebody wrote down and a fuzzy match that silently excludes the wrong person
 * is its own failure (D-084): the caller shows the entry as written and the decision is audited
 * either way.
 */
export function excludedRecipients(
  process: Process,
  recipients: NonNullable<WriteRequest['recipients']>,
  config: Config,
  relationships: Dataset['relationships'],
): { refused: string[]; nearMatches: string[] } {
  const refused: string[] = [];
  const nearMatches: string[] = [];
  for (const candidate of recipients) {
    const hit = isExcludedParty(process, candidate, config.exclusions, process.stage, relationships);
    if (hit) {
      refused.push(candidate.name ?? candidate.personId ?? candidate.userId ?? '');
      continue;
    }
    if (candidate.name) {
      for (const near of nearMatchesOnRegister(process, candidate.name, { exclusions: config.exclusions, stage: process.stage, relationships })) {
        nearMatches.push(near.entryName);
      }
    }
  }
  return { refused, nearMatches };
}

/**
 * Step 6. Clock triggers become running clocks, computed against the demo instant so a clock started
 * by a write reads the same as one from the seed.
 */
export function startedClocks(config: Config, triggers: ClockTrigger[], now: Date): WriteEffect[] {
  const out: WriteEffect[] = [];
  for (const trigger of triggers) {
    const rule = findClockRule(config.clockRules, trigger.ruleId);
    if (!rule) continue;
    const clock = computeClock(trigger, rule, now, { calendar: workingCalendarFrom(config) });
    out.push({ kind: 'clock', detail: `${clock.label}: ${clock.dueAt}` });
  }
  return out;
}

/** The intents that require a reason in writing, because the record is being changed after the fact. */
export const REASON_REQUIRED: readonly WriteIntent[] = ['correct', 'close', 'recorded-in-error'];

export function reasonRefusal(intent: WriteIntent, reason: string | undefined): string | null {
  if (!REASON_REQUIRED.includes(intent)) return null;
  return (reason ?? '').trim().length >= 5 ? null : 'reasonRequired';
}

/**
 * Step 2b. The record's own version history: who changed what, when, and why where one was needed.
 *
 * Computed here rather than at each call site for the reason the whole pipeline exists: a version
 * list that some screens maintain and others forget is worse than none, because a reader cannot tell
 * an unedited record from an unrecorded edit. The diff is over the record's own top-level fields, so
 * a caller cannot leave a field out of the history by not mentioning it.
 *
 * `before` holds only the fields whose values a person can read back. A whole nested object printed
 * into a history entry is not "what it was before", it is a wall of JSON, so those fields are named
 * as changed and their old value is left to the record's own audit trail.
 */
const VERSION_IGNORED = new Set(['versions', 'recordedInError']);

/** Collections whose records carry a version history. The rest say why not in docs/RECORDS.md. */
export const VERSIONED: readonly Collection[] = [
  'people',
  'households',
  'relationships',
  'addresses',
  'processes',
  'events',
  'analyses',
  'meetings',
  'actions',
  'plans',
  'riskAssessments',
  'viewsRecords',
  'sharingRecords',
  'informationRequests',
];

export function versionFor(
  collection: Collection,
  before: unknown,
  after: unknown,
  input: { at: string; byUserId?: string; byName: string; reason?: string; change?: string; intent: WriteIntent },
): RecordVersion | null {
  if (!VERSIONED.includes(collection)) return null;
  // A create has no history to record: the record itself is the first version, and the audit entry
  // already says who made it and when.
  if (input.intent === 'create' || !before || typeof before !== 'object' || !after || typeof after !== 'object') return null;

  const was = before as Record<string, unknown>;
  const now = after as Record<string, unknown>;
  const fields: string[] = [];
  const held: Record<string, string> = {};
  for (const key of new Set([...Object.keys(was), ...Object.keys(now)])) {
    if (VERSION_IGNORED.has(key)) continue;
    if (was[key] === now[key]) continue;
    if (JSON.stringify(was[key]) === JSON.stringify(now[key])) continue;
    fields.push(key);
    // Only values a person can read back go into `before`. A nested object printed into a history
    // entry is not "what it was", it is a wall of JSON, so those fields are named as changed and
    // their old value is left to the audit trail.
    const old = was[key];
    if (old === undefined || old === null) held[key] = '';
    else if (typeof old === 'string') held[key] = old;
    else if (typeof old === 'number' || typeof old === 'boolean' || typeof old === 'bigint') held[key] = String(old);
  }

  const changed = fields.map((field) => ({ field, from: held[field] ?? '', to: '' }));
  if (!warrantsVersion(changed, input.reason)) return null;
  return {
    at: input.at,
    byUserId: input.byUserId,
    byName: input.byName,
    change: input.change ?? fields.join(', '),
    reason: input.reason,
    before: Object.keys(held).length > 0 ? held : undefined,
  };
}

/**
 * Step 8, first half. The lawful basis, built from what a person typed and the processes it covers.
 *
 * Three screens each carried their own copy of the article 6, 9 and 10 conditions and their own
 * mapping from process type to statutory gateway, and the copies had already drifted: one decided
 * article 10 from the author's agency, another from the process type. One rule now: article 10 is
 * engaged where the information is police information or where the case is a MAPPA or MARAC one,
 * because those are the cases that carry offending data whoever recorded it.
 */
const STATUTORY_GATEWAY: Record<ProcessType, string> = {
  cp: 'National Guidance for Child Protection in Scotland 2021',
  asp: 'ASP (Scotland) Act 2007 s5',
  mappa: 'Management of Offenders etc. (Scotland) Act 2005 s10',
  marac: 'MARAC Operating Protocol',
  awi: 'AWI (Scotland) Act 2000',
};

export function lawfulBasisFor(input: LawfulBasisInput, author: User, at: string): LawfulBasisRecord {
  const agency = input.agency ?? author.agency;
  const criminal = agency === 'police' || input.processes.some((p) => p.type === 'mappa' || p.type === 'marac');
  const gateways = [...new Set(input.processes.map((p) => STATUTORY_GATEWAY[p.type]))];
  return {
    id: input.id,
    synthetic: true,
    purpose: input.purpose,
    article6: '6(1)(e) public task',
    article9Condition: '9(2)(g) substantial public interest, DPA 2018 Sch 1 Pt 2 para 18 (safeguarding)',
    article10Criminal: criminal ? 'DPA 2018 s10 and Sch 1' : 'not applicable',
    classification: mostSensitiveClassification(input.processes),
    accessRestriction: mostRestrictedAccess(input.processes),
    statutoryGateway: gateways.length > 0 ? gateways : ['Recorded at event entry'],
    necessityAndProportionality: input.necessity,
    consentStatus: 'not-required',
    authorisedByUserId: author.id,
    authorisedByName: `${author.givenName} ${author.familyName}`,
    createdAt: at,
  };
}

/**
 * Step 8, second half. A sharing record, carrying the classification the process has at this
 * moment rather than a reference to it, so a later change to the case cannot rewrite what was sent.
 */
export function sharingRecordFor(input: SharingInput, process: Process, lawfulBasisId: string, author: User, at: string, id: string): SharingRecord {
  const status = input.status ?? 'sent';
  return {
    id,
    synthetic: true,
    processId: process.id,
    subjectId: process.subjectIds[0] ?? '',
    stage: process.stage,
    recipient: input.recipient,
    detailLevel: input.detailLevel,
    fields: input.fields,
    lawfulBasisId,
    channel: 'in-app',
    status,
    classification: { ...process.classification, handling: [...process.classification.handling] },
    accessRestriction: process.accessRestriction,
    createdAt: at,
    sentAt: status === 'sent' ? at : undefined,
    reason: input.reason,
    needToKnowRowId: input.needToKnowRowId,
    createdByUserId: author.id,
    createdByName: `${author.givenName} ${author.familyName}`,
    summary: input.summary,
  };
}

/**
 * Step 6, the other direction. A write can complete clocks as well as start them: a meeting held
 * completes the clock that was counting down to it and starts the next, and a distributed minute
 * completes the record clock. The rule ids come from the stage engine's tables (D-211), so a screen
 * never decides for itself what a decision does to the clocks.
 */
export function applyClockTransition(clocks: ClockTrigger[], transition: ClockTransition, now: string, newId: (prefix: string) => string): { clocks: ClockTrigger[]; completed: string[]; started: string[] } {
  const at = transition.at ?? now;
  const table = { completes: transition.completes ?? [], starts: transition.starts ?? [] };
  const by = transition.note ?? 'this record';
  const completed: string[] = [];
  const next = clocks.map((c) => {
    if (!c.completedAt && table.completes.includes(c.ruleId)) {
      completed.push(c.ruleId);
      return { ...c, completedAt: at, note: `${c.note ? `${c.note}. ` : ''}Completed by ${by} on ${at.slice(0, 10)}` };
    }
    return c;
  });
  const started: string[] = [];
  for (const ruleId of table.starts) {
    if (next.some((c) => c.ruleId === ruleId && !c.completedAt)) continue;
    next.push({ id: newId('clk'), ruleId, triggeredAt: at, note: `Started by ${by}` });
    started.push(ruleId);
  }
  return { clocks: next, completed, started };
}

/**
 * Step 5, in reverse. What a write to a process did to its hand-recorded register entries.
 *
 * The forward check asks whether a recipient being added resembles somebody on the register. This
 * asks the opposite: a register entry being added or changed, does it resemble somebody already on a
 * list for this case? An exclusion often arrives after the sharing has started (D-084), and the two
 * forms that recorded one each carried a copy of this check. The pipeline notices the entries move
 * and runs it, so a third form cannot leave it out.
 */
export function registerChanges(before: readonly CaseParty[] | undefined, after: readonly CaseParty[]): { added: number; updated: number; entries: CaseParty[] } {
  const key = (p: CaseParty) => `${p.party}:${normalisePartyName(p.name ?? '')}`;
  const was = new Map((before ?? []).filter((p) => p.source === 'manual').map((p) => [key(p), p]));
  let added = 0;
  let updated = 0;
  const entries: CaseParty[] = [];
  for (const party of after) {
    if (party.source !== 'manual' || !party.name) continue;
    const previous = was.get(key(party));
    if (!previous) added += 1;
    else if (JSON.stringify(previous) !== JSON.stringify(party)) updated += 1;
    else continue;
    entries.push(party);
  }
  return { added, updated, entries };
}

export function reverseNearMatches(entries: readonly CaseParty[], listed: readonly string[]): Array<{ entry: CaseParty; names: string[] }> {
  const out: Array<{ entry: CaseParty; names: string[] }> = [];
  for (const entry of entries) {
    if (!entry.name) continue;
    const similar = nearMatchesOnList(entry.name, listed).map((m) => m.name);
    if (similar.length > 0) out.push({ entry, names: similar });
  }
  return out;
}

export type { Classification };
