/**
 * Scenario 6: Ishbel Grant, 84, an inpatient at Clydeshore Royal Infirmary. Delayed discharge;
 * lacks capacity for the decision about residential care; no attorney; family divided. The
 * council is applying for welfare guardianship: MHO report clock running, two medical reports in
 * hand, interim order sought, s13ZA considered and rejected because her son objects.
 */
import type { Agency, Process } from '@mas/domain';
import type { BuildContext } from '../../generator/context';
import { at, makeAction, makeAddress, makeAnalysis, makeConnectorEvent, makeEvent, makeLawfulBasis, makeMeeting, makePerson, makeShare, makeViews, relate, syntheticChi } from '../../generator/factory';
import { USR, userName } from '../../generator/organisations';

export const ISHBEL = {
  ishbel: 'per_ishbel_grant',
  morag: 'per_morag_kilgour',
  douglas: 'per_douglas_grant',
  process: 'prc_awi_ishbel',
  mdt: 'mtg_ishbel_mdt',
} as const;

export function seedIshbelGrant(ctx: BuildContext): void {
  const name = (id: string) => userName(ctx, id);

  const larchBrae = makeAddress(ctx, { id: 'adr_ishbel_home', line1: '22 Larch Brae', town: 'Glenmoray', postcode: 'QX4 1DT' });
  const ward7 = makeAddress(ctx, { id: 'adr_cri_ward7', line1: 'Clydeshore Royal Infirmary', line2: 'Ward 7', town: 'Ardvale', postcode: 'QX1 9HS' });
  const moragHome = makeAddress(ctx, { id: 'adr_morag_home', line1: '5 Rowan Gait', town: 'Braeside', postcode: 'QX5 6TD' });
  const douglasHome = makeAddress(ctx, { id: 'adr_douglas_home', line1: '40 Moray Loan', town: 'Glenmoray', postcode: 'QX4 3PW' });

  const hh = 'hh_grant';
  const ishbel = makePerson(ctx, {
    id: ISHBEL.ishbel,
    givenName: 'Ishbel',
    familyName: 'Grant',
    sex: 'female',
    dateOfBirth: '1942-05-11',
    chi: syntheticChi(ctx, '1942-05-11', 'female'),
    addressHistory: [
      { addressId: larchBrae.id, from: '1975-06-01', note: 'Home address; owner occupier' },
      { addressId: ward7.id, from: '2026-07-15', note: 'Inpatient, Clydeshore Royal Infirmary ward 7, since a fall at home. Delayed discharge from 24 Jul 2026' },
    ],
    householdId: hh,
    communicationNeeds: { needs: ['Hearing aid (both ears); check they are in and working', 'Short sentences, one question at a time', 'Best mid-morning; tires and becomes more confused after lunch'], note: 'Alzheimer\'s type dementia. Likes to be called Ishbel, not Mrs Grant.' },
    alerts: [{ id: 'alt_ishbel_inpatient', kind: 'other', text: 'Inpatient, Clydeshore Royal Infirmary ward 7 (since 15 Jul 2026); delayed discharge', from: '2026-07-15' }],
    contact: { phone: '01000 618402' },
    gpPractice: 'Portnellan Medical Practice',
    ethnicity: 'scottish',
    createdAt: at('2023-02-14', '10:00'),
  });
  const morag = makePerson(ctx, {
    id: ISHBEL.morag,
    givenName: 'Morag',
    familyName: 'Kilgour',
    sex: 'female',
    dateOfBirth: '1968-03-22',
    chi: syntheticChi(ctx, '1968-03-22', 'female'),
    addressHistory: [{ addressId: moragHome.id, from: '2002-04-15' }],
    contact: { phone: '07700 900452' },
    ethnicity: 'scottish',
    createdAt: at('2023-02-14', '10:00'),
  });
  const douglas = makePerson(ctx, {
    id: ISHBEL.douglas,
    givenName: 'Douglas',
    familyName: 'Grant',
    sex: 'male',
    dateOfBirth: '1971-08-09',
    chi: syntheticChi(ctx, '1971-08-09', 'male'),
    addressHistory: [{ addressId: douglasHome.id, from: '2015-11-01' }],
    contact: { phone: '07700 900461' },
    ethnicity: 'scottish',
    createdAt: at('2024-09-10', '10:00'),
  });

  ctx.data.households.push({ id: hh, synthetic: true, addressId: larchBrae.id, memberIds: [ishbel.id], label: 'Grant household, Glenmoray' });
  relate(ctx, morag.id, ishbel.id, 'child-of', { notes: 'Daughter and nearest relative. Visits most days. Supports a move to residential care' });
  relate(ctx, douglas.id, ishbel.id, 'child-of', { notes: 'Son. Lives ten minutes away. Objects to residential care; offers to move in and provide overnight care' });
  relate(ctx, ishbel.id, morag.id, 'parent-of');
  relate(ctx, ishbel.id, douglas.id, 'parent-of');
  relate(ctx, morag.id, douglas.id, 'sibling-of');

  const sw = USR.stuartBlair;
  const mho = USR.graemeDunlop;
  const discharge = USR.heatherAitken;
  const gp = USR.amiraFarouk;
  const mwc = USR.jeanHogg;
  const opg = USR.alistairMeek;
  const adv = USR.tamGuthrie;
  const geriatrician = 'Dr Ruth Cameron';
  const solicitor = 'Rhona Paterson, Clydeshore Council Legal Services';

  const lb = makeLawfulBasis(ctx, {
    id: 'lb_ishbel_awi',
    purpose: 'Assessment of capacity and application for welfare guardianship for Ishbel Grant under the Adults with Incapacity (Scotland) Act 2000',
    article6: '6(1)(c) legal obligation',
    article9Condition: '9(2)(h) health and social care',
    article10Criminal: 'not applicable',
    statutoryGateway: ['Adults with Incapacity (Scotland) Act 2000 s57 (guardianship applications; council duty under s57(2))', 'Adults with Incapacity (Scotland) Act 2000 s1 (principles: consultation with relatives and carers)', 'Social Work (Scotland) Act 1968 s13ZA (considered and not applied)'],
    necessityAndProportionality: 'Sharing between the ward, the discharge team, the GP, the MHO, the council solicitor and the sheriff court is necessary to prepare and lodge the application and to keep Mrs Grant safe while it is decided. Her children receive what the Act requires them to be told and what consultation under s1 needs. The MWC and OPG receive notification only.',
    consentStatus: 'not-required',
    consentNote: 'Mrs Grant lacks capacity to consent to sharing for this purpose. Her past and present wishes are recorded and weighed under s1. Sharing is limited to what the application and her care need.',
    authorisedByUserId: sw,
    authorisedByName: name(sw),
    informationSharingAgreementRef: 'Clydeshore HSCP AWI protocol 2024',
    dpiaRef: 'DPIA-AWI-2024-02',
    createdAt: at('2026-07-28', '11:30'),
  });

  const process: Process = {
    id: ISHBEL.process,
    synthetic: true,
    type: 'awi',
    reference: 'AWI-2026-0102',
    title: 'Adults with Incapacity: Ishbel Grant (welfare guardianship application)',
    subjectIds: [ishbel.id],
    leadAgency: 'social-work',
    leadUserId: sw,
    stage: 'application',
    stageHistory: [
      { stage: 'capacity-concern', at: at('2026-07-28', '11:00'), byUserId: discharge, byName: name(discharge), note: 'Raised by the discharge coordinator: delayed discharge, capacity for the residence decision in doubt' },
      { stage: 'existing-powers', at: at('2026-08-05', '09:30'), byUserId: sw, byName: name(sw), note: 'OPG register checked: no power of attorney, no guardianship' },
      { stage: 'route-decision', at: at('2026-08-12', '15:00'), byUserId: sw, byName: name(sw), note: 'Welfare guardianship, council applicant. s13ZA not available: son objects' },
      { stage: 'application', at: at('2026-08-24', '10:00'), byUserId: sw, byName: name(sw), note: 'MHO notified under s57(3); 21-day report clock started' },
    ],
    status: 'open',
    classification: 'official-sensitive',
    openedAt: at('2026-07-28', '11:00'),
    members: [
      { userId: sw, caseRole: 'allocated social worker', agency: 'social-work', since: '2026-07-28', reason: 'Allocated worker; prepares the application for the council as applicant' },
      { userId: mho, caseRole: 'Mental Health Officer', agency: 'social-work', since: '2026-07-28', reason: 'MHO report under s57(3); welfare guardianship likely' },
      { userId: discharge, caseRole: 'discharge coordinator', agency: 'health', since: '2026-07-28', reason: 'Raised the concern; delayed discharge from ward 7' },
      { userId: gp, caseRole: 'GP', agency: 'health', since: '2026-07-28', reason: 'Second medical report; capacity assessment for financial decisions' },
      { userId: mwc, caseRole: 'MWC practitioner', agency: 'regulator', since: '2026-08-28', reason: 'Welfare guardianship application by the council; summary only' },
      { userId: opg, caseRole: 'OPG officer', agency: 'regulator', since: '2026-08-05', reason: 'Register check; will register the order if granted' },
    ],
    clocks: [
      { id: 'clk_ishbel_mho', ruleId: 'awi.mho.report', triggeredAt: at('2026-08-24', '10:00'), note: 'MHO report due 14 Sep under s57(4): 21 days from the date of notice' },
    ],
    linkedProcessIds: [],
    viewsRecordIds: ['vw_ishbel_1', 'vw_ishbel_family'],
    riskAssessmentIds: [],
    flags: { welfareGuardianshipLikely: true, inHospital: true, careProvider: false, financialInvestigation: false, welfareInvestigation: false },
    excludedUserIds: [],
    detail: {
      concern: {
        raisedAt: at('2026-07-28', '11:00'),
        source: 'Discharge coordinator, Clydeshore Royal Infirmary ward 7 (Heather Aitken)',
        sourceAgency: 'health',
        decisionInQuestion: 'Where Ishbel lives on discharge: return home to 22 Larch Brae with a care package, or move to residential care',
        summary: 'Mrs Grant has been medically fit for discharge since 24 Jul. The ward team and the consultant geriatrician consider she cannot return home safely after three falls in sixteen months and reported night-time wandering. She says she wants to go home. Her daughter supports residential care; her son objects and offers to move in. There is no power of attorney. Capacity for the decision is in doubt.',
      },
      capacityAssessments: [
        {
          id: 'cap_ishbel_1',
          decision: 'Where she lives on discharge (residential care or home with a care package)',
          assessedAt: at('2026-08-04', '14:00'),
          assessorName: geriatrician,
          assessorRole: 'Consultant geriatrician, Clydeshore Royal Infirmary (s22 approved medical practitioner)',
          outcome: 'lacks-capacity',
          evidence: 'Alzheimer\'s type dementia diagnosed 2023; MMSE 14/30 on 30 Jul. Mrs Grant understands she is in hospital and wants to go home, but cannot retain information about her falls, the stairs, or the night-time wandering her son describes, and cannot weigh those risks against her wish. Assessed twice, morning and afternoon, with the same result.',
          communicationSupport: 'Hearing aids in; quiet side room; daughter present at her request for the second assessment; short sentences, one question at a time.',
        },
        {
          id: 'cap_ishbel_2',
          decision: 'Managing her money and property (pension, savings and the house)',
          assessedAt: at('2026-08-06', '11:00'),
          assessorName: `Dr ${name(gp)}`,
          assessorRole: 'GP, Portnellan Medical Practice',
          outcome: 'lacks-capacity',
          evidence: 'Cannot say what income she has, does not recognise the name of her bank, and believes her late husband still pays the bills. Consistent with the ward assessment. Financial powers are not sought in this application; the family have been asked to consider a Part 3 access to funds application for day-to-day expenses.',
          communicationSupport: 'Hearing aids in; mid-morning; daughter present.',
        },
      ],
      willAndPreferences: {
        recordedAt: at('2026-08-07', '10:30'),
        byName: name(sw),
        pastWishes: 'Told her daughter Morag several times over the years, most recently after her husband Tom died in 2014, that she "never wanted to go into a home" and wanted to die in her own bed at Larch Brae. No written statement or advance directive. Chose to stay at home with a care package in 2024 when a move was first mentioned.',
        presentWishes: '"I want to go home to my own bed. I have been here long enough. Douglas will look after me." Repeated at every visit. She does not remember falling and does not believe she needs anyone at night.',
        communicationMethod: 'Spoken, in a quiet side room, mid-morning; hearing aids in; short sentences and one question at a time; her son or daughter present as she prefers on the day.',
        consultedOthers: [
          { personId: morag.id, name: 'Morag Kilgour', relationship: 'Daughter, nearest relative', view: 'Supports a move to residential care. Has found her mother on the floor twice since March and cannot provide overnight care with her own work and family. Says her mother "would be furious for a week and then settle", and that the house is not safe at night.' },
          { personId: douglas.id, name: 'Douglas Grant', relationship: 'Son', view: 'Objects to residential care. Wants his mother home with a care package and will move into Larch Brae to provide overnight cover. Says a care home "would kill her" and that she made her wishes clear for years.' },
          { name: 'Nan Baxter', relationship: 'Neighbour of 30 years', view: 'Worried about the nights. Has been getting up to check when she hears Ishbel\'s door and once found her in the garden at 05:00 in her nightdress in April.' },
        ],
      },
      opgResult: {
        checkedAt: at('2026-08-05', '09:30'),
        reference: 'OPG-REG-2026-40922',
        powerOfAttorney: { exists: false },
        guardianship: { exists: false },
      },
      routeDecision: {
        route: 'guardianship-welfare',
        decidedAt: at('2026-08-12', '15:00'),
        byName: name(sw),
        rationale: 'Mrs Grant lacks capacity for the residence decision. Nobody holds a power of attorney. Her son objects to a move, so section 13ZA of the 1968 Act cannot be used. Neither child is in a position to apply, and the council has a duty under s57(2) to apply where nobody else is doing so. Welfare guardianship with powers limited to residence, care arrangements and access to information is the least restrictive route that lets a lawful decision be taken and heard by the sheriff with both children able to make their case. Financial powers are not sought.',
        s13za: {
          considered: true,
          applied: false,
          reasoning: 'Section 13ZA allows the council to arrange community care services, including a move to residential care, for an adult who lacks capacity only where no guardian or attorney has relevant powers and nobody objects. Her son Douglas objects, so the section is not available and the decision must go to the sheriff.',
          objectionFrom: 'Douglas Grant (son)',
        },
      },
      application: {
        applicant: 'council',
        applicantName: 'Clydeshore Council',
        solicitor,
        powersSought: [
          'To decide where Ishbel Grant lives, including a move to residential care',
          'To consent to care arrangements and personal support',
          'To access medical and social care information and take part in decisions about her care',
        ],
        mhoUserId: mho,
        mhoNotifiedAt: at('2026-08-24', '10:00'),
        mhoReport: { status: 'in-progress' },
        medicalReports: [
          { practitioner: `${geriatrician}, consultant geriatrician (s22 approved medical practitioner)`, kind: 'approved-medical-practitioner', receivedAt: '2026-08-19', status: 'received' },
          { practitioner: `Dr ${name(gp)}, GP`, kind: 'medical-practitioner', receivedAt: '2026-08-21', status: 'received' },
        ],
        suitabilityReport: { required: false, status: 'not-required' },
        court: { lodgedAt: '2026-08-28', hearingAt: '2026-09-25', sheriffCourt: 'Ardvale Sheriff Court' },
        interimOrder: { soughtAt: '2026-08-28', renewals: 0 },
      },
      orders: [],
      supervisionVisits: [],
      investigations: [],
    },
  };
  ctx.data.processes.push(process);

  // ----- Views -----
  makeViews(ctx, {
    id: 'vw_ishbel_1',
    personId: ishbel.id,
    processId: process.id,
    kind: 'adult-views',
    recordedAt: at('2026-08-07', '10:30'),
    recordedByUserId: sw,
    recordedByName: name(sw),
    recordedByAgency: 'social-work',
    method: 'Side room on ward 7, mid-morning, hearing aids in, daughter present at her request; in her words',
    content: 'I want to go home to my own bed. I have been here long enough. Douglas will look after me, I do not need anybody else. I have never fallen in my life. Tom will be wondering where I am.',
    sharingPreference: 'Her views are to be put before the sheriff and read at every meeting about her.',
  });
  makeViews(ctx, {
    id: 'vw_ishbel_family',
    personId: morag.id,
    processId: process.id,
    kind: 'family-views',
    recordedAt: at('2026-08-20', '15:00'),
    recordedByUserId: sw,
    recordedByName: name(sw),
    recordedByAgency: 'social-work',
    method: 'At the multi-disciplinary meeting on ward 7, both children present; read back and agreed by each',
    content: 'Morag Kilgour (daughter): "I have found Mum on the floor twice. I cannot do the nights and neither can Douglas, whatever he says. She would hate a home for a week and then she would settle. I want her safe." Douglas Grant (son): "She told us for years she never wanted to go into a home. I will move in. A home would kill her. I do not agree with this application and I will say so in court."',
  });

  // ----- Actions -----
  const actions: Array<{ id: string; title: string; detail?: string; owner: string; agency: Agency; due: string; status: 'open' | 'in-progress' | 'complete'; completedAt?: string; evidence?: string }> = [
    { id: 'act_ishbel_1', title: 'MHO report under s57(3) for the welfare guardianship application', detail: 'Statutory deadline 14 Sep 2026 (21 days from notice on 24 Aug, s57(4))', owner: mho, agency: 'social-work', due: '2026-09-14', status: 'in-progress', evidence: 'Mrs Grant interviewed 27 Aug and 1 Sep; both children seen; draft started 1 Sep' },
    { id: 'act_ishbel_2', title: 'Serve intimation of the application on Mrs Grant, Morag Kilgour and Douglas Grant; notify the MWC and OPG', owner: sw, agency: 'social-work', due: '2026-09-01', status: 'complete', completedAt: at('2026-09-01', '16:00'), evidence: 'Intimation served on the ward 1 Sep with the advocate present; letters to both children 28 Aug; MWC and OPG notified 28 Aug' },
    { id: 'act_ishbel_3', title: 'Offer independent advocacy to Mrs Grant for the hearing', owner: sw, agency: 'social-work', due: '2026-08-28', status: 'complete', completedAt: at('2026-08-26', '11:00'), evidence: 'Referred to Clydeshore Advocacy 21 Aug; Tam Guthrie met her on the ward 26 Aug and will attend the hearing' },
    { id: 'act_ishbel_4', title: 'Identify two residential placements the family can visit, and cost a home package with overnight cover for comparison', owner: discharge, agency: 'health', due: '2026-09-11', status: 'in-progress', evidence: 'Rowanbank Care Home and Glen View visited by Morag 29 Aug; home package costing requested from Adult Services' },
    { id: 'act_ishbel_5', title: 'Meet Douglas Grant with the council solicitor to explain the hearing, his right to be heard, and what a safe home package would need', owner: sw, agency: 'social-work', due: '2026-09-08', status: 'open' },
    { id: 'act_ishbel_6', title: 'Weekly update from ward 7 to the allocated worker on wellbeing, falls and attempts to leave, until discharge', owner: discharge, agency: 'health', due: '2026-09-25', status: 'in-progress', evidence: 'Updates 26 Aug and 1 Sep' },
  ];
  for (const a of actions) {
    makeAction(ctx, { id: a.id, processId: process.id, meetingId: ISHBEL.mdt, title: a.title, detail: a.detail, ownerUserId: a.owner, ownerName: name(a.owner), ownerAgency: a.agency, due: a.due, status: a.status, completedAt: a.completedAt, evidence: a.evidence, createdAt: at('2026-08-20', '15:15'), createdByName: name(sw) });
  }

  // ----- Meeting -----
  makeMeeting(ctx, {
    id: ISHBEL.mdt,
    type: 'awi-mdt',
    processId: process.id,
    subjectIds: [ishbel.id],
    title: 'AWI multi-disciplinary discussion: Ishbel Grant',
    scheduledAt: at('2026-08-20', '14:00'),
    endsAt: at('2026-08-20', '15:15'),
    location: 'Clydeshore Royal Infirmary, ward 7 meeting room',
    status: 'held',
    chairUserId: sw,
    chairName: name(sw),
    invitees: [
      { userId: sw, name: name(sw), agency: 'social-work', role: 'Allocated social worker', required: true, attendance: 'present', reason: 'Prepares the application', needToKnowRowId: 'awi.concern.worker' },
      { userId: mho, name: name(mho), agency: 'social-work', role: 'Mental Health Officer', required: true, attendance: 'present', reason: 'MHO report', needToKnowRowId: 'awi.concern.mho' },
      { userId: discharge, name: name(discharge), agency: 'health', role: 'Discharge coordinator', required: true, attendance: 'present', reason: 'Delayed discharge', needToKnowRowId: 'awi.concern.discharge' },
      { name: `${geriatrician}, consultant geriatrician`, agency: 'health', role: 'Consultant geriatrician', required: true, attendance: 'present', reason: 'Capacity assessment and medical report' },
      { userId: gp, name: `Dr ${name(gp)}`, agency: 'health', role: 'GP', required: false, attendance: 'remote', reason: 'Second medical report', needToKnowRowId: 'awi.concern.gp' },
      { userId: mwc, name: name(mwc), agency: 'regulator', role: 'MWC practitioner', required: false, attendance: 'apologies', reason: 'Welfare guardianship; summary only' },
      { name: 'Ishbel Grant', agency: 'social-work', role: 'Adult', required: true, attendance: 'present', reason: 'The adult; attended the first part with her daughter' },
      { name: 'Morag Kilgour', agency: 'social-work', role: 'Daughter, nearest relative', required: true, attendance: 'present', reason: 'Consultation under s1' },
      { name: 'Douglas Grant', agency: 'social-work', role: 'Son', required: true, attendance: 'present', reason: 'Consultation under s1; objects to a move' },
    ],
    agenda: [
      { id: 'ag_ishbel_mdt_1', order: 1, title: 'Purpose and confidentiality', status: 'done' },
      { id: 'ag_ishbel_mdt_2', order: 2, title: 'Ishbel\'s views', status: 'done' },
      { id: 'ag_ishbel_mdt_3', order: 3, title: 'Capacity assessments and medical reports', status: 'done' },
      { id: 'ag_ishbel_mdt_4', order: 4, title: 'Family views and s13ZA', status: 'done' },
      { id: 'ag_ishbel_mdt_5', order: 5, title: 'Route, powers sought, interim order', status: 'done' },
      { id: 'ag_ishbel_mdt_6', order: 6, title: 'Discharge planning while the application proceeds', status: 'done' },
    ],
    preMeetingRequests: [
      { id: 'pmr_ishbel_mdt_1', agency: 'health', toName: `${geriatrician}, consultant geriatrician`, sentAt: at('2026-08-07', '12:00'), dueAt: '2026-08-19', status: 'returned', returnSummary: 'Medical report (approved medical practitioner): diagnosis, capacity assessment, incapacity for the residence decision', returnedAt: at('2026-08-19', '10:00') },
      { id: 'pmr_ishbel_mdt_2', agency: 'health', toName: `Dr ${name(gp)}`, toUserId: gp, sentAt: at('2026-08-07', '12:00'), dueAt: '2026-08-19', status: 'returned', returnSummary: 'Medical report (GP): history, capacity for financial decisions, agreement with the ward assessment', returnedAt: at('2026-08-21', '16:30') },
    ],
    pack: [
      { id: 'pk_ishbel_mdt_1', kind: 'chronology', label: 'Integrated chronology, 2023 to date', windowFrom: '2023-01-01', windowTo: '2026-08-19', included: true },
      { id: 'pk_ishbel_mdt_2', kind: 'views', label: 'Ishbel\'s views and will and preferences (7 Aug)', ref: 'vw_ishbel_1', included: true },
      { id: 'pk_ishbel_mdt_3', kind: 'report', label: 'Capacity assessments (4 and 6 Aug)', ref: 'cap_ishbel_1', included: true },
      { id: 'pk_ishbel_mdt_4', kind: 'report', label: 'OPG register result', ref: 'OPG-REG-2026-40922', included: true },
      { id: 'pk_ishbel_mdt_5', kind: 'report', label: 'Route decision and s13ZA record', ref: 'route-ishbel-2026-08-12', included: true },
    ],
    informationShared: [
      { id: 'is_ishbel_mdt_1', agency: 'health', byName: `${geriatrician}, consultant geriatrician`, at: at('2026-08-20', '14:15'), summary: 'Alzheimer\'s type dementia; MMSE 14/30; lacks capacity for the residence decision on two assessments. Physically well; fractured wrist healed. Medically fit since 24 Jul.', relevance: 'Incapacity and fitness for discharge', linkedEventIds: [] },
      { id: 'is_ishbel_mdt_2', agency: 'health', byName: name(discharge), byUserId: discharge, at: at('2026-08-20', '14:25'), summary: 'Delayed discharge 27 days. Two attempts to leave the ward at night. Home visit with occupational therapy on 13 Aug: stairs unsafe without supervision; no downstairs toilet.', relevance: 'Risk at home and delay', linkedEventIds: [] },
      { id: 'is_ishbel_mdt_3', agency: 'social-work', byName: name(sw), byUserId: sw, at: at('2026-08-20', '14:35'), summary: 'No power of attorney or guardianship. s13ZA considered and not available because Douglas objects. Council to apply for welfare guardianship under s57(2). Home package with overnight cover being costed for comparison.', relevance: 'Route and least restrictive option', linkedEventIds: [] },
      { id: 'is_ishbel_mdt_4', agency: 'social-work', byName: name(mho), byUserId: mho, at: at('2026-08-20', '14:45'), summary: 'MHO will report under s57(3) once notified. Will interview Mrs Grant twice and see both children. Will address whether the powers sought are the least restrictive.', relevance: 'MHO report', linkedEventIds: [] },
    ],
    decisions: [
      { id: 'dec_ishbel_mdt_1', question: 'Route', decision: 'Apply for welfare guardianship with the council as applicant, powers limited to residence, care arrangements and access to information', rationale: 'Lacks capacity for the decision; no attorney; s13ZA not available because her son objects; council duty under s57(2). Financial powers not sought.', dissent: [{ byName: 'Douglas Grant', agency: 'social-work', text: 'Douglas Grant does not agree that his mother needs to go into a home and will oppose the application. He asked that his offer to move into Larch Brae and provide overnight care be recorded and costed.' }], decidedByName: name(sw), decidedByUserId: sw, decidedAt: at('2026-08-20', '14:55') },
      { id: 'dec_ishbel_mdt_2', question: 'Interim order', decision: 'Seek an interim welfare guardianship order with the application so that a discharge decision can be made before the full hearing', rationale: 'Delayed discharge since 24 Jul; the hearing is unlikely before late September. Interim duration will be tracked against the three-month default and six-month maximum.', dissent: [], decidedByName: name(sw), decidedByUserId: sw, decidedAt: at('2026-08-20', '15:00') },
      { id: 'dec_ishbel_mdt_3', question: 'Discharge', decision: 'Mrs Grant stays on ward 7 until the interim order is granted or the family and the council agree a safe plan', rationale: 'Discharge home without overnight cover is unsafe; discharge to residential care without lawful authority is not possible while her son objects.', dissent: [{ byName: 'Douglas Grant', agency: 'social-work', text: 'Douglas Grant wants his mother home now and says he will provide overnight cover from today.' }], decidedByName: name(sw), decidedByUserId: sw, decidedAt: at('2026-08-20', '15:05') },
      { id: 'dec_ishbel_mdt_4', question: 'Ishbel\'s participation', decision: 'Her views to be re-recorded before the hearing; independent advocacy to be offered; intimation to be served on her in person with the advocate present', rationale: 's1 principles: her past and present wishes must be before the sheriff in her own words', dissent: [], decidedByName: name(sw), decidedByUserId: sw, decidedAt: at('2026-08-20', '15:10') },
    ],
    actionIds: actions.map((a) => a.id),
    viewsRecordIds: ['vw_ishbel_1', 'vw_ishbel_family'],
    minute: { status: 'distributed', draftedAt: at('2026-08-21', '10:00'), approvedAt: at('2026-08-21', '15:00'), distributedAt: at('2026-08-21', '15:30') },
    distribution: [
      { id: 'dist_ishbel_mdt_1', recipientName: name(mho), recipientUserId: mho, agency: 'social-work', role: 'Mental Health Officer', detailLevel: 'full', reason: 'MHO report', sharingRecordId: 'shr_ishbel_1' },
      { id: 'dist_ishbel_mdt_2', recipientName: `${geriatrician}, consultant geriatrician`, agency: 'health', role: 'Consultant geriatrician', detailLevel: 'full', reason: 'Attended; medical report' },
      { id: 'dist_ishbel_mdt_3', recipientName: 'Morag Kilgour', agency: 'social-work', role: 'Daughter, nearest relative', detailLevel: 'summary', reason: 'Nearest relative; notification and rights' },
      { id: 'dist_ishbel_mdt_4', recipientName: 'Douglas Grant', agency: 'social-work', role: 'Son', detailLevel: 'summary', reason: 'Consulted relative; right to be heard' },
      { id: 'dist_ishbel_mdt_5', recipientName: name(mwc), recipientUserId: mwc, agency: 'regulator', role: 'MWC practitioner', detailLevel: 'summary', reason: 'Welfare guardianship application by the council', sharingRecordId: 'shr_ishbel_5' },
    ],
    reviewDate: '2026-09-25',
    subjectAttendance: 'Mrs Grant attended the first fifteen minutes with her daughter and said she wanted to go home. She returned to the ward at her own request. Both children stayed throughout. Douglas Grant\'s objection is recorded against each decision he disagreed with.',
  });

  // ----- Sharing records -----
  const share = (id: string, stage: Process['stage'], to: string, agency: Agency, role: string, level: 'full' | 'summary' | 'fields' | 'presence', reason: string, summary: string, createdAt: string, rowId?: string, fields?: string[], channel: 'in-app' | 'secure-email-digest' | 'connector-push' = 'in-app') =>
    makeShare(ctx, { id, processId: process.id, subjectId: ishbel.id, stage, recipient: { userId: to, name: name(to), agency, role }, detailLevel: level, fields, lawfulBasisId: lb.id, channel, status: 'read', createdAt, sentAt: createdAt, readAt: createdAt, reason, needToKnowRowId: rowId, createdByUserId: sw, createdByName: name(sw), summary });
  share('shr_ishbel_1', 'capacity-concern', mho, 'social-work', 'Mental Health Officer', 'full', 'Capacity concern raised. If welfare guardianship is likely.', 'Capacity concern from ward 7: residence decision; no attorney; family divided; welfare guardianship likely', at('2026-07-28', '12:00'), 'awi.concern.mho');
  share('shr_ishbel_2', 'capacity-concern', gp, 'health', 'GP', 'full', 'Capacity concern raised. GP or consultant.', 'Capacity concern from ward 7; request for the GP medical report and a capacity assessment for financial decisions', at('2026-07-28', '12:00'), 'awi.concern.gp');
  share('shr_ishbel_3', 'existing-powers', opg, 'regulator', 'OPG officer', 'fields', 'OPG check made. OPG register result.', 'Register check for Ishbel Grant, born 11 May 1942: no power of attorney, no guardianship (OPG-REG-2026-40922)', at('2026-08-05', '09:30'), 'awi.powers.opg', ['register result', 'adult name and date of birth'], 'connector-push');
  share('shr_ishbel_4', 'application', mho, 'social-work', 'Mental Health Officer', 'full', 'Application notified. MHO report under s57(3) and (4).', 'Notice of the council\'s welfare guardianship application; 21-day report clock started 24 Aug; due 14 Sep', at('2026-08-24', '10:00'), 'awi.application.mho');
  share('shr_ishbel_5', 'application', mwc, 'regulator', 'MWC practitioner', 'summary', 'Welfare guardianship application by the council; MWC notified.', 'Council application for welfare guardianship lodged at Ardvale Sheriff Court 28 Aug; interim order sought; hearing 25 Sep', at('2026-08-28', '16:00'), undefined, undefined, 'secure-email-digest');

  // ----- Chronology events -----
  const E = (e: Omit<Parameters<typeof makeEvent>[1], 'subjectIds'> & { subjectIds?: string[] }) =>
    makeEvent(ctx, { subjectIds: [ishbel.id], linkedProcessIds: [process.id], visibility: 'integrated', lawfulBasisId: lb.id, ...e });

  E({ occurredAt: at('2014-10-03', '00:00'), agency: 'health', sourceSystem: 'emis-web', recordedByName: 'EMIS Web connector', eventType: 'family.death', title: 'Husband Tom Grant died', detail: 'Recorded in the GP record. Mrs Grant widowed after 51 years. Continued to live alone at Larch Brae with support from her daughter.', significance: 'low' });
  E({ occurredAt: at('2023-02-14', '11:00'), agency: 'health', sourceSystem: 'trakcare', recordedByName: 'TrakCare connector', eventType: 'health.diagnosis', title: 'Alzheimer\'s type dementia diagnosed at the memory clinic', detail: 'Cognitive testing (MMSE 22/30) and scan. Told with her daughter present. Advice on power of attorney given in writing and copied to the GP.', significance: 'high', significanceReason: 'Diagnosis underlying the incapacity', linkedPersonIds: [morag.id] });
  E({ occurredAt: at('2023-03-01', '10:15'), agency: 'health', sourceSystem: 'emis-web', recordedByName: 'EMIS Web connector', eventType: 'health.consultation', title: 'GP: donepezil started; power of attorney recommended again', detail: 'Attended with her daughter. Donepezil started. Power of attorney discussed; daughter to raise it with her brother. Not taken up.', significance: 'moderate', significanceReason: 'Power of attorney recommended and not granted', linkedPersonIds: [morag.id] });
  E({ occurredAt: at('2024-09-10', '00:00'), agency: 'social-work', sourceSystem: 'carefirst', recordedByName: 'CareFirst connector', eventType: 'social-work.assessment', title: 'Community care assessment: daily care at home visit; key safe fitted', detail: 'Assessment by Stuart Blair. Mrs Grant clear that she wants to stay at home. Morning visit for medication and breakfast. Son visits in the evenings. A move was mentioned by her daughter and refused by Mrs Grant.', significance: 'moderate', significanceReason: 'Earlier expressed wish to stay at home', linkedPersonIds: [morag.id, douglas.id] });
  E({ occurredAt: at('2025-05-22', '16:40'), agency: 'health', sourceSystem: 'trakcare', recordedByName: 'TrakCare connector', eventType: 'health.attendance', title: 'Emergency department: fall at home, bruised hip, discharged the same day', detail: 'Tripped on the stair carpet in the afternoon. Bruising, no fracture. Discharged to her daughter. Falls referral made.', significance: 'moderate', significanceReason: 'First recorded fall' });
  E({ occurredAt: at('2026-03-18', '08:10'), agency: 'social-work', sourceSystem: 'carefirst', recordedByName: 'CareFirst connector', eventType: 'care.provider-concern', title: 'Care at home: found on the floor by the carer; had been there "since the night"', detail: 'Found on the landing at the morning visit, cold and unable to get up. No injury. Ambulance not needed. Daughter informed. Care package review requested.', significance: 'high', significanceReason: 'Second fall; a long lie' });
  E({ occurredAt: at('2026-04-14', '00:00'), agency: 'social-work', sourceSystem: 'carefirst', recordedByName: 'CareFirst connector', eventType: 'social-work.plan-review', title: 'Care package increased to three visits a day; night-time wandering reported by her son', detail: 'Son reports finding the front door open twice and his mother in the garden at 05:00 in April. Telecare door sensor fitted. Overnight care not available.', significance: 'moderate', linkedPersonIds: [douglas.id] });
  E({ occurredAt: at('2026-06-30', '10:40'), agency: 'health', sourceSystem: 'emis-web', recordedByName: 'EMIS Web connector', eventType: 'health.consultation', title: 'GP: weight loss, forgetting to eat; daughter asks about a care home', detail: 'Weight down 4 kg since January. Daughter raised residential care; Mrs Grant said "I am going nowhere". Dietitian referral. No power of attorney in place.', significance: 'moderate', linkedPersonIds: [morag.id] });
  E({ occurredAt: at('2026-07-15', '06:40'), agency: 'health', sourceSystem: 'trakcare', recordedByName: 'TrakCare connector', eventType: 'health.admission', title: 'Admitted to Clydeshore Royal Infirmary after a fall at home: fractured left wrist, dehydration', detail: 'Found at the foot of the stairs by the morning carer. Fractured left wrist, dehydrated, confused. Admitted to ward 7 (care of the elderly).', significance: 'high', significanceReason: 'Third fall; admission that led to the delayed discharge' });
  E({ occurredAt: at('2026-07-24', '00:00'), agency: 'health', sourceSystem: 'trakcare', recordedByName: 'TrakCare connector', eventType: 'health.assessment', title: 'Medically fit for discharge; delayed discharge recorded', detail: 'Wrist in a cast, mobilising with a frame. Ward team and consultant consider she cannot return home safely. Discharge coordinator allocated. Family meeting requested.', significance: 'high', significanceReason: 'Start of the delayed discharge' });
  E({ occurredAt: at('2026-07-28', '11:00'), agency: 'health', recordedByName: name(discharge), recordedByUserId: discharge, eventType: 'social-work.referral', title: 'AWI capacity concern raised by the discharge coordinator', detail: 'Capacity for the residence decision in doubt. Daughter supports residential care; son objects. No power of attorney known. Referred to Adult Services, Portnellan; allocated to Stuart Blair.', significance: 'high', significanceReason: 'AWI process started' });
  E({ occurredAt: at('2026-07-30', '10:00'), agency: 'health', sourceSystem: 'trakcare', recordedByName: 'TrakCare connector', eventType: 'health.assessment', title: 'Ward cognitive testing: MMSE 14/30', detail: 'Down from 22/30 in 2023. Orientated to person only. Hearing aids in for the test.', significance: 'moderate' });
  E({ occurredAt: at('2026-08-04', '14:00'), agency: 'health', recordedByName: `${geriatrician}, consultant geriatrician`, eventType: 'health.assessment', title: 'Capacity assessment (residence decision): lacks capacity', detail: 'Assessed twice, morning and afternoon. Understands she is in hospital and wants to go home; cannot retain information about the falls or the stairs, and cannot weigh the risks against her wish. Approved medical practitioner report to follow.', significance: 'high', significanceReason: 'Incapacity for the decision in question' });
  E({ occurredAt: at('2026-08-05', '09:30'), agency: 'regulator', sourceSystem: 'opg', recordedByName: 'OPG register connector', recordedByUserId: opg, eventType: 'other', title: 'OPG register check: no power of attorney, no guardianship', detail: 'Reference OPG-REG-2026-40922. No registered power of attorney, guardianship or intervention order for Ishbel Grant.', significance: 'high', significanceReason: 'No existing powers; a route decision is needed' });
  E({ occurredAt: at('2026-08-06', '11:00'), agency: 'health', recordedByName: `Dr ${name(gp)}`, recordedByUserId: gp, eventType: 'health.assessment', title: 'Capacity assessment (financial decisions): lacks capacity', detail: 'Cannot say what income she has or name her bank; believes her late husband pays the bills. Financial powers not sought in this application; Part 3 access to funds suggested to the family.', significance: 'moderate' });
  E({ occurredAt: at('2026-08-07', '10:30'), agency: 'social-work', recordedByName: name(sw), recordedByUserId: sw, eventType: 'voice.adult', title: 'Ishbel\'s views recorded: "I want to go home to my own bed"', detail: 'Side room, mid-morning, daughter present. Wants to go home; Douglas will look after her; does not remember falling. Past wishes recorded from her daughter: never wanted to go into a home.', significance: 'high', significanceReason: 'Her will and preferences, for the sheriff' });
  E({ occurredAt: at('2026-08-12', '15:00'), agency: 'social-work', recordedByName: name(sw), recordedByUserId: sw, eventType: 'social-work.assessment', title: 'Route decision: welfare guardianship; s13ZA not available because her son objects', detail: 'Council to apply under s57(2). Powers sought limited to residence, care arrangements and information. s13ZA considered and recorded as not available: Douglas Grant objects. Financial powers not sought.', significance: 'high', significanceReason: 'Route decision with s13ZA reasoning recorded', linkedPersonIds: [douglas.id] });
  E({ occurredAt: at('2026-08-13', '10:30'), agency: 'health', recordedByName: name(discharge), recordedByUserId: discharge, eventType: 'health.assessment', title: 'Home visit with occupational therapy: stairs unsafe without supervision; no downstairs toilet', detail: 'Mrs Grant taken home for two hours with OT and her son. Managed the front step with help; could not manage the stairs safely; became distressed when it was time to leave.', significance: 'moderate', linkedPersonIds: [douglas.id] });
  E({ occurredAt: at('2026-08-19', '10:00'), agency: 'health', recordedByName: name(discharge), recordedByUserId: discharge, eventType: 'sharing', title: 'Medical report received: approved medical practitioner (Dr Ruth Cameron)', detail: 'First of the two medical reports required for the application. Confirms incapacity for the residence decision arising from mental disorder.', significance: 'moderate' });
  E({ occurredAt: at('2026-08-20', '14:00'), agency: 'social-work', recordedByName: name(sw), recordedByUserId: sw, eventType: 'process.case-conference', title: 'AWI multi-disciplinary meeting: apply for welfare guardianship; seek interim order; dissent from Douglas Grant', detail: 'Ward 7. Both children present; Mrs Grant attended the first part. Decisions: council application for welfare guardianship; interim order sought; no discharge before the interim order or agreement; advocacy offered. Douglas Grant\'s objection recorded.', significance: 'high', significanceReason: 'Decisions on route, interim order and discharge', linkedPersonIds: [morag.id, douglas.id] });
  E({ occurredAt: at('2026-08-20', '15:00'), agency: 'social-work', recordedByName: name(sw), recordedByUserId: sw, eventType: 'voice.family', title: 'Family views recorded: daughter supports residential care, son objects', detail: 'Morag Kilgour: cannot do the nights; wants her mother safe. Douglas Grant: will move in; a home "would kill her"; will oppose the application in court.', significance: 'moderate', linkedPersonIds: [morag.id, douglas.id] });
  E({ occurredAt: at('2026-08-21', '16:30'), agency: 'health', recordedByName: `Dr ${name(gp)}`, recordedByUserId: gp, eventType: 'sharing', title: 'Medical report received: GP (Dr Amira Farouk)', detail: 'Second medical report. History, capacity for financial decisions, agreement with the ward assessment.', significance: 'moderate' });
  E({ occurredAt: at('2026-08-24', '10:00'), agency: 'social-work', recordedByName: name(sw), recordedByUserId: sw, eventType: 'legal.guardianship', title: 'MHO notified of the guardianship application (s57(3)); 21-day report clock started', detail: 'Notice given to Graeme Dunlop, MHO. Report due 14 Sep under s57(4). Two medical reports in hand.', significance: 'high', significanceReason: 'Statutory clock started' });
  E({ occurredAt: at('2026-08-27', '11:00'), agency: 'social-work', recordedByName: name(mho), recordedByUserId: mho, eventType: 'social-work.contact', title: 'MHO interview with Mrs Grant on ward 7 (first of two)', detail: 'Mid-morning, hearing aids in, advocate present. Wants to go home. Could not describe what help she would need. MHO to see both children this week and interview again on 1 Sep.', significance: 'moderate' });
  E({ occurredAt: at('2026-08-28', '15:30'), agency: 'social-work', recordedByName: solicitor, eventType: 'legal.hearing', title: 'Application lodged at Ardvale Sheriff Court with a motion for an interim order; hearing fixed for 25 Sep', detail: 'Summary application under s57 for welfare guardianship, council applicant, with both medical reports. MHO report to follow by 14 Sep. Interim order sought; not yet granted. MWC and OPG notified.', significance: 'high', significanceReason: 'Court timeline started' });
  E({ occurredAt: at('2026-09-01', '14:00'), agency: 'social-work', recordedByName: name(sw), recordedByUserId: sw, eventType: 'legal.guardianship', title: 'Intimation served on Mrs Grant in person with her advocate; letters to both children', detail: 'Explained on the ward with Tam Guthrie present. Mrs Grant said "I will tell the sheriff myself". Douglas Grant has instructed a solicitor to oppose.', significance: 'moderate', linkedPersonIds: [morag.id, douglas.id] });

  const fallIds = ctx.data.events.filter((e) => e.subjectIds.includes(ishbel.id) && (e.title.toLowerCase().includes('fall') || e.title.includes('floor'))).map((e) => e.id);
  makeAnalysis(ctx, {
    id: 'ana_ishbel_1',
    subjectId: ishbel.id,
    processId: process.id,
    eventIds: fallIds,
    authorUserId: sw,
    authorName: name(sw),
    agency: 'social-work',
    recordedAt: at('2026-08-12', '14:30'),
    kind: 'risk',
    title: 'Three falls in sixteen months, each found later than the last',
    text: 'The May 2025 fall was in the afternoon and she was found at once. The March 2026 fall was overnight and she was found by the morning carer after a long lie. The July 2026 fall was on the stairs with a fracture and dehydration. The interval is shortening and the harm is increasing, and all three happened when nobody was in the house. This is the evidence for the risk at night that the application relies on; it is set against her consistent wish to be at home, which the sheriff must weigh.',
  });

  // Connector inbox: one pending ward note.
  makeConnectorEvent(ctx, {
    id: 'cev_ishbel_trakcare',
    connectorId: 'trakcare',
    agency: 'health',
    subjectId: ishbel.id,
    receivedAt: at('2026-09-01', '20:10'),
    externalRef: 'TRAK-WN-2026-09-01-7714',
    sourcePayload: { patient: 'GRANT, Ishbel', ward: '7', entry: 'Nursing note (nights)', time: '03:20', note: 'Patient found at the ward door saying she was going home; returned by night staff; settled with tea by 03:50. Second episode this week. No injury.', author: 'Staff nurse, nights' },
    mapped: { eventType: 'other', title: 'Ward 7 night note: tried to leave the ward, "going home"; second episode this week', detail: 'Found at the ward door at 03:20 saying she was going home. Returned by night staff and settled by 03:50. No injury. Second episode this week.', occurredAt: at('2026-09-01', '03:20'), hasTime: true, significance: 'moderate', mappingRule: 'trakcare.ward-note.attempt-to-leave' },
  });

  void adv;
}
