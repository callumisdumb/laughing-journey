import { t } from '@mas/messages';
import { z } from 'zod';
import {
  AGENCIES,
  ALL_STAGES,
  ASP_CLIENT_GROUPS,
  ASP_HARM_LOCATIONS,
  ASP_INQUIRY_ACTIONS,
  ASP_REFERRAL_SOURCES,
  CASE_PARTY_SOURCES,
  ACCESS_RESTRICTIONS,
  CONSENT_STATUSES,
  CP_CONCERNS,
  CP_DEREGISTRATION_REASONS,
  EXCLUSION_PARTIES,
  HARM_TYPES,
  LSI_SERVICE_TYPES,
  MAPPA_CATEGORIES,
  MAPPA_LEVELS,
  TRAFFICKING_KINDS,
} from '../enums';
import { CLASSIFICATION_LEVELS } from '../classification/classify';
import { classificationSchema, correctable, evidenceRefSchema, idSchema, isoDate, isoDateTime, syntheticSchema } from './common';

export const stageEntrySchema = z.object({
  stage: z.enum(ALL_STAGES),
  at: isoDateTime,
  byUserId: idSchema.optional(),
  byName: z.string(),
  note: z.string().optional(),
});
export type StageEntry = z.infer<typeof stageEntrySchema>;

export const clockTriggerSchema = z.object({
  id: idSchema,
  ruleId: z.string(),
  triggeredAt: isoDateTime,
  completedAt: isoDateTime.optional(),
  /** A locally agreed due date that replaces the computed one, with the reason. */
  dueOverride: isoDate.optional(),
  overrideReason: z.string().optional(),
  note: z.string().optional(),
  /**
   * Set where `completedAt` was written by a closure rather than by the thing the clock counts to.
   *
   * A clock stopped because the case shut is a different fact from a clock stopped because the case
   * conference happened, and only the first resumes when the case is reopened. Without the flag a
   * reopen would either restart everything, including the deadlines that were genuinely met, or
   * restart nothing, which is the deadline quietly disappearing.
   */
  stoppedByClosure: z.boolean().optional(),
});
export type ClockTrigger = z.infer<typeof clockTriggerSchema>;

export const membershipSchema = z.object({
  userId: idSchema,
  caseRole: z.string(),
  agency: z.enum(AGENCIES),
  since: isoDate,
  /** Why this person is on the case, shown in the drawer. */
  reason: z.string(),
});
export type Membership = z.infer<typeof membershipSchema>;

/**
 * Case-role register entry: a person or platform user who holds a role on this process that the
 * need-to-know exclusions name (perpetrator, victim, employer and so on). Exclusions are keyed on
 * the role, never on identity alone. Entries come from the referral, from relationship records,
 * or are recorded by hand with a reason.
 */
export const casePartySchema = z
  .object({
    /** The person who holds the role, when they have a record. */
    personId: idSchema.optional(),
    /** A platform user who holds the role, for example a persona seeded as a perpetrator's associate. */
    userId: idSchema.optional(),
    /** A typed name for someone with neither a record nor an account, for example named on a referral form. */
    name: z.string().optional(),
    party: z.enum(EXCLUSION_PARTIES),
    /** How the person is described, e.g. "Perpetrator (named in the referral)". */
    label: z.string(),
    since: isoDate.optional(),
    source: z.enum(CASE_PARTY_SOURCES),
    reason: z.string().optional(),
    /**
     * Whether the exclusion this entry carries still stands.
     *
     * Absent means it stands, which is the default and the safe one. `false` is a decision somebody
     * made and is answerable for, and it suppresses the derived entry it shares a key with: ending
     * the relationship a MARAC associate entry rests on does not lift the exclusion by itself,
     * because a former partner is frequently the whole risk. Lifting it is a separate decision with
     * a name, a date and a reason on it (D-132).
     */
    stands: z.boolean().optional(),
    decidedAt: isoDateTime.optional(),
    decidedByName: z.string().optional(),
    decisionReason: z.string().optional(),
  })
  .refine((party) => Boolean(party.personId || party.userId || party.name), { error: () => t('errors.schemas.casePartyIdentity') });
