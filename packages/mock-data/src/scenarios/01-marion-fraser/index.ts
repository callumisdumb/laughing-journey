import { officialSensitive } from '@mas/domain';
/**
 * Scenario 1: Marion Fraser, 79, Portlennan. Adult Support and Protection, financial harm by a
 * nephew who holds an unregistered "arrangement" over her bank card. Capacity fluctuates
 * (vascular dementia). The ASP investigation is under way, the case conference is in nine days,
 * and a linked AWI process is waiting on a capacity assessment. OPG check shows no power of attorney.
 */
import type { Agency, Process } from '@mas/domain';
import type { BuildContext } from '../../generator/context';
import { at, makeAction, makeAddress, makeAnalysis, makeConnectorEvent, makeEvent, makeInbound, makeOutbound, makeHousehold, makeLawfulBasis, makeMeeting, makePerson, makeRisk, makeShare, makeViews, relate, syntheticChi } from '../../generator/factory';
import { USR, userName } from '../../generator/organisations';

export const MARION = {
  marion: 'per_marion_fraser',
  duncan: 'per_duncan_fraser',
  asp: 'prc_asp_marion',
  awi: 'prc_awi_marion',
  iad: 'mtg_marion_iad',
  caseConference: 'mtg_marion_cc',
  threePointTest: 'ra_marion_3pt',
  concernEvent: 'evt_marion_acr',
} as const;

