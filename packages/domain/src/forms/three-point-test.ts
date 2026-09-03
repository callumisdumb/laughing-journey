import { z } from 'zod';

/**
 * ASP (Scotland) Act 2007 s3: the three-point test. All three limbs must be met.
 * Each limb carries the practitioner's reasoning. Form version asp.three-point-test 2022.1.
 */
const limb = z.object({
  met: z.enum(['yes', 'no', 'unclear']),
  reasoning: z.string().min(20, 'Give the reasoning for this limb (at least 20 characters)').max(1200),
});

export const threePointTestFormSchema = z
  .object({
    assessedAt: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Enter the date of assessment'),
    a: limb,
    b: limb,
    c: limb,
    harmTypes: z.array(z.enum(['physical', 'sexual', 'psychological', 'financial', 'neglect', 'self-harm', 'self-neglect'])).min(1, 'Record at least one type of harm'),
    immediateSafety: z.string().min(10, 'Say what is in place for immediate safety').max(600),
  })
  .transform((v) => ({ ...v, outcome: v.a.met === 'yes' && v.b.met === 'yes' && v.c.met === 'yes' ? ('met' as const) : v.a.met === 'no' || v.b.met === 'no' || v.c.met === 'no' ? ('not-met' as const) : ('unclear' as const) }));

export type ThreePointTestForm = z.input<typeof threePointTestFormSchema>;
export type ThreePointTestResult = z.output<typeof threePointTestFormSchema>;

export const THREE_POINT_LIMBS = {
  a: { label: 'Limb (a): unable to safeguard', text: 'Is the adult unable to safeguard their own wellbeing, property, rights or other interests?' },
  b: { label: 'Limb (b): at risk of harm', text: 'Is the adult at risk of harm? Harm is all harm: physical, sexual, psychological, financial, neglect, self-harm and self-neglect.' },
  c: { label: 'Limb (c): more vulnerable', text: 'Because the adult is affected by disability, mental disorder, illness or physical or mental infirmity, are they more vulnerable to being harmed than adults who are not so affected?' },
} as const;
