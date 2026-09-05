import { z } from 'zod';
import { CLASSIFICATION_LEVELS } from '../classification/classify';

/** ISO 8601 date-time with offset, e.g. 2026-09-02T09:00:00+01:00 or Z. */
export const isoDateTime = z.iso.datetime({ offset: true });
/** ISO 8601 calendar date, e.g. 2026-09-02. */
export const isoDate = z.iso.date();

export const idSchema = z.string().min(3);

/** Every generated record is synthetic. The literal makes that unmissable in fixtures. */
export const syntheticSchema = z.literal(true);

export const evidenceRefSchema = z.object({
  kind: z.enum(['document', 'record', 'photo', 'connector', 'meeting', 'event', 'external']),
  ref: z.string(),
  label: z.string().optional(),
});
export type EvidenceRef = z.infer<typeof evidenceRefSchema>;

export const nameSchema = z.object({
  given: z.string().min(1),
  family: z.string().min(1),
  preferred: z.string().optional(),
});

export type IsoDateTime = z.infer<typeof isoDateTime>;
export type IsoDate = z.infer<typeof isoDate>;

/**
 * A Government Security Classification as a record carries it: the level, the Official-Sensitive
 * marking, and any handling instructions the record itself holds. Access restriction is a separate
 * field on the record, because it is a separate property (see `ACCESS_RESTRICTIONS`).
 */
export const classificationSchema = z.object({
  level: z.enum(CLASSIFICATION_LEVELS),
  sensitive: z.boolean(),
  handling: z.array(z.string()),
});

/**
 * One entry in a record's version history: who changed what, when, and why where a reason was needed.
 *
 * Every casework record carries these rather than only the chronology event, which is the entity
 * that happened to get them first. A reader who cannot see that a date was recorded as one thing and
 * corrected to another has lost the fact that it changed, and the fact that it changed is sometimes
 * the significant fact: a date of birth corrected the week a case opened means something.
 */
export const recordVersionSchema = z.object({
  at: isoDateTime,
  byUserId: idSchema.optional(),
  byName: z.string(),
  /** What changed, in a phrase. */
  change: z.string(),
  /** Required where the change was a correction rather than an edit still in flux. */
  reason: z.string().optional(),
  /** What the changed fields held before, keyed by field, so the original stays readable. */
  before: z.record(z.string(), z.string()).optional(),
});
export type RecordVersion = z.infer<typeof recordVersionSchema>;

/**
 * The terminal state for a record that should never have existed.
 *
 * Not a deletion. The record stays, keeps its audit entries, and stays in any pack already
 * distributed, because a pack that went out last Tuesday went out and no later decision unsends it.
 * What changes is that working views stop showing it, and every view that does show it says who
 * decided and why.
 */
export const recordedInErrorSchema = z.object({
  at: isoDateTime,
  byUserId: idSchema.optional(),
  byName: z.string(),
  reason: z.string().min(5),
  /** The audit entry that carries the act, so the record can cite it. */
  auditEntryId: idSchema.optional(),
});
export type RecordedInError = z.infer<typeof recordedInErrorSchema>;

/**
 * The two fields every casework record carries so it can be corrected and retired, never deleted.
 *
 * Spread into an entity's shape rather than wrapped around it, so the entity keeps its own type and
 * a reader of the schema sees the fields where they live. Both optional, because the seed predates
 * them and a record nobody has touched has no history to show.
 */
export const correctable = {
  versions: z.array(recordVersionSchema).optional(),
  recordedInError: recordedInErrorSchema.optional(),
};
