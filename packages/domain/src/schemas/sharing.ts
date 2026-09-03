import { z } from 'zod';
import { AGENCIES, ALL_STAGES, CHANNELS, CLASSIFICATIONS, CONSENT_STATUSES, DETAIL_LEVELS } from '../enums';
import { idSchema, isoDate, isoDateTime, syntheticSchema } from './common';

export const lawfulBasisRecordSchema = z.object({
  id: idSchema,
  synthetic: syntheticSchema,
  purpose: z.string(),
  article6: z.enum(['6(1)(c) legal obligation', '6(1)(e) public task', '6(1)(d) vital interests']),
  article9Condition: z.enum([
    '9(2)(g) substantial public interest, DPA 2018 Sch 1 Pt 2 para 18 (safeguarding)',
    '9(2)(h) health and social care',
    '9(2)(c) vital interests',
    'not applicable',
  ]),
  article10Criminal: z.enum(['DPA 2018 s10 and Sch 1', 'not applicable']),
  /**
   * The Annex 2 classification of what is being shared, recorded alongside the Article 6, 9 and 10
   * basis. A share carries its marking, and the record of the decision says which marking that was.
   */
  classification: z.enum(CLASSIFICATIONS),
  statutoryGateway: z.array(z.string()),
  necessityAndProportionality: z.string().min(1),
  consentStatus: z.enum(CONSENT_STATUSES),
  consentNote: z.string().optional(),
  authorisedByUserId: idSchema.optional(),
  authorisedByName: z.string(),
  informationSharingAgreementRef: z.string().optional(),
  dpiaRef: z.string().optional(),
  createdAt: isoDateTime,
});
export type LawfulBasisRecord = z.infer<typeof lawfulBasisRecordSchema>;

export const recipientSchema = z.object({
  userId: idSchema.optional(),
  name: z.string(),
  agency: z.enum(AGENCIES),
  role: z.string(),
});

export const sharingRecordSchema = z.object({
  id: idSchema,
  synthetic: syntheticSchema,
  processId: idSchema,
  subjectId: idSchema,
  stage: z.enum(ALL_STAGES),
  recipient: recipientSchema,
  detailLevel: z.enum(DETAIL_LEVELS),
  fields: z.array(z.string()).optional(),
  lawfulBasisId: idSchema,
  channel: z.enum(CHANNELS),
  status: z.enum(['queued', 'sent', 'read', 'withheld']),
  createdAt: isoDateTime,
  sentAt: isoDateTime.optional(),
  readAt: isoDateTime.optional(),
  /** Shown to the recipient: why they are receiving this. */
  reason: z.string(),
  needToKnowRowId: z.string().optional(),
  createdByUserId: idSchema.optional(),
  createdByName: z.string(),
  summary: z.string(),
});
export type SharingRecord = z.infer<typeof sharingRecordSchema>;

export const informationRequestSchema = z.object({
  id: idSchema,
  synthetic: syntheticSchema,
  processId: idSchema,
  subjectId: idSchema,
  fromAgency: z.enum(AGENCIES),
  fromName: z.string(),
  fromUserId: idSchema.optional(),
  toAgency: z.enum(AGENCIES),
  toUserId: idSchema.optional(),
  toName: z.string(),
  purpose: z.string(),
  fields: z.array(z.string()),
  lawfulBasisId: idSchema,
  status: z.enum(['open', 'responded', 'declined']),
  createdAt: isoDateTime,
  dueAt: isoDate.optional(),
  response: z.object({ at: isoDateTime, byName: z.string(), text: z.string(), fieldsProvided: z.array(z.string()) }).optional(),
});
export type InformationRequest = z.infer<typeof informationRequestSchema>;
