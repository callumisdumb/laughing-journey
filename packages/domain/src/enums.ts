/**
 * Enumerations shared across the platform. Every enum is a `const` tuple so Zod
 * schemas and TypeScript types derive from the same list.
 */

import { tKey } from '@mas/messages';

/**
 * Catalogue key segment for an enum value or id: hyphens and dots become camelCase joins
 * (`case-conference` to `caseConference`, `cp.cppm.initial` to `cpCppmInitial`).
 */
export function keySegment(value: string | number): string {
  return String(value).replace(/[.-]+([a-z0-9])/gi, (_, c: string) => c.toUpperCase());
}

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

export function agencyLabel(agency: Agency): string {
  return tKey(`domain.agencies.${keySegment(agency)}.label`);
}


export function agencyShort(agency: Agency): string {
  return tKey(`domain.agencies.${keySegment(agency)}.short`);
}


export const PROCESS_TYPES = ['asp', 'cp', 'marac', 'mappa', 'awi'] as const;
export type ProcessType = (typeof PROCESS_TYPES)[number];

export function processLabel(process: ProcessType): string {
  return tKey(`domain.processes.${keySegment(process)}.label`);
}


export function processShort(process: ProcessType): string {
  return tKey(`domain.processes.${keySegment(process)}.short`);
}


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

export function detailLevelLabel(level: DetailLevel): string {
  return tKey(`domain.detailLevels.${keySegment(level)}`);
}


export const VISIBILITIES = ['agency-only', 'integrated', 'restricted'] as const;
export type Visibility = (typeof VISIBILITIES)[number];

export function visibilityLabel(visibility: Visibility): string {
  return tKey(`domain.visibilities.${keySegment(visibility)}`);
}

export const SIGNIFICANCES = ['low', 'moderate', 'high'] as const;
export type Significance = (typeof SIGNIFICANCES)[number];

export function significanceLabel(significance: Significance): string {
  return tKey(`domain.significances.${keySegment(significance)}`);
}

export const RISK_BANDS = ['critical', 'high', 'medium', 'low', 'unknown'] as const;
export type RiskBand = (typeof RISK_BANDS)[number];

/** The word shown beside the icon and colour of a risk band; risk is never colour alone. */
export function riskBandLabel(band: RiskBand): string {
  return tKey(`domain.riskBands.${keySegment(band)}`);
}

/**
 * Access restriction: whether a record is reachable only by the people on it. Orthogonal to
 * classification, and the two used to be one enum, which could not say that a MAPPA record is
 * Official-Sensitive **and** restricted while an ASP case conference minute is Official-Sensitive and
 * not, and an aggregate report is neither.
 *
 * Note for anyone new: "restricted" means three different things in this codebase and they are not
 * related. This one is access. `ChronologyEvent.visibility` has a `restricted` value meaning the
 * event shows only to full-access members of a restricted process. `AuditEntry.restricted` is a flag
 * saying the entry records a restricted read. The glossary spells all three out.
 */
export const ACCESS_RESTRICTIONS = ['none', 'restricted'] as const;
export type AccessRestriction = (typeof ACCESS_RESTRICTIONS)[number];

export function accessRestrictionLabel(restriction: AccessRestriction): string {
  return tKey(`domain.accessRestrictions.${keySegment(restriction)}`);
}

/** True where a record is reachable only by the people on it. */
export function isAccessRestricted(record: { accessRestriction: AccessRestriction }): boolean {
  return record.accessRestriction === 'restricted';
}


export const LIFE_STAGES = ['unborn', 'child', 'adult'] as const;
export type LifeStage = (typeof LIFE_STAGES)[number];

export function lifeStageLabel(stage: LifeStage): string {
  return tKey(`domain.lifeStages.${keySegment(stage)}`);
}

export const CHANNELS = ['in-app', 'secure-email-digest', 'connector-push'] as const;
export type Channel = (typeof CHANNELS)[number];

export function channelLabel(channel: Channel): string {
  return tKey(`domain.channels.${keySegment(channel)}`);
}

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

