/**
 * Scenario 8: Chloe Reid, 19, Ardvale, pregnant (EDD 27 Nov 2026). Pre-birth child protection
 * after a midwife's concern about her partner Jordan Blake, who is known to police for domestic
 * abuse of a previous partner. Chloe was herself on the Child Protection Register in 2019 and
 * looked after by Clydeshore Council from 2019 to 2023. She is the subject of a MARAC referral and
 * the mother in the pre-birth process at the same time. The pre-birth CPPM is clocked to 28 weeks
 * gestation (4 Sep), earlier than the 28 calendar day rule would give.
 */
import { partiesFromRoles, type Agency, type Process, type RiskAssessment } from '@mas/domain';
import type { BuildContext } from '../../generator/context';
import { at, makeAction, makeAddress, makeAnalysis, makeConnectorEvent, makeEvent, makeLawfulBasis, makeMeeting, makePerson, makePlan, makeRisk, makeShare, makeViews, relate, syntheticChi } from '../../generator/factory';
import { USR, userName } from '../../generator/organisations';

export const CHLOE = {
  chloe: 'per_chloe_reid',
  jordan: 'per_jordan_blake',
  unborn: 'per_reid_unborn',
  sheena: 'per_sheena_reid',
  donna: 'per_donna_reid',
  cp: 'prc_cp_reid_unborn',
  cp2019: 'prc_cp_chloe_2019',
  marac: 'prc_marac_chloe',
  ird: 'mtg_reid_ird',
  cppm: 'mtg_reid_prebirth_cppm',
  interimPlan: 'pln_reid_interim',
  dash: 'ra_chloe_dash',
} as const;

/** SafeLives DASH for Scotland: 24 questions. Plain-language paraphrases written for this mockup, not the published wording. */
const DASH_QUESTIONS: ReadonlyArray<readonly [string, string]> = [
  ['q1', 'Has the most recent incident left you with any injury?'],
  ['q2', 'Are you very frightened?'],
  ['q3', 'Do you fear that your partner will hurt you or someone else again?'],
  ['q4', 'Do you feel cut off from family and friends, or from people who could help?'],
  ['q5', 'Have you felt depressed, or thought about ending your life?'],
  ['q6', 'Have you separated, or tried to separate, in the past year?'],
  ['q7', 'Is there disagreement or conflict about children or contact with them?'],
  ['q8', 'Does your partner keep contacting you, following you, or checking where you are and who you are with?'],
  ['q9', 'Are you pregnant, or have you had a baby in the last 18 months?'],
  ['q10', 'Is the abuse happening more often?'],
  ['q11', 'Is the abuse getting worse?'],
  ['q12', 'Does your partner try to control what you do, or behave in a very jealous way?'],
  ['q13', 'Has your partner ever used a weapon or an object to hurt you, or threatened to?'],
  ['q14', 'Has your partner ever threatened to kill you or anyone else?'],
  ['q15', 'Has your partner ever tried to strangle, choke or suffocate you?'],
  ['q16', 'Has your partner done or said anything sexual that made you feel bad or that you did not want?'],
  ['q17', 'Is there anyone else who has threatened you or who you are afraid of?'],
  ['q18', 'Do you know whether your partner has hurt anyone else?'],
  ['q19', 'Has your partner ever mistreated an animal or a pet?'],
  ['q20', 'Are there money worries, or does your partner control the money?'],
  ['q21', 'Has your partner had problems in the past year with drugs, alcohol or mental health?'],
  ['q22', 'Has your partner ever threatened or attempted suicide?'],
  ['q23', 'Has your partner ever broken bail, an undertaking or a court order?'],
  ['q24', 'Do you know whether your partner has been in trouble with the police before?'],
];
const DASH_YES = new Set(['q1', 'q2', 'q3', 'q4', 'q5', 'q8', 'q9', 'q10', 'q11', 'q12', 'q18', 'q20', 'q21', 'q22', 'q24']);
const DASH_UNKNOWN = new Set(['q23']);

