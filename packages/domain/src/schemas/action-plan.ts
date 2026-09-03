import { t } from '@mas/messages';
import { z } from 'zod';
import { ACTION_STATUSES, AGENCIES, PLAN_TYPES, RISK_BANDS, RISK_TOOLS, VIEWS_KINDS } from '../enums';
import { evidenceRefSchema, idSchema, isoDate, isoDateTime, syntheticSchema } from './common';

export const actionSchema = z.object({
  id: idSchema,
  synthetic: syntheticSchema,
  processId: idSchema,
  meetingId: idSchema.optional(),
  planId: idSchema.optional(),
  title: z.string(),
  detail: z.string().optional(),
  ownerUserId: idSchema.optional(),
  ownerName: z.string(),
  ownerAgency: z.enum(AGENCIES),
  due: isoDate,
  status: z.enum(ACTION_STATUSES),
  completedAt: isoDateTime.optional(),
  evidence: z.string().optional(),
  escalatedAt: isoDateTime.optional(),
  escalatedToName: z.string().optional(),
  createdAt: isoDateTime,
  createdByName: z.string(),
});
export type Action = z.infer<typeof actionSchema>;

export const planOutcomeSchema = z.object({
  id: idSchema,
  text: z.string(),
  actionIds: z.array(idSchema),
});

export const planSchema = z.object({
  id: idSchema,
  synthetic: syntheticSchema,
  processId: idSchema,
  type: z.enum(PLAN_TYPES),
  title: z.string(),
  outcomes: z.array(planOutcomeSchema),
  coordinatorUserId: idSchema.optional(),
  coordinatorName: z.string(),
  agreedAt: isoDate,
  reviewDate: isoDate.optional(),
  status: z.enum(['draft', 'active', 'reviewed', 'ended']),
  /** For support plans under ASP: the adult's consent is recorded. */
  consentNote: z.string().optional(),
  /**
   * Set only where it has been agreed that no further action is required under the Act. An ASP plan
   * must otherwise carry a date for a review meeting (NMDS Annex 2 glossary), so the refine below
   * makes the review date conditional on this flag rather than optional in every case.
   */
  noFurtherActionAgreed: z.boolean().optional(),
}).refine((plan) => plan.type !== 'adult-protection' || Boolean(plan.reviewDate) || plan.noFurtherActionAgreed === true, {
  error: () => t('errors.schemas.aspPlanReviewDate'),
  path: ['reviewDate'],
});
export type Plan = z.infer<typeof planSchema>;

export const riskItemSchema = z.object({
  id: z.string(),
  question: z.string(),
  answer: z.enum(['yes', 'no', 'unknown']),
});

export const riskAssessmentSchema = z.object({
  id: idSchema,
  synthetic: syntheticSchema,
  processId: idSchema.optional(),
  subjectId: idSchema,
  tool: z.enum(RISK_TOOLS),
  assessedAt: isoDateTime,
  assessorUserId: idSchema.optional(),
  assessorName: z.string(),
  assessorAgency: z.enum(AGENCIES),
  score: z.number().optional(),
  maxScore: z.number().optional(),
  band: z.enum(RISK_BANDS),
  bandLabel: z.string(),
  items: z.array(riskItemSchema).optional(),
  evidenceRefs: z.array(evidenceRefSchema),
  judgementOverride: z.object({ band: z.enum(RISK_BANDS), reason: z.string(), byName: z.string() }).optional(),
});
export type RiskAssessment = z.infer<typeof riskAssessmentSchema>;

export const viewsRecordSchema = z.object({
  id: idSchema,
  synthetic: syntheticSchema,
  personId: idSchema,
  processId: idSchema.optional(),
  kind: z.enum(VIEWS_KINDS),
  recordedAt: isoDateTime,
  recordedByUserId: idSchema.optional(),
  recordedByName: z.string(),
  recordedByAgency: z.enum(AGENCIES),
  method: z.string(),
  content: z.string(),
  /** How the person wants the view used. */
  sharingPreference: z.string().optional(),
});
export type ViewsRecord = z.infer<typeof viewsRecordSchema>;
