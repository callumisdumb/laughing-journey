import { officialSensitive } from '@mas/domain';
/**
 * Scenario 4: Aiden Boyle, 7, Craiglarrick. Child protection from a school concern through IRD,
 * JII, CPPM, registration and core group. The integrated chronology is the hero here.
 */
import type { Agency, Process } from '@mas/domain';
import type { BuildContext } from '../../generator/context';
import { at, makeAction, makeAddress, makeAnalysis, makeConnectorEvent, makeEvent, makeLawfulBasis, makeMeeting, makePerson, makePlan, makeShare, makeViews, relate, syntheticChi } from '../../generator/factory';
import { USR, userName } from '../../generator/organisations';

export const AIDEN = {
  aiden: 'per_aiden_boyle',
  stacey: 'per_stacey_boyle',
  craig: 'per_craig_torrance',
  kevin: 'per_kevin_boyle',
  agnes: 'per_agnes_rennie',
  maisie: 'per_maisie_boyle',
  process: 'prc_cp_aiden',
  ird: 'mtg_aiden_ird',
  cppm: 'mtg_aiden_cppm',
  coreGroup1: 'mtg_aiden_cg1',
  coreGroup2: 'mtg_aiden_cg2',
  coreGroup3: 'mtg_aiden_cg3',
  review: 'mtg_aiden_review',
  interimPlan: 'pln_aiden_interim',
  childsPlan: 'pln_aiden_childs_plan',
} as const;

