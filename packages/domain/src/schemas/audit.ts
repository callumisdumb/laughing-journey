import { z } from 'zod';
import { AGENCIES, AUDIT_ACTS } from '../enums';
import { idSchema, isoDateTime, syntheticSchema } from './common';

export const auditEntrySchema = z.object({
  id: idSchema,
  synthetic: syntheticSchema,
  at: isoDateTime,
  userId: idSchema,
  userName: z.string(),
  agency: z.enum(AGENCIES),
  act: z.enum(AUDIT_ACTS),
  targetType: z.enum(['person', 'process', 'event', 'meeting', 'sharing', 'report', 'config', 'session', 'inbox']),
  targetId: z.string(),
  targetLabel: z.string(),
  processId: idSchema.optional(),
  reason: z.string().optional(),
  restricted: z.boolean(),
  /** Break-glass windows are time-limited. */
  expiresAt: isoDateTime.optional(),
});
export type AuditEntry = z.infer<typeof auditEntrySchema>;
