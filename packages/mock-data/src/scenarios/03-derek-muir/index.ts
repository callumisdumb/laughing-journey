/**
 * Scenario 3: Derek Muir, 52, Kilbrannan. MAPPA Category 1 (registered sex offender), Level 2,
 * released on licence six weeks ago. The restricted record is the point: pre-meeting returns,
 * the Risk Management Plan, an Environmental Risk Assessment in progress, a pending disclosure
 * decision to an employer, and a Level 2 review due in five weeks. The platform is not ViSOR:
 * it stores the ViSOR reference as a string.
 */
import type { Agency, Invitee, Membership, Process } from '@mas/domain';
import type { BuildContext } from '../../generator/context';
import { at, makeAction, makeAddress, makeAnalysis, makeEvent, makeLawfulBasis, makeMeeting, makePerson, makePlan, makeRisk, makeShare, makeViews, syntheticChi } from '../../generator/factory';
import { USR, userName } from '../../generator/organisations';

export const DEREK = {
  derek: 'per_derek_muir',
  process: 'prc_mappa_derek',
  preReleaseMeeting: 'mtg_derek_l2_prerelease',
  reviewMeeting: 'mtg_derek_l2_review',
  rmp: 'pln_derek_rmp',
  currentAddress: 'adr_derek_abbey_wynd',
  proposedAddress: 'adr_derek_schoolhouse_loan',
  lawfulBasis: 'lb_derek_mappa',
  rm2000: 'ra_derek_rm2000',
  sa07: 'ra_derek_sa07',
  lscmi: 'ra_derek_lscmi',
} as const;