export function seedAidenBoyle(ctx: BuildContext): void {
  const name = (id: string) => userName(ctx, id);
  const nowIso = ctx.nowIso;

  // Addresses: three moves.
  const ardvale = makeAddress(ctx, { id: 'adr_aiden_1', line1: '4 Cross Wynd', town: 'Ardvale', postcode: 'QX1 4JD' });
  const auchentorran = makeAddress(ctx, { id: 'adr_aiden_2', line1: '27 Weavers Gait', line2: 'Flat 2/1', town: 'Auchentorran', postcode: 'QX2 7LN' });
  const craiglarrick = makeAddress(ctx, { id: 'adr_aiden_3', line1: '12 Brae Wynd', town: 'Craiglarrick', postcode: 'QX5 3RT' });
  const agnesHome = makeAddress(ctx, { id: 'adr_agnes', line1: '9 Schoolhouse Loan', town: 'Craiglarrick', postcode: 'QX5 1AB' });
  const kevinHome = makeAddress(ctx, { id: 'adr_kevin', line1: '61 Station Brae', town: 'Auchentorran', postcode: 'QX2 9PL' });

  const hh = 'hh_boyle';
  const history = [
    { addressId: ardvale.id, from: '2019-03-14', to: '2022-02-10' },
    { addressId: auchentorran.id, from: '2022-02-10', to: '2024-01-19' },
    { addressId: craiglarrick.id, from: '2024-01-19' },
  ];

  const aiden = makePerson(ctx, {
    id: AIDEN.aiden,
    givenName: 'Aiden',
    familyName: 'Boyle',
    preferredName: 'Aidy',
    sex: 'male',
    lifeStage: 'child',
    dateOfBirth: '2019-03-14',
    chi: syntheticChi(ctx, '2019-03-14', 'male'),
    addressHistory: history,
    householdId: hh,
    gpPractice: 'Craiglarrick Health Centre',
    school: 'Ardvale Primary',
    alerts: [{ id: 'alt_aiden_cp', kind: 'cp-register', text: 'On the Child Protection Register since 12 Jun 2026 (emotional abuse, physical abuse)', from: '2026-06-12' }],
    createdAt: at('2019-03-15', '10:00'),
  });
  const stacey = makePerson(ctx, {
    id: AIDEN.stacey,
    givenName: 'Stacey',
    familyName: 'Boyle',
    sex: 'female',
    dateOfBirth: '1997-06-02',
    chi: syntheticChi(ctx, '1997-06-02', 'female'),
    addressHistory: history,
    householdId: hh,
    gpPractice: 'Craiglarrick Health Centre',
    contact: { phone: '07700 900111' },
    createdAt: at('2019-03-15', '10:00'),
  });
  const craig = makePerson(ctx, {
    id: AIDEN.craig,
    givenName: 'Craig',
    familyName: 'Torrance',
    sex: 'male',
    dateOfBirth: '1995-01-22',
    chi: syntheticChi(ctx, '1995-01-22', 'male'),
    addressHistory: [{ addressId: craiglarrick.id, from: '2024-06-01', to: '2026-05-21', note: 'Left the household under the interim safety plan' }],
    alerts: [{ id: 'alt_craig_bail', kind: 'other', text: 'Bail condition: not to approach 12 Brae Wynd or Aiden Boyle (23 May 2026)', from: '2026-05-23' }],
    createdAt: at('2023-09-02', '10:00'),
  });
  const kevin = makePerson(ctx, {
    id: AIDEN.kevin,
    givenName: 'Kevin',
    familyName: 'Boyle',
    sex: 'male',
    dateOfBirth: '1993-11-08',
    chi: syntheticChi(ctx, '1993-11-08', 'male'),
    addressHistory: [{ addressId: kevinHome.id, from: '2022-03-01' }],
    createdAt: at('2019-03-15', '10:00'),
  });
  const agnes = makePerson(ctx, {
    id: AIDEN.agnes,
    givenName: 'Agnes',
    familyName: 'Rennie',
    sex: 'female',
    dateOfBirth: '1968-04-30',
    chi: syntheticChi(ctx, '1968-04-30', 'female'),
    addressHistory: [{ addressId: agnesHome.id, from: '2010-08-01' }],
    contact: { phone: '07700 900222' },
    createdAt: at('2021-06-10', '10:00'),
  });
  const maisie = makePerson(ctx, {
    id: AIDEN.maisie,
    givenName: 'Maisie',
    familyName: 'Boyle',
    sex: 'female',
    lifeStage: 'child',
    dateOfBirth: '2023-04-18',
    chi: syntheticChi(ctx, '2023-04-18', 'female'),
    addressHistory: history.slice(1).map((h) => ({ ...h, from: h.from < '2023-04-18' ? '2023-04-18' : h.from })),
    householdId: hh,
    gpPractice: 'Craiglarrick Health Centre',
    createdAt: at('2023-04-19', '10:00'),
  });

  ctx.data.households.push({ id: hh, synthetic: true, addressId: craiglarrick.id, memberIds: [stacey.id, aiden.id, maisie.id], label: 'Boyle household, Craiglarrick' });
  relate(ctx, stacey.id, aiden.id, 'mother-of');
  relate(ctx, kevin.id, aiden.id, 'father-of', { notes: 'Separated from Stacey in 2022; sees Aiden most weekends' });
  relate(ctx, stacey.id, maisie.id, 'mother-of');
  relate(ctx, craig.id, maisie.id, 'father-of');
  relate(ctx, craig.id, stacey.id, 'partner-of', { from: '2023-01-15', notes: 'Relationship ongoing; not living together since 21 May 2026' });
  relate(ctx, craig.id, aiden.id, 'step-parent-of', { from: '2024-06-01' });
  relate(ctx, aiden.id, maisie.id, 'sibling-of');
  relate(ctx, agnes.id, stacey.id, 'parent-of');
  relate(ctx, agnes.id, aiden.id, 'grandparent-of', { notes: 'Maternal grandmother; overnight stays at weekends under the child\'s plan' });
  relate(ctx, agnes.id, maisie.id, 'grandparent-of');

  const sw = USR.janetKerr;
  const ds = USR.paulMackay;
  const cpn = USR.fionaRoss;
  const head = USR.claireCowan;
  const hv = USR.sunitaRao;
  const tl = USR.anneHendry;
  const chair = USR.davidLaird;
  const minutes = USR.lesleyMorton;
  const reporter = USR.islaCrawford;
  const gp = USR.amiraFarouk;

  const lb = makeLawfulBasis(ctx, {
    id: 'lb_aiden_cp',
    purpose: 'Child protection inquiry and planning for Aiden Boyle',
    article6: '6(1)(e) public task',
    article9Condition: '9(2)(g) substantial public interest, DPA 2018 Sch 1 Pt 2 para 18 (safeguarding)',
    article10Criminal: 'DPA 2018 s10 and Sch 1',
    statutoryGateway: ['Children (Scotland) Act 1995', 'National Guidance for Child Protection in Scotland 2021', 'Children and Young People (Scotland) Act 2014'],
    necessityAndProportionality: 'Sharing across social work, police, health and education is necessary to assess and reduce the risk of significant harm to Aiden and Maisie. Only events relevant to that risk are included in the integrated chronology.',
    consentStatus: 'not-sought-risk',
    consentNote: 'Consent not sought from Stacey Boyle at IRD because it could jeopardise the criminal investigation; she was informed after the JII.',
    authorisedByUserId: tl,
    authorisedByName: name(tl),
    informationSharingAgreementRef: 'Clydeshore CPC ISA 2024/03',
    dpiaRef: 'DPIA-CP-2024-07',
    createdAt: at('2026-05-20', '11:30'),
  });

  const process: Process = {
    id: AIDEN.process,
    synthetic: true,
    type: 'cp',
    reference: 'CP-2026-0412',
    title: 'Child protection: Aiden Boyle',
    subjectIds: [aiden.id],
    leadAgency: 'social-work',
    leadUserId: sw,
    stage: 'childs-plan',
    stageHistory: [
      { stage: 'concern', at: at('2026-05-20', '09:40'), byUserId: head, byName: name(head), note: 'Bruising to upper arm and disclosure to class teacher' },
      { stage: 'ird', at: at('2026-05-20', '11:30'), byUserId: tl, byName: name(tl), note: 'IRD held same day' },
      { stage: 'investigation', at: at('2026-05-20', '13:00'), byUserId: sw, byName: name(sw), note: 'Joint investigation opened' },
      { stage: 'cppm', at: at('2026-06-12', '10:00'), byUserId: chair, byName: name(chair), note: 'Initial CPPM held' },
      { stage: 'childs-plan', at: at('2026-06-12', '12:15'), byUserId: chair, byName: name(chair), note: 'Registered; child\'s plan agreed; core group set up' },
    ],
    status: 'open',
    classification: officialSensitive(),
    accessRestriction: 'none',
    openedAt: at('2026-05-20', '09:40'),
    members: [
      { userId: sw, caseRole: 'allocated social worker and lead professional', agency: 'social-work', since: '2026-05-20', reason: 'Allocated at IRD' },
      { userId: tl, caseRole: 'team leader (IRD decision maker)', agency: 'social-work', since: '2026-05-20', reason: 'Social work senior at IRD' },
      { userId: ds, caseRole: 'investigating officer', agency: 'police', since: '2026-05-20', reason: 'Police decision maker at IRD; criminal investigation' },
      { userId: cpn, caseRole: 'child protection nurse adviser', agency: 'health', since: '2026-05-20', reason: 'Health decision maker at IRD; arranged medical' },
      { userId: head, caseRole: 'named person and school CP lead', agency: 'education', since: '2026-05-20', reason: 'Raised the concern; school-age child' },
      { userId: hv, caseRole: 'health visitor (Maisie)', agency: 'health', since: '2026-06-12', reason: 'Core group member for the sibling' },
      { userId: chair, caseRole: 'chair', agency: 'social-work', since: '2026-06-01', reason: 'Independent chair of the CPPM' },
      { userId: minutes, caseRole: 'minute taker', agency: 'social-work', since: '2026-06-01', reason: 'Minutes and distribution' },
    ],
    clocks: [
      { id: 'clk_aiden_cppm', ruleId: 'cp.cppm.initial', triggeredAt: at('2026-05-20', '11:30'), completedAt: at('2026-06-12', '10:00'), note: 'CPPM held on day 23' },
      { id: 'clk_aiden_cg', ruleId: 'cp.coregroup.first', triggeredAt: at('2026-06-12', '10:00'), completedAt: at('2026-07-01', '14:00'), note: 'First core group on 1 Jul' },
      { id: 'clk_aiden_review', ruleId: 'cp.cppm.review.first', triggeredAt: at('2026-06-12', '10:00'), note: 'Statutory maximum 6 months. The review was brought forward to 14 Sep by the CPPM decision because the plan depends on separation being maintained' },
      { id: 'clk_aiden_notice', ruleId: 'cp.cppm.notice', triggeredAt: at('2026-09-14', '10:00'), note: 'Notice of the review CPPM to the family and invitees: counts back from the meeting date' },
      { id: 'clk_aiden_record', ruleId: 'cp.cppm.record.distribute', triggeredAt: at('2026-06-12', '10:00'), completedAt: at('2026-06-19', '15:00'), note: 'Record of the initial CPPM distributed on working day 5' },
      { id: 'clk_aiden_escalate', ruleId: 'cp.coregroup.escalate', triggeredAt: at('2026-08-05', '14:00'), completedAt: at('2026-08-07', '11:00'), note: 'Core group 2 could not agree on contact; escalated to the chair on 7 Aug' },
    ],
    linkedProcessIds: [],
    viewsRecordIds: ['vw_aiden_1', 'vw_aiden_2', 'vw_aiden_3', 'vw_aiden_parents'],
    riskAssessmentIds: [],
    flags: { schoolAge: true, jii: true, housingRelevant: false, preSchool: false },
    parties: [],
    detail: {
      concern: {
        receivedAt: at('2026-05-20', '09:40'),
        source: 'Class teacher via head teacher, Ardvale Primary',
        sourceAgency: 'education',
        sourceReference: 'SEEMIS pastoral note 20 May 2026',
        summary: 'Aiden showed his class teacher bruising to his left upper arm and said "Craig grabbed me because I would not go to bed". Four finger-shaped marks, yellow-purple, consistent with a grip.',
      },
      proceduresInitiatedAt: at('2026-05-20', '11:30'),
      ird: {
        meetingId: AIDEN.ird,
        heldAt: at('2026-05-20', '11:30'),
        outOfHours: false,
        participants: [
          { agency: 'social-work', name: name(tl), role: 'Team leader (decision maker)', userId: tl },
          { agency: 'police', name: `DS ${name(ds)}`, role: 'Detective sergeant, PPU', userId: ds },
          { agency: 'health', name: name(cpn), role: 'Child protection nurse adviser', userId: cpn },
          { agency: 'education', name: name(head), role: 'Head teacher, named person', userId: head },
        ],
        contributions: [
          { agency: 'education', byName: name(head), byUserId: head, at: at('2026-05-20', '11:35'), summary: 'Disclosure this morning. Attendance 82 percent this session. Often tired and hungry. Craig Torrance collects Aiden two days a week.' },
          { agency: 'police', byName: `DS ${name(ds)}`, byUserId: ds, at: at('2026-05-20', '11:40'), summary: 'Three concern reports on the household since 2020, most recently March 2025 (shouting, drug paraphernalia). Craig Torrance known for a 2019 breach of the peace. No child protection history.' },
          { agency: 'health', byName: name(cpn), byUserId: cpn, at: at('2026-05-20', '11:45'), summary: 'Emergency department attendance in January 2026 with a minor head injury after a fall at home. Health visitor has noted missed contacts for Maisie.' },
          { agency: 'social-work', byName: name(tl), byUserId: tl, at: at('2026-05-20', '11:50'), summary: 'Two previous referrals (2021, 2025) closed with support. Mother engaged with recovery service in 2025 then disengaged.' },
        ],
        decisions: {
          significantHarm: { decided: true, decision: 'Yes. Aiden is at risk of significant harm; Maisie is also considered at risk in the same household.', rationale: 'Physical injury with a clear disclosure naming the mother\'s partner, on a background of cumulative concerns about substance use, attendance and missed health contacts.', at: at('2026-05-20', '12:00'), byName: name(tl), byUserId: tl },
          investigationNeeded: { decided: true, decision: 'Yes. Joint child protection investigation.', rationale: 'Disclosure of an assault by an adult in the household.', at: at('2026-05-20', '12:00'), byName: name(tl), byUserId: tl },
          jii: { decided: true, decision: 'Yes. Joint Investigative Interview under the Scottish Child Interview Model on 22 May.', rationale: 'Aiden has made a clear verbal disclosure and is able to give an account.', plannerName: `DS ${name(ds)}`, informedBy: `${name(head)} (knows Aiden well; advised on communication and timing)`, at: at('2026-05-20', '12:05'), byName: `DS ${name(ds)}`, byUserId: ds },
          medical: { decided: true, decision: 'Comprehensive medical on 21 May with the on-call paediatrician; JPFE not indicated.', rationale: 'Bruising needs documenting and other injuries excluded; no sexual harm alleged.', kind: 'comprehensive', consentBy: 'Stacey Boyle (mother)', when: at('2026-05-21', '14:00'), at: at('2026-05-20', '12:05'), byName: name(cpn), byUserId: cpn },
          emergencyMeasures: { decided: true, decision: 'No emergency order. Interim safety plan: Craig Torrance to leave the household today; mother agrees.', rationale: 'Mother is protective on initial contact and agrees to the plan. Police will interview Craig Torrance today.', measure: 'none', at: at('2026-05-20', '12:10'), byName: name(tl), byUserId: tl },
          reporterReferral: { decided: true, decision: 'Not at this stage. Reconsider at the CPPM.', rationale: 'Compulsory measures not yet indicated; the investigation and interim plan come first.', at: at('2026-05-20', '12:10'), byName: name(tl), byUserId: tl },
          parentsInformed: { decided: true, decision: 'Mother informed today of the concern and the interim plan. Craig Torrance not told about the JII until interviewed by police.', rationale: 'Telling Craig Torrance before interview could jeopardise the criminal investigation.', withheld: 'JII timing and content withheld from Craig Torrance', at: at('2026-05-20', '12:12'), byName: name(tl), byUserId: tl },
        },
        siblingsConsidered: [maisie.id],
        interimSafetyPlanId: AIDEN.interimPlan,
        childViewsSought: 'Aiden was spoken to alone by his class teacher this morning and will be seen by the social worker after school. His views will be sought at the JII on 22 May.',
      },
      investigation: {
        openedAt: at('2026-05-20', '13:00'),
        jiiHeldAt: at('2026-05-22', '10:00'),
        jiiModel: 'SCIM',
        medicalHeldAt: at('2026-05-21', '14:00'),
        summary: 'JII: Aiden described being grabbed by the arm and pushed towards the stairs by Craig on 18 May, and shouting "most nights". Medical: four oval bruises consistent with a grip, no other injuries. Craig Torrance charged with assault on 23 May; bail conditions not to approach the address or Aiden.',
      },
      cppm: { meetingId: AIDEN.cppm, heldAt: at('2026-06-12', '10:00'), decision: 'register', rationale: 'Ongoing risk of emotional and physical harm; mother\'s capacity to protect depends on maintaining separation from Craig Torrance and engaging with support.' },
      // The 2021 guidance does not require a category of registration, so the meeting recorded its concerns.
      register: { registeredAt: '2026-06-12', concerns: ['emotional-abuse', 'physical-abuse', 'domestic-abuse'] },
      coreGroup: { memberUserIds: [sw, head, hv, ds], leadProfessionalUserId: sw, namedPersonUserId: head, firstMeetingAt: at('2026-07-01', '14:00') },
      childsPlanId: AIDEN.childsPlan,
    },
  };
  ctx.data.processes.push(process);

  // ----- Views and voice -----
  makeViews(ctx, { id: 'vw_aiden_1', personId: aiden.id, processId: process.id, kind: 'child-voice', recordedAt: at('2026-05-22', '11:15'), recordedByUserId: ds, recordedByName: `DS ${name(ds)}`, recordedByAgency: 'police', method: 'Joint Investigative Interview (SCIM)', content: 'Craig grabbed my arm really hard and pushed me to the stairs. He shouts most nights. I want him to stop shouting at Mum.' });
  makeViews(ctx, { id: 'vw_aiden_2', personId: aiden.id, processId: process.id, kind: 'child-voice', recordedAt: at('2026-06-10', '15:30'), recordedByUserId: sw, recordedByName: name(sw), recordedByAgency: 'social-work', method: 'In person after school, with drawing', content: 'I like school and my gran\'s house. I like it when it is just me, Mum and Maisie. I do not want Craig to come back.' , sharingPreference: 'Aiden asked that Craig is not told what he said.' });
  makeViews(ctx, { id: 'vw_aiden_3', personId: aiden.id, processId: process.id, kind: 'child-voice', recordedAt: at('2026-08-20', '16:00'), recordedByUserId: sw, recordedByName: name(sw), recordedByAgency: 'social-work', method: 'In person at home, three wishes exercise', content: 'Wish one: stay at my school. Wish two: Gran picks me up on Fridays. Wish three: Mum stops being sad.' });
  makeViews(ctx, { id: 'vw_aiden_parents', personId: stacey.id, processId: process.id, kind: 'family-views', recordedAt: at('2026-06-11', '10:00'), recordedByUserId: sw, recordedByName: name(sw), recordedByAgency: 'social-work', method: 'Pre-CPPM meeting at home', content: 'Stacey: "I did not see what happened but I believe Aiden. I have told Craig he cannot come back until this is sorted. I want help with my anxiety and I will go back to the recovery service." Kevin (father, by phone): "I want more contact. I can have Aiden every weekend."' });

  // ----- Plans -----
  makePlan(ctx, { id: AIDEN.interimPlan, processId: process.id, type: 'interim-safety', title: 'Interim safety plan (IRD 20 May 2026)', outcomes: [{ id: 'out_aiden_isp_1', text: 'Aiden and Maisie are safe from physical harm at home', actionIds: ['act_aiden_isp_1', 'act_aiden_isp_2', 'act_aiden_isp_3'] }], coordinatorUserId: sw, coordinatorName: name(sw), agreedAt: '2026-05-20', reviewDate: '2026-06-12', status: 'ended' });
  makeAction(ctx, { id: 'act_aiden_isp_1', processId: process.id, meetingId: AIDEN.ird, planId: AIDEN.interimPlan, title: 'Craig Torrance to leave the household today; mother to confirm by phone by 18:00', ownerUserId: sw, ownerName: name(sw), ownerAgency: 'social-work', due: '2026-05-20', status: 'complete', completedAt: at('2026-05-20', '17:40'), evidence: 'Mother confirmed by phone at 17:40; police visit at 19:00 confirmed', createdAt: at('2026-05-20', '12:15'), createdByName: name(tl) });
  makeAction(ctx, { id: 'act_aiden_isp_2', processId: process.id, meetingId: AIDEN.ird, planId: AIDEN.interimPlan, title: 'School: only Stacey Boyle or Agnes Rennie may collect Aiden', ownerUserId: head, ownerName: name(head), ownerAgency: 'education', due: '2026-05-20', status: 'complete', completedAt: at('2026-05-20', '13:30'), evidence: 'Office and class teacher briefed; SEEMIS collection note updated', createdAt: at('2026-05-20', '12:15'), createdByName: name(tl) });
  makeAction(ctx, { id: 'act_aiden_isp_3', processId: process.id, meetingId: AIDEN.ird, planId: AIDEN.interimPlan, title: 'Social work visit daily until the JII, then twice weekly until the CPPM', ownerUserId: sw, ownerName: name(sw), ownerAgency: 'social-work', due: '2026-06-12', status: 'complete', completedAt: at('2026-06-12', '09:00'), evidence: 'Visits recorded 20, 21, 22, 26, 29 May, 2, 5, 9 June', createdAt: at('2026-05-20', '12:15'), createdByName: name(tl) });

  makePlan(ctx, {
    id: AIDEN.childsPlan,
    processId: process.id,
    type: 'childs-plan',
    title: "Aiden's child's plan (CPPM 12 Jun 2026)",
    outcomes: [
      { id: 'out_aiden_1', text: 'Aiden is safe at home and Craig Torrance has no contact with him', actionIds: ['act_aiden_1', 'act_aiden_6'] },
      { id: 'out_aiden_2', text: 'Aiden attends school every day and arrives fed and rested', actionIds: ['act_aiden_3'] },
      { id: 'out_aiden_3', text: 'Stacey has support for her mental health and substance use', actionIds: ['act_aiden_4'] },
      { id: 'out_aiden_4', text: 'Aiden and Maisie have regular time with Agnes and with Kevin', actionIds: ['act_aiden_5'] },
      { id: 'out_aiden_5', text: 'Maisie\'s health and development are on track', actionIds: ['act_aiden_2'] },
    ],
    coordinatorUserId: sw,
    coordinatorName: name(sw),
    agreedAt: '2026-06-12',
    reviewDate: '2026-09-14',
    status: 'active',
  });
  const actions = [
    { id: 'act_aiden_1', title: 'Social work home visits weekly until the first core group, then fortnightly; see Aiden alone each visit', owner: sw, agency: 'social-work' as Agency, due: '2026-09-14', status: 'in-progress' as const, evidence: 'Visits on 17, 24 Jun, 1, 15, 29 Jul, 12, 26 Aug' },
    { id: 'act_aiden_2', title: 'Health visitor visits fortnightly for Maisie; developmental review by 31 Aug', owner: hv, agency: 'health' as Agency, due: '2026-08-31', status: 'complete' as const, completedAt: at('2026-08-27', '11:00'), evidence: '27 to 30 month review completed 27 Aug; speech slightly delayed, referred to speech and language therapy' },
    { id: 'act_aiden_3', title: 'Daily check-in with Aiden by his class teacher; attendance reported to the core group each meeting', owner: head, agency: 'education' as Agency, due: '2026-09-14', status: 'in-progress' as const, evidence: 'Attendance 96 percent since June' },
    { id: 'act_aiden_4', title: 'Stacey to re-engage with Clydeshore Recovery Service and attend the first appointment', owner: sw, agency: 'social-work' as Agency, due: '2026-08-15', status: 'open' as const, evidence: undefined },
    { id: 'act_aiden_5', title: 'Agnes Rennie to have Aiden and Maisie on Friday and Saturday nights; Kevin Boyle to have Aiden on Sundays', owner: sw, agency: 'social-work' as Agency, due: '2026-07-01', status: 'complete' as const, completedAt: at('2026-06-27', '10:00'), evidence: 'Pattern in place since 20 June; Kevin has kept every Sunday' },
    { id: 'act_aiden_6', title: 'Police to confirm bail status and court date, and report any breach to the lead professional the same day', owner: ds, agency: 'police' as Agency, due: '2026-09-09', status: 'in-progress' as const, evidence: 'Trial diet set for 6 Oct 2026; no breaches reported' },
  ];
  for (const a of actions) {
    makeAction(ctx, { id: a.id, processId: process.id, meetingId: AIDEN.cppm, planId: AIDEN.childsPlan, title: a.title, ownerUserId: a.owner, ownerName: name(a.owner), ownerAgency: a.agency, due: a.due, status: a.status, completedAt: 'completedAt' in a ? a.completedAt : undefined, evidence: a.evidence, createdAt: at('2026-06-12', '12:00'), createdByName: name(chair) });
  }

  // ----- Meetings -----
  const invitees = (present: boolean) => [
    { userId: tl, name: name(tl), agency: 'social-work' as Agency, role: 'Team leader', required: true, attendance: present ? ('present' as const) : ('accepted' as const), reason: 'Social work senior', needToKnowRowId: 'cp.ird.sw' },
    { userId: ds, name: `DS ${name(ds)}`, agency: 'police' as Agency, role: 'Detective sergeant, PPU', required: true, attendance: present ? ('present' as const) : ('accepted' as const), reason: 'Police decision maker', needToKnowRowId: 'cp.ird.ds' },
    { userId: cpn, name: name(cpn), agency: 'health' as Agency, role: 'Child protection nurse adviser', required: true, attendance: present ? ('present' as const) : ('accepted' as const), reason: 'Health decision maker', needToKnowRowId: 'cp.ird.health' },
    { userId: head, name: name(head), agency: 'education' as Agency, role: 'Head teacher', required: true, attendance: present ? ('present' as const) : ('accepted' as const), reason: 'School-age child; referrer', needToKnowRowId: 'cp.ird.education' },
  ];

  makeMeeting(ctx, {
    id: AIDEN.ird,
    type: 'ird',
    processId: process.id,
    subjectIds: [aiden.id, maisie.id],
    title: 'IRD: Aiden Boyle',
    scheduledAt: at('2026-05-20', '11:30'),
    endsAt: at('2026-05-20', '12:15'),
    location: 'Teams call (Ardvale PPU host)',
    status: 'held',
    chairUserId: tl,
    chairName: name(tl),
    invitees: invitees(true),
    agenda: [
      { id: 'ag_ird_1', order: 1, title: 'Concern and immediate safety', status: 'done' },
      { id: 'ag_ird_2', order: 2, title: 'Information from each agency', status: 'done' },
      { id: 'ag_ird_3', order: 3, title: 'Decisions: significant harm, investigation, JII, medical', status: 'done' },
      { id: 'ag_ird_4', order: 4, title: 'Interim safety plan and information to parents', status: 'done' },
      { id: 'ag_ird_5', order: 5, title: 'Referral to the Reporter', status: 'done' },
    ],
    informationShared: [
      { id: 'is_ird_1', agency: 'education', byName: name(head), byUserId: head, at: at('2026-05-20', '11:35'), summary: 'Disclosure and bruising seen at 09:20. Attendance 82 percent. Collection arrangements.', relevance: 'Source of concern; pattern of tiredness and hunger', linkedEventIds: [] },
      { id: 'is_ird_2', agency: 'police', byName: `DS ${name(ds)}`, byUserId: ds, at: at('2026-05-20', '11:40'), summary: 'Three concern reports since 2020; March 2025 report includes drug paraphernalia. Craig Torrance: 2019 breach of the peace.', relevance: 'Household risk and adult of concern', linkedEventIds: [] },
      { id: 'is_ird_3', agency: 'health', byName: name(cpn), byUserId: cpn, at: at('2026-05-20', '11:45'), summary: 'January 2026 head injury attendance; missed health visitor contacts for Maisie.', relevance: 'Possible earlier injury; sibling risk', linkedEventIds: [] },
      { id: 'is_ird_4', agency: 'social-work', byName: name(tl), byUserId: tl, at: at('2026-05-20', '11:50'), summary: 'Referrals in 2021 and 2025, closed with support. Recovery service disengagement September 2025.', relevance: 'Cumulative history', linkedEventIds: [] },
    ],
    decisions: [
      { id: 'dec_ird_1', question: 'Is Aiden at risk of significant harm?', decision: 'Yes, and Maisie is considered at risk in the same household', rationale: 'Injury with a clear disclosure on a background of cumulative concerns', dissent: [], decidedByName: name(tl), decidedByUserId: tl, decidedAt: at('2026-05-20', '12:00') },
      { id: 'dec_ird_2', question: 'Is a JII needed?', decision: 'Yes, 22 May under SCIM, planned by DS Mackay with advice from the head teacher', rationale: 'Clear verbal disclosure from a child able to give an account', dissent: [], decidedByName: `DS ${name(ds)}`, decidedByUserId: ds, decidedAt: at('2026-05-20', '12:05') },
      { id: 'dec_ird_3', question: 'Is a medical needed?', decision: 'Comprehensive medical 21 May; JPFE not indicated', rationale: 'Document bruising and exclude other injury', dissent: [], decidedByName: name(cpn), decidedByUserId: cpn, decidedAt: at('2026-05-20', '12:05') },
      { id: 'dec_ird_4', question: 'Emergency measures?', decision: 'No order. Interim safety plan with Craig Torrance leaving today', rationale: 'Mother protective and agrees; police to interview Craig today', dissent: [{ byName: `DS ${name(ds)}`, byUserId: ds, agency: 'police', text: 'Police would have preferred a written undertaking from the mother the same day; accepted the plan with a police visit at 19:00.' }], decidedByName: name(tl), decidedByUserId: tl, decidedAt: at('2026-05-20', '12:10') },
      { id: 'dec_ird_5', question: 'Referral to the Reporter?', decision: 'Not at this stage; reconsider at CPPM', rationale: 'Compulsory measures not yet indicated', dissent: [], decidedByName: name(tl), decidedByUserId: tl, decidedAt: at('2026-05-20', '12:10') },
    ],
    actionIds: ['act_aiden_isp_1', 'act_aiden_isp_2', 'act_aiden_isp_3'],
    viewsRecordIds: [],
    minute: { status: 'distributed', draftedAt: at('2026-05-20', '14:00'), approvedAt: at('2026-05-20', '16:30'), distributedAt: at('2026-05-20', '16:45') },
    distribution: [
      { id: 'dist_ird_1', recipientName: name(sw), recipientUserId: sw, agency: 'social-work', role: 'Allocated social worker', detailLevel: 'full', reason: 'Lead professional', sharingRecordId: 'shr_aiden_1' },
      { id: 'dist_ird_2', recipientName: name(reporter), recipientUserId: reporter, agency: 'scra', role: "Children's Reporter", detailLevel: 'summary', reason: 'Referral decision recorded', sharingRecordId: 'shr_aiden_2' },
      { id: 'dist_ird_3', recipientName: name(USR.fionaLyle), recipientUserId: USR.fionaLyle, agency: 'court', role: 'Procurator fiscal', detailLevel: 'summary', reason: 'JII planned', sharingRecordId: 'shr_aiden_3' },
    ],
    reviewDate: '2026-06-12',
  });

  makeMeeting(ctx, {
    id: AIDEN.cppm,
    type: 'cppm',
    processId: process.id,
    subjectIds: [aiden.id],
    title: 'Initial CPPM: Aiden Boyle',
    scheduledAt: at('2026-06-12', '10:00'),
    endsAt: at('2026-06-12', '12:15'),
    location: 'Ardvale Civic Centre, room 2.4',
    status: 'held',
    chairUserId: chair,
    chairName: name(chair),
    minuteTakerUserId: minutes,
    minuteTakerName: name(minutes),
    invitees: [
      ...invitees(true),
      { userId: sw, name: name(sw), agency: 'social-work', role: 'Allocated social worker', required: true, attendance: 'present', reason: 'Lead professional', needToKnowRowId: 'cp.cppm.chair' },
      { userId: hv, name: name(hv), agency: 'health', role: 'Health visitor', required: true, attendance: 'present', reason: 'Named person for Maisie', needToKnowRowId: 'cp.plan.np' },
      { userId: gp, name: `Dr ${name(gp)}`, agency: 'health', role: 'GP', required: false, attendance: 'apologies', reason: 'Report submitted', needToKnowRowId: 'cp.cppm.gp' },
      { name: 'Stacey Boyle', agency: 'social-work', role: 'Mother', required: true, attendance: 'present', reason: 'Parent; not excluded' },
      { name: 'Kevin Boyle', agency: 'social-work', role: 'Father', required: true, attendance: 'remote', reason: 'Parent; joined by phone' },
    ],
    agenda: [
      { id: 'ag_cppm_1', order: 1, title: 'Introductions, purpose and confidentiality', status: 'done' },
      { id: 'ag_cppm_2', order: 2, title: "Aiden's views", status: 'done' },
      { id: 'ag_cppm_3', order: 3, title: 'Reports and integrated chronology', status: 'done' },
      { id: 'ag_cppm_4', order: 4, title: "Parents' views", status: 'done' },
      { id: 'ag_cppm_5', order: 5, title: 'Analysis of risk and protective factors', status: 'done' },
      { id: 'ag_cppm_6', order: 6, title: 'Registration decision', status: 'done' },
      { id: 'ag_cppm_7', order: 7, title: "Child's plan, core group and review date", status: 'done' },
    ],
    preMeetingRequests: [
      { id: 'pmr_cppm_1', agency: 'education', toName: name(head), toUserId: head, sentAt: at('2026-06-01', '09:00'), dueAt: '2026-06-09', status: 'returned', returnSummary: 'School report: attendance, presentation, relationships, disclosure record', returnedAt: at('2026-06-08', '15:00') },
      { id: 'pmr_cppm_2', agency: 'health', toName: name(hv), toUserId: hv, sentAt: at('2026-06-01', '09:00'), dueAt: '2026-06-09', status: 'returned', returnSummary: 'Health visitor report for Maisie: missed contacts, growth, development', returnedAt: at('2026-06-09', '10:00') },
      { id: 'pmr_cppm_3', agency: 'health', toName: `Dr ${name(gp)}`, toUserId: gp, sentAt: at('2026-06-01', '09:00'), dueAt: '2026-06-09', status: 'returned', returnSummary: 'GP report: Stacey anxiety and prescribed medication; Aiden January head injury', returnedAt: at('2026-06-10', '17:00') },
      { id: 'pmr_cppm_4', agency: 'police', toName: `DS ${name(ds)}`, toUserId: ds, sentAt: at('2026-06-01', '09:00'), dueAt: '2026-06-09', status: 'returned', returnSummary: 'Police report: charge, bail conditions, concern history', returnedAt: at('2026-06-05', '12:00') },
    ],
    pack: [
      { id: 'pk_cppm_1', kind: 'chronology', label: 'Integrated chronology, 2019 to date', windowFrom: '2019-03-14', windowTo: '2026-06-11', included: true },
      { id: 'pk_cppm_2', kind: 'report', label: 'Social work report', ref: 'sw-report-aiden-2026-06', included: true },
      { id: 'pk_cppm_3', kind: 'report', label: 'School report', ref: 'pmr_cppm_1', included: true },
      { id: 'pk_cppm_4', kind: 'report', label: 'Health visitor report (Maisie)', ref: 'pmr_cppm_2', included: true },
      { id: 'pk_cppm_5', kind: 'report', label: 'GP report', ref: 'pmr_cppm_3', included: true },
      { id: 'pk_cppm_6', kind: 'report', label: 'Police report', ref: 'pmr_cppm_4', included: true },
      { id: 'pk_cppm_7', kind: 'views', label: "Aiden's views (JII and drawing)", ref: 'vw_aiden_2', included: true },
      { id: 'pk_cppm_8', kind: 'plan', label: 'Interim safety plan', ref: AIDEN.interimPlan, included: true },
    ],
    informationShared: [
      { id: 'is_cppm_1', agency: 'social-work', byName: name(sw), byUserId: sw, at: at('2026-06-12', '10:20'), summary: 'Investigation summary, JII outcome, home visits, mother\'s engagement, Craig Torrance charged.', relevance: 'Current risk and protective capacity', linkedEventIds: [] },
      { id: 'is_cppm_2', agency: 'education', byName: name(head), byUserId: head, at: at('2026-06-12', '10:40'), summary: 'Attendance improved to 94 percent since 20 May. Aiden settled, eating at breakfast club.', relevance: 'Change since interim plan', linkedEventIds: [] },
      { id: 'is_cppm_3', agency: 'health', byName: name(hv), byUserId: hv, at: at('2026-06-12', '10:50'), summary: 'Maisie seen twice; weight on 25th centile; two missed contacts earlier in the year.', relevance: 'Sibling wellbeing', linkedEventIds: [] },
      { id: 'is_cppm_4', agency: 'police', byName: `DS ${name(ds)}`, byUserId: ds, at: at('2026-06-12', '11:00'), summary: 'Charge and bail conditions; no breach reported; court date awaited.', relevance: 'Control on the adult of concern', linkedEventIds: [] },
    ],
    decisions: [
      { id: 'dec_cppm_1', question: "Should Aiden's name be placed on the Child Protection Register?", decision: 'Yes: emotional abuse and physical abuse', rationale: 'Ongoing risk while the relationship with Craig Torrance continues; cumulative emotional harm from shouting and instability; mother\'s protective capacity is improving but untested', dissent: [], decidedByName: name(chair), decidedByUserId: chair, decidedAt: at('2026-06-12', '11:40') },
      { id: 'dec_cppm_2', question: 'Referral to the Reporter?', decision: 'No. Review at the first review CPPM', rationale: 'Family engaging on a voluntary basis; compulsory measures not currently needed', dissent: [{ byName: name(head), byUserId: head, agency: 'education', text: 'Education would have referred now given the attendance history.' }], decidedByName: name(chair), decidedByUserId: chair, decidedAt: at('2026-06-12', '11:50') },
      { id: 'dec_cppm_3', question: 'Core group and review date', decision: 'Core group: social work (lead), school, health visitor, police. First core group by 3 July. Review CPPM 14 September, brought forward from the 6 month statutory maximum', rationale: 'Early review because the plan depends on separation being maintained', dissent: [], decidedByName: name(chair), decidedByUserId: chair, decidedAt: at('2026-06-12', '12:05') },
    ],
    actionIds: actions.map((a) => a.id),
    viewsRecordIds: ['vw_aiden_2', 'vw_aiden_parents'],
    minute: { status: 'distributed', draftedAt: at('2026-06-15', '10:00'), approvedAt: at('2026-06-17', '09:00'), distributedAt: at('2026-06-17', '11:00') },
    distribution: [
      { id: 'dist_cppm_1', recipientName: 'Stacey Boyle', agency: 'social-work', role: 'Mother', detailLevel: 'full', reason: 'Parent, not excluded' },
      { id: 'dist_cppm_2', recipientName: 'Kevin Boyle', agency: 'social-work', role: 'Father', detailLevel: 'full', reason: 'Parent, not excluded' },
      { id: 'dist_cppm_3', recipientName: `Dr ${name(gp)}`, recipientUserId: gp, agency: 'health', role: 'GP', detailLevel: 'fields', fields: ['registration status', 'registration category', 'lead professional contact'], reason: 'Registration status to GP', sharingRecordId: 'shr_aiden_5' },
      { id: 'dist_cppm_4', recipientName: name(reporter), recipientUserId: reporter, agency: 'scra', role: "Children's Reporter", detailLevel: 'summary', reason: 'Referral decision recorded', sharingRecordId: 'shr_aiden_6' },
    ],
    reviewDate: '2026-09-14',
    subjectAttendance: 'Aiden did not attend (age 7); his views were read into the record by his social worker and his drawing was shown.',
  });

  const cg = (id: string, date: string, status: 'held' | 'scheduled', n: number) =>
    makeMeeting(ctx, {
      id,
      type: 'core-group',
      processId: process.id,
      subjectIds: [aiden.id],
      title: `Core group ${n}: Aiden Boyle`,
      scheduledAt: at(date, '14:00'),
      endsAt: at(date, '15:00'),
      location: 'Ardvale Primary School',
      status,
      chairUserId: sw,
      chairName: name(sw),
      invitees: [
        { userId: sw, name: name(sw), agency: 'social-work', role: 'Lead professional', required: true, attendance: status === 'held' ? 'present' : 'accepted', reason: 'Core group member' },
        { userId: head, name: name(head), agency: 'education', role: 'Named person', required: true, attendance: status === 'held' ? 'present' : 'accepted', reason: 'Core group member' },
        { userId: hv, name: name(hv), agency: 'health', role: 'Health visitor', required: true, attendance: status === 'held' ? (n === 2 ? 'apologies' : 'present') : 'accepted', reason: 'Core group member' },
        { userId: ds, name: `DS ${name(ds)}`, agency: 'police', role: 'Police', required: false, attendance: status === 'held' ? 'remote' : 'invited', reason: 'Core group member' },
        { name: 'Stacey Boyle', agency: 'social-work', role: 'Mother', required: true, attendance: status === 'held' ? 'present' : 'accepted', reason: 'Parent' },
      ],
      agenda: [
        { id: `ag_${id}_1`, order: 1, title: 'Progress against each outcome', status: status === 'held' ? 'done' : 'pending' },
        { id: `ag_${id}_2`, order: 2, title: "Aiden's views this month", status: status === 'held' ? 'done' : 'pending' },
        { id: `ag_${id}_3`, order: 3, title: 'Actions and dates', status: status === 'held' ? 'done' : 'pending' },
      ],
      decisions: status === 'held' ? [{ id: `dec_${id}_1`, question: 'Is the plan working?', decision: n === 1 ? 'Yes; separation maintained; attendance improved' : 'Mostly; recovery service appointment still not attended', rationale: 'Reports from each member', dissent: [], decidedByName: name(sw), decidedByUserId: sw, decidedAt: at(date, '14:50') }] : [],
      actionIds: actions.map((a) => a.id),
      minute: status === 'held' ? { status: 'distributed', draftedAt: at(date, '16:00'), approvedAt: at(date, '16:30'), distributedAt: at(date, '16:45') } : { status: 'not-started' },
      reviewDate: '2026-09-14',
    });
  cg(AIDEN.coreGroup1, '2026-07-01', 'held', 1);
  cg(AIDEN.coreGroup2, '2026-08-05', 'held', 2);
  cg(AIDEN.coreGroup3, '2026-09-09', 'scheduled', 3);

  makeMeeting(ctx, {
    id: AIDEN.review,
    type: 'cppm-review',
    processId: process.id,
    subjectIds: [aiden.id],
    title: 'Review CPPM: Aiden Boyle',
    scheduledAt: at('2026-09-14', '10:00'),
    endsAt: at('2026-09-14', '12:00'),
    location: 'Ardvale Civic Centre, room 2.4',
    status: 'scheduled',
    chairUserId: chair,
    chairName: name(chair),
    minuteTakerUserId: minutes,
    minuteTakerName: name(minutes),
    invitees: [
      ...invitees(false),
      { userId: sw, name: name(sw), agency: 'social-work', role: 'Lead professional', required: true, attendance: 'accepted', reason: 'Lead professional' },
      { userId: hv, name: name(hv), agency: 'health', role: 'Health visitor', required: true, attendance: 'invited', reason: 'Core group member' },
      { userId: gp, name: `Dr ${name(gp)}`, agency: 'health', role: 'GP', required: false, attendance: 'invited', reason: 'Report requested', needToKnowRowId: 'cp.cppm.gp' },
      { name: 'Stacey Boyle', agency: 'social-work', role: 'Mother', required: true, attendance: 'invited', reason: 'Parent' },
      { name: 'Kevin Boyle', agency: 'social-work', role: 'Father', required: true, attendance: 'invited', reason: 'Parent' },
    ],
    agenda: [
      { id: 'ag_rev_1', order: 1, title: 'Purpose and confidentiality', status: 'pending' },
      { id: 'ag_rev_2', order: 2, title: "Aiden's views", status: 'pending' },
      { id: 'ag_rev_3', order: 3, title: 'Progress against the plan', status: 'pending' },
      { id: 'ag_rev_4', order: 4, title: 'Registration review', status: 'pending' },
      { id: 'ag_rev_5', order: 5, title: 'Plan and next review', status: 'pending' },
    ],
    preMeetingRequests: [
      { id: 'pmr_rev_1', agency: 'education', toName: name(head), toUserId: head, sentAt: at('2026-08-31', '09:00'), dueAt: '2026-09-09', status: 'sent' },
      { id: 'pmr_rev_2', agency: 'health', toName: name(hv), toUserId: hv, sentAt: at('2026-08-31', '09:00'), dueAt: '2026-09-09', status: 'returned', returnSummary: 'Developmental review completed; SLT referral', returnedAt: at('2026-09-01', '16:00') },
      { id: 'pmr_rev_3', agency: 'health', toName: `Dr ${name(gp)}`, toUserId: gp, sentAt: at('2026-08-31', '09:00'), dueAt: '2026-09-09', status: 'sent' },
      { id: 'pmr_rev_4', agency: 'police', toName: `DS ${name(ds)}`, toUserId: ds, sentAt: at('2026-08-31', '09:00'), dueAt: '2026-09-09', status: 'sent' },
    ],
    pack: [
      { id: 'pk_rev_1', kind: 'chronology', label: 'Integrated chronology, 20 May to date', windowFrom: '2026-05-20', windowTo: '2026-09-13', included: true },
      { id: 'pk_rev_2', kind: 'report', label: 'Social work review report', included: false },
      { id: 'pk_rev_3', kind: 'views', label: "Aiden's three wishes (20 Aug)", ref: 'vw_aiden_3', included: true },
      { id: 'pk_rev_4', kind: 'plan', label: "Child's plan with progress", ref: AIDEN.childsPlan, included: true },
    ],
    actionIds: actions.map((a) => a.id),
    viewsRecordIds: ['vw_aiden_3'],
    minute: { status: 'not-started' },
  });

  // ----- Sharing records -----
  const share = (id: string, stage: Process['stage'], to: string, agency: Agency, role: string, level: 'full' | 'summary' | 'fields' | 'presence', reason: string, summary: string, createdAt: string, rowId?: string, fields?: string[]) =>
    makeShare(ctx, { id, processId: process.id, subjectId: aiden.id, stage, recipient: { userId: to, name: name(to), agency, role }, detailLevel: level, fields, lawfulBasisId: lb.id, channel: agency === 'scra' || agency === 'court' ? 'secure-email-digest' : 'in-app', status: 'read', createdAt, sentAt: createdAt, readAt: createdAt, reason, needToKnowRowId: rowId, createdByUserId: minutes, createdByName: name(minutes), summary });
  share('shr_aiden_1', 'ird', sw, 'social-work', 'Allocated social worker', 'full', 'IRD held. Lead professional.', 'IRD record and interim safety plan', at('2026-05-20', '16:45'), 'cp.ird.lead');
  share('shr_aiden_2', 'ird', reporter, 'scra', "Children's Reporter", 'summary', 'Reporter referral decision recorded.', 'IRD held 20 May; referral to the Reporter not made at this stage; decision to be reviewed at CPPM', at('2026-05-20', '16:45'), 'cp.ird.scra');
  share('shr_aiden_3', 'ird', USR.fionaLyle, 'court', 'Procurator fiscal', 'summary', 'JII decision recorded. If a Joint Investigative Interview is planned.', 'JII planned 22 May under SCIM; police lead DS Mackay', at('2026-05-20', '16:45'), 'cp.ird.pf');
  share('shr_aiden_4', 'investigation', head, 'education', 'Head teacher', 'fields', 'Interim safety plan agreed. If the child is school-age.', 'Collection restricted to Stacey Boyle and Agnes Rennie; daily check-in', at('2026-05-20', '13:30'), 'cp.investigation.school-fields', ['interim safety plan actions relevant to school', 'who may collect the child', 'who to call']);
  share('shr_aiden_5', 'childs-plan', gp, 'health', 'GP', 'fields', 'Registration decided.', 'Registered 12 Jun 2026: emotional abuse, physical abuse. Lead professional Janet Kerr, 01000 456789', at('2026-06-17', '11:00'), 'cp.plan.gp', ['registration status', 'registration category', 'lead professional contact']);
  share('shr_aiden_6', 'cppm', reporter, 'scra', "Children's Reporter", 'summary', 'CPPM held.', 'Registered 12 Jun; referral to the Reporter not made; to be reviewed 14 Sep', at('2026-06-17', '11:00'), 'cp.cppm.scra');
  share('shr_aiden_7', 'childs-plan', hv, 'health', 'Health visitor', 'full', 'Registration decided. If the child is pre-school.', "Child's plan and core group membership (Maisie's named person)", at('2026-06-17', '11:00'), 'cp.plan.np');

  // ----- Chronology events: the hero -----
  const E = (e: Omit<Parameters<typeof makeEvent>[1], 'subjectIds'> & { subjectIds?: string[] }) =>
    makeEvent(ctx, { subjectIds: [aiden.id], linkedProcessIds: [process.id], visibility: 'integrated', lawfulBasisId: lb.id, ...e });

  E({ occurredAt: at('2019-03-14', '04:20'), agency: 'health', sourceSystem: 'trakcare', recordedByName: 'TrakCare connector', eventType: 'family.birth', title: 'Born at Clydeshore Royal Infirmary', detail: 'Born at 39 weeks, 3.1 kg. Discharged home to 4 Cross Wynd, Ardvale with mother on day 2.', significance: 'low' });
  E({ occurredAt: at('2019-03-25', '00:00'), hasTime: false, agency: 'health', sourceSystem: 'morse', recordedByName: 'Morse connector', eventType: 'health.assessment', title: 'Health visitor first visit', detail: 'Mother aged 21, single, supported by her own mother Agnes. Feeding established. Flat cold and sparsely furnished.', response: 'Referred to Home Start; heating grant information given.', significance: 'low' });
  E({ occurredAt: at('2019-05-06', '00:00'), hasTime: false, agency: 'health', sourceSystem: 'morse', recordedByName: 'Morse connector', eventType: 'health.assessment', title: '6 to 8 week review', detail: 'Development normal. Mother low in mood, scored 12 on the Edinburgh Postnatal Depression Scale.', response: 'GP appointment arranged; listening visits offered.', outcome: 'Mother attended GP; medication started.', significance: 'moderate' });
  E({ occurredAt: at('2019-09-16', '00:00'), hasTime: false, agency: 'health', sourceSystem: 'morse', recordedByName: 'Morse connector', eventType: 'health.missed-appointment', title: 'Health visitor contact not achieved', detail: 'Planned home visit; no answer. Second attempt 19 Sep also unanswered.', response: 'Letter sent; contact made by phone 24 Sep.', significance: 'moderate' });
  E({ occurredAt: at('2020-04-02', '00:00'), hasTime: false, agency: 'health', sourceSystem: 'morse', recordedByName: 'Morse connector', eventType: 'health.assessment', title: '13 to 15 month review', detail: 'Development on track. Mother reports Kevin (father) no longer living in the flat.', significance: 'low' });
  E({ occurredAt: at('2020-11-21', '22:40'), agency: 'police', sourceSystem: 'ivpd', recordedByName: 'iVPD connector', eventType: 'police.concern-report', title: 'Child concern report: argument between parents, alcohol', detail: 'Neighbour reported shouting. Kevin Boyle intoxicated at the flat; argument with Stacey. Aiden asleep. No injuries. Kevin left with police.', response: 'Concern report shared with social work duty.', outcome: 'Screened; letter to family with support information.', significance: 'moderate', linkedPersonIds: [stacey.id, kevin.id] });
  E({ occurredAt: at('2021-02-08', '00:00'), hasTime: false, agency: 'health', sourceSystem: 'morse', recordedByName: 'Morse connector', eventType: 'health.missed-appointment', title: '27 to 30 month review not attended', detail: 'Two appointments offered and missed.', response: 'Opportunistic review at clinic in April.', significance: 'moderate' });
  E({ occurredAt: at('2021-06-09', '00:00'), hasTime: false, agency: 'social-work', sourceSystem: 'eclipse', recordedByName: 'ECLIPSE connector', eventType: 'social-work.referral', title: 'Referral from health visitor: home conditions and mother\'s mood', detail: 'Health visitor concerned about clutter, no cot mattress, and mother\'s low mood. Kevin visiting intermittently, arguments reported.', response: 'Duty assessment started.', significance: 'high', significanceReason: 'First multi-agency concern about care and home environment' });
  E({ occurredAt: at('2021-07-14', '00:00'), hasTime: false, agency: 'social-work', sourceSystem: 'eclipse', recordedByName: 'ECLIPSE connector', eventType: 'social-work.assessment', title: 'Assessment completed: support plan, no child protection concern', detail: 'Home conditions improved during assessment. Agnes Rennie providing regular support. Mother engaging with GP.', outcome: 'Family support worker for 12 weeks. Case closed 30 Sep 2021.', significance: 'moderate' });
  E({ occurredAt: at('2022-02-10', '00:00'), hasTime: false, agency: 'housing', recordedByName: 'Mark Hepburn', recordedByUserId: USR.markHepburn, eventType: 'move.address', title: 'Moved to 27 Weavers Gait, Auchentorran', detail: 'Council tenancy transfer after rent arrears at Cross Wynd cleared with a discretionary payment.', significance: 'low', linkedPersonIds: [stacey.id] });
  E({ occurredAt: at('2022-08-17', '00:00'), hasTime: false, agency: 'education', sourceSystem: 'seemis', recordedByName: 'SEEMIS connector', eventType: 'education.enrolment', title: 'Started nursery at Auchentorran Early Years Centre', detail: 'Five mornings a week.', significance: 'low' });
  E({ occurredAt: at('2023-01-15', '00:00'), hasTime: false, approximate: true, agency: 'social-work', recordedByName: name(sw), recordedByUserId: sw, eventType: 'household.change', title: 'Craig Torrance became mother\'s partner', detail: 'Date approximate, from mother\'s account at the 2025 assessment.', significance: 'moderate', linkedPersonIds: [craig.id, stacey.id] });
  E({ occurredAt: at('2023-04-18', '11:05'), agency: 'health', sourceSystem: 'trakcare', recordedByName: 'TrakCare connector', eventType: 'family.birth', title: 'Sister Maisie born', detail: 'Maisie Boyle born at Clydeshore Royal Infirmary. Father recorded as Craig Torrance.', significance: 'moderate', subjectIds: [aiden.id, maisie.id], linkedPersonIds: [maisie.id, craig.id] });
  E({ occurredAt: at('2023-09-02', '23:15'), agency: 'police', sourceSystem: 'ivpd', recordedByName: 'iVPD connector', eventType: 'police.concern-report', title: 'Child concern report: partner intoxicated, children present', detail: 'Call from Stacey Boyle. Craig Torrance heavily intoxicated, shouting, refused to leave. Both children awake and upset. Craig left with a friend. No crime recorded.', response: 'Shared with social work duty and health visitor.', outcome: 'Duty contact by phone; mother declined a visit.', significance: 'high', significanceReason: 'Children present and distressed; first report naming Craig Torrance', subjectIds: [aiden.id, maisie.id], linkedPersonIds: [craig.id, stacey.id] });
  E({ occurredAt: at('2024-01-19', '00:00'), hasTime: false, agency: 'housing', recordedByName: 'Mark Hepburn', recordedByUserId: USR.markHepburn, eventType: 'move.address', title: 'Moved to 12 Brae Wynd, Craiglarrick', detail: 'Mutual exchange to a three-bedroom house.', significance: 'low', subjectIds: [aiden.id, maisie.id], linkedPersonIds: [stacey.id] });
  E({ occurredAt: at('2024-06-01', '00:00'), hasTime: false, approximate: true, agency: 'social-work', recordedByName: name(sw), recordedByUserId: sw, eventType: 'household.change', title: 'Craig Torrance moved into the household', detail: 'Date approximate, from mother\'s account.', significance: 'moderate', linkedPersonIds: [craig.id] });
  E({ occurredAt: at('2024-08-15', '00:00'), hasTime: false, agency: 'education', sourceSystem: 'seemis', recordedByName: 'SEEMIS connector', eventType: 'education.enrolment', title: 'Started P1 at Ardvale Primary', detail: 'Enrolled. Named person: head teacher.', significance: 'low' });
  E({ occurredAt: at('2024-12-20', '00:00'), hasTime: false, agency: 'education', sourceSystem: 'seemis', recordedByName: 'SEEMIS connector', eventType: 'education.attendance', title: 'Attendance 88 percent, term 1 and 2', detail: 'Twelve absences, mostly Mondays, unexplained. Two late arrivals a week.', response: 'Letter home; named person phone call.', significance: 'moderate' });
  E({ occurredAt: at('2025-03-08', '21:50'), agency: 'police', sourceSystem: 'ivpd', recordedByName: 'iVPD connector', eventType: 'police.concern-report', title: 'Child concern report: shouting, drug paraphernalia in the kitchen', detail: 'Neighbour reported prolonged shouting. Officers saw a burnt spoon and foil in the kitchen. Craig Torrance and Stacey Boyle both present and argumentative. Children in bed.', response: 'Concern report shared with social work duty as high priority.', outcome: 'Referral to social work.', significance: 'high', significanceReason: 'Drug paraphernalia with children in the house', subjectIds: [aiden.id, maisie.id], linkedPersonIds: [craig.id, stacey.id] });
  E({ occurredAt: at('2025-03-12', '00:00'), hasTime: false, agency: 'social-work', sourceSystem: 'eclipse', recordedByName: 'ECLIPSE connector', eventType: 'social-work.referral', title: 'Referral from police: substance use and children in the home', detail: 'Second referral. Allocated for assessment.', significance: 'high', significanceReason: 'Second referral, escalating concern' });
  E({ occurredAt: at('2025-04-22', '00:00'), hasTime: false, agency: 'social-work', sourceSystem: 'eclipse', recordedByName: 'ECLIPSE connector', eventType: 'social-work.assessment', title: 'Assessment: support plan agreed, parents to engage with recovery service', detail: 'Stacey acknowledged occasional cannabis use; Craig denied heroin use despite paraphernalia. Both agreed to attend Clydeshore Recovery Service. Agnes providing weekend care.', outcome: 'Support plan for six months; review in October.', significance: 'moderate', linkedPersonIds: [stacey.id, craig.id] });
  E({ occurredAt: at('2025-05-06', '00:00'), hasTime: false, agency: 'social-work', sourceSystem: 'eclipse', recordedByName: 'ECLIPSE connector', eventType: 'care.service-start', title: 'Clydeshore Recovery Service engagement started (mother)', detail: 'Initial appointment attended.', significance: 'low', subjectIds: [aiden.id], linkedPersonIds: [stacey.id] });
  E({ occurredAt: at('2025-06-27', '00:00'), hasTime: false, agency: 'education', sourceSystem: 'seemis', recordedByName: 'SEEMIS connector', eventType: 'education.attendance', title: 'Attendance 84 percent for the session', detail: 'Below threshold. Absences cluster after weekends.', response: 'Attendance meeting with mother held 12 June.', significance: 'moderate' });
  E({ occurredAt: at('2025-09-18', '00:00'), hasTime: false, agency: 'social-work', sourceSystem: 'eclipse', recordedByName: 'ECLIPSE connector', eventType: 'care.service-end', title: 'Recovery service engagement ended (mother did not attend)', detail: 'Three consecutive appointments missed. Case closed by the service.', significance: 'moderate', linkedPersonIds: [stacey.id] });
  E({ occurredAt: at('2025-10-30', '00:00'), hasTime: false, agency: 'social-work', sourceSystem: 'eclipse', recordedByName: 'ECLIPSE connector', eventType: 'social-work.plan-review', title: 'Support plan review: case closed', detail: 'Home conditions acceptable on two visits. Mother reports Craig has stopped using. School reports improved attendance in August and September.', outcome: 'Closed with signposting.', significance: 'moderate' });
  E({ occurredAt: at('2026-01-11', '19:35'), agency: 'health', sourceSystem: 'trakcare', recordedByName: 'TrakCare connector', eventType: 'health.attendance', title: 'Emergency department: head injury after a fall at home', detail: 'Brought by mother. Bump to forehead, no loss of consciousness. Account: fell from the sofa. Discharged with head injury advice.', response: 'Child protection screening tool completed; no concern raised.', significance: 'moderate' });
  E({ occurredAt: at('2026-03-10', '00:00'), hasTime: false, agency: 'education', recordedByName: name(head), recordedByUserId: head, eventType: 'education.concern', title: 'Wellbeing concern: hungry, unwashed, tired', detail: 'Class teacher noted Aiden asking for food three mornings running, wearing the same clothes all week, and falling asleep in class.', response: 'Named person spoke with mother; breakfast club place given.', outcome: 'Mother said Craig had lost his job and money was tight.', significance: 'moderate' });
  E({ occurredAt: at('2026-04-24', '00:00'), hasTime: false, agency: 'education', sourceSystem: 'seemis', recordedByName: 'SEEMIS connector', eventType: 'education.attendance', title: 'Attendance 82 percent, term 3', detail: 'Pattern of Monday absences continues.', significance: 'moderate' });
  E({ occurredAt: at('2026-05-20', '09:20'), agency: 'education', recordedByName: name(head), recordedByUserId: head, eventType: 'education.concern', title: 'Disclosure to class teacher: bruising to upper arm, "Craig grabbed me"', detail: 'Four oval bruises on the left upper arm, yellow-purple. Aiden said Craig grabbed him because he would not go to bed. Head teacher informed at 09:30; social work and police called at 09:40.', response: 'Child protection referral made immediately.', significance: 'high', significanceReason: 'Injury with a disclosure naming an adult in the household', evidenceRefs: [{ kind: 'document', ref: 'SEEMIS pastoral note 20 May 2026', label: 'Pastoral note' }] });
  E({ occurredAt: at('2026-05-20', '11:30'), agency: 'social-work', recordedByName: name(tl), recordedByUserId: tl, eventType: 'process.ird', title: 'IRD held: joint investigation, JII and medical agreed; interim safety plan', detail: 'Social work, police, health and education. Craig Torrance to leave the household. Reporter referral not made at this stage.', significance: 'high', significanceReason: 'Child protection procedures initiated', subjectIds: [aiden.id, maisie.id] });
  E({ occurredAt: at('2026-05-21', '14:00'), agency: 'health', recordedByName: name(cpn), recordedByUserId: cpn, eventType: 'health.assessment', title: 'Comprehensive medical: bruising consistent with a grip, no other injury', detail: 'Paediatrician documented four oval bruises 1 to 2 cm on the left upper arm, consistent with a forceful grip by an adult hand. Body map completed. No other injuries.', significance: 'high', significanceReason: 'Medical opinion supports the disclosure' });
  E({ occurredAt: at('2026-05-22', '10:00'), agency: 'police', recordedByName: `DS ${name(ds)}`, recordedByUserId: ds, eventType: 'voice.child', title: 'Joint Investigative Interview held (SCIM)', detail: 'Aiden gave a clear account of being grabbed and pushed on 18 May and of shouting "most nights".', significance: 'high', significanceReason: 'Child\'s account recorded' });
  E({ occurredAt: at('2026-05-23', '15:30'), agency: 'police', sourceSystem: 'ivpd', recordedByName: 'iVPD connector', eventType: 'police.charge', title: 'Craig Torrance charged with assault', detail: 'Charged after interview. Released on undertaking with conditions.', significance: 'high', significanceReason: 'Criminal proceedings started', linkedPersonIds: [craig.id] });
  E({ occurredAt: at('2026-05-23', '15:45'), agency: 'police', sourceSystem: 'ivpd', recordedByName: 'iVPD connector', eventType: 'police.bail-condition', title: 'Bail conditions: not to approach 12 Brae Wynd or Aiden Boyle', detail: 'Conditions until trial. Breach to be reported to the lead professional.', significance: 'high', linkedPersonIds: [craig.id] });
  E({ occurredAt: at('2026-06-12', '10:00'), agency: 'social-work', recordedByName: name(chair), recordedByUserId: chair, eventType: 'process.cppm', title: 'Initial CPPM held', detail: 'All agencies and both parents attended. Aiden\'s views read into the record.', significance: 'high', significanceReason: 'Registration decision' });
  E({ occurredAt: at('2026-06-12', '12:15'), agency: 'social-work', recordedByName: name(chair), recordedByUserId: chair, eventType: 'process.registration', title: 'Placed on the Child Protection Register: emotional abuse, physical abuse', detail: 'Core group set up. Review CPPM 14 Sep 2026.', significance: 'high', significanceReason: 'Registration' });
  E({ occurredAt: at('2026-06-26', '00:00'), hasTime: false, agency: 'education', sourceSystem: 'seemis', recordedByName: 'SEEMIS connector', eventType: 'education.attendance', title: 'Attendance 94 percent since 20 May', detail: 'No unexplained absences since the interim safety plan.', significance: 'moderate' });
  E({ occurredAt: at('2026-07-01', '14:00'), agency: 'social-work', recordedByName: name(sw), recordedByUserId: sw, eventType: 'process.core-group', title: 'First core group held', detail: 'Plan on track. Separation maintained. Recovery service appointment booked for 22 July.', significance: 'moderate' });
  E({ occurredAt: at('2026-07-22', '00:00'), hasTime: false, agency: 'social-work', recordedByName: name(sw), recordedByUserId: sw, eventType: 'care.service-start', title: 'Recovery service appointment missed (mother)', detail: 'Stacey did not attend the first appointment. Rebooked for 12 August.', significance: 'moderate', linkedPersonIds: [stacey.id] });
  E({ occurredAt: at('2026-08-05', '14:00'), agency: 'social-work', recordedByName: name(sw), recordedByUserId: sw, eventType: 'process.core-group', title: 'Second core group held', detail: 'Attendance good. Maisie\'s review pending. Recovery service appointment still not attended; action carried forward.', significance: 'moderate' });
  E({ occurredAt: at('2026-08-20', '16:00'), agency: 'social-work', recordedByName: name(sw), recordedByUserId: sw, eventType: 'voice.child', title: "Aiden's views recorded: three wishes", detail: 'Stay at my school; Gran picks me up on Fridays; Mum stops being sad.', significance: 'moderate' });
  E({ occurredAt: at('2026-08-27', '11:00'), agency: 'health', sourceSystem: 'morse', recordedByName: 'Morse connector', eventType: 'health.assessment', title: 'Maisie: 27 to 30 month review completed', detail: 'Speech slightly delayed. Referred to speech and language therapy.', significance: 'moderate', subjectIds: [maisie.id, aiden.id] });

  // Analysis notes: separate from facts.
  const hvMissed = ctx.data.events.filter((e) => e.subjectIds.includes(aiden.id) && e.eventType === 'health.missed-appointment').map((e) => e.id);
  const policeReports = ctx.data.events.filter((e) => e.subjectIds.includes(aiden.id) && e.eventType === 'police.concern-report').map((e) => e.id);
  makeAnalysis(ctx, { id: 'ana_aiden_1', subjectId: aiden.id, processId: process.id, eventIds: hvMissed, authorUserId: cpn, authorName: name(cpn), agency: 'health', recordedAt: at('2026-06-09', '10:30'), kind: 'pattern', title: 'Missed health contacts cluster around changes in the household', text: 'Missed health visitor contacts in 2019, 2021 and 2023 each follow a change in who is living in the home. This is a prompt for the core group to check health engagement whenever household composition changes, not a conclusion about cause.' });
  makeAnalysis(ctx, { id: 'ana_aiden_2', subjectId: aiden.id, processId: process.id, eventIds: policeReports, authorUserId: sw, authorName: name(sw), agency: 'social-work', recordedAt: at('2026-06-10', '17:00'), kind: 'risk', title: 'Police reports escalate in seriousness from 2020 to 2025', text: 'The three concern reports move from an argument with the father (2020), to intoxication with children present (2023), to drug paraphernalia with children in the house (2025). Each was screened without a child protection response. Read together they show cumulative harm that single-agency screening did not see.' });

  // Connector inbox: events awaiting review.
  makeConnectorEvent(ctx, { id: 'cev_aiden_1', connectorId: 'seemis', agency: 'education', subjectId: aiden.id, receivedAt: at('2026-09-01', '17:05'), externalRef: 'SEEMIS-ATT-2026-08', sourcePayload: { pupil: 'BOYLE, Aiden', stage: 'P3', period: 'Aug 2026', possible: '20', attended: '17', unauthorised: '3', pattern: 'Mon, Mon, Fri' }, mapped: { eventType: 'education.attendance', title: 'Attendance 85 percent in August (3 unauthorised absences)', detail: 'Three unauthorised absences on Mondays and a Friday in the first weeks of P3.', occurredAt: at('2026-08-31', '00:00'), hasTime: false, significance: 'moderate', mappingRule: 'seemis.attendance.monthly' } });
  makeConnectorEvent(ctx, { id: 'cev_aiden_2', connectorId: 'ivpd', agency: 'police', subjectId: aiden.id, receivedAt: at('2026-08-30', '01:10'), externalRef: 'IVPD-CCR-2026-08-2291', sourcePayload: { type: 'Child Concern Report', child: 'BOYLE, Aiden', adults: 'BOYLE, Stacey; BOYLE, Kevin', location: '12 Brae Wynd, Craiglarrick', summary: 'Verbal argument at handover; father intoxicated; child present', crime: 'None' }, mapped: { eventType: 'police.concern-report', title: 'Child concern report: argument between parents at Sunday handover, father intoxicated', detail: 'Officers attended after a call from Stacey Boyle. Kevin Boyle intoxicated when returning Aiden. Argument on the doorstep. No injuries.', occurredAt: at('2026-08-29', '19:40'), hasTime: true, significance: 'high', mappingRule: 'ivpd.ccr.child-present' } });
  makeConnectorEvent(ctx, { id: 'cev_aiden_3', connectorId: 'emis-web', agency: 'health', subjectId: aiden.id, receivedAt: at('2026-08-28', '12:30'), externalRef: 'EMIS-CONS-88213', sourcePayload: { patient: 'BOYLE, Aiden', practice: 'Craiglarrick Health Centre', clinician: 'Dr Farouk', code: 'Consultation: sleep difficulty', note: 'Mother reports Aiden waking with nightmares; advice given' }, mapped: { eventType: 'health.consultation', title: 'GP consultation: nightmares and sleep difficulty', detail: 'Mother reports Aiden waking most nights since May. Sleep advice given; review in six weeks.', occurredAt: at('2026-08-27', '15:20'), hasTime: true, significance: 'moderate', mappingRule: 'emis.consultation.safeguarding-context' } });

  void nowIso;
}
