import { z } from 'zod';
import { HANDLING_INSTRUCTIONS, MARKING_PROFILES } from '../classification/classify';
import { AGENCIES, ALL_STAGES, CHANNELS, DETAIL_LEVELS, EXCLUSION_PARTIES, PROCESS_TYPES, ROLES } from '../enums';

/** One national bank holiday, as the gov.uk feed gives it. `bunting` is dropped; `notes` is not. */
export const bankHolidaySchema = z.object({ date: z.string(), title: z.string(), notes: z.string() });

/** A council's own local holiday. Never mixed with the national list. */
export const councilHolidaySchema = z.object({ date: z.string(), title: z.string() });

/** Whether an organisation observes a national holiday. `organisationId` absent means the partnership. */
export const holidayObservanceSchema = z.object({
  date: z.string(),
  organisationId: z.string().optional(),
  observed: z.boolean(),
  reason: z.string().optional(),
});

/** Where the national list came from, and the range it covers. */
export const calendarProvenanceSchema = z.object({
  source: z.string(),
  division: z.string(),
  fetchedAt: z.string(),
  coversFrom: z.string(),
  coversTo: z.string(),
});

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
  /**
   * Whose working calendar the rule is counted against. The council's unless a rule says otherwise:
   * `marac.research.return` crosses agencies that include Police Scotland, which operates every day
   * of the year, so the shape is here even though nothing populates it yet (D-194).
   */
  calendar: z.enum(['council', 'health', 'everyDay']).optional(),
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
  /**
   * Roles that may not receive Official-Sensitive content. A share to one of these carries the
   * marking and the reason and withholds the content, rather than arriving and being read.
   *
   * Stated as an exclusion rather than a permission list on purpose: a permitted-roles list is wrong
   * the first time a role is added and nobody remembers to extend it, and it would be wrong in the
   * direction that withholds information from someone who needs it. TODO(verify) against the
   * partnership's own information sharing agreement, which is what actually decides this.
   */
  officialSensitiveWithheldFrom: z.array(z.enum(ROLES)),
  forms: z.array(formVersionSchema),
  defaults: z.object({
    theme: z.enum(['light', 'dark', 'system']),
    density: z.enum(['comfortable', 'compact']),
  }),
  /** ASP s52 council officer eligibility, configurable per council. TODO(verify) against local rule. */
  aspCouncilOfficerEligibility: z.array(z.string()),
  /**
   * The national list, Scotland division, from the committed gov.uk fixture. Titles and notes are
   * kept: "Substitute day" is the answer to why 28 December 2026 is a holiday and it belongs on
   * screen rather than buried. The application never fetches the feed (D-192).
   */
  bankHolidays: z.array(bankHolidaySchema),
  /** Where the national list came from, shown on the Admin calendar. */
  bankHolidayProvenance: calendarProvenanceSchema,
  /**
   * Which national holidays an organisation does not observe. Absent means observed, because that
   * is the ordinary case. Councils and health boards do not universally close on every bank holiday
   * and some substitute local days for them.
   */
  holidayObservance: z.array(holidayObservanceSchema),
  /** Council local holidays, kept entirely separate from the national list in the data, on the Admin screen and in the calculation. */
  councilHolidays: z.array(councilHolidaySchema),
  /** Break-glass window in hours. */
  breakGlassHours: z.number().int().positive(),
  /** Reason categories offered in the break-glass dialog; the free-text reason is recorded alongside. */
  breakGlassReasons: z.array(z.string()).min(1),
  /** Editions in use, shown in Help and Admin. */
  guidanceEditions: z.array(z.object({ id: z.string(), label: z.string(), edition: z.string() })),
});
export type Config = z.infer<typeof configSchema>;
