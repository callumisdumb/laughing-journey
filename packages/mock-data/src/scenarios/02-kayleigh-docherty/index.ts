/**
 * Scenario 2: Kayleigh Docherty, 31, Ardvale, and her children Lily (7) and Mason (3).
 * A repeat MARAC referral from police after a DAQ with 17 yes answers, running alongside a child
 * protection process opened at an IRD because Lily saw the latest incident. The perpetrator,
 * Ryan Kerr, is on bail and under justice social work supervision for a previous domestic abuse
 * conviction. He is never a recipient of anything: the MARAC exclusion rule (marac.all.perpetrator)
 * explains why in the drawer, and the CP IRD recorded what is withheld from him and why.
 */
import { type Agency, officialSensitive, partiesFromRoles, type Process, type RiskAssessment } from '@mas/domain';
import type { BuildContext } from '../../generator/context';
import { at, makeAction, makeAddress, makeAnalysis, makeConnectorEvent, makeEvent, makeHousehold, makeLawfulBasis, makeMeeting, makePerson, makePlan, makeRisk, makeShare, makeViews, relate, syntheticChi } from '../../generator/factory';
import { USR, userName } from '../../generator/organisations';

export const KAYLEIGH = {
  kayleigh: 'per_kayleigh_docherty',
  lily: 'per_lily_docherty',
  mason: 'per_mason_docherty',
  ryan: 'per_ryan_kerr',
  craig: 'per_craig_kerr',
  marac: 'prc_marac_docherty',
  cp: 'prc_cp_docherty',
  maracMeeting: 'mtg_docherty_marac',
  ird: 'mtg_docherty_ird',
  cppm: 'mtg_docherty_cppm',
  interimPlan: 'pln_docherty_interim',
  daq: 'ra_docherty_daq',
} as const;

/**
 * Police Scotland DAQ: the 24 DASH-based questions plus three about children (q25 to q27).
 * Plain-language paraphrases written for this mockup, not the published wording.
 */
const DAQ_QUESTIONS: ReadonlyArray<readonly [string, string]> = [
  ['q1', 'Did this incident leave you with any injury?'],
  ['q2', 'Are you very frightened of him at the moment?'],
  ['q3', 'Do you fear he will hurt you or someone close to you again?'],
  ['q4', 'Do you feel cut off from family, friends or anyone who could help you?'],
  ['q5', 'Have you been feeling low, or had thoughts of ending your life?'],
  ['q6', 'Have you ended, or tried to end, the relationship in the past year?'],
  ['q7', 'Is there disagreement or conflict about the children or contact with them?'],
  ['q8', 'Does he keep contacting you, turning up, following you or checking where you are?'],
  ['q9', 'Are you pregnant, or have you had a baby in the last 18 months?'],
  ['q10', 'Is the abuse happening more often than it used to?'],
  ['q11', 'Is the abuse getting more serious?'],
  ['q12', 'Does he try to control what you do, who you see or where you go, or act very jealously?'],
  ['q13', 'Has he ever used a weapon or an object to hurt you, or threatened to?'],
  ['q14', 'Has he ever said he would kill you, the children or anyone else?'],
  ['q15', 'Has he ever put his hands round your throat, or tried to choke, smother or drown you?'],
  ['q16', 'Has he ever forced or pressured you into anything sexual, or said sexual things that upset you?'],
  ['q17', 'Is there anyone else who has threatened you or who you are afraid of?'],
  ['q18', 'As far as you know, has he ever hurt anyone else?'],
  ['q19', 'Has he ever hurt or threatened an animal or a family pet?'],
  ['q20', 'Are there money worries, or does he control the money?'],
  ['q21', 'In the past year has he had problems with alcohol, drugs or his mental health?'],
  ['q22', 'Has he ever threatened or tried to take his own life?'],
  ['q23', 'Has he ever broken bail conditions, a court order or an undertaking?'],
  ['q24', 'As far as you know, has he been in trouble with the police before?'],
  ['q25', 'Were any children in the house or nearby, or did they see or hear what happened?'],
  ['q26', 'Has he ever hurt, threatened or frightened the children?'],
  ['q27', 'Does he have contact with the children, or a way of getting to them?'],
];
const DAQ_YES = new Set(['q1', 'q2', 'q3', 'q5', 'q6', 'q7', 'q8', 'q10', 'q11', 'q12', 'q14', 'q15', 'q20', 'q21', 'q24', 'q25', 'q27']);

interface ResearchSeed {
  id: string;
  agency: Agency;
  to: string;
  rowId: string;
  status: 'sent' | 'returned' | 'nothing-known';
  returnedAt?: string;
  returnSummary?: string;
}

