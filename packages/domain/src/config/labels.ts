/** Process labels that vary by local area. Admin edits these. */
export const DEFAULT_LABELS: Record<string, string> = {
  'cp.ird': 'Inter-agency Referral Discussion (IRD)',
  'cp.ird.short': 'IRD',
  'cp.cppm': 'Child Protection Planning Meeting (CPPM)',
  'cp.cppm.short': 'CPPM',
  'cp.core-group': 'Core group',
  'cp.register': 'Child Protection Register',
  'asp.case-conference': 'ASP case conference',
  'asp.inter-agency-discussion': 'ASP inter-agency discussion',
  'asp.council-officer': 'Council officer',
  'asp.protection-plan': 'Adult Protection Plan',
  'marac.meeting': 'MARAC',
  'marac.idaa': 'Independent Domestic Abuse Advocate (IDAA)',
  'mappa.level2': 'MAPPA Level 2 meeting',
  'mappa.level3': 'MAPPP (Level 3)',
  'awi.mho': 'Mental Health Officer (MHO)',
  'awi.s13za': 'Section 13ZA arrangement',
  'org.council': 'Council',
  'org.health-board': 'Health board',
  'org.sheriff-court': 'Sheriff court',
  'org.reporter': 'Reporter',
  'org.procurator-fiscal': 'Procurator fiscal',
};

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
