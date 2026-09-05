import { z } from 'zod';
import { LIFE_STAGES, RELATIONSHIP_TYPES } from '../enums';
import { correctable, idSchema, isoDate, isoDateTime, syntheticSchema } from './common';

export const addressSchema = z.object({
  id: idSchema,
  synthetic: syntheticSchema,
  line1: z.string(),
  line2: z.string().optional(),
  town: z.string(),
  /** Postcodes use unallocated first letters Q, V or X only. */
  postcode: z.string().regex(/^[QVX][A-Z]?\d{1,2}[A-Z]? \d[A-Z]{2}$/),
  ...correctable,
});
export type Address = z.infer<typeof addressSchema>;

export const addressPeriodSchema = z.object({
  addressId: idSchema,
  from: isoDate,
  to: isoDate.optional(),
  note: z.string().optional(),
});
export type AddressPeriod = z.infer<typeof addressPeriodSchema>;

export const personAlertSchema = z.object({
  id: idSchema,
  kind: z.enum(['staff-safety', 'marac-flag', 'cp-register', 'mappa', 'missing', 'other']),
  text: z.string(),
  from: isoDate,
  to: isoDate.optional(),
  /** Alerts can be restricted to certain agencies (e.g. MAPPA presence). */
  visibleTo: z.array(z.string()).optional(),
});
export type PersonAlert = z.infer<typeof personAlertSchema>;

export const communicationNeedsSchema = z.object({
  interpreterLanguage: z.string().optional(),
  needs: z.array(z.string()),
  note: z.string().optional(),
});

export const personSchema = z.object({
  id: idSchema,
  synthetic: syntheticSchema,
  givenName: z.string(),
  familyName: z.string(),
  preferredName: z.string().optional(),
  aliases: z.array(z.string()),
  pronouns: z.string().optional(),
  lifeStage: z.enum(LIFE_STAGES),
  dateOfBirth: isoDate.optional(),
  /**
   * How well the date of birth is actually known.
   *
   * `exact` is a date somebody has seen on a document. `year` is a year with a fabricated 1 January
   * behind it, which is what half of these records really are. `estimated` is an age converted to a
   * date. The distinction has to be stored, because an age band report computed from a fabricated
   * day and one computed from a known date are different claims, and a product that cannot tell them
   * apart will state the first with the confidence of the second.
   */
  dateOfBirthPrecision: z.enum(['exact', 'year', 'estimated']).optional(),
  expectedDeliveryDate: isoDate.optional(),
  sex: z.enum(['female', 'male', 'not-recorded']),
  /** Synthetic CHI number: 10 digits, ddmmyy plus four. Never a real number. */
  chi: z.string().regex(/^\d{10}$/).optional(),
  addressHistory: z.array(addressPeriodSchema),
  householdId: idSchema.optional(),
  communicationNeeds: communicationNeedsSchema,
  alerts: z.array(personAlertSchema),
  contact: z.object({ phone: z.string().optional(), email: z.string().optional() }),
  gpPractice: z.string().optional(),
  school: z.string().optional(),
  // No ethnicity field. The ASP national return, the MAPPA annual report and the DPIA all say the
  // platform does not hold it, and a dead field on the most sensitive entity in the product is how a
  // protected characteristic gets populated later by somebody who does not know why it was empty.
  // See D-079. A test asserts it stays absent.
  deceased: z.boolean().optional(),
  /**
   * A death, which is a flow rather than a tick box (docs/RECORDS.md 6.4).
   *
   * `deceased` stays as the flag the seed writes and every list reads. This carries the date and who
   * recorded it, which is what a chronology entry, a closure reason and a national return all need,
   * and what a reader needs before deciding whether a case can still be open.
   */
  death: z
    .object({
      at: isoDate,
      recordedAt: isoDateTime,
      byUserId: idSchema.optional(),
      byName: z.string(),
      /** Where the product learned of it: a connector, a family member, a colleague. */
      source: z.string().optional(),
    })
    .optional(),
  createdAt: isoDateTime,
  /**
   * How many possible duplicates were on screen when this record was created, and dismissed.
   *
   * The assertion is recorded rather than assumed: "created after reviewing 3 candidates" is a thing
   * an inspector can ask about and a practitioner can be held to, where "the search was shown" is
   * not. Absent on the seeded records, which predate the create path.
   */
  createdAfterReviewing: z.number().int().nonnegative().optional(),
  ...correctable,
});
export type Person = z.infer<typeof personSchema>;

/**
 * A merge that happened, holding enough to take it back.
 *
 * Both records are kept whole rather than reconstructed on the way out, and every reference the
 * merge repointed is listed as a dotted path into the dataset, so the unmerge sets exactly those
 * back. A merge that has been undone keeps its record and gains `undoneAt`: the merge happened, and
 * an audit trail that deletes its own evidence is not one.
 */
export const personMergeSchema = z.object({
  id: idSchema,
  synthetic: syntheticSchema,
  survivorId: idSchema,
  mergedId: idSchema,
  mergedPerson: z.lazy(() => personSchema),
  survivorBefore: z.lazy(() => personSchema),
  repointed: z.array(z.string()),
  at: isoDateTime,
  byUserId: idSchema,
  byName: z.string(),
  reason: z.string().min(10),
  undoneAt: isoDateTime.optional(),
  undoneReason: z.string().optional(),
});
export type PersonMerge = z.infer<typeof personMergeSchema>;

/**
 * One person's time in a household, dated.
 *
 * Removing somebody from a household sets `to` rather than deleting the membership, because who
 * lived where and when is exactly what a chronology needs, and it is the question a review asks
 * first: was the mother's new partner living there in the March before the injury. A plain list of
 * current members cannot answer it, so there is no plain list.
 */
export const householdMembershipSchema = z.object({
  personId: idSchema,
  from: isoDate,
  to: isoDate.optional(),
  /** Why the membership ended, in a phrase. Absent while it is running. */
  endedReason: z.string().optional(),
});
export type HouseholdMembership = z.infer<typeof householdMembershipSchema>;

export const householdSchema = z.object({
  id: idSchema,
  synthetic: syntheticSchema,
  addressId: idSchema,
  members: z.array(householdMembershipSchema),
  label: z.string().optional(),
  ...correctable,
});
export type Household = z.infer<typeof householdSchema>;

export const relationshipSchema = z.object({
  id: idSchema,
  synthetic: syntheticSchema,
  fromPersonId: idSchema,
  toPersonId: idSchema,
  type: z.enum(RELATIONSHIP_TYPES),
  from: isoDate.optional(),
  to: isoDate.optional(),
  notes: z.string().optional(),
  ...correctable,
});
export type Relationship = z.infer<typeof relationshipSchema>;

export const organisationSchema = z.object({
  id: idSchema,
  synthetic: syntheticSchema,
  kind: z.enum([
    'council',
    'hscp',
    'health-board',
    'police',
    'third-sector',
    'sps',
    'scra',
    'court',
    'regulator',
    'fire-rescue',
  ]),
  name: z.string(),
  shortName: z.string(),
});
export type Organisation = z.infer<typeof organisationSchema>;

export const teamSchema = z.object({
  id: idSchema,
  organisationId: idSchema,
  name: z.string(),
  base: z.string(),
});
export type Team = z.infer<typeof teamSchema>;
