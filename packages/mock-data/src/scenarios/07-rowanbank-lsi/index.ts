/**
 * Scenario 7: Rowanbank Care Home, Braeside. An Adult Support and Protection Large Scale
 * Investigation: six residents, medication errors found by the Care Inspectorate, and one
 * alleged financial irregularity raised by a relative. One process, many subjects, a strand per
 * resident, and a joint chronology that mixes setting-level and per-resident events.
 */
import type { Agency, Invitee, Membership, Process } from '@mas/domain';
import type { BuildContext } from '../../generator/context';
import { at, makeAction, makeAddress, makeAnalysis, makeConnectorEvent, makeEvent, makeLawfulBasis, makeMeeting, makePerson, makeShare, makeViews, relate, syntheticChi } from '../../generator/factory';
import { USR, userName } from '../../generator/organisations';

export const ROWANBANK = {
  address: 'adr_rowanbank',
  household: 'hh_rowanbank',
  wilma: 'per_wilma_sneddon',
  jean: 'per_jean_kilgour',
  malcolm: 'per_malcolm_rankin',
  zofia: 'per_zofia_wisniewska',
  margaret: 'per_margaret_cairns',
  archie: 'per_archie_drummond',
  linda: 'per_linda_paterson',
  robert: 'per_robert_kilgour',
  process: 'prc_asp_rowanbank',
  planningMeeting: 'mtg_rowanbank_lsi_planning',
  reviewMeeting: 'mtg_rowanbank_lsi_review',
  lawfulBasis: 'lb_rowanbank_asp',
} as const;

