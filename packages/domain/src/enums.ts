/**
 * Enumerations shared across the platform. Every enum is a `const` tuple so Zod
 * schemas and TypeScript types derive from the same list.
 */

export const AGENCIES = [
  'police',
  'social-work',
  'health',
  'education',
  'housing',
  'third-sector',
  'sps',
  'scra',
  'court',
  'regulator',
  'fire-rescue',
] as const;
export type Agency = (typeof AGENCIES)[number];

export const AGENCY_LABELS: Record<Agency, string> = {
  police: 'Police Scotland',
  'social-work': 'Social work',
  health: 'Health',
  education: 'Education',
  housing: 'Housing',
  'third-sector': 'Third sector',
  sps: 'Scottish Prison Service',
  scra: 'SCRA',
  court: 'Court',
  regulator: 'Regulator',
  'fire-rescue': 'Fire and rescue',
};

export const AGENCY_SHORT: Record<Agency, string> = {
  police: 'Police',
  'social-work': 'Social work',
  health: 'Health',
  education: 'Education',
  housing: 'Housing',
  'third-sector': 'Third sector',
  sps: 'SPS',
  scra: 'SCRA',
  court: 'Court',
  regulator: 'Regulator',
  'fire-rescue': 'Fire and rescue',
};

export const PROCESS_TYPES = ['asp', 'cp', 'marac', 'mappa', 'awi'] as const;
export type ProcessType = (typeof PROCESS_TYPES)[number];

export const PROCESS_LABELS: Record<ProcessType, string> = {
  asp: 'Adult Support and Protection',
  cp: 'Child protection',
  marac: 'MARAC',
  mappa: 'MAPPA',
  awi: 'Adults with Incapacity',
};

export const PROCESS_SHORT: Record<ProcessType, string> = {
  asp: 'ASP',
  cp: 'CP',
  marac: 'MARAC',
  mappa: 'MAPPA',
  awi: 'AWI',
};

export const ASP_STAGES = [
  'concern',
  'screening',
  'inquiry',
  'investigation',
  'case-conference',
  'protection-plan',
  'support-plan',
  'review',
  'closed',
] as const;
export const CP_STAGES = [
  'concern',
  'ird',
  'investigation',
  'cppm',
  'childs-plan',
  'review',
  'deregistered',
  'closed',
] as const;
export const MARAC_STAGES = [
  'referral',
  'research',
  'meeting',
  'action-plan',
  'feedback',
  'transferred',
  'closed',
] as const;
export const MAPPA_STAGES = [
  'notification',
  'referral',
  'pre-meeting',
  'meeting',
  'managed',
  'exit',
] as const;
export const AWI_STAGES = [
  'capacity-concern',
  'existing-powers',
  'route-decision',
  'application',
  'order',
  'supervision',
  'closed',
] as const;

export const STAGES_BY_PROCESS = {
  asp: ASP_STAGES,
  cp: CP_STAGES,
  marac: MARAC_STAGES,
  mappa: MAPPA_STAGES,
  awi: AWI_STAGES,
} as const;

export const ALL_STAGES = [
  ...ASP_STAGES,
  ...CP_STAGES,
  ...MARAC_STAGES,
  ...MAPPA_STAGES,
  ...AWI_STAGES,
] as const;
export type Stage = (typeof ALL_STAGES)[number];

export const DETAIL_LEVELS = ['presence', 'summary', 'full', 'fields'] as const;
export type DetailLevel = (typeof DETAIL_LEVELS)[number];

export const DETAIL_LEVEL_LABELS: Record<DetailLevel, string> = {
  presence: 'Presence only',
  summary: 'Summary',
  full: 'Full record',
  fields: 'Named fields only',
};

export const VISIBILITIES = ['agency-only', 'integrated', 'restricted'] as const;
export type Visibility = (typeof VISIBILITIES)[number];

export const SIGNIFICANCES = ['low', 'moderate', 'high'] as const;
export type Significance = (typeof SIGNIFICANCES)[number];

export const RISK_BANDS = ['critical', 'high', 'medium', 'low', 'unknown'] as const;
export type RiskBand = (typeof RISK_BANDS)[number];

export const CLASSIFICATIONS = ['official', 'official-sensitive', 'restricted'] as const;
export type Classification = (typeof CLASSIFICATIONS)[number];

export const CLASSIFICATION_LABELS: Record<Classification, string> = {
  official: 'OFFICIAL',
  'official-sensitive': 'OFFICIAL-SENSITIVE',
  restricted: 'OFFICIAL-SENSITIVE: RESTRICTED',
};

