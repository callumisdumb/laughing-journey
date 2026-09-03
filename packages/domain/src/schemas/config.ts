import { z } from 'zod';
import { HANDLING_INSTRUCTIONS, MARKING_PROFILES } from '../classification/classify';
import { AGENCIES, ALL_STAGES, CHANNELS, DETAIL_LEVELS, EXCLUSION_PARTIES, PROCESS_TYPES, ROLES } from '../enums';

export const clockRuleSchema = z.object({
  id: z.string(),
  process: z.enum(PROCESS_TYPES),
  unit: z.enum(['hours', 'calendar-days', 'working-days', 'weeks', 'months']),
  amount: z.number().positive(),
  kind: z.enum(['deadline', 'warning', 'expiry', 'review']),
  /** 'after' counts forward from the trigger (the default); 'before' counts back from an anchor such as a meeting date, for notice rules. */
  direction: z.enum(['after', 'before']).optional(),
  /** Days before due at which the clock turns medium (amber). */
  warnDays: z.number().int().nonnegative(),
  source: z.string(),
  sourceRef: z.string().optional(),
  confidence: z.enum(['high', 'verify', 'local', 'advisory']),
  /** Optional local override note, e.g. "Clydeshore procedures 2025". */
  localNote: z.string().optional(),
  /** Where the value is unverified in a primary source; surfaces a marker in Admin. */
  todoVerify: z.boolean().optional(),
  /** The rule may be deferred on professional judgement (recorded as a due date override with a reason). */
  deferrable: z.boolean().optional(),
  deferralNote: z.string().optional(),
});
export type ClockRule = z.infer<typeof clockRuleSchema>;

export const needToKnowRowSchema = z.object({
  id: z.string(),
  process: z.enum(PROCESS_TYPES),
  stage: z.enum(ALL_STAGES),
  audience: z.object({
    /** A concrete agency, or 'referrer' resolved from the process at runtime. */
    agency: z.union([z.enum(AGENCIES), z.literal('referrer')]),
    /** A role id, or 'any' for every role in the agency. */
    role: z.union([z.enum(ROLES), z.literal('any')]),
    label: z.string(),
  }),
  detailLevel: z.enum(DETAIL_LEVELS),
  fields: z.array(z.string()).optional(),
  channel: z.enum(CHANNELS),
  trigger: z.string(),
  /** Flag on the process that must be true for the row to apply (e.g. criminalElement). */
  condition: z.string().optional(),
  conditionLabel: z.string().optional(),
  /** Lawful basis hint shown to the recipient. */
  lawfulBasisHint: z.string(),
});
export type NeedToKnowRow = z.infer<typeof needToKnowRowSchema>;

export const exclusionSchema = z.object({
  id: z.string(),
  process: z.enum(PROCESS_TYPES),
  /** '*' for every stage. */
  stage: z.union([z.enum(ALL_STAGES), z.literal('*')]),
  /** Who is excluded, as a party key resolved against the case-role register on the process. */
  party: z.enum(EXCLUSION_PARTIES),
  label: z.string(),
  reason: z.string(),
  /** Some exclusions can be lifted by a recorded decision (e.g. a chair's decision). */
  liftableBy: z.string().optional(),
});
export type Exclusion = z.infer<typeof exclusionSchema>;

/**
 * A marking profile and its local handling instruction. The marking itself is derived from Annex 2
 * (see classification/classify.ts), not configured: an area may say how a marked record is handled,
 * but it cannot rename the marking or mark routine Official information.
 *
 * The profile is not a classification. `access-restricted` describes an Official-Sensitive record
 * that is also restricted, which is two properties rather than a third level.
 */
export const classificationMarkingSchema = z.object({
  id: z.enum(MARKING_PROFILES),
  /** The plain-language handling instruction, shown on a print pack cover and in the sharing preview. */
  handling: z.string(),
  /** Short instructions appended after the marking itself, from the Annex 2 allowance. */
  instructions: z.array(z.enum(HANDLING_INSTRUCTIONS)),
});

export const formVersionSchema = z.object({
  id: z.string(),
  label: z.string(),
  process: z.enum(PROCESS_TYPES),
  version: z.string(),
  effectiveFrom: z.string(),
  source: z.string(),
});

export const areaConfigSchema = z.object({
  councilName: z.string(),
  hscpName: z.string(),
  healthBoardName: z.string(),
  policeDivision: z.string(),
  ppuBase: z.string(),
  maracArea: z.string(),
  sheriffCourt: z.string(),
});

export const configSchema = z.object({
  area: areaConfigSchema,
  clockRules: z.array(clockRuleSchema),
  needToKnow: z.array(needToKnowRowSchema),
  exclusions: z.array(exclusionSchema),
  classificationMarkings: z.array(classificationMarkingSchema),
  /** Roles permitted to lower a derived classification, Annex 2. A lower outside them is refused, not silent. */
  classificationLowerableBy: z.array(z.enum(ROLES)),
  forms: z.array(formVersionSchema),
  defaults: z.object({
    theme: z.enum(['light', 'dark', 'system']),
    density: z.enum(['comfortable', 'compact']),
  }),
  /** ASP s52 council officer eligibility, configurable per council. TODO(verify) against local rule. */
  aspCouncilOfficerEligibility: z.array(z.string()),
  /** Scottish bank holidays used by working-day clocks (ISO dates), from the gov.uk feed. */
  bankHolidays: z.array(z.string()),
  /** Council local holidays (ISO dates), kept separately from the national list; working-day clocks skip both. */
  councilHolidays: z.array(z.string()),
  /** Break-glass window in hours. */
  breakGlassHours: z.number().int().positive(),
  /** Reason categories offered in the break-glass dialog; the free-text reason is recorded alongside. */
  breakGlassReasons: z.array(z.string()).min(1),
  /** Editions in use, shown in Help and Admin. */
  guidanceEditions: z.array(z.object({ id: z.string(), label: z.string(), edition: z.string() })),
});
export type Config = z.infer<typeof configSchema>;