export function eventFamilyLabel(family: EventFamily): string {
  return tKey(`domain.eventFamilies.${keySegment(family)}`);
}


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

export function meetingTypeLabel(type: MeetingType): string {
  return tKey(`domain.meetingTypes.${keySegment(type)}`);
}


export const ACTION_STATUSES = ['open', 'in-progress', 'complete', 'cancelled'] as const;
export type ActionStatus = (typeof ACTION_STATUSES)[number];

export function actionStatusLabel(status: ActionStatus): string {
  return tKey(`domain.actionStatuses.${keySegment(status)}`);
}

export const PLAN_TYPES = [
  'interim-safety',
  'childs-plan',
  'adult-protection',
  'adult-support',
  'marac-action',
  'mappa-rmp',
] as const;
export type PlanType = (typeof PLAN_TYPES)[number];

export function planTypeLabel(type: PlanType): string {
  return tKey(`domain.planTypes.${keySegment(type)}`);
}


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

export function riskToolLabel(tool: RiskTool): string {
  return tKey(`domain.riskTools.${keySegment(tool)}`);
}


export const VIEWS_KINDS = [
  'adult-views',
  'child-voice',
  'victim-wishes',
  'family-views',
  'carer-views',
] as const;
export type ViewsKind = (typeof VIEWS_KINDS)[number];

export function viewsKindLabel(kind: ViewsKind): string {
  return tKey(`domain.viewsKinds.${keySegment(kind)}`);
}


export const CONSENT_STATUSES = [
  'not-required',
  'sought-and-given',
  'sought-and-refused-overridden',
  'not-sought-risk',
] as const;
export type ConsentStatus = (typeof CONSENT_STATUSES)[number];

export function consentStatusLabel(status: ConsentStatus): string {
  return tKey(`domain.consentStatuses.${keySegment(status)}`);
}


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
  // A create is not an edit. An inspector asking when a record came into existence, and who put it
  // there, should not have to infer it from the earliest edit on a record that may have been edited
  // a hundred times since.
  'create',
  // Government Security Classification, Annex 2. A raise is always allowed; a lower needs a named
  // role and is refused otherwise, so both are recorded exactly as break-glass is.
  'classify',
  'classification-raise',
  'classification-lower',
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

