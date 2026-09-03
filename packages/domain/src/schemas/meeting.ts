import { z } from 'zod';
import { AGENCIES, DETAIL_LEVELS, MEETING_TYPES } from '../enums';
import { idSchema, isoDate, isoDateTime, syntheticSchema } from './common';

export const inviteeSchema = z.object({
  userId: idSchema.optional(),
  name: z.string(),
  agency: z.enum(AGENCIES),
  role: z.string(),
  required: z.boolean(),
  attendance: z.enum(['invited', 'accepted', 'declined', 'present', 'remote', 'apologies', 'absent']),
  /** Why they are invited: the need-to-know row that generated the invite. */
  reason: z.string(),
  needToKnowRowId: z.string().optional(),
});
export type Invitee = z.infer<typeof inviteeSchema>;

export const agendaItemSchema = z.object({
  id: idSchema,
  order: z.number().int(),
  title: z.string(),
  status: z.enum(['pending', 'current', 'done']),
  note: z.string().optional(),
});

export const informationSharedSchema = z.object({
  id: idSchema,
  agency: z.enum(AGENCIES),
  byName: z.string(),
  byUserId: idSchema.optional(),
  at: isoDateTime,
  summary: z.string(),
  relevance: z.string(),
  linkedEventIds: z.array(idSchema),
});

export const dissentSchema = z.object({
  byName: z.string(),
  byUserId: idSchema.optional(),
  agency: z.enum(AGENCIES),
  text: z.string(),
});

export const decisionSchema = z.object({
  id: idSchema,
  question: z.string(),
  decision: z.string(),
  rationale: z.string(),
  dissent: z.array(dissentSchema),
  decidedByName: z.string(),
  decidedByUserId: idSchema.optional(),
  decidedAt: isoDateTime,
});
export type Decision = z.infer<typeof decisionSchema>;

export const preMeetingRequestSchema = z.object({
  id: idSchema,
  agency: z.enum(AGENCIES),
  toName: z.string(),
  toUserId: idSchema.optional(),
  sentAt: isoDateTime,
  dueAt: isoDate,
  status: z.enum(['sent', 'returned', 'nothing-known', 'overdue']),
  returnSummary: z.string().optional(),
  returnedAt: isoDateTime.optional(),
});

export const packItemSchema = z.object({
  id: idSchema,
  kind: z.enum(['chronology', 'report', 'views', 'plan', 'risk-assessment', 'research-return']),
  label: z.string(),
  ref: z.string().optional(),
  windowFrom: isoDate.optional(),
  windowTo: isoDate.optional(),
  included: z.boolean(),
});

export const distributionSchema = z.object({
  id: idSchema,
  recipientName: z.string(),
  recipientUserId: idSchema.optional(),
  agency: z.enum(AGENCIES),
  role: z.string(),
  detailLevel: z.enum(DETAIL_LEVELS),
  fields: z.array(z.string()).optional(),
  sharingRecordId: idSchema.optional(),
  reason: z.string(),
});

export const meetingSchema = z.object({
  id: idSchema,
  synthetic: syntheticSchema,
  type: z.enum(MEETING_TYPES),
  processId: idSchema,
  subjectIds: z.array(idSchema).min(1),
  title: z.string(),
  scheduledAt: isoDateTime,
  endsAt: isoDateTime.optional(),
  location: z.string(),
  status: z.enum(['scheduled', 'in-progress', 'held', 'cancelled']),
  chairUserId: idSchema.optional(),
  chairName: z.string(),
  minuteTakerUserId: idSchema.optional(),
  minuteTakerName: z.string().optional(),
  invitees: z.array(inviteeSchema),
  agenda: z.array(agendaItemSchema),
  preMeetingRequests: z.array(preMeetingRequestSchema),
  pack: z.array(packItemSchema),
  informationShared: z.array(informationSharedSchema),
  decisions: z.array(decisionSchema),
  actionIds: z.array(idSchema),
  viewsRecordIds: z.array(idSchema),
  minute: z.object({
    status: z.enum(['not-started', 'draft', 'chair-approved', 'distributed']),
    draftedAt: isoDateTime.optional(),
    approvedAt: isoDateTime.optional(),
    distributedAt: isoDateTime.optional(),
  }),
  distribution: z.array(distributionSchema),
  reviewDate: isoDate.optional(),
  /** Subject or family attendance and support (advocate, interpreter). */
  subjectAttendance: z.string().optional(),
  /**
   * Indicators 5 and 6 of the ASP data workbook 2026-27: whether the adult at risk and an
   * independent advocate were invited to the case conference, and whether they took the invitation
   * up. Both are counted, and the return reports the uptake as a percentage of the invitations, so
   * invited and attended have to be separate flags. An attendance with no invitation is possible
   * and is not an error: the point of the indicator is the gap between the two.
   *
   * "Invited" is the workbook's own word and does not imply the adult was expected to attend. Where
   * more than one advocate was ever invited on the adult's behalf, the workbook counts it once.
   */
  aspAttendance: z
    .object({
      adultInvited: z.boolean(),
      adultAttended: z.boolean(),
      advocateInvited: z.boolean(),
      advocateAttended: z.boolean(),
      /** Why the adult was not invited, where they were not. The presumption is that they attend. */
      adultNotInvitedReason: z.string().optional(),
    })
    .optional(),
});
export type Meeting = z.infer<typeof meetingSchema>;
