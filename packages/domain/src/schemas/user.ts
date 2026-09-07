import { z } from 'zod';
import { AGENCIES, PROCESS_TYPES, ROLES } from '../enums';
import { idSchema, isoDate, syntheticSchema } from './common';

export const userSchema = z.object({
  id: idSchema,
  synthetic: syntheticSchema,
  givenName: z.string(),
  familyName: z.string(),
  agency: z.enum(AGENCIES),
  roleId: z.enum(ROLES),
  jobTitle: z.string(),
  organisationId: idSchema,
  teamId: idSchema.optional(),
  base: z.string(),
  /** Synthetic contact details. */
  email: z.string(),
  phone: z.string(),
  /** Process types this persona is a member of (can be invited, can see rows for their agency). */
  processMemberships: z.array(z.enum(PROCESS_TYPES)),
  /** Process IDs this persona is on. */
  caseMemberships: z.array(idSchema),
  /** Short description used on the persona picker. */
  blurb: z.string(),
  /** Persona shown by default on sign-in for the organisation. */
  featured: z.boolean().optional(),
  /**
   * Out of office, with a delegate who receives a copy of what this person is told (D-254).
   *
   * The copy is a notification of its own addressed to the delegate, rendered at the delegate's own
   * level rather than the absent person's: a delegate who could not read the case is told that
   * something happened on it and no more, which is the same rule every other recipient is under.
   * Nothing is forwarded outside the product, because nothing leaves the product at all.
   */
  outOfOffice: z
    .object({
      from: isoDate,
      to: isoDate,
      delegateUserId: idSchema.optional(),
      note: z.string().max(300).optional(),
    })
    .optional(),
});
export type User = z.infer<typeof userSchema>;