export function seedKayleighDocherty(ctx: BuildContext): void {
  const name = (id: string) => userName(ctx, id);

  // ----- Personas on the case -----
  const sw = USR.janetKerr;
  const tl = USR.anneHendry;
  const ds = USR.paulMackay;
  const dc = USR.ewanSutherland;
  const cpn = USR.fionaRoss;
  const head = USR.claireCowan;
  const hv = USR.sunitaRao;
  const gp = USR.amiraFarouk;
  const idaa = USR.sadiaQureshi;
  const wa = USR.erinLamont;
  const coord = USR.karenFindlay;
  const jsw = USR.helenRae;
  const housing = USR.markHepburn;
  const chair = USR.davidLaird;
  const minutes = USR.lesleyMorton;
  const reporter = USR.islaCrawford;
  const pf = USR.fionaLyle;
  const hub = USR.gavinBrodie;

  // ----- Addresses and people -----
  const home = makeAddress(ctx, { id: 'adr_docherty_home', line1: '8 Harbour Brae', town: 'Ardvale', postcode: 'QX1 2PW' });
  const gran = makeAddress(ctx, { id: 'adr_docherty_gran', line1: '14 Shore Loan', line2: 'Flat 1/2', town: 'Portlennan', postcode: 'QX3 6HN' });
  const ryanHome = makeAddress(ctx, { id: 'adr_ryan_kerr', line1: '15 Cannon Loan', town: 'Auchentorran', postcode: 'QX2 4RE' });
  const craigHome = makeAddress(ctx, { id: 'adr_craig_kerr', line1: '3 Weavers Court', town: 'Auchentorran', postcode: 'QX2 5LT' });

  const hh = 'hh_docherty';

  const kayleigh = makePerson(ctx, {
    id: KAYLEIGH.kayleigh,
    givenName: 'Kayleigh',
    familyName: 'Docherty',
    sex: 'female',
    dateOfBirth: '1995-04-12',
    chi: syntheticChi(ctx, '1995-04-12', 'female'),
    addressHistory: [
      { addressId: gran.id, from: '2018-05-01', to: '2021-03-08', note: 'Living with her mother, Margaret Docherty' },
      { addressId: home.id, from: '2021-03-08', note: 'Scottish Secure Tenancy in her sole name. Away in a refuge outwith Clydeshore 15 Mar to 28 Apr 2025.' },
    ],
    householdId: hh,
    gpPractice: 'Portlennan Medical Practice',
    contact: { phone: '07700 900231' },
    alerts: [{ id: 'alt_kayleigh_marac', kind: 'marac-flag', text: 'MARAC flag', from: '2026-01-09', to: '2027-01-08' }],
    createdAt: at('2019-06-03', '10:00'),
  });
  const lily = makePerson(ctx, {
    id: KAYLEIGH.lily,
    givenName: 'Lily',
    familyName: 'Docherty',
    sex: 'female',
    lifeStage: 'child',
    dateOfBirth: '2019-06-02',
    chi: syntheticChi(ctx, '2019-06-02', 'female'),
    addressHistory: [
      { addressId: gran.id, from: '2019-06-02', to: '2021-03-08' },
      { addressId: home.id, from: '2021-03-08' },
    ],
    householdId: hh,
    gpPractice: 'Portlennan Medical Practice',
    school: 'Ardvale Primary',
    createdAt: at('2019-06-03', '10:00'),
  });
  const mason = makePerson(ctx, {
    id: KAYLEIGH.mason,
    givenName: 'Mason',
    familyName: 'Docherty',
    sex: 'male',
    lifeStage: 'child',
    dateOfBirth: '2023-01-20',
    chi: syntheticChi(ctx, '2023-01-20', 'male'),
    addressHistory: [{ addressId: home.id, from: '2023-01-20' }],
    householdId: hh,
    gpPractice: 'Portlennan Medical Practice',
    createdAt: at('2023-01-21', '10:00'),
  });
  const ryan = makePerson(ctx, {
    id: KAYLEIGH.ryan,
    givenName: 'Ryan',
    familyName: 'Kerr',
    sex: 'male',
    dateOfBirth: '1992-08-15',
    chi: syntheticChi(ctx, '1992-08-15', 'male'),
    addressHistory: [
      { addressId: home.id, from: '2022-02-01', to: '2025-03-14', note: 'Lived with Kayleigh Docherty; left on arrest 14 Mar 2025. Start date approximate.' },
      { addressId: ryanHome.id, from: '2025-06-02', note: 'Council tenancy in his own name' },
    ],
    gpPractice: 'Craiglarrick Health Centre',
    contact: { phone: '07700 900418' },
    alerts: [
      { id: 'alt_ryan_staff', kind: 'staff-safety', text: 'Known risk to staff: lone visits not advised', from: '2025-03-15' },
      { id: 'alt_ryan_bail', kind: 'other', text: 'Bail conditions (24 Aug 2026): not to approach Kayleigh Docherty, Lily or Mason Docherty, or 8 Harbour Brae, Ardvale', from: '2026-08-24' },
    ],
    createdAt: at('2024-03-17', '09:00'),
  });

  // Ryan's brother. He has no involvement with services; he is on the record because Ryan stayed with him after
  // the March 2024 incident, and the relationship makes him a perpetrator's associate for MARAC need-to-know.
  const craig = makePerson(ctx, {
    id: KAYLEIGH.craig,
    givenName: 'Craig',
    familyName: 'Kerr',
    sex: 'male',
    dateOfBirth: '1989-11-03',
    chi: syntheticChi(ctx, '1989-11-03', 'male'),
    addressHistory: [{ addressId: craigHome.id, from: '2016-04-11', note: 'Private let' }],
    createdAt: at('2024-03-17', '09:10'),
  });

  makeHousehold(ctx, { id: hh, addressId: home.id, from: '2023-01-20', memberIds: [kayleigh.id, lily.id, mason.id], label: 'Docherty household, Ardvale' });
  relate(ctx, craig.id, ryan.id, 'sibling-of', { notes: 'Ryan stayed with him after the March 2024 incident' });
  relate(ctx, kayleigh.id, lily.id, 'mother-of', { notes: "Lily's father has had no contact since her birth" });
  relate(ctx, kayleigh.id, mason.id, 'mother-of');
  relate(ctx, ryan.id, mason.id, 'father-of', { notes: 'Named on the birth certificate. No contact under bail conditions since 24 Aug 2026.' });
  relate(ctx, ryan.id, kayleigh.id, 'ex-partner-of', { from: '2021-09-01', to: '2026-02-14', notes: 'Relationship from about September 2021; lived together February 2022 to March 2025; ended February 2026. Dates approximate.' });
  relate(ctx, ryan.id, lily.id, 'step-parent-of', { from: '2022-02-01', to: '2025-03-14', notes: 'Lived with Lily while in a relationship with her mother' });
  relate(ctx, lily.id, mason.id, 'sibling-of', { notes: 'Half-siblings; same mother' });

  // ----- Lawful bases -----
  const lbMarac = makeLawfulBasis(ctx, {
    id: 'lb_docherty_marac',
    purpose: 'MARAC referral, research and action planning for Kayleigh Docherty (repeat referral)',
    article6: '6(1)(e) public task',
    article9Condition: '9(2)(g) substantial public interest, DPA 2018 Sch 1 Pt 2 para 18 (safeguarding)',
    article10Criminal: 'DPA 2018 s10 and Sch 1',
    statutoryGateway: ['Clydeshore MARAC Operating Protocol 2025', 'Clydeshore MARAC information sharing agreement', 'DPA 2018 s10 and Sch 1 (offence data about Ryan Kerr)'],
    necessityAndProportionality: 'A high-risk repeat referral within 12 months. Research requests carry names and dates of birth only; each agency returns what is relevant, necessary and proportionate to the risk to Kayleigh, Lily and Mason. The perpetrator is not told about the MARAC.',
    consentStatus: 'sought-and-given',
    consentNote: 'Kayleigh agreed to the referral on 23 Aug 2026. She asked that Ryan Kerr is not told she has spoken to anyone.',
    authorisedByUserId: coord,
    authorisedByName: name(coord),
    informationSharingAgreementRef: 'Clydeshore MARAC ISA 2025/01',
    dpiaRef: 'DPIA-MARAC-2025-02',
    createdAt: at('2026-08-24', '15:30'),
  });
  const lbCp = makeLawfulBasis(ctx, {
    id: 'lb_docherty_cp',
    purpose: 'Child protection inquiry and planning for Lily and Mason Docherty',
    article6: '6(1)(e) public task',
    article9Condition: '9(2)(g) substantial public interest, DPA 2018 Sch 1 Pt 2 para 18 (safeguarding)',
    article10Criminal: 'DPA 2018 s10 and Sch 1',
    statutoryGateway: ['Children (Scotland) Act 1995', 'National Guidance for Child Protection in Scotland 2021', 'Children and Young People (Scotland) Act 2014'],
    necessityAndProportionality: 'Sharing across social work, police, health and education is necessary to assess and reduce the risk of significant harm to Lily and Mason from exposure to domestic abuse. Only events relevant to that risk are included in the integrated chronology.',
    consentStatus: 'not-required',
    consentNote: 'Kayleigh Docherty was informed at the IRD stage and agreed to the plan. Ryan Kerr was not asked: telling him would increase risk and could jeopardise the criminal investigation.',
    authorisedByUserId: tl,
    authorisedByName: name(tl),
    informationSharingAgreementRef: 'Clydeshore CPC ISA 2024/03',
    dpiaRef: 'DPIA-CP-2024-07',
    createdAt: at('2026-08-24', '11:30'),
  });

  // ----- DAQ (Police Scotland Domestic Abuse Questions), 17 yes of 27 -----
  const daqItems: NonNullable<RiskAssessment['items']> = DAQ_QUESTIONS.map(([id, question]) => ({ id, question, answer: DAQ_YES.has(id) ? 'yes' : 'no' }));
  const daq = makeRisk(ctx, {
    id: KAYLEIGH.daq,
    processId: KAYLEIGH.marac,
    subjectId: kayleigh.id,
    tool: 'daq',
    assessedAt: at('2026-08-23', '11:30'),
    assessorUserId: dc,
    assessorName: `DC ${name(dc)}`,
    assessorAgency: 'police',
    score: 17,
    maxScore: 27,
    band: 'high',
    bandLabel: 'High risk (14 or more)',
    items: daqItems,
    evidenceRefs: [{ kind: 'record', ref: 'IVPD-DI-2026-08-3151', label: 'Domestic incident report 22 Aug 2026' }],
  });

  // ----- MARAC research requests (sent 28 Aug, due 2 Sep) -----
  const research: ResearchSeed[] = [
    { id: 'rr_docherty_police', agency: 'police', to: dc, rowId: 'marac.research.police', status: 'returned', returnedAt: at('2026-08-31', '14:10'), returnSummary: 'Six domestic incidents since March 2024 involving Ryan Kerr, rising in seriousness. Conviction 18 Nov 2025 (Domestic Abuse (Scotland) Act 2018 s1). Charged 23 Aug 2026; bail 24 Aug with special conditions. No incidents recorded with other partners.' },
    { id: 'rr_docherty_gp', agency: 'health', to: gp, rowId: 'marac.research.gp', status: 'sent' },
    { id: 'rr_docherty_hv', agency: 'health', to: hv, rowId: 'marac.research.hv', status: 'returned', returnedAt: at('2026-09-01', '09:40'), returnSummary: 'Mason: speech delay, speech and language therapy since May 2025; one missed contact September 2024 after a police incident; mother engaged since. Lily seen at home on 27 Aug, quiet and watchful.' },
    { id: 'rr_docherty_housing', agency: 'housing', to: housing, rowId: 'marac.research.housing', status: 'sent' },
    { id: 'rr_docherty_education', agency: 'education', to: head, rowId: 'marac.research.education', status: 'sent' },
    { id: 'rr_docherty_jsw', agency: 'social-work', to: jsw, rowId: 'marac.research.jsw', status: 'returned', returnedAt: at('2026-09-01', '16:30'), returnSummary: 'Ryan Kerr on a community payback order since 25 Nov 2025 (18 months supervision, 150 hours unpaid work). Domestic abuse programme not yet started. Two missed unpaid work placements. Denies the December incident. Breach review started after the August charges.' },
    { id: 'rr_docherty_csw', agency: 'social-work', to: sw, rowId: 'marac.research.csw', status: 'returned', returnedAt: at('2026-08-29', '12:00'), returnSummary: 'Lily and Mason: IRD 24 Aug; child protection investigation open; interim safety plan in place; JII for Lily 1 Sep; CPPM 21 Sep. No previous children and families involvement. January MARAC summary received; support offered and declined then.' },
    { id: 'rr_docherty_wa', agency: 'third-sector', to: wa, rowId: 'marac.research.wa', status: 'nothing-known', returnedAt: at('2026-08-28', '15:20'), returnSummary: 'No open refuge or outreach case. The 2025 refuge stay was outwith Clydeshore, arranged through the national helpline. IDAA support is recorded separately by Sadia Qureshi.' },
  ];
  const researchSentAt = at('2026-08-28', '09:00');
  const researchDue = '2026-09-02';

  // ----- MARAC process -----
  const marac: Process = {
    id: KAYLEIGH.marac,
    synthetic: true,
    type: 'marac',
    reference: 'MARAC-2026-0093',
    title: 'MARAC: Kayleigh Docherty (repeat referral)',
    subjectIds: [kayleigh.id],
    leadAgency: 'social-work',
    leadUserId: coord,
    stage: 'research',
    stageHistory: [
      { stage: 'referral', at: at('2026-08-24', '15:00'), byUserId: coord, byName: name(coord), note: 'Police referral after DAQ 17 of 27. Repeat: previous hearing 8 Jan 2026.' },
      { stage: 'research', at: at('2026-08-28', '09:00'), byUserId: coord, byName: name(coord), note: 'Listed for 9 Sep. Research requests sent to eight agencies, due 2 Sep.' },
    ],
    status: 'open',
    classification: officialSensitive(),
    accessRestriction: 'none',
    openedAt: at('2026-08-24', '15:00'),
    members: [
      { userId: coord, caseRole: 'MARAC Coordinator', agency: 'social-work', since: '2026-08-24', reason: 'Receives the referral; runs research and the meeting' },
      { userId: idaa, caseRole: 'IDAA', agency: 'third-sector', since: '2026-08-24', reason: "Supports Kayleigh and represents her wishes; she does not attend" },
      { userId: dc, caseRole: 'referrer (police domestic abuse unit)', agency: 'police', since: '2026-08-24', reason: 'Completed the DAQ and referred; presents at the meeting' },
      { userId: ds, caseRole: 'chair', agency: 'police', since: '2026-08-24', reason: 'Chairs the Clydeshore MARAC' },
      { userId: sw, caseRole: "children's social work", agency: 'social-work', since: '2026-08-28', reason: 'Research request: two children in the household; allocated worker on the linked CP process' },
      { userId: jsw, caseRole: 'justice social work', agency: 'social-work', since: '2026-08-28', reason: 'Research request: supervises Ryan Kerr on a community payback order' },
      { userId: housing, caseRole: 'housing', agency: 'housing', since: '2026-08-28', reason: 'Research request: tenancy and target hardening at 8 Harbour Brae' },
      { userId: hv, caseRole: 'health visiting', agency: 'health', since: '2026-08-28', reason: 'Research request: named person for Mason' },
      { userId: gp, caseRole: 'health (GP link)', agency: 'health', since: '2026-08-28', reason: 'Research request: GP for Kayleigh and the children; MARAC flag holder' },
      { userId: head, caseRole: 'education', agency: 'education', since: '2026-08-28', reason: 'Research request: school-age child in the household' },
      { userId: wa, caseRole: "Women's Aid", agency: 'third-sector', since: '2026-08-28', reason: 'Research request: refuge and outreach records' },
    ],
    clocks: [
      { id: 'clk_docherty_research', ruleId: 'marac.research.return', triggeredAt: researchSentAt, note: 'Returns due 2 Sep for the meeting on 9 Sep' },
      { id: 'clk_docherty_flag', ruleId: 'marac.flag.expiry', triggeredAt: at('2026-01-08', '10:00'), note: 'Flags placed 9 Jan 2026 on health and housing records; to be reset after the September hearing' },
      { id: 'clk_docherty_repeat', ruleId: 'marac.repeat.window', triggeredAt: at('2026-01-08', '10:00'), completedAt: at('2026-08-24', '15:00'), note: 'Repeat referral received inside the 12 month window' },
    ],
    linkedProcessIds: [KAYLEIGH.cp],
    viewsRecordIds: ['vw_docherty_adult', 'vw_docherty_victim'],
    riskAssessmentIds: [daq.id],
    flags: { children: true, pregnant: false, perpetratorInCustody: false, perpetratorMappa: false, matacConsidered: true, criminalElement: true },
    // Case-role register. The perpetrator comes from the referral; his family and associates are derived from
    // relationship records below (partiesFromRoles), once the process exists. Neither can be lifted in the UI.
    parties: [
      {
        personId: ryan.id,
        party: 'perpetrator',
        label: 'Perpetrator (named in the referral)',
        since: '2026-08-24',
        source: 'referral',
        reason: 'Named as the perpetrator in the police MARAC referral of 24 Aug 2026; on bail with conditions not to approach Kayleigh or the children',
      },
    ],
    detail: {
      referral: {
        receivedAt: at('2026-08-24', '15:00'),
        referringAgency: 'police',
        referrerName: `DC ${name(dc)}, Domestic Abuse Investigation Unit`,
        riskAssessmentId: daq.id,
        professionalJudgementReferral: false,
        repeat: true,
        previousHearingAt: '2026-01-08',
        victimPersonId: kayleigh.id,
        perpetratorPersonId: ryan.id,
        childPersonIds: [lily.id, mason.id],
        summary: 'Saturday 22 Aug 2026, 23:10: Ryan Kerr attended 8 Harbour Brae uninvited, shouted threats through the door, then pushed Kayleigh into the hall when she opened it. Lily (7) was on the stairs and saw it. Officers attended; Ryan had left and was arrested at Cannon Loan at 00:40. DAQ 23 Aug: 17 yes of 27 (high). Charged 23 Aug; bail 24 Aug with conditions not to approach Kayleigh, the children or the address. Second referral within 12 months: heard 8 Jan 2026 after a similar incident in December.',
      },
      researchRequests: research.map((r) => ({ id: r.id, agency: r.agency, toUserId: r.to, sentAt: researchSentAt, dueAt: researchDue, status: r.status, returnSummary: r.returnSummary, returnedAt: r.returnedAt })),
      meetingId: KAYLEIGH.maracMeeting,
      actionPlanId: undefined,
      idaa: { userId: idaa, name: name(idaa), organisation: "Clydeshore Women's Aid" },
      idaaFeedback: [
        { at: at('2026-08-26', '11:00'), byName: name(idaa), summary: 'Kayleigh wants the children kept safe above everything. She does not want Ryan to know she has spoken to anyone. She wants the locks changed and a door chain. She would like a personal alarm.', victimResponse: 'Relieved that the school and nursery have been told who may collect the children. Anxious about the court date.' },
      ],
      flags: [
        { agency: 'health', system: 'EMIS Web, Portlennan Medical Practice', placedAt: '2026-01-09', expiresAt: '2027-01-08', receiptRef: 'EMIS-FLAG-2026-0112' },
        { agency: 'housing', system: 'Clydeshore Council housing management system', placedAt: '2026-01-09', expiresAt: '2027-01-08', receiptRef: 'HSG-FLAG-2026-0044' },
      ],
      links: {
        cpProcessId: KAYLEIGH.cp,
        mappaProcessId: undefined,
        matacConsidered: true,
        matacReferredAt: '2026-08-26',
        dsdasConsidered: true,
        dsdasNote: 'Not applicable to Kayleigh: she already knows Ryan Kerr\'s history. To be reconsidered if he forms a new relationship (Right to Know route via MATAC).',
      },
      safeLivesReturn: { referralSource: 'Police Scotland', repeat: true, childrenCount: 2, outcomeCodes: [] },
    },
  };
  marac.parties.push(...partiesFromRoles(marac, ctx.data.relationships).filter((p) => p.party === 'perpetrator-associates'));
  ctx.data.processes.push(marac);

  // ----- Child protection process -----
  const cp: Process = {
    id: KAYLEIGH.cp,
    synthetic: true,
    type: 'cp',
    reference: 'CP-2026-0431',
    title: 'Child protection: Lily and Mason Docherty',
    subjectIds: [lily.id, mason.id],
    leadAgency: 'social-work',
    leadUserId: sw,
    stage: 'investigation',
    stageHistory: [
      { stage: 'concern', at: at('2026-08-23', '01:30'), byUserId: hub, byName: name(hub), note: 'Police Child Concern Report via iVPD: Lily present at a domestic incident' },
      { stage: 'ird', at: at('2026-08-24', '11:00'), byUserId: tl, byName: name(tl), note: 'IRD held on the Monday morning' },
      { stage: 'investigation', at: at('2026-08-24', '13:00'), byUserId: sw, byName: name(sw), note: 'Joint investigation opened; JII for Lily planned' },
    ],
    status: 'open',
    classification: officialSensitive(),
    accessRestriction: 'none',
    openedAt: at('2026-08-23', '01:30'),
    members: [
      { userId: sw, caseRole: 'allocated social worker and lead professional', agency: 'social-work', since: '2026-08-24', reason: 'Allocated at IRD' },
      { userId: tl, caseRole: 'team leader (IRD decision maker)', agency: 'social-work', since: '2026-08-24', reason: 'Social work senior at IRD' },
      { userId: ds, caseRole: 'investigating officer', agency: 'police', since: '2026-08-24', reason: 'Police decision maker at IRD; criminal investigation; JII planner' },
      { userId: cpn, caseRole: 'child protection nurse adviser', agency: 'health', since: '2026-08-24', reason: 'Health decision maker at IRD' },
      { userId: head, caseRole: 'named person and school CP lead (Lily)', agency: 'education', since: '2026-08-24', reason: 'School-age child; informed JII planning' },
      { userId: hv, caseRole: 'named person (Mason)', agency: 'health', since: '2026-08-24', reason: 'Pre-school child in the household' },
      { userId: chair, caseRole: 'chair', agency: 'social-work', since: '2026-09-01', reason: 'Independent chair of the CPPM on 21 Sep' },
      { userId: minutes, caseRole: 'minute taker', agency: 'social-work', since: '2026-09-01', reason: 'Minutes and distribution' },
    ],
    clocks: [
      { id: 'clk_docherty_cppm', ruleId: 'cp.cppm.initial', triggeredAt: at('2026-08-24', '11:00'), note: 'CPPM scheduled 21 Sep, day 28' },
      { id: 'clk_docherty_notice', ruleId: 'cp.cppm.notice', triggeredAt: at('2026-09-21', '10:00'), note: 'Invitations and reports due 5 days before the CPPM' },
    ],
    linkedProcessIds: [KAYLEIGH.marac],
    viewsRecordIds: ['vw_docherty_adult', 'vw_docherty_lily'],
    riskAssessmentIds: [daq.id],
    flags: { schoolAge: true, preSchool: true, jii: true, housingRelevant: true, criminalElement: true },
    parties: [],
    detail: {
      concern: {
        receivedAt: at('2026-08-23', '01:30'),
        source: 'Police Child Concern Report via iVPD (attending officers, Ardvale)',
        sourceAgency: 'police',
        sourceReference: 'IVPD-CCR-2026-08-2307',
        summary: 'Officers attended 8 Harbour Brae at 23:30 on 22 Aug after Kayleigh Docherty reported that Ryan Kerr had pushed her at the door. Lily (7) was on the stairs, upset, and told officers "Ryan pushed Mum". Mason (3) asleep. Ryan Kerr had left; arrested at 00:40. Kayleigh had reddening to her upper arm; no injury to the children.',
      },
      proceduresInitiatedAt: at('2026-08-24', '11:00'),
      ird: {
        meetingId: KAYLEIGH.ird,
        heldAt: at('2026-08-24', '11:00'),
        outOfHours: false,
        participants: [
          { agency: 'social-work', name: name(tl), role: 'Team leader (decision maker)', userId: tl },
          { agency: 'police', name: `DS ${name(ds)}`, role: 'Detective sergeant, PPU', userId: ds },
          { agency: 'health', name: name(cpn), role: 'Child protection nurse adviser', userId: cpn },
          { agency: 'education', name: name(head), role: 'Head teacher, named person for Lily', userId: head },
        ],
        contributions: [
          { agency: 'police', byName: `DS ${name(ds)}`, byUserId: ds, at: at('2026-08-24', '11:05'), summary: 'Six domestic incidents since March 2024, rising in seriousness. Conviction Nov 2025 under the Domestic Abuse (Scotland) Act 2018 s1; community payback order. Charged 23 Aug; bail this morning with special conditions. DAQ 17 of 27. Lily gave a clear first account: "Ryan pushed Mum".' },
          { agency: 'social-work', byName: name(tl), byUserId: tl, at: at('2026-08-24', '11:12'), summary: 'No previous child protection involvement. The January MARAC summary was received and support offered; Kayleigh declined then. Justice social work supervises Ryan Kerr; he has not started the domestic abuse programme.' },
          { agency: 'health', byName: name(cpn), byUserId: cpn, at: at('2026-08-24', '11:18'), summary: 'Mason: speech delay with speech and language therapy; one missed health visitor contact September 2024. Kayleigh: GP treating anxiety since 2023; MARAC flag on the GP record since January. No injuries reported for either child.' },
          { agency: 'education', byName: name(head), byUserId: head, at: at('2026-08-24', '11:24'), summary: 'Lily is in P3. Attendance 89 percent last session, with dips after each incident. In January she told her teacher "Ryan shouted at Mum and the police came". The school had no flag and did not know about the MARAC.' },
        ],
        decisions: {
          significantHarm: { decided: true, decision: 'Yes for Lily and for Mason. Both children are at risk of significant harm from exposure to domestic abuse in the home.', rationale: 'Lily witnessed an assault on her mother and has described earlier incidents. Mason lives in the same household. The pattern since 2024 is escalating and the perpetrator has resumed contact after each separation.', at: at('2026-08-24', '11:35'), byName: name(tl), byUserId: tl },
          investigationNeeded: { decided: true, decision: 'Yes. Joint child protection investigation for both children.', rationale: 'A criminal investigation is under way and the risk to the children needs a joint assessment.', at: at('2026-08-24', '11:35'), byName: name(tl), byUserId: tl },
          jii: { decided: true, decision: 'Yes. Joint Investigative Interview for Lily under the Scottish Child Interview Model on 1 Sep. Mason (3) will not be interviewed.', rationale: 'Lily saw the assault and gave a clear first account. Her account is evidence in the criminal case and informs the assessment of harm.', plannerName: `DS ${name(ds)}`, informedBy: `${name(head)} (named person) on Lily's communication, timing and who should bring her`, at: at('2026-08-24', '11:40'), byName: `DS ${name(ds)}`, byUserId: ds },
          medical: { decided: true, decision: 'Not required. No injury to either child reported or seen.', rationale: 'Neither child was physically involved. Health will review if any injury is disclosed at the JII or a home visit.', kind: 'none', at: at('2026-08-24', '11:42'), byName: name(cpn), byUserId: cpn },
          emergencyMeasures: { decided: true, decision: 'None. Ryan Kerr\'s bail conditions (not to approach Kayleigh, the children or the address) plus an interim safety plan agreed with Kayleigh.', rationale: 'Kayleigh is protective and has agreed the plan. The bail conditions keep Ryan Kerr away from the home lawfully; no order is needed today.', measure: 'none', at: at('2026-08-24', '11:45'), byName: name(tl), byUserId: tl },
          reporterReferral: { decided: true, decision: 'Not at this stage. Reconsider at the CPPM on 21 Sep.', rationale: 'Kayleigh is cooperating on a voluntary basis; compulsory measures are not indicated while the interim plan holds.', at: at('2026-08-24', '11:48'), byName: name(tl), byUserId: tl },
          parentsInformed: { decided: true, decision: 'Kayleigh informed today of the concern, the investigation and the plan. Ryan Kerr not told of the JII or its timing; his justice social worker will tell him after the JII that the children are subject to child protection enquiries.', rationale: 'Telling Ryan Kerr about the JII before it happens could jeopardise the criminal case and increase risk to Kayleigh and Lily.', withheld: 'JII date and content withheld from Ryan Kerr. The MARAC is never disclosed to him.', at: at('2026-08-24', '11:50'), byName: name(tl), byUserId: tl },
        },
        siblingsConsidered: [lily.id, mason.id],
        interimSafetyPlanId: KAYLEIGH.interimPlan,
        childViewsSought: 'Lily to be seen alone by the social worker on 25 Aug and her views sought at the JII on 1 Sep. Mason (3) observed at home visits; his wellbeing considered through his presentation and his mother\'s and health visitor\'s accounts.',
      },
      investigation: {
        openedAt: at('2026-08-24', '13:00'),
        jiiHeldAt: at('2026-09-01', '10:00'),
        jiiModel: 'SCIM',
        summary: 'JII 1 Sep: Lily described Ryan shouting through the door, her mother being pushed and falling, and hiding behind the couch with Mason. She said Ryan "shouts a lot" and that she does not want him at the house. Home visits 25 and 27 Aug: both children settled with their mother; Kayleigh keeping to the plan. Ryan Kerr on bail; no breach confirmed. CPPM 21 Sep.',
      },
      cppm: { meetingId: KAYLEIGH.cppm, decision: 'pending' },
    },
  };
  ctx.data.processes.push(cp);

  // ----- Views and voice -----
  makeViews(ctx, { id: 'vw_docherty_adult', personId: kayleigh.id, processId: marac.id, kind: 'adult-views', recordedAt: at('2026-08-25', '14:00'), recordedByUserId: sw, recordedByName: name(sw), recordedByAgency: 'social-work', method: 'Home visit; Lily at school, Mason with his grandmother', content: '"I just want the kids safe. I do not want Ryan to know I have spoken to anyone, he will go mad. I want the locks changed and I want Lily to stop having to see this. I know I should not have let him back in December, but he is Mason\'s dad."', sharingPreference: 'Kayleigh asked that Ryan Kerr is not told what she said, or that she spoke with anyone.' });
  makeViews(ctx, { id: 'vw_docherty_victim', personId: kayleigh.id, processId: marac.id, kind: 'victim-wishes', recordedAt: at('2026-08-26', '11:00'), recordedByUserId: idaa, recordedByName: name(idaa), recordedByAgency: 'third-sector', method: 'IDAA meeting at a safe location away from the home', content: 'Kayleigh wants the children kept safe above everything. She does not want Ryan to know she has spoken to anyone. She wants the locks changed and a door chain fitted. She wants Mason to have a relationship with his dad one day, but not now and not at the house. She would like a personal alarm and someone to go with her to court.', sharingPreference: 'To be represented at MARAC by the IDAA. Not to be shared with Ryan Kerr or his family.' });
  makeViews(ctx, { id: 'vw_docherty_lily', personId: lily.id, processId: cp.id, kind: 'child-voice', recordedAt: at('2026-09-01', '10:00'), recordedByUserId: ds, recordedByName: `DS ${name(ds)}`, recordedByAgency: 'police', method: 'Joint Investigative Interview (SCIM)', content: '"Ryan was shouting through the door and Mum opened it and he pushed her and she fell on the shoes. I hid behind the couch with Mason. I do not want Ryan to come to our house. I like it when it is just us."', sharingPreference: 'Lily asked that Ryan is not told what she said.' });

  // ----- Interim safety plan and actions -----
  makePlan(ctx, {
    id: KAYLEIGH.interimPlan,
    processId: cp.id,
    type: 'interim-safety',
    title: 'Interim safety plan (IRD 24 Aug 2026)',
    outcomes: [{ id: 'out_docherty_isp_1', text: 'Lily and Mason are safe at home and Ryan Kerr has no contact with them or their mother until the CPPM', actionIds: ['act_docherty_isp_1', 'act_docherty_isp_2', 'act_docherty_isp_3'] }],
    coordinatorUserId: sw,
    coordinatorName: name(sw),
    agreedAt: '2026-08-24',
    reviewDate: '2026-09-21',
    status: 'active',
  });
  makeAction(ctx, { id: 'act_docherty_isp_1', processId: cp.id, meetingId: KAYLEIGH.ird, planId: KAYLEIGH.interimPlan, title: 'Police to confirm the bail conditions to Kayleigh in writing and to brief the school and nursery on who may collect the children', ownerUserId: ds, ownerName: `DS ${name(ds)}`, ownerAgency: 'police', due: '2026-08-25', status: 'complete', completedAt: at('2026-08-24', '16:00'), evidence: 'Bail conditions given to Kayleigh at 15:30; school and nursery briefed by phone and email', createdAt: at('2026-08-24', '11:55'), createdByName: name(tl) });
  makeAction(ctx, { id: 'act_docherty_isp_2', processId: cp.id, meetingId: KAYLEIGH.ird, planId: KAYLEIGH.interimPlan, title: 'School: only Kayleigh Docherty or Margaret Docherty may collect Lily; Ryan Kerr not to be admitted; call 999 if he attends', ownerUserId: head, ownerName: name(head), ownerAgency: 'education', due: '2026-08-25', status: 'complete', completedAt: at('2026-08-24', '13:40'), evidence: 'Office, class teacher and janitor briefed; SEEMIS collection note updated', createdAt: at('2026-08-24', '11:55'), createdByName: name(tl) });
  makeAction(ctx, { id: 'act_docherty_isp_3', processId: cp.id, meetingId: KAYLEIGH.ird, planId: KAYLEIGH.interimPlan, title: 'Social work home visits twice weekly until the CPPM; see Lily alone at each visit', ownerUserId: sw, ownerName: name(sw), ownerAgency: 'social-work', due: '2026-09-21', status: 'in-progress', evidence: 'Visits 25, 27 Aug and 1 Sep recorded', createdAt: at('2026-08-24', '11:55'), createdByName: name(tl) });
  makeAction(ctx, { id: 'act_docherty_cp_4', processId: cp.id, meetingId: KAYLEIGH.ird, title: "Referral for Lily to the Women's Aid children and young people's service", detail: 'Agreed with Kayleigh on 25 Aug. Referral form not yet sent.', ownerUserId: sw, ownerName: name(sw), ownerAgency: 'social-work', due: '2026-08-31', status: 'open', createdAt: at('2026-08-24', '11:55'), createdByName: name(tl) });
  makeAction(ctx, { id: 'act_docherty_cp_5', processId: cp.id, title: 'Health visitor to see Mason at home and complete a developmental check before the CPPM', ownerUserId: hv, ownerName: name(hv), ownerAgency: 'health', due: '2026-09-11', status: 'open', createdAt: at('2026-08-24', '13:00'), createdByName: name(sw) });
  makeAction(ctx, { id: 'act_docherty_marac_1', processId: marac.id, title: 'IDAA safety planning with Kayleigh: personal alarm, safe words with the school, emergency numbers', ownerUserId: idaa, ownerName: name(idaa), ownerAgency: 'third-sector', due: '2026-08-28', status: 'complete', completedAt: at('2026-08-26', '12:30'), evidence: 'Safety plan agreed 26 Aug; alarm issued; safe word shared with the school office', createdAt: at('2026-08-24', '16:00'), createdByName: name(coord) });
  makeAction(ctx, { id: 'act_docherty_marac_2', processId: marac.id, title: "Housing: change the locks at 8 Harbour Brae and fit a door viewer and chain (Kayleigh's request)", ownerUserId: housing, ownerName: name(housing), ownerAgency: 'housing', due: '2026-09-04', status: 'in-progress', evidence: 'Works order raised 27 Aug; joiner booked for 3 Sep', createdAt: at('2026-08-26', '12:30'), createdByName: name(idaa) });
  makeAction(ctx, { id: 'act_docherty_marac_3', processId: marac.id, title: 'Justice social work: review Ryan Kerr\'s community payback order, consider a breach report and inform the court of the new charges', detail: 'Ryan Kerr is not to be told about the MARAC.', ownerUserId: jsw, ownerName: name(jsw), ownerAgency: 'social-work', due: '2026-09-05', status: 'in-progress', evidence: 'Breach review opened 27 Aug; supervision appointment 27 Aug', createdAt: at('2026-08-25', '10:00'), createdByName: name(coord) });
  makeAction(ctx, { id: 'act_docherty_marac_4', processId: marac.id, title: 'Police: MATAC referral for Ryan Kerr (perpetrator-focused tasking)', ownerUserId: dc, ownerName: `DC ${name(dc)}`, ownerAgency: 'police', due: '2026-08-28', status: 'complete', completedAt: at('2026-08-26', '15:00'), evidence: 'MATAC referral submitted 26 Aug; listed for the next tasking meeting', createdAt: at('2026-08-24', '16:00'), createdByName: name(coord) });

  // ----- Meetings -----
  const irdInvitees = (present: boolean) => [
    { userId: tl, name: name(tl), agency: 'social-work' as Agency, role: 'Team leader', required: true, attendance: present ? ('present' as const) : ('accepted' as const), reason: 'Social work senior', needToKnowRowId: 'cp.ird.sw' },
    { userId: ds, name: `DS ${name(ds)}`, agency: 'police' as Agency, role: 'Detective sergeant, PPU', required: true, attendance: present ? ('present' as const) : ('accepted' as const), reason: 'Police decision maker', needToKnowRowId: 'cp.ird.ds' },
    { userId: cpn, name: name(cpn), agency: 'health' as Agency, role: 'Child protection nurse adviser', required: true, attendance: present ? ('present' as const) : ('accepted' as const), reason: 'Health decision maker', needToKnowRowId: 'cp.ird.health' },
    { userId: head, name: name(head), agency: 'education' as Agency, role: 'Head teacher', required: true, attendance: present ? ('present' as const) : ('accepted' as const), reason: 'School-age child; named person for Lily', needToKnowRowId: 'cp.ird.education' },
  ];

  makeMeeting(ctx, {
    id: KAYLEIGH.ird,
    type: 'ird',
    processId: cp.id,
    subjectIds: [lily.id, mason.id],
    title: 'IRD: Lily and Mason Docherty',
    scheduledAt: at('2026-08-24', '11:00'),
    endsAt: at('2026-08-24', '11:55'),
    location: 'Teams call (Ardvale PPU host)',
    status: 'held',
    chairUserId: tl,
    chairName: name(tl),
    invitees: irdInvitees(true),
    agenda: [
      { id: 'ag_docherty_ird_1', order: 1, title: 'Concern and immediate safety (bail outcome)', status: 'done' },
      { id: 'ag_docherty_ird_2', order: 2, title: 'Information from each agency, including the MARAC history', status: 'done' },
      { id: 'ag_docherty_ird_3', order: 3, title: 'Decisions: significant harm, investigation, JII, medical', status: 'done' },
      { id: 'ag_docherty_ird_4', order: 4, title: 'Interim safety plan and information to parents', status: 'done' },
      { id: 'ag_docherty_ird_5', order: 5, title: 'Referral to the Reporter and link to MARAC', status: 'done' },
    ],
    informationShared: [
      { id: 'is_docherty_ird_1', agency: 'police', byName: `DS ${name(ds)}`, byUserId: ds, at: at('2026-08-24', '11:05'), summary: 'Six incidents since March 2024; conviction Nov 2025; charged 23 Aug; bail with special conditions this morning; DAQ 17 of 27; Lily\'s first account.', relevance: 'Escalating risk; criminal proceedings; what the child saw', linkedEventIds: [] },
      { id: 'is_docherty_ird_2', agency: 'social-work', byName: name(tl), byUserId: tl, at: at('2026-08-24', '11:12'), summary: 'No previous CP involvement. January MARAC summary received; support declined then. Justice social work supervises Ryan Kerr.', relevance: 'History of engagement; controls on the adult of concern', linkedEventIds: [] },
      { id: 'is_docherty_ird_3', agency: 'health', byName: name(cpn), byUserId: cpn, at: at('2026-08-24', '11:18'), summary: 'Mason\'s speech delay and one missed contact; Kayleigh\'s anxiety and the GP MARAC flag; no injuries to the children.', relevance: 'Sibling wellbeing; mother\'s health', linkedEventIds: [] },
      { id: 'is_docherty_ird_4', agency: 'education', byName: name(head), byUserId: head, at: at('2026-08-24', '11:24'), summary: 'Attendance dips after each incident; January comment to her teacher; school had no MARAC flag.', relevance: 'Impact on Lily; gap in information to the school', linkedEventIds: [] },
    ],
    decisions: [
      { id: 'dec_docherty_ird_1', question: 'Are Lily and Mason at risk of significant harm?', decision: 'Yes, both children', rationale: 'Lily witnessed an assault and described earlier incidents; Mason lives in the same home; the pattern is escalating', dissent: [], decidedByName: name(tl), decidedByUserId: tl, decidedAt: at('2026-08-24', '11:35') },
      { id: 'dec_docherty_ird_2', question: 'Is a JII needed?', decision: 'Yes for Lily, 1 Sep under SCIM, planned by DS Mackay with advice from the head teacher. Not for Mason (3)', rationale: 'Clear first account from a child able to give evidence', dissent: [], decidedByName: `DS ${name(ds)}`, decidedByUserId: ds, decidedAt: at('2026-08-24', '11:40') },
      { id: 'dec_docherty_ird_3', question: 'Is a medical needed?', decision: 'Not required', rationale: 'No injury to either child reported or seen', dissent: [{ byName: name(cpn), byUserId: cpn, agency: 'health', text: 'Health would have offered Lily a comprehensive medical to document that she is uninjured and to give her a chance to talk to a doctor; accepted that no injury was reported and that a home visit will keep this under review.' }], decidedByName: name(cpn), decidedByUserId: cpn, decidedAt: at('2026-08-24', '11:42') },
      { id: 'dec_docherty_ird_4', question: 'Emergency measures?', decision: 'None. Bail conditions plus an interim safety plan agreed with Kayleigh', rationale: 'Mother protective and in agreement; the bail conditions keep Ryan Kerr away lawfully', dissent: [], decidedByName: name(tl), decidedByUserId: tl, decidedAt: at('2026-08-24', '11:45') },
      { id: 'dec_docherty_ird_5', question: 'Referral to the Reporter?', decision: 'Not at this stage; reconsider at the CPPM', rationale: 'Voluntary cooperation; compulsory measures not indicated', dissent: [], decidedByName: name(tl), decidedByUserId: tl, decidedAt: at('2026-08-24', '11:48') },
      { id: 'dec_docherty_ird_6', question: 'What is shared with the parents, and what is withheld?', decision: 'Kayleigh told everything today. Ryan Kerr not told about the JII; told of the enquiries by his justice social worker after it', rationale: 'Protects the criminal investigation and reduces risk. The MARAC is never disclosed to him', dissent: [], decidedByName: name(tl), decidedByUserId: tl, decidedAt: at('2026-08-24', '11:50') },
    ],
    actionIds: ['act_docherty_isp_1', 'act_docherty_isp_2', 'act_docherty_isp_3', 'act_docherty_cp_4'],
    viewsRecordIds: [],
    minute: { status: 'distributed', draftedAt: at('2026-08-24', '14:00'), approvedAt: at('2026-08-24', '16:20'), distributedAt: at('2026-08-24', '16:45') },
    distribution: [
      { id: 'dist_docherty_ird_1', recipientName: name(sw), recipientUserId: sw, agency: 'social-work', role: 'Allocated social worker', detailLevel: 'full', reason: 'Lead professional', sharingRecordId: 'shr_docherty_ird_1' },
      { id: 'dist_docherty_ird_2', recipientName: name(housing), recipientUserId: housing, agency: 'housing', role: 'Housing officer', detailLevel: 'fields', fields: ['address', 'household composition', 'interim safety plan actions relevant to housing'], reason: 'Housing relevant: target hardening and tenancy', sharingRecordId: 'shr_docherty_ird_2' },
      { id: 'dist_docherty_ird_3', recipientName: name(reporter), recipientUserId: reporter, agency: 'scra', role: "Children's Reporter", detailLevel: 'summary', reason: 'Referral decision recorded', sharingRecordId: 'shr_docherty_ird_3' },
      { id: 'dist_docherty_ird_4', recipientName: name(pf), recipientUserId: pf, agency: 'court', role: 'Procurator fiscal', detailLevel: 'summary', reason: 'JII planned', sharingRecordId: 'shr_docherty_ird_4' },
    ],
    reviewDate: '2026-09-21',
  });

  makeMeeting(ctx, {
    id: KAYLEIGH.maracMeeting,
    type: 'marac',
    processId: marac.id,
    subjectIds: [kayleigh.id],
    title: 'MARAC: Kayleigh Docherty (repeat)',
    scheduledAt: at('2026-09-09', '10:00'),
    endsAt: at('2026-09-09', '12:30'),
    location: 'Ardvale Civic Centre, room 1.2 (Clydeshore MARAC)',
    status: 'scheduled',
    chairUserId: ds,
    chairName: `DS ${name(ds)}`,
    minuteTakerUserId: coord,
    minuteTakerName: name(coord),
    invitees: [
      { userId: ds, name: `DS ${name(ds)}`, agency: 'police', role: 'Chair', required: true, attendance: 'accepted', reason: 'Chairs the Clydeshore MARAC' },
      { userId: coord, name: name(coord), agency: 'social-work', role: 'MARAC Coordinator', required: true, attendance: 'accepted', reason: 'Coordinator; minutes and actions', needToKnowRowId: 'marac.referral.coordinator' },
      { userId: dc, name: `DC ${name(dc)}`, agency: 'police', role: 'Referrer, Domestic Abuse Investigation Unit', required: true, attendance: 'accepted', reason: 'Referring agency must attend and present', needToKnowRowId: 'marac.referral.referrer' },
      { userId: idaa, name: name(idaa), agency: 'third-sector', role: 'IDAA', required: true, attendance: 'accepted', reason: "Represents Kayleigh's wishes; she does not attend", needToKnowRowId: 'marac.referral.idaa' },
      { userId: sw, name: name(sw), agency: 'social-work', role: "Children's social work", required: true, attendance: 'accepted', reason: 'Two children in the household; linked CP process', needToKnowRowId: 'marac.research.csw' },
      { userId: hv, name: name(hv), agency: 'health', role: 'Health visitor', required: true, attendance: 'accepted', reason: 'Named person for Mason', needToKnowRowId: 'marac.research.hv' },
      { userId: gp, name: `Dr ${name(gp)}`, agency: 'health', role: 'GP link', required: false, attendance: 'invited', reason: 'GP for the family; flag holder', needToKnowRowId: 'marac.research.gp' },
      { userId: housing, name: name(housing), agency: 'housing', role: 'Housing', required: true, attendance: 'accepted', reason: 'Tenancy and target hardening', needToKnowRowId: 'marac.research.housing' },
      { userId: head, name: name(head), agency: 'education', role: 'Education', required: false, attendance: 'invited', reason: 'School-age child in the household', needToKnowRowId: 'marac.research.education' },
      { userId: jsw, name: name(jsw), agency: 'social-work', role: 'Justice social work', required: true, attendance: 'accepted', reason: 'Supervises the perpetrator on a community payback order', needToKnowRowId: 'marac.research.jsw' },
      { userId: wa, name: name(wa), agency: 'third-sector', role: "Women's Aid", required: false, attendance: 'accepted', reason: 'Refuge and outreach', needToKnowRowId: 'marac.research.wa' },
    ],
    agenda: [
      { id: 'ag_docherty_marac_1', order: 1, title: 'Referral and risk summary (police, DAQ 17 of 27)', status: 'pending' },
      { id: 'ag_docherty_marac_2', order: 2, title: "Kayleigh's wishes (IDAA)", status: 'pending' },
      { id: 'ag_docherty_marac_3', order: 3, title: 'Information sharing by agency: victim, perpetrator, children', status: 'pending' },
      { id: 'ag_docherty_marac_4', order: 4, title: 'Risk discussion, including the children and the January actions', status: 'pending' },
      { id: 'ag_docherty_marac_5', order: 5, title: 'Action plan: owners and dates', status: 'pending' },
      { id: 'ag_docherty_marac_6', order: 6, title: 'Links: child protection, MATAC, DSDAS, flags reset', status: 'pending' },
    ],
    preMeetingRequests: research.map((r) => ({ id: `pmr_${r.id}`, agency: r.agency, toName: name(r.to), toUserId: r.to, sentAt: researchSentAt, dueAt: researchDue, status: r.status, returnSummary: r.returnSummary, returnedAt: r.returnedAt })),
    pack: [
      { id: 'pk_docherty_marac_1', kind: 'chronology', label: 'Integrated chronology, March 2024 to date', windowFrom: '2024-03-01', windowTo: '2026-09-08', included: true },
      { id: 'pk_docherty_marac_2', kind: 'risk-assessment', label: 'DAQ 23 Aug 2026 (17 of 27, high)', ref: daq.id, included: true },
      { id: 'pk_docherty_marac_3', kind: 'views', label: "Kayleigh's wishes via the IDAA (26 Aug)", ref: 'vw_docherty_victim', included: true },
      { id: 'pk_docherty_marac_4', kind: 'research-return', label: 'Police research return', ref: 'rr_docherty_police', included: true },
      { id: 'pk_docherty_marac_5', kind: 'research-return', label: 'Health visiting research return', ref: 'rr_docherty_hv', included: true },
      { id: 'pk_docherty_marac_6', kind: 'research-return', label: 'Justice social work research return', ref: 'rr_docherty_jsw', included: true },
      { id: 'pk_docherty_marac_7', kind: 'research-return', label: "Children's social work research return", ref: 'rr_docherty_csw', included: true },
      { id: 'pk_docherty_marac_8', kind: 'plan', label: 'Interim safety plan (CP, 24 Aug)', ref: KAYLEIGH.interimPlan, included: true },
      { id: 'pk_docherty_marac_9', kind: 'report', label: 'January 2026 MARAC actions and outcomes', ref: 'marac-2026-0011-actions', included: true },
    ],
    actionIds: ['act_docherty_marac_1', 'act_docherty_marac_2', 'act_docherty_marac_3', 'act_docherty_marac_4'],
    viewsRecordIds: ['vw_docherty_victim'],
    minute: { status: 'not-started' },
    subjectAttendance: 'Kayleigh does not attend. Her wishes are represented by her IDAA, Sadia Qureshi. Ryan Kerr is not told about the MARAC.',
  });

  makeMeeting(ctx, {
    id: KAYLEIGH.cppm,
    type: 'cppm',
    processId: cp.id,
    subjectIds: [lily.id, mason.id],
    title: 'Initial CPPM: Lily and Mason Docherty',
    scheduledAt: at('2026-09-21', '10:00'),
    endsAt: at('2026-09-21', '12:15'),
    location: 'Ardvale Civic Centre, room 2.4',
    status: 'scheduled',
    chairUserId: chair,
    chairName: name(chair),
    minuteTakerUserId: minutes,
    minuteTakerName: name(minutes),
    invitees: [
      ...irdInvitees(false),
      { userId: sw, name: name(sw), agency: 'social-work', role: 'Allocated social worker', required: true, attendance: 'accepted', reason: 'Lead professional', needToKnowRowId: 'cp.cppm.chair' },
      { userId: hv, name: name(hv), agency: 'health', role: 'Health visitor', required: true, attendance: 'accepted', reason: 'Named person for Mason' },
      { userId: gp, name: `Dr ${name(gp)}`, agency: 'health', role: 'GP', required: false, attendance: 'invited', reason: 'Report requested', needToKnowRowId: 'cp.cppm.gp' },
      { userId: idaa, name: name(idaa), agency: 'third-sector', role: 'IDAA', required: false, attendance: 'accepted', reason: 'Supports Kayleigh at the meeting; MARAC content is not minuted here' },
      { userId: jsw, name: name(jsw), agency: 'social-work', role: 'Justice social worker (Ryan Kerr)', required: false, attendance: 'invited', reason: 'Reports on compliance with the community payback order' },
      { name: 'Kayleigh Docherty', agency: 'social-work', role: 'Mother', required: true, attendance: 'invited', reason: 'Parent; attends with her IDAA' },
    ],
    agenda: [
      { id: 'ag_docherty_cppm_1', order: 1, title: 'Introductions, purpose and confidentiality', status: 'pending' },
      { id: 'ag_docherty_cppm_2', order: 2, title: "Lily's views (JII) and Mason's wellbeing", status: 'pending' },
      { id: 'ag_docherty_cppm_3', order: 3, title: 'Reports and integrated chronology', status: 'pending' },
      { id: 'ag_docherty_cppm_4', order: 4, title: "Kayleigh's views", status: 'pending' },
      { id: 'ag_docherty_cppm_5', order: 5, title: 'Analysis of risk and protective factors, including the MARAC plan', status: 'pending' },
      { id: 'ag_docherty_cppm_6', order: 6, title: 'Registration decision', status: 'pending' },
      { id: 'ag_docherty_cppm_7', order: 7, title: "Child's plan, core group and review date", status: 'pending' },
    ],
    preMeetingRequests: [
      { id: 'pmr_docherty_cppm_1', agency: 'social-work', toName: name(sw), toUserId: sw, sentAt: at('2026-09-01', '09:00'), dueAt: '2026-09-15', status: 'sent' },
      { id: 'pmr_docherty_cppm_2', agency: 'education', toName: name(head), toUserId: head, sentAt: at('2026-09-01', '09:00'), dueAt: '2026-09-15', status: 'sent' },
      { id: 'pmr_docherty_cppm_3', agency: 'health', toName: name(hv), toUserId: hv, sentAt: at('2026-09-01', '09:00'), dueAt: '2026-09-15', status: 'sent' },
      { id: 'pmr_docherty_cppm_4', agency: 'health', toName: `Dr ${name(gp)}`, toUserId: gp, sentAt: at('2026-09-01', '09:00'), dueAt: '2026-09-15', status: 'sent' },
      { id: 'pmr_docherty_cppm_5', agency: 'police', toName: `DS ${name(ds)}`, toUserId: ds, sentAt: at('2026-09-01', '09:00'), dueAt: '2026-09-15', status: 'sent' },
    ],
    pack: [
      { id: 'pk_docherty_cppm_1', kind: 'chronology', label: 'Integrated chronology, March 2024 to date', windowFrom: '2024-03-01', windowTo: '2026-09-20', included: true },
      { id: 'pk_docherty_cppm_2', kind: 'views', label: "Lily's views (JII 1 Sep)", ref: 'vw_docherty_lily', included: true },
      { id: 'pk_docherty_cppm_3', kind: 'views', label: "Kayleigh's views (25 Aug)", ref: 'vw_docherty_adult', included: true },
      { id: 'pk_docherty_cppm_4', kind: 'plan', label: 'Interim safety plan', ref: KAYLEIGH.interimPlan, included: true },
      { id: 'pk_docherty_cppm_5', kind: 'report', label: 'Social work report', included: false },
      { id: 'pk_docherty_cppm_6', kind: 'report', label: 'School report', included: false },
      { id: 'pk_docherty_cppm_7', kind: 'report', label: 'Health visitor report (Mason)', included: false },
      { id: 'pk_docherty_cppm_8', kind: 'report', label: 'GP report', included: false },
      { id: 'pk_docherty_cppm_9', kind: 'report', label: 'Police report', included: false },
    ],
    actionIds: ['act_docherty_isp_1', 'act_docherty_isp_2', 'act_docherty_isp_3', 'act_docherty_cp_4', 'act_docherty_cp_5'],
    viewsRecordIds: ['vw_docherty_lily', 'vw_docherty_adult'],
    minute: { status: 'not-started' },
    subjectAttendance: 'Kayleigh invited with her IDAA. Ryan Kerr (Mason\'s father) is not invited to the same session: the chair will take his views separately through his solicitor, without disclosing Kayleigh\'s arrangements or the MARAC. Lily (7) will not attend; her JII account will be read into the record.',
  });

  // ----- Sharing records -----
  const RESEARCH_FIELDS = ['victim name and date of birth', 'perpetrator name and date of birth', 'children names and dates of birth'];
  const researchSummary = 'Victim: Kayleigh Docherty, 12 Apr 1995. Perpetrator: Ryan Kerr, 15 Aug 1992. Children: Lily Docherty, 2 Jun 2019; Mason Docherty, 20 Jan 2023. Search your records and return what is relevant, necessary and proportionate by 2 Sep 2026.';
  for (const r of research) {
    const returned = r.status !== 'sent';
    makeShare(ctx, {
      id: `shr_${r.id}`,
      processId: marac.id,
      subjectId: kayleigh.id,
      stage: 'research',
      recipient: { userId: r.to, name: name(r.to), agency: r.agency, role: ctx.user(r.to).jobTitle },
      detailLevel: 'fields',
      fields: RESEARCH_FIELDS,
      lawfulBasisId: lbMarac.id,
      channel: 'in-app',
      status: returned ? 'read' : 'sent',
      createdAt: researchSentAt,
      sentAt: researchSentAt,
      readAt: returned ? r.returnedAt : undefined,
      reason: 'Research request sent. Names and dates of birth only, for record searching.',
      needToKnowRowId: r.rowId,
      createdByUserId: coord,
      createdByName: name(coord),
      summary: researchSummary,
    });
  }
  makeShare(ctx, { id: 'shr_docherty_referral_idaa', processId: marac.id, subjectId: kayleigh.id, stage: 'referral', recipient: { userId: idaa, name: name(idaa), agency: 'third-sector', role: 'IDAA' }, detailLevel: 'full', lawfulBasisId: lbMarac.id, channel: 'in-app', status: 'read', createdAt: at('2026-08-24', '16:00'), sentAt: at('2026-08-24', '16:00'), readAt: at('2026-08-24', '16:35'), reason: 'Referral received. IDAA allocated to support the victim before, during and after the meeting.', needToKnowRowId: 'marac.referral.idaa', createdByUserId: coord, createdByName: name(coord), summary: 'Repeat referral from police, DAQ 17 of 27. Children Lily and Mason. Linked CP process CP-2026-0431. Kayleigh asks that Ryan Kerr is not told she has spoken to anyone.' });

  const cpShare = (id: string, to: string, agency: Agency, role: string, level: 'full' | 'summary' | 'fields', reason: string, summary: string, rowId: string, fields?: string[]) =>
    makeShare(ctx, { id, processId: cp.id, subjectId: lily.id, stage: 'ird', recipient: { userId: to, name: name(to), agency, role }, detailLevel: level, fields, lawfulBasisId: lbCp.id, channel: agency === 'scra' || agency === 'court' ? 'secure-email-digest' : 'in-app', status: 'read', createdAt: at('2026-08-24', '16:45'), sentAt: at('2026-08-24', '16:45'), readAt: at('2026-08-25', '09:10'), reason, needToKnowRowId: rowId, createdByUserId: tl, createdByName: name(tl), summary });
  cpShare('shr_docherty_ird_1', sw, 'social-work', 'Allocated social worker', 'full', 'IRD held. Lead professional.', 'IRD record for Lily and Mason, decisions, interim safety plan and JII planning', 'cp.ird.lead');
  cpShare('shr_docherty_ird_2', housing, 'housing', 'Housing officer', 'fields', 'IRD held. If housing is relevant.', 'Household at 8 Harbour Brae: Kayleigh, Lily and Mason. Ryan Kerr excluded by bail conditions. Interim plan asks for lock change, door viewer and chain.', 'cp.ird.housing', ['address', 'household composition', 'interim safety plan actions relevant to housing']);
  cpShare('shr_docherty_ird_3', reporter, 'scra', "Children's Reporter", 'summary', 'Reporter referral decision recorded.', 'IRD held 24 Aug for Lily and Mason Docherty; referral to the Reporter not made at this stage; decision to be reviewed at the CPPM on 21 Sep', 'cp.ird.scra');
  cpShare('shr_docherty_ird_4', pf, 'court', 'Procurator fiscal', 'summary', 'JII decision recorded. If a Joint Investigative Interview is planned.', 'JII for Lily Docherty planned 1 Sep under SCIM; police lead DS Mackay; linked to charges against Ryan Kerr', 'cp.ird.pf');

  // ----- Chronology events -----
  type EventInput = Parameters<typeof makeEvent>[1];
  const K = (e: Omit<EventInput, 'subjectIds'> & { subjectIds?: string[] }) =>
    makeEvent(ctx, { subjectIds: [kayleigh.id], linkedProcessIds: [marac.id], visibility: 'integrated', lawfulBasisId: lbMarac.id, ...e });
  const C = (e: Omit<EventInput, 'subjectIds'> & { subjectIds?: string[] }) =>
    makeEvent(ctx, { subjectIds: [lily.id], linkedProcessIds: [cp.id], visibility: 'integrated', lawfulBasisId: lbCp.id, ...e });

  // Kayleigh, with Ryan as co-subject on the police incidents he was accused in.
  K({ occurredAt: at('2019-06-02', '03:15'), agency: 'health', sourceSystem: 'trakcare', recordedByName: 'TrakCare connector', eventType: 'family.birth', title: 'Lily born at Clydeshore Royal Infirmary', detail: 'Born at 40 weeks, 3.4 kg. Discharged home to Shore Loan, Portlennan with mother on day 1. Father not named.', significance: 'low', subjectIds: [kayleigh.id, lily.id], linkedProcessIds: [] });
  K({ occurredAt: at('2021-03-08', '00:00'), hasTime: false, agency: 'housing', recordedByName: name(housing), recordedByUserId: housing, eventType: 'move.address', title: 'Scottish Secure Tenancy at 8 Harbour Brae, Ardvale started', detail: 'Two-bedroom house allocated to Kayleigh Docherty with Lily. Tenancy in her sole name.', significance: 'low', subjectIds: [kayleigh.id, lily.id] });
  K({ occurredAt: at('2021-09-01', '00:00'), hasTime: false, approximate: true, agency: 'social-work', recordedByName: name(sw), recordedByUserId: sw, eventType: 'household.change', title: 'Relationship with Ryan Kerr began', detail: 'Date approximate, from Kayleigh\'s account at the August 2026 assessment.', significance: 'moderate', linkedPersonIds: [ryan.id] });
  K({ occurredAt: at('2022-02-01', '00:00'), hasTime: false, approximate: true, agency: 'social-work', recordedByName: name(sw), recordedByUserId: sw, eventType: 'household.change', title: 'Ryan Kerr moved into 8 Harbour Brae', detail: 'Date approximate, from Kayleigh\'s account. Not added to the tenancy.', significance: 'moderate', subjectIds: [kayleigh.id, ryan.id], linkedPersonIds: [lily.id] });
  K({ occurredAt: at('2023-01-20', '14:50'), agency: 'health', sourceSystem: 'trakcare', recordedByName: 'TrakCare connector', eventType: 'family.birth', title: 'Mason born at Clydeshore Royal Infirmary', detail: 'Born at 39 weeks, 3.6 kg. Father recorded as Ryan Kerr. Discharged home on day 2.', significance: 'moderate', subjectIds: [kayleigh.id, mason.id], linkedPersonIds: [ryan.id], linkedProcessIds: [] });
  K({ occurredAt: at('2023-08-14', '10:20'), agency: 'health', sourceSystem: 'emis-web', recordedByName: 'EMIS Web connector', eventType: 'health.consultation', title: 'GP consultation: low mood and poor sleep', detail: 'Seven months after Mason\'s birth. Reports arguments at home; did not want to say more. Sertraline started; review in four weeks.', significance: 'moderate' });
  K({ id: 'evt_docherty_pol_1', occurredAt: at('2024-03-16', '22:50'), agency: 'police', sourceSystem: 'ivpd', recordedByName: 'iVPD connector', eventType: 'police.incident', title: 'Domestic incident: argument, Ryan Kerr intoxicated, no crime', detail: 'Neighbour reported shouting. Ryan Kerr intoxicated and argumentative; Kayleigh tearful, no injuries. Both children asleep. Ryan left to stay with his brother.', response: 'Domestic incident recorded. DAQ 8 yes. Information leaflet left.', outcome: 'No further action.', significance: 'moderate', subjectIds: [kayleigh.id, ryan.id], linkedPersonIds: [lily.id, mason.id] });
  K({ id: 'evt_docherty_pol_2', occurredAt: at('2024-08-03', '21:30'), agency: 'police', sourceSystem: 'ivpd', recordedByName: 'iVPD connector', eventType: 'police.incident', title: 'Domestic incident: living room door and television damaged', detail: 'Kayleigh called 999. Ryan Kerr had punched through the living room door and thrown the television during an argument, then left before officers arrived. Children in bed, awake.', response: 'Kayleigh declined to give a statement. Recorded as a domestic incident; DAQ 10 yes. Child concern reports for Lily and Mason.', outcome: 'Ryan Kerr traced and warned. No charge.', significance: 'moderate', subjectIds: [kayleigh.id, ryan.id], linkedPersonIds: [lily.id, mason.id] });
  K({ occurredAt: at('2024-08-12', '00:00'), hasTime: false, agency: 'housing', recordedByName: name(housing), recordedByUserId: housing, eventType: 'other', title: 'Repair: internal door and hall wall after damage', detail: 'Tenant reported accidental damage. Rechargeable repair waived after the housing officer noted the police attendance.', significance: 'low' });
  K({ occurredAt: at('2024-11-06', '15:40'), agency: 'health', sourceSystem: 'emis-web', recordedByName: 'EMIS Web connector', eventType: 'health.consultation', title: 'GP consultation: anxiety and panic attacks; asked about safety at home', detail: 'Said her partner "loses his temper". Declined a referral to Women\'s Aid. Given the helpline number. Sertraline increased.', significance: 'moderate', significanceReason: 'First disclosure to a professional' });
  K({ id: 'evt_docherty_pol_3', occurredAt: at('2025-03-14', '23:40'), agency: 'police', sourceSystem: 'ivpd', recordedByName: 'iVPD connector', eventType: 'police.incident', title: 'Assault: grabbed by the throat and pushed against a wall; Ryan Kerr arrested', detail: 'Kayleigh called 999 from the bathroom. Marks to the neck and bruising to the upper arm. Ryan Kerr arrested at the address. Children asleep upstairs.', response: 'Ryan Kerr charged the next day. DAQ completed: 12 yes. No MARAC referral (below threshold; professional judgement not used).', outcome: 'Kayleigh left for a refuge outwith the area on 15 Mar with the children.', significance: 'high', significanceReason: 'Non-fatal strangulation is a marker of escalating risk', subjectIds: [kayleigh.id, ryan.id], linkedPersonIds: [lily.id, mason.id] });
  K({ occurredAt: at('2025-03-15', '13:20'), agency: 'police', sourceSystem: 'ivpd', recordedByName: 'iVPD connector', eventType: 'police.charge', title: 'Ryan Kerr charged: Domestic Abuse (Scotland) Act 2018 s1 and assault', detail: 'Course of abusive behaviour towards Kayleigh Docherty between March 2024 and March 2025, and assault on 14 Mar 2025. Held for court.', significance: 'high', subjectIds: [ryan.id, kayleigh.id] });
  K({ occurredAt: at('2025-03-16', '11:00'), agency: 'police', sourceSystem: 'ivpd', recordedByName: 'iVPD connector', eventType: 'police.bail-condition', title: 'Bail: not to approach Kayleigh Docherty or 8 Harbour Brae', detail: 'Ardvale Sheriff Court. Special conditions until the case concludes.', significance: 'high', subjectIds: [ryan.id, kayleigh.id] });
  K({ occurredAt: at('2025-03-15', '00:00'), hasTime: false, agency: 'social-work', recordedByName: name(sw), recordedByUserId: sw, eventType: 'move.address', title: 'Kayleigh and the children went to a refuge outwith Clydeshore', detail: 'Six weeks in a refuge arranged through the national domestic abuse helpline. Recorded from Kayleigh\'s account in August 2026; the refuge address is not held.', significance: 'high', subjectIds: [kayleigh.id, lily.id, mason.id] });
  K({ occurredAt: at('2025-04-28', '00:00'), hasTime: false, agency: 'housing', recordedByName: name(housing), recordedByUserId: housing, eventType: 'other', title: 'Locks changed at 8 Harbour Brae; Kayleigh returned with the children', detail: 'Lock change under the domestic abuse policy. Ryan Kerr removed from the household record.', significance: 'moderate', subjectIds: [kayleigh.id, lily.id, mason.id] });
  K({ occurredAt: at('2025-06-02', '00:00'), hasTime: false, agency: 'housing', recordedByName: name(housing), recordedByUserId: housing, eventType: 'move.address', title: 'Ryan Kerr: council tenancy at 15 Cannon Loan, Auchentorran started', detail: 'One-bedroom flat.', significance: 'low', subjectIds: [ryan.id] });
  K({ occurredAt: at('2025-11-18', '14:30'), agency: 'police', recordedByName: 'Police Scotland (criminal history)', eventType: 'police.conviction', title: 'Ryan Kerr convicted: Domestic Abuse (Scotland) Act 2018 s1; community payback order', detail: 'Ardvale Sheriff Court. Community payback order: 18 months supervision, 150 hours unpaid work, domestic abuse programme requirement. A non-harassment order was considered and not made; Kayleigh told the court she did not want one.', significance: 'high', significanceReason: 'Conviction for a course of domestic abuse', subjectIds: [ryan.id, kayleigh.id] });
  K({ occurredAt: at('2025-11-25', '10:00'), agency: 'social-work', recordedByName: name(jsw), recordedByUserId: jsw, eventType: 'social-work.allocation', title: 'Community payback order supervision started; allocated to Helen Rae', detail: 'Induction completed. Unpaid work placement from 8 Dec. Domestic abuse programme assessment booked for January.', significance: 'moderate', subjectIds: [ryan.id] });
  K({ occurredAt: at('2025-12-27', '00:00'), hasTime: false, approximate: true, agency: 'third-sector', recordedByName: name(idaa), recordedByUserId: idaa, eventType: 'household.change', title: 'Contact with Ryan Kerr resumed after the conviction', detail: 'Ryan staying over some nights "for Mason". Date approximate, from Kayleigh\'s account to the IDAA in January 2026.', significance: 'moderate', linkedPersonIds: [ryan.id] });
  K({ id: 'evt_docherty_pol_4', occurredAt: at('2025-12-30', '22:15'), agency: 'police', sourceSystem: 'ivpd', recordedByName: 'iVPD connector', eventType: 'police.incident', title: 'Domestic incident: Ryan Kerr refused to leave, threats; DAQ 15 yes; MARAC referral', detail: 'Kayleigh called 999. Ryan Kerr shouting that he would "make her sorry" and refusing to leave. Left when officers arrived. Lily awake on the landing.', response: 'DAQ 15 yes of 27 (high). MARAC referral 31 Dec. Child concern reports for Lily and Mason. Ryan Kerr warned; no charge.', outcome: 'Heard at MARAC 8 Jan 2026.', significance: 'high', significanceReason: 'First high-risk DAQ; first MARAC referral', subjectIds: [kayleigh.id, ryan.id], linkedPersonIds: [lily.id, mason.id] });
  K({ occurredAt: at('2026-01-08', '10:00'), agency: 'social-work', recordedByName: name(coord), recordedByUserId: coord, eventType: 'process.marac', title: 'Heard at Clydeshore MARAC (first referral)', detail: 'Actions: IDAA allocated; MARAC flags on health and housing records; justice social work to address contact within the order; target hardening offered; children\'s social work to offer support.', outcome: 'All actions completed by 20 Feb 2026. Kayleigh declined social work support.', significance: 'high', significanceReason: 'Multi-agency risk management started' });
  K({ occurredAt: at('2026-01-09', '09:30'), agency: 'social-work', recordedByName: name(coord), recordedByUserId: coord, eventType: 'sharing', title: 'MARAC flags placed on GP and housing records (12 months)', detail: 'Flag only, no detail. Expires 8 Jan 2027 unless reset by a later referral.', significance: 'low' });
  K({ occurredAt: at('2026-02-14', '00:00'), hasTime: false, approximate: true, agency: 'third-sector', recordedByName: name(idaa), recordedByUserId: idaa, eventType: 'family.change', title: 'Relationship with Ryan Kerr ended', detail: 'Kayleigh told the IDAA she had ended the relationship and asked Ryan not to come to the house. Contact about Mason by text only. Date approximate.', significance: 'moderate', linkedPersonIds: [ryan.id] });
  K({ occurredAt: at('2026-04-19', '00:00'), hasTime: false, agency: 'third-sector', recordedByName: name(idaa), recordedByUserId: idaa, eventType: 'disclosure', title: 'Ryan Kerr attended the house uninvited asking to see Mason', detail: 'Kayleigh told the IDAA at her next contact. He left when asked. Not reported to police at the time.', significance: 'moderate', linkedPersonIds: [ryan.id, mason.id] });
  K({ id: 'evt_docherty_pol_5', occurredAt: at('2026-06-28', '21:00'), agency: 'police', sourceSystem: 'ivpd', recordedByName: 'iVPD connector', eventType: 'police.incident', title: 'Repeated calls and messages from Ryan Kerr (34 in one evening) including threats', detail: 'Kayleigh reported 34 calls and messages between 18:00 and 21:00, including "you will regret this". Ryan Kerr said he wanted to see Mason.', response: 'Ryan Kerr warned by officers. DAQ 13 yes. Dealt with as a single-agency warning; not referred as a MARAC repeat.', outcome: 'Messages stopped for three weeks.', significance: 'high', significanceReason: 'Within the 12 month repeat window after the January MARAC', subjectIds: [kayleigh.id, ryan.id], linkedPersonIds: [mason.id] });
  K({ occurredAt: at('2026-07-15', '11:10'), agency: 'health', sourceSystem: 'emis-web', recordedByName: 'EMIS Web connector', eventType: 'health.consultation', title: 'GP consultation: sleep and anxiety; MARAC flag noted', detail: 'Dr Farouk noted the MARAC flag and asked about safety. Kayleigh said things were "calmer". Sertraline continued.', significance: 'moderate' });
  K({ id: 'evt_docherty_pol_6', occurredAt: at('2026-08-22', '23:10'), agency: 'police', sourceSystem: 'ivpd', recordedByName: 'iVPD connector', eventType: 'police.incident', title: 'Ryan Kerr attended the house, threats, pushed Kayleigh; Lily saw it', detail: 'Ryan Kerr shouted threats through the door, then pushed Kayleigh into the hall when she opened it; she fell against the shoe rack. Lily (7) on the stairs, screaming. Mason asleep. Ryan left before officers arrived.', response: 'Officers within 20 minutes. Ryan Kerr arrested at Cannon Loan at 00:40. Child Concern Report submitted 01:30.', outcome: 'DAQ 23 Aug: 17 yes of 27 (high). Charged 23 Aug. MARAC referral 24 Aug (repeat). IRD 24 Aug.', significance: 'high', significanceReason: 'Assault witnessed by a child; repeat within 12 months', subjectIds: [kayleigh.id, ryan.id, lily.id], linkedPersonIds: [mason.id], linkedProcessIds: [marac.id, cp.id] });
  K({ occurredAt: at('2026-08-23', '14:20'), agency: 'police', sourceSystem: 'ivpd', recordedByName: 'iVPD connector', eventType: 'police.charge', title: 'Ryan Kerr charged: assault and threatening or abusive behaviour, domestic aggravation', detail: 'Assault and s38 Criminal Justice and Licensing (Scotland) Act 2010, with the domestic abuse aggravation. Held in custody for court on 24 Aug.', significance: 'high', subjectIds: [ryan.id, kayleigh.id] });
  K({ occurredAt: at('2026-08-24', '10:15'), agency: 'police', sourceSystem: 'ivpd', recordedByName: 'iVPD connector', eventType: 'police.bail-condition', title: 'Bail: not to approach Kayleigh, Lily or Mason Docherty, or 8 Harbour Brae', detail: 'Ardvale Sheriff Court. Special conditions until the case concludes. Any breach to be reported to the lead professional and the MARAC Coordinator the same day.', significance: 'high', subjectIds: [ryan.id, kayleigh.id], linkedPersonIds: [lily.id, mason.id], linkedProcessIds: [marac.id, cp.id] });
  K({ occurredAt: at('2026-08-24', '15:00'), agency: 'social-work', recordedByName: name(coord), recordedByUserId: coord, eventType: 'process.referral', title: 'MARAC referral received: repeat (previous hearing 8 Jan 2026)', detail: 'Police referral after DAQ 17 of 27. Listed for 9 Sep. Linked to child protection process CP-2026-0431.', significance: 'high' });
  K({ occurredAt: at('2026-08-25', '14:00'), agency: 'social-work', recordedByName: name(sw), recordedByUserId: sw, eventType: 'voice.adult', title: "Kayleigh's views recorded at a home visit", detail: 'Wants the children safe, the locks changed, and Ryan not to know she has spoken to anyone.', significance: 'moderate', linkedProcessIds: [marac.id, cp.id] });
  K({ occurredAt: at('2026-08-26', '11:00'), agency: 'third-sector', recordedByName: name(idaa), recordedByUserId: idaa, eventType: 'voice.victim', title: "Kayleigh's wishes recorded by the IDAA; safety plan agreed", detail: 'Personal alarm issued. Safe word agreed with the school office. Wants a door chain and someone to go with her to court.', significance: 'moderate' });
  K({ occurredAt: at('2026-08-26', '15:00'), agency: 'police', recordedByName: `DC ${name(dc)}`, recordedByUserId: dc, eventType: 'police.notification', title: 'Ryan Kerr referred to MATAC', detail: 'Perpetrator-focused Multi Agency Tasking and Coordination referral. Listed for the next tasking meeting.', significance: 'moderate', subjectIds: [ryan.id], visibility: 'agency-only', lawfulBasisId: undefined });
  K({ occurredAt: at('2026-08-27', '11:00'), agency: 'social-work', recordedByName: name(jsw), recordedByUserId: jsw, eventType: 'social-work.contact', title: 'Supervision: Ryan Kerr reported the new charges; breach review started', detail: 'Bail conditions discussed. He denies pushing Kayleigh. Missed two unpaid work placements in July. Domestic abuse programme still not started. Breach review opened; court to be informed.', significance: 'moderate', subjectIds: [ryan.id] });
  K({ occurredAt: at('2026-08-28', '09:00'), agency: 'social-work', recordedByName: name(coord), recordedByUserId: coord, eventType: 'sharing', title: 'MARAC research requests sent to eight agencies (due 2 Sep)', detail: 'Names and dates of birth only. Police, GP, health visiting, housing, education, justice social work, children\'s social work, Women\'s Aid.', significance: 'low' });
  K({ occurredAt: at('2026-01-13', '10:30'), agency: 'social-work', recordedByName: name(jsw), recordedByUserId: jsw, eventType: 'social-work.contact', title: 'Supervision: Ryan Kerr denies the December incident; reminded of the order conditions', detail: 'Programme start delayed to March at his request. MARAC not disclosed to him.', significance: 'moderate', subjectIds: [ryan.id], visibility: 'agency-only', lawfulBasisId: undefined });
  K({ occurredAt: at('2026-04-07', '00:00'), hasTime: false, agency: 'social-work', recordedByName: name(jsw), recordedByUserId: jsw, eventType: 'social-work.contact', title: 'Unpaid work: 60 of 150 hours completed; two missed placements', detail: 'Warning letter issued. Programme assessment completed; group start deferred to September.', significance: 'low', subjectIds: [ryan.id], visibility: 'agency-only', lawfulBasisId: undefined });
  K({ occurredAt: at('2019-07-20', '00:00'), hasTime: false, agency: 'police', recordedByName: 'Police Scotland (criminal history)', eventType: 'police.conviction', title: 'Ryan Kerr convicted: breach of the peace (2019), fined', detail: 'Disturbance outside a pub in Auchentorran. Fine of 300 pounds.', significance: 'low', subjectIds: [ryan.id] });

  // Lily and Mason.
  C({ occurredAt: at('2019-06-13', '00:00'), hasTime: false, agency: 'health', sourceSystem: 'morse', recordedByName: 'Morse connector', eventType: 'health.assessment', title: 'Health visitor first visit', detail: 'Mother aged 24, single, living with her own mother. Feeding established. Warm and attentive.', significance: 'low' });
  C({ occurredAt: at('2021-09-20', '00:00'), hasTime: false, agency: 'health', sourceSystem: 'morse', recordedByName: 'Morse connector', eventType: 'health.assessment', title: '27 to 30 month review: development on track', detail: 'Speech and social development good. Mother mentions a new partner.', significance: 'low' });
  C({ occurredAt: at('2022-08-17', '00:00'), hasTime: false, agency: 'education', sourceSystem: 'seemis', recordedByName: 'SEEMIS connector', eventType: 'education.enrolment', title: 'Started nursery at Ardvale Primary nursery class', detail: 'Five mornings a week.', significance: 'low' });
  C({ occurredAt: at('2024-08-14', '00:00'), hasTime: false, agency: 'education', sourceSystem: 'seemis', recordedByName: 'SEEMIS connector', eventType: 'education.enrolment', title: 'Started P1 at Ardvale Primary', detail: 'Enrolled. Named person: head teacher.', significance: 'low' });
  C({ occurredAt: at('2024-12-19', '00:00'), hasTime: false, agency: 'education', sourceSystem: 'seemis', recordedByName: 'SEEMIS connector', eventType: 'education.attendance', title: 'Attendance 91 percent, term 1 and 2; absences after weekends in August and September', detail: 'Seven absences, five of them Mondays. Tired on arrival.', response: 'Named person phone call to mother.', significance: 'moderate' });
  C({ occurredAt: at('2025-03-17', '00:00'), hasTime: false, agency: 'education', sourceSystem: 'seemis', recordedByName: 'SEEMIS connector', eventType: 'education.attendance', title: 'Absent for six weeks (family in a refuge outwith the area)', detail: 'Mother phoned the school on 17 Mar. Work sent home. Returned 29 Apr.', significance: 'moderate', significanceReason: 'Prolonged absence linked to a domestic abuse incident' });
  C({ occurredAt: at('2025-05-02', '00:00'), hasTime: false, agency: 'education', recordedByName: name(head), recordedByUserId: head, eventType: 'education.concern', title: 'Wellbeing concern: tearful and clingy at drop-off since returning; nightmares reported', detail: 'Class teacher noted Lily crying at the door most mornings. Mother reports nightmares.', response: 'Nurture group place; named person check-ins weekly.', significance: 'moderate' });
  C({ occurredAt: at('2025-06-27', '00:00'), hasTime: false, agency: 'education', sourceSystem: 'seemis', recordedByName: 'SEEMIS connector', eventType: 'education.attendance', title: 'Attendance 84 percent for the session', detail: 'Below threshold, mainly the March to April absence.', significance: 'moderate' });
  C({ occurredAt: at('2026-01-12', '00:00'), hasTime: false, agency: 'education', recordedByName: name(head), recordedByUserId: head, eventType: 'education.concern', title: 'Lily told her class teacher "Ryan shouted at Mum and the police came"', detail: 'Said during a news-sharing circle. Quiet for the rest of the day.', response: 'Named person spoke with mother, who said it was "sorted". The school had no MARAC flag and did not know a referral had been made.', significance: 'moderate', significanceReason: 'Child\'s own account of a police incident' });
  C({ occurredAt: at('2026-06-26', '00:00'), hasTime: false, agency: 'education', sourceSystem: 'seemis', recordedByName: 'SEEMIS connector', eventType: 'education.attendance', title: 'Attendance 89 percent for the session; dips in September 2025 and January 2026', detail: 'Absences cluster in the weeks after the police incidents in December and June.', significance: 'moderate' });
  C({ occurredAt: at('2026-08-24', '11:00'), agency: 'social-work', recordedByName: name(tl), recordedByUserId: tl, eventType: 'process.ird', title: 'IRD held: joint investigation, JII for Lily, interim safety plan', detail: 'Social work, police, health and education. No emergency order: bail conditions plus the interim plan. Reporter referral not made at this stage. Ryan Kerr not told about the JII.', significance: 'high', significanceReason: 'Child protection procedures initiated', subjectIds: [lily.id, mason.id], linkedPersonIds: [kayleigh.id, ryan.id] });
  C({ occurredAt: at('2026-08-25', '15:30'), agency: 'social-work', recordedByName: name(sw), recordedByUserId: sw, eventType: 'social-work.visit', title: 'Home visit: Lily seen alone; Mason seen with his mother', detail: 'Lily said she "hid behind the couch with Mason". Both children settled. Kayleigh keeping to the plan.', significance: 'moderate', subjectIds: [lily.id, mason.id] });
  C({ occurredAt: at('2026-09-01', '10:00'), agency: 'police', recordedByName: `DS ${name(ds)}`, recordedByUserId: ds, eventType: 'voice.child', title: 'Joint Investigative Interview held (SCIM)', detail: 'Lily gave a clear account of the push at the door and of hiding with Mason. Said she does not want Ryan at the house.', significance: 'high', significanceReason: 'Child\'s account recorded' });
  C({ occurredAt: at('2023-02-01', '00:00'), hasTime: false, agency: 'health', sourceSystem: 'morse', recordedByName: 'Morse connector', eventType: 'health.assessment', title: 'Health visitor first visit (Mason)', detail: 'Mother tired; partner "helps when he is here". Home warm and clean. Lily attentive to the baby.', significance: 'low', subjectIds: [mason.id] });
  C({ occurredAt: at('2023-03-06', '00:00'), hasTime: false, agency: 'health', sourceSystem: 'morse', recordedByName: 'Morse connector', eventType: 'health.assessment', title: '6 to 8 week review (Mason): development normal; mother low in mood', detail: 'Edinburgh Postnatal Depression Scale 11. GP appointment advised.', response: 'Listening visits offered.', significance: 'moderate', subjectIds: [mason.id] });
  C({ occurredAt: at('2024-04-22', '00:00'), hasTime: false, agency: 'health', sourceSystem: 'morse', recordedByName: 'Morse connector', eventType: 'health.assessment', title: '13 to 15 month review (Mason): development on track', detail: 'Walking. Few words. Household noisy; mother flat in mood.', significance: 'low', subjectIds: [mason.id] });
  C({ occurredAt: at('2024-09-09', '00:00'), hasTime: false, agency: 'health', sourceSystem: 'morse', recordedByName: 'Morse connector', eventType: 'health.missed-appointment', title: 'Health visitor visit not achieved (Mason)', detail: 'No answer on 9 and 16 Sep. Contact made by phone on 23 Sep; mother said they had been "away at her mum\'s".', significance: 'moderate', subjectIds: [mason.id] });
  C({ occurredAt: at('2025-05-12', '00:00'), hasTime: false, agency: 'health', sourceSystem: 'morse', recordedByName: 'Morse connector', eventType: 'health.assessment', title: '27 to 30 month review (Mason), late after the refuge stay: speech delay', detail: 'Fewer than 20 words. Referred to speech and language therapy. Mother tearful; Women\'s Aid outreach declined.', significance: 'moderate', subjectIds: [mason.id] });
  C({ occurredAt: at('2026-02-09', '00:00'), hasTime: false, agency: 'health', recordedByName: name(hv), recordedByUserId: hv, eventType: 'health.assessment', title: 'Health visitor contact (Mason): speech therapy progressing; MARAC flag noted', detail: 'Mason settled. Mother said Ryan "is not living here". Flag on the GP record seen; support offered.', significance: 'low', subjectIds: [mason.id] });

  // ----- Analysis notes: separate from facts -----
  const kayleighPolice = ctx.data.events.filter((e) => e.subjectIds.includes(kayleigh.id) && e.eventType === 'police.incident').map((e) => e.id);
  const contactChanges = ctx.data.events.filter((e) => e.subjectIds.includes(kayleigh.id) && (e.eventType === 'household.change' || e.eventType === 'family.change' || e.eventType === 'disclosure')).map((e) => e.id);
  makeAnalysis(ctx, {
    id: 'ana_docherty_1',
    subjectId: kayleigh.id,
    processId: marac.id,
    eventIds: [...kayleighPolice, ...contactChanges],
    authorUserId: idaa,
    authorName: name(idaa),
    agency: 'third-sector',
    recordedAt: at('2026-08-27', '16:00'),
    kind: 'risk',
    title: 'Each escalation follows renewed contact with Ryan Kerr',
    text: 'The six police incidents since March 2024 rise in seriousness: an argument, damage to the home, an assault involving strangulation, threats, a night of 34 calls and messages, and an assault witnessed by Lily. Each of the last three came within weeks of Ryan Kerr regaining contact: staying over after the conviction in December, being allowed in to see Mason in April, and contact about Mason in the summer. The June incident fell inside the 12 month repeat window and was handled as a single-agency warning rather than referred. The school was never flagged and learned of the January MARAC from Lily herself. For the meeting: contact about Mason is the route back into the house, so the plan needs a safe contact arrangement that does not depend on Kayleigh saying no at the door, and the flag should reach education this time.',
  });
  const lilyAttendance = ctx.data.events.filter((e) => e.subjectIds.includes(lily.id) && (e.eventType === 'education.attendance' || e.eventType === 'education.concern')).map((e) => e.id);
  makeAnalysis(ctx, {
    id: 'ana_docherty_2',
    subjectId: lily.id,
    processId: cp.id,
    eventIds: [...lilyAttendance, ...kayleighPolice],
    authorUserId: head,
    authorName: name(head),
    agency: 'education',
    recordedAt: at('2026-08-31', '15:30'),
    kind: 'pattern',
    title: "Lily's attendance dips in the weeks after each police incident",
    text: 'Set against the police lane, every dip in Lily\'s attendance sits in the two to four weeks after an incident at home: the Monday absences after August 2024, the six-week gap during the refuge stay in 2025, and the clusters after December 2025 and June 2026. The January comment to her teacher and the tearful mornings in May 2025 fit the same shape. This is a prompt for the CPPM, not a conclusion about cause: attendance and presentation at school are an early signal for this family and should be reported to the core group each time.',
  });

  // ----- Connector inbox: events awaiting review -----
  makeConnectorEvent(ctx, { id: 'cev_docherty_lily', connectorId: 'seemis', agency: 'education', subjectId: lily.id, receivedAt: at('2026-09-01', '17:05'), externalRef: 'SEEMIS-ATT-2026-08-LD', sourcePayload: { pupil: 'DOCHERTY, Lily', stage: 'P3', period: 'Aug 2026', possible: '11', attended: '8', unauthorised: '2', authorised: '1', pattern: 'Mon 24, Tue 25 (unauthorised); Wed 26 late' }, mapped: { eventType: 'education.attendance', title: 'Attendance 73 percent in the first two weeks of P3 (absent 24 and 25 Aug)', detail: 'Two unauthorised absences on the Monday and Tuesday after the incident of 22 Aug, and a late arrival on the Wednesday.', occurredAt: at('2026-08-31', '00:00'), hasTime: false, significance: 'moderate', mappingRule: 'seemis.attendance.monthly' } });
  makeConnectorEvent(ctx, { id: 'cev_docherty_kayleigh', connectorId: 'ivpd', agency: 'police', subjectId: kayleigh.id, receivedAt: at('2026-09-01', '23:40'), externalRef: 'IVPD-DI-2026-09-0102', sourcePayload: { type: 'Domestic incident (intelligence)', victim: 'DOCHERTY, Kayleigh', accused: 'KERR, Ryan', location: '8 Harbour Brae, Ardvale', summary: 'Caller reports a car matching the accused\'s slowing outside the address twice between 20:30 and 21:15. Not seen by officers. Bail breach not established.', crime: 'None recorded' }, mapped: { eventType: 'police.incident', title: 'Report of Ryan Kerr\'s car outside 8 Harbour Brae (possible bail breach, not established)', detail: 'Kayleigh reported a silver car like Ryan Kerr\'s slowing outside the house twice on the evening of 1 Sep. Officers attended at 21:40; nothing seen. Logged as intelligence; bail breach not established.', occurredAt: at('2026-09-01', '21:15'), hasTime: true, significance: 'high', mappingRule: 'ivpd.domestic-incident.bail-context' } });
}
