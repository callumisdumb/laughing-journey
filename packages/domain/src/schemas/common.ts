import { z } from 'zod';

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