const ROLE_DATA: Record<RoleId, RoleDefinition> = {
  'social-worker-adults': { id: 'social-worker-adults', agency: 'social-work', organisation: 'hscp' },
  'social-worker-children': { id: 'social-worker-children', agency: 'social-work', organisation: 'council' },
  'team-leader': { id: 'team-leader', agency: 'social-work', organisation: 'council' },
  'council-officer-asp': { id: 'council-officer-asp', agency: 'social-work', organisation: 'hscp' },
  mho: { id: 'mho', agency: 'social-work', organisation: 'hscp' },
  'justice-social-worker': { id: 'justice-social-worker', agency: 'social-work', organisation: 'council' },
  'mappa-coordinator': { id: 'mappa-coordinator', agency: 'social-work', organisation: 'council' },
  'marac-coordinator': { id: 'marac-coordinator', agency: 'social-work', organisation: 'council' },
  chair: { id: 'chair', agency: 'social-work', organisation: 'council' },
  'minute-taker': { id: 'minute-taker', agency: 'social-work', organisation: 'council' },
  'housing-officer': { id: 'housing-officer', agency: 'housing', organisation: 'council' },
  'education-cp-lead': { id: 'education-cp-lead', agency: 'education', organisation: 'council' },
  cswo: { id: 'cswo', agency: 'social-work', organisation: 'council', oversight: 'sign-off' },
  'detective-sergeant-ppu': { id: 'detective-sergeant-ppu', agency: 'police', organisation: 'police' },
  'domestic-abuse-officer': { id: 'domestic-abuse-officer', agency: 'police', organisation: 'police' },
  'offender-management': { id: 'offender-management', agency: 'police', organisation: 'police' },
  'concern-hub-officer': { id: 'concern-hub-officer', agency: 'police', organisation: 'police' },
  'cp-nurse-adviser': { id: 'cp-nurse-adviser', agency: 'health', organisation: 'health-board' },
  gp: { id: 'gp', agency: 'health', organisation: 'health-board' },
  'health-visitor': { id: 'health-visitor', agency: 'health', organisation: 'health-board' },
  midwife: { id: 'midwife', agency: 'health', organisation: 'health-board' },
  cmhn: { id: 'cmhn', agency: 'health', organisation: 'health-board' },
  'discharge-coordinator': { id: 'discharge-coordinator', agency: 'health', organisation: 'health-board' },
  'caldicott-guardian': { id: 'caldicott-guardian', agency: 'health', organisation: 'health-board', oversight: 'audit' },
  idaa: { id: 'idaa', agency: 'third-sector', organisation: 'third-sector' },
  'womens-aid-worker': { id: 'womens-aid-worker', agency: 'third-sector', organisation: 'third-sector' },
  'independent-advocate': { id: 'independent-advocate', agency: 'third-sector', organisation: 'third-sector' },
  'prison-social-worker': { id: 'prison-social-worker', agency: 'sps', organisation: 'sps' },
  'apc-lead-officer': { id: 'apc-lead-officer', agency: 'social-work', organisation: 'council', oversight: 'read-only' },
  'cpc-lead-officer': { id: 'cpc-lead-officer', agency: 'social-work', organisation: 'council', oversight: 'read-only' },
  inspector: { id: 'inspector', agency: 'regulator', organisation: 'regulator', oversight: 'redacted' },
  'system-administrator': { id: 'system-administrator', agency: 'social-work', organisation: 'council', oversight: 'admin' },
  'care-inspectorate-officer': { id: 'care-inspectorate-officer', agency: 'regulator', organisation: 'regulator' },
  'opg-officer': { id: 'opg-officer', agency: 'regulator', organisation: 'regulator' },
  'mwc-officer': { id: 'mwc-officer', agency: 'regulator', organisation: 'regulator' },
  reporter: { id: 'reporter', agency: 'scra', organisation: 'scra' },
  'fire-safety-officer': { id: 'fire-safety-officer', agency: 'fire-rescue', organisation: 'fire-rescue' },
  'procurator-fiscal': { id: 'procurator-fiscal', agency: 'court', organisation: 'court' },
};

export function roleLabel(id: RoleId): string {
  return tKey(`domain.roles.${keySegment(id)}.label`);
}

/** Role definitions by id: agency, organisation and oversight. The role's name is roleLabel(id). */
export const ROLE_DEFINITIONS: Record<RoleId, RoleDefinition> = ROLE_DATA;

/**
 * Types of harm, in the order and with the labels of indicator 15 of the ASP data workbook 2026-27
 * (sheet "15 TYPES OF HARM", rows A7 to A18). Hoarding behaviour is its own type, which is why
 * self-neglect is qualified "excluding hoarding behaviour": the workbook separates them and a return
 * that folds one into the other does not agree with the template it is filling.
 *
 * The return counts one primary harm per inquiry; the record may carry more than one, and
 * `primaryHarmType` on the concern says which one is counted.
 */
export const HARM_TYPES = [
  'physical',
  'sexual',
  'psychological',
  'financial',
  'neglect',
  'discriminatory',
  'self-harm',
  'self-neglect',
  'domestic-abuse',
  'trafficking',
  'hoarding',
  'other',
] as const;
export type HarmType = (typeof HARM_TYPES)[number];

export function harmTypeLabel(type: HarmType): string {
  return tKey(`domain.harmTypes.${keySegment(type)}`);
}

/** How the NMDS glossary subdivides human trafficking and exploitation: sub-detail, never a primary type. */
export const TRAFFICKING_KINDS = ['criminal-exploitation', 'labour-exploitation', 'sexual-exploitation', 'organ-harvesting'] as const;
export type TraffickingKind = (typeof TRAFFICKING_KINDS)[number];

export function traffickingKindLabel(kind: TraffickingKind): string {
  return tKey(`domain.traffickingKinds.${keySegment(kind)}`);
}

