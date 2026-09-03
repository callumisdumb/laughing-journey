import { z } from 'zod';

/**
 * Capacity assessment under the Adults with Incapacity (Scotland) Act 2000.
 * Capacity is decision-specific and time-specific. Form version awi.capacity-assessment 2020.1.
 */
export const capacityAssessmentFormSchema = z
  .object({
    decision: z.string().min(10, 'Name the specific decision (capacity is decision-specific)').max(300),
    assessedAt: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Enter the date of assessment'),
    assessorName: z.string().min(3),
    assessorRole: z.string().min(3),
    communicationSupport: z.string().max(300).optional(),
    /** The functional test, item by item. */
    understands: z.enum(['yes', 'no', 'partly']),
    retains: z.enum(['yes', 'no', 'partly']),
    weighs: z.enum(['yes', 'no', 'partly']),
    communicates: z.enum(['yes', 'no', 'partly']),
    acts: z.enum(['yes', 'no', 'partly']),
    evidence: z.string().min(40, 'Record the evidence for the conclusion (at least 40 characters)').max(2000),
    outcome: z.enum(['has-capacity', 'lacks-capacity', 'fluctuating']),
    wishesConsidered: z.string().min(10, "Record the adult's past and present wishes").max(1200),
  })
  .superRefine((v, ctx) => {
    const allYes = [v.understands, v.retains, v.weighs, v.communicates, v.acts].every((x) => x === 'yes');
    if (allYes && v.outcome === 'lacks-capacity') ctx.addIssue({ code: 'custom', path: ['outcome'], message: 'Every functional item is met; explain why the outcome is lacks capacity, or change it' });
  });

export type CapacityAssessmentForm = z.input<typeof capacityAssessmentFormSchema>;
