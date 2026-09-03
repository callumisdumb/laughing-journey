/**
 * Scenario 5: Tomasz Nowak, 44, Dunlarrick. Adult Support and Protection, self-neglect and
 * hoarding, fire risk raised by Scottish Fire and Rescue. He has capacity and declines
 * intervention; undue pressure considered and not found; a support-only response was agreed at
 * the case conference with his consent. Polish interpreter required throughout.
 */
import type { Agency, Process } from '@mas/domain';
import type { BuildContext } from '../../generator/context';
import { at, makeAction, makeAddress, makeAnalysis, makeEvent, makeLawfulBasis, makeMeeting, makePerson, makePlan, makeRisk, makeShare, makeViews, syntheticChi } from '../../generator/factory';
import { USR, userName } from '../../generator/organisations';

export const TOMASZ = {
  tomasz: 'per_tomasz_nowak',
  process: 'prc_asp_tomasz',
  iad: 'mtg_tomasz_iad',
  caseConference: 'mtg_tomasz_cc',
  review: 'mtg_tomasz_review',
  plan: 'pln_tomasz_support',
  threePointTest: 'ra_tomasz_3pt',
} as const;

const INTERPRETER = 'Ewa Zielińska (Polish interpreter)';

export function seedTomaszNowak(ctx: BuildContext): void {
  const name = (id: string) => userName(ctx, id);

  const vennel = makeAddress(ctx, { id: 'adr_tomasz_home', line1: '3 Distillery Vennel', town: 'Dunlarrick', postcode: 'QX4 5HN' });
  const hh = 'hh_nowak';
  const tomasz = makePerson(ctx, {
    id: TOMASZ.tomasz,
    givenName: 'Tomasz',
    familyName: 'Nowak',
    sex: 'male',
    dateOfBirth: '1982-03-30',
    chi: syntheticChi(ctx, '1982-03-30', 'male'),
    addressHistory: [{ addressId: vennel.id, from: '2016-09-12', note: 'Council tenancy, one-bedroom ground floor flat' }],
    householdId: hh,
    communicationNeeds: { interpreterLanguage: 'Polish', needs: ['Polish interpreter for meetings and visits'], note: 'Reads English well; prefers to speak Polish for anything that matters. Written material to be provided in Polish.' },
    contact: { phone: '07700 900318' },
    gpPractice: 'Portlennan Medical Practice',
    ethnicity: 'polish',
    createdAt: at('2016-09-12', '10:00'),
  });
  ctx.data.households.push({ id: hh, synthetic: true, addressId: vennel.id, memberIds: [tomasz.id], label: 'Nowak household, Dunlarrick' });

  const co = USR.moiraGilmour;
  const sw = USR.stuartBlair;
  const fire = USR.gordonNairn;
  const housing = USR.markHepburn;
  const gp = USR.amiraFarouk;
  const adv = USR.tamGuthrie;
  const chair = USR.davidLaird;
  const minutes = USR.lesleyMorton;
  const teamLeader = 'Eilidh Munro, team leader, Adult Protection Team';

  const lb = makeLawfulBasis(ctx, {
    id: 'lb_tomasz_asp',
    purpose: 'Adult Support and Protection inquiry into self-neglect and fire risk, and the support plan that followed, for Tomasz Nowak',
    article6: '6(1)(c) legal obligation',
    article9Condition: '9(2)(g) substantial public interest, DPA 2018 Sch 1 Pt 2 para 18 (safeguarding)',
    article10Criminal: 'not applicable',
    statutoryGateway: ['Adult Support and Protection (Scotland) Act 2007 s4 (duty to make inquiries)', 'Adult Support and Protection (Scotland) Act 2007 s5 (duty to cooperate)', 'Fire (Scotland) Act 2005 (home fire safety visits)'],
    necessityAndProportionality: 'Sharing between the council, Scottish Fire and Rescue, housing, his GP and his advocate is necessary to assess the fire risk and agree support he accepts. Only events about the condition of his home, his health and the support plan are included. Nothing is shared with neighbours or family.',
    consentStatus: 'sought-and-given',
    consentNote: 'Consent given through a Polish interpreter on 19 Jun 2026 for information to be shared between the council, SFRS, housing, his GP and Clydeshore Advocacy for the inquiry and the support plan. Reconfirmed at the case conference on 9 Jul.',
    authorisedByUserId: co,
    authorisedByName: name(co),
    informationSharingAgreementRef: 'Clydeshore APC ISA 2023/02',
    dpiaRef: 'DPIA-ASP-2023-04',
    createdAt: at('2026-06-08', '11:00'),
  });

  makeRisk(ctx, {
    id: TOMASZ.threePointTest,
    processId: TOMASZ.process,
    subjectId: tomasz.id,
    tool: 'three-point-test',
    assessedAt: at('2026-06-08', '10:00'),
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

  const process: Process = {
    id: TOMASZ.process,
    synthetic: true,
    type: 'asp',
    reference: 'ASP-2026-0141',
    title: 'Adult Support and Protection: Tomasz Nowak (self-neglect, fire risk)',
    subjectIds: [tomasz.id],
    leadAgency: 'social-work',
    leadUserId: co,
    stage: 'support-plan',
    stageHistory: [
      { stage: 'concern', at: at('2026-06-05', '14:20'), byUserId: fire, byName: name(fire), note: 'Fire risk concern after a home fire safety visit' },
      { stage: 'screening', at: at('2026-06-08', '10:00'), byUserId: co, byName: name(co), note: 'Three-point test met on all three limbs' },
      { stage: 'inquiry', at: at('2026-06-08', '10:30'), byName: teamLeader, note: 'Duty decision: proceed to inquiry' },
      { stage: 'investigation', at: at('2026-06-17', '09:00'), byUserId: co, byName: name(co), note: 'Inquiry decision 12 Jun: proceed to investigation. Interpreter booked' },
      { stage: 'case-conference', at: at('2026-07-09', '10:00'), byUserId: chair, byName: name(chair), note: 'Initial case conference held with Mr Nowak present' },
      { stage: 'support-plan', at: at('2026-07-09', '12:00'), byUserId: chair, byName: name(chair), note: 'Adult at risk; no protection plan; support-only response with his consent' },
    ],
    status: 'open',
    classification: 'official-sensitive',
    openedAt: at('2026-06-05', '14:20'),
    members: [
      { userId: co, caseRole: 'council officer', agency: 'social-work', since: '2026-06-05', reason: 'Allocated council officer (s52) for the inquiry and investigation' },
      { userId: sw, caseRole: 'second worker and plan coordinator', agency: 'social-work', since: '2026-06-17', reason: 'Second worker; coordinates the support plan' },
      { userId: fire, caseRole: 'community safety officer', agency: 'fire-rescue', since: '2026-06-05', reason: 'Referrer; fire safety measures' },
      { userId: housing, caseRole: 'housing officer', agency: 'housing', since: '2026-06-08', reason: 'Council tenancy; enforcement paused under the plan' },
      { userId: gp, caseRole: 'GP', agency: 'health', since: '2026-06-08', reason: 'Health input: depression; capacity assessment; mood review' },
      { userId: adv, caseRole: 'independent advocate', agency: 'third-sector', since: '2026-06-17', reason: 'Advocacy offered and accepted' },
      { userId: chair, caseRole: 'chair', agency: 'social-work', since: '2026-06-22', reason: 'Independent chair of the case conference and review' },
      { userId: minutes, caseRole: 'minute taker', agency: 'social-work', since: '2026-06-22', reason: 'Minutes, invitations and pack' },
    ],
    clocks: [
      { id: 'clk_tomasz_inquiry', ruleId: 'asp.inquiry.decision', triggeredAt: at('2026-06-05', '14:20'), completedAt: at('2026-06-12', '15:00'), note: 'Decision on working day 5' },
      { id: 'clk_tomasz_cc', ruleId: 'asp.caseconference.initial', triggeredAt: at('2026-06-05', '14:20'), completedAt: at('2026-07-09', '10:00'), dueOverride: '2026-07-10', overrideReason: 'Extended by the team leader on 22 Jun: Mr Nowak asked for a date when his interpreter and his advocate could both attend. National guidance sets no timescale; the local 21 days would have fallen on 26 Jun.' },
      { id: 'clk_tomasz_review', ruleId: 'asp.plan.review', triggeredAt: at('2026-07-09', '12:00'), note: 'Review conference booked for 8 Oct, within the three-month local timescale' },
    ],
    linkedProcessIds: [],
    viewsRecordIds: ['vw_tomasz_1', 'vw_tomasz_2'],
    riskAssessmentIds: [TOMASZ.threePointTest],
    flags: { healthInput: true, housingRelevant: true, advocacyOffered: true, criminalElement: false, regulatedService: false, financialHarm: false, jointVisit: false, medicalExamination: false, recordsRequest: false },
    parties: [],
    detail: {
      concern: {
        receivedAt: at('2026-06-05', '14:20'),
        source: 'Scottish Fire and Rescue Service, Community Safety, Dunlarrick (Gordon Nairn) after a home fire safety visit',
        sourceAgency: 'fire-rescue',
        sourceReference: 'SFRS-HFSV-2026-0611',
        summary: 'Home fire safety visit requested by housing after a neighbour reported the smoke alarm sounding. Newspapers and magazines stacked floor to ceiling in the living room and hall; rear door blocked; one working alarm; paper within half a metre of the cooker. Mr Nowak was polite, accepted alarms and declined help to clear.',
        harmTypes: ['self-neglect'],
        immediateSafety: 'Fire risk rated high by SFRS. Two additional smoke alarms fitted on the day. Mr Nowak agreed to keep the cooker area clear. No immediate risk to life provided the alarms work; SFRS to re-check within two weeks.',
        policeInvolved: false,
      },
      threePointTest: {
        assessedAt: at('2026-06-08', '10:00'),
        byName: name(co),
        byUserId: co,
        a: { met: 'yes', reasoning: 'Mr Nowak cannot keep his home safe from fire without help. The volume of paper and the blocked exit put his wellbeing and his tenancy at risk and he has not been able to reduce it despite housing letters since 2025.' },
        b: { met: 'yes', reasoning: 'Serious risk of harm from fire, to himself and to neighbours in the close, and risk of losing his tenancy through enforcement.' },
        c: { met: 'yes', reasoning: 'Long-standing depression treated by his GP since 2019. Low motivation and avoidance are part of the illness and make him more vulnerable to harm from self-neglect than an adult who is not so affected.' },
        outcome: 'met',
      },
      screening: {
        outcome: 'proceed-to-inquiry',
        rationale: 'Three-point test met. Self-neglect with a high fire risk confirmed by SFRS. Not an emergency: alarms fitted and he has agreed to keep the cooker clear.',
        at: at('2026-06-08', '10:30'),
        byName: teamLeader,
      },
      inquiry: {
        openedAt: at('2026-06-08', '10:30'),
        interAgencyDiscussionMeetingId: TOMASZ.iad,
        agenciesContacted: ['fire-rescue', 'health', 'housing', 'social-work'],
        outcome: 'proceed-to-investigation',
        rationale: 'Fire risk confirmed by SFRS; housing has served two tenancy warning letters; the GP confirms depression and a gap in treatment. An investigation with an interpreter is needed to establish what Mr Nowak understands, whether he has capacity for decisions about his home, and what he will accept.',
        decidedAt: at('2026-06-12', '15:00'),
      },
      investigation: {
        councilOfficerUserId: co,
        secondWorkerUserId: sw,
        visits: [
          { at: at('2026-06-19', '10:00'), power: 's7', byNames: [name(co), name(sw), INTERPRETER], note: 'Visit at 3 Distillery Vennel with the interpreter. Mr Nowak let us in and showed us round. Paper stacked to the ceiling in the living room and hall with a narrow path; kitchen usable; bedroom clear; rear door blocked. New alarms in place and working. He was calm, courteous and clear about what he would and would not accept.' },
        ],
        interviews: [
          { at: at('2026-06-19', '10:30'), power: 's8', withPersonId: tomasz.id, note: 'Interviewed at home in Polish through the interpreter, alone at his request. He described the papers as his archive of the Polish press since 2005 and knew where things were. He accepted the fire risk "in theory", agreed to alarms and a clear route to the door, and refused to have anything removed.', adultDeclined: false },
        ],
        recordsRequests: [],
        consent: {
          status: 'sought-and-given',
          note: 'Consent given through the interpreter on 19 Jun for the inquiry, the visit and the interview. He declined protective intervention beyond the fire safety measures. This was respected: he has capacity for the decision and there is no undue pressure.',
        },
        capacity: {
          assessed: true,
          summary: 'Assessed by Dr Amira Farouk on 24 Jun with the interpreter. Mr Nowak understands the fire risk, can retain and weigh it against what the papers mean to him, and can communicate his decision consistently. He has capacity for decisions about his home and his belongings.',
          fluctuates: false,
        },
        unduePressure: {
          considered: true,
          found: false,
          reasoning: 'He lives alone, has no visitors, and nobody benefits from his refusal. His decision has been the same over three contacts (fire officer, s8 interview, GP) and matches what he told the fire officer before any professional was involved. No undue pressure.',
        },
        advocacy: { offered: true, accepted: true, provider: 'Clydeshore Advocacy', advocateName: name(adv) },
      },
      ordersConsidered: [
        { order: 'assessment-order-s11', considered: true, decision: 'not-required', rationale: 'He agreed to the visit and the interview and his GP assessed capacity with his agreement. No order needed to assess.' },
        { order: 'removal-order-s14', considered: true, decision: 'not-required', rationale: 'No immediate risk of serious harm now that alarms are fitted, and he has capacity. Removal from his home against his wishes would be disproportionate and contrary to s1 and s2.' },
        { order: 'banning-order-s19', considered: true, decision: 'not-required', rationale: 'No other person is causing the harm.' },
        { order: 'warrant-for-entry', considered: true, decision: 'not-required', rationale: 'He let us in and has agreed to the support worker and SFRS visits.' },
      ],
      planId: TOMASZ.plan,
    },
  };
  ctx.data.processes.push(process);

  // ----- Views -----
  makeViews(ctx, {
    id: 'vw_tomasz_1',
    personId: tomasz.id,
    processId: process.id,
    kind: 'adult-views',
    recordedAt: at('2026-06-19', '11:15'),
    recordedByUserId: co,
    recordedByName: name(co),
    recordedByAgency: 'social-work',
    method: 'At home, in Polish through interpreter Ewa Zielińska; translated back to him and agreed',
    content: 'This is my home and I know where everything is. The papers are my life, twenty years of Polish news, I am not throwing them away. I understand about the fire. I will keep the path to the door and I will keep the alarms. I do not want people in my house moving my things. If someone comes once a week to talk, that is fine.',
    sharingPreference: 'Agreed his words could be read at the case conference and shown to the fire officer and his housing officer.',
  });
  makeViews(ctx, {
    id: 'vw_tomasz_2',
    personId: tomasz.id,
    processId: process.id,
    kind: 'adult-views',
    recordedAt: at('2026-07-09', '10:20'),
    recordedByUserId: adv,
    recordedByName: name(adv),
    recordedByAgency: 'third-sector',
    method: 'At the case conference, in Polish through the interpreter, recorded by his advocate',
    content: 'I came today because you asked. I heard what the fire officer said. I agree to the alarms, the path to the door, and the visits. I agree to see the doctor about my mood. I do not agree to clearing. That is my answer and I have said it three times now.',
  });

  // ----- Plan and actions -----
  makePlan(ctx, {
    id: TOMASZ.plan,
    processId: process.id,
    type: 'adult-support',
    title: 'Support plan for Tomasz Nowak (case conference 9 Jul 2026)',
    outcomes: [
      { id: 'out_tomasz_1', text: 'Mr Nowak\'s home has working linked smoke and heat alarms and a clear route from the living room to the front door', actionIds: ['act_tomasz_1', 'act_tomasz_2'] },
      { id: 'out_tomasz_2', text: 'Mr Nowak has weekly contact he accepts, in Polish, and a way back to services if he changes his mind', actionIds: ['act_tomasz_3'] },
      { id: 'out_tomasz_3', text: 'Mr Nowak\'s mood is reviewed and treated', actionIds: ['act_tomasz_4'] },
      { id: 'out_tomasz_4', text: 'Mr Nowak keeps his tenancy', actionIds: ['act_tomasz_5'] },
    ],
    coordinatorUserId: sw,
    coordinatorName: name(sw),
    agreedAt: '2026-07-09',
    reviewDate: '2026-10-08',
    status: 'active',
    consentNote: 'Mr Nowak agreed to this plan at the case conference on 9 Jul 2026 through the interpreter and signed the Polish translation on 14 Jul. It is a support plan under s4 of the 2007 Act, not an Adult Protection Plan: he has capacity for decisions about his home and has declined protective intervention. He can withdraw from any part of it at any time and will be told again at each review.',
  });
  const actions: Array<{ id: string; title: string; owner: string; agency: Agency; due: string; status: 'open' | 'in-progress' | 'complete'; completedAt?: string; evidence?: string }> = [
    { id: 'act_tomasz_1', title: 'Fit linked smoke and heat alarms and check them monthly', owner: fire, agency: 'fire-rescue', due: '2026-07-31', status: 'complete', completedAt: at('2026-07-17', '11:30'), evidence: 'Alarms fitted 17 Jul; monthly checks 17 Jul and 20 Aug, all working' },
    { id: 'act_tomasz_2', title: 'Help Mr Nowak keep a one-metre route from the living room to the front door clear, at his pace and without removing anything', owner: sw, agency: 'social-work', due: '2026-10-08', status: 'in-progress', evidence: 'Route clear at six of seven weekly visits; paper moved by Mr Nowak himself on 28 Aug' },
    { id: 'act_tomasz_3', title: 'Weekly support worker visit on Fridays by a Polish-speaking worker', owner: sw, agency: 'social-work', due: '2026-10-08', status: 'in-progress', evidence: 'Seven visits since 24 Jul; one missed (Mr Nowak out)' },
    { id: 'act_tomasz_4', title: 'GP review of mood and medication, with interpreter', owner: gp, agency: 'health', due: '2026-08-14', status: 'complete', completedAt: at('2026-08-12', '15:00'), evidence: 'Reviewed 12 Aug; sertraline restarted at a higher dose; follow-up 23 Sep' },
    { id: 'act_tomasz_5', title: 'Pause tenancy enforcement while the plan is in place; review at the October conference', owner: housing, agency: 'housing', due: '2026-10-08', status: 'in-progress', evidence: 'Enforcement paused 10 Jul; letter in Polish sent 15 Jul' },
  ];
  for (const a of actions) {
    makeAction(ctx, { id: a.id, processId: process.id, meetingId: TOMASZ.caseConference, planId: TOMASZ.plan, title: a.title, ownerUserId: a.owner, ownerName: a.owner === gp ? `Dr ${name(gp)}` : name(a.owner), ownerAgency: a.agency, due: a.due, status: a.status, completedAt: a.completedAt, evidence: a.evidence, createdAt: at('2026-07-09', '12:00'), createdByName: name(chair) });
  }

  // ----- Meetings -----
  const professional = (present: boolean): NonNullable<Parameters<typeof makeMeeting>[1]['invitees']> => [
    { userId: co, name: name(co), agency: 'social-work', role: 'Council officer', required: true, attendance: present ? 'present' : 'accepted', reason: 'Council officer', needToKnowRowId: 'asp.investigation.co' },
    { userId: sw, name: name(sw), agency: 'social-work', role: 'Second worker, plan coordinator', required: true, attendance: present ? 'present' : 'accepted', reason: 'Second worker', needToKnowRowId: 'asp.investigation.co' },
    { userId: fire, name: name(fire), agency: 'fire-rescue', role: 'Community safety officer', required: true, attendance: present ? 'present' : 'accepted', reason: 'Referrer; fire safety measures' },
    { userId: housing, name: name(housing), agency: 'housing', role: 'Housing officer', required: true, attendance: present ? 'present' : 'invited', reason: 'Council tenancy', needToKnowRowId: 'asp.inquiry.housing' },
    { userId: gp, name: `Dr ${name(gp)}`, agency: 'health', role: 'GP', required: false, attendance: present ? 'apologies' : 'invited', reason: 'Health input', needToKnowRowId: 'asp.inquiry.gp' },
  ];

  makeMeeting(ctx, {
    id: TOMASZ.iad,
    type: 'asp-inter-agency-discussion',
    processId: process.id,
    subjectIds: [tomasz.id],
    title: 'ASP inter-agency discussion: Tomasz Nowak',
    scheduledAt: at('2026-06-16', '14:00'),
    endsAt: at('2026-06-16', '15:00'),
    location: 'Teams call (Portlennan Resource Centre host)',
    status: 'held',
    chairUserId: co,
    chairName: name(co),
    invitees: [
      { userId: co, name: name(co), agency: 'social-work', role: 'Council officer', required: true, attendance: 'present', reason: 'Leads the inquiry', needToKnowRowId: 'asp.inquiry.co' },
      { userId: sw, name: name(sw), agency: 'social-work', role: 'Second worker', required: true, attendance: 'present', reason: 'Second worker', needToKnowRowId: 'asp.investigation.co' },
      { userId: fire, name: name(fire), agency: 'fire-rescue', role: 'Community safety officer', required: true, attendance: 'present', reason: 'Referrer' },
      { userId: housing, name: name(housing), agency: 'housing', role: 'Housing officer', required: true, attendance: 'present', reason: 'Tenancy enforcement in progress', needToKnowRowId: 'asp.inquiry.housing' },
      { userId: gp, name: `Dr ${name(gp)}`, agency: 'health', role: 'GP', required: false, attendance: 'remote', reason: 'Health input', needToKnowRowId: 'asp.inquiry.gp' },
    ],
    agenda: [
      { id: 'ag_tomasz_iad_1', order: 1, title: 'Concern and what each agency holds', status: 'done' },
      { id: 'ag_tomasz_iad_2', order: 2, title: 'Language, capacity and advocacy', status: 'done' },
      { id: 'ag_tomasz_iad_3', order: 3, title: 'Investigation plan: s7 visit and s8 interview with interpreter', status: 'done' },
      { id: 'ag_tomasz_iad_4', order: 4, title: 'Tenancy enforcement', status: 'done' },
    ],
    informationShared: [
      { id: 'is_tomasz_iad_1', agency: 'fire-rescue', byName: name(fire), byUserId: fire, at: at('2026-06-16', '14:05'), summary: 'Home fire safety visit 5 Jun: high risk, blocked rear exit, paper near the cooker. Alarms fitted. Re-check 12 Jun: alarms working, cooker area clear, no other change.', relevance: 'Nature and level of the fire risk', linkedEventIds: [] },
      { id: 'is_tomasz_iad_2', agency: 'housing', byName: name(housing), byUserId: housing, at: at('2026-06-16', '14:15'), summary: 'Tenancy since 2016, rent paid. Two warning letters (Feb and Nov 2025) about the condition of the property and gas access; final warning stage. Letters were in English.', relevance: 'Risk to the tenancy; whether he understood the letters', linkedEventIds: [] },
      { id: 'is_tomasz_iad_3', agency: 'health', byName: `Dr ${name(gp)}`, byUserId: gp, at: at('2026-06-16', '14:25'), summary: 'Depression since 2019; stopped sertraline in mid 2025 and has not attended for review. No psychosis, no cognitive impairment noted. Willing to assess capacity for decisions about his home with an interpreter.', relevance: 'Vulnerability (limb c) and capacity', linkedEventIds: [] },
      { id: 'is_tomasz_iad_4', agency: 'social-work', byName: name(co), byUserId: co, at: at('2026-06-16', '14:35'), summary: 'No previous social work involvement. Polish interpreter booked for 19 Jun. Advocacy referral made.', relevance: 'Access and participation', linkedEventIds: [] },
    ],
    decisions: [
      { id: 'dec_tomasz_iad_1', question: 'Investigation plan', decision: 's7 visit and s8 interview on 19 Jun with a Polish interpreter; council officer and second worker', rationale: 'He must be able to give his own account in his own language', dissent: [], decidedByName: name(co), decidedByUserId: co, decidedAt: at('2026-06-16', '14:40') },
      { id: 'dec_tomasz_iad_2', question: 'Capacity', decision: 'Dr Farouk to assess capacity for decisions about his home, with the interpreter, after the s8 interview', rationale: 'Whether he can refuse intervention depends on capacity for this decision', dissent: [], decidedByName: name(co), decidedByUserId: co, decidedAt: at('2026-06-16', '14:45') },
      { id: 'dec_tomasz_iad_3', question: 'Tenancy enforcement', decision: 'Housing to hold further enforcement until the case conference, and to reissue the letters in Polish', rationale: 'Enforcement now would add risk and he may not have understood the letters', dissent: [], decidedByName: name(co), decidedByUserId: co, decidedAt: at('2026-06-16', '14:50') },
    ],
    actionIds: [],
    viewsRecordIds: [],
    minute: { status: 'distributed', draftedAt: at('2026-06-16', '16:00'), approvedAt: at('2026-06-17', '09:00'), distributedAt: at('2026-06-17', '09:20') },
    distribution: [
      { id: 'dist_tomasz_iad_1', recipientName: name(housing), recipientUserId: housing, agency: 'housing', role: 'Housing officer', detailLevel: 'summary', reason: 'Housing relevant', sharingRecordId: 'shr_tomasz_1' },
      { id: 'dist_tomasz_iad_2', recipientName: `Dr ${name(gp)}`, recipientUserId: gp, agency: 'health', role: 'GP', detailLevel: 'full', reason: 'Health input', sharingRecordId: 'shr_tomasz_2' },
    ],
    reviewDate: '2026-07-09',
  });

  makeMeeting(ctx, {
    id: TOMASZ.caseConference,
    type: 'asp-case-conference',
    processId: process.id,
    subjectIds: [tomasz.id],
    title: 'ASP case conference: Tomasz Nowak',
    scheduledAt: at('2026-07-09', '10:00'),
    endsAt: at('2026-07-09', '12:00'),
    location: 'Dunlarrick Community Hub, meeting room A',
    status: 'held',
    chairUserId: chair,
    chairName: name(chair),
    minuteTakerUserId: minutes,
    minuteTakerName: name(minutes),
    invitees: [
      ...professional(true),
      { userId: adv, name: name(adv), agency: 'third-sector', role: 'Independent advocate', required: true, attendance: 'present', reason: 'Supports Mr Nowak to take part', needToKnowRowId: 'asp.conference.advocate' },
      { name: 'Tomasz Nowak', agency: 'social-work', role: 'Adult', required: true, attendance: 'present', reason: 'The adult; attended throughout with interpreter and advocate' },
      { name: INTERPRETER, agency: 'social-work', role: 'Interpreter', required: true, attendance: 'present', reason: 'Communication need: Polish' },
    ],
    agenda: [
      { id: 'ag_tomasz_cc_1', order: 1, title: 'Introductions, purpose and confidentiality (in Polish and English)', status: 'done' },
      { id: 'ag_tomasz_cc_2', order: 2, title: 'Mr Nowak\'s views', status: 'done' },
      { id: 'ag_tomasz_cc_3', order: 3, title: 'Council officer\'s report and chronology', status: 'done' },
      { id: 'ag_tomasz_cc_4', order: 4, title: 'Capacity, consent and undue pressure', status: 'done' },
      { id: 'ag_tomasz_cc_5', order: 5, title: 'Is Mr Nowak an adult at risk? Is a protection plan needed?', status: 'done' },
      { id: 'ag_tomasz_cc_6', order: 6, title: 'Support plan, owners, dates and review', status: 'done' },
    ],
    preMeetingRequests: [
      { id: 'pmr_tomasz_cc_1', agency: 'fire-rescue', toName: name(fire), toUserId: fire, sentAt: at('2026-06-22', '09:00'), dueAt: '2026-07-06', status: 'returned', returnSummary: 'SFRS report: risk rating, alarms fitted, re-check findings, recommended measures', returnedAt: at('2026-07-02', '11:00') },
      { id: 'pmr_tomasz_cc_2', agency: 'housing', toName: name(housing), toUserId: housing, sentAt: at('2026-06-22', '09:00'), dueAt: '2026-07-06', status: 'returned', returnSummary: 'Housing report: tenancy history, warning letters, enforcement position', returnedAt: at('2026-07-03', '15:30') },
      { id: 'pmr_tomasz_cc_3', agency: 'health', toName: `Dr ${name(gp)}`, toUserId: gp, sentAt: at('2026-06-22', '09:00'), dueAt: '2026-07-06', status: 'returned', returnSummary: 'GP report: depression history, capacity assessment 24 Jun (has capacity), willingness to review mood', returnedAt: at('2026-07-06', '17:00') },
    ],
    pack: [
      { id: 'pk_tomasz_cc_1', kind: 'chronology', label: 'Integrated chronology, 2016 to date', windowFrom: '2016-09-12', windowTo: '2026-07-08', included: true },
      { id: 'pk_tomasz_cc_2', kind: 'report', label: 'Council officer\'s report (with Polish translation)', ref: 'co-report-tomasz-2026-07', included: true },
      { id: 'pk_tomasz_cc_3', kind: 'report', label: 'SFRS report', ref: 'pmr_tomasz_cc_1', included: true },
      { id: 'pk_tomasz_cc_4', kind: 'report', label: 'Housing report', ref: 'pmr_tomasz_cc_2', included: true },
      { id: 'pk_tomasz_cc_5', kind: 'report', label: 'GP report and capacity assessment', ref: 'pmr_tomasz_cc_3', included: true },
      { id: 'pk_tomasz_cc_6', kind: 'views', label: 'Mr Nowak\'s views (19 Jun)', ref: 'vw_tomasz_1', included: true },
      { id: 'pk_tomasz_cc_7', kind: 'risk-assessment', label: 'Three-point test', ref: TOMASZ.threePointTest, included: true },
    ],
    informationShared: [
      { id: 'is_tomasz_cc_1', agency: 'social-work', byName: name(co), byUserId: co, at: at('2026-07-09', '10:30'), summary: 'Investigation summary: s7 visit and s8 interview with interpreter; consent given; capacity confirmed; undue pressure considered and not found; no orders required.', relevance: 'Basis for the decisions', linkedEventIds: [] },
      { id: 'is_tomasz_cc_2', agency: 'fire-rescue', byName: name(fire), byUserId: fire, at: at('2026-07-09', '10:45'), summary: 'Risk remains high while the paper volume is unchanged. Linked alarms and a clear exit route reduce the risk to life; they do not remove the fire load.', relevance: 'Residual risk', linkedEventIds: [] },
      { id: 'is_tomasz_cc_3', agency: 'housing', byName: name(housing), byUserId: housing, at: at('2026-07-09', '10:55'), summary: 'Enforcement held since 16 Jun. Housing can pause formally while a plan is in place and reviewed.', relevance: 'Tenancy', linkedEventIds: [] },
    ],
    decisions: [
      { id: 'dec_tomasz_cc_1', question: 'Is Mr Nowak an adult at risk under s3 of the 2007 Act?', decision: 'Yes', rationale: 'All three limbs met: he cannot make his home safe from fire without help, the risk of harm from fire is serious, and his depression makes him more vulnerable than an adult not so affected.', dissent: [], decidedByName: name(chair), decidedByUserId: chair, decidedAt: at('2026-07-09', '11:15') },
      { id: 'dec_tomasz_cc_2', question: 'Is an Adult Protection Plan needed?', decision: 'No', rationale: 'He has capacity for decisions about his home and declines protective intervention. There is no undue pressure. A protection plan he has not agreed to would not benefit him and would not be the least restrictive option (ss1 and 2).', dissent: [{ byName: name(fire), byUserId: fire, agency: 'fire-rescue', text: 'SFRS records that the residual fire risk remains high while the volume of paper stays as it is, and asks that this decision is revisited at the review conference.' }], decidedByName: name(chair), decidedByUserId: chair, decidedAt: at('2026-07-09', '11:30') },
      { id: 'dec_tomasz_cc_3', question: 'What response?', decision: 'Support-only response under s4, with his consent: alarms he accepts, a clear route to the door, weekly support worker visits in Polish, GP review of mood, and housing enforcement paused', rationale: 'Least restrictive option that benefits him and that he has agreed to. His wishes and feelings carry weight under s2. He keeps the right to withdraw.', dissent: [], decidedByName: name(chair), decidedByUserId: chair, decidedAt: at('2026-07-09', '11:45') },
      { id: 'dec_tomasz_cc_4', question: 'Review', decision: 'Review conference on 8 Oct 2026, earlier if SFRS or the support worker reports a change', rationale: 'Three-month local timescale; residual risk noted by SFRS', dissent: [], decidedByName: name(chair), decidedByUserId: chair, decidedAt: at('2026-07-09', '11:55') },
    ],
    actionIds: actions.map((a) => a.id),
    viewsRecordIds: ['vw_tomasz_1', 'vw_tomasz_2'],
    minute: { status: 'distributed', draftedAt: at('2026-07-10', '12:00'), approvedAt: at('2026-07-13', '09:30'), distributedAt: at('2026-07-13', '10:00') },
    distribution: [
      { id: 'dist_tomasz_cc_1', recipientName: 'Tomasz Nowak', agency: 'social-work', role: 'Adult', detailLevel: 'full', reason: 'The adult; minute and plan in Polish' },
      { id: 'dist_tomasz_cc_2', recipientName: name(adv), recipientUserId: adv, agency: 'third-sector', role: 'Independent advocate', detailLevel: 'full', reason: 'Attended with the adult' },
      { id: 'dist_tomasz_cc_3', recipientName: name(fire), recipientUserId: fire, agency: 'fire-rescue', role: 'Community safety officer', detailLevel: 'full', reason: 'Attended; action owner', sharingRecordId: 'shr_tomasz_4' },
      { id: 'dist_tomasz_cc_4', recipientName: name(housing), recipientUserId: housing, agency: 'housing', role: 'Housing officer', detailLevel: 'full', reason: 'Attended; action owner' },
      { id: 'dist_tomasz_cc_5', recipientName: `Dr ${name(gp)}`, recipientUserId: gp, agency: 'health', role: 'GP', detailLevel: 'full', reason: 'Report submitted; action owner' },
    ],
    reviewDate: '2026-10-08',
    subjectAttendance: 'Mr Nowak attended throughout with Polish interpreter Ewa Zielińska and his advocate Tam Guthrie. He spoke first and was asked for his view before each decision. The minute and plan were sent to him in Polish.',
  });

  makeMeeting(ctx, {
    id: TOMASZ.review,
    type: 'asp-review-conference',
    processId: process.id,
    subjectIds: [tomasz.id],
    title: 'ASP review conference: Tomasz Nowak',
    scheduledAt: at('2026-10-08', '10:00'),
    endsAt: at('2026-10-08', '11:30'),
    location: 'Dunlarrick Community Hub, meeting room A',
    status: 'scheduled',
    chairUserId: chair,
    chairName: name(chair),
    minuteTakerUserId: minutes,
    minuteTakerName: name(minutes),
    invitees: [
      ...professional(false),
      { userId: adv, name: name(adv), agency: 'third-sector', role: 'Independent advocate', required: true, attendance: 'accepted', reason: 'Supports Mr Nowak to take part', needToKnowRowId: 'asp.conference.advocate' },
      { name: 'Tomasz Nowak', agency: 'social-work', role: 'Adult', required: true, attendance: 'invited', reason: 'The adult' },
      { name: INTERPRETER, agency: 'social-work', role: 'Interpreter', required: true, attendance: 'accepted', reason: 'Communication need: Polish' },
    ],
    agenda: [
      { id: 'ag_tomasz_rev_1', order: 1, title: 'Purpose and confidentiality', status: 'pending' },
      { id: 'ag_tomasz_rev_2', order: 2, title: 'Mr Nowak\'s views', status: 'pending' },
      { id: 'ag_tomasz_rev_3', order: 3, title: 'Progress against the support plan', status: 'pending' },
      { id: 'ag_tomasz_rev_4', order: 4, title: 'Residual fire risk (SFRS dissent from 9 Jul)', status: 'pending' },
      { id: 'ag_tomasz_rev_5', order: 5, title: 'Continue, change or close', status: 'pending' },
    ],
    preMeetingRequests: [
      { id: 'pmr_tomasz_rev_1', agency: 'fire-rescue', toName: name(fire), toUserId: fire, sentAt: at('2026-09-01', '09:00'), dueAt: '2026-10-01', status: 'sent' },
      { id: 'pmr_tomasz_rev_2', agency: 'housing', toName: name(housing), toUserId: housing, sentAt: at('2026-09-01', '09:00'), dueAt: '2026-10-01', status: 'sent' },
      { id: 'pmr_tomasz_rev_3', agency: 'health', toName: `Dr ${name(gp)}`, toUserId: gp, sentAt: at('2026-09-01', '09:00'), dueAt: '2026-10-01', status: 'sent' },
    ],
    pack: [
      { id: 'pk_tomasz_rev_1', kind: 'chronology', label: 'Integrated chronology, 5 Jun to date', windowFrom: '2026-06-05', windowTo: '2026-10-07', included: true },
      { id: 'pk_tomasz_rev_2', kind: 'plan', label: 'Support plan with progress', ref: TOMASZ.plan, included: true },
      { id: 'pk_tomasz_rev_3', kind: 'views', label: 'Mr Nowak\'s views (19 Jun and 9 Jul)', ref: 'vw_tomasz_2', included: true },
      { id: 'pk_tomasz_rev_4', kind: 'report', label: 'Support worker summary', included: false },
    ],
    actionIds: actions.map((a) => a.id),
    viewsRecordIds: ['vw_tomasz_2'],
    minute: { status: 'not-started' },
  });

  // ----- Sharing records -----
  const share = (id: string, stage: Process['stage'], to: string, agency: Agency, role: string, level: 'full' | 'summary' | 'fields' | 'presence', reason: string, summary: string, createdAt: string, rowId?: string, channel: 'in-app' | 'secure-email-digest' = 'in-app') =>
    makeShare(ctx, { id, processId: process.id, subjectId: tomasz.id, stage, recipient: { userId: to, name: name(to), agency, role }, detailLevel: level, lawfulBasisId: lb.id, channel, status: 'read', createdAt, sentAt: createdAt, readAt: createdAt, reason, needToKnowRowId: rowId, createdByUserId: co, createdByName: name(co), summary });
  share('shr_tomasz_1', 'inquiry', housing, 'housing', 'Housing officer', 'summary', 'Inquiry opened. If housing is relevant.', 'ASP inquiry opened 8 Jun; council tenancy; request to hold enforcement and reissue letters in Polish', at('2026-06-08', '11:30'), 'asp.inquiry.housing');
  share('shr_tomasz_2', 'inquiry', gp, 'health', 'GP', 'full', 'Inquiry opened. If health input is needed.', 'Adult concern from SFRS, three-point test and inquiry record; request for information on depression and a capacity assessment with interpreter', at('2026-06-08', '11:30'), 'asp.inquiry.gp');
  share('shr_tomasz_3', 'investigation', adv, 'third-sector', 'Independent advocate', 'summary', 'Advocacy offered. If advocacy has been offered.', 'Investigation opened 17 Jun; s7 visit and s8 interview 19 Jun with Polish interpreter; Mr Nowak has accepted an advocate', at('2026-06-17', '09:30'), 'asp.investigation.advocacy');
  share('shr_tomasz_4', 'support-plan', fire, 'fire-rescue', 'Community safety officer (referrer)', 'summary', 'Support plan agreed. Referrer receives the outcome.', 'Case conference 9 Jul: adult at risk; no protection plan; support plan agreed with his consent; SFRS dissent recorded; review 8 Oct', at('2026-07-13', '10:00'), 'asp.support.referrer', 'secure-email-digest');

  // ----- Chronology events -----
  const E = (e: Omit<Parameters<typeof makeEvent>[1], 'subjectIds'> & { subjectIds?: string[] }) =>
    makeEvent(ctx, { subjectIds: [tomasz.id], linkedProcessIds: [process.id], visibility: 'integrated', lawfulBasisId: lb.id, ...e });

  E({ occurredAt: at('2016-09-12', '00:00'), agency: 'housing', recordedByName: name(housing), recordedByUserId: housing, eventType: 'move.address', title: 'Tenancy started at 3 Distillery Vennel, Dunlarrick', detail: 'Council tenancy, one-bedroom ground floor flat. Moved from private rented accommodation in Auchentorran. Rent paid by standing order since.', significance: 'low' });
  E({ occurredAt: at('2019-04-03', '11:20'), agency: 'health', sourceSystem: 'emis-web', recordedByName: 'EMIS Web connector', eventType: 'health.diagnosis', title: 'GP: depression diagnosed; sertraline started', detail: 'Low mood for six months after redundancy from the distillery bottling line. Sleep poor, appetite reduced. Sertraline started; review in four weeks. Interpreter used by telephone.', significance: 'moderate', significanceReason: 'Mental disorder relevant to the three-point test (limb c)' });
  E({ occurredAt: at('2020-11-16', '00:00'), agency: 'health', sourceSystem: 'emis-web', recordedByName: 'EMIS Web connector', eventType: 'health.missed-appointment', title: 'Medication review not attended', detail: 'Repeat prescription continued for three months; letter sent.', significance: 'low', visibility: 'agency-only', lawfulBasisId: undefined });
  E({ occurredAt: at('2022-06-08', '14:10'), agency: 'health', sourceSystem: 'emis-web', recordedByName: 'EMIS Web connector', eventType: 'health.consultation', title: 'GP telephone review: mood stable, "keeps busy with his papers"', detail: 'Reports reading Polish newspapers most of the day and little contact with anyone. No risk to self. Sertraline continued.', significance: 'low', visibility: 'agency-only', lawfulBasisId: undefined });
  E({ occurredAt: at('2024-03-05', '00:00'), agency: 'housing', recordedByName: name(housing), recordedByUserId: housing, eventType: 'other', title: 'Housing visit: hall and living room stacked with newspapers; advice letter sent', detail: 'Annual tenancy visit. Officer could see stacks of paper along the hall and could not enter the living room. Mr Nowak polite, said he would "sort it". Advice letter about the tenancy conditions sent in English.', significance: 'moderate', significanceReason: 'First record of the hoarding' });
  E({ occurredAt: at('2025-02-11', '00:00'), agency: 'housing', recordedByName: name(housing), recordedByUserId: housing, eventType: 'other', title: 'Tenancy warning letter 1: condition of the property', detail: 'Formal warning under the tenancy agreement after a further visit found no change. Fourteen days to respond. No response received.', significance: 'moderate' });
  E({ occurredAt: at('2025-08-19', '09:50'), agency: 'health', sourceSystem: 'emis-web', recordedByName: 'EMIS Web connector', eventType: 'health.consultation', title: 'GP: chest infection; mentioned he had stopped sertraline', detail: 'Attended for a cough. Said he stopped sertraline "in the summer" because he felt fine. Advised to restart; declined. Review offered; not booked.', significance: 'moderate', significanceReason: 'Treatment gap before the housing escalation' });
  E({ occurredAt: at('2025-11-04', '00:00'), agency: 'housing', recordedByName: name(housing), recordedByUserId: housing, eventType: 'other', title: 'Tenancy warning letter 2: no access for the annual gas safety check; final warning', detail: 'Two appointments missed. Final warning that forced access may be sought. Letter in English.', significance: 'high', significanceReason: 'Final warning stage; risk to the tenancy' });
  E({ occurredAt: at('2026-01-27', '00:00'), agency: 'housing', recordedByName: name(housing), recordedByUserId: housing, eventType: 'other', title: 'Gas safety check completed after the notice; engineer noted paper close to the boiler', detail: 'Access given on the third appointment. Boiler serviced. Engineer reported paper stacked within a metre of the boiler cupboard and asked for the housing officer to follow up.', significance: 'moderate' });
  E({ occurredAt: at('2026-05-29', '19:40'), agency: 'fire-rescue', recordedByName: name(fire), recordedByUserId: fire, eventType: 'other', title: 'SFRS attended: smoke alarm sounding, burnt toast, no fire', detail: 'Neighbour called 999 when the alarm kept sounding. Crew found burnt toast and no fire. Noted the volume of paper and offered a home fire safety visit; Mr Nowak accepted.', significance: 'moderate', significanceReason: 'Near miss that led to the fire safety visit' });
  E({ occurredAt: at('2026-06-05', '11:00'), agency: 'fire-rescue', recordedByName: name(fire), recordedByUserId: fire, eventType: 'other', title: 'Home fire safety visit: floor-to-ceiling newspapers, rear exit blocked; high risk', detail: 'Paper stacked to the ceiling in the living room and hall with a narrow path. Rear door blocked. One working alarm. Paper within half a metre of the cooker. Two alarms fitted. Mr Nowak accepted alarms and declined help to clear. Adult concern raised with the council.', significance: 'high', significanceReason: 'Source of the adult concern', evidenceRefs: [{ kind: 'document', ref: 'SFRS-HFSV-2026-0611', label: 'Home fire safety visit report' }] });
  E({ occurredAt: at('2026-06-05', '14:20'), agency: 'social-work', recordedByName: name(co), recordedByUserId: co, eventType: 'process.referral', title: 'Adult concern received from SFRS; council officer allocated', detail: 'Self-neglect and fire risk. Three-point test and screening decision on 8 Jun: proceed to inquiry. Polish interpreter identified as a communication need.', significance: 'high', significanceReason: 'ASP process started' });
  E({ occurredAt: at('2026-06-12', '15:00'), agency: 'social-work', recordedByName: name(co), recordedByUserId: co, eventType: 'social-work.assessment', title: 'ASP inquiry decision: proceed to investigation', detail: 'Decision on working day 5. SFRS, housing and GP information gathered. Inter-agency discussion arranged for 16 Jun; s7 visit with interpreter booked for 19 Jun.', significance: 'high', significanceReason: 'Inquiry outcome' });
  E({ occurredAt: at('2026-06-16', '14:00'), agency: 'social-work', recordedByName: name(co), recordedByUserId: co, eventType: 'process.case-conference', title: 'ASP inter-agency discussion held: investigation planned with interpreter', detail: 'SFRS, housing, GP and social work. s7 visit and s8 interview 19 Jun in Polish; GP capacity assessment; housing to hold enforcement and reissue letters in Polish; advocacy referral.', significance: 'high', significanceReason: 'Investigation plan agreed across agencies' });
  E({ occurredAt: at('2026-06-19', '10:00'), agency: 'social-work', recordedByName: name(co), recordedByUserId: co, eventType: 'social-work.visit', title: 's7 visit and s8 interview with Polish interpreter', detail: 'Council officer and second worker. He let us in and showed us round. Interviewed alone in Polish. Accepts the fire risk in theory, agrees to alarms and a clear route, refuses removal of anything. Consent to the inquiry given.', significance: 'high', significanceReason: 'Investigation visit and interview' });
  E({ occurredAt: at('2026-06-19', '11:15'), agency: 'social-work', recordedByName: name(co), recordedByUserId: co, eventType: 'voice.adult', title: 'Mr Nowak\'s views recorded in Polish: "This is my home and I know where everything is"', detail: 'The papers are his life; he will keep the path and the alarms; he does not want people moving his things; a weekly visit to talk is fine.', significance: 'high', significanceReason: 'The adult\'s own words' });
  E({ occurredAt: at('2026-06-24', '10:30'), agency: 'health', recordedByName: `Dr ${name(gp)}`, recordedByUserId: gp, eventType: 'health.assessment', title: 'Capacity assessment: has capacity for decisions about his home', detail: 'Assessed at the practice with the interpreter. Understands the fire risk, retains it, weighs it against what the papers mean to him, communicates a consistent decision. No cognitive impairment. Depression present but does not remove capacity for this decision.', significance: 'high', significanceReason: 'Capacity confirmed; his refusal stands' });
  E({ occurredAt: at('2026-07-09', '10:00'), agency: 'social-work', recordedByName: name(chair), recordedByUserId: chair, eventType: 'process.case-conference', title: 'ASP case conference: adult at risk; no protection plan; support-only response with his consent', detail: 'Mr Nowak attended with interpreter and advocate. Decisions: adult at risk; no Adult Protection Plan (capacity, refusal, no undue pressure); support plan agreed; SFRS dissent on residual risk recorded; review 8 Oct.', significance: 'high', significanceReason: 'Case conference decisions' });
  E({ occurredAt: at('2026-07-17', '11:30'), agency: 'fire-rescue', recordedByName: name(fire), recordedByUserId: fire, eventType: 'other', title: 'Linked smoke and heat alarms fitted', detail: 'Three linked alarms (hall, living room, kitchen heat alarm). Route to the front door clear. Monthly checks agreed with Mr Nowak.', significance: 'moderate' });
  E({ occurredAt: at('2026-07-24', '14:00'), agency: 'social-work', sourceSystem: 'carefirst', recordedByName: 'CareFirst connector', eventType: 'social-work.visit', title: 'First weekly support worker visit (Polish-speaking worker)', detail: 'Forty minutes. Talked about the papers and his family in Gdańsk. Route to the door clear. He agreed to the GP appointment on 12 Aug.', significance: 'low' });
  E({ occurredAt: at('2026-08-12', '15:00'), agency: 'health', recordedByName: `Dr ${name(gp)}`, recordedByUserId: gp, eventType: 'health.consultation', title: 'GP mood review with interpreter; sertraline restarted at a higher dose', detail: 'PHQ-9 score 16 (moderately severe). No thoughts of self-harm. Agreed to restart sertraline. Follow-up 23 Sep.', significance: 'moderate' });
  E({ occurredAt: at('2026-08-20', '10:15'), agency: 'fire-rescue', recordedByName: name(fire), recordedByUserId: fire, eventType: 'other', title: 'Monthly alarm check: all working; route to the door clear', detail: 'No change in the volume of paper. Cooker area clear.', significance: 'moderate' });
  E({ occurredAt: at('2026-08-28', '14:00'), agency: 'social-work', sourceSystem: 'carefirst', recordedByName: 'CareFirst connector', eventType: 'social-work.visit', title: 'Weekly visit: route partly blocked by a new stack; cleared together', detail: 'A new bundle of papers had been left across the path to the door. Mr Nowak moved it himself when asked. Mood brighter since restarting medication.', significance: 'moderate' });

  const analysisIds = ctx.data.events.filter((e) => e.subjectIds.includes(tomasz.id) && ((e.agency === 'housing' && e.occurredAt >= '2025') || (e.eventType === 'health.consultation' && e.occurredAt.startsWith('2025-08')))).map((e) => e.id);
  makeAnalysis(ctx, {
    id: 'ana_tomasz_1',
    subjectId: tomasz.id,
    processId: process.id,
    eventIds: analysisIds,
    authorUserId: sw,
    authorName: name(sw),
    agency: 'social-work',
    recordedAt: at('2026-07-06', '16:00'),
    kind: 'pattern',
    title: 'Housing escalation followed the gap in treatment for depression',
    text: 'Both tenancy warning letters and the missed gas access fall in the months after Mr Nowak stopped sertraline in mid 2025, and all three letters were in English although he asks for Polish for anything that matters. This suggests the escalation reflected untreated low mood and letters he may not have taken in, rather than refusal to engage. It is an observation for the review conference, not a conclusion, and does not change his capacity to decide about his home.',
  });
}