export function seedRowanbankLsi(ctx: BuildContext): void {
  const name = (id: string) => userName(ctx, id);

  // Personas. Only ids from USR are used.
  const moira = USR.moiraGilmour; // council officer
  const stuart = USR.stuartBlair; // second worker
  const morven = USR.morvenTait; // Care Inspectorate
  const amira = USR.amiraFarouk; // GP, medication review
  const paul = USR.paulMackay; // DS, financial allegation
  const tam = USR.tamGuthrie; // independent advocate
  const alistair = USR.alistairMeek; // OPG
  const andrew = USR.andrewMuirhead; // CSWO oversight
  const minutes = USR.lesleyMorton; // minute taker

  // People not on the platform as personas, named in the record.
  const HOME_MANAGER = 'Sandra Whyte';
  const PROVIDER_REP = 'Gordon Pettigrew';
  const COMMISSIONING_LEAD = 'Iain Buchanan';

  // ----- The setting -----
  const home = makeAddress(ctx, { id: ROWANBANK.address, line1: '1 Rowan Gait', line2: 'Rowanbank Care Home', town: 'Braeside', postcode: 'QX5 7LQ' });
  const lindaHome = makeAddress(ctx, { id: 'adr_linda_paterson', line1: '22 Loch Brae', town: 'Braeside', postcode: 'QX5 4HN' });
  const robertHome = makeAddress(ctx, { id: 'adr_robert_kilgour', line1: '8 Seaforth Loan', town: 'Kilbrannan', postcode: 'QX2 5PW' });

  const resident = (id: string, givenName: string, familyName: string, sex: 'female' | 'male', dateOfBirth: string, admitted: string, extra: Partial<Parameters<typeof makePerson>[1]> = {}) =>
    makePerson(ctx, {
      id,
      givenName,
      familyName,
      sex,
      dateOfBirth,
      chi: syntheticChi(ctx, dateOfBirth, sex),
      addressHistory: [{ addressId: home.id, from: admitted, note: 'Permanent resident, Rowanbank Care Home' }],
      householdId: ROWANBANK.household,
      gpPractice: 'Braeside Health Centre',
      ethnicity: 'scottish',
      createdAt: at(admitted, '10:00'),
      ...extra,
    });

  const wilma = resident(ROWANBANK.wilma, 'Wilma', 'Sneddon', 'female', '1934-05-14', '2023-11-06', {
    communicationNeeds: { needs: ['Hard of hearing: sit on her left and speak clearly'] },
  });
  const jean = resident(ROWANBANK.jean, 'Jean', 'Kilgour', 'female', '1938-03-12', '2024-02-19', {
    communicationNeeds: { needs: ['Alzheimer\'s dementia: short sentences, one question at a time, best in the morning'] },
    alerts: [{ id: 'alt_jean_poa', kind: 'other', text: 'Welfare and financial attorney: Robert Kilgour (son), registered with OPG 17 May 2021', from: '2021-05-17' }],
  });
  const malcolm = resident(ROWANBANK.malcolm, 'Malcolm', 'Rankin', 'male', '1940-01-18', '2025-03-03', {
    communicationNeeds: { needs: ['Type 1 diabetes: insulin twice daily, time critical'] },
  });
  const zofia = resident(ROWANBANK.zofia, 'Zofia', 'Wisniewska', 'female', '1942-02-20', '2024-09-30', {
    ethnicity: 'polish',
    communicationNeeds: { interpreterLanguage: 'Polish', needs: ['Polish interpreter for any interview, meeting or consent discussion', 'Reads Polish; written English limited'], note: 'Speaks some English day to day but reverts to Polish when tired or unwell' },
  });
  const margaret = resident(ROWANBANK.margaret, 'Margaret', 'Cairns', 'female', '1946-04-25', '2025-06-16', {
    preferredName: 'Peggy',
    communicationNeeds: { needs: ['Parkinson\'s disease: time-critical medication; allow time to answer'] },
  });
  const archie = resident(ROWANBANK.archie, 'Archie', 'Drummond', 'male', '1948-06-03', '2024-05-13', {
    communicationNeeds: { needs: ['Vascular dementia: supported by an independent advocate; picture cards help'] },
  });
  const residents = [wilma, jean, malcolm, zofia, margaret, archie];
  const all = residents.map((r) => r.id);

  ctx.data.households.push({ id: ROWANBANK.household, synthetic: true, addressId: home.id, memberIds: all, label: 'Rowanbank Care Home residents' });

  // Relatives named in the record.
  const linda = makePerson(ctx, { id: ROWANBANK.linda, givenName: 'Linda', familyName: 'Paterson', sex: 'female', dateOfBirth: '1961-08-09', chi: syntheticChi(ctx, '1961-08-09', 'female'), addressHistory: [{ addressId: lindaHome.id, from: '2004-03-01' }], contact: { phone: '07700 900418' }, ethnicity: 'scottish', createdAt: at('2023-11-06', '10:00') });
  const robert = makePerson(ctx, { id: ROWANBANK.robert, givenName: 'Robert', familyName: 'Kilgour', sex: 'male', dateOfBirth: '1963-12-02', chi: syntheticChi(ctx, '1963-12-02', 'male'), addressHistory: [{ addressId: robertHome.id, from: '1998-06-15' }], contact: { phone: '07700 900419' }, ethnicity: 'scottish', createdAt: at('2024-02-19', '10:00') });
  relate(ctx, linda.id, wilma.id, 'child-of', { notes: 'Daughter; visits twice a week; raised the financial concern' });
  relate(ctx, linda.id, wilma.id, 'carer-of', { notes: 'Manages her mother\'s post and bills' });
  relate(ctx, robert.id, jean.id, 'child-of');
  relate(ctx, robert.id, jean.id, 'attorney-for', { from: '2021-05-17', notes: 'Combined welfare and financial power of attorney, registered with OPG' });

  // ----- Lawful basis -----
  const lb = makeLawfulBasis(ctx, {
    id: ROWANBANK.lawfulBasis,
    purpose: 'Large Scale Investigation under the Adult Support and Protection (Scotland) Act 2007 into medication errors and a financial irregularity at Rowanbank Care Home',
    article6: '6(1)(c) legal obligation',
    article9Condition: '9(2)(g) substantial public interest, DPA 2018 Sch 1 Pt 2 para 18 (safeguarding)',
    article10Criminal: 'DPA 2018 s10 and Sch 1',
    statutoryGateway: [
      'Adult Support and Protection (Scotland) Act 2007 s4 (duty to make inquiries)',
      'Adult Support and Protection (Scotland) Act 2007 s5 (duty to cooperate: council, Care Inspectorate, health board, Police Scotland, Office of the Public Guardian)',
      'Adult Support and Protection (Scotland) Act 2007 s10 (examination of records)',
      'Adult Support and Protection (Scotland) Act 2007 Code of Practice 2022, chapter on Large Scale Investigations',
    ],
    necessityAndProportionality: 'Sharing between the council, the Care Inspectorate, the GP practice, police, OPG and the advocacy service is necessary to establish whether six residents are at risk of harm from the way the service is run and to protect them. Resident-level detail goes to the agencies working that strand; the provider receives the decisions and actions that affect the service, not interview records.',
    consentStatus: 'sought-and-given',
    consentNote: 'Consent sought from each resident with capacity and given; the attorney consulted for Jean Kilgour; Archie Drummond lacks capacity and has no proxy, so the council proceeds under its s4 duty with advocacy.',
    authorisedByUserId: moira,
    authorisedByName: name(moira),
    informationSharingAgreementRef: 'Clydeshore APC ISA 2023/02',
    dpiaRef: 'DPIA-ASP-2023-04',
    createdAt: at('2026-07-30', '16:00'),
  });

  // ----- Members -----
  const members: Membership[] = [
    { userId: moira, caseRole: 'council officer (lead)', agency: 'social-work', since: '2026-07-30', reason: 'Council officer under s52; leads the investigation and chairs the LSI planning meetings' },
    { userId: stuart, caseRole: 'second worker', agency: 'social-work', since: '2026-07-31', reason: 'Second worker for visits and interviews; leads three strands' },
    { userId: morven, caseRole: 'Care Inspectorate inspector', agency: 'regulator', since: '2026-07-30', reason: 'Raised the concern; regulated service; parallel inspection under the duty to cooperate' },
    { userId: amira, caseRole: 'GP (medication review)', agency: 'health', since: '2026-07-31', reason: 'Health input: inspects health records under s10 and leads the medication review' },
    { userId: paul, caseRole: 'detective sergeant (financial allegation)', agency: 'police', since: '2026-08-05', reason: 'Criminal element: alleged theft from a personal allowance account' },
    { userId: tam, caseRole: 'independent advocate', agency: 'third-sector', since: '2026-08-07', reason: 'Advocacy offered and accepted; supports residents who lack capacity to give their views' },
    { userId: alistair, caseRole: 'OPG investigations officer', agency: 'regulator', since: '2026-08-06', reason: 'One resident has a welfare and financial attorney; register checks for all six' },
    { userId: andrew, caseRole: 'Chief Social Work Officer (oversight)', agency: 'social-work', since: '2026-08-06', reason: 'CSWO oversight of a Large Scale Investigation' },
  ];

  // ----- Process -----
  const process: Process = {
    id: ROWANBANK.process,
    synthetic: true,
    type: 'asp',
    reference: 'ASP-2026-0203',
    title: 'Large Scale Investigation: Rowanbank Care Home',
    subjectIds: all,
    leadAgency: 'social-work',
    leadUserId: moira,
    stage: 'investigation',
    stageHistory: [
      { stage: 'concern', at: at('2026-07-30', '11:20'), byUserId: moira, byName: name(moira), note: 'Adult concern from the Care Inspectorate after an unannounced inspection' },
      { stage: 'screening', at: at('2026-07-30', '15:30'), byUserId: moira, byName: name(moira), note: 'Three-point test applied at setting level: met for the residents as a group' },
      { stage: 'inquiry', at: at('2026-07-31', '09:00'), byUserId: moira, byName: name(moira), note: 'Inquiry opened under s4; second worker allocated' },
      { stage: 'investigation', at: at('2026-08-07', '09:00'), byUserId: moira, byName: name(moira), note: 'Investigation opened as a Large Scale Investigation after the planning meeting on 6 Aug' },
    ],
    status: 'open',
    classification: 'official-sensitive',
    openedAt: at('2026-07-30', '11:20'),
    members,
    clocks: [
      { id: 'clk_rowanbank_inquiry', ruleId: 'asp.inquiry.decision', triggeredAt: at('2026-07-30', '11:20'), completedAt: at('2026-08-06', '12:00'), note: 'Decision to proceed to investigation on working day 5' },
      { id: 'clk_rowanbank_conference', ruleId: 'asp.caseconference.initial', triggeredAt: at('2026-07-30', '11:20'), dueOverride: '2026-09-10', overrideReason: 'Large Scale Investigation: the LSI planning meeting on 6 Aug stands in place of an initial case conference and set a review of all strands for 10 Sep (Clydeshore LSI procedures)' },
    ],
    linkedProcessIds: [],
    viewsRecordIds: ['vw_rowanbank_archie', 'vw_rowanbank_zofia', 'vw_rowanbank_linda'],
    riskAssessmentIds: [],
    flags: { regulatedService: true, financialHarm: true, criminalElement: true, healthInput: true, advocacyOffered: true, recordsRequest: true },
    excludedUserIds: [],
    detail: {
      concern: {
        receivedAt: at('2026-07-30', '11:20'),
        source: 'Care Inspectorate, following an unannounced inspection on 28 and 29 Jul 2026',
        sourceAgency: 'regulator',
        sourceReference: 'Care Inspectorate notification CI-ASP-2026-0771',
        summary: 'Inspectors found medication administration errors on the July MAR charts affecting several residents: omitted doses, a double dose of an anticoagulant, and time-critical medication given late. One agency nurse covered most of the evening shifts concerned. A separate allegation followed on 5 Aug from a relative about money missing from a resident\'s personal allowance account.',
        harmTypes: ['neglect', 'physical', 'financial'],
        immediateSafety: 'The provider agreed on 30 Jul that two registered nurses cover every evening round and that the agency nurse concerned does not work at Rowanbank pending the investigation. The GP practice reviewed the residents most affected on 31 Jul.',
        policeInvolved: true,
      },
      threePointTest: {
        assessedAt: at('2026-07-30', '15:00'),
        byName: name(moira),
        byUserId: moira,
        a: { met: 'yes', reasoning: 'All six residents depend on the home for their medication and daily care. Two have dementia and cannot manage their own medicines or money; the others are physically frail and rely on staff to administer time-critical medication correctly.' },
        b: { met: 'yes', reasoning: 'Medication errors have already caused harm (an emergency department attendance after a double anticoagulant dose; a hypoglycaemia episode; a fall after late Parkinson\'s medication) and the pattern suggests the errors will continue without intervention. The financial allegation, if true, is financial harm to a resident who cannot check her own account.' },
        c: { met: 'yes', reasoning: 'Each resident is affected by illness, physical infirmity or mental disorder (dementia) that makes them more vulnerable to being harmed by errors and by financial abuse than adults who are not so affected.' },
        outcome: 'met',
      },
      screening: {
        outcome: 'proceed-to-inquiry',
        rationale: 'Three-point test met for the residents as a group. Regulated service, health input needed, a criminal element in the financial allegation. Inquiry to run as a potential Large Scale Investigation.',
        at: at('2026-07-30', '15:30'),
        byName: name(moira),
      },
      inquiry: {
        openedAt: at('2026-07-31', '09:00'),
        interAgencyDiscussionMeetingId: ROWANBANK.planningMeeting,
        agenciesContacted: ['regulator', 'health', 'police', 'third-sector'],
        outcome: 'proceed-to-investigation',
        rationale: 'Inspection findings confirmed by the practice pharmacist\'s audit; harm to at least three residents; a financial allegation that needs police investigation. An investigation with a strand per resident is proportionate.',
        decidedAt: at('2026-08-06', '12:00'),
      },
      investigation: {
        councilOfficerUserId: moira,
        secondWorkerUserId: stuart,
        visits: [
          { at: at('2026-08-07', '10:00'), power: 's7', byNames: [name(moira), name(stuart)], note: 'Visit to the home with the Care Inspectorate. Medication room, MAR charts and the personal allowance ledger examined. Each resident seen briefly and told about the investigation.' },
          { at: at('2026-08-12', '10:00'), power: 's7', byNames: [name(moira), name(stuart), name(tam)], note: 'Second visit for private interviews. Interpreter for Zofia Wisniewska by telephone. Advocate present for Archie Drummond.' },
        ],
        interviews: [
          { at: at('2026-08-12', '10:30'), power: 's8', withPersonId: wilma.id, note: 'Interviewed in private with her daughter\'s knowledge. Says she has "never been told what is in the account" and would like her daughter to see the statements.' },
          { at: at('2026-08-12', '11:15'), power: 's8', withPersonId: margaret.id, note: 'Interviewed in private. Describes evenings when her tablets came "long after tea" and feeling stiff and unsteady the next morning. Wants to stay at Rowanbank.' },
          { at: at('2026-08-12', '12:00'), power: 's8', withPersonId: zofia.id, note: 'Interviewed with a Polish interpreter. Remembers being given her tablets twice on one evening and the bruising afterwards. Wants her son in Poland told.' },
          { at: at('2026-08-12', '14:00'), power: 's8', withPersonId: malcolm.id, note: 'Declined to be interviewed: "I do not want any fuss". Has capacity. Agreed to the records check and to the GP review. Undue pressure considered and not found.', adultDeclined: true },
        ],
        recordsRequests: [
          { requestedAt: at('2026-08-07', '11:00'), power: 's10', holder: 'Rowanbank Care Home', holderAgency: 'third-sector', status: 'received', note: 'MAR charts April to July, staff rota, incident log and the personal allowance ledger. Received 7 Aug.' },
          { requestedAt: at('2026-08-07', '11:30'), power: 's10', holder: 'Braeside Health Centre', holderAgency: 'health', status: 'received', note: 'GP records for all six residents. Inspected by Dr Amira Farouk as the health professional, s10(4). Received 11 Aug.' },
        ],
        consent: {
          status: 'sought-and-given',
          note: 'Recorded per resident. Wilma Sneddon and Margaret Cairns: consent to interview and records given. Zofia Wisniewska: consent given through a Polish interpreter. Malcolm Rankin: declined interview; consent to records and GP review given. Jean Kilgour: lacks capacity for this decision; her attorney Robert Kilgour consulted and agreed. Archie Drummond: lacks capacity for this decision; no attorney or guardian; proceeding under the s4 duty with an independent advocate.',
        },
        capacity: {
          assessed: true,
          summary: 'Four residents have capacity to decide whether to take part. Two lack capacity for this decision: Jean Kilgour (Alzheimer\'s dementia, assessed by Dr Farouk 11 Aug) and Archie Drummond (vascular dementia, assessed by Dr Farouk 11 Aug). Neither assessment is for any other decision.',
          fluctuates: false,
        },
        unduePressure: { considered: true, found: false, reasoning: 'Malcolm Rankin\'s refusal to be interviewed was considered under s35. He gave his reason freely, has no relationship with the staff member concerned beyond daily care, and agreed to the records check. No undue pressure found.' },
        advocacy: { offered: true, accepted: true, provider: 'Clydeshore Advocacy', advocateName: name(tam) },
      },
      ordersConsidered: [
        { order: 'assessment-order-s11', considered: true, decision: 'not-required', rationale: 'Residents can be seen and interviewed at the home with the provider\'s cooperation.' },
        { order: 'removal-order-s14', considered: true, decision: 'not-required', rationale: 'Immediate safety measures (two nurses on the evening round, the agency nurse not working) are in place; no resident needs to be moved.' },
        { order: 'banning-order-s19', considered: true, decision: 'not-required', rationale: 'The staff member subject to the financial allegation is suspended by the provider and is not attending the home.' },
      ],
      lsi: {
        setting: 'Rowanbank Care Home',
        provider: 'Rowanbank Care (Scotland) Ltd',
        strands: [
          { subjectId: wilma.id, concern: 'Money missing from her personal allowance account: withdrawals in June and July that she and her daughter cannot account for.', status: 'open', leadUserId: stuart },
          { subjectId: jean.id, concern: 'Donepezil omitted on six consecutive evenings in July; attorney not informed. Capacity lacking; attorney consulted.', status: 'reviewed', leadUserId: moira },
          { subjectId: malcolm.id, concern: 'Evening insulin omitted on three of seven nights; GP called for high blood glucose and ketones on 23 Jul.', status: 'open', leadUserId: stuart },
          { subjectId: zofia.id, concern: 'Warfarin given twice on 18 Jul; emergency department attendance on 19 Jul with a high INR and bruising.', status: 'open', leadUserId: moira },
          { subjectId: margaret.id, concern: 'Time-critical Parkinson\'s medication given over two hours late on four evenings; fall on 26 Jul.', status: 'reviewed', leadUserId: moira },
          { subjectId: archie.id, concern: 'Oral nutritional supplement omitted on nine days in July; weight loss of 4.1 kg over three months. Capacity lacking; advocate involved.', status: 'open', leadUserId: stuart },
        ],
        agenciesInvolved: ['regulator', 'social-work', 'health', 'police', 'third-sector'],
        careInspectorateNotified: true,
        commissioningInvolved: true,
      },
    },
  };
  ctx.data.processes.push(process);

  // ----- Views -----
  makeViews(ctx, { id: 'vw_rowanbank_archie', personId: archie.id, processId: process.id, kind: 'adult-views', recordedAt: at('2026-08-12', '13:00'), recordedByUserId: tam, recordedByName: name(tam), recordedByAgency: 'third-sector', method: 'Independent advocate, two visits, picture cards and short questions', content: 'Archie likes his room and the garden. He says the food is "fine" but that he is "not always hungry at night". He does not want to move. He became upset when asked about a member of staff by name and the advocate stopped that line of questions.', sharingPreference: 'To be read at the review meeting by the advocate.' });
  makeViews(ctx, { id: 'vw_rowanbank_zofia', personId: zofia.id, processId: process.id, kind: 'adult-views', recordedAt: at('2026-08-12', '12:00'), recordedByUserId: moira, recordedByName: name(moira), recordedByAgency: 'social-work', method: 'Section 8 interview with a Polish interpreter (telephone interpreting service)', content: '"They gave me the tablets in the morning and again at night. I said I had taken them. The nurse did not understand me." Zofia wants her son in Poland to be told what happened and wants a written note in Polish of her medicines. She wants to stay at Rowanbank if the evening staff change.', sharingPreference: 'Content to be shared with the review meeting; wants her son informed by the council officer.' });
  makeViews(ctx, { id: 'vw_rowanbank_linda', personId: linda.id, processId: process.id, kind: 'carer-views', recordedAt: at('2026-08-05', '15:30'), recordedByUserId: stuart, recordedByName: name(stuart), recordedByAgency: 'social-work', method: 'Telephone call, then meeting at Portnellan Resource Centre', content: 'Linda checks her mother\'s personal allowance ledger every month. In June and July there are five cash withdrawals of between 40 and 80 pounds that her mother did not ask for and cannot remember. The same initials sign each entry. "I am not accusing anyone, but I want it looked at properly." She wants the police involved and her mother kept at Rowanbank meanwhile.' });

  // ----- Actions -----
  makeAction(ctx, { id: 'act_rowanbank_1', processId: process.id, meetingId: ROWANBANK.planningMeeting, title: 'Extend the MAR chart audit back to April for all six residents', ownerUserId: amira, ownerName: `Dr ${name(amira)}`, ownerAgency: 'health', due: '2026-08-21', status: 'complete', completedAt: at('2026-08-13', '17:00'), evidence: 'Practice pharmacist audit April to July: 41 errors, 33 on the 20:00 round. Report to the LSI 13 Aug.', createdAt: at('2026-08-06', '12:00'), createdByName: name(moira) });
  makeAction(ctx, { id: 'act_rowanbank_2', processId: process.id, meetingId: ROWANBANK.planningMeeting, title: 'Pharmacy-led medication review for each resident, starting with Zofia Wisniewska and Malcolm Rankin', ownerUserId: amira, ownerName: `Dr ${name(amira)}`, ownerAgency: 'health', due: '2026-09-05', status: 'in-progress', evidence: 'Four of six reviews done; two recorded on EMIS Web and waiting in the connector inbox.', createdAt: at('2026-08-06', '12:00'), createdByName: name(moira) });
  makeAction(ctx, { id: 'act_rowanbank_3', processId: process.id, meetingId: ROWANBANK.planningMeeting, title: 'Take a statement from Linda Paterson and obtain the bank statements and the personal allowance ledger', ownerUserId: paul, ownerName: `DS ${name(paul)}`, ownerAgency: 'police', due: '2026-08-20', status: 'complete', completedAt: at('2026-08-14', '16:00'), evidence: 'Statement taken 14 Aug. Ledger and statements obtained from the provider 20 Aug. Staff member interviewed under caution 27 Aug.', createdAt: at('2026-08-06', '12:00'), createdByName: name(moira) });
  makeAction(ctx, { id: 'act_rowanbank_4', processId: process.id, meetingId: ROWANBANK.planningMeeting, title: 'OPG register check for all six residents; confirm the attorney for Jean Kilgour and consult him', ownerUserId: alistair, ownerName: name(alistair), ownerAgency: 'regulator', due: '2026-08-20', status: 'complete', completedAt: at('2026-08-13', '11:00'), evidence: 'One combined power of attorney found (Jean Kilgour, attorney Robert Kilgour). No guardianship orders. Attorney consulted 11 Aug.', createdAt: at('2026-08-06', '12:00'), createdByName: name(moira) });
  makeAction(ctx, { id: 'act_rowanbank_5', processId: process.id, meetingId: ROWANBANK.planningMeeting, title: 'Commissioning contract meeting with the provider; confirm the pause on new placements in writing', detail: 'Meeting with Rowanbank Care (Scotland) Ltd to record the pause on placements, the staffing undertakings and the reporting expected before the review.', ownerName: `${COMMISSIONING_LEAD} (contracts and commissioning, Clydeshore HSCP)`, ownerAgency: 'social-work', due: '2026-08-28', status: 'open', createdAt: at('2026-08-06', '12:00'), createdByName: name(moira) });
  makeAction(ctx, { id: 'act_rowanbank_6', processId: process.id, meetingId: ROWANBANK.planningMeeting, title: 'Provider to submit a medication management action plan', ownerName: `${HOME_MANAGER} (home manager)`, ownerAgency: 'third-sector', due: '2026-08-20', status: 'complete', completedAt: at('2026-08-19', '15:00'), evidence: 'Action plan received 19 Aug: two nurses on every evening round, electronic MAR from October, competency checks for agency staff.', createdAt: at('2026-08-06', '12:00'), createdByName: name(moira) });
  makeAction(ctx, { id: 'act_rowanbank_7', processId: process.id, meetingId: ROWANBANK.planningMeeting, title: 'Advocacy for the residents who lack capacity and for any resident who wants it', ownerUserId: tam, ownerName: name(tam), ownerAgency: 'third-sector', due: '2026-08-14', status: 'complete', completedAt: at('2026-08-12', '13:00'), evidence: 'Archie Drummond seen twice; views recorded. Offered to all six; Wilma Sneddon and Zofia Wisniewska accepted for the review meeting.', createdAt: at('2026-08-06', '12:00'), createdByName: name(moira) });
  makeAction(ctx, { id: 'act_rowanbank_8', processId: process.id, meetingId: ROWANBANK.planningMeeting, title: 'Care Inspectorate to share the inspection findings and any improvement notice with the LSI', ownerUserId: morven, ownerName: name(morven), ownerAgency: 'regulator', due: '2026-09-04', status: 'in-progress', evidence: 'Draft findings shared 21 Aug; improvement notice under consideration.', createdAt: at('2026-08-06', '12:00'), createdByName: name(moira) });
  makeAction(ctx, { id: 'act_rowanbank_9', processId: process.id, meetingId: ROWANBANK.reviewMeeting, title: 'Council officer\'s report with the joint chronology and a summary per strand for the 10 Sep review', ownerUserId: moira, ownerName: name(moira), ownerAgency: 'social-work', due: '2026-09-08', status: 'in-progress', createdAt: at('2026-08-19', '09:00'), createdByName: name(moira) });
  const planningActionIds = ['act_rowanbank_1', 'act_rowanbank_2', 'act_rowanbank_3', 'act_rowanbank_4', 'act_rowanbank_5', 'act_rowanbank_6', 'act_rowanbank_7', 'act_rowanbank_8'];

  // ----- Meetings -----
  const invitees = (held: boolean): Invitee[] => {
    const a = (present: Invitee['attendance'] = 'present'): Invitee['attendance'] => (held ? present : 'accepted');
    return [
      { userId: moira, name: name(moira), agency: 'social-work', role: 'Council officer (chair)', required: true, attendance: a(), reason: 'Leads the investigation', needToKnowRowId: 'asp.investigation.co' },
      { userId: stuart, name: name(stuart), agency: 'social-work', role: 'Second worker', required: true, attendance: a(), reason: 'Second worker; strand lead', needToKnowRowId: 'asp.investigation.co' },
      { userId: minutes, name: name(minutes), agency: 'social-work', role: 'Minute taker', required: true, attendance: a(), reason: 'Minutes and distribution', needToKnowRowId: 'asp.conference.minutes' },
      { userId: morven, name: name(morven), agency: 'regulator', role: 'Inspector, Care Inspectorate', required: true, attendance: a(), reason: 'Regulated service; raised the concern', needToKnowRowId: 'asp.conference.ci' },
      { userId: amira, name: `Dr ${name(amira)}`, agency: 'health', role: 'GP', required: true, attendance: held ? 'remote' : 'accepted', reason: 'Health input; medication review', needToKnowRowId: 'asp.inquiry.gp' },
      { userId: paul, name: `DS ${name(paul)}`, agency: 'police', role: 'Detective sergeant, PPU', required: true, attendance: a(), reason: 'Criminal element: financial allegation', needToKnowRowId: 'asp.inquiry.police' },
      { userId: tam, name: name(tam), agency: 'third-sector', role: 'Independent advocate', required: false, attendance: a(), reason: 'Advocacy for residents', needToKnowRowId: 'asp.investigation.advocacy' },
      { userId: alistair, name: name(alistair), agency: 'regulator', role: 'OPG investigations officer', required: false, attendance: held ? 'remote' : 'invited', reason: 'Financial harm; a resident has an attorney', needToKnowRowId: 'asp.investigation.opg' },
      { userId: andrew, name: name(andrew), agency: 'social-work', role: 'Chief Social Work Officer', required: false, attendance: held ? 'apologies' : 'invited', reason: 'Oversight of the LSI' },
      { name: `${COMMISSIONING_LEAD}`, agency: 'social-work', role: 'Contracts and commissioning manager, Clydeshore HSCP', required: true, attendance: a(), reason: 'Commissioning of the service' },
      { name: HOME_MANAGER, agency: 'third-sector', role: 'Home manager, Rowanbank Care Home', required: true, attendance: held ? 'present' : 'invited', reason: 'Provider: decisions and actions affecting the service only' },
      { name: PROVIDER_REP, agency: 'third-sector', role: 'Operations director, Rowanbank Care (Scotland) Ltd', required: false, attendance: held ? 'present' : 'invited', reason: 'Provider representative' },
    ];
  };

  makeMeeting(ctx, {
    id: ROWANBANK.planningMeeting,
    type: 'lsi-planning',
    processId: process.id,
    subjectIds: all,
    title: 'LSI planning meeting: Rowanbank Care Home',
    scheduledAt: at('2026-08-06', '10:00'),
    endsAt: at('2026-08-06', '12:00'),
    location: 'Portnellan Resource Centre, room 1',
    status: 'held',
    chairUserId: moira,
    chairName: name(moira),
    minuteTakerUserId: minutes,
    minuteTakerName: name(minutes),
    invitees: invitees(true),
    agenda: [
      { id: 'ag_rb_plan_1', order: 1, title: 'Purpose, confidentiality and who hears what', status: 'done' },
      { id: 'ag_rb_plan_2', order: 2, title: 'Care Inspectorate findings and the practice pharmacist\'s audit', status: 'done' },
      { id: 'ag_rb_plan_3', order: 3, title: 'The financial allegation', status: 'done' },
      { id: 'ag_rb_plan_4', order: 4, title: 'Inquiry outcome: proceed as a Large Scale Investigation?', status: 'done' },
      { id: 'ag_rb_plan_5', order: 5, title: 'Strands, leads, consent, capacity and advocacy', status: 'done' },
      { id: 'ag_rb_plan_6', order: 6, title: 'Regulator, police, OPG and commissioning roles', status: 'done' },
      { id: 'ag_rb_plan_7', order: 7, title: 'Actions and review date', status: 'done' },
    ],
    pack: [
      { id: 'pk_rb_plan_1', kind: 'report', label: 'Care Inspectorate inspection feedback, 29 Jul', ref: 'CI-ASP-2026-0771', included: true },
      { id: 'pk_rb_plan_2', kind: 'report', label: 'Practice pharmacist MAR chart audit, July', included: true },
      { id: 'pk_rb_plan_3', kind: 'views', label: 'Linda Paterson (carer) views, 5 Aug', ref: 'vw_rowanbank_linda', included: true },
      { id: 'pk_rb_plan_4', kind: 'chronology', label: 'Joint chronology, 1 Jul to 5 Aug', windowFrom: '2026-07-01', windowTo: '2026-08-05', included: true },
    ],
    informationShared: [
      { id: 'is_rb_plan_1', agency: 'regulator', byName: name(morven), byUserId: morven, at: at('2026-08-06', '10:15'), summary: 'Unannounced inspection 28 and 29 Jul. Seventeen medication errors on the July MAR charts, fourteen on the 20:00 round. Agency nurse on most of the shifts concerned. Provider cooperative.', relevance: 'Source of concern; regulated service', linkedEventIds: [] },
      { id: 'is_rb_plan_2', agency: 'health', byName: `Dr ${name(amira)}`, byUserId: amira, at: at('2026-08-06', '10:35'), summary: 'Practice pharmacist audit confirms the inspection count. Three residents came to harm: emergency department attendance, high blood glucose with ketones, a fall.', relevance: 'Harm and health input', linkedEventIds: [] },
      { id: 'is_rb_plan_3', agency: 'social-work', byName: name(stuart), byUserId: stuart, at: at('2026-08-06', '10:50'), summary: 'Relative reports five unexplained cash withdrawals from Wilma Sneddon\'s personal allowance in June and July, each signed with the same initials.', relevance: 'Financial harm; criminal element', linkedEventIds: [] },
      { id: 'is_rb_plan_4', agency: 'police', byName: `DS ${name(paul)}`, byUserId: paul, at: at('2026-08-06', '11:00'), summary: 'No police history for the home. Allegation meets the threshold for investigation. Statement from the relative and the ledger needed.', relevance: 'Criminal investigation', linkedEventIds: [] },
      { id: 'is_rb_plan_5', agency: 'regulator', byName: name(alistair), byUserId: alistair, at: at('2026-08-06', '11:05'), summary: 'OPG will check the register for all six residents. One attorney known from the home\'s records.', relevance: 'Attorney conduct and register checks', linkedEventIds: [] },
    ],
    decisions: [
      { id: 'dec_rb_plan_1', question: 'Proceed as a Large Scale Investigation?', decision: 'Yes. Investigation opened 7 Aug as an LSI under the Code of Practice 2022.', rationale: 'Concerns about how the service is run affect all six residents; at least three have come to harm; one process with a strand per resident is proportionate.', dissent: [], decidedByName: name(moira), decidedByUserId: moira, decidedAt: at('2026-08-06', '11:15') },
      { id: 'dec_rb_plan_2', question: 'Structure of the investigation', decision: 'One strand per resident with a named lead (Moira Gilmour or Stuart Blair), consent and capacity recorded per resident, advocacy offered to all, a joint chronology across the setting.', rationale: 'Each resident is an adult at risk in their own right; the pattern is in the setting.', dissent: [], decidedByName: name(moira), decidedByUserId: moira, decidedAt: at('2026-08-06', '11:20') },
      { id: 'dec_rb_plan_3', question: 'Care Inspectorate', decision: 'Parallel inspection activity continues; findings and any improvement notice shared with the LSI.', rationale: 'Duty to cooperate under s5; the regulator\'s powers sit alongside the council\'s.', dissent: [], decidedByName: name(moira), decidedByUserId: moira, decidedAt: at('2026-08-06', '11:25') },
      { id: 'dec_rb_plan_4', question: 'The financial allegation', decision: 'Police to investigate. OPG to check the register for each resident. The home\'s personal allowance procedure to be reviewed by commissioning.', rationale: 'Criminal element; a resident with an attorney; provider procedure in question.', dissent: [], decidedByName: name(moira), decidedByUserId: moira, decidedAt: at('2026-08-06', '11:30') },
      { id: 'dec_rb_plan_5', question: 'Commissioning', decision: 'Pause new placements at Rowanbank until the review meeting. Contract meeting with the provider by 28 Aug.', rationale: 'Precautionary while evening medication administration is unsafe; existing residents stay with the immediate safety measures in place.', dissent: [{ byName: PROVIDER_REP, agency: 'third-sector', text: 'The provider does not accept that a pause on placements is proportionate when the agency nurse concerned no longer works at the home and two nurses now cover every evening round. Asked that the pause be reviewed after four weeks rather than at the review meeting.' }], decidedByName: name(moira), decidedByUserId: moira, decidedAt: at('2026-08-06', '11:40') },
      { id: 'dec_rb_plan_6', question: 'Review date', decision: 'Review of all strands on 10 Sep 2026.', rationale: 'Five weeks allows the audit, the medication reviews, the police statement and the OPG checks to complete.', dissent: [], decidedByName: name(moira), decidedByUserId: moira, decidedAt: at('2026-08-06', '11:50') },
    ],
    actionIds: planningActionIds,
    viewsRecordIds: ['vw_rowanbank_linda'],
    minute: { status: 'distributed', draftedAt: at('2026-08-07', '15:00'), approvedAt: at('2026-08-10', '09:30'), distributedAt: at('2026-08-10', '10:00') },
    distribution: [
      { id: 'dist_rb_plan_1', recipientName: name(morven), recipientUserId: morven, agency: 'regulator', role: 'Inspector, Care Inspectorate', detailLevel: 'full', reason: 'Attendee; regulated service', sharingRecordId: 'shr_rowanbank_1' },
      { id: 'dist_rb_plan_2', recipientName: `Dr ${name(amira)}`, recipientUserId: amira, agency: 'health', role: 'GP', detailLevel: 'full', reason: 'Attendee; health input', sharingRecordId: 'shr_rowanbank_2' },
      { id: 'dist_rb_plan_3', recipientName: `DS ${name(paul)}`, recipientUserId: paul, agency: 'police', role: 'Detective sergeant', detailLevel: 'fields', fields: ['financial allegation', 'account and ledger details', 'relative contact', 'actions for police'], reason: 'Criminal element: the financial strand only', sharingRecordId: 'shr_rowanbank_3' },
      { id: 'dist_rb_plan_4', recipientName: name(alistair), recipientUserId: alistair, agency: 'regulator', role: 'OPG investigations officer', detailLevel: 'fields', fields: ['adult name and date of birth', 'nature of financial concern', 'whether a power of attorney or guardianship exists'], reason: 'Financial harm; attorney in place', sharingRecordId: 'shr_rowanbank_4' },
      { id: 'dist_rb_plan_5', recipientName: name(tam), recipientUserId: tam, agency: 'third-sector', role: 'Independent advocate', detailLevel: 'summary', reason: 'Advocacy offered', sharingRecordId: 'shr_rowanbank_5' },
      { id: 'dist_rb_plan_6', recipientName: name(andrew), recipientUserId: andrew, agency: 'social-work', role: 'Chief Social Work Officer', detailLevel: 'summary', reason: 'Oversight', sharingRecordId: 'shr_rowanbank_6' },
      { id: 'dist_rb_plan_7', recipientName: HOME_MANAGER, agency: 'third-sector', role: 'Home manager', detailLevel: 'fields', fields: ['decisions affecting the service', 'actions for the provider', 'review date'], reason: 'Provider under investigation: decisions and actions only, no resident-level detail' },
    ],
    reviewDate: '2026-09-10',
    subjectAttendance: 'Residents did not attend the planning meeting. Tam Guthrie attended as advocate for Archie Drummond and for any resident who wants advocacy at the review. Linda Paterson\'s views were read into the record.',
  });

  makeMeeting(ctx, {
    id: ROWANBANK.reviewMeeting,
    type: 'lsi-planning',
    processId: process.id,
    subjectIds: all,
    title: 'LSI review of strands: Rowanbank Care Home',
    scheduledAt: at('2026-09-10', '10:00'),
    endsAt: at('2026-09-10', '12:30'),
    location: 'Portnellan Resource Centre, room 1',
    status: 'scheduled',
    chairUserId: moira,
    chairName: name(moira),
    minuteTakerUserId: minutes,
    minuteTakerName: name(minutes),
    invitees: invitees(false),
    agenda: [
      { id: 'ag_rb_rev_1', order: 1, title: 'Purpose, confidentiality and who hears what', status: 'pending' },
      { id: 'ag_rb_rev_2', order: 2, title: 'Residents\' views (advocate, interpreter)', status: 'pending' },
      { id: 'ag_rb_rev_3', order: 3, title: 'Strand by strand: findings, harm, current safety', status: 'pending' },
      { id: 'ag_rb_rev_4', order: 4, title: 'Medication review outcomes and the extended audit', status: 'pending' },
      { id: 'ag_rb_rev_5', order: 5, title: 'Police and OPG update on the financial strand', status: 'pending' },
      { id: 'ag_rb_rev_6', order: 6, title: 'Care Inspectorate and commissioning: the pause on placements', status: 'pending' },
      { id: 'ag_rb_rev_7', order: 7, title: 'Protection plans per resident, closure of strands, next steps', status: 'pending' },
    ],
    preMeetingRequests: [
      { id: 'pmr_rb_rev_1', agency: 'health', toName: `Dr ${name(amira)}`, toUserId: amira, sentAt: at('2026-09-01', '09:00'), dueAt: '2026-09-08', status: 'sent' },
      { id: 'pmr_rb_rev_2', agency: 'police', toName: `DS ${name(paul)}`, toUserId: paul, sentAt: at('2026-09-01', '09:00'), dueAt: '2026-09-08', status: 'returned', returnSummary: 'Staff member interviewed under caution 27 Aug; report to the procurator fiscal being prepared', returnedAt: at('2026-09-01', '17:10') },
      { id: 'pmr_rb_rev_3', agency: 'regulator', toName: name(morven), toUserId: morven, sentAt: at('2026-09-01', '09:00'), dueAt: '2026-09-08', status: 'sent' },
      { id: 'pmr_rb_rev_4', agency: 'regulator', toName: name(alistair), toUserId: alistair, sentAt: at('2026-09-01', '09:00'), dueAt: '2026-09-08', status: 'returned', returnSummary: 'Register checks complete; no concern about the attorney\'s conduct', returnedAt: at('2026-09-02', '08:45') },
      { id: 'pmr_rb_rev_5', agency: 'social-work', toName: COMMISSIONING_LEAD, sentAt: at('2026-09-01', '09:00'), dueAt: '2026-09-08', status: 'sent' },
    ],
    pack: [
      { id: 'pk_rb_rev_1', kind: 'chronology', label: 'Joint chronology, 1 Jul to date', windowFrom: '2026-07-01', windowTo: '2026-09-09', included: true },
      { id: 'pk_rb_rev_2', kind: 'report', label: 'Council officer\'s report with a summary per strand', included: false },
      { id: 'pk_rb_rev_3', kind: 'report', label: 'Practice pharmacist audit, April to July', included: true },
      { id: 'pk_rb_rev_4', kind: 'views', label: 'Archie Drummond (via advocate)', ref: 'vw_rowanbank_archie', included: true },
      { id: 'pk_rb_rev_5', kind: 'views', label: 'Zofia Wisniewska (via interpreter)', ref: 'vw_rowanbank_zofia', included: true },
      { id: 'pk_rb_rev_6', kind: 'report', label: 'Provider medication management action plan', included: true },
    ],
    actionIds: [...planningActionIds, 'act_rowanbank_9'],
    viewsRecordIds: ['vw_rowanbank_archie', 'vw_rowanbank_zofia'],
    minute: { status: 'not-started' },
    subjectAttendance: 'Wilma Sneddon and Zofia Wisniewska have asked to attend for their own strands, with the advocate and a Polish interpreter booked. Archie Drummond will be represented by the advocate.',
  });

  // ----- Sharing records -----
  const share = (id: string, stage: Process['stage'], subjectId: string, to: string | undefined, toName: string, agency: Agency, role: string, level: 'full' | 'summary' | 'fields' | 'presence', reason: string, summary: string, createdAt: string, rowId?: string, fields?: string[], status: 'sent' | 'read' | 'withheld' = 'read') =>
    makeShare(ctx, { id, processId: process.id, subjectId, stage, recipient: { userId: to, name: toName, agency, role }, detailLevel: level, fields, lawfulBasisId: lb.id, channel: agency === 'regulator' ? 'secure-email-digest' : 'in-app', status, createdAt, sentAt: status === 'withheld' ? undefined : createdAt, readAt: status === 'read' ? createdAt : undefined, reason, needToKnowRowId: rowId, createdByUserId: moira, createdByName: name(moira), summary });
  share('shr_rowanbank_1', 'investigation', zofia.id, morven, name(morven), 'regulator', 'Inspector, Care Inspectorate', 'full', 'Regulated service: duty to cooperate under s5.', 'LSI planning minute, strands and actions; s7 visit and s10 records findings', at('2026-08-10', '10:00'), 'asp.conference.ci');
  share('shr_rowanbank_2', 'investigation', zofia.id, amira, `Dr ${name(amira)}`, 'health', 'GP', 'full', 'Health input needed. Records holder for the s10 request; a health professional inspects health records.', 'Medication error findings for all six residents; request to inspect GP records under s10 and lead the medication review', at('2026-08-07', '11:30'), 'asp.investigation.records');
  share('shr_rowanbank_3', 'investigation', wilma.id, paul, `DS ${name(paul)}`, 'police', 'Detective sergeant, PPU', 'fields', 'Criminal element: the financial strand only.', 'Allegation of five unexplained withdrawals from the personal allowance account; relative contact; ledger held by the provider', at('2026-08-06', '13:00'), 'asp.inquiry.police', ['financial allegation', 'account and ledger details', 'relative contact', 'actions for police']);
  share('shr_rowanbank_4', 'investigation', jean.id, alistair, name(alistair), 'regulator', 'OPG investigations officer', 'fields', 'Financial harm identified. A resident has a registered attorney.', 'Jean Kilgour, born 12 Mar 1938: register check requested; concern is about the service\'s personal allowance handling, not the attorney', at('2026-08-06', '13:10'), 'asp.investigation.opg', ['adult name and date of birth', 'nature of financial concern', 'whether a power of attorney or guardianship exists']);
  share('shr_rowanbank_5', 'investigation', archie.id, tam, name(tam), 'third-sector', 'Independent advocate', 'summary', 'Advocacy offered and accepted.', 'Archie Drummond lacks capacity for this decision; advocacy to support his views for the investigation and the review meeting', at('2026-08-07', '09:30'), 'asp.investigation.advocacy');
  share('shr_rowanbank_6', 'inquiry', jean.id, andrew, name(andrew), 'social-work', 'Chief Social Work Officer', 'summary', 'Large Scale Investigation opened: CSWO oversight.', 'LSI at Rowanbank Care Home: six residents, medication errors and a financial allegation; planning meeting 6 Aug', at('2026-07-31', '12:00'));
  share('shr_rowanbank_7', 'investigation', margaret.id, undefined, `${HOME_MANAGER} (home manager)`, 'third-sector', 'Home manager, Rowanbank Care Home', 'full', 'Provider asked for the interview records. Withheld: the provider is the subject of the investigation and receives decisions and actions only.', 'Request for s8 interview notes for Margaret Cairns withheld; provider sent the decisions and actions affecting the service', at('2026-08-14', '11:00'), 'asp.inquiry.provider', undefined, 'withheld');

  // ----- Joint chronology: setting-level and per-resident events -----
  const E = (e: Omit<Parameters<typeof makeEvent>[1], 'linkedProcessIds'>) =>
    makeEvent(ctx, { linkedProcessIds: [process.id], visibility: 'integrated', lawfulBasisId: lb.id, ...e });

  // Earlier history that matters.
  E({ occurredAt: at('2021-05-17', '00:00'), hasTime: false, recordedAt: at('2026-08-13', '11:00'), subjectIds: [jean.id], agency: 'regulator', recordedByName: name(alistair), recordedByUserId: alistair, eventType: 'legal.poa-registered', title: 'Combined welfare and financial power of attorney registered with OPG', detail: 'Attorney: Robert Kilgour (son). Registered 17 May 2021. Confirmed by OPG register check on 13 Aug 2026.', significance: 'moderate', linkedPersonIds: [robert.id] });

  // July: the errors, as they happened.
  E({ occurredAt: at('2026-07-06', '20:00'), approximate: true, subjectIds: [jean.id], agency: 'health', recordedByName: `Dr ${name(amira)}`, recordedByUserId: amira, eventType: 'care.provider-concern', title: 'Donepezil omitted on six consecutive evenings, 6 to 11 Jul', detail: 'MAR chart shows no signature and no reason code for the 20:00 dose on six evenings. Found by the practice pharmacist audit on 3 Aug. Attorney not informed by the home.', significance: 'high', significanceReason: 'Omitted doses; attorney not informed' });
  E({ occurredAt: at('2026-07-15', '00:00'), hasTime: false, subjectIds: [archie.id], agency: 'health', sourceSystem: 'emis-web', recordedByName: 'EMIS Web connector', eventType: 'health.assessment', title: 'Weight loss noted: 67.2 kg, down 4.1 kg in three months', detail: 'Care home round. Weight down 4.1 kg since April. Oral nutritional supplement continued; dietitian referral made.', significance: 'high', significanceReason: 'Unexplained weight loss' });
  E({ occurredAt: at('2026-07-18', '20:10'), subjectIds: [zofia.id], agency: 'health', recordedByName: `Dr ${name(amira)}`, recordedByUserId: amira, eventType: 'care.provider-concern', title: 'Warfarin given at 08:00 and again at 20:10 on 18 Jul', detail: 'MAR chart signed twice for the same day. The evening nurse recorded "resident unsure whether taken". Zofia told the interviewer she said she had taken it. Found at inspection on 29 Jul.', significance: 'high', significanceReason: 'Double dose of an anticoagulant' });
  E({ occurredAt: at('2026-07-19', '11:40'), subjectIds: [zofia.id], agency: 'health', sourceSystem: 'trakcare', recordedByName: 'TrakCare connector', eventType: 'health.attendance', title: 'Emergency department: INR 5.8, bruising to both forearms', detail: 'Brought by ambulance from Rowanbank after extensive bruising was noticed at breakfast. INR 5.8. Vitamin K given. Observed and returned to the home the same evening with a revised warfarin plan.', significance: 'high', significanceReason: 'Harm from a medication error' });
  E({ occurredAt: at('2026-07-22', '20:00'), approximate: true, subjectIds: [malcolm.id], agency: 'health', recordedByName: `Dr ${name(amira)}`, recordedByUserId: amira, eventType: 'care.provider-concern', title: 'Evening insulin omitted on three of seven nights, 16 to 22 Jul', detail: 'MAR chart shows no administration on 16, 19 and 22 Jul; no reason code. Found by the practice pharmacist audit.', significance: 'high', significanceReason: 'Time-critical medication omitted' });
  E({ occurredAt: at('2026-07-23', '09:30'), subjectIds: [malcolm.id], agency: 'health', sourceSystem: 'emis-web', recordedByName: 'EMIS Web connector', eventType: 'health.consultation', title: 'GP visit: blood glucose 24, ketones present', detail: 'Home requested an urgent visit. Drowsy, thirsty, blood glucose 24 mmol/L, ketones moderate. Treated at the home with a corrective dose and observation. Not admitted.', significance: 'high', significanceReason: 'Harm from a medication error' });
  E({ occurredAt: at('2026-07-25', '22:15'), approximate: true, subjectIds: [margaret.id], agency: 'health', recordedByName: `Dr ${name(amira)}`, recordedByUserId: amira, eventType: 'care.provider-concern', title: 'Parkinson\'s medication given over two hours late on four evenings, 20 to 25 Jul', detail: 'The 20:00 dose was signed between 22:00 and 22:30 on 20, 22, 24 and 25 Jul. Time-critical medication. Found at inspection.', significance: 'high', significanceReason: 'Time-critical medication late' });
  E({ occurredAt: at('2026-07-26', '07:50'), subjectIds: [margaret.id], agency: 'third-sector', recordedByName: `${HOME_MANAGER} (home manager)`, eventType: 'care.provider-concern', title: 'Fall in her room before breakfast; no injury', detail: 'Found on the floor by a carer at 07:50. Stiff and unsteady. Checked by the GP the next day. Recorded in the home\'s incident log; not reported to the Care Inspectorate at the time.', significance: 'moderate' });
  E({ occurredAt: at('2026-07-27', '14:00'), subjectIds: [margaret.id], agency: 'health', sourceSystem: 'emis-web', recordedByName: 'EMIS Web connector', eventType: 'health.consultation', title: 'GP review after the fall: increased rigidity; medication timing queried', detail: 'No injury. Marked rigidity and bradykinesia compared with June. GP asked the home to confirm the administration times.', significance: 'moderate' });

  // The inspection and the concern.
  E({ occurredAt: at('2026-07-28', '07:30'), subjectIds: all, agency: 'regulator', recordedByName: name(morven), recordedByUserId: morven, eventType: 'care.provider-concern', title: 'Care Inspectorate unannounced inspection, day 1', detail: 'Two inspectors arrived at 07:30. Medication room, MAR charts, staffing rota and care plans examined. Residents and relatives spoken to.', significance: 'moderate' });
  E({ occurredAt: at('2026-07-29', '16:30'), subjectIds: all, agency: 'regulator', recordedByName: name(morven), recordedByUserId: morven, eventType: 'care.provider-concern', title: 'Inspection day 2: medication administration errors identified across the July MAR charts', detail: 'Seventeen errors affecting five residents: omitted doses, a double dose of warfarin, time-critical medication late. Fourteen on the 20:00 round. One agency nurse on most of the shifts concerned. Feedback given to the manager. Adult concern to the council to follow.', significance: 'high', significanceReason: 'Pattern of harm in a regulated service' });
  E({ occurredAt: at('2026-07-30', '11:20'), subjectIds: all, agency: 'social-work', recordedByName: name(moira), recordedByUserId: moira, eventType: 'social-work.referral', title: 'Adult concern from the Care Inspectorate: medication errors affecting several residents', detail: 'Received by the Adult Protection Team. Immediate safety agreed with the provider the same day: two nurses on every evening round; the agency nurse not to work at Rowanbank.', significance: 'high', significanceReason: 'Concern received' });
  E({ occurredAt: at('2026-07-30', '15:00'), subjectIds: all, agency: 'social-work', recordedByName: name(moira), recordedByUserId: moira, eventType: 'social-work.assessment', title: 'Three-point test applied at setting level: met', detail: 'All three limbs met for the residents as a group, with reasoning recorded per limb. Screening outcome: proceed to inquiry as a potential Large Scale Investigation.', significance: 'moderate' });
  E({ occurredAt: at('2026-07-31', '09:00'), subjectIds: all, agency: 'social-work', recordedByName: name(moira), recordedByUserId: moira, eventType: 'social-work.allocation', title: 'Inquiry opened under s4; council officer and second worker allocated', detail: 'Moira Gilmour (council officer) and Stuart Blair (second worker). Care Inspectorate, GP practice, police and Clydeshore Advocacy contacted.', significance: 'moderate' });
  E({ occurredAt: at('2026-07-31', '14:00'), subjectIds: [zofia.id, malcolm.id, margaret.id], agency: 'health', sourceSystem: 'emis-web', recordedByName: 'EMIS Web connector', eventType: 'health.consultation', title: 'GP review of the three residents most affected', detail: 'Dr Farouk saw Zofia Wisniewska, Malcolm Rankin and Margaret Cairns at the home. Warfarin plan confirmed; insulin regime unchanged; Parkinson\'s medication times restated to the home in writing.', significance: 'moderate' });
  E({ occurredAt: at('2026-08-03', '00:00'), hasTime: false, subjectIds: all, agency: 'health', recordedByName: `Dr ${name(amira)}`, recordedByUserId: amira, eventType: 'health.assessment', title: 'Practice pharmacist audit of the July MAR charts for all six residents', detail: 'Seventeen errors confirmed: fourteen omissions or wrong-time administrations on the 20:00 round, three elsewhere. Five of six residents affected. Nine evenings account for eleven of the errors; the same agency nurse was the only registered nurse on duty on each.', significance: 'high', significanceReason: 'Audit confirms the inspection finding' });
  E({ occurredAt: at('2026-08-04', '00:00'), hasTime: false, subjectIds: [archie.id], agency: 'health', recordedByName: `Dr ${name(amira)}`, recordedByUserId: amira, eventType: 'care.provider-concern', title: 'Oral nutritional supplement omitted on nine days in July', detail: 'MAR chart shows the twice-daily supplement not signed on nine days, mostly the evening dose. Found by the pharmacist audit.', significance: 'moderate' });
  E({ occurredAt: at('2026-08-05', '10:40'), subjectIds: [wilma.id], agency: 'social-work', recordedByName: name(stuart), recordedByUserId: stuart, eventType: 'social-work.referral', title: 'Allegation from a relative: money missing from the personal allowance account', detail: 'Linda Paterson (daughter) reported five cash withdrawals of between 40 and 80 pounds in June and July that her mother did not request. Each entry signed with the same initials. Financial harm strand opened; police informed the same day.', significance: 'high', significanceReason: 'Financial harm allegation; criminal element', linkedPersonIds: [linda.id] });
  E({ occurredAt: at('2026-08-06', '10:00'), subjectIds: all, agency: 'social-work', recordedByName: name(moira), recordedByUserId: moira, eventType: 'process.case-conference', title: 'LSI planning meeting held: proceed as a Large Scale Investigation, one strand per resident', detail: 'Care Inspectorate, GP, police, OPG, advocacy, commissioning and the provider present. Decisions: LSI, strands per resident, parallel inspection, police to investigate the financial allegation, pause on new placements (provider dissent recorded), review 10 Sep.', significance: 'high', significanceReason: 'Inquiry outcome and LSI structure' });
  E({ occurredAt: at('2026-08-06', '14:00'), subjectIds: all, agency: 'social-work', recordedByName: `${COMMISSIONING_LEAD} (contracts and commissioning)`, eventType: 'care.provider-concern', title: 'Commissioning paused new placements at Rowanbank', detail: 'Clydeshore HSCP commissioning wrote to the provider confirming no new council-funded placements until the LSI review on 10 Sep. Existing residents unaffected.', significance: 'moderate' });
  E({ occurredAt: at('2026-08-07', '10:00'), subjectIds: all, agency: 'social-work', recordedByName: name(moira), recordedByUserId: moira, eventType: 'social-work.visit', title: 'Section 7 visit: medication room, MAR charts and the personal allowance ledger examined', detail: 'Moira Gilmour and Stuart Blair with the Care Inspectorate. Records requested under s10 from the home (MAR charts April to July, rota, incident log, ledger) and from the GP practice. Each resident seen and told about the investigation.', significance: 'moderate' });
  E({ occurredAt: at('2026-08-11', '11:00'), subjectIds: [jean.id, archie.id], agency: 'health', recordedByName: `Dr ${name(amira)}`, recordedByUserId: amira, eventType: 'health.assessment', title: 'Capacity assessed for the decision to take part in the investigation: both lack capacity', detail: 'Jean Kilgour (Alzheimer\'s dementia) and Archie Drummond (vascular dementia) assessed at the home. Neither can retain or weigh the information about the investigation. Assessment limited to this decision.', significance: 'moderate' });
  E({ occurredAt: at('2026-08-11', '15:00'), subjectIds: [jean.id], agency: 'social-work', recordedByName: name(moira), recordedByUserId: moira, eventType: 'social-work.contact', title: 'Attorney consulted: Robert Kilgour agrees to the investigation and asks to be kept informed', detail: 'Telephone call. Robert Kilgour was not told about the omitted doses by the home. He agrees to the records check and to Jean staying at Rowanbank while the evening staffing undertakings hold.', significance: 'moderate', linkedPersonIds: [robert.id] });
  E({ occurredAt: at('2026-08-12', '10:00'), subjectIds: all, agency: 'social-work', recordedByName: name(moira), recordedByUserId: moira, eventType: 'social-work.visit', title: 'Section 7 visit: private interviews with residents', detail: 'Second visit with the advocate. Interviews under s8 with Wilma Sneddon, Margaret Cairns and Zofia Wisniewska (Polish interpreter). Malcolm Rankin declined. Jean Kilgour and Archie Drummond not interviewed (capacity).', significance: 'moderate' });
  E({ occurredAt: at('2026-08-12', '10:30'), subjectIds: [wilma.id], agency: 'social-work', recordedByName: name(stuart), recordedByUserId: stuart, eventType: 'voice.adult', title: 'Interviewed under s8: "never been told what is in the account"', detail: 'Wilma confirmed she did not ask for cash on the dates concerned. Wants her daughter to see the statements and to stay at Rowanbank.', significance: 'moderate' });
  E({ occurredAt: at('2026-08-12', '11:15'), subjectIds: [margaret.id], agency: 'social-work', recordedByName: name(moira), recordedByUserId: moira, eventType: 'voice.adult', title: 'Interviewed under s8: tablets came "long after tea"', detail: 'Describes stiffness and unsteadiness the mornings after late doses. Wants to stay at Rowanbank.', significance: 'moderate' });
  E({ occurredAt: at('2026-08-12', '12:00'), subjectIds: [zofia.id], agency: 'social-work', recordedByName: name(moira), recordedByUserId: moira, eventType: 'voice.adult', title: 'Interviewed under s8 with a Polish interpreter', detail: 'Remembers being given her tablets twice on one evening. Wants her son in Poland told and a note of her medicines in Polish.', significance: 'moderate' });
  E({ occurredAt: at('2026-08-12', '13:00'), subjectIds: [archie.id], agency: 'third-sector', recordedByName: name(tam), recordedByUserId: tam, eventType: 'voice.adult', title: 'Views gathered by the independent advocate over two visits', detail: 'Likes his room and the garden; "not always hungry at night"; does not want to move. Became upset when a staff member was named; questioning stopped.', significance: 'moderate' });
  E({ occurredAt: at('2026-08-12', '14:00'), subjectIds: [malcolm.id], agency: 'social-work', recordedByName: name(stuart), recordedByUserId: stuart, eventType: 'voice.adult', title: 'Declined a s8 interview: "I do not want any fuss"', detail: 'Has capacity. Agreed to the records check and the GP review. Undue pressure considered and not found.', significance: 'moderate' });
  E({ occurredAt: at('2026-08-14', '14:30'), subjectIds: [wilma.id], agency: 'police', recordedByName: `DS ${name(paul)}`, recordedByUserId: paul, eventType: 'police.incident', title: 'Statement taken from Linda Paterson', detail: 'Statement covers the ledger entries, the dates and amounts, and the initials on each. Bank statements provided by the family.', significance: 'moderate', linkedPersonIds: [linda.id] });
  E({ occurredAt: at('2026-08-19', '15:00'), subjectIds: all, agency: 'third-sector', recordedByName: `${HOME_MANAGER} (home manager)`, eventType: 'care.provider-concern', title: 'Provider medication management action plan received', detail: 'Two registered nurses on every evening round; electronic MAR charts from October; competency checks for all agency staff before a first shift; weekly manager audit.', significance: 'moderate' });

  // Agency-only events: seen by their own agency until promoted or shared.
  E({ occurredAt: at('2026-08-21', '00:00'), hasTime: false, subjectIds: all, agency: 'regulator', recordedByName: name(morven), recordedByUserId: morven, eventType: 'care.provider-concern', title: 'Improvement notice drafted', detail: 'Draft improvement notice on medication management under consideration by the Care Inspectorate. Not yet served.', significance: 'moderate', visibility: 'agency-only', lawfulBasisId: undefined });
  E({ occurredAt: at('2026-08-27', '10:00'), subjectIds: [wilma.id], agency: 'police', recordedByName: `DS ${name(paul)}`, recordedByUserId: paul, eventType: 'police.incident', title: 'Staff member interviewed under caution', detail: 'Interview at Ardvale Police Station. Report to the procurator fiscal being prepared. Not for the integrated chronology until charged.', significance: 'high', significanceReason: 'Criminal investigation', visibility: 'agency-only', lawfulBasisId: undefined });

  // ----- Analysis: the pattern, kept apart from the facts -----
  const errorEvents = ctx.data.events.filter((e) => e.linkedProcessIds.includes(process.id) && e.eventType === 'care.provider-concern' && e.agency === 'health').map((e) => e.id);
  const auditEvent = ctx.data.events.find((e) => e.linkedProcessIds.includes(process.id) && e.title.startsWith('Practice pharmacist audit'));
  makeAnalysis(ctx, {
    id: 'ana_rowanbank_1',
    subjectId: zofia.id,
    processId: process.id,
    eventIds: auditEvent ? [...errorEvents, auditEvent.id] : errorEvents,
    authorUserId: amira,
    authorName: `Dr ${name(amira)}`,
    agency: 'health',
    recordedAt: at('2026-08-13', '17:30'),
    kind: 'pattern',
    title: 'Medication errors cluster on the 20:00 round and on one shift pattern',
    text: 'Of the seventeen errors on the July MAR charts, fourteen are on the 20:00 round and none on the morning or lunchtime rounds. Eleven of the fourteen fall on nine evenings when the same agency nurse was the only registered nurse on duty; the extended audit back to April shows the same shape from mid-May, when that nurse\'s bookings began. Five of the six residents are affected; the exception, Wilma Sneddon, has no evening medication. This is a pattern for the investigation to test against the rota and the home\'s own audits, not a finding about any individual. The financial allegation does not follow this pattern and should be treated as a separate strand.',
  });

  // ----- Connector inbox: two EMIS Web medication reviews waiting for a decision -----
  makeConnectorEvent(ctx, {
    id: 'cev_rowanbank_1',
    connectorId: 'emis-web',
    agency: 'health',
    subjectId: zofia.id,
    receivedAt: at('2026-09-01', '12:40'),
    externalRef: 'EMIS-MEDREV-91127',
    sourcePayload: { patient: 'WISNIEWSKA, Zofia', practice: 'Braeside Health Centre', clinician: 'Practice pharmacist', code: 'Medication review done', note: 'Warfarin: INR monitoring weekly for 4 weeks; home to use single-nurse witnessed administration; Polish medicines list provided' },
    mapped: { eventType: 'health.assessment', title: 'Medication review: warfarin monitoring and a Polish medicines list', detail: 'Pharmacy-led review at the home. Weekly INR for four weeks. Written medicines list in Polish given to Zofia.', occurredAt: at('2026-08-31', '11:20'), hasTime: true, significance: 'moderate', mappingRule: 'emis.medication-review.asp-context' },
  });
  makeConnectorEvent(ctx, {
    id: 'cev_rowanbank_2',
    connectorId: 'emis-web',
    agency: 'health',
    subjectId: malcolm.id,
    receivedAt: at('2026-09-01', '12:42'),
    externalRef: 'EMIS-MEDREV-91128',
    sourcePayload: { patient: 'RANKIN, Malcolm', practice: 'Braeside Health Centre', clinician: 'Practice pharmacist', code: 'Medication review done', note: 'Insulin: pen device and timing confirmed; blood glucose diary to be kept by the home; no dose change' },
    mapped: { eventType: 'health.assessment', title: 'Medication review: insulin timing confirmed, blood glucose diary started', detail: 'Pharmacy-led review at the home. No dose change. Home to keep a blood glucose diary for review on 10 Sep.', occurredAt: at('2026-08-31', '14:05'), hasTime: true, significance: 'moderate', mappingRule: 'emis.medication-review.asp-context' },
  });
}
