import { z } from 'zod';
import { ACCESS_RESTRICTIONS, AGENCIES, ALL_STAGES, CHANNELS, CONSENT_STATUSES, DETAIL_LEVELS, ROLES } from '../enums';
import { classificationSchema, correctable, idSchema, isoDate, isoDateTime, syntheticSchema } from './common';

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
   * Captured at the moment of the share rather than resolved at render time, so the record says what
   * was shared under what marking even if the source is later raised.
   */
  classification: classificationSchema,
  /** Whether what was shared came from an access-restricted record. Separate from the marking. */
  accessRestriction: z.enum(ACCESS_RESTRICTIONS),
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
  /**
   * The classification of what was shared, captured at the moment of the share. Not resolved from
   * the source at render time: the record has to say what went out under what marking even if the
   * source is raised afterwards, because the recipient acted on what they were given.
   */
  classification: classificationSchema,
  /** Whether what was shared came from an access-restricted record. */
  accessRestriction: z.enum(ACCESS_RESTRICTIONS),
  /** Shown to the recipient: why they are receiving this. */
  reason: z.string(),
  needToKnowRowId: z.string().optional(),
  createdByUserId: idSchema.optional(),
  createdByName: z.string(),
  summary: z.string(),
  ...correctable,
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
  /** The classification of the record the request concerns, captured when the request was made. */
  classification: classificationSchema,
  accessRestriction: z.enum(ACCESS_RESTRICTIONS),
  status: z.enum(['open', 'responded', 'declined']),
  createdAt: isoDateTime,
  dueAt: isoDate.optional(),
  /**
   * An external contact: an agency nobody in the partnership holds an account for. The request is
   * still a record of what was asked and why, and the return is recorded here by the person who
   * asked, on their behalf, saying how it arrived (D-249).
   */
  external: z.object({ name: z.string().min(2).max(120), organisation: z.string().min(2).max(160), contact: z.string().max(200).optional() }).optional(),
  response: z
    .object({
      at: isoDateTime,
      byName: z.string(),
      text: z.string(),
      fieldsProvided: z.array(z.string()),
      /** Recorded by somebody here on the responder's behalf, and how it reached them (D-249). */
      recordedOnBehalf: z.object({ byUserId: idSchema.optional(), byName: z.string(), how: z.enum(['telephone', 'email', 'letter', 'in-person', 'secure-portal']) }).optional(),
    })
    .optional(),
  ...correctable,
});
export type InformationRequest = z.infer<typeof informationRequestSchema>;

/**
 * A request to be involved in a case, from somebody who can see that it exists and no more (D-227).
 * The lead decides it; accepted, the requester joins the case's members with the reason on the
 * membership, and either way the requester is told.
 */
export const involvementRequestSchema = z.object({
  id: idSchema,
  synthetic: syntheticSchema,
  processId: idSchema,
  requesterUserId: idSchema,
  requesterName: z.string(),
  requesterAgency: z.enum(AGENCIES),
  requesterRoleId: z.enum(ROLES),
  /** Why they need to be on the case, in their words; the lead reads it and the membership carries it. */
  reason: z.string(),
  status: z.enum(['pending', 'accepted', 'declined', 'withdrawn']),
  createdAt: isoDateTime,
  decidedAt: isoDateTime.optional(),
  decidedByUserId: idSchema.optional(),
  decidedByName: z.string().optional(),
  decisionNote: z.string().optional(),
  /** Amendments the requester made before it was decided, oldest first, each with what it said before (D-246). */
  amendments: z.array(z.object({ at: isoDateTime, was: z.string() })).optional(),
  withdrawnAt: isoDateTime.optional(),
  /** Why they withdrew it, where they said; the lead reads it beside the request they were about to decide. */
  withdrawnReason: z.string().optional(),
  ...correctable,
});
export type InvolvementRequest = z.infer<typeof involvementRequestSchema>;