export const LIFE_STAGES = ['unborn', 'child', 'adult'] as const;
export type LifeStage = (typeof LIFE_STAGES)[number];

export const CHANNELS = ['in-app', 'secure-email-digest', 'connector-push'] as const;
export type Channel = (typeof CHANNELS)[number];

export const CONNECTOR_IDS = [
  'emis-web',
  'eclipse',
  'carefirst',
  'ivpd',
  'seemis',
  'trakcare',
  'morse',
  'opg',
  'scra',
  'visor',
] as const;
export type ConnectorId = (typeof CONNECTOR_IDS)[number];

export const SOURCE_SYSTEMS = ['manual', ...CONNECTOR_IDS] as const;
export type SourceSystem = (typeof SOURCE_SYSTEMS)[number];

/** Event type taxonomy (brief 4.7). Dotted families so filters can match a prefix. */
export const EVENT_TYPES = [
  'family.birth',
  'family.death',
  'family.change',
  'move.address',
  'household.change',
  'health.attendance',
  'health.admission',
  'health.discharge',
  'health.consultation',
  'health.diagnosis',
  'health.missed-appointment',
  'health.assessment',
  'education.enrolment',
  'education.attendance',
  'education.exclusion',
  'education.concern',
  'police.concern-report',
  'police.incident',
  'police.charge',
  'police.conviction',
  'police.custody',
  'police.release',
  'police.bail-condition',
  'police.notification',
  'social-work.referral',
  'social-work.assessment',
  'social-work.visit',
  'social-work.allocation',
  'social-work.plan-review',
  'social-work.contact',
  'care.placement',
  'care.service-start',
  'care.service-end',
  'care.provider-concern',
  'legal.order-granted',
  'legal.hearing',
  'legal.guardianship',
  'legal.poa-registered',
  'legal.licence',
  'process.ird',
  'process.cppm',
  'process.registration',
  'process.deregistration',
  'process.case-conference',
  'process.marac',
  'process.mappa-level',
  'process.core-group',
  'process.referral',
  'voice.adult',
  'voice.child',
  'voice.victim',
  'voice.family',
  'disclosure',
  'sharing',
  'other',
] as const;
export type EventType = (typeof EVENT_TYPES)[number];

export const EVENT_FAMILIES = [
  'family',
  'move',
  'household',
  'health',
  'education',
  'police',
  'social-work',
  'care',
  'legal',
  'process',
  'voice',
  'disclosure',
  'sharing',
  'other',
] as const;
export type EventFamily = (typeof EVENT_FAMILIES)[number];

export const EVENT_FAMILY_LABELS: Record<EventFamily, string> = {
  family: 'Birth and family',
  move: 'Address move',
  household: 'Household change',
  health: 'Health',
  education: 'Education',
  police: 'Police',
  'social-work': 'Social work',
  care: 'Care and support',
  legal: 'Legal',
  process: 'Protection process',
  voice: 'Views and voice',
  disclosure: 'Disclosure',
  sharing: 'Information shared',
  other: 'Other',
};

export function eventFamily(type: EventType): EventFamily {
  const head = type.split('.')[0] as EventFamily;
  return EVENT_FAMILIES.includes(head) ? head : 'other';
}

export const MEETING_TYPES = [
  'ird',
  'cppm',
  'cppm-review',
  'pre-birth-cppm',
  'core-group',
  'asp-inter-agency-discussion',
  'asp-case-conference',
  'asp-review-conference',
  'lsi-planning',
  'marac',
  'mappa-level2',
  'mappa-level3',
  'awi-mdt',
] as const;
export type MeetingType = (typeof MEETING_TYPES)[number];

export const MEETING_TYPE_LABELS: Record<MeetingType, string> = {
  ird: 'Inter-agency Referral Discussion',
  cppm: 'Child Protection Planning Meeting',
  'cppm-review': 'Review Child Protection Planning Meeting',
  'pre-birth-cppm': 'Pre-birth Child Protection Planning Meeting',
  'core-group': 'Core group',
  'asp-inter-agency-discussion': 'ASP inter-agency discussion',
  'asp-case-conference': 'ASP case conference',
  'asp-review-conference': 'ASP review case conference',
  'lsi-planning': 'Large Scale Investigation planning meeting',
  marac: 'MARAC',
  'mappa-level2': 'MAPPA Level 2 meeting',
  'mappa-level3': 'MAPPP (Level 3)',
  'awi-mdt': 'AWI multi-disciplinary discussion',
};

export const ACTION_STATUSES = ['open', 'in-progress', 'complete', 'cancelled'] as const;
export type ActionStatus = (typeof ACTION_STATUSES)[number];

