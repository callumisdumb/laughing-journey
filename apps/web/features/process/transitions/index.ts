import type { TransitionForm } from './registry';
import { ASP_INQUIRY_OUTCOME, ASP_INVESTIGATORY_STEP, ASP_OPEN_INQUIRY, ASP_PROTECTION_PLAN, ASP_SCREENING, ASP_SUPPORT_PLAN } from './AspForms';

/**
 * The form each transition opens from the case (D-217), keyed on the transition id. Transitions
 * that schedule a meeting open the schedule dialog, those a meeting fires open from the meeting
 * workspace, and those recorded through a dialog that already exists open that dialog; everything
 * else needs an entry here, and a transition without one is offered as not yet built rather than
 * as a button that does nothing.
 */
export const TRANSITION_FORMS: Readonly<Record<string, TransitionForm>> = {
  'asp-screening-decision': ASP_SCREENING,
  'asp-open-inquiry': ASP_OPEN_INQUIRY,
  'asp-inquiry-outcome': ASP_INQUIRY_OUTCOME,
  'asp-investigatory-step': ASP_INVESTIGATORY_STEP,
  'asp-record-protection-plan': ASP_PROTECTION_PLAN,
  'asp-record-support-plan': ASP_SUPPORT_PLAN,
};

export type { TransitionForm, TransitionFormContext, TransitionFormProps } from './registry';