export type CaseParty = z.infer<typeof casePartySchema>;

const decisionRecordSchema = z.object({
  decided: z.boolean(),
  decision: z.string(),
  rationale: z.string(),
  at: isoDateTime.optional(),
  byName: z.string().optional(),
  byUserId: idSchema.optional(),
});

/* ---------- ASP ---------- */

export const threePointLimbSchema = z.object({
  met: z.enum(['yes', 'no', 'unclear']),
  reasoning: z.string(),
});

export const aspDetailSchema = z.object({
  concern: z.object({
    receivedAt: isoDateTime,
    source: z.string(),
    sourceAgency: z.enum(AGENCIES),
    sourceReference: z.string().optional(),
    summary: z.string(),
    /** The workbook's referral source (indicator 1), which is finer-grained than the agency list. */
    referralSource: z.enum(ASP_REFERRAL_SOURCES),
    /** Free-text detail the workbook asks for where the referral source is Other. */
    referralSourceOther: z.string().optional(),
    harmTypes: z.array(z.enum(HARM_TYPES)),
    /** The one harm the National Minimum Dataset counts for this inquiry. Defaults to the first recorded. */
    primaryHarmType: z.enum(HARM_TYPES).optional(),
    /** Sub-detail where the primary harm is trafficking or exploitation; never a primary type of its own. */
    traffickingKinds: z.array(z.enum(TRAFFICKING_KINDS)).optional(),
    /** Free-text detail the glossary requires where the harm type is Other. */
    harmTypeOther: z.string().optional(),
    /** The NMDS primary client group: the vulnerability that would contribute to meeting the three-point criteria. */
    primaryClientGroup: z.enum(ASP_CLIENT_GROUPS).optional(),
    /** Free-text detail the glossary requires where the client group is Other. */
    clientGroupOther: z.string().optional(),
    /**
     * The workbook's primary location of harm (indicator 16). Recorded, not derived: reading it off
     * the adult's address on the day was a guess, and a guess in a national return is worse than
     * "Not known".
     */
    locationOfHarm: z.enum(ASP_HARM_LOCATIONS),
    /** Free-text detail the workbook asks for where the location is Other. */
    locationOfHarmOther: z.string().optional(),
    immediateSafety: z.string(),
    policeInvolved: z.boolean(),
  }),
  threePointTest: z.object({
    assessedAt: isoDateTime,
    byName: z.string(),
    byUserId: idSchema.optional(),
    a: threePointLimbSchema,
    b: threePointLimbSchema,
    c: threePointLimbSchema,
    outcome: z.enum(['met', 'not-met', 'unclear']),
  }),
  screening: z.object({
    outcome: z.enum(['no-further-asp-action', 'proceed-to-inquiry', 'emergency-action']),
    rationale: z.string(),
    at: isoDateTime,
    byName: z.string(),
  }).optional(),
  inquiry: z.object({
    openedAt: isoDateTime,
    interAgencyDiscussionMeetingId: idSchema.optional(),
    agenciesContacted: z.array(z.enum(AGENCIES)),
    outcome: z.enum(['no-further-action', 'support-only', 'proceed-to-investigation', 'pending']),
    /**
     * The action taken, in the National Minimum Dataset's six categories. This is what the return
     * counts and what closure reads; `outcome` stays as the internal routing decision.
     */
    action: z.enum(ASP_INQUIRY_ACTIONS).optional(),
    rationale: z.string().optional(),
    decidedAt: isoDateTime.optional(),
  }).optional(),
  investigation: z.object({
    councilOfficerUserId: idSchema,
    secondWorkerUserId: idSchema.optional(),
    visits: z.array(z.object({ at: isoDateTime, power: z.literal('s7'), byNames: z.array(z.string()), note: z.string() })),
    interviews: z.array(z.object({ at: isoDateTime, power: z.literal('s8'), withPersonId: idSchema, note: z.string(), adultDeclined: z.boolean().optional() })),
    medicalExamination: z.object({ requestedAt: isoDateTime, power: z.literal('s9'), byName: z.string(), outcome: z.string().optional() }).optional(),
    recordsRequests: z.array(z.object({ requestedAt: isoDateTime, power: z.literal('s10'), holder: z.string(), holderAgency: z.enum(AGENCIES), status: z.enum(['requested', 'received', 'declined']), note: z.string().optional() })),
    consent: z.object({ status: z.enum(CONSENT_STATUSES), note: z.string() }),
    capacity: z.object({ assessed: z.boolean(), summary: z.string(), fluctuates: z.boolean().optional(), linkedAwiProcessId: idSchema.optional() }),
    unduePressure: z.object({ considered: z.boolean(), found: z.boolean().optional(), reasoning: z.string().optional() }),
    advocacy: z.object({ offered: z.boolean(), accepted: z.boolean().optional(), provider: z.string().optional(), advocateName: z.string().optional() }),
  }).optional(),
  ordersConsidered: z.array(z.object({
    order: z.enum(['assessment-order-s11', 'removal-order-s14', 'banning-order-s19', 'warrant-for-entry']),
    considered: z.boolean(),
    decision: z.enum(['not-required', 'application-drafting', 'applied', 'granted', 'refused']),
    rationale: z.string(),
  })),
  planId: idSchema.optional(),
  closure: z.object({ at: isoDateTime, reason: z.string() }).optional(),
  /** Large Scale Investigation mode: per-subject strands. */
  lsi: z.object({
    setting: z.string(),
    provider: z.string(),
    /** Indicator 19a: the workbook's service type for the setting under investigation. */
    serviceType: z.enum(LSI_SERVICE_TYPES),
    /** Indicator 19b: the Care Inspectorate's unique CS number, where the service is registered with it. */
    careInspectorateCsNumber: z.string().optional(),
    /** Indicator 19c: the national hospital location code, where the setting is an NHS hospital. */
    nhsHospitalLocationCode: z.string().optional(),
    strands: z.array(z.object({ subjectId: idSchema, concern: z.string(), status: z.enum(['open', 'reviewed', 'closed']), leadUserId: idSchema.optional() })),
    agenciesInvolved: z.array(z.enum(AGENCIES)),
    careInspectorateNotified: z.boolean(),
    commissioningInvolved: z.boolean(),
    /**
     * The decision to proceed to an LSI is expected to be taken in a multi-agency meeting chaired
     * by a senior officer of the council (NMDS Annex 2 glossary), so the chair is recorded and
     * `chairIsSeniorCouncilOfficer` must be true for the record to validate.
     */
    chairUserId: idSchema,
    chairIsSeniorCouncilOfficer: z.literal(true),
  }).optional(),
});
export type AspDetail = z.infer<typeof aspDetailSchema>;