export function seedChloeReid(ctx: BuildContext): void {
  const name = (id: string) => userName(ctx, id);

  // ----- Personas on the case -----
  const sw = USR.janetKerr;
  const tl = USR.anneHendry;
  const ds = USR.paulMackay;
  const dc = USR.ewanSutherland;
  const cpn = USR.fionaRoss;
  const midwife = USR.kasiaNowicka;
  const hv = USR.sunitaRao;
  const gp = USR.amiraFarouk;
  const housing = USR.markHepburn;
  const idaa = USR.sadiaQureshi;
  const coord = USR.karenFindlay;
  const chair = USR.davidLaird;
  const minutes = USR.lesleyMorton;
  const reporter = USR.islaCrawford;

  // ----- Addresses -----
  const meadow = makeAddress(ctx, { id: 'adr_reid_home', line1: '31 Meadow Loan', town: 'Ardvale', postcode: 'QX1 8QT' });
  const donnaHome = makeAddress(ctx, { id: 'adr_reid_donna', line1: '9 Salt Vennel', town: 'Portnellan', postcode: 'QX3 2JH' });
  const sheenaHome = makeAddress(ctx, { id: 'adr_reid_sheena', line1: '22 Quay Wynd', line2: 'Flat 0/1', town: 'Portnellan', postcode: 'QX3 4LB' });
  const fosterHome = makeAddress(ctx, { id: 'adr_reid_foster', line1: '6 Rowan Gait', town: 'Braeside', postcode: 'QX5 2NB' });
  const supported = makeAddress(ctx, { id: 'adr_reid_supported', line1: '40 Mill Gait', line2: 'Flat 3', town: 'Ardvale', postcode: 'QX1 5DW' });
  const jordanOld = makeAddress(ctx, { id: 'adr_blake_old', line1: '18 Abbey Wynd', line2: 'Flat 3/2', town: 'Kilbrannan', postcode: 'QX2 3TQ' });

  const hh = 'hh_reid';

  // ----- People -----
  const chloe = makePerson(ctx, {
    id: CHLOE.chloe,
    givenName: 'Chloe',
    familyName: 'Reid',
    sex: 'female',
    dateOfBirth: '2007-01-25',
    chi: syntheticChi(ctx, '2007-01-25', 'female'),
    addressHistory: [
      { addressId: donnaHome.id, from: '2007-01-25', to: '2019-03-05', note: "Mother's home" },
      { addressId: sheenaHome.id, from: '2019-03-05', to: '2021-06-14', note: 'Kinship care with her aunt Sheena Reid' },
      { addressId: fosterHome.id, from: '2021-06-14', to: '2023-08-21', note: 'Foster care with the Wallace family' },
      { addressId: supported.id, from: '2023-08-21', to: '2024-02-19', note: 'Supported accommodation (throughcare)' },
      { addressId: meadow.id, from: '2024-02-19', note: 'Scottish Secure Tenancy in her sole name, care leaver priority' },
    ],
    householdId: hh,
    gpPractice: 'Portnellan Medical Practice',
    ethnicity: 'scottish',
    contact: { phone: '07700 900314' },
    alerts: [{ id: 'alt_chloe_care', kind: 'other', text: 'Care experienced: aftercare entitlement to age 26 (Children and Young People (Scotland) Act 2014 s29)', from: '2023-06-20' }],
    createdAt: at('2019-02-15', '20:45'),
  });
  const unborn = makePerson(ctx, {
    id: CHLOE.unborn,
    givenName: 'Unborn baby',
    familyName: 'Reid',
    sex: 'not-recorded',
    lifeStage: 'unborn',
    expectedDeliveryDate: '2026-11-27',
    addressHistory: [{ addressId: meadow.id, from: '2026-08-18', note: "Mother's address" }],
    householdId: hh,
    gpPractice: 'Portnellan Medical Practice',
    createdAt: at('2026-08-18', '16:00'),
  });
  const jordan = makePerson(ctx, {
    id: CHLOE.jordan,
    givenName: 'Jordan',
    familyName: 'Blake',
    sex: 'male',
    dateOfBirth: '2003-03-30',
    chi: syntheticChi(ctx, '2003-03-30', 'male'),
    addressHistory: [
      { addressId: jordanOld.id, from: '2023-06-15', to: '2026-05-10', note: 'Council tenancy given up' },
      { addressId: meadow.id, from: '2026-05-10', note: "Moved into Chloe's tenancy; not on the tenancy. Date approximate." },
    ],
    householdId: hh,
    gpPractice: 'Braeside Health Centre',
    ethnicity: 'scottish',
    contact: { phone: '07700 900522' },
    alerts: [{ id: 'alt_blake_nho', kind: 'other', text: 'Non-harassment order in favour of a previous partner until 11 Sep 2026 (Ardvale Sheriff Court, 12 Mar 2025)', from: '2025-03-12', to: '2026-09-11' }],
    createdAt: at('2024-02-12', '09:00'),
  });
  const sheena = makePerson(ctx, {
    id: CHLOE.sheena,
    givenName: 'Sheena',
    familyName: 'Reid',
    sex: 'female',
    dateOfBirth: '1971-09-03',
    chi: syntheticChi(ctx, '1971-09-03', 'female'),
    addressHistory: [{ addressId: sheenaHome.id, from: '2012-04-01' }],
    gpPractice: 'Portnellan Medical Practice',
    ethnicity: 'scottish',
    contact: { phone: '07700 900377' },
    createdAt: at('2019-02-20', '12:00'),
  });
  const donna = makePerson(ctx, {
    id: CHLOE.donna,
    givenName: 'Donna',
    familyName: 'Reid',
    sex: 'female',
    dateOfBirth: '1984-05-17',
    chi: syntheticChi(ctx, '1984-05-17', 'female'),
    addressHistory: [{ addressId: donnaHome.id, from: '2005-11-01' }],
    gpPractice: 'Portnellan Medical Practice',
    ethnicity: 'scottish',
    createdAt: at('2019-02-15', '20:45'),
  });

  ctx.data.households.push({ id: hh, synthetic: true, addressId: meadow.id, memberIds: [chloe.id, jordan.id], label: 'Reid household, Ardvale' });
  relate(ctx, unborn.id, chloe.id, 'unborn-child-of', { from: '2026-08-18', notes: 'Expected 27 Nov 2026' });
  relate(ctx, jordan.id, unborn.id, 'father-of', { notes: 'Named by Chloe as the father' });
  relate(ctx, jordan.id, chloe.id, 'partner-of', { from: '2025-11-15', notes: 'Relationship from about November 2025; living together since about May 2026' });
  relate(ctx, jordan.id, chloe.id, 'lives-with', { from: '2026-05-10' });
  relate(ctx, donna.id, chloe.id, 'mother-of', { notes: 'Substance use; no contact with Chloe since 2021' });
  relate(ctx, sheena.id, chloe.id, 'aunt-or-uncle-of', { notes: "Chloe's maternal aunt; still in touch by phone" });
  relate(ctx, sheena.id, chloe.id, 'carer-of', { from: '2019-03-05', to: '2021-06-14', notes: 'Kinship carer under a compulsory supervision order; placement ended because of her ill health' });

  // ----- Lawful bases -----
  const lbCp = makeLawfulBasis(ctx, {
    id: 'lb_reid_cp',
    purpose: 'Pre-birth child protection inquiry and planning for the unborn baby of Chloe Reid',
    article6: '6(1)(e) public task',
    article9Condition: '9(2)(g) substantial public interest, DPA 2018 Sch 1 Pt 2 para 18 (safeguarding)',
    article10Criminal: 'DPA 2018 s10 and Sch 1',
    statutoryGateway: ['Children (Scotland) Act 1995', 'National Guidance for Child Protection in Scotland 2021, Part 4 (unborn babies)', 'Children and Young People (Scotland) Act 2014'],
    necessityAndProportionality: "Sharing across midwifery, social work, police, health visiting and housing is necessary to assess the likely risk of significant harm to the baby after birth and to plan before 28 weeks gestation. Chloe's own care history is included because it bears on support needs, not as a judgement on her.",
    consentStatus: 'not-required',
    consentNote: 'Chloe was told of the concern on 18 Aug and of the IRD on 20 Aug and has taken part. Jordan Blake was told of the concern on 21 Aug; police information about him was not shared with him.',
    authorisedByUserId: tl,
    authorisedByName: name(tl),
    informationSharingAgreementRef: 'Clydeshore CPC ISA 2024/03',
    dpiaRef: 'DPIA-CP-2024-07',
    createdAt: at('2026-08-20', '10:30'),
  });
  const lbMarac = makeLawfulBasis(ctx, {
    id: 'lb_chloe_marac',
    purpose: 'MARAC referral and safety planning for Chloe Reid',
    article6: '6(1)(e) public task',
    article9Condition: '9(2)(g) substantial public interest, DPA 2018 Sch 1 Pt 2 para 18 (safeguarding)',
    article10Criminal: 'DPA 2018 s10 and Sch 1',
    statutoryGateway: ['Clydeshore MARAC Operating Protocol 2025', 'Clydeshore MARAC information sharing agreement', 'DPA 2018 s10 and Sch 1 (offence data about Jordan Blake)'],
    necessityAndProportionality: 'High-risk DASH (15 of 24) for a pregnant victim whose partner has a domestic abuse conviction. Sharing is limited to what each agency needs to reduce risk to Chloe and her baby. The perpetrator is not told about the MARAC.',
    consentStatus: 'sought-and-given',
    consentNote: 'Chloe agreed to the referral on 25 Aug. She asked that Jordan is not told she has spoken to anyone.',
    authorisedByUserId: coord,
    authorisedByName: name(coord),
    informationSharingAgreementRef: 'Clydeshore MARAC ISA 2025/01',
    dpiaRef: 'DPIA-MARAC-2025-02',
    createdAt: at('2026-08-26', '11:30'),
  });

  // ----- DASH, 15 yes of 24 -----
  const dashItems: NonNullable<RiskAssessment['items']> = DASH_QUESTIONS.map(([id, question]) => ({ id, question, answer: DASH_YES.has(id) ? 'yes' : DASH_UNKNOWN.has(id) ? 'unknown' : 'no' }));
  const dash = makeRisk(ctx, {
    id: CHLOE.dash,
    processId: CHLOE.marac,
    subjectId: chloe.id,
    tool: 'dash',
    assessedAt: at('2026-08-25', '14:30'),
    assessorUserId: midwife,
    assessorName: name(midwife),
    assessorAgency: 'health',
    score: 15,
    maxScore: 24,
    band: 'high',
    bandLabel: 'High risk (14 or more)',
    items: dashItems,
    evidenceRefs: [{ kind: 'record', ref: 'TrakCare maternity note 25 Aug 2026', label: 'Antenatal appointment record' }],
  });

  // ----- Closed CP process: Chloe as a child, 2019 to 2020 -----
  const cp2019: Process = {
    id: CHLOE.cp2019,
    synthetic: true,
    type: 'cp',
    reference: 'CP-2019-0088',
    title: 'Child protection: Chloe Reid (closed 2020)',
    subjectIds: [chloe.id],
    leadAgency: 'social-work',
    stage: 'closed',
    stageHistory: [
      { stage: 'concern', at: at('2019-02-15', '20:45'), byName: 'Concern hub officer', note: 'Police Child Concern Report: mother intoxicated, Chloe (12) alone, no food' },
      { stage: 'ird', at: at('2019-02-20', '10:00'), byUserId: tl, byName: name(tl), note: 'IRD held' },
      { stage: 'investigation', at: at('2019-02-20', '12:00'), byUserId: tl, byName: name(tl), note: 'Joint investigation; Chloe staying with her aunt' },
      { stage: 'cppm', at: at('2019-03-19', '10:00'), byName: 'CP chair (2019)', note: 'Initial CPPM: registered' },
      { stage: 'childs-plan', at: at('2019-03-19', '12:00'), byName: 'CP chair (2019)', note: "Child's plan; core group" },
      { stage: 'review', at: at('2019-10-09', '10:00'), byName: 'CP chair (2019)', note: 'Review CPPM: registration continued pending the hearing outcome' },
      { stage: 'deregistered', at: at('2020-11-04', '11:00'), byName: 'CP chair (2020)', note: 'De-registered: living with her aunt under a compulsory supervision order' },
      { stage: 'closed', at: at('2020-11-04', '12:00'), byName: 'Former allocated worker', note: 'Transferred to the looked after children team' },
    ],
    status: 'closed',
    classification: 'official-sensitive',
    openedAt: at('2019-02-15', '20:45'),
    closedAt: at('2020-11-04', '12:00'),
    closureReason: "De-registered 4 Nov 2020: Chloe living with her aunt under a compulsory supervision order; the risk from her mother's substance use is managed by the placement. Case transferred to the looked after children team.",
    members: [{ userId: tl, caseRole: 'team leader (historic)', agency: 'social-work', since: '2019-02-15', reason: 'Social work senior at the 2019 IRD' }],
    clocks: [{ id: 'clk_chloe2019_cppm', ruleId: 'cp.cppm.initial', triggeredAt: at('2019-02-20', '10:00'), completedAt: at('2019-03-19', '10:00'), note: 'CPPM held on day 27' }],
    linkedProcessIds: [CHLOE.cp],
    viewsRecordIds: [],
    riskAssessmentIds: [],
    flags: { schoolAge: true, preSchool: false, jii: false, housingRelevant: false, unborn: false },
    parties: [],
    detail: {
      concern: {
        receivedAt: at('2019-02-15', '20:45'),
        source: 'Police Child Concern Report, with a wellbeing concern from Ardvale Primary',
        sourceAgency: 'police',
        sourceReference: 'IVPD-CCR-2019-02-0412',
        summary: 'Officers found Donna Reid intoxicated and asleep on the floor at 9 Salt Vennel at 20:00. Chloe (12) had made herself toast; no other food in the house; no heating. The school had raised concerns about hunger, hygiene and lateness since November 2018.',
      },
      proceduresInitiatedAt: at('2019-02-20', '10:00'),
      ird: {
        heldAt: at('2019-02-20', '10:00'),
        outOfHours: false,
        participants: [
          { agency: 'social-work', name: name(tl), role: 'Team leader (decision maker)', userId: tl },
          { agency: 'police', name: 'DS (PPU, 2019)', role: 'Detective sergeant, PPU' },
          { agency: 'health', name: 'CP nurse adviser (2019)', role: 'Child protection nurse adviser' },
          { agency: 'education', name: 'Head teacher, Ardvale Primary (2019)', role: 'Named person' },
        ],
        contributions: [
          { agency: 'police', byName: 'DS (PPU, 2019)', at: at('2019-02-20', '10:05'), summary: 'Two previous concern reports (2017, 2018) about the mother\'s drinking. No offences against Chloe.' },
          { agency: 'education', byName: 'Head teacher, Ardvale Primary (2019)', at: at('2019-02-20', '10:15'), summary: 'Hungry, unwashed and late most days since November. Bright and well liked. Mother has not answered letters or calls.' },
        ],
        decisions: {
          significantHarm: { decided: true, decision: 'Yes. Neglect linked to parental substance use.', rationale: 'Persistent lack of food, warmth and supervision.', at: at('2019-02-20', '11:00'), byName: name(tl), byUserId: tl },
          investigationNeeded: { decided: true, decision: 'Yes.', rationale: 'Assessment of the mother\'s capacity and of kinship options.', at: at('2019-02-20', '11:00'), byName: name(tl), byUserId: tl },
          jii: { decided: true, decision: 'No. Chloe to be seen alone by the social worker.', rationale: 'No offence alleged against her; her account can be taken in a single interview.', at: at('2019-02-20', '11:05'), byName: name(tl), byUserId: tl },
          medical: { decided: true, decision: 'Comprehensive medical.', rationale: 'Growth and general health check after a period of neglect.', kind: 'comprehensive', consentBy: 'Donna Reid (mother)', at: at('2019-02-20', '11:05'), byName: 'CP nurse adviser (2019)' },
          emergencyMeasures: { decided: true, decision: 'None. Chloe to stay with her aunt Sheena Reid under section 25 with the mother\'s agreement.', rationale: 'Safe kinship placement available today.', measure: 'none', at: at('2019-02-20', '11:10'), byName: name(tl), byUserId: tl },
          reporterReferral: { decided: true, decision: 'Yes. Referral to the Reporter.', rationale: 'Compulsory measures likely to be needed to secure the placement.', at: at('2019-02-20', '11:10'), byName: name(tl), byUserId: tl },
          parentsInformed: { decided: true, decision: 'Mother informed and agreed to the placement.', rationale: 'No criminal investigation; nothing withheld.', at: at('2019-02-20', '11:12'), byName: name(tl), byUserId: tl },
        },
        siblingsConsidered: [],
        childViewsSought: 'Chloe was seen alone at school on 20 Feb 2019. She said she wanted to stay with her aunt and to keep going to Ardvale Primary.',
      },
      investigation: { openedAt: at('2019-02-20', '12:00'), medicalHeldAt: at('2019-02-22', '14:00'), summary: 'Medical: underweight, otherwise well. Mother acknowledged drinking daily and did not engage with the alcohol service. Chloe settled with her aunt.' },
      cppm: { heldAt: at('2019-03-19', '10:00'), decision: 'register', rationale: 'Risk of neglect if returned to her mother; registration to hold the plan while compulsory measures were sought.' },
      register: { registeredAt: '2019-03-19', categories: ['neglect', 'parental-substance-use'], deregisteredAt: '2020-11-04', deregistrationReason: 'Living with her aunt under a compulsory supervision order; the risk from her mother is managed by the placement.' },
    },
  };
  ctx.data.processes.push(cp2019);

  // ----- Pre-birth CP process -----
  const cp: Process = {
    id: CHLOE.cp,
    synthetic: true,
    type: 'cp',
    reference: 'CP-2026-0447',
    title: 'Pre-birth child protection: unborn baby Reid',
    subjectIds: [unborn.id],
    leadAgency: 'social-work',
    leadUserId: sw,
    stage: 'investigation',
    stageHistory: [
      { stage: 'concern', at: at('2026-08-18', '16:00'), byUserId: midwife, byName: name(midwife), note: 'Pre-birth concern from the community midwife after a disclosure at an antenatal appointment, with a police concern report of 9 Aug' },
      { stage: 'ird', at: at('2026-08-20', '10:00'), byUserId: tl, byName: name(tl), note: 'Pre-birth IRD held' },
      { stage: 'investigation', at: at('2026-08-20', '12:00'), byUserId: sw, byName: name(sw), note: 'Pre-birth assessment opened; CPPM to be held before 28 weeks' },
    ],
    status: 'open',
    classification: 'official-sensitive',
    openedAt: at('2026-08-18', '16:00'),
    members: [
      { userId: sw, caseRole: 'allocated social worker and lead professional', agency: 'social-work', since: '2026-08-20', reason: 'Allocated at the IRD' },
      { userId: tl, caseRole: 'team leader (IRD decision maker)', agency: 'social-work', since: '2026-08-20', reason: 'Social work senior at the IRD' },
      { userId: ds, caseRole: 'detective sergeant, PPU', agency: 'police', since: '2026-08-20', reason: "Police decision maker at the IRD; holds Jordan Blake's history" },
      { userId: cpn, caseRole: 'child protection nurse adviser', agency: 'health', since: '2026-08-20', reason: 'Health decision maker at the IRD' },
      { userId: midwife, caseRole: 'community midwife (referrer)', agency: 'health', since: '2026-08-18', reason: 'Raised the concern; unborn baby' },
      { userId: hv, caseRole: 'health visitor (pre-birth pathway)', agency: 'health', since: '2026-08-20', reason: 'Named person after birth; pre-birth contact' },
      { userId: housing, caseRole: 'housing officer', agency: 'housing', since: '2026-08-20', reason: "Tenancy in Chloe's sole name; options if Jordan Blake is asked to leave" },
      { userId: chair, caseRole: 'chair', agency: 'social-work', since: '2026-08-21', reason: 'Independent chair of the pre-birth CPPM on 4 Sep' },
      { userId: minutes, caseRole: 'minute taker', agency: 'social-work', since: '2026-08-21', reason: 'Minutes and distribution' },
    ],
    clocks: [
      { id: 'clk_reid_prebirth', ruleId: 'cp.prebirth.cppm', triggeredAt: at('2026-08-20', '10:00'), dueOverride: '2026-09-04', overrideReason: 'By 28 weeks gestation (national guidance), earlier than the 28 calendar day rule', note: '28 weeks falls on 4 Sep 2026 (EDD 27 Nov 2026)' },
    ],
    linkedProcessIds: [CHLOE.marac, CHLOE.cp2019],
    viewsRecordIds: ['vw_reid_mother'],
    riskAssessmentIds: [dash.id],
    flags: { unborn: true, schoolAge: false, preSchool: false, jii: false, housingRelevant: true, pregnant: true, criminalElement: true },
    parties: [],
    detail: {
      concern: {
        receivedAt: at('2026-08-18', '16:00'),
        source: 'Community midwife, Clydeshore Royal Infirmary, with a police concern report of 9 Aug',
        sourceAgency: 'health',
        sourceReference: 'TrakCare maternity note 18 Aug 2026; IVPD-ACR-2026-08-1187',
        summary: 'At her 25 week appointment Chloe disclosed that Jordan Blake grabbed her wrist during an argument on 9 Aug, controls her money and checks her phone, and that she is frightened of him when he drinks. Police attended the address on 9 Aug after neighbours reported shouting. Jordan Blake has a 2025 conviction for assaulting a previous partner. Chloe booked late at 15 weeks and answered no to the routine domestic abuse enquiry then.',
      },
      proceduresInitiatedAt: at('2026-08-20', '10:00'),
      ird: {
        meetingId: CHLOE.ird,
        heldAt: at('2026-08-20', '10:00'),
        outOfHours: false,
        participants: [
          { agency: 'social-work', name: name(tl), role: 'Team leader (decision maker)', userId: tl },
          { agency: 'police', name: `DS ${name(ds)}`, role: 'Detective sergeant, PPU', userId: ds },
          { agency: 'health', name: name(cpn), role: 'Child protection nurse adviser', userId: cpn },
          { agency: 'health', name: name(midwife), role: 'Community midwife (referrer)', userId: midwife },
          { agency: 'health', name: name(hv), role: 'Health visitor, pre-birth pathway', userId: hv },
        ],
        contributions: [
          { agency: 'health', byName: name(midwife), byUserId: midwife, at: at('2026-08-20', '10:05'), summary: 'Booked at 15 weeks; answered no to the domestic abuse enquiry then. Pregnancy progressing normally, EDD 27 Nov. Disclosure on 18 Aug: wrist grabbed, money and phone controlled, frightened when he drinks. Wants the baby and wants to stay in her flat.' },
          { agency: 'police', byName: `DS ${name(ds)}`, byUserId: ds, at: at('2026-08-20', '10:15'), summary: 'Jordan Blake: concern report 2024 and assault on a previous partner Nov 2024; convicted Mar 2025 with an 18 month non-harassment order; alleged breach Aug 2025 not proceeded. Concern report 9 Aug 2026 at Meadow Loan, Chloe pregnant. DSDAS to be considered.' },
          { agency: 'social-work', byName: name(tl), byUserId: tl, at: at('2026-08-20', '10:25'), summary: 'Chloe was registered in 2019 under neglect and parental substance use, then looked after by kinship and foster carers until 2023. Throughcare ended at her request in 2025; aftercare entitlement continues. No concerns about her own conduct. Isolated: no contact with her mother; aunt by phone only.' },
          { agency: 'health', byName: name(hv), byUserId: hv, at: at('2026-08-20', '10:32'), summary: 'Not yet known to health visiting. Pre-birth contact to be offered before the CPPM. GP record shows anxiety and sertraline, stopped in pregnancy.' },
          { agency: 'health', byName: name(cpn), byUserId: cpn, at: at('2026-08-20', '10:36'), summary: 'No health concern about the pregnancy itself. The risk is domestic abuse after birth and Chloe\'s limited support network.' },
        ],
        decisions: {
          significantHarm: { decided: true, decision: 'Yes. The unborn baby is likely to be at risk of significant harm after birth from domestic abuse in the home.', rationale: 'A partner with a conviction for domestic abuse, a current disclosure of physical and controlling behaviour during pregnancy, and a mother with very little support around her.', at: at('2026-08-20', '10:50'), byName: name(tl), byUserId: tl },
          investigationNeeded: { decided: true, decision: 'Yes. Pre-birth assessment led by social work with midwifery, police and health visiting.', rationale: 'A plan is needed before the birth; the CPPM must be held by 28 weeks.', at: at('2026-08-20', '10:50'), byName: name(tl), byUserId: tl },
          jii: { decided: true, decision: 'Not applicable: the subject is an unborn baby.', rationale: 'There is no child to interview. Chloe is an adult and her account has been taken by the midwife and the social worker.', at: at('2026-08-20', '10:52'), byName: `DS ${name(ds)}`, byUserId: ds },
          medical: { decided: true, decision: 'Not applicable. Antenatal care continues with the community midwife.', rationale: 'No child protection medical for an unborn baby; the midwife will document any injury to Chloe with her consent.', kind: 'none', at: at('2026-08-20', '10:52'), byName: name(cpn), byUserId: cpn },
          emergencyMeasures: { decided: true, decision: 'None. Interim safety plan agreed with Chloe.', rationale: 'No order is available for an unborn baby; Chloe is engaging and has agreed to the plan.', measure: 'none', at: at('2026-08-20', '10:55'), byName: name(tl), byUserId: tl },
          reporterReferral: { decided: true, decision: 'Considered and not made. A referral cannot be made for an unborn child; to be reconsidered at birth if compulsory measures are needed.', rationale: "The Children's Hearings (Scotland) Act 2011 applies from birth. The CPPM will record the position again.", at: at('2026-08-20', '10:57'), byName: name(tl), byUserId: tl },
          parentsInformed: { decided: true, decision: 'Chloe informed and taking part. Jordan Blake to be told of the child protection concern by the social worker on 21 Aug, but not of the police information or the DSDAS consideration.', rationale: 'He has parental interest and needs to know a pre-birth assessment is under way. Police information is withheld because it would increase risk to Chloe and could compromise a DSDAS disclosure.', withheld: 'Police information about Jordan Blake\'s history and the DSDAS consideration withheld from him. The MARAC is never disclosed to him.', at: at('2026-08-20', '11:00'), byName: name(tl), byUserId: tl },
        },
        siblingsConsidered: [],
        interimSafetyPlanId: CHLOE.interimPlan,
        childViewsSought: "Not applicable to an unborn baby. Chloe's own views as the mother were sought by the social worker on 20 Aug and are recorded.",
      },
      investigation: {
        openedAt: at('2026-08-20', '12:00'),
        summary: 'Pre-birth assessment under way. Chloe seen on 20, 24 and 28 Aug; consistent account; wants the baby and wants to stay in her tenancy; not ready to end the relationship. Jordan Blake told of the concern on 21 Aug; declined a parenting capacity appointment on 29 Aug. DSDAS Power to Tell disclosure made to Chloe on 31 Aug. MARAC referral 26 Aug. Pre-birth CPPM 4 Sep at 28 weeks.',
      },
      cppm: { meetingId: CHLOE.cppm, decision: 'pending' },
      preBirth: { expectedDeliveryDate: '2026-11-27', motherPersonId: chloe.id, gestationWeeksAtConcern: 25 },
    },
  };
  ctx.data.processes.push(cp);

  // ----- MARAC process (referral stage) -----
  const marac: Process = {
    id: CHLOE.marac,
    synthetic: true,
    type: 'marac',
    reference: 'MARAC-2026-0101',
    title: 'MARAC: Chloe Reid',
    subjectIds: [chloe.id],
    leadAgency: 'social-work',
    leadUserId: coord,
    stage: 'referral',
    stageHistory: [
      { stage: 'referral', at: at('2026-08-26', '11:00'), byUserId: coord, byName: name(coord), note: 'Referral from midwifery after DASH 15 of 24. To be listed for 23 Sep; research requests to follow.' },
    ],
    status: 'open',
    classification: 'official-sensitive',
    openedAt: at('2026-08-26', '11:00'),
    members: [
      { userId: coord, caseRole: 'MARAC Coordinator', agency: 'social-work', since: '2026-08-26', reason: 'Receives the referral; will send research requests' },
      { userId: idaa, caseRole: 'IDAA', agency: 'third-sector', since: '2026-08-26', reason: 'Supports Chloe and represents her wishes; she does not attend' },
      { userId: midwife, caseRole: 'referrer (midwifery)', agency: 'health', since: '2026-08-26', reason: 'Completed the DASH and referred; presents at the meeting' },
      { userId: dc, caseRole: 'police domestic abuse unit', agency: 'police', since: '2026-08-27', reason: 'Holds the perpetrator history; DSDAS disclosure' },
    ],
    clocks: [],
    linkedProcessIds: [CHLOE.cp],
    viewsRecordIds: ['vw_chloe_victim'],
    riskAssessmentIds: [dash.id],
    flags: { children: false, pregnant: true, perpetratorInCustody: false, perpetratorMappa: false, matacConsidered: false, criminalElement: true },
    // Case-role register. The perpetrator comes from the referral; associates are derived from relationship
    // records once the process exists (partiesFromRoles). Chloe and the unborn baby are never excluded.
    parties: [
      {
        personId: jordan.id,
        party: 'perpetrator',
        label: 'Perpetrator (named in the referral)',
        since: '2026-08-26',
        source: 'referral',
        reason: 'Named as the perpetrator in the midwifery MARAC referral of 26 Aug 2026; lives with Chloe',
      },
    ],
    detail: {
      referral: {
        receivedAt: at('2026-08-26', '11:00'),
        referringAgency: 'health',
        referrerName: `${name(midwife)}, community midwife`,
        riskAssessmentId: dash.id,
        professionalJudgementReferral: false,
        repeat: false,
        victimPersonId: chloe.id,
        perpetratorPersonId: jordan.id,
        childPersonIds: [],
        summary: 'Chloe Reid, 19, 26 weeks pregnant (EDD 27 Nov 2026), disclosed to her midwife on 18 Aug that her partner Jordan Blake grabbed her wrist, controls her money and phone, and frightens her when he drinks. DASH 25 Aug: 15 of 24. Jordan Blake has a 2025 conviction for assaulting a previous partner and a non-harassment order in her favour. No children yet: the baby is unborn and is the subject of pre-birth child protection process CP-2026-0447.',
      },
      researchRequests: [],
      idaa: { userId: idaa, name: name(idaa), organisation: "Clydeshore Women's Aid" },
      idaaFeedback: [
        { at: at('2026-08-28', '15:00'), byName: name(idaa), summary: 'Chloe wants to stay in her flat and keep the baby with her. She is not ready to end the relationship and does not want Jordan charged. She wants him to get help with his drinking and temper. She does not want him to know she has spoken to anyone.', victimResponse: 'Accepted a safety plan and a phone number for the IDAA. Anxious about the CPPM and about being judged because of her own history.' },
      ],
      flags: [],
      links: {
        cpProcessId: CHLOE.cp,
        matacConsidered: false,
        dsdasConsidered: true,
        dsdasNote: 'Power to Tell disclosure made to Chloe on 31 Aug 2026 by DC Sutherland: the outline of Jordan Blake\'s March 2025 conviction and the non-harassment order. Chloe said she had not known about the order.',
      },
      safeLivesReturn: { referralSource: 'Health (midwifery)', repeat: false, childrenCount: 0, outcomeCodes: [] },
    },
  };
  marac.parties.push(...partiesFromRoles(marac, ctx.data.relationships).filter((p) => p.party === 'perpetrator-associates'));
  ctx.data.processes.push(marac);

  // ----- Views -----
  makeViews(ctx, { id: 'vw_reid_mother', personId: chloe.id, processId: cp.id, kind: 'family-views', recordedAt: at('2026-08-20', '12:00'), recordedByUserId: sw, recordedByName: name(sw), recordedByAgency: 'social-work', method: 'In person at the office after the IRD; offered her aunt or a Women\'s Aid worker as support', content: '"I want this baby to have what I did not have. A mum who is there, a house that is warm, food in the cupboards. I am not my mum. Jordan is not always like that, he is good when he is not drinking. I do not want to lose my flat and I do not want you taking my baby. Tell me what I need to do and I will do it."', sharingPreference: 'Chloe asked that Jordan is not told what she said about him. She is content for the midwife and the health visitor to see this record.' });
  makeViews(ctx, { id: 'vw_chloe_victim', personId: chloe.id, processId: marac.id, kind: 'victim-wishes', recordedAt: at('2026-08-28', '15:00'), recordedByUserId: idaa, recordedByName: name(idaa), recordedByAgency: 'third-sector', method: 'IDAA meeting at the antenatal clinic, Jordan not present', content: 'Chloe wants to stay in her tenancy and keep the baby with her after the birth. She is not ready to end the relationship and does not want Jordan charged. She wants him to get help with drinking and his temper. She would like a plan for labour and the hospital stay so that she is never alone with him on the ward if things go wrong. She does not want him to know she has spoken to anyone.', sharingPreference: 'To be represented at MARAC and the CPPM by the IDAA. Not to be shared with Jordan Blake.' });

  // ----- Interim safety plan and actions -----
  makePlan(ctx, {
    id: CHLOE.interimPlan,
    processId: cp.id,
    type: 'interim-safety',
    title: 'Interim safety plan (pre-birth IRD 20 Aug 2026)',
    outcomes: [{ id: 'out_reid_isp_1', text: 'Chloe and the baby are safe during the pregnancy and a plan is in place before 28 weeks', actionIds: ['act_reid_1', 'act_reid_2', 'act_reid_3'] }],
    coordinatorUserId: sw,
    coordinatorName: name(sw),
    agreedAt: '2026-08-20',
    reviewDate: '2026-09-04',
    status: 'active',
  });
  makeAction(ctx, { id: 'act_reid_1', processId: cp.id, meetingId: CHLOE.ird, planId: CHLOE.interimPlan, title: 'Midwife to see Chloe fortnightly, alone for part of each appointment; safe word agreed for phone contact', ownerUserId: midwife, ownerName: name(midwife), ownerAgency: 'health', due: '2026-09-04', status: 'in-progress', evidence: 'Seen alone 25 Aug (DASH completed) and 1 Sep', createdAt: at('2026-08-20', '11:05'), createdByName: name(tl) });
  makeAction(ctx, { id: 'act_reid_2', processId: cp.id, meetingId: CHLOE.ird, planId: CHLOE.interimPlan, title: "Social work to see Chloe weekly at home or a safe place; assess Jordan Blake's parenting capacity separately", ownerUserId: sw, ownerName: name(sw), ownerAgency: 'social-work', due: '2026-09-04', status: 'in-progress', evidence: 'Chloe seen 20, 24 and 28 Aug. Jordan Blake declined the appointment on 29 Aug', createdAt: at('2026-08-20', '11:05'), createdByName: name(tl) });
  makeAction(ctx, { id: 'act_reid_3', processId: cp.id, meetingId: CHLOE.ird, planId: CHLOE.interimPlan, title: "Police to review Jordan Blake's history and the non-harassment order, and consider a DSDAS disclosure to Chloe", ownerUserId: ds, ownerName: `DS ${name(ds)}`, ownerAgency: 'police', due: '2026-08-31', status: 'complete', completedAt: at('2026-08-31', '15:30'), evidence: 'Power to Tell disclosure made to Chloe on 31 Aug by DC Sutherland', createdAt: at('2026-08-20', '11:05'), createdByName: name(tl) });
  makeAction(ctx, { id: 'act_reid_4', processId: cp.id, title: "Housing: confirm the tenancy is in Chloe's sole name and set out options if Jordan Blake is asked to leave", ownerUserId: housing, ownerName: name(housing), ownerAgency: 'housing', due: '2026-09-03', status: 'open', createdAt: at('2026-08-20', '12:30'), createdByName: name(sw) });
  makeAction(ctx, { id: 'act_reid_5', processId: cp.id, title: 'Health visitor pre-birth contact with Chloe before the CPPM', ownerUserId: hv, ownerName: name(hv), ownerAgency: 'health', due: '2026-09-02', status: 'open', createdAt: at('2026-08-20', '12:30'), createdByName: name(sw) });
  makeAction(ctx, { id: 'act_reid_6', processId: marac.id, title: 'IDAA safety plan with Chloe, including a plan for labour and the hospital stay', ownerUserId: idaa, ownerName: name(idaa), ownerAgency: 'third-sector', due: '2026-09-11', status: 'in-progress', evidence: 'First meeting 28 Aug; hospital plan to be agreed with the midwife', createdAt: at('2026-08-26', '11:30'), createdByName: name(coord) });

  // ----- Meetings -----
  makeMeeting(ctx, {
    id: CHLOE.ird,
    type: 'ird',
    processId: cp.id,
    subjectIds: [unborn.id],
    title: 'Pre-birth IRD: unborn baby Reid',
    scheduledAt: at('2026-08-20', '10:00'),
    endsAt: at('2026-08-20', '11:05'),
    location: 'Teams call (Ardvale PPU host)',
    status: 'held',
    chairUserId: tl,
    chairName: name(tl),
    invitees: [
      { userId: tl, name: name(tl), agency: 'social-work', role: 'Team leader', required: true, attendance: 'present', reason: 'Social work senior', needToKnowRowId: 'cp.ird.sw' },
      { userId: ds, name: `DS ${name(ds)}`, agency: 'police', role: 'Detective sergeant, PPU', required: true, attendance: 'present', reason: 'Police decision maker', needToKnowRowId: 'cp.ird.ds' },
      { userId: cpn, name: name(cpn), agency: 'health', role: 'Child protection nurse adviser', required: true, attendance: 'present', reason: 'Health decision maker', needToKnowRowId: 'cp.ird.health' },
      { userId: midwife, name: name(midwife), agency: 'health', role: 'Community midwife', required: true, attendance: 'present', reason: 'Unborn baby; referrer', needToKnowRowId: 'cp.ird.midwife' },
      { userId: hv, name: name(hv), agency: 'health', role: 'Health visitor', required: false, attendance: 'present', reason: 'Pre-birth pathway; named person after birth' },
    ],
    agenda: [
      { id: 'ag_reid_ird_1', order: 1, title: 'Concern and immediate safety', status: 'done' },
      { id: 'ag_reid_ird_2', order: 2, title: "Information from each agency, including Chloe's own history", status: 'done' },
      { id: 'ag_reid_ird_3', order: 3, title: 'Decisions: likely significant harm, assessment, JII and medical (not applicable)', status: 'done' },
      { id: 'ag_reid_ird_4', order: 4, title: 'Interim safety plan and information to the parents', status: 'done' },
      { id: 'ag_reid_ird_5', order: 5, title: 'Reporter, MARAC and DSDAS; CPPM date by 28 weeks', status: 'done' },
    ],
    informationShared: [
      { id: 'is_reid_ird_1', agency: 'health', byName: name(midwife), byUserId: midwife, at: at('2026-08-20', '10:05'), summary: 'Late booking; disclosure of 18 Aug; pregnancy normal; EDD 27 Nov.', relevance: 'Source of concern; timing for the plan', linkedEventIds: [] },
      { id: 'is_reid_ird_2', agency: 'police', byName: `DS ${name(ds)}`, byUserId: ds, at: at('2026-08-20', '10:15'), summary: "Jordan Blake's 2024 to 2025 history with a previous partner; 9 Aug concern report at Meadow Loan.", relevance: 'Perpetrator risk; DSDAS', linkedEventIds: [] },
      { id: 'is_reid_ird_3', agency: 'social-work', byName: name(tl), byUserId: tl, at: at('2026-08-20', '10:25'), summary: "Chloe's registration in 2019, care history to 2023, throughcare ended 2025, aftercare entitlement.", relevance: 'Support needs and isolation, not a judgement on Chloe', linkedEventIds: [] },
      { id: 'is_reid_ird_4', agency: 'health', byName: name(hv), byUserId: hv, at: at('2026-08-20', '10:32'), summary: 'Not yet known to health visiting; GP anxiety history.', relevance: 'Pre-birth contact', linkedEventIds: [] },
    ],
    decisions: [
      { id: 'dec_reid_ird_1', question: 'Is the unborn baby likely to be at risk of significant harm?', decision: 'Yes', rationale: 'Domestic abuse by a partner with a conviction, disclosed during pregnancy; mother isolated', dissent: [], decidedByName: name(tl), decidedByUserId: tl, decidedAt: at('2026-08-20', '10:50') },
      { id: 'dec_reid_ird_2', question: 'Is a JII needed?', decision: 'Not applicable (unborn baby)', rationale: 'No child to interview; the mother is an adult and has given her account', dissent: [], decidedByName: `DS ${name(ds)}`, decidedByUserId: ds, decidedAt: at('2026-08-20', '10:52') },
      { id: 'dec_reid_ird_3', question: 'Is a medical needed?', decision: 'Not applicable; antenatal care continues', rationale: 'No child protection medical for an unborn baby', dissent: [], decidedByName: name(cpn), decidedByUserId: cpn, decidedAt: at('2026-08-20', '10:52') },
      { id: 'dec_reid_ird_4', question: 'Emergency measures?', decision: 'None; interim safety plan agreed with Chloe', rationale: 'No order available for an unborn baby; Chloe engaging', dissent: [], decidedByName: name(tl), decidedByUserId: tl, decidedAt: at('2026-08-20', '10:55') },
      { id: 'dec_reid_ird_5', question: 'Referral to the Reporter?', decision: 'Considered and not made; reconsider at birth if needed', rationale: 'A referral cannot be made for an unborn child', dissent: [], decidedByName: name(tl), decidedByUserId: tl, decidedAt: at('2026-08-20', '10:57') },
      { id: 'dec_reid_ird_6', question: 'What is shared with the parents, and what is withheld?', decision: 'Chloe told everything. Jordan Blake told of the concern on 21 Aug, not of the police information', rationale: 'He needs to know an assessment is under way; police information withheld to protect Chloe and the DSDAS route', dissent: [{ byName: name(midwife), byUserId: midwife, agency: 'health', text: 'Midwifery would have waited to tell Jordan Blake until the DSDAS disclosure had been made to Chloe, because telling him first could raise the risk to her at home. Accepted with the safeguard that the social worker sees Chloe alone the same week.' }], decidedByName: name(tl), decidedByUserId: tl, decidedAt: at('2026-08-20', '11:00') },
      { id: 'dec_reid_ird_7', question: 'When is the pre-birth CPPM?', decision: '4 Sep 2026, at 28 weeks gestation', rationale: 'National guidance: within 28 days of the concern and by 28 weeks; 28 weeks comes first', dissent: [], decidedByName: name(tl), decidedByUserId: tl, decidedAt: at('2026-08-20', '11:02') },
    ],
    actionIds: ['act_reid_1', 'act_reid_2', 'act_reid_3'],
    viewsRecordIds: ['vw_reid_mother'],
    minute: { status: 'distributed', draftedAt: at('2026-08-20', '13:30'), approvedAt: at('2026-08-20', '15:40'), distributedAt: at('2026-08-20', '16:00') },
    distribution: [
      { id: 'dist_reid_ird_1', recipientName: name(sw), recipientUserId: sw, agency: 'social-work', role: 'Allocated social worker', detailLevel: 'full', reason: 'Lead professional', sharingRecordId: 'shr_reid_1' },
      { id: 'dist_reid_ird_2', recipientName: name(midwife), recipientUserId: midwife, agency: 'health', role: 'Community midwife', detailLevel: 'full', reason: 'Unborn baby; referrer', sharingRecordId: 'shr_reid_2' },
      { id: 'dist_reid_ird_3', recipientName: name(housing), recipientUserId: housing, agency: 'housing', role: 'Housing officer', detailLevel: 'fields', fields: ['address', 'household composition', 'interim safety plan actions relevant to housing'], reason: 'Housing relevant: tenancy options', sharingRecordId: 'shr_reid_3' },
      { id: 'dist_reid_ird_4', recipientName: name(reporter), recipientUserId: reporter, agency: 'scra', role: "Children's Reporter", detailLevel: 'summary', reason: 'Referral decision recorded', sharingRecordId: 'shr_reid_4' },
    ],
    reviewDate: '2026-09-04',
    subjectAttendance: 'The subject is an unborn baby. Chloe (mother) did not attend the IRD; she was told of it beforehand and her views were taken by the social worker the same day.',
  });

  makeMeeting(ctx, {
    id: CHLOE.cppm,
    type: 'pre-birth-cppm',
    processId: cp.id,
    subjectIds: [unborn.id],
    title: 'Pre-birth CPPM: unborn baby Reid',
    scheduledAt: at('2026-09-04', '10:00'),
    endsAt: at('2026-09-04', '12:00'),
    location: 'Ardvale Civic Centre, room 2.4',
    status: 'scheduled',
    chairUserId: chair,
    chairName: name(chair),
    minuteTakerUserId: minutes,
    minuteTakerName: name(minutes),
    invitees: [
      { userId: sw, name: name(sw), agency: 'social-work', role: 'Allocated social worker', required: true, attendance: 'accepted', reason: 'Lead professional', needToKnowRowId: 'cp.cppm.chair' },
      { userId: tl, name: name(tl), agency: 'social-work', role: 'Team leader', required: true, attendance: 'accepted', reason: 'IRD decision maker' },
      { userId: ds, name: `DS ${name(ds)}`, agency: 'police', role: 'Detective sergeant, PPU', required: true, attendance: 'accepted', reason: 'Police decision maker' },
      { userId: cpn, name: name(cpn), agency: 'health', role: 'Child protection nurse adviser', required: true, attendance: 'accepted', reason: 'Health decision maker' },
      { userId: midwife, name: name(midwife), agency: 'health', role: 'Community midwife', required: true, attendance: 'accepted', reason: 'Unborn baby; referrer', needToKnowRowId: 'cp.ird.midwife' },
      { userId: hv, name: name(hv), agency: 'health', role: 'Health visitor', required: true, attendance: 'accepted', reason: 'Named person after birth' },
      { userId: housing, name: name(housing), agency: 'housing', role: 'Housing officer', required: false, attendance: 'invited', reason: 'Tenancy options' },
      { userId: gp, name: `Dr ${name(gp)}`, agency: 'health', role: 'GP', required: false, attendance: 'invited', reason: 'Report requested', needToKnowRowId: 'cp.cppm.gp' },
      { userId: idaa, name: name(idaa), agency: 'third-sector', role: 'IDAA', required: false, attendance: 'accepted', reason: 'Supports Chloe at the meeting; MARAC content is not minuted here' },
      { name: 'Chloe Reid', agency: 'social-work', role: 'Mother', required: true, attendance: 'accepted', reason: 'Parent; attends with her IDAA' },
    ],
    agenda: [
      { id: 'ag_reid_cppm_1', order: 1, title: 'Introductions, purpose and confidentiality', status: 'pending' },
      { id: 'ag_reid_cppm_2', order: 2, title: "Chloe's views as the mother", status: 'pending' },
      { id: 'ag_reid_cppm_3', order: 3, title: 'Reports and the integrated chronology, including Chloe\'s own history', status: 'pending' },
      { id: 'ag_reid_cppm_4', order: 4, title: 'Analysis of risk and protective factors after birth', status: 'pending' },
      { id: 'ag_reid_cppm_5', order: 5, title: 'Registration decision (pre-birth) and the plan for birth and discharge', status: 'pending' },
      { id: 'ag_reid_cppm_6', order: 6, title: 'Core group, review after birth and the Reporter', status: 'pending' },
    ],
    preMeetingRequests: [
      { id: 'pmr_reid_cppm_1', agency: 'health', toName: name(midwife), toUserId: midwife, sentAt: at('2026-08-21', '09:00'), dueAt: '2026-09-02', status: 'returned', returnSummary: 'Midwifery report: booking, scans, disclosures, DASH, plan for labour', returnedAt: at('2026-08-31', '17:10') },
      { id: 'pmr_reid_cppm_2', agency: 'police', toName: `DS ${name(ds)}`, toUserId: ds, sentAt: at('2026-08-21', '09:00'), dueAt: '2026-09-02', status: 'returned', returnSummary: "Police report: Jordan Blake's history, 9 Aug concern report, DSDAS disclosure", returnedAt: at('2026-09-01', '11:20') },
      { id: 'pmr_reid_cppm_3', agency: 'health', toName: name(hv), toUserId: hv, sentAt: at('2026-08-21', '09:00'), dueAt: '2026-09-02', status: 'sent' },
      { id: 'pmr_reid_cppm_4', agency: 'health', toName: `Dr ${name(gp)}`, toUserId: gp, sentAt: at('2026-08-21', '09:00'), dueAt: '2026-09-02', status: 'sent' },
    ],
    pack: [
      { id: 'pk_reid_cppm_1', kind: 'chronology', label: "Integrated chronology: Chloe's history 2019 to date and the pregnancy", windowFrom: '2019-02-15', windowTo: '2026-09-03', included: true },
      { id: 'pk_reid_cppm_2', kind: 'report', label: 'Midwifery report', ref: 'pmr_reid_cppm_1', included: true },
      { id: 'pk_reid_cppm_3', kind: 'report', label: 'Police report', ref: 'pmr_reid_cppm_2', included: true },
      { id: 'pk_reid_cppm_4', kind: 'report', label: 'Health visitor report', ref: 'pmr_reid_cppm_3', included: false },
      { id: 'pk_reid_cppm_5', kind: 'report', label: 'GP report', ref: 'pmr_reid_cppm_4', included: false },
      { id: 'pk_reid_cppm_6', kind: 'report', label: 'Social work pre-birth assessment', included: false },
      { id: 'pk_reid_cppm_7', kind: 'views', label: "Chloe's views (20 Aug)", ref: 'vw_reid_mother', included: true },
      { id: 'pk_reid_cppm_8', kind: 'risk-assessment', label: 'DASH 25 Aug 2026 (15 of 24, high)', ref: dash.id, included: true },
      { id: 'pk_reid_cppm_9', kind: 'plan', label: 'Interim safety plan', ref: CHLOE.interimPlan, included: true },
    ],
    actionIds: ['act_reid_1', 'act_reid_2', 'act_reid_3', 'act_reid_4', 'act_reid_5'],
    viewsRecordIds: ['vw_reid_mother'],
    minute: { status: 'not-started' },
    subjectAttendance: "Chloe will attend with her IDAA. Jordan Blake will be seen separately by the chair before the meeting and will receive only the parts of the plan that concern him as the baby's father, not the police information or anything about the MARAC.",
  });

  // ----- Sharing records -----
  const cpShare = (id: string, to: string, agency: Agency, role: string, level: 'full' | 'summary' | 'fields', reason: string, summary: string, rowId: string, fields?: string[]) =>
    makeShare(ctx, { id, processId: cp.id, subjectId: unborn.id, stage: 'ird', recipient: { userId: to, name: name(to), agency, role }, detailLevel: level, fields, lawfulBasisId: lbCp.id, channel: agency === 'scra' ? 'secure-email-digest' : 'in-app', status: 'read', createdAt: at('2026-08-20', '16:00'), sentAt: at('2026-08-20', '16:00'), readAt: at('2026-08-21', '08:50'), reason, needToKnowRowId: rowId, createdByUserId: tl, createdByName: name(tl), summary });
  cpShare('shr_reid_1', sw, 'social-work', 'Allocated social worker', 'full', 'IRD held. Lead professional.', 'Pre-birth IRD record, decisions, interim safety plan, CPPM date 4 Sep', 'cp.ird.lead');
  cpShare('shr_reid_2', midwife, 'health', 'Community midwife', 'full', 'IRD convened. If the subject is an unborn baby.', 'Pre-birth IRD record and interim safety plan; midwifery actions', 'cp.ird.midwife');
  cpShare('shr_reid_3', housing, 'housing', 'Housing officer', 'fields', 'IRD held. If housing is relevant.', "Household at 31 Meadow Loan: Chloe Reid (tenant) and Jordan Blake. Interim plan asks housing to confirm sole tenancy and set out options if Jordan Blake is asked to leave.", 'cp.ird.housing', ['address', 'household composition', 'interim safety plan actions relevant to housing']);
  cpShare('shr_reid_4', reporter, 'scra', "Children's Reporter", 'summary', 'Reporter referral decision recorded.', 'Pre-birth IRD held 20 Aug for the unborn baby of Chloe Reid; referral considered and not made because the child is unborn; to be reconsidered at birth', 'cp.ird.scra');
  makeShare(ctx, { id: 'shr_reid_5', processId: marac.id, subjectId: chloe.id, stage: 'referral', recipient: { userId: idaa, name: name(idaa), agency: 'third-sector', role: 'IDAA' }, detailLevel: 'full', lawfulBasisId: lbMarac.id, channel: 'in-app', status: 'read', createdAt: at('2026-08-26', '11:30'), sentAt: at('2026-08-26', '11:30'), readAt: at('2026-08-26', '12:05'), reason: 'Referral received. IDAA allocated to support the victim before, during and after the meeting.', needToKnowRowId: 'marac.referral.idaa', createdByUserId: coord, createdByName: name(coord), summary: 'Referral from midwifery, DASH 15 of 24. Chloe is 26 weeks pregnant; pre-birth CP process CP-2026-0447 open. Perpetrator Jordan Blake. Chloe asks that he is not told she has spoken to anyone.' });

  // ----- Chronology events -----
  type EventInput = Parameters<typeof makeEvent>[1];
  const C = (e: Omit<EventInput, 'subjectIds'> & { subjectIds?: string[] }) =>
    makeEvent(ctx, { subjectIds: [chloe.id], linkedProcessIds: [cp.id], visibility: 'integrated', lawfulBasisId: lbCp.id, ...e });
  const J = (e: Omit<EventInput, 'subjectIds'> & { subjectIds?: string[] }) =>
    makeEvent(ctx, { subjectIds: [jordan.id], linkedProcessIds: [marac.id], visibility: 'integrated', lawfulBasisId: lbMarac.id, ...e });

  // Chloe's own childhood: the closed process.
  C({ occurredAt: at('2007-01-25', '10:40'), agency: 'health', sourceSystem: 'trakcare', recordedByName: 'TrakCare connector', eventType: 'family.birth', title: 'Born at Clydeshore Royal Infirmary', detail: 'Born at 38 weeks, 2.9 kg, to Donna Reid (22). Discharged home to Salt Vennel, Portnellan.', significance: 'low', linkedPersonIds: [donna.id], linkedProcessIds: [] });
  C({ occurredAt: at('2018-11-14', '00:00'), hasTime: false, agency: 'education', sourceSystem: 'seemis', recordedByName: 'SEEMIS connector', eventType: 'education.concern', title: 'P7 wellbeing concern: hungry, unwashed, late most days; mother not responding', detail: 'Pastoral note from the class teacher. Breakfast club place given. Letters and calls to the mother unanswered.', significance: 'moderate', linkedProcessIds: [cp2019.id] });
  C({ id: 'evt_chloe_ccr_2019', occurredAt: at('2019-02-15', '20:30'), agency: 'police', sourceSystem: 'ivpd', recordedByName: 'iVPD connector', eventType: 'police.concern-report', title: 'Child concern report: mother intoxicated, no food in the house, Chloe (12) alone', detail: 'Officers attended after a neighbour reported the mother shouting in the street. Donna Reid asleep on the floor, intoxicated. Chloe had made toast; no other food; no heating.', response: 'Shared with social work duty as high priority.', outcome: 'IRD 20 Feb 2019.', significance: 'high', significanceReason: 'Neglect with a child left to care for herself', linkedPersonIds: [donna.id], linkedProcessIds: [cp2019.id] });
  C({ occurredAt: at('2019-02-20', '10:00'), agency: 'social-work', recordedByName: name(tl), recordedByUserId: tl, eventType: 'process.ird', title: 'IRD held: investigation; Chloe to stay with her aunt meantime', detail: 'Social work, police, health and education. Comprehensive medical arranged. Referral to the Reporter agreed.', significance: 'high', linkedProcessIds: [cp2019.id] });
  C({ id: 'evt_chloe_kinship', occurredAt: at('2019-03-05', '00:00'), hasTime: false, agency: 'social-work', sourceSystem: 'eclipse', recordedByName: 'ECLIPSE connector', eventType: 'care.placement', title: 'Placed with her aunt Sheena Reid in Portnellan (kinship, section 25)', detail: 'Mother agreed. Chloe kept her place at Ardvale Primary.', significance: 'high', linkedPersonIds: [sheena.id], linkedProcessIds: [cp2019.id] });
  C({ occurredAt: at('2019-03-19', '10:00'), agency: 'social-work', recordedByName: 'CP chair (2019)', eventType: 'process.registration', title: 'Placed on the Child Protection Register: neglect, parental substance use', detail: 'Core group set up. Plan to secure the kinship placement through a children\'s hearing.', significance: 'high', linkedProcessIds: [cp2019.id] });
  C({ occurredAt: at('2019-06-18', '00:00'), hasTime: false, agency: 'scra', sourceSystem: 'scra', recordedByName: 'SCRA connector', eventType: 'legal.hearing', title: "Children's hearing: compulsory supervision order, to live with Sheena Reid", detail: 'Grounds accepted by the mother. Contact with the mother supervised, weekly.', significance: 'high', linkedProcessIds: [cp2019.id] });
  C({ occurredAt: at('2019-08-20', '00:00'), hasTime: false, agency: 'education', sourceSystem: 'seemis', recordedByName: 'SEEMIS connector', eventType: 'education.enrolment', title: 'Started S1 at Kilbrannan Academy', detail: 'Travelling from Portnellan. Guidance teacher aware of the supervision order.', significance: 'low', linkedProcessIds: [] });
  C({ occurredAt: at('2020-11-04', '11:00'), agency: 'social-work', recordedByName: 'CP chair (2020)', eventType: 'process.deregistration', title: 'Removed from the Child Protection Register; case closed to child protection', detail: 'Living with her aunt under a compulsory supervision order. Mother not engaging with the alcohol service. Transferred to the looked after children team.', significance: 'moderate', linkedProcessIds: [cp2019.id] });
  C({ id: 'evt_chloe_foster', occurredAt: at('2021-06-14', '00:00'), hasTime: false, agency: 'social-work', sourceSystem: 'eclipse', recordedByName: 'ECLIPSE connector', eventType: 'care.placement', title: "Kinship placement ended (aunt's ill health); foster placement with the Wallace family, Braeside", detail: 'Emergency move after Sheena Reid was admitted to hospital. Chloe (14) upset at leaving Portnellan. Hearing on 6 Jul varied the order.', significance: 'high', significanceReason: 'Second placement move', linkedPersonIds: [sheena.id], linkedProcessIds: [] });
  C({ occurredAt: at('2022-03-11', '00:00'), hasTime: false, agency: 'education', sourceSystem: 'seemis', recordedByName: 'SEEMIS connector', eventType: 'education.attendance', title: 'Attendance 71 percent in S3; anxiety; pupil support plan', detail: 'Refusing school on some mornings. Pupil support and a reduced timetable agreed with the foster carers.', significance: 'moderate', linkedProcessIds: [] });
  C({ id: 'evt_chloe_gp_2022', occurredAt: at('2022-09-02', '15:10'), agency: 'health', sourceSystem: 'emis-web', recordedByName: 'EMIS Web connector', eventType: 'health.consultation', title: 'GP: low mood and self-harm; referred to CAMHS', detail: 'Brought by her foster carer. Superficial cuts to the forearm. No suicidal intent. Referred to CAMHS; seen within six weeks.', significance: 'moderate', linkedProcessIds: [] });
  C({ occurredAt: at('2023-06-20', '00:00'), hasTime: false, agency: 'scra', sourceSystem: 'scra', recordedByName: 'SCRA connector', eventType: 'legal.hearing', title: "Compulsory supervision order terminated at Chloe's request (16); throughcare agreed", detail: 'Chloe declined continuing care with the foster carers. Throughcare and aftercare support agreed with the local authority.', significance: 'moderate', linkedProcessIds: [] });
  C({ occurredAt: at('2023-08-21', '00:00'), hasTime: false, agency: 'social-work', sourceSystem: 'eclipse', recordedByName: 'ECLIPSE connector', eventType: 'care.service-start', title: 'Moved to supported accommodation, Mill Gait; throughcare worker allocated', detail: 'Left school after S4 with four National 5s. College application supported.', significance: 'moderate', linkedProcessIds: [] });
  C({ occurredAt: at('2024-02-19', '00:00'), hasTime: false, agency: 'housing', recordedByName: name(housing), recordedByUserId: housing, eventType: 'move.address', title: 'Scottish Secure Tenancy at 31 Meadow Loan, Ardvale (care leaver priority)', detail: 'One-bedroom flat. Tenancy in her sole name. Furnished tenancy grant paid.', significance: 'low', linkedProcessIds: [] });
  C({ occurredAt: at('2024-10-08', '11:30'), agency: 'health', sourceSystem: 'emis-web', recordedByName: 'EMIS Web connector', eventType: 'health.consultation', title: 'GP: anxiety; sertraline started; adult mental health referral not attended', detail: 'Living alone; college course stopped. Sertraline started. Referred to the adult service after CAMHS discharge at 18; did not attend.', significance: 'moderate', linkedProcessIds: [] });
  C({ id: 'evt_chloe_throughcare_end', occurredAt: at('2025-04-14', '00:00'), hasTime: false, agency: 'social-work', sourceSystem: 'eclipse', recordedByName: 'ECLIPSE connector', eventType: 'care.service-end', title: "Throughcare support ended at Chloe's request; aftercare available to 26", detail: 'Chloe said she "did not need a worker any more". Contact details for aftercare left. No further contact until August 2026.', significance: 'moderate', significanceReason: 'Support network reduced to nobody', linkedProcessIds: [] });
  C({ id: 'evt_chloe_rel', occurredAt: at('2025-11-15', '00:00'), hasTime: false, approximate: true, agency: 'health', recordedByName: name(midwife), recordedByUserId: midwife, eventType: 'household.change', title: 'Relationship with Jordan Blake began', detail: 'Date approximate, from Chloe\'s account at the 18 Aug 2026 appointment.', significance: 'moderate', linkedPersonIds: [jordan.id] });
  C({ id: 'evt_chloe_movein', occurredAt: at('2026-05-10', '00:00'), hasTime: false, approximate: true, agency: 'health', recordedByName: name(midwife), recordedByUserId: midwife, eventType: 'household.change', title: 'Jordan Blake moved into 31 Meadow Loan', detail: 'Gave up his Kilbrannan tenancy. Not on Chloe\'s tenancy. Date approximate.', significance: 'moderate', subjectIds: [chloe.id, jordan.id] });
  C({ occurredAt: at('2026-06-08', '10:00'), agency: 'health', sourceSystem: 'trakcare', recordedByName: 'TrakCare connector', eventType: 'health.attendance', title: 'Maternity booking at 15 weeks (late booking); routine domestic abuse enquiry answered no', detail: 'Booked with the community midwife. Partner present for most of the appointment. Bloods and dating scan arranged. Smoking: no. Alcohol: no.', significance: 'moderate', significanceReason: 'Late booking; partner present at the routine enquiry', subjectIds: [chloe.id, unborn.id] });
  C({ occurredAt: at('2026-06-12', '09:30'), agency: 'health', sourceSystem: 'trakcare', recordedByName: 'TrakCare connector', eventType: 'health.assessment', title: 'Dating scan: single pregnancy, EDD 27 Nov 2026', detail: 'Measurements consistent with 16 weeks. No concerns.', significance: 'low', subjectIds: [chloe.id, unborn.id] });
  C({ occurredAt: at('2026-07-13', '11:15'), agency: 'health', sourceSystem: 'trakcare', recordedByName: 'TrakCare connector', eventType: 'health.assessment', title: 'Anomaly scan: no concerns', detail: 'Normal anatomy. Placenta anterior, clear of the os.', significance: 'low', subjectIds: [chloe.id, unborn.id] });
  C({ id: 'evt_chloe_ccr_2026', occurredAt: at('2026-08-09', '22:30'), agency: 'police', sourceSystem: 'ivpd', recordedByName: 'iVPD connector', eventType: 'police.concern-report', title: 'Domestic incident at 31 Meadow Loan: shouting; Jordan Blake intoxicated; Chloe pregnant, said she was fine', detail: 'Neighbours reported shouting and a door slamming. Jordan Blake intoxicated and hostile; Chloe (25 weeks pregnant) tearful, said "we just argued". No injury seen. Jordan left for the night.', response: 'Adult concern report to the hub, marked pregnant. Shared with midwifery through the concern hub on 12 Aug.', outcome: 'Midwife raised it with Chloe on 18 Aug.', significance: 'high', significanceReason: 'Pregnant victim; partner with a domestic abuse conviction', subjectIds: [chloe.id, jordan.id], linkedProcessIds: [marac.id, cp.id] });
  C({ id: 'evt_chloe_disclosure', occurredAt: at('2026-08-18', '14:30'), agency: 'health', recordedByName: name(midwife), recordedByUserId: midwife, eventType: 'disclosure', title: 'Antenatal appointment: Chloe disclosed that Jordan Blake grabbed her wrist and controls her money and phone', detail: 'Seen alone after Jordan was asked to wait outside. Faded bruising to the left wrist from 9 Aug. Said he checks her phone, keeps her bank card and "gets angry when he has had a drink". Frightened of him. Wants the baby.', response: 'Pre-birth child protection concern raised with social work at 16:00. Chloe told this would happen and why.', significance: 'high', significanceReason: 'Disclosure of physical and controlling abuse in pregnancy', subjectIds: [chloe.id, unborn.id], linkedPersonIds: [jordan.id] });
  C({ occurredAt: at('2026-08-18', '16:00'), agency: 'health', recordedByName: name(midwife), recordedByUserId: midwife, eventType: 'process.referral', title: 'Pre-birth child protection concern raised with social work', detail: 'Disclosure of 18 Aug and the police concern report of 9 Aug. Gestation 25 weeks. EDD 27 Nov 2026.', significance: 'high', subjectIds: [unborn.id, chloe.id] });
  C({ occurredAt: at('2026-08-20', '10:00'), agency: 'social-work', recordedByName: name(tl), recordedByUserId: tl, eventType: 'process.ird', title: 'Pre-birth IRD held: likely significant harm; assessment; CPPM by 28 weeks (4 Sep)', detail: 'Social work, police, child protection nurse adviser, midwifery and health visiting. JII and medical not applicable. No order. Reporter referral considered and not made. Jordan Blake to be told of the concern but not of the police information.', significance: 'high', significanceReason: 'Child protection procedures initiated before birth', subjectIds: [unborn.id, chloe.id], linkedPersonIds: [jordan.id] });
  C({ occurredAt: at('2026-08-20', '12:00'), agency: 'social-work', recordedByName: name(sw), recordedByUserId: sw, eventType: 'voice.family', title: "Chloe's views as the mother recorded", detail: '"I want this baby to have what I did not have." Wants to keep her flat and her baby. Not ready to end the relationship.', significance: 'moderate' });
  C({ occurredAt: at('2026-08-25', '14:30'), agency: 'health', recordedByName: name(midwife), recordedByUserId: midwife, eventType: 'health.assessment', title: 'DASH completed with the midwife: 15 of 24, high risk', detail: 'Seen alone at the 26 week appointment. Agreed to a MARAC referral. Bruising resolved. Fetal growth on the 50th centile.', significance: 'high', linkedProcessIds: [marac.id] });
  C({ occurredAt: at('2026-08-26', '11:00'), agency: 'social-work', recordedByName: name(coord), recordedByUserId: coord, eventType: 'process.referral', title: 'MARAC referral received from midwifery', detail: 'DASH 15 of 24. Not a repeat. IDAA allocated. To be listed for 23 Sep; research requests to follow. Linked to CP-2026-0447.', significance: 'high', linkedProcessIds: [marac.id], lawfulBasisId: lbMarac.id });
  C({ occurredAt: at('2026-08-28', '15:00'), agency: 'third-sector', recordedByName: name(idaa), recordedByUserId: idaa, eventType: 'voice.victim', title: "Chloe's wishes recorded by the IDAA", detail: 'Wants to stay in her tenancy and keep the baby. Not ready to leave Jordan; does not want him charged. Wants a plan for labour and the hospital stay.', significance: 'moderate', linkedProcessIds: [marac.id], lawfulBasisId: lbMarac.id });
  C({ occurredAt: at('2026-08-31', '15:30'), agency: 'police', recordedByName: `DC ${name(dc)}`, recordedByUserId: dc, eventType: 'police.notification', title: 'DSDAS: Power to Tell disclosure made to Chloe about Jordan Blake', detail: 'Outline of the March 2025 conviction and the non-harassment order given to Chloe in person with her IDAA present. She had not known about the order.', significance: 'high', linkedProcessIds: [marac.id], visibility: 'agency-only', lawfulBasisId: undefined, linkedPersonIds: [jordan.id] });

  // Jordan Blake.
  J({ occurredAt: at('2023-06-15', '00:00'), hasTime: false, agency: 'housing', recordedByName: name(housing), recordedByUserId: housing, eventType: 'move.address', title: 'Council tenancy at 18 Abbey Wynd, Kilbrannan started', detail: 'One-bedroom flat. Tenancy ended May 2026.', significance: 'low', linkedProcessIds: [] });
  J({ occurredAt: at('2024-02-11', '23:20'), agency: 'police', sourceSystem: 'ivpd', recordedByName: 'iVPD connector', eventType: 'police.concern-report', title: 'Domestic incident with a previous partner: shouting, her phone broken; no crime recorded', detail: 'Called by the previous partner. Jordan Blake had thrown her phone against a wall. He left for the night.', response: 'Domestic incident recorded; DAQ 7 yes.', significance: 'moderate' });
  J({ occurredAt: at('2024-11-30', '23:05'), agency: 'police', sourceSystem: 'ivpd', recordedByName: 'iVPD connector', eventType: 'police.incident', title: 'Assault on a previous partner (domestic aggravation); arrested and charged', detail: 'Slapped and pushed his partner during an argument after drinking. Bruising to her face. Arrested at the address.', response: 'Charged with assault, domestic abuse aggravation. Bail with conditions.', outcome: 'Convicted 12 Mar 2025.', significance: 'high' });
  J({ occurredAt: at('2025-03-12', '00:00'), hasTime: false, agency: 'police', recordedByName: 'Police Scotland (criminal history)', eventType: 'police.conviction', title: 'Convicted at Ardvale Sheriff Court: assault, domestic aggravation; fine and 18 month non-harassment order', detail: 'Non-harassment order in favour of the previous partner until 11 Sep 2026.', significance: 'high', significanceReason: 'Domestic abuse conviction' });
  J({ occurredAt: at('2025-08-03', '19:45'), agency: 'police', sourceSystem: 'ivpd', recordedByName: 'iVPD connector', eventType: 'police.concern-report', title: 'Alleged breach of the non-harassment order reported by the previous partner; not proceeded', detail: 'Previous partner reported Jordan Blake outside her workplace. He said it was a coincidence. Insufficient evidence.', response: 'Warned about the order.', significance: 'high', significanceReason: 'Pattern of contact after separation' });
  J({ occurredAt: at('2026-08-21', '14:00'), agency: 'social-work', recordedByName: name(sw), recordedByUserId: sw, eventType: 'social-work.contact', title: 'Jordan Blake told of the pre-birth concern at the office; police information not shared', detail: 'Seen with Chloe\'s agreement. Told that a pre-birth assessment is under way and that a meeting will be held on 4 Sep. Angry, then quiet. Asked what Chloe had said; not told. Offered a parenting capacity appointment.', significance: 'moderate', linkedProcessIds: [cp.id], lawfulBasisId: lbCp.id });
  J({ occurredAt: at('2026-08-29', '10:00'), agency: 'social-work', recordedByName: name(sw), recordedByUserId: sw, eventType: 'social-work.contact', title: 'Jordan Blake declined the parenting capacity assessment appointment', detail: 'Texted at 09:40 to say he was "not doing that". Second appointment offered for 3 Sep.', significance: 'moderate', linkedProcessIds: [cp.id], lawfulBasisId: lbCp.id });

  // ----- Analysis note: separate from facts -----
  makeAnalysis(ctx, {
    id: 'ana_reid_1',
    subjectId: chloe.id,
    processId: cp.id,
    eventIds: ['evt_chloe_ccr_2019', 'evt_chloe_kinship', 'evt_chloe_foster', 'evt_chloe_gp_2022', 'evt_chloe_throughcare_end', 'evt_chloe_rel', 'evt_chloe_movein', 'evt_chloe_ccr_2026', 'evt_chloe_disclosure'],
    authorUserId: sw,
    authorName: name(sw),
    agency: 'social-work',
    recordedAt: at('2026-08-28', '17:00'),
    kind: 'risk',
    title: "Chloe's own history and the current risk to her baby",
    text: 'Chloe was neglected by a mother who drank, moved placement twice, and left care at 16 wanting to stand on her own feet. She ended throughcare at 18 and by 2025 had nobody: no contact with her mother, her aunt by phone, no worker, no college. Jordan Blake arrived into that gap and moved in within six months. The pattern that matters for the baby is not Chloe\'s history in itself but the isolation it left, which makes it harder for her to say no to him and easier for him to control money, phone and who she sees. Her wish for this baby to have "what I did not have" is the strongest protective factor in the record. For the CPPM: the plan should build on that wish (aftercare re-engaged, a named person she chooses, a labour plan), name the risk from Jordan Blake plainly, and avoid treating her care history as evidence against her.',
  });

  // ----- Connector inbox: event awaiting review -----
  makeConnectorEvent(ctx, { id: 'cev_reid_1', connectorId: 'trakcare', agency: 'health', subjectId: chloe.id, receivedAt: at('2026-09-01', '16:20'), externalRef: 'TRAK-MAT-2026-09-4471', sourcePayload: { patient: 'REID, Chloe', unit: 'Maternity Day Assessment Unit, Clydeshore Royal Infirmary', reason: 'Reduced fetal movements', gestation: '27+4', ctg: 'Normal', discharged: '15:40', accompanied: 'Partner present; asked to wait outside for part of the assessment' }, mapped: { eventType: 'health.attendance', title: 'Maternity day assessment: reduced fetal movements at 27 weeks; CTG normal', detail: 'Self-referred with reduced movements. CTG normal, discharged at 15:40 with advice. Partner present; Chloe seen alone for part of the assessment and reported no new incidents.', occurredAt: at('2026-09-01', '13:50'), hasTime: true, significance: 'moderate', mappingRule: 'trakcare.maternity.encounter' } });
}
