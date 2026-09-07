import { t } from '@mas/messages';
import { HARM_TYPES } from '../enums';
import { z } from 'zod';

/**
 * ASP (Scotland) Act 2007 s3: the three-point test. All three limbs must be met.
 * Each limb carries the practitioner's reasoning. Form version asp.three-point-test 2022.1.
 */
const limb = z.object({
  met: z.enum(['yes', 'no', 'unclear']),
  reasoning: z.string().min(20, { error: () => t('errors.threePointTest.reasoning', { min: 20 }) }).max(1200),
});

export const threePointTestFormSchema = z
  .object({
    assessedAt: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, { error: () => t('errors.forms.enterAssessmentDate') }),
    a: limb,
    b: limb,
    c: limb,
    harmTypes: z.array(z.enum(HARM_TYPES)).min(1, { error: () => t('errors.threePointTest.harmTypes') }),
    immediateSafety: z.string().min(10, { error: () => t('errors.threePointTest.immediateSafety') }).max(600),
  })
  .transform((v) => ({ ...v, outcome: v.a.met === 'yes' && v.b.met === 'yes' && v.c.met === 'yes' ? ('met' as const) : v.a.met === 'no' || v.b.met === 'no' || v.c.met === 'no' ? ('not-met' as const) : ('unclear' as const) }));

export type ThreePointTestForm = z.input<typeof threePointTestFormSchema>;
export type ThreePointTestResult = z.output<typeof threePointTestFormSchema>;

/** The three limbs; label and text are read from the catalogue on each access so an Admin override applies. */
export const THREE_POINT_LIMBS = {
  a: {
    get label() {
      return t('forms.threePointTest.limbA.label');
    },
    get text() {
      return t('forms.threePointTest.limbA.text');
    },
  },
  b: {
    get label() {
      return t('forms.threePointTest.limbB.label');
    },
    get text() {
      return t('forms.threePointTest.limbB.text');
    },
  },
  c: {
    get label() {
      return t('forms.threePointTest.limbC.label');
    },
    get text() {
      return t('forms.threePointTest.limbC.text');
    },
  },
} as const;