/* ---------- Child protection ---------- */

export const irdContributionSchema = z.object({
  agency: z.enum(AGENCIES),
  byName: z.string(),
  byUserId: idSchema.optional(),
  summary: z.string(),
  at: isoDateTime,
});

export const cpDetailSchema = z.object({
  concern: z.object({
    receivedAt: isoDateTime,
    source: z.string(),
    sourceAgency: z.enum(AGENCIES),
    sourceReference: z.string().optional(),
    summary: z.string(),
  }),
  proceduresInitiatedAt: isoDateTime.optional(),
  ird: z.object({
    meetingId: idSchema.optional(),
    heldAt: isoDateTime,
    outOfHours: z.boolean(),
    participants: z.array(z.object({ agency: z.enum(AGENCIES), name: z.string(), role: z.string(), userId: idSchema.optional() })),
    contributions: z.array(irdContributionSchema),
    decisions: z.object({
      significantHarm: decisionRecordSchema,
      investigationNeeded: decisionRecordSchema,
      jii: decisionRecordSchema.extend({ plannerName: z.string().optional(), informedBy: z.string().optional() }),
      medical: decisionRecordSchema.extend({ kind: z.enum(['jpfe', 'comprehensive', 'none']).optional(), consentBy: z.string().optional(), when: isoDateTime.optional() }),
      emergencyMeasures: decisionRecordSchema.extend({ measure: z.enum(['none', 'cpo', 'exclusion-order', 'police-emergency-powers']).optional() }),
      reporterReferral: decisionRecordSchema,
      parentsInformed: decisionRecordSchema.extend({ withheld: z.string().optional() }),
    }),
    siblingsConsidered: z.array(idSchema),
    interimSafetyPlanId: idSchema.optional(),
    childViewsSought: z.string(),
  }).optional(),
  investigation: z.object({
    openedAt: isoDateTime,
    jiiHeldAt: isoDateTime.optional(),
    jiiModel: z.literal('SCIM').optional(),
    medicalHeldAt: isoDateTime.optional(),
    summary: z.string(),
  }).optional(),
  cppm: z.object({
    meetingId: idSchema.optional(),
    heldAt: isoDateTime.optional(),
    decision: z.enum(['register', 'not-register', 'pending']),
    rationale: z.string().optional(),
  }).optional(),
  register: z.object({
    registeredAt: isoDate,
    /**
     * The concerns the planning meeting recorded. The 2021 national guidance says a category of
     * registration need not be identified, so concerns are what the register carries and a child
     * may have more than one (D-056).
     */
    concerns: z.array(z.enum(CP_CONCERNS)).min(1),
    /** A local category, where a partnership uses one. National guidance does not require it. */
    localCategory: z.string().optional(),
    deregisteredAt: isoDate.optional(),
    /** Coded reason, in the wording of the national statistics publication. */
    deregistrationReason: z.enum(CP_DEREGISTRATION_REASONS).optional(),
    deregistrationNote: z.string().optional(),
    transfer: z.object({ direction: z.enum(['in', 'out']), area: z.string(), at: isoDate }).optional(),
  }).optional(),
  coreGroup: z.object({
    memberUserIds: z.array(idSchema),
    leadProfessionalUserId: idSchema.optional(),
    namedPersonUserId: idSchema.optional(),
    firstMeetingAt: isoDateTime.optional(),
  }).optional(),
  childsPlanId: idSchema.optional(),
  preBirth: z.object({
    expectedDeliveryDate: isoDate,
    motherPersonId: idSchema,
    gestationWeeksAtConcern: z.number().int().optional(),
  }).optional(),
});
export type CpDetail = z.infer<typeof cpDetailSchema>;

