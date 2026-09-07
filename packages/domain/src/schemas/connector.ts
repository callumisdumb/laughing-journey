import { z } from 'zod';
import { AGENCIES, CONNECTOR_IDS, EVENT_TYPES, SIGNIFICANCES } from '../enums';
import { idSchema, isoDateTime, syntheticSchema } from './common';

export const connectorEventSchema = z.object({
  id: idSchema,
  synthetic: syntheticSchema,
  connectorId: z.enum(CONNECTOR_IDS),
  agency: z.enum(AGENCIES),
  subjectId: idSchema,
  receivedAt: isoDateTime,
  externalRef: z.string(),
  /** The fictional source record, field by field, as the adapter received it. */
  sourcePayload: z.record(z.string(), z.string()),
  mapped: z.object({
    eventType: z.enum(EVENT_TYPES),
    title: z.string(),
    detail: z.string(),
    occurredAt: isoDateTime,
    hasTime: z.boolean(),
    significance: z.enum(SIGNIFICANCES),
    mappingRule: z.string(),
  }),
  status: z.enum(['pending', 'promoted', 'dismissed']),
  reviewedByUserId: idSchema.optional(),
  reviewedAt: isoDateTime.optional(),
  promotedEventId: idSchema.optional(),
});
export type ConnectorEvent = z.infer<typeof connectorEventSchema>;

export const connectorHealthSchema = z.object({
  status: z.enum(['ok', 'degraded', 'down']),
  lastSyncAt: isoDateTime.optional(),
  latencyMs: z.number(),
  message: z.string(),
});
export type ConnectorHealth = z.infer<typeof connectorHealthSchema>;
