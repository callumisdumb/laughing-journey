import { z } from 'zod';
import { AGENCIES, PROCESS_TYPES, ROLES } from '../enums';
import { idSchema, syntheticSchema } from './common';

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
});
export type User = z.infer<typeof userSchema>;
