import type { HeldForm } from './registry';
import { ASP_CASE_CONFERENCE_HELD, ASP_REVIEW_OUTCOME } from './AspOutcomeForms';
import { CP_CPPM_HELD, CP_IRD_DECISIONS } from './CpMeetingForms';
import { CP_CORE_GROUP, CP_REVIEW_CPPM_HELD } from './CpOutcomeForms';
import { MARAC_HEARD } from './MaracHeardForm';

/**
 * The outcome form each meeting-fired transition opens when the meeting is closed (D-213), keyed
 * on the transition id. A transition without a form here cannot close its meeting, and the dialog
 * says so rather than holding a meeting with nothing decided.
 */
export const HELD_FORMS: Readonly<Record<string, HeldForm>> = {
  'asp-case-conference-held': ASP_CASE_CONFERENCE_HELD,
  'asp-review-outcome': ASP_REVIEW_OUTCOME,
  'marac-heard': MARAC_HEARD,
  'cp-review-cppm-held': CP_REVIEW_CPPM_HELD,
  'cp-core-group-meeting': CP_CORE_GROUP,
  'cp-ird-decisions': CP_IRD_DECISIONS,
  'cp-cppm-held': CP_CPPM_HELD,
};

export type { OutcomeFormProps } from './registry';