export function seedMarionFraser(ctx: BuildContext): void {
  const name = (id: string) => userName(ctx, id);

  // Addresses.
  const shoreLoan = makeAddress(ctx, { id: 'adr_marion_home', line1: '14 Shore Loan', town: 'Portlennan', postcode: 'QX3 2LR' });
  const duncanFlat = makeAddress(ctx, { id: 'adr_duncan_flat', line1: '8 Burnside Vennel', line2: 'Flat 1/2', town: 'Auchentorran', postcode: 'QX2 4EH' });

  const hh = 'hh_fraser';
  const marion = makePerson(ctx, {
    id: MARION.marion,
    givenName: 'Marion',
    familyName: 'Fraser',
    sex: 'female',
    dateOfBirth: '1947-02-19',
    chi: syntheticChi(ctx, '1947-02-19', 'female'),
    addressHistory: [{ addressId: shoreLoan.id, from: '1971-08-14', note: 'Owner occupier; lived here since her marriage' }],
    householdId: hh,
    communicationNeeds: { needs: ['Hearing aid (left ear); check it is in before any conversation', 'Clearer in the mornings; arrange visits before midday'], note: 'Vascular dementia; capacity fluctuates through the day' },
    contact: { phone: '01000 342118' },
    gpPractice: 'Portlennan Medical Practice',
    createdAt: at('2024-02-13', '10:00'),
  });
  const duncan = makePerson(ctx, {
    id: MARION.duncan,
    givenName: 'Duncan',
    familyName: 'Fraser',
    sex: 'male',
    dateOfBirth: '1988-05-14',
    chi: syntheticChi(ctx, '1988-05-14', 'male'),
    addressHistory: [{ addressId: duncanFlat.id, from: '2021-10-01', note: 'Council tenancy; stays some nights at 14 Shore Loan since about June 2026' }],
    contact: { phone: '07700 900274' },
    gpPractice: 'Craiglarrick Health Centre',
    createdAt: at('2025-03-18', '10:00'),
  });

  makeHousehold(ctx, { id: hh, addressId: shoreLoan.id, from: '1971-08-14', memberIds: [marion.id], label: 'Fraser household, Portlennan' });
  relate(ctx, duncan.id, marion.id, 'nephew-or-niece-of', { notes: 'Son of her late brother. Visits several times a week; does her shopping; holds her bank card under an unregistered "arrangement"' });
  relate(ctx, marion.id, duncan.id, 'aunt-or-uncle-of');

  const co = USR.moiraGilmour;
  const sw = USR.stuartBlair;
  const ds = USR.paulMackay;
  const gp = USR.amiraFarouk;
  const adv = USR.tamGuthrie;
  const opg = USR.alistairMeek;
  const mho = USR.graemeDunlop;
  const chair = USR.davidLaird;
  const minutes = USR.lesleyMorton;
  const hub = USR.gavinBrodie;
  const teamLeader = 'Eilidh Munro, team leader, Adult Protection Team';

  const lb = makeLawfulBasis(ctx, {
    id: 'lb_marion_asp',
    purpose: 'Adult Support and Protection inquiry and investigation into financial harm to Marion Fraser',
    article6: '6(1)(c) legal obligation',
    article9Condition: '9(2)(g) substantial public interest, DPA 2018 Sch 1 Pt 2 para 18 (safeguarding)',
    article10Criminal: 'DPA 2018 s10 and Sch 1',
    statutoryGateway: ['Adult Support and Protection (Scotland) Act 2007 s4 (duty to make inquiries)', 'Adult Support and Protection (Scotland) Act 2007 s5 (duty to cooperate)', 'Adult Support and Protection (Scotland) Act 2007 s10 (examination of records)'],
    necessityAndProportionality: 'Sharing between the council, Police Scotland, the GP practice, the OPG and the advocacy service is necessary to establish whether Marion is being financially harmed and what will protect her. Only events relevant to her safety, her finances and her capacity are included in the integrated chronology. The nephew\'s police history is held by police only.',
    consentStatus: 'sought-and-given',
    consentNote: 'Marion agreed on 28 Aug 2026, with her advocate present, to information being shared for the inquiry. Her capacity fluctuates, so consent was checked at each step and recorded in the morning when she is clearer. The inquiry would proceed under s4 and s5 without consent if it had to.',
    authorisedByUserId: co,
    authorisedByName: name(co),
    informationSharingAgreementRef: 'Clydeshore APC ISA 2023/02',
    dpiaRef: 'DPIA-ASP-2023-04',
    createdAt: at('2026-08-21', '12:30'),
  });

  makeRisk(ctx, {
    id: MARION.threePointTest,
    processId: MARION.asp,
    subjectId: marion.id,
    tool: 'three-point-test',
    assessedAt: at('2026-08-21', '11:00'),
    assessorUserId: co,
    assessorName: name(co),
    assessorAgency: 'social-work',
    band: 'high',
    bandLabel: 'Adult at risk: all three limbs met',
    items: [
      { id: 'a', question: 'Unable to safeguard own wellbeing, property, rights or other interests', answer: 'yes' },
      { id: 'b', question: 'At risk of harm', answer: 'yes' },
      { id: 'c', question: 'More vulnerable to harm because of disability, mental disorder, illness or infirmity', answer: 'yes' },
    ],
  });

  const asp: Process = {
    id: MARION.asp,
    synthetic: true,
    type: 'asp',
    reference: 'ASP-2026-0217',
    title: 'Adult Support and Protection: Marion Fraser (financial harm)',
    subjectIds: [marion.id],
    leadAgency: 'social-work',
    leadUserId: co,
    stage: 'investigation',
    stageHistory: [
      { stage: 'concern', at: at('2026-08-21', '09:30'), byUserId: co, byName: name(co), note: 'Police Scotland Adult Concern Report from a bank referral' },
      { stage: 'screening', at: at('2026-08-21', '11:00'), byUserId: co, byName: name(co), note: 'Three-point test met on all three limbs' },
      { stage: 'inquiry', at: at('2026-08-21', '12:15'), byName: teamLeader, note: 'Duty decision: proceed to inquiry' },
      { stage: 'investigation', at: at('2026-08-27', '09:30'), byUserId: co, byName: name(co), note: 'Inquiry decision 26 Aug: proceed to investigation. Council officer and second worker allocated' },
    ],
    status: 'open',
    classification: officialSensitive(),
    accessRestriction: 'none',
    openedAt: at('2026-08-21', '09:30'),
    members: [
      { userId: co, caseRole: 'council officer', agency: 'social-work', since: '2026-08-21', reason: 'Allocated council officer (s52) for the inquiry and investigation' },
      { userId: sw, caseRole: 'second worker', agency: 'social-work', since: '2026-08-27', reason: 'Second worker for the s7 visit and s8 interview' },
      { userId: ds, caseRole: 'detective sergeant, Public Protection Unit', agency: 'police', since: '2026-08-21', reason: 'Criminal element: financial harm investigation' },
      { userId: gp, caseRole: 'GP', agency: 'health', since: '2026-08-21', reason: 'Health input: dementia diagnosis and capacity; s10 records holder' },
      { userId: adv, caseRole: 'independent advocate', agency: 'third-sector', since: '2026-08-27', reason: 'Advocacy offered and accepted' },
      { userId: opg, caseRole: 'OPG investigations officer', agency: 'regulator', since: '2026-08-27', reason: 'Financial harm; register check and advice on banking safeguards' },
      { userId: chair, caseRole: 'chair', agency: 'social-work', since: '2026-09-01', reason: 'Independent chair of the case conference' },
      { userId: minutes, caseRole: 'minute taker', agency: 'social-work', since: '2026-09-01', reason: 'Minutes, invitations and pack' },
    ],
    clocks: [
      { id: 'clk_marion_inquiry', ruleId: 'asp.inquiry.decision', triggeredAt: at('2026-08-21', '09:30'), completedAt: at('2026-08-26', '15:00'), note: 'Decision on working day 3 of 5' },
      { id: 'clk_marion_cc', ruleId: 'asp.caseconference.initial', triggeredAt: at('2026-08-21', '09:30'), note: 'Case conference booked for 11 Sep, day 21' },
    ],
    linkedProcessIds: [MARION.awi],
    viewsRecordIds: ['vw_marion_1'],
    riskAssessmentIds: [MARION.threePointTest],
    flags: { criminalElement: true, healthInput: true, financialHarm: true, recordsRequest: true, advocacyOffered: true, regulatedService: false, housingRelevant: false, jointVisit: false, medicalExamination: false },
    parties: [],
    detail: {
      concern: {
        receivedAt: at('2026-08-21', '09:30'),
        source: 'Police Scotland Adult Concern Report (iVPD) following a vulnerable customer referral from Clydeshore Savings Bank, Portlennan branch',
        sourceAgency: 'police',
        sourceReference: 'IVPD-ACR-2026-08-1187',
        // Indicator 1 counts the act of the sender, so the source is the police who made the referral,
        // not the bank that raised it with them.
        referralSource: 'police',
        summary: 'The bank reported 31 cash machine withdrawals totalling £2,410 between 8 Jun and 17 Aug 2026, most at Auchentorran and several late in the evening. Marion attended the branch on 18 Aug unsure why her balance was low and said her nephew Duncan "keeps my card for me". She has a diagnosis of vascular dementia.',
        harmTypes: ['financial', 'psychological'],
        locationOfHarm: 'own-home',
        immediateSafety: 'No immediate physical risk. Marion is at home with care at home visits twice a day. The bank has placed a temporary limit of £100 a day on cash withdrawals pending contact with the council.',
        policeInvolved: true,
      },
      threePointTest: {
        assessedAt: at('2026-08-21', '11:00'),
        byName: name(co),
        byUserId: co,
        a: { met: 'yes', reasoning: 'Marion cannot check her statements, does not know how much has been withdrawn, and cannot recall what she agreed with Duncan. She depends on him for shopping and has no other way to reach her money. She is unable to safeguard her property and financial interests without help.' },
        b: { met: 'yes', reasoning: 'Withdrawals of £2,410 in ten weeks that she cannot account for, an empty fridge on two care visits, and low mood "worried about money". The pattern is continuing.' },
        c: { met: 'yes', reasoning: 'Vascular dementia diagnosed November 2025 with fluctuating capacity. Her memory impairment makes her more vulnerable to financial harm than an adult who is not so affected.' },
        outcome: 'met',
      },
      screening: {
        outcome: 'proceed-to-inquiry',
        rationale: 'Three-point test met. Financial harm with a criminal element and a capacity question. Not an emergency: Marion is safe at home and the bank has limited withdrawals.',
        at: at('2026-08-21', '12:15'),
        byName: teamLeader,
      },
      inquiry: {
        openedAt: at('2026-08-21', '12:15'),
        interAgencyDiscussionMeetingId: MARION.iad,
        agenciesContacted: ['police', 'health', 'social-work', 'regulator'],
        outcome: 'proceed-to-investigation',
        rationale: 'Police confirm the withdrawal pattern from bank records. The GP confirms the diagnosis and that Marion was advised twice to grant a power of attorney and did not. Care at home logs place Duncan in the house on the days of most withdrawals. An investigation with a s7 visit and s8 interview is needed to hear from Marion away from her nephew.',
        decidedAt: at('2026-08-26', '15:00'),
      },
      investigation: {
        councilOfficerUserId: co,
        secondWorkerUserId: sw,
        visits: [
          { at: at('2026-08-28', '10:30'), power: 's7', byNames: [name(co), name(sw), `${name(adv)} (advocate)`], note: 'Visit at 14 Shore Loan, morning slot. Duncan present on arrival; asked to leave the room for the interview and agreed after some discussion. House warm and tidy; fridge stocked (Duncan had shopped the day before). Bank card not in the house.' },
        ],
        interviews: [
          { at: at('2026-08-28', '11:00'), power: 's8', withPersonId: marion.id, note: 'Interviewed alone with her advocate present. Marion was clear that Duncan "does my messages" and keeps her card "so I do not lose it". She did not know the balance, could not say how often he withdraws cash, and became upset when told the amount. She wants her money back and her card in her own purse, and does not want Duncan "in trouble".', adultDeclined: false },
        ],
        recordsRequests: [
          { requestedAt: at('2026-08-27', '16:00'), power: 's10', holder: 'Portlennan Medical Practice (Dr Amira Farouk)', holderAgency: 'health', status: 'received', note: 'Summary of consultations 2024 to 2026 and the memory clinic letter received 1 Sep. Records inspected by Dr Farouk on the council\'s behalf; only the summary was shared.' },
        ],
        consent: {
          status: 'sought-and-given',
          note: 'Marion agreed to the visit, the interview and the records request on 28 Aug, with her advocate present. Her capacity fluctuates: consent was checked at the start of each step, in the morning when she is clearer, and recorded in her words.',
        },
        capacity: {
          assessed: true,
          summary: 'Vascular dementia diagnosed November 2025. Marion can say what she wants (to stay at home, to have her money back) but cannot hold in mind how much has been withdrawn or what she agreed with Duncan. A formal assessment of her capacity for financial decisions has been requested from Dr Farouk under the linked AWI process.',
          fluctuates: true,
          linkedAwiProcessId: MARION.awi,
        },
        unduePressure: {
          considered: true,
          found: true,
          reasoning: 'Duncan is present at most visits, answers for Marion, and told the bank he "manages everything". Marion was noticeably more anxious with him in the room and said she did not want him "in trouble". Undue pressure from a relative she depends on for shopping and company is likely, and would bear on any refusal she gives.',
        },
        advocacy: { offered: true, accepted: true, provider: 'Clydeshore Advocacy', advocateName: name(adv) },
      },
      ordersConsidered: [
        { order: 'banning-order-s19', considered: true, decision: 'application-drafting', rationale: 'A banning order would keep Duncan away from 14 Shore Loan while safeguards are put in place. Marion does not want him "in trouble" but does want her money back and to feel safe at home. An application is being drafted for the case conference to consider, with a temporary banning order as a fallback if the withdrawals continue before the hearing. Least restrictive alternatives (new account, card held by Marion, carers to prompt) are being tried first.' },
        { order: 'assessment-order-s11', considered: true, decision: 'not-required', rationale: 'Marion agreed to the s7 visit and s8 interview; there is no need for an order to assess her.' },
        { order: 'removal-order-s14', considered: true, decision: 'not-required', rationale: 'Marion is safe at home with care at home. Removal would be contrary to her clearly stated wish and is not the least restrictive option.' },
      ],
    },
  };
  ctx.data.processes.push(asp);

  const awi: Process = {
    id: MARION.awi,
    synthetic: true,
    type: 'awi',
    reference: 'AWI-2026-0088',
    title: 'Adults with Incapacity: Marion Fraser (capacity for financial decisions)',
    subjectIds: [marion.id],
    leadAgency: 'social-work',
    leadUserId: co,
    stage: 'capacity-concern',
    stageHistory: [
      { stage: 'capacity-concern', at: at('2026-08-27', '14:00'), byUserId: co, byName: name(co), note: 'Raised from the ASP investigation: capacity for financial decisions in question' },
    ],
    status: 'open',
    classification: officialSensitive(),
    accessRestriction: 'none',
    openedAt: at('2026-08-27', '14:00'),
    members: [
      { userId: co, caseRole: 'council officer (raised the concern)', agency: 'social-work', since: '2026-08-27', reason: 'ASP council officer; the two processes run together' },
      { userId: mho, caseRole: 'Mental Health Officer', agency: 'social-work', since: '2026-08-27', reason: 'Advice on route if guardianship or an intervention order is needed' },
      { userId: gp, caseRole: 'assessing GP', agency: 'health', since: '2026-08-27', reason: 'Capacity assessment for financial decisions' },
      { userId: opg, caseRole: 'OPG investigations officer', agency: 'regulator', since: '2026-08-28', reason: 'Register check; advice on Part 3 access to funds' },
    ],
    clocks: [],
    linkedProcessIds: [MARION.asp],
    viewsRecordIds: ['vw_marion_1'],
    riskAssessmentIds: [],
    flags: { welfareGuardianshipLikely: false, inHospital: false, careProvider: false, financialHarm: true },
    parties: [],
    detail: {
      concern: {
        raisedAt: at('2026-08-27', '14:00'),
        source: 'Council officer, ASP investigation ASP-2026-0217',
        sourceAgency: 'social-work',
        decisionInQuestion: 'Managing her finances and the arrangement with her nephew over her bank card',
        summary: 'Marion has vascular dementia with fluctuating capacity. She cannot say how much has been withdrawn from her account or what she agreed with her nephew. Whether she can decide for herself about her money, and about any arrangement with Duncan, needs a formal assessment before the case conference decides what protects her.',
      },
      capacityAssessments: [
        {
          id: 'cap_marion_1',
          decision: 'Managing her finances and the arrangement with her nephew',
          assessedAt: at('2026-09-04', '10:00'),
          assessorName: `Dr ${name(gp)}`,
          assessorRole: 'GP, Portlennan Medical Practice',
          outcome: 'pending',
          evidence: 'Assessment booked for 4 Sep at 10:00 at home, with her advocate present. Dr Farouk noted on 28 Aug that Marion is clearer in the mornings, so the assessment is timed for then. Outcome to be recorded before the case conference on 11 Sep.',
          communicationSupport: 'Morning appointment; hearing aid checked; advocate present; nephew not present.',
        },
      ],
      willAndPreferences: {
        recordedAt: at('2026-08-28', '11:30'),
        byName: name(adv),
        pastWishes: 'Handled the household money herself after her husband Iain died in 2019 and was proud of it. Told her neighbour Cathy Sinclair she would "never be a burden" and would sooner "go without than owe anybody".',
        presentWishes: 'To stay at home at Shore Loan. To have her own bank card in her own purse. For Duncan to keep doing her shopping but not to keep her card or her money.',
        communicationMethod: 'Spoken, mornings best; hearing aid in; one question at a time; advocate present; read back and agreed.',
        consultedOthers: [
          { personId: duncan.id, name: 'Duncan Fraser', relationship: 'Nephew', view: 'Says he has a verbal arrangement to look after her money, that the withdrawals paid for shopping, fuel and "bits for the house", and that she "would never manage the bank". Declined to show receipts.' },
          { name: 'Cathy Sinclair', relationship: 'Neighbour and friend', view: 'Marion was "always careful with money" and has been "different since the spring": asking to borrow for the milk, and anxious when Duncan\'s car is outside.' },
        ],
      },
      opgResult: {
        checkedAt: at('2026-08-28', '15:30'),
        reference: 'OPG-REG-2026-41877',
        powerOfAttorney: { exists: false },
        guardianship: { exists: false },
      },
      orders: [],
      supervisionVisits: [],
      investigations: [],
    },
  };
  ctx.data.processes.push(awi);

  // ----- Views -----
  makeViews(ctx, {
    id: 'vw_marion_1',
    personId: marion.id,
    processId: asp.id,
    kind: 'adult-views',
    recordedAt: at('2026-08-28', '11:30'),
    recordedByUserId: adv,
    recordedByName: name(adv),
    recordedByAgency: 'third-sector',
    method: 'Recorded by her independent advocate straight after the s8 interview, at home, in her words, read back and agreed',
    content: 'I want to stay in my own house. I have been here since 1971 and I am not going anywhere. Duncan is a good lad, he does my messages, and I do not want him in any trouble. But that is my money and I want it back. I want my own card in my own purse.',
    sharingPreference: 'Marion agreed her views can be read at the case conference. She does not want Duncan told what she said about the money until the council officer has spoken to him herself.',
  });

  // ----- Actions -----
  const actions: Array<{ id: string; title: string; owner: string; agency: Agency; due: string; status: 'open' | 'in-progress' | 'complete'; completedAt?: string; evidence?: string; detail?: string }> = [
    { id: 'act_marion_1', title: 'Obtain bank statements and cash machine footage for 1 Jun to 20 Aug; interview Duncan Fraser under caution', owner: ds, agency: 'police', due: '2026-09-04', status: 'in-progress', evidence: 'Statements received 1 Sep; footage requested from two machines; interview arranged for 3 Sep' },
    { id: 'act_marion_2', title: 's10 records request to Portlennan Medical Practice for consultations 2024 to 2026 and the memory clinic letter', owner: co, agency: 'social-work', due: '2026-09-01', status: 'complete', completedAt: at('2026-09-01', '10:00'), evidence: 'Summary received from Dr Farouk 1 Sep; filed to the investigation record' },
    { id: 'act_marion_3', title: 'Capacity assessment for financial decisions, at home, morning, advocate present', owner: gp, agency: 'health', due: '2026-09-04', status: 'open', detail: 'Feeds the linked AWI process and the case conference' },
    { id: 'act_marion_4', title: 'Council officer\'s report with integrated chronology for the case conference', owner: co, agency: 'social-work', due: '2026-09-08', status: 'in-progress', evidence: 'Chronology pack built; report drafted to section 4' },
    { id: 'act_marion_5', title: 'With Marion\'s agreement, ask the bank to move her pension to a new account with a card issued only to her', owner: sw, agency: 'social-work', due: '2026-08-31', status: 'open', detail: 'Bank vulnerable customer lead (Fiona Watt) needs Marion to attend the branch; morning appointment to be booked' },
    { id: 'act_marion_6', title: 'Draft banning order application (s19) with a temporary order option for the chair', owner: co, agency: 'social-work', due: '2026-09-09', status: 'in-progress', evidence: 'Draft with legal services 2 Sep' },
    { id: 'act_marion_7', title: 'Go through the case conference invitation with Marion and record what she wants said on her behalf', owner: adv, agency: 'third-sector', due: '2026-09-09', status: 'open' },
  ];
  for (const a of actions) {
    makeAction(ctx, { id: a.id, processId: asp.id, meetingId: MARION.iad, title: a.title, detail: a.detail, ownerUserId: a.owner, ownerName: a.owner === gp ? `Dr ${name(gp)}` : a.owner === ds ? `DS ${name(ds)}` : name(a.owner), ownerAgency: a.agency, due: a.due, status: a.status, completedAt: a.completedAt, evidence: a.evidence, createdAt: at('2026-08-27', '11:00'), createdByName: name(co) });
  }

  // ----- Meetings -----
  makeMeeting(ctx, {
    id: MARION.iad,
    type: 'asp-inter-agency-discussion',
    processId: asp.id,
    subjectIds: [marion.id],
    title: 'ASP inter-agency discussion: Marion Fraser',
    scheduledAt: at('2026-08-27', '10:00'),
    endsAt: at('2026-08-27', '11:00'),
    location: 'Teams call (Portlennan Resource Centre host)',
    status: 'held',
    chairUserId: co,
    chairName: name(co),
    invitees: [
      { userId: co, name: name(co), agency: 'social-work', role: 'Council officer', required: true, attendance: 'present', reason: 'Leads the inquiry', needToKnowRowId: 'asp.inquiry.co' },
      { userId: sw, name: name(sw), agency: 'social-work', role: 'Second worker', required: true, attendance: 'present', reason: 'Second worker for the investigation', needToKnowRowId: 'asp.investigation.co' },
      { userId: ds, name: `DS ${name(ds)}`, agency: 'police', role: 'Detective sergeant, PPU', required: true, attendance: 'present', reason: 'Criminal element', needToKnowRowId: 'asp.inquiry.police' },
      { userId: gp, name: `Dr ${name(gp)}`, agency: 'health', role: 'GP', required: true, attendance: 'remote', reason: 'Health input on diagnosis and capacity', needToKnowRowId: 'asp.inquiry.gp' },
      { userId: opg, name: name(opg), agency: 'regulator', role: 'OPG investigations officer', required: false, attendance: 'remote', reason: 'Financial harm; register and banking safeguards', needToKnowRowId: 'asp.investigation.opg' },
    ],
    agenda: [
      { id: 'ag_marion_iad_1', order: 1, title: 'Concern and what each agency holds', status: 'done' },
      { id: 'ag_marion_iad_2', order: 2, title: 'Capacity, consent and advocacy', status: 'done' },
      { id: 'ag_marion_iad_3', order: 3, title: 'Investigation plan: s7, s8, s10, police enquiries', status: 'done' },
      { id: 'ag_marion_iad_4', order: 4, title: 'Immediate safeguards with the bank', status: 'done' },
      { id: 'ag_marion_iad_5', order: 5, title: 'Case conference date', status: 'done' },
    ],
    informationShared: [
      { id: 'is_marion_iad_1', agency: 'police', byName: `DS ${name(ds)}`, byUserId: ds, at: at('2026-08-27', '10:05'), summary: 'Bank report: 31 withdrawals, £2,410, 8 Jun to 17 Aug, 19 from the Auchentorran machine near Duncan Fraser\'s flat. Branch statement taken. No crime recorded yet.', relevance: 'Pattern and scale of the financial harm', linkedEventIds: [MARION.concernEvent] },
      { id: 'is_marion_iad_2', agency: 'health', byName: `Dr ${name(gp)}`, byUserId: gp, at: at('2026-08-27', '10:15'), summary: 'Vascular dementia diagnosed November 2025; capacity fluctuates, clearer in the mornings. Power of attorney recommended in March and November 2025; not taken up. Low mood in July, "worried about money".', relevance: 'Vulnerability and capacity', linkedEventIds: [] },
      { id: 'is_marion_iad_3', agency: 'regulator', byName: name(opg), byUserId: opg, at: at('2026-08-27', '10:25'), summary: 'Register check requested; result expected 28 Aug. If no power of attorney, the OPG can advise the bank on a Part 3 access to funds application or a third-party mandate limited to shopping.', relevance: 'Existing powers and banking safeguards', linkedEventIds: [] },
      { id: 'is_marion_iad_4', agency: 'social-work', byName: name(sw), byUserId: sw, at: at('2026-08-27', '10:35'), summary: 'Care at home since April: two visits a day. Carers record Duncan present at most morning visits since June, Marion without cash for the milkman in June, fridge nearly empty twice in August.', relevance: 'Corroboration from the care at home log', linkedEventIds: [] },
    ],
    decisions: [
      { id: 'dec_marion_iad_1', question: 'Investigation plan', decision: 's7 visit and s8 interview on 28 Aug, morning, council officer and second worker, advocate present, Duncan asked to leave the room', rationale: 'Marion must be heard away from her nephew and at the time of day she is clearest', dissent: [], decidedByName: name(co), decidedByUserId: co, decidedAt: at('2026-08-27', '10:40') },
      { id: 'dec_marion_iad_2', question: 'Records and police enquiries', decision: 's10 request to the GP; police to obtain statements and machine footage and interview Duncan Fraser under caution', rationale: 'Establish the pattern and whether a crime has been committed', dissent: [], decidedByName: name(co), decidedByUserId: co, decidedAt: at('2026-08-27', '10:45') },
      { id: 'dec_marion_iad_3', question: 'Capacity', decision: 'Open a linked AWI process; ask Dr Farouk to assess capacity for financial decisions before the conference', rationale: 'The protective options depend on whether Marion can decide about her own money', dissent: [], decidedByName: name(co), decidedByUserId: co, decidedAt: at('2026-08-27', '10:50') },
      { id: 'dec_marion_iad_4', question: 'Immediate safeguards', decision: 'Keep the bank\'s £100 daily limit; second worker to arrange a new account with a card only to Marion, with her agreement', rationale: 'Least restrictive step that stops further loss', dissent: [{ byName: `DS ${name(ds)}`, byUserId: ds, agency: 'police', text: 'Police would prefer the card cancelled outright now; accepted the new account route so that Marion keeps access to her own money.' }], decidedByName: name(co), decidedByUserId: co, decidedAt: at('2026-08-27', '10:55') },
      { id: 'dec_marion_iad_5', question: 'Case conference', decision: 'Initial case conference 11 Sep, within the 21-day local timescale', rationale: 'Allows the capacity assessment and police interview to complete', dissent: [], decidedByName: name(co), decidedByUserId: co, decidedAt: at('2026-08-27', '10:58') },
    ],
    actionIds: actions.map((a) => a.id),
    viewsRecordIds: [],
    minute: { status: 'distributed', draftedAt: at('2026-08-27', '12:30'), approvedAt: at('2026-08-27', '15:00'), distributedAt: at('2026-08-27', '15:20') },
    distribution: [
      { id: 'dist_marion_iad_1', recipientName: `DS ${name(ds)}`, recipientUserId: ds, agency: 'police', role: 'Detective sergeant', detailLevel: 'full', reason: 'Attended; criminal element', sharingRecordId: 'shr_marion_1' },
      { id: 'dist_marion_iad_2', recipientName: `Dr ${name(gp)}`, recipientUserId: gp, agency: 'health', role: 'GP', detailLevel: 'full', reason: 'Attended; health input', sharingRecordId: 'shr_marion_2' },
      { id: 'dist_marion_iad_3', recipientName: name(opg), recipientUserId: opg, agency: 'regulator', role: 'OPG', detailLevel: 'fields', fields: ['adult name and date of birth', 'nature of financial concern', 'whether a power of attorney or guardianship exists'], reason: 'Financial harm', sharingRecordId: 'shr_marion_5' },
    ],
    reviewDate: '2026-09-11',
  });

  makeMeeting(ctx, {
    id: MARION.caseConference,
    type: 'asp-case-conference',
    processId: asp.id,
    subjectIds: [marion.id],
    title: 'ASP case conference: Marion Fraser',
    scheduledAt: at('2026-09-11', '10:00'),
    endsAt: at('2026-09-11', '12:00'),
    location: 'Portlennan Resource Centre, room 1',
    status: 'scheduled',
    chairUserId: chair,
    chairName: name(chair),
    minuteTakerUserId: minutes,
    minuteTakerName: name(minutes),
    invitees: [
      { userId: co, name: name(co), agency: 'social-work', role: 'Council officer', required: true, attendance: 'accepted', reason: 'Council officer\'s report', needToKnowRowId: 'asp.investigation.co' },
      { userId: sw, name: name(sw), agency: 'social-work', role: 'Second worker', required: true, attendance: 'accepted', reason: 'Second worker', needToKnowRowId: 'asp.investigation.co' },
      { userId: ds, name: `DS ${name(ds)}`, agency: 'police', role: 'Detective sergeant, PPU', required: true, attendance: 'accepted', reason: 'Criminal investigation', needToKnowRowId: 'asp.inquiry.police' },
      { userId: gp, name: `Dr ${name(gp)}`, agency: 'health', role: 'GP', required: true, attendance: 'invited', reason: 'Capacity assessment and health input', needToKnowRowId: 'asp.inquiry.gp' },
      { userId: adv, name: name(adv), agency: 'third-sector', role: 'Independent advocate', required: true, attendance: 'accepted', reason: 'Supports Marion to take part', needToKnowRowId: 'asp.conference.advocate' },
      { userId: opg, name: name(opg), agency: 'regulator', role: 'OPG investigations officer', required: false, attendance: 'invited', reason: 'Financial harm; summary only', needToKnowRowId: 'asp.investigation.opg' },
      { name: 'Marion Fraser', agency: 'social-work', role: 'Adult', required: true, attendance: 'invited', reason: 'The adult; attending for the first part with her advocate' },
    ],
    agenda: [
      { id: 'ag_marion_cc_1', order: 1, title: 'Introductions, purpose and confidentiality', status: 'pending' },
      { id: 'ag_marion_cc_2', order: 2, title: 'Marion\'s views', status: 'pending' },
      { id: 'ag_marion_cc_3', order: 3, title: 'Council officer\'s report and integrated chronology', status: 'pending' },
      { id: 'ag_marion_cc_4', order: 4, title: 'Capacity assessment and AWI route', status: 'pending' },
      { id: 'ag_marion_cc_5', order: 5, title: 'Is Marion an adult at risk? Is a protection plan needed?', status: 'pending' },
      { id: 'ag_marion_cc_6', order: 6, title: 'Protection orders: banning order application', status: 'pending' },
      { id: 'ag_marion_cc_7', order: 7, title: 'Plan owners, dates and review', status: 'pending' },
    ],
    preMeetingRequests: [
      { id: 'pmr_marion_cc_1', agency: 'health', toName: `Dr ${name(gp)}`, toUserId: gp, sentAt: at('2026-09-01', '09:00'), dueAt: '2026-09-08', status: 'returned', returnSummary: 'GP report: diagnosis, fluctuating capacity, advice on power of attorney given twice, July low mood. Capacity assessment to follow on 4 Sep.', returnedAt: at('2026-09-01', '17:10') },
      { id: 'pmr_marion_cc_2', agency: 'police', toName: `DS ${name(ds)}`, toUserId: ds, sentAt: at('2026-09-01', '09:00'), dueAt: '2026-09-08', status: 'sent' },
      { id: 'pmr_marion_cc_3', agency: 'third-sector', toName: 'Fiona Watt, vulnerable customer lead, Clydeshore Savings Bank (by letter)', sentAt: at('2026-09-01', '09:00'), dueAt: '2026-09-08', status: 'sent' },
    ],
    pack: [
      { id: 'pk_marion_cc_1', kind: 'chronology', label: 'Integrated chronology, 2024 to date', windowFrom: '2024-01-01', windowTo: '2026-09-10', included: true },
      { id: 'pk_marion_cc_2', kind: 'report', label: 'Council officer\'s report', ref: 'act_marion_4', included: false },
      { id: 'pk_marion_cc_3', kind: 'views', label: 'Marion\'s views (28 Aug, via advocate)', ref: 'vw_marion_1', included: true },
      { id: 'pk_marion_cc_4', kind: 'risk-assessment', label: 'Three-point test', ref: MARION.threePointTest, included: true },
      { id: 'pk_marion_cc_5', kind: 'report', label: 'OPG register result', ref: 'OPG-REG-2026-41877', included: true },
      { id: 'pk_marion_cc_6', kind: 'report', label: 'GP report', ref: 'pmr_marion_cc_1', included: true },
    ],
    actionIds: actions.map((a) => a.id),
    viewsRecordIds: ['vw_marion_1'],
    minute: { status: 'not-started' },
    // Indicators 5 and 6: invited and, at a scheduled conference, not yet attended.
    aspAttendance: { adultInvited: true, adultAttended: false, advocateInvited: true, advocateAttended: false },
    subjectAttendance: 'Marion will attend the first part with her advocate Tam Guthrie; a morning slot was chosen because she is clearer then. Duncan Fraser is not invited: alleged perpetrator, chair\'s decision recorded 1 Sep; he will be told the outcome by the council officer.',
  });

  // ----- Sharing records -----
  const share = (id: string, stage: Process['stage'], to: string, agency: Agency, role: string, level: 'full' | 'summary' | 'fields' | 'presence', reason: string, summary: string, createdAt: string, rowId?: string, fields?: string[], status: 'sent' | 'read' = 'read') =>
    makeShare(ctx, { id, processId: asp.id, subjectId: marion.id, stage, recipient: { userId: to, name: name(to), agency, role }, detailLevel: level, fields, lawfulBasisId: lb.id, channel: agency === 'regulator' ? 'secure-email-digest' : 'in-app', status, createdAt, sentAt: createdAt, readAt: status === 'read' ? createdAt : undefined, reason, needToKnowRowId: rowId, createdByUserId: co, createdByName: name(co), summary });
  share('shr_marion_1', 'inquiry', ds, 'police', 'Detective sergeant, PPU', 'full', 'Inquiry opened. If there is a criminal element.', 'Adult concern, three-point test and inquiry record; request for bank enquiries', at('2026-08-21', '12:40'), 'asp.inquiry.police');
  share('shr_marion_2', 'inquiry', gp, 'health', 'GP', 'full', 'Inquiry opened. If health input is needed.', 'Adult concern and inquiry record; request for information on diagnosis and capacity', at('2026-08-21', '12:40'), 'asp.inquiry.gp');
  share('shr_marion_3', 'investigation', gp, 'health', 'GP', 'fields', 's10 records request sent. If records are requested under s10.', 's10 request: consultations 2024 to 2026 and memory clinic letter; purpose: capacity and vulnerability; council officer contact 01000 512244', at('2026-08-27', '16:00'), 'asp.investigation.records', ['s10 records request', 'purpose of request', 'council officer contact']);
  share('shr_marion_4', 'investigation', adv, 'third-sector', 'Independent advocate', 'summary', 'Advocacy offered. If advocacy has been offered.', 'Investigation opened; s7 visit and s8 interview 28 Aug, morning; Marion has asked for an advocate', at('2026-08-27', '11:10'), 'asp.investigation.advocacy');
  share('shr_marion_5', 'investigation', opg, 'regulator', 'OPG investigations officer', 'fields', 'Financial harm identified. If financial harm or attorney or guardian conduct is in question.', 'Marion Fraser, born 19 Feb 1947; cash withdrawals by a nephew holding her card; register check requested', at('2026-08-27', '11:10'), 'asp.investigation.opg', ['adult name and date of birth', 'nature of financial concern', 'whether a power of attorney or guardianship exists']);
  share('shr_marion_6', 'case-conference', chair, 'social-work', 'Chair', 'full', 'Case conference scheduled.', 'Full record for the chair: concern, inquiry, investigation, views, draft orders', at('2026-09-01', '09:00'), 'asp.conference.chair', undefined, 'sent');

  // ----- Chronology events -----
  const E = (e: Omit<Parameters<typeof makeEvent>[1], 'subjectIds'> & { subjectIds?: string[] }) =>
    makeEvent(ctx, { subjectIds: [marion.id], linkedProcessIds: [asp.id], visibility: 'integrated', lawfulBasisId: lb.id, ...e });

  E({ occurredAt: at('2019-06-03', '00:00'), agency: 'health', sourceSystem: 'emis-web', recordedByName: 'EMIS Web connector', eventType: 'family.death', title: 'Husband Iain Fraser died', detail: 'Recorded in the GP record. Marion widowed after 48 years of marriage. Bereavement support offered; she declined, saying her nephew and neighbours were "plenty".', significance: 'low' });
  E({ occurredAt: at('2024-02-13', '10:20'), agency: 'health', sourceSystem: 'emis-web', recordedByName: 'EMIS Web connector', eventType: 'health.consultation', title: 'GP consultation: memory concerns raised by Marion', detail: 'Marion reported forgetting appointments and twice leaving the cooker on. Blood tests arranged. Referred to the memory clinic.', significance: 'moderate' });
  E({ occurredAt: at('2024-05-20', '00:00'), agency: 'health', sourceSystem: 'trakcare', recordedByName: 'TrakCare connector', eventType: 'health.assessment', title: 'Memory clinic: mild cognitive impairment, review in 12 months', detail: 'Cognitive testing and CT scan. Mild cognitive impairment, vascular changes noted. Advice on driving and finances given in writing.', significance: 'moderate' });
  E({ occurredAt: at('2024-11-07', '11:00'), agency: 'health', sourceSystem: 'emis-web', recordedByName: 'EMIS Web connector', eventType: 'health.consultation', title: 'GP: blood pressure review', detail: 'Attended alone by bus. Blood pressure controlled. No new concerns.', significance: 'low', visibility: 'agency-only', lawfulBasisId: undefined });
  E({ occurredAt: at('2025-03-18', '09:40'), agency: 'health', sourceSystem: 'emis-web', recordedByName: 'EMIS Web connector', eventType: 'health.consultation', title: 'GP: attended with nephew, who asked about "helping with her money"', detail: 'Duncan Fraser accompanied Marion and asked whether she "should still be dealing with the bank". Dr Farouk advised that Marion could grant a power of attorney while she is able to decide, and gave a leaflet. Marion said she would "think about it".', significance: 'moderate', significanceReason: 'First record of the nephew involved in her finances', linkedPersonIds: [duncan.id] });
  E({ occurredAt: at('2025-11-12', '14:30'), agency: 'health', sourceSystem: 'trakcare', recordedByName: 'TrakCare connector', eventType: 'health.diagnosis', title: 'Vascular dementia diagnosed at the memory clinic; disclosed to Marion and her nephew', detail: 'Repeat cognitive testing and scan consistent with vascular dementia. Marion told with Duncan present at her request. Capacity noted as fluctuating and better in the mornings. Power of attorney recommended again; letter copied to the GP.', significance: 'high', significanceReason: 'Diagnosis that makes her more vulnerable to harm (three-point test limb c)', linkedPersonIds: [duncan.id] });
  E({ occurredAt: at('2026-01-20', '15:10'), agency: 'health', sourceSystem: 'emis-web', recordedByName: 'EMIS Web connector', eventType: 'health.consultation', title: 'GP home visit: chest infection', detail: 'Antibiotics prescribed. Nephew present.', significance: 'low', visibility: 'agency-only', lawfulBasisId: undefined });
  E({ occurredAt: at('2026-03-09', '02:15'), agency: 'health', sourceSystem: 'trakcare', recordedByName: 'TrakCare connector', eventType: 'health.admission', title: 'Admitted to Clydeshore Royal Infirmary after a fall at home', detail: 'Found on the kitchen floor by her nephew at about 01:30. Bruising to hip and shoulder, no fracture. Confused on admission; delirium settled by day 3. Five nights on ward 4.', significance: 'high', significanceReason: 'First admission; led to care at home', linkedPersonIds: [duncan.id] });
  E({ occurredAt: at('2026-03-14', '00:00'), agency: 'health', sourceSystem: 'trakcare', recordedByName: 'TrakCare connector', eventType: 'health.discharge', title: 'Discharged home; care at home recommended', detail: 'Occupational therapy assessment: needs prompting with meals and medication, unsafe with the cooker unsupervised. Referred to Adult Services, Portlennan.', significance: 'moderate' });
  E({ occurredAt: at('2026-03-20', '00:00'), agency: 'social-work', sourceSystem: 'carefirst', recordedByName: 'CareFirst connector', eventType: 'social-work.assessment', title: 'Community care assessment: care at home twice a day', detail: 'Assessment by Stuart Blair. Marion wants to stay at home. Nephew described as main support. Care at home for morning and teatime visits; key safe fitted.', significance: 'moderate' });
  E({ occurredAt: at('2026-04-06', '00:00'), agency: 'social-work', sourceSystem: 'carefirst', recordedByName: 'CareFirst connector', eventType: 'care.service-start', title: 'Care at home started: morning and teatime visits', detail: 'Clydeshore Care at Home. Medication prompts, meals, welfare check. Carers to record who is in the house.', significance: 'low' });
  E({ occurredAt: at('2026-06-01', '00:00'), approximate: true, agency: 'social-work', recordedByName: name(sw), recordedByUserId: sw, eventType: 'household.change', title: 'Nephew Duncan Fraser began staying overnight in the spare room', detail: 'Date approximate, from the care at home log and Marion\'s account. Duncan keeps his tenancy in Auchentorran and stays "three or four nights" a week. Carers record him present at most morning visits from June.', significance: 'moderate', significanceReason: 'Household change coinciding with the start of the withdrawals', linkedPersonIds: [duncan.id] });
  E({ occurredAt: at('2026-06-24', '08:20'), agency: 'social-work', sourceSystem: 'carefirst', recordedByName: 'CareFirst connector', eventType: 'care.provider-concern', title: 'Care at home: Marion had no cash for the milkman and said "Duncan has my card"', detail: 'Carer note. Marion asked the carer to lend her £5. Said her nephew keeps her bank card "so I do not lose it". Coordinator informed.', significance: 'moderate', significanceReason: 'First record of the card being held by the nephew' });
  E({ occurredAt: at('2026-07-15', '10:30'), agency: 'health', sourceSystem: 'emis-web', recordedByName: 'EMIS Web connector', eventType: 'health.consultation', title: 'GP: low in mood, "worried about money"', detail: 'Attended with her nephew. Tearful, not sleeping, said she was "worried about money" but could not say why. Nephew said "she gets confused about the bank". Mood review in four weeks.', significance: 'moderate', linkedPersonIds: [duncan.id] });
  E({ occurredAt: at('2026-08-06', '17:15'), agency: 'social-work', sourceSystem: 'carefirst', recordedByName: 'CareFirst connector', eventType: 'care.provider-concern', title: 'Care at home: fridge nearly empty on two visits this week', detail: 'Carer note. Bread, margarine and one tin. Marion said Duncan "would bring the messages". Carer bought milk and eggs from petty cash. Coordinator to raise with the family.', significance: 'moderate' });
  E({ id: MARION.concernEvent, occurredAt: at('2026-08-20', '15:45'), agency: 'police', sourceSystem: 'ivpd', recordedByName: 'iVPD connector', eventType: 'police.concern-report', title: 'Adult Concern Report: bank raised concern about cash withdrawals', detail: 'Clydeshore Savings Bank reported 31 cash machine withdrawals totalling £2,410 between 8 Jun and 17 Aug, 19 at Auchentorran, several after 22:00. Marion attended the branch on 18 Aug unsure why her balance was low and said her nephew keeps her card.', response: 'Concern report shared with the council adult protection team. Bank placed a £100 daily withdrawal limit.', significance: 'high', significanceReason: 'Pattern of financial harm to an adult with dementia', evidenceRefs: [{ kind: 'connector', ref: 'cev_marion_acr', label: 'iVPD Adult Concern Report' }] });
  E({ occurredAt: at('2026-08-21', '09:30'), agency: 'social-work', recordedByName: name(co), recordedByUserId: co, eventType: 'process.referral', title: 'Adult concern received; three-point test met; inquiry opened', detail: 'Council officer allocated. Screening decision by the team leader: proceed to inquiry. Police, GP and OPG contacted the same day.', significance: 'high', significanceReason: 'ASP process started' });
  E({ occurredAt: at('2026-08-22', '11:00'), agency: 'police', recordedByName: `DS ${name(ds)}`, recordedByUserId: ds, eventType: 'police.incident', title: 'PPU enquiry: branch statement taken; nephew checked on police systems', detail: 'Statement from the branch manager. Duncan Fraser: no previous convictions; one 2023 intelligence entry for a dispute over a debt. Bank asked for statements and machine footage under s5.', significance: 'moderate', visibility: 'agency-only', lawfulBasisId: undefined, linkedPersonIds: [duncan.id] });
  E({ occurredAt: at('2026-08-25', '14:00'), agency: 'social-work', recordedByName: name(co), recordedByUserId: co, eventType: 'social-work.contact', title: 'Council officer spoke with the care at home coordinator', detail: 'Log of who was in the house at each visit since April obtained. Duncan present at 41 of 58 morning visits since 1 Jun. Carers asked to record cash in the house and any distress.', significance: 'moderate', visibility: 'agency-only', lawfulBasisId: undefined });
  E({ occurredAt: at('2026-08-26', '15:00'), agency: 'social-work', recordedByName: name(co), recordedByUserId: co, eventType: 'social-work.assessment', title: 'ASP inquiry decision: proceed to investigation', detail: 'Decision on working day 3. Council officer Moira Gilmour, second worker Stuart Blair. Inter-agency discussion arranged for 27 Aug to plan the investigation.', significance: 'high', significanceReason: 'Inquiry outcome' });
  E({ occurredAt: at('2026-08-27', '10:00'), agency: 'social-work', recordedByName: name(co), recordedByUserId: co, eventType: 'process.case-conference', title: 'ASP inter-agency discussion held: investigation planned', detail: 'Police, GP, OPG and social work. s7 visit and s8 interview 28 Aug with advocate; s10 request to GP; police to obtain records and interview the nephew; AWI process opened; case conference 11 Sep.', significance: 'high', significanceReason: 'Investigation plan agreed across agencies' });
  E({ occurredAt: at('2026-08-27', '14:00'), agency: 'social-work', recordedByName: name(co), recordedByUserId: co, eventType: 'social-work.referral', title: 'AWI process opened: capacity for financial decisions in question', detail: 'Linked to the ASP investigation. Capacity assessment requested from Dr Farouk; OPG register check requested; MHO advice sought on route.', significance: 'moderate', linkedProcessIds: [asp.id, awi.id] });
  E({ occurredAt: at('2026-08-28', '10:30'), agency: 'social-work', recordedByName: name(co), recordedByUserId: co, eventType: 'social-work.visit', title: 's7 visit: council officer and second worker, with advocate', detail: 'Morning visit. Duncan present on arrival and asked to leave the room; agreed after discussion. House warm and tidy; fridge stocked the day before. Bank card not in the house.', significance: 'high', significanceReason: 'Investigation visit', linkedPersonIds: [duncan.id] });
  E({ occurredAt: at('2026-08-28', '11:00'), agency: 'third-sector', recordedByName: name(adv), recordedByUserId: adv, eventType: 'voice.adult', title: 's8 interview: Marion interviewed alone; her views recorded by her advocate', detail: 'Wants to stay at home; fond of Duncan and does not want him "in trouble"; wants her money back and her own card in her purse. Consent to the investigation confirmed in the morning.', significance: 'high', significanceReason: 'The adult\'s own account and wishes' });
  E({ occurredAt: at('2026-08-28', '15:30'), agency: 'regulator', sourceSystem: 'opg', recordedByName: 'OPG register connector', recordedByUserId: opg, eventType: 'other', title: 'OPG register check: no power of attorney, no guardianship', detail: 'Reference OPG-REG-2026-41877. No registered power of attorney, guardianship or intervention order for Marion Fraser. Nephew holds no formal authority over her funds.', significance: 'high', significanceReason: 'The "arrangement" has no legal basis', linkedProcessIds: [asp.id, awi.id] });
  E({ occurredAt: at('2026-09-01', '10:00'), agency: 'health', recordedByName: `Dr ${name(gp)}`, recordedByUserId: gp, eventType: 'sharing', title: 's10 records summary provided to the council officer', detail: 'Summary of consultations 2024 to 2026 and the memory clinic letters. Inspected by Dr Farouk; only the summary shared. Capacity assessment booked for 4 Sep.', significance: 'moderate' });
  E({ occurredAt: at('2026-09-01', '16:20'), agency: 'police', recordedByName: `DS ${name(ds)}`, recordedByUserId: ds, eventType: 'police.incident', title: 'Bank statements received; Duncan Fraser invited for interview under caution on 3 Sep', detail: 'Statements 1 Jun to 20 Aug confirm the withdrawal pattern. Footage requested from Auchentorran Station Brae and Portlennan Quay Wynd machines.', significance: 'moderate', visibility: 'agency-only', lawfulBasisId: undefined, linkedPersonIds: [duncan.id] });

  // Analysis note, kept apart from the facts.
  const patternIds = ctx.data.events.filter((e) => e.subjectIds.includes(marion.id) && (e.eventType === 'household.change' || e.eventType === 'care.provider-concern' || e.id === MARION.concernEvent || (e.eventType === 'health.consultation' && e.occurredAt.startsWith('2026-07')))).map((e) => e.id);
  makeAnalysis(ctx, {
    id: 'ana_marion_1',
    subjectId: marion.id,
    processId: asp.id,
    eventIds: patternIds,
    authorUserId: co,
    authorName: name(co),
    agency: 'social-work',
    recordedAt: at('2026-09-01', '17:30'),
    kind: 'pattern',
    title: 'Withdrawals align with the nephew\'s visits and overnight stays',
    text: 'The bank\'s list of 31 withdrawals between 8 June and 17 August falls on days when the care at home log records Duncan in the house, and 19 of them are from the Auchentorran machine near his flat rather than Portlennan. The pattern begins within a fortnight of him starting to stay overnight. Marion\'s low mood in July and the empty fridge in August follow the same weeks. This is a pattern for the case conference to weigh alongside the police interview; it is not a finding that Duncan took the money.',
  });

  // Connector inbox: the promoted Adult Concern Report and one pending GP record.
  makeConnectorEvent(ctx, {
    id: 'cev_marion_acr',
    connectorId: 'ivpd',
    agency: 'police',
    subjectId: marion.id,
    receivedAt: at('2026-08-20', '16:05'),
    externalRef: 'IVPD-ACR-2026-08-1187',
    sourcePayload: { type: 'Adult Concern Report', adult: 'FRASER, Marion', dob: '19/02/1947', address: '14 Shore Loan, Portlennan', reporter: 'Clydeshore Savings Bank, Portlennan branch', summary: '31 ATM withdrawals £2,410 8 Jun to 17 Aug; adult unsure of balance; nephew holds card', concernHub: `PC ${name(hub)}` },
    mapped: { eventType: 'police.concern-report', title: 'Adult Concern Report: bank raised concern about cash withdrawals', detail: 'Clydeshore Savings Bank reported 31 cash machine withdrawals totalling £2,410 between 8 Jun and 17 Aug. Marion attended the branch unsure why her balance was low and said her nephew keeps her card.', occurredAt: at('2026-08-20', '15:45'), hasTime: true, significance: 'high', mappingRule: 'ivpd.acr.financial-harm' },
    status: 'promoted',
    reviewedByUserId: co,
    reviewedAt: at('2026-08-21', '10:05'),
    promotedEventId: MARION.concernEvent,
  });
  makeConnectorEvent(ctx, {
    id: 'cev_marion_emis',
    connectorId: 'emis-web',
    agency: 'health',
    subjectId: marion.id,
    receivedAt: at('2026-08-30', '21:40'),
    externalRef: 'EMIS-OOH-2026-08-30-4471',
    sourcePayload: { patient: 'FRASER, Marion', practice: 'Portlennan Medical Practice', source: 'Out-of-hours encounter report filed to the practice record', clinician: 'OOH GP (telephone)', code: 'Telephone consultation: anxiety', note: 'Phoned NHS 24 at 18:50 distressed; says nephew took her card "for safe keeping" and she has no money for the weekend; no physical complaint; advice given; practice to follow up Monday' },
    mapped: { eventType: 'health.consultation', title: 'Out-of-hours GP telephone consultation: distressed, "no money for the weekend"', detail: 'Marion phoned NHS 24 at 18:50, distressed, saying her nephew had taken her card "for safe keeping" and she had no money for the weekend. No physical complaint. Advice given; practice asked to follow up on Monday.', occurredAt: at('2026-08-30', '19:05'), hasTime: true, significance: 'high', mappingRule: 'emis.consultation.safeguarding-context' },
  });

  /*
   * The outbox, carrying one of each state that matters.
   *
   * A product that only ever shows the happy path is a product nobody believes about the unhappy
   * one, and the unhappy path is the whole reason the outbox exists: if Person360 believes the
   * inquiry is open in the council's system and the write failed, a worker looking only at that
   * system sees nothing.
   */
  makeOutbound(ctx, {
    id: 'out_marion_episode',
    connectorId: 'eclipse',
    intent: 'open-process',
    idempotencyKey: 'eclipse:open-process:prc_asp_marion',
    subjectPersonId: marion.id,
    processId: MARION.asp,
    payload: [
      { field: 'Episode.Type', value: 'ASP', from: 'process.type' },
      { field: 'Episode.OpenedDate', value: '2026-08-21', from: 'process.openedAt' },
      { field: 'Episode.Stage', value: 'inquiry', from: 'process.stage' },
      { field: 'Episode.AllocatedWorker', value: name(co), from: 'process.leadUserId' },
      { field: 'Episode.CaseReference', value: 'ASP-2026-0217', from: 'process.reference' },
    ],
    state: 'acknowledged',
    proposedAt: at('2026-08-21', '10:12'),
    proposedByName: name(co),
    authorisation: { at: at('2026-08-21', '10:14'), byUserId: co, byName: name(co), purpose: 'So the inquiry exists in the council record and the duty team is not asked to enter it a second time.', lawfulBasisId: 'lb_asp_duty' },
    sentAt: at('2026-08-21', '10:14'),
    acknowledgedAt: at('2026-08-21', '10:15'),
    externalRef: 'ECLIPSE-RION',
    relayedBytes: 604,
  });
  makeOutbound(ctx, {
    id: 'out_marion_stage',
    connectorId: 'eclipse',
    intent: 'stage-change',
    idempotencyKey: 'eclipse:stage-change:prc_asp_marion',
    subjectPersonId: marion.id,
    processId: MARION.asp,
    payload: [
      { field: 'Episode.CaseReference', value: 'ASP-2026-0217', from: 'process.reference' },
      { field: 'Episode.Stage', value: 'investigation', from: 'process.stage' },
    ],
    state: 'proposed',
    proposedAt: at('2026-09-01', '09:20'),
    proposedByName: name(co),
  });
  // The failure. A GP practice flag that did not land, so nobody at the practice has been told.
  makeOutbound(ctx, {
    id: 'out_marion_gp_flag',
    connectorId: 'emis-web',
    intent: 'flag',
    idempotencyKey: 'emis-web:flag:per_marion_fraser',
    subjectPersonId: marion.id,
    processId: MARION.asp,
    payload: [
      { field: 'Problem.Code', value: 'Adult support and protection inquiry open (fictional code 9998004)', from: 'process.type' },
      { field: 'Task.Assignee', value: 'Portlennan Medical Practice, practice safeguarding lead', from: 'connector.route' },
      { field: 'Task.Summary', value: 'ASP inquiry open. Records request under section 10 to follow.', from: 'process.reference' },
    ],
    state: 'failed',
    proposedAt: at('2026-08-21', '10:20'),
    proposedByName: name(co),
    authorisation: { at: at('2026-08-21', '10:22'), byUserId: co, byName: name(co), purpose: 'So the practice knows an inquiry is open before the records request arrives.', lawfulBasisId: 'lb_asp_duty' },
    sentAt: at('2026-08-21', '10:22'),
    failure: { at: at('2026-08-21', '10:23'), reason: 'Gateway rejected: practice not yet enrolled in the partner programme for write-back.' },
    attempts: 2,
    relayedBytes: 512,
  });

  /*
   * Inbound: a case opened in the council system that has not been raised here, and our own episode
   * write coming back on the same feed. The second one is the echo, and it is in the seed precisely
   * so the defence against it is demonstrable rather than described.
   */
  makeInbound(ctx, {
    id: 'inb_eclipse_new',
    connectorId: 'eclipse',
    kind: 'process-proposal',
    receivedAt: at('2026-09-03', '08:40'),
    externalRef: 'ECL-EP-2026-4471',
    subjectHint: { displayName: 'FRASER, Marion', dateOfBirth: '1947-02-19', externalId: 'ECL-119203' },
    subjectPersonId: marion.id,
    payload: [
      { field: 'Episode.Type', value: 'ASP', from: 'ECLIPSE' },
      { field: 'Episode.OpenedDate', value: '2026-09-03', from: 'ECLIPSE' },
      { field: 'Episode.Stage', value: 'inquiry', from: 'ECLIPSE' },
      { field: 'Episode.AllocatedWorker', value: 'Duty team, Portlennan', from: 'ECLIPSE' },
    ],
  });
  makeInbound(ctx, {
    id: 'inb_eclipse_echo',
    connectorId: 'eclipse',
    kind: 'echo',
    receivedAt: at('2026-08-21', '10:31'),
    externalRef: 'ECLIPSE-RION',
    echoOf: 'eclipse:open-process:prc_asp_marion',
    subjectHint: { displayName: 'FRASER, Marion', dateOfBirth: '1947-02-19', externalId: 'ECL-119203' },
    subjectPersonId: marion.id,
    payload: [
      { field: 'Episode.CaseReference', value: 'ASP-2026-0217', from: 'ECLIPSE' },
      { field: 'Episode.Stage', value: 'inquiry', from: 'ECLIPSE' },
    ],
    status: 'reconciled',
    processId: MARION.asp,
  });
}
