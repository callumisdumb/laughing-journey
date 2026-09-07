import { z } from 'zod';
import { correctable, idSchema, isoDate, isoDateTime, syntheticSchema } from './common';

/**
 * A return, marked as submitted (D-247).
 *
 * The reports are computed from the dataset and read only, and that stays true: this records that a
 * named person sent a named period's return to the body that receives it, on a date, with whatever
 * reference came back. It is the answer to "did we send Q2", which a partnership needs on a screen
 * rather than in somebody's mailbox, and it is what completes the submission-deadline clocks.
 *
 * It is a record of an act outside the product, so it never says the product sent anything: the
 * recipient, the route and the reference are all typed by the person who did it.
 */
export const RETURN_KINDS = ['asp', 'cp', 'marac', 'mappa', 'awi'] as const;
export type ReturnKind = (typeof RETURN_KINDS)[number];

export const submissionSchema = z.object({
  id: idSchema,
  synthetic: syntheticSchema,
  kind: z.enum(RETURN_KINDS),
  /** The reporting period's id, as the report screen names it (`q3-2026`, `y2027`, `b2027`). */
  periodId: z.string().min(1),
  /** The period as a person reads it, kept so a renamed period label does not orphan the record. */
  periodLabel: z.string().min(1),
  /** Where it went: ASPData@gov.scot, SafeLives, the Commission, and so on. */
  recipient: z.string().min(1).max(200),
  /** How it was sent, in the sender's words. */
  route: z.string().max(200).optional(),
  submittedOn: isoDate,
  /** Whatever reference the receiving body gave back, where it gave one. */
  reference: z.string().max(120).optional(),
  note: z.string().max(600).optional(),
  submittedByUserId: idSchema.optional(),
  submittedByName: z.string(),
  recordedAt: isoDateTime,
  /** The NMDS quarter this submission answers, where the return is the ASP one (`q1` to `q4`). */
  nmdsQuarter: z.enum(['q1', 'q2', 'q3', 'q4']).optional(),
  ...correctable,
});
export type Submission = z.infer<typeof submissionSchema>;
