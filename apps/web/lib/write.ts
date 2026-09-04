'use client';

import { classificationFor, classificationRank, computeClock, datasetSchema, findClockRule, isExcludedParty, nearMatchesOnRegister, workingCalendarFrom, type AuditEntry, type Classification, type ClassifiedRecord, type ChronologyEvent, type ClockTrigger, type Config, type Dataset, type Process } from '@mas/domain';
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
  recipientName: string;
  reason: string;
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
}

export interface WriteEffect {
  kind: 'audit' | 'clock' | 'event' | 'share' | 'rewrap' | 'classification' | 'outbound' | 'version';
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

export type { Classification };