/**
 * Primary client group: the NMDS's term for the primary vulnerability someone has which would
 * potentially contribute to their meeting the three-point criteria. Only the primary group is
 * collected. The autism category needs no formal diagnosis.
 *
 * Eleven groups, in the order of indicator 17 of the ASP data workbook 2026-27 (sheet
 * "17 CLIENT GROUP", rows A7 to A18). Infirmity or frailty due to age is a group in its own right:
 * folding it into physical disability would hide the largest single group in most areas' returns.
 */
export const ASP_CLIENT_GROUPS = [
  'dementia',
  'mental-health',
  'learning-disability',
  'autism',
  'physical-disability',
  'infirmity-frailty',
  'palliative-care',
  'acquired-brain-injury',
  'alcohol-related-brain-damage',
  'substance-misuse',
  'other',
] as const;
export type AspClientGroup = (typeof ASP_CLIENT_GROUPS)[number];

export function aspClientGroupLabel(group: AspClientGroup): string {
  return tKey(`domain.aspClientGroups.${keySegment(group)}`);
}

/**
 * Actions taken following inquiries: indicators 10 and 11 of the ASP data workbook 2026-27 (sheet
 * "10-11 ACTIONS TAKEN", rows A7 to A13), in the workbook's order. These are the closest thing the
 * return has to an outcome taxonomy, so they drive ASP closure as well as the report.
 *
 * The labels are the workbook's own, character for character, including the em dashes in five of the
 * six and the hyphen in the odd one out. They are flagged `verbatim` in the context file so the copy
 * checker does not normalise them (D-055): paraphrasing a mandated field label would make a
 * submitted return disagree with the template it is filling.
 */
export const ASP_INQUIRY_ACTIONS = [
  'no-criteria-no-action',
  'no-criteria-support',
  'criteria-ongoing',
  'criteria-support',
  'criteria-no-opportunity',
  'pending-unknown',
] as const;
export type AspInquiryAction = (typeof ASP_INQUIRY_ACTIONS)[number];

export function aspInquiryActionLabel(action: AspInquiryAction): string {
  return tKey(`domain.aspInquiryActions.${keySegment(action)}`);
}

/**
 * A senior officer of the council, for the purpose of chairing the meeting that decides whether to
 * proceed to a Large Scale Investigation (NMDS Annex 2 glossary). Seniority is read from the role,
 * not asserted by the person recording the meeting: the Chief Social Work Officer, a team leader,
 * an Adult Protection Committee lead officer and a service chair all qualify; a practitioner does not.
 */
export const LSI_CHAIR_ROLES = ['cswo', 'team-leader', 'apc-lead-officer', 'chair'] as const;

export function isSeniorCouncilOfficer(roleId: RoleId): boolean {
  const role = ROLE_DEFINITIONS[roleId];
  return role.organisation === 'council' && (LSI_CHAIR_ROLES as readonly string[]).includes(roleId);
}

/**
 * The twelve age bands of indicator 13 of the ASP data workbook 2026-27 (sheet "13 AGE & GENDER",
 * rows A7 to A18). The bands were revised for data collected at inquiry stage and are narrower
 * above 65 than the earlier set, because that is where the volume is. The 16 to 17 band captures
 * adults in transition from or spanning children's and adult services.
 */
export const ASP_AGE_BANDS = [
  'age16to17',
  'age18to24',
  'age25to34',
  'age35to44',
  'age45to54',
  'age55to64',
  'age65to69',
  'age70to74',
  'age75to79',
  'age80to84',
  'age85plus',
  'notKnown',
] as const;
export type AspAgeBand = (typeof ASP_AGE_BANDS)[number];

/** The inclusive age range each band covers. `notKnown` covers no range: a missing date of birth lands there. */
export const ASP_AGE_BAND_RANGES: Record<AspAgeBand, { from: number; to?: number } | undefined> = {
  age16to17: { from: 16, to: 17 },
  age18to24: { from: 18, to: 24 },
  age25to34: { from: 25, to: 34 },
  age35to44: { from: 35, to: 44 },
  age45to54: { from: 45, to: 54 },
  age55to64: { from: 55, to: 64 },
  age65to69: { from: 65, to: 69 },
  age70to74: { from: 70, to: 74 },
  age75to79: { from: 75, to: 79 },
  age80to84: { from: 80, to: 84 },
  age85plus: { from: 85 },
  notKnown: undefined,
};