export function seedDerekMuir(ctx: BuildContext): void {
  const name = (id: string) => userName(ctx, id);

  // Personas. Only ids from USR are used.
  const priya = USR.priyaSharif; // police, sex offender liaison, lead Responsible Authority contact
  const ross = USR.rossMowat; // MAPPA Coordinator
  const helen = USR.helenRae; // justice social worker, supervising officer
  const louise = USR.louiseKennedy; // health board single point of contact
  const colin = USR.colinBeattie; // SPS, prison-based social worker
  const mark = USR.markHepburn; // housing, duty to cooperate

  // Addresses. The victim has no record on the platform and is referred to only as "the victim".
  const preCustody = makeAddress(ctx, { id: 'adr_derek_cannon_loan', line1: '17 Cannon Loan', line2: 'Flat 1/2', town: 'Kilbrannan', postcode: 'QX2 3HW' });
  const abbeyWynd = makeAddress(ctx, { id: DEREK.currentAddress, line1: '40 Abbey Wynd', line2: 'Supported accommodation, room 4', town: 'Kilbrannan', postcode: 'QX2 6TD' });
  const schoolhouseLoan = makeAddress(ctx, { id: DEREK.proposedAddress, line1: '6 Schoolhouse Loan', town: 'Braeside', postcode: 'QX5 1AR' });

  const hh = 'hh_derek';
  const derek = makePerson(ctx, {
    id: DEREK.derek,
    givenName: 'Derek',
    familyName: 'Muir',
    sex: 'male',
    dateOfBirth: '1974-06-08',
    chi: syntheticChi(ctx, '1974-06-08', 'male'),
    addressHistory: [
      { addressId: preCustody.id, from: '2015-02-02', to: '2022-01-22', note: 'Tenancy ended on remand' },
      { addressId: abbeyWynd.id, from: '2026-07-22', note: 'Temporary supported accommodation since release on licence' },
    ],
    householdId: hh,
    gpPractice: 'Braeside Health Centre',
    ethnicity: 'scottish',
    contact: { phone: '07700 900334' },
    alerts: [{ id: 'alt_derek_mappa', kind: 'mappa', text: 'MAPPA managed (restricted)', from: '2026-07-14', visibleTo: ['police', 'social-work', 'health', 'sps'] }],
    createdAt: at('2026-05-10', '14:10'),
  });
  ctx.data.households.push({ id: hh, synthetic: true, addressId: abbeyWynd.id, memberIds: [derek.id], label: 'Supported accommodation, 40 Abbey Wynd' });

  // ----- Lawful basis -----
  const lb = makeLawfulBasis(ctx, {
    id: DEREK.lawfulBasis,
    purpose: 'Multi-agency assessment and management of the risk of serious harm posed by Derek Muir under MAPPA',
    article6: '6(1)(c) legal obligation',
    article9Condition: '9(2)(g) substantial public interest, DPA 2018 Sch 1 Pt 2 para 18 (safeguarding)',
    article10Criminal: 'DPA 2018 s10 and Sch 1',
    statutoryGateway: [
      'Management of Offenders etc. (Scotland) Act 2005 s10 (duty of Responsible Authorities to establish joint arrangements)',
      'Management of Offenders etc. (Scotland) Act 2005 s11 (duty to cooperate)',
      'MAPPA National Guidance 2022',
      'Sexual Offences Act 2003 Part 2 (notification requirements)',
    ],
    necessityAndProportionality: 'Sharing between the Responsible Authorities and the duty to cooperate agencies on the distribution list is necessary to assess and manage the risk of serious harm. The record is restricted; each agency receives the level of detail its role needs and nothing is shared with the victim, employers or the public except through a recorded disclosure decision.',
    consentStatus: 'not-required',
    consentNote: 'Consent is not the basis for sharing under MAPPA. Derek Muir has been told what is shared and with whom.',
    authorisedByUserId: ross,
    authorisedByName: name(ross),
    informationSharingAgreementRef: 'Clydeshore MAPPA ISA 2022/01',
    dpiaRef: 'DPIA-MAPPA-2022-02',
    createdAt: at('2026-05-11', '09:30'),
  });

  // ----- Risk assessments: tool, date, assessor, band. The platform does not implement the tools. -----
  makeRisk(ctx, { id: DEREK.rm2000, processId: DEREK.process, subjectId: derek.id, tool: 'rm2000', assessedAt: at('2026-05-20', '10:00'), assessorUserId: priya, assessorName: name(priya), assessorAgency: 'police', band: 'medium', bandLabel: 'Medium (RM2000/S)', evidenceRefs: [{ kind: 'document', ref: 'RM2000 scoring sheet, 20 May 2026', label: 'RM2000 scoring sheet' }] });
  makeRisk(ctx, { id: DEREK.lscmi, processId: DEREK.process, subjectId: derek.id, tool: 'lscmi', assessedAt: at('2026-06-10', '14:00'), assessorUserId: helen, assessorName: name(helen), assessorAgency: 'social-work', band: 'medium', bandLabel: 'Medium', evidenceRefs: [{ kind: 'document', ref: 'LS/CMI pre-release assessment, 10 Jun 2026', label: 'LS/CMI' }] });
  makeRisk(ctx, { id: DEREK.sa07, processId: DEREK.process, subjectId: derek.id, tool: 'sa07', assessedAt: at('2026-08-20', '11:00'), assessorUserId: priya, assessorName: name(priya), assessorAgency: 'police', band: 'medium', bandLabel: 'Stable moderate, acute low', evidenceRefs: [{ kind: 'document', ref: 'Stable and Acute 2007, 20 Aug 2026', label: 'SA07' }] });
  const riskIds = [DEREK.rm2000, DEREK.lscmi, DEREK.sa07];

  // ----- Members: the restricted distribution list -----
  const members: Membership[] = [
    { userId: priya, caseRole: 'lead Responsible Authority contact (police offender management)', agency: 'police', since: '2026-05-10', reason: 'Category 1 offender: police lead the risk management; chairs the Level 2 meeting' },
    { userId: ross, caseRole: 'MAPPA Coordinator', agency: 'social-work', since: '2026-05-10', reason: 'Receives the notification and referral; requests pre-meeting returns; minutes and distributes' },
    { userId: helen, caseRole: 'supervising officer (justice social work)', agency: 'social-work', since: '2026-05-12', reason: 'Statutory supervision on licence; Responsible Authority single point of contact' },
    { userId: louise, caseRole: 'health board single point of contact', agency: 'health', since: '2026-06-16', reason: 'Responsible Authority single point of contact for pre-meeting returns' },
    { userId: colin, caseRole: 'prison-based social worker (SPS)', agency: 'sps', since: '2026-05-10', reason: 'Made the pre-release notification; Responsible Authority while in custody' },
    { userId: mark, caseRole: 'housing officer (duty to cooperate)', agency: 'housing', since: '2026-06-16', reason: 'Accommodation is in question; carries out the Environmental Risk Assessment' },
  ];

  // ----- Process -----
  const process: Process = {
    id: DEREK.process,
    synthetic: true,
    type: 'mappa',
    reference: 'MAPPA-2026-0034',
    title: 'MAPPA: Derek Muir',
    subjectIds: [derek.id],
    leadAgency: 'police',
    leadUserId: priya,
    stage: 'managed',
    stageHistory: [
      { stage: 'notification', at: at('2026-05-10', '14:00'), byUserId: colin, byName: name(colin), note: 'Pre-release notification from HMP Glenmoray, ten weeks before the release date' },
      { stage: 'referral', at: at('2026-06-02', '11:00'), byUserId: priya, byName: name(priya), note: 'Referred to Level 2, informed by RM2000 (medium)' },
      { stage: 'pre-meeting', at: at('2026-06-16', '09:00'), byUserId: ross, byName: name(ross), note: 'Referral passed to the single point of contact in each Responsible Authority and to housing' },
      { stage: 'meeting', at: at('2026-07-14', '10:00'), byUserId: priya, byName: name(priya), note: 'Pre-release Level 2 meeting held' },
      { stage: 'managed', at: at('2026-07-22', '09:30'), byUserId: priya, byName: name(priya), note: 'Released on licence; active multi-agency management at Level 2' },
    ],
    status: 'open',
    classification: 'restricted',
    openedAt: at('2026-05-10', '14:00'),
    members,
    clocks: [
      { id: 'clk_derek_l2_review', ruleId: 'mappa.level2.review', triggeredAt: '2026-07-14T10:00:00+01:00', note: 'Review meeting scheduled for 6 Oct 2026, twelve weeks from the pre-release meeting' },
    ],
    linkedProcessIds: [],
    viewsRecordIds: ['vw_derek_1'],
    riskAssessmentIds: riskIds,
    flags: { housingRelevant: true, childInHousehold: false, inCustody: false },
    // Case-role register: the victim has no person record (see victimPersonIds), and no persona holds a victim, employer or public role.
    parties: [],
    detail: {
      category: 1,
      level: 2,
      levelHistory: [
        { level: 2, at: '2026-07-14', reason: 'Medium risk of sexual reoffending (RM2000, SA07) with unresolved accommodation and employment; a move to settled housing and any employment need multi-agency decisions in the first months after release. Level 1 would leave those decisions to one agency.', meetingId: DEREK.preReleaseMeeting },
      ],
      leadResponsibleAuthority: 'police',
      visorReference: 'ViSOR 2022/0451/Z',
      victimPersonIds: [],
      notification: { at: at('2026-05-10', '14:00'), source: 'Scottish Prison Service, HMP Glenmoray (pre-release notification)', byName: name(colin) },
      referral: {
        at: at('2026-06-02', '11:00'),
        byName: name(priya),
        riskAssessmentIds: riskIds,
        reason: 'Referral to Level 2 informed by RM2000 (medium, 20 May). LS/CMI (medium, 10 Jun) was added to the referral pack before the pre-release meeting and Stable and Acute 2007 (stable moderate, acute low, 20 Aug) after release. Release to temporary accommodation with a housing move and employment expected within months.',
      },
      sonr: { subject: true, compliant: true, lastNotificationAt: '2026-07-23', nextDueAt: '2027-07-23' },
      custody: { releasedAt: '2026-07-22', licenceExpiresAt: '2028-01-21', establishment: 'HMP Glenmoray' },
      licenceConditions: [
        { id: 'lic_derek_1', text: 'To reside at 40 Abbey Wynd, Kilbrannan and not to change address without the prior approval of the supervising officer', status: 'active' },
        { id: 'lic_derek_2', text: 'Not to have unsupervised contact with any child under 16 without the prior approval of the supervising officer', status: 'active' },
        { id: 'lic_derek_3', text: 'Not to enter the exclusion zone defined in the licence (the area around the home of the victim)', status: 'active' },
        { id: 'lic_derek_4', text: 'To attend and engage with the community sex offender programme (Moving Forward 2 Change) as directed by the supervising officer', status: 'active' },
        { id: 'lic_derek_5', text: 'To notify the supervising officer and the police of any intimate relationship, and of any employment, paid or unpaid, before it starts', status: 'active' },
      ],
      riskAssessmentIds: riskIds,
      rmp: {
        planId: DEREK.rmp,
        triggers: [
          'Any contact with a child under 16 outside the approved arrangements',
          'Missed supervision appointment or failure to notify a change of address, relationship or employment',
          'Entry to the exclusion zone or any attempt to contact the victim or the victim\'s family',
          'Alcohol use above the level Derek has agreed with the supervising officer',
          'Loss of accommodation or employment, or a new relationship with a partner who has children',
        ],
        contingencies: [
          'Any trigger: supervising officer and sex offender liaison officer confer the same working day and record the decision',
          'Contact with a child or entry to the exclusion zone: police investigate; breach report to the Parole Board for Scotland considered for recall',
          'Loss of accommodation: housing to offer an interim placement outside the exclusion zone within 48 hours',
          'Significant change: bring the Level 2 review forward',
        ],
        controls: [
          'Licence conditions (five, active) supervised by justice social work with weekly appointments for twelve weeks',
          'Sex Offender Notification Requirements: annual notification and notification of changes within three days',
          'Police home visits at least fortnightly for three months, some unannounced',
          'Community sex offender programme from 15 Sep 2026',
          'Environmental Risk Assessment before any change of address is approved',
        ],
        victimSafety: 'The victim is protected by the exclusion zone and the no-contact requirement. No MAPPA information is given to the victim or the victim\'s family; the Victim Notification Scheme is the route for information about release and licence conditions, and police confirmed VNS registration with SPS victim liaison before release.',
        accommodation: 'Temporary supported accommodation at 40 Abbey Wynd, Kilbrannan, with staff on site and no children resident. A move to a settled tenancy at 6 Schoolhouse Loan, Braeside has been proposed by housing; an Environmental Risk Assessment is in progress and no decision will be made until it is complete.',
        employment: 'Derek wants to work. Any employment needs the supervising officer\'s approval and a disclosure decision where the role could bring contact with children or where the employer needs to know the licence conditions. A job offer from Kilbrannan Vehicle Recycling Ltd is under consideration.',
        associates: 'No known associates of concern. Derek has no contact with his former partner. His brother in Glenmoray is supportive and aware of the licence conditions.',
        reviewedAt: '2026-07-14',
      },
      era: {
        status: 'in-progress',
        proposedAddressId: schoolhouseLoan.id,
        assessorName: `${name(mark)} (housing), with police input from ${name(priya)}`,
        startedAt: '2026-08-18',
        concerns: [
          'The property is 180 metres from Ardvale Primary and its gate faces the route pupils use from Schoolhouse Loan',
          'A play park sits directly across the road from the front window',
          'Ground-floor flat with a shared close; two families with children in the same block',
          'The bus stop for Kilbrannan is outside the school gate, so the school run and Derek\'s likely travel times overlap',
        ],
      },
      disclosures: [
        {
          id: 'dsc_derek_1',
          recipient: 'Kilbrannan Vehicle Recycling Ltd',
          recipientKind: 'employer',
          status: 'pending',
          factsToDisclose: [
            'Derek Muir was convicted in 2022 of sexual offences against a child and is subject to notification requirements',
            'He is on licence until 21 Jan 2028 with a condition that he has no unsupervised contact with children under 16',
            'The supervising officer and the sex offender liaison officer are the points of contact for any concern',
          ],
          rationale: 'The yard is open to the public, including families bringing scrap, and Saturday work is expected. The employer cannot manage the licence condition without knowing it exists. Disclosure would be limited to the three facts listed; the offence detail and the risk assessments are not to be shared. Decision due before the start date.',
        },
      ],
      preMeetingReturns: [
        { agency: 'police', contact: name(priya), requestedAt: '2026-09-01', status: 'returned', summary: 'SONR compliant; four home visits, no concerns; SA07 stable moderate, acute low; disclosure to employer pending' },
        { agency: 'social-work', contact: name(helen), requestedAt: '2026-09-01', status: 'returned', summary: 'Seven supervision appointments attended; programme assessment complete, group from 15 Sep; wants to work' },
        { agency: 'health', contact: name(louise), requestedAt: '2026-09-01', status: 'requested' },
        { agency: 'housing', contact: name(mark), requestedAt: '2026-09-01', status: 'requested' },
        { agency: 'sps', contact: name(colin), requestedAt: '2026-09-01', status: 'nothing-known', summary: 'No further information since release' },
      ],
      reviewSchedule: { lastMeetingId: DEREK.preReleaseMeeting, lastMeetingAt: '2026-07-14', nextDueAt: '2026-10-06' },
    },
  };
  ctx.data.processes.push(process);

  // ----- Views -----
  makeViews(ctx, {
    id: 'vw_derek_1',
    personId: derek.id,
    processId: process.id,
    kind: 'adult-views',
    recordedAt: at('2026-08-20', '14:30'),
    recordedByUserId: helen,
    recordedByName: name(helen),
    recordedByAgency: 'social-work',
    method: 'Supervision appointment at Kilbrannan Justice Centre',
    content: '"I want to work and keep my head down. I know the conditions and I will stick to them. I do not want to be anywhere near where it happened." Derek accepts the licence conditions and the reason for the exclusion zone. He asked whether the recycling yard job could go ahead and whether the Braeside flat is likely to be approved.',
    sharingPreference: 'Content for Derek to be shared with the MAPPA meeting.',
  });

  // ----- Risk Management Plan -----
  makePlan(ctx, {
    id: DEREK.rmp,
    processId: process.id,
    type: 'mappa-rmp',
    title: 'Risk Management Plan (Level 2, 14 Jul 2026)',
    outcomes: [
      { id: 'out_derek_1', text: 'Derek complies with his licence conditions and notification requirements', actionIds: ['act_derek_3', 'act_derek_5', 'act_derek_7'] },
      { id: 'out_derek_2', text: 'Derek lives in accommodation assessed as suitable', actionIds: ['act_derek_1'] },
      { id: 'out_derek_3', text: 'Any employment is safe and every disclosure decision is recorded with its rationale', actionIds: ['act_derek_2'] },
      { id: 'out_derek_4', text: 'Derek completes the community sex offender programme', actionIds: ['act_derek_6'] },
      { id: 'out_derek_5', text: 'The Level 2 review on 6 Oct 2026 has a return from every agency', actionIds: ['act_derek_4'] },
    ],
    coordinatorUserId: priya,
    coordinatorName: name(priya),
    agreedAt: '2026-07-14',
    reviewDate: '2026-10-06',
    status: 'active',
  });

  // ----- Actions -----
  makeAction(ctx, { id: 'act_derek_1', processId: process.id, planId: DEREK.rmp, title: 'Complete the Environmental Risk Assessment for 6 Schoolhouse Loan, Braeside', detail: 'Site visit done 18 Aug. Police input on the school route and the play park received 26 Aug. Conclusion and recommended controls outstanding.', ownerUserId: mark, ownerName: name(mark), ownerAgency: 'housing', due: '2026-09-12', status: 'in-progress', createdAt: at('2026-08-18', '16:30'), createdByName: name(mark) });
  makeAction(ctx, { id: 'act_derek_2', processId: process.id, planId: DEREK.rmp, title: 'Decide the disclosure to Kilbrannan Vehicle Recycling Ltd and record the rationale', detail: 'Facts to disclose drafted 26 Aug. Decision needed before the proposed start date of 14 Sep.', ownerUserId: priya, ownerName: name(priya), ownerAgency: 'police', due: '2026-09-09', status: 'open', createdAt: at('2026-08-26', '10:00'), createdByName: name(priya) });
  makeAction(ctx, { id: 'act_derek_3', processId: process.id, meetingId: DEREK.preReleaseMeeting, planId: DEREK.rmp, title: 'Weekly supervision appointments for the first twelve weeks, then fortnightly', ownerUserId: helen, ownerName: name(helen), ownerAgency: 'social-work', due: '2026-10-06', status: 'in-progress', evidence: 'Attended 23 and 30 Jul, 6, 13, 20 and 27 Aug. No missed appointments.', createdAt: at('2026-07-14', '11:50'), createdByName: name(priya) });
  makeAction(ctx, { id: 'act_derek_4', processId: process.id, meetingId: DEREK.reviewMeeting, planId: DEREK.rmp, title: 'Pre-meeting returns for the 6 Oct review: each single point of contact to search records and return by 25 Sep', ownerUserId: ross, ownerName: name(ross), ownerAgency: 'social-work', due: '2026-09-25', status: 'in-progress', evidence: 'Police and justice social work returned; health and housing outstanding; SPS nothing known.', createdAt: at('2026-09-01', '09:00'), createdByName: name(ross) });
  makeAction(ctx, { id: 'act_derek_5', processId: process.id, meetingId: DEREK.preReleaseMeeting, planId: DEREK.rmp, title: 'Police home visits at least fortnightly for three months, some unannounced', ownerUserId: priya, ownerName: name(priya), ownerAgency: 'police', due: '2026-10-22', status: 'in-progress', evidence: 'Visits 24 Jul, 7 Aug, 20 Aug (SA07 completed), 28 Aug (unannounced). No concerns.', createdAt: at('2026-07-14', '11:50'), createdByName: name(priya) });
  makeAction(ctx, { id: 'act_derek_6', processId: process.id, meetingId: DEREK.preReleaseMeeting, planId: DEREK.rmp, title: 'Refer to the community sex offender programme and confirm the first group date', ownerUserId: helen, ownerName: name(helen), ownerAgency: 'social-work', due: '2026-08-31', status: 'complete', completedAt: at('2026-08-14', '12:00'), evidence: 'Programme assessment 11 Aug; group starts 15 Sep 2026.', createdAt: at('2026-07-14', '11:50'), createdByName: name(priya) });
  makeAction(ctx, { id: 'act_derek_7', processId: process.id, meetingId: DEREK.preReleaseMeeting, planId: DEREK.rmp, title: 'Confirm the initial notification under SONR is made within three days of release', ownerUserId: priya, ownerName: name(priya), ownerAgency: 'police', due: '2026-07-25', status: 'complete', completedAt: at('2026-07-23', '11:30'), evidence: 'Notified in person at Kilbrannan Police Station on 23 Jul; next annual notification 23 Jul 2027.', createdAt: at('2026-07-14', '11:50'), createdByName: name(priya) });
  const actionIds = ['act_derek_1', 'act_derek_2', 'act_derek_3', 'act_derek_4', 'act_derek_5', 'act_derek_6', 'act_derek_7'];

  // ----- Meetings -----
  const invitees = (held: boolean): Invitee[] => {
    const attendance = (remote = false): Invitee['attendance'] => (held ? (remote ? 'remote' : 'present') : 'accepted');
    return [
      { userId: priya, name: name(priya), agency: 'police', role: 'Sex offender liaison officer (chair)', required: true, attendance: attendance(), reason: 'Lead Responsible Authority', needToKnowRowId: 'mappa.premeeting.chair' },
      { userId: ross, name: name(ross), agency: 'social-work', role: 'MAPPA Coordinator (minute taker)', required: true, attendance: attendance(), reason: 'Coordinates the meeting and the returns', needToKnowRowId: 'mappa.premeeting.coordinator' },
      { userId: helen, name: name(helen), agency: 'social-work', role: 'Justice social worker', required: true, attendance: attendance(), reason: 'Supervising officer; Responsible Authority', needToKnowRowId: 'mappa.referral.spoc-jsw' },
      { userId: louise, name: name(louise), agency: 'health', role: 'Health board single point of contact', required: true, attendance: held ? 'present' : 'invited', reason: 'Responsible Authority', needToKnowRowId: 'mappa.referral.spoc-health' },
      { userId: colin, name: name(colin), agency: 'sps', role: 'Prison-based social worker', required: held, attendance: attendance(true), reason: held ? 'Responsible Authority while in custody' : 'Post-release; attends for information', needToKnowRowId: 'mappa.referral.spoc-sps' },
      { userId: mark, name: name(mark), agency: 'housing', role: 'Housing officer', required: true, attendance: held ? 'present' : 'invited', reason: 'Duty to cooperate; accommodation is in question', needToKnowRowId: 'mappa.referral.spoc-housing' },
    ];
  };

  makeMeeting(ctx, {
    id: DEREK.preReleaseMeeting,
    type: 'mappa-level2',
    processId: process.id,
    subjectIds: [derek.id],
    title: 'MAPPA Level 2 pre-release meeting: Derek Muir',
    scheduledAt: at('2026-07-14', '10:00'),
    endsAt: at('2026-07-14', '12:00'),
    location: 'Kilbrannan Police Station, MAPPA room (restricted)',
    status: 'held',
    chairUserId: priya,
    chairName: name(priya),
    minuteTakerUserId: ross,
    minuteTakerName: name(ross),
    invitees: invitees(true),
    agenda: [
      { id: 'ag_derek_pre_1', order: 1, title: 'Confidentiality and the distribution list', status: 'done' },
      { id: 'ag_derek_pre_2', order: 2, title: 'Referral and risk assessments (RM2000, LS/CMI)', status: 'done' },
      { id: 'ag_derek_pre_3', order: 3, title: 'Pre-meeting returns from each agency', status: 'done' },
      { id: 'ag_derek_pre_4', order: 4, title: 'Level decision', status: 'done' },
      { id: 'ag_derek_pre_5', order: 5, title: 'Risk Management Plan: triggers, contingencies, controls, victim safety', status: 'done' },
      { id: 'ag_derek_pre_6', order: 6, title: 'Accommodation on release', status: 'done' },
      { id: 'ag_derek_pre_7', order: 7, title: 'Disclosure and victim considerations', status: 'done' },
      { id: 'ag_derek_pre_8', order: 8, title: 'Actions and review date', status: 'done' },
    ],
    preMeetingRequests: [
      { id: 'pmr_derek_pre_1', agency: 'police', toName: name(priya), toUserId: priya, sentAt: at('2026-06-16', '09:00'), dueAt: '2026-07-07', status: 'returned', returnSummary: 'Conviction and sentence, RM2000 medium, ViSOR reference, no intelligence since remand', returnedAt: at('2026-06-30', '15:00') },
      { id: 'pmr_derek_pre_2', agency: 'social-work', toName: name(helen), toUserId: helen, sentAt: at('2026-06-16', '09:00'), dueAt: '2026-07-07', status: 'returned', returnSummary: 'LS/CMI medium; licence conditions proposed; supervision plan', returnedAt: at('2026-07-02', '11:00') },
      { id: 'pmr_derek_pre_3', agency: 'health', toName: name(louise), toUserId: louise, sentAt: at('2026-06-16', '09:00'), dueAt: '2026-07-07', status: 'returned', returnSummary: 'No mental health service involvement. GP registration at Braeside Health Centre to be arranged on release', returnedAt: at('2026-07-06', '16:20') },
      { id: 'pmr_derek_pre_4', agency: 'housing', toName: name(mark), toUserId: mark, sentAt: at('2026-06-16', '09:00'), dueAt: '2026-07-07', status: 'returned', returnSummary: 'Supported accommodation place identified at 40 Abbey Wynd, Kilbrannan, outside the exclusion zone', returnedAt: at('2026-07-03', '10:30') },
      { id: 'pmr_derek_pre_5', agency: 'sps', toName: name(colin), toUserId: colin, sentAt: at('2026-06-16', '09:00'), dueAt: '2026-07-07', status: 'returned', returnSummary: 'Custodial behaviour good; programme completed 2024 with a positive post-programme report; release date 22 Jul', returnedAt: at('2026-06-25', '14:00') },
    ],
    pack: [
      { id: 'pk_derek_pre_1', kind: 'risk-assessment', label: 'RM2000 (20 May 2026)', ref: DEREK.rm2000, included: true },
      { id: 'pk_derek_pre_2', kind: 'risk-assessment', label: 'LS/CMI (10 Jun 2026)', ref: DEREK.lscmi, included: true },
      { id: 'pk_derek_pre_3', kind: 'report', label: 'SPS pre-release report', ref: 'pmr_derek_pre_5', included: true },
      { id: 'pk_derek_pre_4', kind: 'research-return', label: 'Pre-meeting returns (five agencies)', included: true },
      { id: 'pk_derek_pre_5', kind: 'chronology', label: 'Chronology, 2022 to date', windowFrom: '2022-01-22', windowTo: '2026-07-13', included: true },
    ],
    informationShared: [
      { id: 'is_derek_pre_1', agency: 'police', byName: name(priya), byUserId: priya, at: at('2026-07-14', '10:15'), summary: 'Conviction 2022; extended sentence; SONR indefinite; RM2000 medium. No intelligence since remand. VNS registration confirmed with SPS victim liaison.', relevance: 'Baseline risk and victim safety', linkedEventIds: [] },
      { id: 'is_derek_pre_2', agency: 'sps', byName: name(colin), byUserId: colin, at: at('2026-07-14', '10:30'), summary: 'Programme completed 2024. No adjudications. Derek says he wants work and to stay away from the area of the offence.', relevance: 'Change in custody; stated intentions', linkedEventIds: [] },
      { id: 'is_derek_pre_3', agency: 'social-work', byName: name(helen), byUserId: helen, at: at('2026-07-14', '10:45'), summary: 'LS/CMI medium. Five licence conditions proposed. Weekly supervision for twelve weeks.', relevance: 'Controls on release', linkedEventIds: [] },
      { id: 'is_derek_pre_4', agency: 'housing', byName: name(mark), byUserId: mark, at: at('2026-07-14', '11:00'), summary: 'Supported accommodation at 40 Abbey Wynd, staffed, no children resident, twelve-week placement. A settled tenancy will need an ERA.', relevance: 'Accommodation', linkedEventIds: [] },
      { id: 'is_derek_pre_5', agency: 'health', byName: name(louise), byUserId: louise, at: at('2026-07-14', '11:05'), summary: 'No mental health involvement. GP registration to be arranged.', relevance: 'Health needs', linkedEventIds: [] },
    ],
    decisions: [
      { id: 'dec_derek_pre_1', question: 'MAPPA level', decision: 'Level 2: active multi-agency management', rationale: 'Medium risk with accommodation and employment decisions due in the first months after release that need more than one agency. Not the critical few.', dissent: [], decidedByName: name(priya), decidedByUserId: priya, decidedAt: at('2026-07-14', '11:10') },
      { id: 'dec_derek_pre_2', question: 'Risk Management Plan', decision: 'RMP agreed as drafted, with the triggers, contingencies and controls recorded on the plan', rationale: 'Controls match the identified risks; contingencies name who acts and when', dissent: [], decidedByName: name(priya), decidedByUserId: priya, decidedAt: at('2026-07-14', '11:25') },
      { id: 'dec_derek_pre_3', question: 'Accommodation on release', decision: 'Release to 40 Abbey Wynd, Kilbrannan (supported accommodation). Any move to a settled tenancy needs an Environmental Risk Assessment before approval.', rationale: 'Staffed placement outside the exclusion zone with no children resident', dissent: [{ byName: name(mark), byUserId: mark, agency: 'housing', text: 'Housing noted the placement is limited to twelve weeks and asked that the ERA for a settled tenancy start within four weeks of release rather than at the review.' }], decidedByName: name(priya), decidedByUserId: priya, decidedAt: at('2026-07-14', '11:35') },
      { id: 'dec_derek_pre_4', question: 'Victim considerations and disclosure', decision: 'No disclosure to the victim or the victim\'s family is made through MAPPA. The Victim Notification Scheme is the route. No third-party disclosure is needed at this stage; any employer or landlord disclosure to come back as a recorded decision.', rationale: 'MAPPA information is not given to victims directly (MAPPA National Guidance 2022). Disclosure to third parties only where necessary and proportionate, with the facts and rationale recorded.', dissent: [], decidedByName: name(priya), decidedByUserId: priya, decidedAt: at('2026-07-14', '11:45') },
      { id: 'dec_derek_pre_5', question: 'Review date', decision: 'Level 2 review on 6 Oct 2026', rationale: 'Twelve weeks, the maximum interval for Level 2 under the national guidance; earlier if a trigger occurs', dissent: [], decidedByName: name(priya), decidedByUserId: priya, decidedAt: at('2026-07-14', '11:50') },
    ],
    actionIds: ['act_derek_3', 'act_derek_5', 'act_derek_6', 'act_derek_7'],
    viewsRecordIds: [],
    minute: { status: 'distributed', draftedAt: at('2026-07-15', '11:00'), approvedAt: at('2026-07-16', '09:30'), distributedAt: at('2026-07-16', '10:00') },
    distribution: [
      { id: 'dist_derek_pre_1', recipientName: name(priya), recipientUserId: priya, agency: 'police', role: 'Sex offender liaison officer', detailLevel: 'full', reason: 'Attendee; lead Responsible Authority' },
      { id: 'dist_derek_pre_2', recipientName: name(helen), recipientUserId: helen, agency: 'social-work', role: 'Justice social worker', detailLevel: 'full', reason: 'Attendee; Responsible Authority', sharingRecordId: 'shr_derek_1' },
      { id: 'dist_derek_pre_3', recipientName: name(louise), recipientUserId: louise, agency: 'health', role: 'Health board single point of contact', detailLevel: 'full', reason: 'Attendee; Responsible Authority', sharingRecordId: 'shr_derek_2' },
      { id: 'dist_derek_pre_4', recipientName: name(colin), recipientUserId: colin, agency: 'sps', role: 'Prison-based social worker', detailLevel: 'full', reason: 'Attendee; Responsible Authority while in custody', sharingRecordId: 'shr_derek_3' },
      { id: 'dist_derek_pre_5', recipientName: name(mark), recipientUserId: mark, agency: 'housing', role: 'Housing officer', detailLevel: 'fields', fields: ['Environmental Risk Assessment conclusions', 'accommodation controls', 'licence residence condition', 'review date', 'contact for concerns'], reason: 'Duty to cooperate: ERA conclusions and controls only', sharingRecordId: 'shr_derek_4' },
    ],
    reviewDate: '2026-10-06',
    subjectAttendance: 'Derek Muir does not attend MAPPA meetings. His views on release were reported by the prison-based social worker and he was told the level decision and the review date by his supervising officer.',
  });

  makeMeeting(ctx, {
    id: DEREK.reviewMeeting,
    type: 'mappa-level2',
    processId: process.id,
    subjectIds: [derek.id],
    title: 'MAPPA Level 2 review: Derek Muir',
    scheduledAt: at('2026-10-06', '10:00'),
    endsAt: at('2026-10-06', '11:30'),
    location: 'Kilbrannan Police Station, MAPPA room (restricted)',
    status: 'scheduled',
    chairUserId: priya,
    chairName: name(priya),
    minuteTakerUserId: ross,
    minuteTakerName: name(ross),
    invitees: invitees(false),
    agenda: [
      { id: 'ag_derek_rev_1', order: 1, title: 'Confidentiality and the distribution list', status: 'pending' },
      { id: 'ag_derek_rev_2', order: 2, title: 'Pre-meeting returns and compliance since release', status: 'pending' },
      { id: 'ag_derek_rev_3', order: 3, title: 'Stable and Acute 2007 (20 Aug)', status: 'pending' },
      { id: 'ag_derek_rev_4', order: 4, title: 'Environmental Risk Assessment: 6 Schoolhouse Loan', status: 'pending' },
      { id: 'ag_derek_rev_5', order: 5, title: 'Employment and the disclosure decision', status: 'pending' },
      { id: 'ag_derek_rev_6', order: 6, title: 'Level review and next review date', status: 'pending' },
    ],
    preMeetingRequests: [
      { id: 'pmr_derek_rev_1', agency: 'police', toName: name(priya), toUserId: priya, sentAt: at('2026-09-01', '09:00'), dueAt: '2026-09-25', status: 'returned', returnSummary: 'SONR compliant; four home visits, no concerns; SA07 stable moderate, acute low; disclosure to employer pending', returnedAt: at('2026-09-01', '16:00') },
      { id: 'pmr_derek_rev_2', agency: 'social-work', toName: name(helen), toUserId: helen, sentAt: at('2026-09-01', '09:00'), dueAt: '2026-09-25', status: 'returned', returnSummary: 'Seven supervision appointments attended; programme group from 15 Sep; wants to work', returnedAt: at('2026-09-02', '08:30') },
      { id: 'pmr_derek_rev_3', agency: 'health', toName: name(louise), toUserId: louise, sentAt: at('2026-09-01', '09:00'), dueAt: '2026-09-25', status: 'sent' },
      { id: 'pmr_derek_rev_4', agency: 'housing', toName: name(mark), toUserId: mark, sentAt: at('2026-09-01', '09:00'), dueAt: '2026-09-25', status: 'sent' },
      { id: 'pmr_derek_rev_5', agency: 'sps', toName: name(colin), toUserId: colin, sentAt: at('2026-09-01', '09:00'), dueAt: '2026-09-25', status: 'nothing-known', returnSummary: 'No further information since release', returnedAt: at('2026-09-01', '15:00') },
    ],
    pack: [
      { id: 'pk_derek_rev_1', kind: 'chronology', label: 'Chronology since release, 22 Jul to date', windowFrom: '2026-07-22', windowTo: '2026-10-05', included: true },
      { id: 'pk_derek_rev_2', kind: 'plan', label: 'Risk Management Plan with progress', ref: DEREK.rmp, included: true },
      { id: 'pk_derek_rev_3', kind: 'risk-assessment', label: 'Stable and Acute 2007 (20 Aug 2026)', ref: DEREK.sa07, included: true },
      { id: 'pk_derek_rev_4', kind: 'report', label: 'Environmental Risk Assessment: 6 Schoolhouse Loan', included: false },
      { id: 'pk_derek_rev_5', kind: 'views', label: 'Derek\'s views (20 Aug)', ref: 'vw_derek_1', included: true },
      { id: 'pk_derek_rev_6', kind: 'research-return', label: 'Pre-meeting returns', included: false },
    ],
    actionIds,
    viewsRecordIds: ['vw_derek_1'],
    minute: { status: 'not-started' },
    reviewDate: '2026-10-06',
  });

  // ----- Sharing records: full to Responsible Authorities, fields to housing, nothing to the victim or the employer -----
  const share = (id: string, stage: Process['stage'], to: string, agency: Agency, role: string, level: 'full' | 'summary' | 'fields' | 'presence', reason: string, summary: string, createdAt: string, createdBy: string, rowId?: string, fields?: string[]) =>
    makeShare(ctx, { id, processId: process.id, subjectId: derek.id, stage, recipient: { userId: to, name: name(to), agency, role }, detailLevel: level, fields, lawfulBasisId: lb.id, channel: 'in-app', status: 'read', createdAt, sentAt: createdAt, readAt: createdAt, reason, needToKnowRowId: rowId, createdByUserId: createdBy, createdByName: name(createdBy), summary });
  share('shr_derek_5', 'notification', ross, 'social-work', 'MAPPA Coordinator', 'full', 'Notification received. MAPPA Coordinator must know.', 'Pre-release notification from HMP Glenmoray: Category 1, release 22 Jul 2026, ViSOR reference held', at('2026-05-11', '09:40'), priya, 'mappa.notification.coordinator');
  share('shr_derek_6', 'referral', helen, 'social-work', 'Justice social worker', 'full', 'Referral to Level 2. Council single point of contact.', 'Referral pack: conviction, sentence, licence proposals, RM2000 medium', at('2026-06-16', '09:10'), ross, 'mappa.referral.spoc-jsw');
  share('shr_derek_1', 'meeting', helen, 'social-work', 'Justice social worker', 'full', 'Attendee: restricted minute.', 'Level 2 pre-release minute, level decision, RMP and actions', at('2026-07-16', '10:00'), ross, 'mappa.premeeting.coordinator');
  share('shr_derek_2', 'meeting', louise, 'health', 'Health board single point of contact', 'full', 'Attendee: restricted minute.', 'Level 2 pre-release minute, level decision, RMP and actions', at('2026-07-16', '10:00'), ross, 'mappa.referral.spoc-health');
  share('shr_derek_3', 'meeting', colin, 'sps', 'Prison-based social worker', 'full', 'Attendee: restricted minute.', 'Level 2 pre-release minute, level decision, RMP and actions', at('2026-07-16', '10:00'), ross, 'mappa.referral.spoc-sps');
  share('shr_derek_4', 'managed', mark, 'housing', 'Housing officer', 'fields', 'RMP agreed. If accommodation is in question: ERA conclusions and controls only.', 'Residence condition; ERA required before any move; accommodation controls; review 6 Oct; contact Priya Sharif', at('2026-07-16', '10:05'), ross, 'mappa.meeting.housing-era', ['Environmental Risk Assessment conclusions', 'accommodation controls', 'licence residence condition', 'review date', 'contact for concerns']);

  // ----- Chronology: every event restricted and linked to the MAPPA process -----
  const E = (e: Omit<Parameters<typeof makeEvent>[1], 'subjectIds' | 'visibility' | 'linkedProcessIds'>) =>
    makeEvent(ctx, { subjectIds: [derek.id], linkedProcessIds: [process.id], visibility: 'restricted', lawfulBasisId: lb.id, ...e });

  E({ occurredAt: at('2022-01-22', '15:30'), agency: 'police', recordedByName: name(priya), recordedByUserId: priya, eventType: 'police.custody', title: 'Remanded in custody at HMP Glenmoray', detail: 'Remanded after appearing on petition at Ardvale Sheriff Court. Tenancy at 17 Cannon Loan ended.', significance: 'high', significanceReason: 'Start of the custodial period' });
  E({ occurredAt: at('2022-06-14', '14:00'), agency: 'police', recordedByName: name(priya), recordedByUserId: priya, eventType: 'police.conviction', title: 'Convicted of sexual offences against a child; extended sentence of six years', detail: 'Convicted at the High Court in Glasgow of sexual offences against a child (Sexual Offences (Scotland) Act 2009). Extended sentence of six years: custodial term four years six months, extension period eighteen months, backdated to 22 Jan 2022. Licence to 21 Jan 2028.', significance: 'high', significanceReason: 'Index offence', evidenceRefs: [{ kind: 'external', ref: 'ViSOR 2022/0451/Z', label: 'ViSOR reference' }] });
  E({ occurredAt: at('2022-06-14', '14:30'), agency: 'police', recordedByName: name(priya), recordedByUserId: priya, eventType: 'police.notification', title: 'Sex Offender Notification Requirements: indefinite', detail: 'Subject to notification requirements for an indefinite period because the custodial term is thirty months or more. Notification of changes within three days; annual notification.', significance: 'high' });
  E({ occurredAt: at('2024-03-15', '00:00'), hasTime: false, agency: 'sps', recordedByName: name(colin), recordedByUserId: colin, eventType: 'care.service-end', title: 'Programme completed; positive post-programme report', detail: 'Completed all modules. Facilitators reported engagement throughout and a clear account of his offence-supportive thinking and how he plans to manage it. Maintenance work continued with the prison-based social worker.', significance: 'moderate' });
  E({ occurredAt: at('2025-04-21', '00:00'), hasTime: false, agency: 'sps', recordedByName: name(colin), recordedByUserId: colin, eventType: 'legal.hearing', title: 'Parole Board for Scotland: release not directed', detail: 'The Parole Board considered release on licence and did not direct it. Release at the end of the custodial term, 21 Jul 2026, on licence for the extension period.', significance: 'moderate' });
  E({ occurredAt: at('2026-05-10', '14:00'), agency: 'sps', recordedByName: name(colin), recordedByUserId: colin, eventType: 'process.referral', title: 'MAPPA notification: pre-release from HMP Glenmoray', detail: 'Pre-release notification to the MAPPA Coordinator and police offender management ten weeks before the release date. Category 1. ViSOR reference supplied.', significance: 'high', significanceReason: 'Identification and notification (stage 1)' });
  E({ occurredAt: at('2026-06-02', '11:00'), agency: 'police', recordedByName: name(priya), recordedByUserId: priya, eventType: 'process.referral', title: 'Referred to MAPPA Level 2', detail: 'Referral to Level 2 informed by RM2000 (medium). Reason: accommodation and employment decisions in the first months after release need multi-agency management.', significance: 'high', significanceReason: 'Referral (stage 2)' });
  E({ occurredAt: at('2026-06-10', '14:00'), agency: 'social-work', recordedByName: name(helen), recordedByUserId: helen, eventType: 'social-work.assessment', title: 'LS/CMI completed: medium', detail: 'Pre-release LS/CMI by the supervising officer at HMP Glenmoray. Medium. Needs: employment, accommodation, alcohol use before the offence.', significance: 'moderate', evidenceRefs: [{ kind: 'record', ref: DEREK.lscmi, label: 'LS/CMI' }] });
  E({ occurredAt: at('2026-06-16', '09:00'), agency: 'social-work', recordedByName: name(ross), recordedByUserId: ross, eventType: 'sharing', title: 'Pre-meeting information requests sent to single points of contact', detail: 'Referral passed to police, justice social work, health, SPS and housing. Each asked to search records for Derek Muir, the victim and potential victims and to return by 7 Jul.', significance: 'moderate', significanceReason: 'Pre-meeting information sharing (stage 3)' });
  E({ occurredAt: at('2026-07-14', '10:00'), agency: 'police', recordedByName: name(priya), recordedByUserId: priya, eventType: 'process.mappa-level', title: 'Level 2 pre-release meeting: Level 2 confirmed, RMP agreed, review 6 Oct', detail: 'All five agencies attended. Level 2 decided. Risk Management Plan agreed. Release to supported accommodation at 40 Abbey Wynd. No MAPPA disclosure to the victim; VNS is the route.', significance: 'high', significanceReason: 'Level decision (stage 4)' });
  E({ occurredAt: at('2026-07-22', '09:30'), agency: 'sps', recordedByName: name(colin), recordedByUserId: colin, eventType: 'police.release', title: 'Released from HMP Glenmoray on licence', detail: 'Released at the end of the custodial term. Licence to 21 Jan 2028. Met at the gate by the supervising officer and taken to 40 Abbey Wynd.', significance: 'high', significanceReason: 'Release into the community' });
  E({ occurredAt: at('2026-07-22', '11:00'), agency: 'social-work', recordedByName: name(helen), recordedByUserId: helen, eventType: 'legal.licence', title: 'Licence conditions explained and signed; in force until 21 Jan 2028', detail: 'Five conditions: residence, no unsupervised contact with under-16s, exclusion zone, programme attendance, notification of relationships and employment. Derek signed and kept a copy.', significance: 'high', significanceReason: 'Controls in force' });
  E({ occurredAt: at('2026-07-22', '12:30'), agency: 'housing', recordedByName: name(mark), recordedByUserId: mark, eventType: 'move.address', title: 'Moved to 40 Abbey Wynd, Kilbrannan (supported accommodation)', detail: 'Placement started. Staff briefed on the residence condition and the contact for concerns.', significance: 'moderate' });
  E({ occurredAt: at('2026-07-23', '10:30'), agency: 'police', recordedByName: name(priya), recordedByUserId: priya, eventType: 'police.notification', title: 'Initial notification made under SONR at Kilbrannan Police Station', detail: 'Attended in person within three days of release. Address, bank account and passport details recorded. Photograph taken. Next annual notification due 23 Jul 2027.', significance: 'moderate', significanceReason: 'SONR compliant' });
  E({ occurredAt: at('2026-07-23', '14:00'), agency: 'social-work', recordedByName: name(helen), recordedByUserId: helen, eventType: 'social-work.contact', title: 'First supervision appointment', detail: 'Licence conditions reviewed. Weekly appointments for twelve weeks agreed. Benefits claim and GP registration started. Derek asked about work.', significance: 'moderate' });
  E({ occurredAt: at('2026-07-24', '19:15'), agency: 'police', recordedByName: name(priya), recordedByUserId: priya, eventType: 'other', title: 'Police home visit (announced)', detail: 'Seen at 40 Abbey Wynd. Room checked. No devices of concern. Staff report no issues.', significance: 'low' });
  E({ occurredAt: at('2026-08-07', '20:10'), agency: 'police', recordedByName: name(priya), recordedByUserId: priya, eventType: 'other', title: 'Police home visit (announced)', detail: 'Seen at the address. Reports attending supervision and looking for work. No concerns.', significance: 'low' });
  E({ occurredAt: at('2026-08-11', '10:00'), agency: 'social-work', recordedByName: name(helen), recordedByUserId: helen, eventType: 'care.service-start', title: 'Assessed for the community sex offender programme; group starts 15 Sep', detail: 'Programme assessment at Kilbrannan Justice Centre. Suitable for the community group. First session 15 Sep 2026.', significance: 'moderate' });
  E({ occurredAt: at('2026-08-14', '11:00'), agency: 'housing', recordedByName: name(mark), recordedByUserId: mark, eventType: 'other', title: 'Housing viewing: 6 Schoolhouse Loan, Braeside', detail: 'Ground-floor flat in a shared close viewed with the housing officer. Derek keen. Housing officer noted the primary school and a play park nearby and said an ERA is needed before any offer.', significance: 'moderate', significanceReason: 'Proposed move near a primary school' });
  E({ occurredAt: at('2026-08-18', '10:00'), agency: 'housing', recordedByName: name(mark), recordedByUserId: mark, eventType: 'other', title: 'Environmental Risk Assessment started for 6 Schoolhouse Loan', detail: 'Site visit with the sex offender liaison officer. Measured 180 metres from the property to the Ardvale Primary gate. Play park opposite. Two families with children in the block. Police input on routes and times requested.', significance: 'high', significanceReason: 'Accommodation decision pending' });
  E({ occurredAt: at('2026-08-20', '11:00'), agency: 'police', recordedByName: name(priya), recordedByUserId: priya, eventType: 'other', title: 'Stable and Acute 2007 completed: stable moderate, acute low', detail: 'Completed at a home visit. Stable factors moderate (employment, social influences). Acute factors low. No change to the level recommended.', significance: 'moderate', evidenceRefs: [{ kind: 'record', ref: DEREK.sa07, label: 'SA07' }] });
  E({ occurredAt: at('2026-08-20', '14:30'), agency: 'social-work', recordedByName: name(helen), recordedByUserId: helen, eventType: 'voice.adult', title: 'Derek\'s views recorded: wants work and to "keep my head down"', detail: 'Accepts the conditions and the exclusion zone. Asked whether the recycling yard job and the Braeside flat can go ahead.', significance: 'moderate' });
  E({ occurredAt: at('2026-08-25', '09:30'), agency: 'social-work', recordedByName: name(helen), recordedByUserId: helen, eventType: 'other', title: 'Employment offer: yard operative, Kilbrannan Vehicle Recycling Ltd', detail: 'Derek reported a job offer by phone the same morning, as his licence requires. Yard open to the public, Saturday work expected, proposed start 14 Sep. Told not to start until the disclosure decision is made.', significance: 'high', significanceReason: 'Employment needs a disclosure decision' });
  E({ occurredAt: at('2026-08-26', '10:00'), agency: 'police', recordedByName: name(priya), recordedByUserId: priya, eventType: 'disclosure', title: 'Disclosure to the prospective employer considered: decision pending', detail: 'Facts to disclose drafted: conviction and notification, licence condition on contact with children, points of contact. Rationale recorded. Decision due 9 Sep, before the start date.', significance: 'high', significanceReason: 'Disclosure decision' });
  E({ occurredAt: at('2026-08-28', '21:40'), agency: 'police', recordedByName: name(priya), recordedByUserId: priya, eventType: 'other', title: 'Police home visit (unannounced)', detail: 'Seen at the address at 21:40. Sober, alone. No concerns.', significance: 'low' });
  E({ occurredAt: at('2026-09-01', '09:00'), agency: 'social-work', recordedByName: name(ross), recordedByUserId: ross, eventType: 'sharing', title: 'Pre-meeting information requests sent for the 6 Oct review', detail: 'Requests to police, justice social work, health, housing and SPS. Return by 25 Sep.', significance: 'moderate' });

  // ----- Analysis: separate from the facts -----
  const eraEvents = ctx.data.events.filter((e) => e.subjectIds.includes(derek.id) && (e.title.startsWith('Housing viewing') || e.title.startsWith('Environmental Risk Assessment') || e.eventType === 'legal.licence')).map((e) => e.id);
  makeAnalysis(ctx, {
    id: 'ana_derek_1',
    subjectId: derek.id,
    processId: process.id,
    eventIds: eraEvents,
    authorUserId: priya,
    authorName: name(priya),
    agency: 'police',
    recordedAt: at('2026-08-26', '15:00'),
    kind: 'risk',
    title: 'Proposed move to 6 Schoolhouse Loan puts Derek 180 metres from Ardvale Primary',
    text: 'The flat is 180 metres from the school gate, faces a play park, and the Kilbrannan bus stop is outside the school, so Derek\'s travel to the recycling yard would overlap with the school run twice a day. The licence condition on unsupervised contact with children does not stop incidental daily proximity. Controls that could be considered: a condition on the times he leaves and returns, a different bus route, or a different property. This note is an input to the ERA and the review meeting, not a decision. Housing should receive the ERA conclusions and controls only.',
  });
}
