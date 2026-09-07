import type { RecordVersion, RecordedInError } from '../schemas/common';

/**
 * Correcting a record, which is what this product does instead of deleting one.
 *
 * The vocabulary matters and is enforced here rather than left to each screen. An **edit** changes a
 * field still in flux and leaves a version entry saying who and what. A **correction** changes a
 * field that was wrong, and additionally carries the reason and the value it held before, so a
 * reader can see that a date was recorded as one thing and changed to another: the fact that it
 * changed is sometimes the significant fact. **Recorded in error** is the terminal state for a
 * record that should never have existed, which is not a deletion either: the record stays, keeps its
 * audit entries, and stays in any pack already distributed.
 *
 * There is no delete. The only thing the product removes is a draft the user has not saved.
 */

/** A record that carries a version history and can be retired. */
export interface Correctable {
  versions?: RecordVersion[];
  recordedInError?: RecordedInError;
}

export interface ChangedField {
  field: string;
  from: string;
  to: string;
}

/**
 * The fields that actually changed, as strings, for the version entry.
 *
 * Compared with `String()` rather than deeply, because a version entry is a sentence a person reads
 * and "the date of birth was 14 Mar 2019" is what it needs to say. A field the caller did not name
 * is not compared: an edit dialog knows which fields it offered, and diffing the whole record would
 * report the version array itself as a change.
 */
export function changedFields<T extends object>(before: T, after: T, fields: Array<keyof T & string>): ChangedField[] {
  const out: ChangedField[] = [];
  for (const field of fields) {
    const was = before[field];
    const now = after[field];
    if (was === now) continue;
    if (was === undefined && now === undefined) continue;
    out.push({ field, from: was === undefined || was === null ? '' : String(was), to: now === undefined || now === null ? '' : String(now) });
  }
  return out;
}

export interface VersionInput {
  at: string;
  byUserId?: string;
  byName: string;
  change: string;
  reason?: string;
  changed?: ChangedField[];
}

/** One version entry. The `before` map is only written where there is something to show. */
export function versionEntry(input: VersionInput): RecordVersion {
  const before: Record<string, string> = {};
  for (const change of input.changed ?? []) before[change.field] = change.from;
  return {
    at: input.at,
    byUserId: input.byUserId,
    byName: input.byName,
    change: input.change,
    reason: input.reason,
    before: Object.keys(before).length > 0 ? before : undefined,
  };
}

/** The record with a version entry appended. Returns the same object where there is nothing to add. */
export function withVersion<T extends Correctable>(record: T, entry: RecordVersion | null): T {
  if (!entry) return record;
  return { ...record, versions: [...(record.versions ?? []), entry] };
}

/**
 * Whether a version entry is warranted at all.
 *
 * An update that changed none of the fields the caller named is not history, it is a save button
 * somebody pressed twice, and a version list full of them is a version list nobody reads. A
 * correction always writes one, because the reason is the point.
 */
export function warrantsVersion(changed: ChangedField[], reason: string | undefined): boolean {
  return changed.length > 0 || Boolean(reason);
}

/** The record marked as recorded in error. It is not removed, and this is not reversible by editing. */
export function withRecordedInError<T extends Correctable>(record: T, marker: RecordedInError): T {
  return { ...record, recordedInError: marker };
}

export function isRecordedInError(record: Correctable | undefined): boolean {
  return record?.recordedInError !== undefined;
}

/**
 * The records a working view shows: everything except the ones recorded in error.
 *
 * Deliberately a filter the screens call rather than something the store applies, because the views
 * that must keep showing them are real: the audit ledger, a distributed pack, and the record's own
 * history. A store that hid them everywhere would make those three impossible.
 */
export function live<T extends Correctable>(records: readonly T[]): T[] {
  return records.filter((record) => !isRecordedInError(record));
}

/** The version history, newest first, which is the order a reader wants it in. */
export function history(record: Correctable): RecordVersion[] {
  return [...(record.versions ?? [])].reverse();
}
