/** Stage labels per process. Display text; the identifiers are the enum values. */
export const ASP_STAGE_LABELS: Record<string, string> = {
  concern: 'Adult concern',
  screening: 'Screening',
  inquiry: 'Inquiry (s4)',
  investigation: 'Investigation',
  'case-conference': 'Case conference',
  'protection-plan': 'Protection plan',
  'support-plan': 'Support plan',
  review: 'Review',
  closed: 'Closed',
};
export const CP_STAGE_LABELS: Record<string, string> = {
  concern: 'Child concern',
  ird: 'IRD',
  investigation: 'Investigation',
  cppm: 'CPPM',
  'childs-plan': "Child's plan",
  review: 'Review',
  deregistered: 'De-registered',
  closed: 'Closed',
};
export const MARAC_STAGE_LABELS: Record<string, string> = {
  referral: 'Referral',
  research: 'Research',
  meeting: 'Meeting',
  'action-plan': 'Action plan',
  feedback: 'Feedback',
  transferred: 'Transferred',
  closed: 'Closed',
};
export const MAPPA_STAGE_LABELS: Record<string, string> = {
  notification: 'Notification',
  referral: 'Referral',
  'pre-meeting': 'Pre-meeting sharing',
  meeting: 'Meeting',
  managed: 'Managed',
  exit: 'Exit',
};
export const AWI_STAGE_LABELS: Record<string, string> = {
  'capacity-concern': 'Capacity concern',
  'existing-powers': 'Existing powers',
  'route-decision': 'Route decision',
  application: 'Application',
  order: 'Order',
  supervision: 'Supervision',
  closed: 'Closed',
};

export const STAGE_LABELS_BY_PROCESS = {
  asp: ASP_STAGE_LABELS,
  cp: CP_STAGE_LABELS,
  marac: MARAC_STAGE_LABELS,
  mappa: MAPPA_STAGE_LABELS,
  awi: AWI_STAGE_LABELS,
} as const;

export function stageLabel(process: keyof typeof STAGE_LABELS_BY_PROCESS, stage: string): string {
  return STAGE_LABELS_BY_PROCESS[process][stage] ?? stage;
}
