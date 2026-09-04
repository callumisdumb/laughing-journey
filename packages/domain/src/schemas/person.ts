import { z } from 'zod';
import { LIFE_STAGES, RELATIONSHIP_TYPES } from '../enums';
import { idSchema, isoDate, isoDateTime, syntheticSchema } from './common';

export const addressSchema = z.object({
  id: idSchema,
  synthetic: syntheticSchema,
  line1: z.string(),
  line2: z.string().optional(),
  town: z.string(),
  /** Postcodes use unallocated first letters Q, V or X only. */
  postcode: z.string().regex(/^[QVX][A-Z]?\d{1,2}[A-Z]? \d[A-Z]{2}$/),
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
  createdAt: isoDateTime,
  /**
   * How many possible duplicates were on screen when this record was created, and dismissed.
   *
   * The assertion is recorded rather than assumed: "created after reviewing 3 candidates" is a thing
   * an inspector can ask about and a practitioner can be held to, where "the search was shown" is
   * not. Absent on the seeded records, which predate the create path.
   */
  createdAfterReviewing: z.number().int().nonnegative().optional(),
});
export type Person = z.infer<typeof personSchema>;

export const householdSchema = z.object({
  id: idSchema,
  synthetic: syntheticSchema,
  addressId: idSchema,
  memberIds: z.array(idSchema),
  label: z.string().optional(),
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