/* ---------- MARAC ---------- */

export const maracDetailSchema = z.object({
  referral: z.object({
    receivedAt: isoDateTime,
    referringAgency: z.enum(AGENCIES),
    referrerName: z.string(),
    riskAssessmentId: idSchema,
    professionalJudgementReferral: z.boolean(),
    repeat: z.boolean(),
    previousHearingAt: isoDate.optional(),
    victimPersonId: idSchema,
    perpetratorPersonId: idSchema,
    childPersonIds: z.array(idSchema),
    summary: z.string(),
  }),
  researchRequests: z.array(z.object({
    id: idSchema,
    agency: z.enum(AGENCIES),
    toUserId: idSchema.optional(),
    sentAt: isoDateTime,
    dueAt: isoDate,
    status: z.enum(['sent', 'returned', 'nothing-known', 'overdue']),
    returnSummary: z.string().optional(),
    returnedAt: isoDateTime.optional(),
  })),
  meetingId: idSchema.optional(),
  actionPlanId: idSchema.optional(),
  idaa: z.object({ userId: idSchema.optional(), name: z.string(), organisation: z.string() }),
  idaaFeedback: z.array(z.object({ at: isoDateTime, byName: z.string(), summary: z.string(), victimResponse: z.string().optional() })),
  flags: z.array(z.object({ agency: z.enum(AGENCIES), system: z.string(), placedAt: isoDate, expiresAt: isoDate, receiptRef: z.string() })),
  links: z.object({
    cpProcessId: idSchema.optional(),
    aspProcessId: idSchema.optional(),
    mappaProcessId: idSchema.optional(),
    matacConsidered: z.boolean(),
    matacReferredAt: isoDate.optional(),
    dsdasConsidered: z.boolean(),
    dsdasNote: z.string().optional(),
  }),
  safeLivesReturn: z.object({
    referralSource: z.string(),
    repeat: z.boolean(),
    childrenCount: z.number().int(),
    outcomeCodes: z.array(z.string()),
  }),
  transfer: z.object({ toArea: z.string(), at: isoDate, receivingCoordinator: z.string() }).optional(),
});
export type MaracDetail = z.infer<typeof maracDetailSchema>;