export function aspAgeBandLabel(band: AspAgeBand): string {
  return tKey(`domain.aspAgeBands.${band}`);
}

/** The band an age falls in, or `notKnown` where there is no age. */
export function aspAgeBandOf(age: number | undefined): AspAgeBand {
  if (age === undefined || Number.isNaN(age)) return 'notKnown';
  for (const band of ASP_AGE_BANDS) {
    const range = ASP_AGE_BAND_RANGES[band];
    if (range && age >= range.from && (range.to === undefined || age <= range.to)) return band;
  }
  return 'notKnown';
}

/**
 * The eight ethnicity categories of indicator 14 of the ASP data workbook 2026-27 (sheet
 * "14 ETHNICITY", rows A6 to A13). They mirror Scotland's Census 2022 question set so the return is
 * comparable with it. This product's dataset holds no ethnicity by design (brief section 9), so the
 * return reports it as not held rather than as zero in every category.
 */
export const ASP_ETHNICITIES = ['white', 'mixed-or-multiple', 'asian', 'african', 'caribbean-or-black', 'other-ethnic-group', 'not-disclosed', 'not-known'] as const;
export type AspEthnicity = (typeof ASP_ETHNICITIES)[number];

export function aspEthnicityLabel(ethnicity: AspEthnicity): string {
  return tKey(`domain.aspEthnicities.${keySegment(ethnicity)}`);
}

/**
 * The eleven locations of harm of indicator 16 of the ASP data workbook 2026-27 (sheet
 * "16 LOCATION OF HARM", rows A7 to A17). Primary location only. The concern record carries the
 * location as a field of its own: deriving it from the adult's address on the day was a guess, and a
 * guess in a national return is worse than "Not known".
 */
export const ASP_HARM_LOCATIONS = [
  'own-home',
  'other-private-address',
  'care-home',
  'sheltered-or-supported',
  'day-centre',
  'public-place',
  'nhs-facility',
  'independent-hospital',
  'online',
  'other',
  'not-known',
] as const;
export type AspHarmLocation = (typeof ASP_HARM_LOCATIONS)[number];

export function aspHarmLocationLabel(location: AspHarmLocation): string {
  return tKey(`domain.aspHarmLocations.${keySegment(location)}`);
}

/**
 * The seven service types of indicator 19a of the ASP data workbook 2026-27 (sheet "19 LSIs", rows
 * A8 to A14). Where the service is registered with the Care Inspectorate the return also carries its
 * unique CS number (19b); an NHS hospital carries the national hospital location code (19c).
 */
export const LSI_SERVICE_TYPES = ['care-home', 'support-services', 'nhs-hospital', 'nhs-primary-care', 'nhs-community-or-secondary', 'community-groups', 'other'] as const;
export type LsiServiceType = (typeof LSI_SERVICE_TYPES)[number];

export function lsiServiceTypeLabel(type: LsiServiceType): string {
  return tKey(`domain.lsiServiceTypes.${keySegment(type)}`);
}

/**
 * The thirty-three referral sources of indicator 1 of the ASP data workbook 2026-27 (sheet
 * "1 ASP REFERRALS", rows A6 to A38), in the workbook's order.
 *
 * The list is finer-grained than the product's agency list on purpose: the indicator exists to show
 * which stakeholders are referring, so that training and awareness raising can be aimed at the ones
 * that are not. Several sources map to one agency (four NHS rows to `nhs`), and several map to no
 * agency at all (self, unpaid carer, anonymous), so `referralSource` on the concern is its own field
 * rather than something derived from `sourceAgency`.
 */
