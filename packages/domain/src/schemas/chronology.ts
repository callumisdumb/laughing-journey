import { z } from 'zod';
import { AGENCIES, EVENT_TYPES, SIGNIFICANCES, SOURCE_SYSTEMS, VISIBILITIES } from '../enums';
import { evidenceRefSchema, idSchema, isoDateTime, syntheticSchema } from './common';

export const eventVersionSchema = z.object({
  at: isoDateTime,
  byUserId: idSchema.optional(),
  byName: z.string(),
  change: z.string(),
});

/** A chronology event is a fact. It carries no opinion. */
export const chronologyEventSchema = z.object({
  id: idSchema,
  synthetic: syntheticSchema,
  subjectIds: z.array(idSchema).min(1),
  occurredAt: isoDateTime,
  /** False when only the date is known. */
  hasTime: z.boolean(),
  approximate: z.boolean(),
  recordedAt: isoDateTime,
  agency: z.enum(AGENCIES),
  sourceSystem: z.enum(SOURCE_SYSTEMS),
  recordedByUserId: idSchema.optional(),
  recordedByName: z.string(),
  eventType: z.enum(EVENT_TYPES),
  title: z.string().max(120),
  detail: z.string().max(600),
  response: z.string().max(400).optional(),
  outcome: z.string().max(400).optional(),
  significance: z.enum(SIGNIFICANCES),
  significanceReason: z.string().optional(),
  linkedPersonIds: z.array(idSchema),
  linkedProcessIds: z.array(idSchema),
  evidenceRefs: z.array(evidenceRefSchema),
  visibility: z.enum(VISIBILITIES),
  /** Lawful basis for inclusion in the integrated chronology, when visibility is integrated. */
  lawfulBasisId: idSchema.optional(),
  versions: z.array(eventVersionSchema),
});
export type ChronologyEvent = z.infer<typeof chronologyEventSchema>;

/** Analysis is a separate entity that references facts. Never shown inline as a fact. */
export const chronologyAnalysisSchema = z.object({
  id: idSchema,
  synthetic: syntheticSchema,
  subjectId: idSchema,
  processId: idSchema.optional(),
  eventIds: z.array(idSchema).min(1),
  authorUserId: idSchema.optional(),
  authorName: z.string(),
  agency: z.enum(AGENCIES),
  recordedAt: isoDateTime,
  kind: z.enum(['pattern', 'risk', 'recommendation']),
  title: z.string().max(120),
  text: z.string().max(1200),
});
export type ChronologyAnalysis = z.infer<typeof chronologyAnalysisSchema>;
