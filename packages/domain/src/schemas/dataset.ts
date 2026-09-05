import { z } from 'zod';
import { actionSchema, planSchema, riskAssessmentSchema, viewsRecordSchema } from './action-plan';
import { auditEntrySchema } from './audit';
import { chronologyAnalysisSchema, chronologyEventSchema } from './chronology';
import { connectorEventSchema } from './connector';
import { inboundChangeSchema, outboundWriteSchema } from './outbox';
import { meetingSchema } from './meeting';
import { notificationSchema } from './notification';
import { addressSchema, householdSchema, organisationSchema, personMergeSchema, personSchema, relationshipSchema, teamSchema } from './person';
import { processSchema } from './process';
import { informationRequestSchema, lawfulBasisRecordSchema, sharingRecordSchema } from './sharing';
import { userSchema } from './user';

/** The whole seed. Parsed once in tests to prove every generated record is valid. */
export const datasetSchema = z.object({
  meta: z.object({ seed: z.string(), generatedAt: z.string(), now: z.string(), synthetic: z.literal(true) }),
  organisations: z.array(organisationSchema),
  teams: z.array(teamSchema),
  users: z.array(userSchema),
  addresses: z.array(addressSchema),
  people: z.array(personSchema),
  households: z.array(householdSchema),
  personMerges: z.array(personMergeSchema),
  relationships: z.array(relationshipSchema),
  processes: z.array(processSchema),
  events: z.array(chronologyEventSchema),
  analyses: z.array(chronologyAnalysisSchema),
  meetings: z.array(meetingSchema),
  actions: z.array(actionSchema),
  plans: z.array(planSchema),
  riskAssessments: z.array(riskAssessmentSchema),
  viewsRecords: z.array(viewsRecordSchema),
  lawfulBases: z.array(lawfulBasisRecordSchema),
  sharingRecords: z.array(sharingRecordSchema),
  informationRequests: z.array(informationRequestSchema),
  /**
   * What the product has told whom. Written by the pipeline and the clock engine, read by the bell,
   * the panel, Home, the worklist and the drawer; persisted like every other collection, because a
   * notification that vanishes on a reload was never a notification (D-207).
   */
  notifications: z.array(notificationSchema),
  connectorEvents: z.array(connectorEventSchema),
  /**
   * Outbound writes awaiting authorisation, in flight, acknowledged or failed. Persisted rather
   * than held in memory, because a write whose state is lost on a reload is a write nobody can be
   * sure went out, and that is the failure mode this whole mechanism exists to prevent.
   */
  outbox: z.array(outboundWriteSchema),
  /** Changes arriving from a source system's own feed, before anybody has accepted or declined one. */
  inbound: z.array(inboundChangeSchema),
  audit: z.array(auditEntrySchema),
});
export type Dataset = z.infer<typeof datasetSchema>;