export const PLAN_TYPES = [
  'interim-safety',
  'childs-plan',
  'adult-protection',
  'adult-support',
  'marac-action',
  'mappa-rmp',
] as const;
export type PlanType = (typeof PLAN_TYPES)[number];

export const PLAN_TYPE_LABELS: Record<PlanType, string> = {
  'interim-safety': 'Interim safety plan',
  'childs-plan': "Child's plan",
  'adult-protection': 'Adult Protection Plan',
  'adult-support': 'Support plan',
  'marac-action': 'MARAC action plan',
  'mappa-rmp': 'Risk Management Plan',
};

export const RISK_TOOLS = [
  'dash',
  'daq',
  'three-point-test',
  'rm2000',
  'sa07',
  'lscmi',
  'capacity',
  'mappa-level',
  'other',
] as const;
export type RiskTool = (typeof RISK_TOOLS)[number];

export const RISK_TOOL_LABELS: Record<RiskTool, string> = {
  dash: 'SafeLives DASH risk checklist',
  daq: 'Police Scotland Domestic Abuse Questions (DAQ)',
  'three-point-test': 'ASP three-point test',
  rm2000: 'Risk Matrix 2000',
  sa07: 'Stable and Acute 2007',
  lscmi: 'LS/CMI',
  capacity: 'Capacity assessment',
  'mappa-level': 'MAPPA level decision',
  other: 'Other tool',
};

export const VIEWS_KINDS = [
  'adult-views',
  'child-voice',
  'victim-wishes',
  'family-views',
  'carer-views',
] as const;
export type ViewsKind = (typeof VIEWS_KINDS)[number];

export const VIEWS_KIND_LABELS: Record<ViewsKind, string> = {
  'adult-views': "Adult's views",
  'child-voice': "Child's voice",
  'victim-wishes': "Victim's wishes (via IDAA)",
  'family-views': "Family's views",
  'carer-views': "Carer's views",
};

export const CONSENT_STATUSES = [
  'not-required',
  'sought-and-given',
  'sought-and-refused-overridden',
  'not-sought-risk',
] as const;
export type ConsentStatus = (typeof CONSENT_STATUSES)[number];

export const CONSENT_STATUS_LABELS: Record<ConsentStatus, string> = {
  'not-required': 'Consent not required',
  'sought-and-given': 'Consent sought and given',
  'sought-and-refused-overridden': 'Consent sought and refused, overridden with reason',
  'not-sought-risk': 'Consent not sought because it would increase risk',
};

export const AUDIT_ACTS = [
  'read',
  'read-restricted',
  'share',
  'break-glass',
  'persona-switch',
  'export',
  'edit',
  'promote',
  'sign-in',
] as const;
export type AuditAct = (typeof AUDIT_ACTS)[number];

export const RELATIONSHIP_TYPES = [
  'mother-of',
  'father-of',
  'parent-of',
  'step-parent-of',
  'child-of',
  'unborn-child-of',
  'partner-of',
  'ex-partner-of',
  'sibling-of',
  'grandparent-of',
  'grandchild-of',
  'aunt-or-uncle-of',
  'nephew-or-niece-of',
  'relative-of',
  'carer-of',
  'attorney-for',
  'guardian-for',
  'lives-with',
  'associate-of',
  'landlord-of',
  'professional-for',
] as const;
export type RelationshipType = (typeof RELATIONSHIP_TYPES)[number];

export const ROLES = [
  'social-worker-adults',
  'social-worker-children',
  'team-leader',
  'council-officer-asp',
  'mho',
  'justice-social-worker',
  'mappa-coordinator',
  'marac-coordinator',
  'chair',
  'minute-taker',
  'housing-officer',
  'education-cp-lead',
  'cswo',
  'detective-sergeant-ppu',
  'domestic-abuse-officer',
  'offender-management',
  'concern-hub-officer',
  'cp-nurse-adviser',
  'gp',
  'health-visitor',
  'midwife',
  'cmhn',
  'discharge-coordinator',
  'caldicott-guardian',
  'idaa',
  'womens-aid-worker',
  'independent-advocate',
  'prison-social-worker',
  'apc-lead-officer',
  'cpc-lead-officer',
  'inspector',
  'system-administrator',
  'care-inspectorate-officer',
  'opg-officer',
  'mwc-officer',
  'reporter',
  'fire-safety-officer',
  'procurator-fiscal',
] as const;
export type RoleId = (typeof ROLES)[number];