/* ---------- MAPPA ---------- */

export const mappaDetailSchema = z.object({
  category: z.union(MAPPA_CATEGORIES.map((c) => z.literal(c))),
  level: z.union(MAPPA_LEVELS.map((l) => z.literal(l))),
  levelHistory: z.array(z.object({ level: z.union(MAPPA_LEVELS.map((l) => z.literal(l))), at: isoDate, reason: z.string(), meetingId: idSchema.optional() })),
  leadResponsibleAuthority: z.enum(['police', 'social-work', 'health', 'sps']),
  visorReference: z.string(),
  /** Victims with a person record. Victims are a hard exclusion; the Victim Notification Scheme is a separate route. */
  victimPersonIds: z.array(idSchema).default([]),
  notification: z.object({ at: isoDateTime, source: z.string(), byName: z.string() }),
  referral: z.object({ at: isoDateTime, byName: z.string(), riskAssessmentIds: z.array(idSchema), reason: z.string() }).optional(),
  sonr: z.object({
    subject: z.boolean(),
    compliant: z.boolean(),
    lastNotificationAt: isoDate.optional(),
    nextDueAt: isoDate.optional(),
    endsAt: isoDate.optional(),
  }),
  custody: z.object({ releasedAt: isoDate.optional(), licenceExpiresAt: isoDate.optional(), establishment: z.string().optional() }),
  licenceConditions: z.array(z.object({ id: idSchema, text: z.string(), status: z.enum(['active', 'breached', 'ended']) })),
  /**
   * Civil order register, counted in Annex 3 Table 2 of the MAPPA annual report. SOPOs, RSHOs and
   * FTOs were replaced by SHPOs and SROs on 31 Mar 2023 (Abusive Behaviour and Sexual Harm
   * (Scotland) Act 2016); orders made before then stay on the register until they end.
   */
  orders: z.array(z.object({
    id: idSchema,
    kind: z.enum(['sopo', 'rsho', 'fto', 'shpo', 'sro', 'notification-order']),
    madeAt: isoDate,
    expiresAt: isoDate.optional(),
    court: z.string().optional(),
    status: z.enum(['active', 'expired', 'discharged']),
  })).default([]),
  riskAssessmentIds: z.array(idSchema),
  rmp: z.object({
    planId: idSchema,
    triggers: z.array(z.string()),
    contingencies: z.array(z.string()),
    controls: z.array(z.string()),
    victimSafety: z.string(),
    accommodation: z.string(),
    employment: z.string(),
    associates: z.string(),
    reviewedAt: isoDate,
  }).optional(),
  era: z.object({
    status: z.enum(['not-started', 'in-progress', 'complete']),
    proposedAddressId: idSchema.optional(),
    assessorName: z.string(),
    startedAt: isoDate,
    concerns: z.array(z.string()),
    conclusion: z.string().optional(),
  }).optional(),
  disclosures: z.array(z.object({
    id: idSchema,
    recipient: z.string(),
    recipientKind: z.enum(['employer', 'school', 'partner', 'landlord', 'other']),
    status: z.enum(['pending', 'approved', 'declined', 'made']),
    factsToDisclose: z.array(z.string()),
    rationale: z.string(),
    decidedByName: z.string().optional(),
    decidedAt: isoDateTime.optional(),
  })),
  preMeetingReturns: z.array(z.object({
    agency: z.enum(AGENCIES),
    contact: z.string(),
    requestedAt: isoDate,
    status: z.enum(['requested', 'returned', 'nothing-known']),
    summary: z.string().optional(),
  })),
  reviewSchedule: z.object({ lastMeetingId: idSchema.optional(), lastMeetingAt: isoDate.optional(), nextDueAt: isoDate.optional() }),
  exit: z.object({ at: isoDate, kind: z.enum(['level-down', 'deregistration', 'transfer']), note: z.string() }).optional(),
  significantCaseReviewTrigger: z.string().optional(),
});
export type MappaDetail = z.infer<typeof mappaDetailSchema>;

