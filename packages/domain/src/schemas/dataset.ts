import { z } from 'zod';
import { actionSchema, planSchema, riskAssessmentSchema, viewsRecordSchema } from './action-plan';
import { auditEntrySchema } from './audit';
import { chronologyAnalysisSchema, chronologyEventSchema } from './chronology';
import { connectorEventSchema } from './connector';
import { meetingSchema } from './meeting';
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
  connectorEvents: z.array(connectorEventSchema),
  audit: z.array(auditEntrySchema),
});
export type Dataset = z.infer<typeof datasetSchema>;