export interface RoleDefinition {
  id: RoleId;
  label: string;
  agency: Agency;
  /** Organisation kind the role belongs to. */
  organisation: OrganisationKind;
  /** Oversight roles see across cases with restrictions. */
  oversight?: 'read-only' | 'sign-off' | 'audit' | 'admin' | 'redacted';
}

export const ORGANISATION_KINDS = [
  'council',
  'hscp',
  'health-board',
  'police',
  'third-sector',
  'sps',
  'scra',
  'court',
  'regulator',
  'fire-rescue',
] as const;
export type OrganisationKind = (typeof ORGANISATION_KINDS)[number];

export const ROLE_DEFINITIONS: Record<RoleId, RoleDefinition> = {
  'social-worker-adults': { id: 'social-worker-adults', label: 'Social worker (adults)', agency: 'social-work', organisation: 'hscp' },
  'social-worker-children': { id: 'social-worker-children', label: 'Social worker (children and families)', agency: 'social-work', organisation: 'council' },
  'team-leader': { id: 'team-leader', label: 'Team leader', agency: 'social-work', organisation: 'council' },
  'council-officer-asp': { id: 'council-officer-asp', label: 'Council officer (ASP)', agency: 'social-work', organisation: 'hscp' },
  mho: { id: 'mho', label: 'Mental Health Officer', agency: 'social-work', organisation: 'hscp' },
  'justice-social-worker': { id: 'justice-social-worker', label: 'Justice social worker', agency: 'social-work', organisation: 'council' },
  'mappa-coordinator': { id: 'mappa-coordinator', label: 'MAPPA Coordinator', agency: 'social-work', organisation: 'council' },
  'marac-coordinator': { id: 'marac-coordinator', label: 'MARAC Coordinator', agency: 'social-work', organisation: 'council' },
  chair: { id: 'chair', label: 'Independent reviewing chair', agency: 'social-work', organisation: 'council' },
  'minute-taker': { id: 'minute-taker', label: 'Minute taker', agency: 'social-work', organisation: 'council' },
  'housing-officer': { id: 'housing-officer', label: 'Housing officer', agency: 'housing', organisation: 'council' },
  'education-cp-lead': { id: 'education-cp-lead', label: 'Head teacher (child protection lead)', agency: 'education', organisation: 'council' },
  cswo: { id: 'cswo', label: 'Chief Social Work Officer', agency: 'social-work', organisation: 'council', oversight: 'sign-off' },
  'detective-sergeant-ppu': { id: 'detective-sergeant-ppu', label: 'Detective sergeant, Public Protection Unit', agency: 'police', organisation: 'police' },
  'domestic-abuse-officer': { id: 'domestic-abuse-officer', label: 'Domestic abuse unit officer', agency: 'police', organisation: 'police' },
  'offender-management': { id: 'offender-management', label: 'Offender management (sex offender liaison)', agency: 'police', organisation: 'police' },
  'concern-hub-officer': { id: 'concern-hub-officer', label: 'Concern hub officer', agency: 'police', organisation: 'police' },
  'cp-nurse-adviser': { id: 'cp-nurse-adviser', label: 'Child protection nurse adviser', agency: 'health', organisation: 'health-board' },
  gp: { id: 'gp', label: 'GP', agency: 'health', organisation: 'health-board' },
  'health-visitor': { id: 'health-visitor', label: 'Health visitor', agency: 'health', organisation: 'health-board' },
  midwife: { id: 'midwife', label: 'Midwife', agency: 'health', organisation: 'health-board' },
  cmhn: { id: 'cmhn', label: 'Community mental health nurse', agency: 'health', organisation: 'health-board' },
  'discharge-coordinator': { id: 'discharge-coordinator', label: 'Hospital discharge coordinator', agency: 'health', organisation: 'health-board' },
  'caldicott-guardian': { id: 'caldicott-guardian', label: 'Caldicott guardian', agency: 'health', organisation: 'health-board', oversight: 'audit' },
  idaa: { id: 'idaa', label: 'Independent Domestic Abuse Advocate', agency: 'third-sector', organisation: 'third-sector' },
  'womens-aid-worker': { id: 'womens-aid-worker', label: "Women's Aid worker", agency: 'third-sector', organisation: 'third-sector' },
  'independent-advocate': { id: 'independent-advocate', label: 'Independent advocate', agency: 'third-sector', organisation: 'third-sector' },
  'prison-social-worker': { id: 'prison-social-worker', label: 'Prison-based social worker', agency: 'sps', organisation: 'sps' },
  'apc-lead-officer': { id: 'apc-lead-officer', label: 'Adult Protection Committee lead officer', agency: 'social-work', organisation: 'council', oversight: 'read-only' },
  'cpc-lead-officer': { id: 'cpc-lead-officer', label: 'Child Protection Committee lead officer', agency: 'social-work', organisation: 'council', oversight: 'read-only' },
  inspector: { id: 'inspector', label: 'Inspector', agency: 'regulator', organisation: 'regulator', oversight: 'redacted' },
  'system-administrator': { id: 'system-administrator', label: 'System administrator', agency: 'social-work', organisation: 'council', oversight: 'admin' },
  'care-inspectorate-officer': { id: 'care-inspectorate-officer', label: 'Care Inspectorate officer', agency: 'regulator', organisation: 'regulator' },
  'opg-officer': { id: 'opg-officer', label: 'Office of the Public Guardian officer', agency: 'regulator', organisation: 'regulator' },
  'mwc-officer': { id: 'mwc-officer', label: 'Mental Welfare Commission officer', agency: 'regulator', organisation: 'regulator' },
  reporter: { id: 'reporter', label: "Children's Reporter", agency: 'scra', organisation: 'scra' },
  'fire-safety-officer': { id: 'fire-safety-officer', label: 'Community fire safety officer', agency: 'fire-rescue', organisation: 'fire-rescue' },
  'procurator-fiscal': { id: 'procurator-fiscal', label: 'Procurator fiscal', agency: 'court', organisation: 'court' },
};