/* ---------- AWI ---------- */

export const capacityAssessmentSchema = z.object({
  id: idSchema,
  decision: z.string(),
  assessedAt: isoDateTime,
  assessorName: z.string(),
  assessorRole: z.string(),
  outcome: z.enum(['has-capacity', 'lacks-capacity', 'fluctuating', 'pending']),
  evidence: z.string(),
  communicationSupport: z.string().optional(),
});

export const awiDetailSchema = z.object({
  concern: z.object({
    raisedAt: isoDateTime,
    source: z.string(),
    sourceAgency: z.enum(AGENCIES),
    decisionInQuestion: z.string(),
    summary: z.string(),
  }),
  capacityAssessments: z.array(capacityAssessmentSchema),
  willAndPreferences: z.object({
    recordedAt: isoDateTime,
    byName: z.string(),
    pastWishes: z.string(),
    presentWishes: z.string(),
    communicationMethod: z.string(),
    consultedOthers: z.array(z.object({ personId: idSchema.optional(), name: z.string(), relationship: z.string(), view: z.string() })),
  }).optional(),
  opgResult: z.object({
    checkedAt: isoDateTime,
    reference: z.string(),
    powerOfAttorney: z.object({ exists: z.boolean(), kind: z.enum(['welfare', 'financial', 'combined']).optional(), attorneyName: z.string().optional(), registeredAt: isoDate.optional() }),
    guardianship: z.object({ exists: z.boolean(), guardianName: z.string().optional(), powers: z.array(z.string()).optional(), expiresAt: isoDate.optional() }),
  }).optional(),
  routeDecision: z.object({
    route: z.enum(['informal-support', 's13za', 'poa-covers', 'intervention-order', 'guardianship-welfare', 'guardianship-financial', 'guardianship-combined', 'part5-certificate']),
    decidedAt: isoDateTime,
    byName: z.string(),
    rationale: z.string(),
    s13za: z.object({ considered: z.boolean(), applied: z.boolean(), reasoning: z.string(), objectionFrom: z.string().optional() }).optional(),
  }).optional(),
  application: z.object({
    applicant: z.enum(['council', 'private']),
    applicantName: z.string(),
    solicitor: z.string().optional(),
    powersSought: z.array(z.string()),
    mhoUserId: idSchema.optional(),
    mhoNotifiedAt: isoDateTime,
    mhoReport: z.object({ status: z.enum(['not-started', 'in-progress', 'submitted']), submittedAt: isoDateTime.optional() }),
    medicalReports: z.array(z.object({ practitioner: z.string(), kind: z.enum(['approved-medical-practitioner', 'medical-practitioner']), receivedAt: isoDate.optional(), status: z.enum(['requested', 'received']) })),
    suitabilityReport: z.object({ required: z.boolean(), status: z.enum(['not-required', 'requested', 'received']).optional() }),
    court: z.object({ lodgedAt: isoDate.optional(), hearingAt: isoDate.optional(), sheriffCourt: z.string() }),
    interimOrder: z.object({ soughtAt: isoDate, grantedAt: isoDate.optional(), expiresAt: isoDate.optional(), renewals: z.number().int() }).optional(),
  }).optional(),
  orders: z.array(z.object({
    id: idSchema,
    kind: z.enum(['welfare-guardianship', 'financial-guardianship', 'combined-guardianship', 'intervention-order', 'interim-order']),
    grantedAt: isoDate,
    expiresAt: isoDate.optional(),
    guardianName: z.string(),
    powers: z.array(z.string()),
    supervisingOfficerUserId: idSchema.optional(),
    opgRegisteredAt: isoDate.optional(),
    mwcNotifiedAt: isoDate.optional(),
  })),
  supervisionVisits: z.array(z.object({ at: isoDate, byName: z.string(), summary: z.string() })),
  investigations: z.array(z.object({ section: z.enum(['s10', 's12']), openedAt: isoDate, summary: z.string(), status: z.enum(['open', 'closed']) })),
});
export type AwiDetail = z.infer<typeof awiDetailSchema>;

