import { z } from 'zod';
import { MAPPA_MUST_NOT_RECEIVE_PARTIES, mustNotReceiveListSchema } from './must-not-receive';

/**
 * MAPPA referral to Level 2 or 3. Must be informed by a current risk assessment
 * (MAPPA National Guidance 2022, stage 2). Form version mappa.referral 2022.1.
 */
export const mappaReferralFormSchema = z
  .object({
    category: z.union([z.literal(1), z.literal(2), z.literal(3)]),
    levelSought: z.union([z.literal(2), z.literal(3)]),
    leadResponsibleAuthority: z.enum(['police', 'social-work', 'health', 'sps']),
    riskAssessmentIds: z.array(z.string()).min(1, 'A referral must be informed by a current risk assessment'),
    reason: z.string().min(40, 'Explain why active multi-agency management is needed (at least 40 characters)').max(2000),
    imminentRisk: z.boolean(),
    victimConsiderations: z.string().min(10, 'Record victim safety considerations; the Victim Notification Scheme is separate').max(1200),
    accommodationIssue: z.boolean(),
    disclosureConsidered: z.boolean(),
    visorReference: z.string().min(3, 'Enter the ViSOR (MAPPS) reference'),
    /** Anyone else who must not receive information about this case; each entry feeds the case-role register. */
    mustNotReceive: mustNotReceiveListSchema(MAPPA_MUST_NOT_RECEIVE_PARTIES),
  })
  .superRefine((v, ctx) => {
    if (v.category === 3 && v.levelSought < 2) ctx.addIssue({ code: 'custom', path: ['levelSought'], message: 'Category 3 cannot be managed at Level 1' });
    if (v.levelSought === 3 && !v.imminentRisk) ctx.addIssue({ code: 'custom', path: ['imminentRisk'], message: 'Level 3 is for the critical few: confirm imminent risk of serious harm' });
  });

export type MappaReferralForm = z.input<typeof mappaReferralFormSchema>;