export const HARM_TYPES = [
  'physical',
  'sexual',
  'psychological',
  'financial',
  'neglect',
  'self-harm',
  'self-neglect',
] as const;
export type HarmType = (typeof HARM_TYPES)[number];

export const HARM_TYPE_LABELS: Record<HarmType, string> = {
  physical: 'Physical harm',
  sexual: 'Sexual harm',
  psychological: 'Psychological harm',
  financial: 'Financial harm',
  neglect: 'Neglect',
  'self-harm': 'Self-harm',
  'self-neglect': 'Self-neglect',
};

export const CP_REGISTER_CATEGORIES = [
  'physical-abuse',
  'emotional-abuse',
  'sexual-abuse',
  'neglect',
  'domestic-abuse',
  'parental-substance-use',
  'parental-mental-health',
  'non-engaging-family',
  'child-placing-self-at-risk',
  'other',
] as const;
export type CpRegisterCategory = (typeof CP_REGISTER_CATEGORIES)[number];

export const CP_REGISTER_CATEGORY_LABELS: Record<CpRegisterCategory, string> = {
  'physical-abuse': 'Physical abuse',
  'emotional-abuse': 'Emotional abuse',
  'sexual-abuse': 'Sexual abuse',
  neglect: 'Neglect',
  'domestic-abuse': 'Domestic abuse',
  'parental-substance-use': 'Parental substance use',
  'parental-mental-health': 'Parental mental health',
  'non-engaging-family': 'Non-engaging family',
  'child-placing-self-at-risk': 'Child placing themselves at risk',
  other: 'Other concern',
};

export const MAPPA_CATEGORIES = [1, 2, 3] as const;
export const MAPPA_LEVELS = [1, 2, 3] as const;
export const MAPPA_CATEGORY_LABELS: Record<1 | 2 | 3, string> = {
  1: 'Category 1: registered sex offender',
  2: 'Category 2: restricted patient',
  3: 'Category 3: other risk of serious harm offender',
};
export const MAPPA_LEVEL_LABELS: Record<1 | 2 | 3, string> = {
  1: 'Level 1: routine single-agency management',
  2: 'Level 2: active multi-agency management',
  3: 'Level 3: MAPPP, the critical few',
};

/** Who an exclusion names. Party keys are resolved against the case-role register on each process. */
export const EXCLUSION_PARTIES = [
  'perpetrator',
  'perpetrator-associates',
  'alleged-perpetrator',
  'victim',
  'employer',
  'public',
  'parents-if-risk',
  'not-on-distribution',
] as const;
export type ExclusionParty = (typeof EXCLUSION_PARTIES)[number];
export const EXCLUSION_PARTY_LABELS: Record<ExclusionParty, string> = {
  perpetrator: 'Perpetrator',
  'perpetrator-associates': "Perpetrator's family or associates",
  'alleged-perpetrator': 'Alleged perpetrator',
  victim: 'Victim',
  employer: 'Employer',
  public: 'Public',
  'parents-if-risk': 'Parents and carers where sharing increases risk',
  'not-on-distribution': 'Not on the distribution list',
};

/** Where a case-role register entry came from. */
export const CASE_PARTY_SOURCES = ['referral', 'relationship', 'manual'] as const;
export type CasePartySource = (typeof CASE_PARTY_SOURCES)[number];