export const ASP_REFERRAL_SOURCES = [
  'mwc',
  'care-inspectorate',
  'his',
  'opg',
  'police',
  'nhs-24',
  'nhs-primary-care',
  'nhs-acute',
  'nhs-drug-and-alcohol',
  'nhs-community-health',
  'mental-health-services',
  'other-health',
  'social-work-adults',
  'social-work-children',
  'out-of-region-social-work',
  'other-council-service',
  'ambulance',
  'fire-and-rescue',
  'prison-service',
  'care-home',
  'care-at-home',
  'housing',
  'education',
  'childrens-services',
  'self',
  'unpaid-carer',
  'family-friend-or-neighbour',
  'other-member-of-the-public',
  'third-sector',
  'financial-institution',
  'dwp-or-social-security-scotland',
  'anonymous',
  'other',
] as const;
export type AspReferralSource = (typeof ASP_REFERRAL_SOURCES)[number];

export function aspReferralSourceLabel(source: AspReferralSource): string {
  return tKey(`domain.aspReferralSources.${keySegment(source)}`);
}

/**
 * The four gender categories of indicator 13 of the ASP data workbook 2026-27 (sheet
 * "13 AGE & GENDER", rows A46 to A49). The record holds sex, so the last two read as not collected
 * rather than zero: a return that reports zero trans or non-binary adults is claiming to have asked.
 */
export const ASP_GENDERS = ['male', 'female', 'trans-or-non-binary', 'prefer-not-to-say'] as const;
export type AspGender = (typeof ASP_GENDERS)[number];

export function aspGenderLabel(gender: AspGender): string {
  return tKey(`domain.aspGenders.${keySegment(gender)}`);
}


/**
 * Concerns raised at a child protection planning meeting. The 2021 national guidance says it is not
 * necessary to identify a category of registration when placing a child on the register, so what the
 * meeting records is its concerns, and a child may have more than one (D-056). The five the
 * publication confirms as consistently most common are listed first, in its own wording; the rest
 * are the platform's and await the template.
 */
export const CP_CONCERNS = [
  'domestic-abuse',
  'neglect',
  'parental-substance-use',
  'parent-mental-ill-health',
  'emotional-abuse',
  'physical-abuse',
  'sexual-abuse',
  'non-engaging-family',
  'child-placing-self-at-risk',
  'other',
] as const;
export type CpConcern = (typeof CP_CONCERNS)[number];

export function cpConcernLabel(concern: CpConcern): string {
  return tKey(`domain.cpConcerns.${keySegment(concern)}`);
}

/** Reasons for de-registration, in the wording of Children's Social Work Statistics: Child Protection. */
export const CP_DEREGISTRATION_REASONS = [
  'taken-into-care-risk-reduced',
  'child-with-other-carers',
  'child-died',
  'removal-of-perpetrator',
  'improved-home-situation',
  'automatically-deregistered-age',
  'moved-away-no-continued-risk',
  'other-reason',
  'reason-not-known',
] as const;
export type CpDeregistrationReason = (typeof CP_DEREGISTRATION_REASONS)[number];

export function cpDeregistrationReasonLabel(reason: CpDeregistrationReason): string {
  return tKey(`domain.cpDeregistrationReasons.${keySegment(reason)}`);
}





export const MAPPA_CATEGORIES = [1, 2, 3] as const;
export const MAPPA_LEVELS = [1, 2, 3] as const;
export type MappaCategory = (typeof MAPPA_CATEGORIES)[number];
export type MappaLevel = (typeof MAPPA_LEVELS)[number];

export function mappaCategoryLabel(category: MappaCategory): string {
  const segment = `category${category}`;
  return tKey(`domain.mappa.categories.${segment}`);
}

export function mappaLevelLabel(level: MappaLevel): string {
  const segment = `level${level}`;
  return tKey(`domain.mappa.levels.${segment}`);
}


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
export function exclusionPartyLabel(party: ExclusionParty): string {
  return tKey(`domain.exclusionParties.${keySegment(party)}`);
}


/** Where a case-role register entry came from. */
export const CASE_PARTY_SOURCES = ['referral', 'relationship', 'manual'] as const;
export type CasePartySource = (typeof CASE_PARTY_SOURCES)[number];
