import type { TransitionForm } from './registry';
import { ASP_INQUIRY_OUTCOME, ASP_INVESTIGATORY_STEP, ASP_OPEN_INQUIRY, ASP_PROTECTION_PLAN, ASP_SCREENING, ASP_SUPPORT_PLAN } from './AspForms';
import { CP_BIRTH, CP_DEREGISTER, CP_RECORD_JII, CP_RECORD_MEDICAL } from './CpForms';
import { MAPPA_EXIT, MAPPA_RECORD_RETURN, MAPPA_REQUEST_RETURNS } from './MappaForms';
import { MARAC_ACTION_PLAN, MARAC_IDAA_FEEDBACK, MARAC_LINK_CP_CONCERN, MARAC_RESEARCH_REQUESTS, MARAC_RESEARCH_RETURN, MARAC_TRANSFER } from './MaracForms';

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
  'cp-record-jii': CP_RECORD_JII,
  'cp-record-medical': CP_RECORD_MEDICAL,
  'cp-deregister': CP_DEREGISTER,
  'cp-birth': CP_BIRTH,
  'marac-send-research-requests': MARAC_RESEARCH_REQUESTS,
  'marac-record-research-return': MARAC_RESEARCH_RETURN,
  'marac-record-action-plan': MARAC_ACTION_PLAN,
  'marac-link-cp-concern': MARAC_LINK_CP_CONCERN,
  'marac-idaa-feedback': MARAC_IDAA_FEEDBACK,
  'marac-transfer': MARAC_TRANSFER,
  'mappa-request-returns': MAPPA_REQUEST_RETURNS,
  'mappa-record-return': MAPPA_RECORD_RETURN,
  'mappa-exit': MAPPA_EXIT,
};

export type { TransitionForm, TransitionFormContext, TransitionFormProps } from './registry';