/* ---------- Process ---------- */

const processBase = {
  id: idSchema,
  synthetic: syntheticSchema,
  reference: z.string(),
  title: z.string(),
  subjectIds: z.array(idSchema).min(1),
  leadAgency: z.enum(AGENCIES),
  leadUserId: idSchema.optional(),
  stage: z.enum(ALL_STAGES),
  stageHistory: z.array(stageEntrySchema),
  status: z.enum(['open', 'closed', 'transferred']),
  classification: classificationSchema,
  /**
   * Whether the record is reachable only by the people on it. Separate from the classification
   * because it is a separate property: a MAPPA record is Official-Sensitive and restricted, an ASP
   * case conference minute can be Official-Sensitive and not.
   */
  accessRestriction: z.enum(ACCESS_RESTRICTIONS),
  /**
   * A recorded Annex 2 override, and the current state of the record's classification.
   *
   * The audit entry is the record of the act; this is the answer to "what is it now". Both, because
   * a ledger cannot answer the second without being replayed, and a field cannot answer the first at
   * all. `auditEntryId` joins them, so a reader looking at a raised marking can reach the entry.
   *
   * Applied as stored: the permission check and the linked-record floor are enforced when it is
   * made, so an override that reached the record was authorised at that moment.
   */
  classificationOverride: z
    .object({
      level: z.enum(CLASSIFICATION_LEVELS),
      sensitive: z.boolean(),
      handling: z.array(z.string()),
      direction: z.enum(['raised', 'lowered']),
      reason: z.string().min(1),
      byUserId: idSchema,
      byName: z.string(),
      at: isoDateTime,
      auditEntryId: idSchema,
    })
    .optional(),
  openedAt: isoDateTime,
  closedAt: isoDateTime.optional(),
  closureReason: z.string().optional(),
  members: z.array(membershipSchema),
  clocks: z.array(clockTriggerSchema),
  linkedProcessIds: z.array(idSchema),
  viewsRecordIds: z.array(idSchema),
  riskAssessmentIds: z.array(idSchema),
  evidenceRefs: z.array(evidenceRefSchema).optional(),
  /** Context flags used by need-to-know conditions, e.g. criminalElement, regulatedService. */
  flags: z.record(z.string(), z.boolean()),
  /** Case-role register: who holds an excluded party role on this process. See need-to-know/parties.ts. */
  parties: z.array(casePartySchema).default([]),
  ...correctable,
};

export const processSchema = z.discriminatedUnion('type', [
  z.object({ ...processBase, type: z.literal('asp'), detail: aspDetailSchema }),
  z.object({ ...processBase, type: z.literal('cp'), detail: cpDetailSchema }),
  z.object({ ...processBase, type: z.literal('marac'), detail: maracDetailSchema }),
  z.object({ ...processBase, type: z.literal('mappa'), detail: mappaDetailSchema }),
  z.object({ ...processBase, type: z.literal('awi'), detail: awiDetailSchema }),
]);
export type Process = z.infer<typeof processSchema>;
export type AspProcess = Extract<Process, { type: 'asp' }>;
export type CpProcess = Extract<Process, { type: 'cp' }>;
export type MaracProcess = Extract<Process, { type: 'marac' }>;
export type MappaProcess = Extract<Process, { type: 'mappa' }>;
export type AwiProcess = Extract<Process, { type: 'awi' }>;
