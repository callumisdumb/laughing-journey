import { describe, expect, it } from 'vitest';
import { STAGES_BY_PROCESS, type Agency, type ProcessType, type RoleId, type Stage } from '../enums';
import { OPENING_STAGE, buildOpeningProcess, openingClassification, type OpeningInput } from './open';
import type { AspProcess, AwiProcess, CpProcess, MappaProcess, MaracProcess, Process } from '../schemas/process';
import { processSchema } from '../schemas/process';
import { MEETING_TYPES_BY_PROCESS, TRANSITIONS, applyTransition, canRecordTransition, heldTransitionFor, heldTransitionsFor, reachableStages, scheduleRoute, transitionById, transitionsFrom, whatHappensNext, type PlanInput, type ScheduleInput, type TransitionContext } from './transitions';

/**
 * Every transition, driven: a permitted actor records it from the right stage on a record that
 * holds what it needs; a refused actor is named the roles that may; a record that lacks what the
 * transition needs is told what is missing and what creates it; and the record after the decision
 * carries the stage entry, the clocks and the follow-ons the table promises (D-211).
 */
const AT = '2026-09-02T09:00:00Z';
let counter = 0;
const ctxFor = (roleId: RoleId, agency: Agency = 'social-work', userId = `usr_${roleId}`): TransitionContext => ({ at: AT, actor: { userId, name: `Actor ${roleId}`, roleId, agency }, newId: (prefix) => `${prefix}_t${(counter += 1)}` });

function open(type: ProcessType, extra: Partial<OpeningInput> = {}, shell: Partial<Parameters<typeof buildOpeningProcess>[0]> = {}): Process {
  const input: OpeningInput = { type, subjectIds: ['per_subject'], at: AT, source: 'Referrer', sourceAgency: 'health', summary: 'A concern in enough words to pass validation.', byName: 'Opener', byUserId: 'usr_opener', ...extra };
  if (type === 'marac' && !input.marac) input.marac = { victimPersonId: 'per_subject', perpetratorPersonId: 'per_perp', childPersonIds: ['per_child'], riskAssessmentId: 'ra_daq', repeat: false, professionalJudgement: false };
  if (type === 'mappa' && !input.mappa) input.mappa = { category: 1, level: 1, leadResponsibleAuthority: 'police', visorReference: 'V1' };
  if (type === 'awi' && !input.awi) input.awi = { decisionInQuestion: 'Where to live' };
  return buildOpeningProcess(
    {
      id: `prc_${type}`,
      reference: `${type.toUpperCase()}-2026-9001`,
      title: `${type} case`,
      subjectIds: input.subjectIds,
      leadAgency: 'social-work',
      leadUserId: 'usr_lead',
      stage: OPENING_STAGE[type],
      stageHistory: [{ stage: OPENING_STAGE[type], at: AT, byName: 'Opener', byUserId: 'usr_opener' }],
      classification: openingClassification(type).classification,
      accessRestriction: openingClassification(type).restricted ? 'restricted' : 'none',
      members: [{ userId: 'usr_lead', caseRole: 'Lead', agency: 'social-work', since: '2026-09-01', reason: 'Lead' }],
      clocks: [],
      openedAt: AT,
      ...shell,
    },
    input,
  );
}

function at(process: Process, stage: Stage): Process {
  return { ...process, stage, stageHistory: [...process.stageHistory, { stage, at: AT, byName: 'Test' }] };
}

const schedule: ScheduleInput = { scheduledAt: '2026-09-15T10:00:00Z', location: 'Room 2', chairUserId: 'usr_chair', chairName: 'A Chair', minuteTakerUserId: 'usr_minutes', minuteTakerName: 'A Minute Taker', invitees: [{ userId: 'usr_sw', name: 'A Social Worker', agency: 'social-work', role: 'Social worker', reason: 'Allocated' }, { userId: 'usr_police', name: 'A Sergeant', agency: 'police', role: 'DS', reason: 'Investigation' }, { userId: 'usr_health', name: 'A Nurse', agency: 'health', role: 'Nurse', reason: 'Health' }] };
const plan: PlanInput = { title: 'Keeping safe', outcomes: ['Stays at home safely'], coordinatorUserId: 'usr_coord', coordinatorName: 'A Coordinator', reviewDate: '2026-12-01', actions: [{ title: 'Weekly visit', ownerUserId: 'usr_sw', ownerName: 'A Social Worker', ownerAgency: 'social-work', due: '2026-09-20' }] };

function record(process: Process, id: string, input: unknown, roleId: RoleId, agency: Agency = 'social-work') {
  const transition = transitionById(id)!;
  return applyTransition(process, transition, input, ctxFor(roleId, agency));
}

function ok(process: Process, id: string, input: unknown, roleId: RoleId, agency: Agency = 'social-work') {
  const result = record(process, id, input, roleId, agency);
  if (!result.ok) throw new Error(`${id} refused: ${result.errors.join(', ')}`);
  expect(() => processSchema.parse(result.outcome.process)).not.toThrow();
  return result.outcome;
}

describe('the registry', () => {
  it('names every transition once, with a from stage and a to stage the type has', () => {
    const ids = new Set<string>();
    for (const type of Object.keys(TRANSITIONS) as ProcessType[]) {
      for (const transition of TRANSITIONS[type]) {
        expect(ids.has(transition.id), transition.id).toBe(false);
        ids.add(transition.id);
        expect(transition.process).toBe(type);
        const stages = STAGES_BY_PROCESS[type] as readonly string[];
        for (const stage of [...transition.from, ...transition.to]) expect(stages, `${transition.id}: ${stage}`).toContain(stage);
        expect(transition.roles.length, transition.id).toBeGreaterThan(0);
      }
    }
    expect(ids.size).toBe(49);
  });
  it('reaches every stage of every type through some transition, so no stage needs a picker', () => {
    for (const type of Object.keys(TRANSITIONS) as ProcessType[]) {
      const reachable = new Set([OPENING_STAGE[type], ...reachableStages(type)]);
      for (const stage of STAGES_BY_PROCESS[type]) expect(reachable.has(stage), `${type}: ${stage}`).toBe(true);
    }
  });
  it('offers nothing on a closed case', () => {
    expect(transitionsFrom({ ...open('asp'), status: 'closed' })).toHaveLength(0);
  });
  it('refuses a transition from the wrong stage, the wrong type and an oversight role, each with its own code', () => {
    const asp = open('asp');
    expect(record(asp, 'asp-open-inquiry', {}, 'council-officer-asp').ok).toBe(false);
    expect((record(asp, 'asp-open-inquiry', {}, 'council-officer-asp') as { errors: string[] }).errors).toEqual(['transitionNotFromThisStage']);
    expect((record(asp, 'cp-convene-ird', {}, 'team-leader') as { errors: string[] }).errors).toEqual(['transitionWrongProcess']);
    const refused = record(asp, 'asp-screening-decision', {}, 'inspector') as { errors: string[]; permission?: { allowed: boolean; reason: string; route: string } };
    expect(refused.errors).toEqual(['transitionNotYourRole']);
    expect(refused.permission?.allowed).toBe(false);
    expect(refused.permission && !refused.permission.allowed ? refused.permission.route : '').toContain('Team leader');
  });
  it('whatHappensNext answers the four questions for each transition the stage carries', () => {
    const next = whatHappensNext(open('asp'), { roleId: 'team-leader' });
    expect(next.map((n) => n.transition.id)).toEqual(['asp-screening-decision', 'asp-close']);
    expect(next[0]?.permission.allowed).toBe(true);
    expect(next[0]?.leadsTo).toEqual(['Screening', 'Inquiry using investigatory powers']);
    const socialWorker = whatHappensNext(open('asp'), { roleId: 'social-worker-children' });
    expect(socialWorker[0]?.permission.allowed).toBe(false);
  });
});

describe('adult support and protection', () => {
  const tested = (process: AspProcess): AspProcess => ({ ...process, detail: { ...process.detail, threePointTest: { ...process.detail.threePointTest, outcome: 'met', a: { met: 'yes', reasoning: 'Adult at risk of harm' } } } });

  it('refuses a screening decision to proceed until the three-point test is recorded, and offers the test', () => {
    const result = record(open('asp'), 'asp-screening-decision', { outcome: 'proceed-to-inquiry', rationale: 'The concern is credible and recent.' }, 'team-leader');
    expect(result.ok).toBe(false);
    expect((result as { errors: string[] }).errors).toContain('threePointTestRequired');
  });
  it('moves a concern to screening on the team leader\'s decision and completes the inquiry decision clock', () => {
    const asp = tested({ ...(open('asp') as AspProcess), clocks: [{ id: 'clk_1', ruleId: 'asp.inquiry.decision', triggeredAt: AT }] });
    const out = ok(asp, 'asp-screening-decision', { outcome: 'proceed-to-inquiry', rationale: 'The concern is credible and recent.' }, 'team-leader');
    expect(out.to).toBe('screening');
    expect(out.process.stage).toBe('screening');
    expect(out.process.stageHistory.at(-1)).toMatchObject({ stage: 'screening', byUserId: 'usr_team-leader' });
    expect((out.process as AspProcess).detail.screening?.outcome).toBe('proceed-to-inquiry');
    expect(out.clocks.completes).toEqual(['asp.inquiry.decision']);
    expect(out.outbound).toBe('stage-change');
    expect(record(asp, 'asp-screening-decision', { outcome: 'proceed-to-inquiry', rationale: 'The concern is credible and recent.' }, 'council-officer-asp').ok).toBe(false);
  });
  it('no further action closes with an NMDS reason, and emergency action goes straight to investigation with the order dialog offered', () => {
    const asp = tested(open('asp') as AspProcess);
    const closed = ok(asp, 'asp-screening-decision', { outcome: 'no-further-asp-action', rationale: 'The adult is not at risk of harm on the facts.', closure: { reasonId: 'no-criteria-no-action', note: 'Does not meet the three-point criteria.' } }, 'team-leader');
    expect(closed.followOn).toEqual([{ kind: 'close', reasonId: 'no-criteria-no-action', note: 'Does not meet the three-point criteria.' }]);
    const emergency = ok(asp, 'asp-screening-decision', { outcome: 'emergency-action', rationale: 'Immediate risk of serious harm tonight.' }, 'team-leader');
    expect(emergency.to).toBe('investigation');
    expect((emergency.process as AspProcess).detail.investigation).toBeDefined();
    expect(emergency.followOn).toEqual([{ kind: 'offer', creates: { kind: 'dialog', dialog: 'protection-order' } }]);
  });
  it('opens the inquiry with agencies asked as information requests and a discussion offered', () => {
    const screened = ok(tested(open('asp') as AspProcess), 'asp-screening-decision', { outcome: 'proceed-to-inquiry', rationale: 'The concern is credible and recent.' }, 'team-leader').process;
    const out = ok(screened, 'asp-open-inquiry', { agenciesToContact: ['health', 'police'], interAgencyDiscussion: true, purpose: 'Inquiry under section 4 into the concern.' }, 'council-officer-asp');
    expect(out.to).toBe('inquiry');
    expect(out.followOn[0]).toMatchObject({ kind: 'requests', agencies: ['health', 'police'] });
    expect(out.followOn[1]).toMatchObject({ kind: 'offer', creates: { kind: 'dialog', dialog: 'schedule-meeting', meetingType: 'asp-inter-agency-discussion' } });
    const notProceed = at(tested(open('asp') as AspProcess), 'screening');
    expect((record(notProceed, 'asp-open-inquiry', { agenciesToContact: ['health'], interAgencyDiscussion: false, purpose: 'Inquiry under section 4.' }, 'council-officer-asp') as { missing: Array<{ code: string }> }).missing[0]?.code).toBe('screeningNotProceed');
  });
  it('records the inquiry outcome: proceed needs consent, capacity, undue pressure and advocacy; support only opens the support plan', () => {
    const inquiry = ok(ok(tested(open('asp') as AspProcess), 'asp-screening-decision', { outcome: 'proceed-to-inquiry', rationale: 'The concern is credible and recent.' }, 'team-leader').process, 'asp-open-inquiry', { agenciesToContact: ['health'], interAgencyDiscussion: false, purpose: 'Inquiry under section 4 into the concern.' }, 'council-officer-asp').process;
    const refused = record(inquiry, 'asp-inquiry-outcome', { outcome: 'proceed-to-investigation', action: 'criteria-ongoing', rationale: 'Harm is continuing and the adult cannot protect herself.' }, 'council-officer-asp');
    expect((refused as { errors: string[] }).errors).toEqual(expect.arrayContaining(['consentRequired', 'capacityRequired', 'unduePressureRequired', 'advocacyRequired']));
    const proceed = ok(inquiry, 'asp-inquiry-outcome', { outcome: 'proceed-to-investigation', action: 'criteria-ongoing', rationale: 'Harm is continuing and the adult cannot protect herself.', consent: { status: 'sought-and-given', note: 'Agreed on the 2nd' }, capacity: { assessed: true, summary: 'Has capacity for this decision' }, unduePressure: { considered: true, found: true, reasoning: 'Nephew controls the money' }, advocacy: { offered: true, accepted: true } }, 'council-officer-asp');
    expect(proceed.to).toBe('investigation');
    expect((proceed.process as AspProcess).detail.investigation?.unduePressure.found).toBe(true);
    const support = ok(inquiry, 'asp-inquiry-outcome', { outcome: 'support-only', action: 'no-criteria-support', rationale: 'Support meets the need without protection.' }, 'council-officer-asp');
    expect(support.to).toBe('support-plan');
    expect(support.followOn).toEqual([{ kind: 'offer', creates: { kind: 'dialog', dialog: 'plan', planType: 'adult-support' } }]);
    const none = ok(inquiry, 'asp-inquiry-outcome', { outcome: 'no-further-action', action: 'no-criteria-no-action', rationale: 'The three-point criteria are not met.' }, 'council-officer-asp');
    expect(none.followOn[0]).toMatchObject({ kind: 'close', reasonId: 'no-criteria-no-action' });
    expect(record(inquiry, 'asp-inquiry-outcome', { outcome: 'support-only', action: 'no-criteria-support', rationale: 'Support meets the need.' }, 'team-leader').ok).toBe(false);
  });
  it('records investigatory steps repeatably, and a section 10 request goes to the record holder', () => {
    const investigation = ok(tested(open('asp') as AspProcess), 'asp-screening-decision', { outcome: 'emergency-action', rationale: 'Immediate risk of serious harm tonight.' }, 'team-leader').process;
    const visit = ok(investigation, 'asp-investigatory-step', { power: 's7', attended: ['Moira Gilmour', 'PC Reid'], adultPresent: true, note: 'Visited at home; the adult spoke freely.' }, 'council-officer-asp');
    expect(visit.to).toBe('investigation');
    expect((visit.process as AspProcess).detail.investigation?.visits).toHaveLength(1);
    expect(visit.outbound).toBeNull();
    const records = ok(visit.process, 'asp-investigatory-step', { power: 's10', holder: 'Clydeshore Bank', holderAgency: 'police', records: ['Statements for June to August'], lawfulBasis: 'Section 10 of the 2007 Act' }, 'council-officer-asp');
    expect(records.followOn[0]).toMatchObject({ kind: 'requests', agencies: ['police'] });
    expect((records.process as AspProcess).detail.investigation?.recordsRequests).toHaveLength(1);
  });
  it('schedules the case conference, holds it as the chair, and records the plan that starts the review clock', () => {
    const investigation = ok(tested(open('asp') as AspProcess), 'asp-screening-decision', { outcome: 'emergency-action', rationale: 'Immediate risk of serious harm tonight.' }, 'team-leader').process;
    const scheduled = ok(investigation, 'asp-schedule-case-conference', schedule, 'council-officer-asp');
    expect(scheduled.followOn[0]).toMatchObject({ kind: 'meeting', meeting: { type: 'asp-case-conference', status: 'scheduled' } });
    expect(scheduled.addMembers.map((m) => m.userId)).toEqual(['usr_chair', 'usr_minutes']);
    const held = ok(scheduled.process, 'asp-case-conference-held', { meetingId: 'mtg_x', adultAtRisk: true, protectionPlanNeeded: true, rationale: 'The conference agreed the adult is at risk.' }, 'chair');
    expect(held.to).toBe('case-conference');
    expect(held.clocks.completes).toEqual(['asp.caseconference.initial']);
    expect(held.eventType).toBe('process.case-conference');
    expect(record(scheduled.process, 'asp-case-conference-held', { meetingId: 'mtg_x', adultAtRisk: true, protectionPlanNeeded: true, rationale: 'The conference agreed.' }, 'gp', 'health').ok).toBe(false);
    const planned = ok(held.process, 'asp-record-protection-plan', plan, 'chair');
    expect(planned.to).toBe('protection-plan');
    expect(planned.clocks.starts).toEqual([{ ruleId: 'asp.plan.review', ownerUserId: 'usr_coord' }]);
    expect(planned.followOn[0]).toMatchObject({ kind: 'plan', plan: { type: 'adult-protection' } });
    expect((planned.followOn[0] as { actions: unknown[] }).actions).toHaveLength(1);
    expect((planned.process as AspProcess).detail.planId).toBeDefined();
    expect((record(held.process, 'asp-record-protection-plan', { ...plan, reviewDate: undefined }, 'chair') as { errors: string[] }).errors).toContain('reviewDateRequired');
    const support = ok(held.process, 'asp-record-support-plan', { ...plan, consentNote: 'Marion agreed to the support plan on the 2nd.' }, 'council-officer-asp');
    expect(support.to).toBe('support-plan');
  });
  it('reviews: continue restarts the review clock with the new date, close runs the closure', () => {
    const planned = ok(ok(ok(tested(open('asp') as AspProcess), 'asp-screening-decision', { outcome: 'emergency-action', rationale: 'Immediate risk of serious harm tonight.' }, 'team-leader').process, 'asp-case-conference-held', { meetingId: 'mtg_x', adultAtRisk: true, protectionPlanNeeded: true, rationale: 'The conference agreed the adult is at risk.' }, 'chair').process, 'asp-record-protection-plan', plan, 'chair').process;
    const review = ok(planned, 'asp-schedule-review', schedule, 'council-officer-asp');
    expect(review.followOn[0]).toMatchObject({ kind: 'meeting', meeting: { type: 'asp-review-conference' } });
    const cont = ok(planned, 'asp-review-outcome', { decision: 'continue', newReviewDate: '2027-03-01', rationale: 'The plan is working and stays in place.' }, 'chair');
    expect(cont.to).toBe('review');
    expect(cont.clocks).toMatchObject({ completes: ['asp.plan.review'], starts: [{ ruleId: 'asp.plan.review' }] });
    expect(cont.followOn[0]).toMatchObject({ kind: 'plan-review', reviewDate: '2027-03-01' });
    const close = ok(cont.process, 'asp-review-outcome', { decision: 'close', rationale: 'Risk has reduced and the adult wants to end involvement.', closure: { reasonId: 'criteria-support', note: 'Support continues without protection.' } }, 'chair');
    expect(close.followOn[0]).toMatchObject({ kind: 'close', reasonId: 'criteria-support' });
    const closeAny = ok(cont.process, 'asp-close', { reasonId: 'criteria-support', note: 'Support continues without protection.' }, 'council-officer-asp');
    expect(closeAny.to).toBe('closed');
  });
});

describe('child protection', () => {
  const ird = { significantHarm: { decided: true, decision: 'Significant harm likely', rationale: 'Injuries not consistent with the account.' }, investigationNeeded: { decided: true, decision: 'Investigate', rationale: 'Joint investigation needed to establish the facts.' }, jii: { decided: true, decision: 'JII', rationale: 'The child can give an account.', plannerName: 'DS Mackay' }, medical: { decided: true, decision: 'JPFE', rationale: 'Physical injuries need forensic examination.', kind: 'jpfe' as const }, emergencyMeasures: { decided: false, decision: 'None', rationale: 'The child is safe with the grandmother tonight.', measure: 'none' as const }, reporterReferral: { decided: true, decision: 'Refer', rationale: 'Compulsory measures may be needed.' }, parentsInformed: { decided: false, decision: 'Withhold', rationale: 'Telling the parents now would compromise the investigation.', withheld: 'Criminal investigation' }, childViewsSought: 'Spoken to at school with the teacher present.', siblingsConsidered: ['per_sibling'], contributions: [{ agency: 'police' as const, byName: 'DS Mackay', summary: 'Two prior domestic calls.' }, { agency: 'health' as const, byName: 'Dr Farouk', summary: 'Missed two appointments.' }] };

  it('convenes the IRD as a tripartite meeting and moves to ird', () => {
    const cp = open('cp');
    const out = ok(cp, 'cp-convene-ird', { ...schedule, outOfHours: false }, 'social-worker-children');
    expect(out.to).toBe('ird');
    expect(out.followOn[0]).toMatchObject({ kind: 'meeting', meeting: { type: 'ird' } });
    expect((out.process as CpProcess).detail.ird?.participants).toHaveLength(3);
    const twoAgencies = { ...schedule, outOfHours: true, invitees: schedule.invitees.slice(0, 2) };
    expect((record(cp, 'cp-convene-ird', twoAgencies, 'social-worker-children') as { errors: string[] }).errors).toContain('irdTripartiteRequired');
  });
  it('records IRD decisions: investigate starts the CPPM clock and an interim safety plan reaches its owners; no investigation names a route', () => {
    const convened = ok(open('cp'), 'cp-convene-ird', { ...schedule, outOfHours: false }, 'social-worker-children').process;
    const out = ok(convened, 'cp-ird-decisions', { ...ird, interimSafetyPlan: { ...plan, title: 'Interim safety' } }, 'team-leader');
    expect(out.to).toBe('investigation');
    expect(out.clocks.starts).toEqual([{ ruleId: 'cp.cppm.initial' }]);
    expect((out.process as CpProcess).detail.proceduresInitiatedAt).toBe(AT);
    expect((out.process as CpProcess).detail.ird?.decisions.parentsInformed.withheld).toBe('Criminal investigation');
    expect(out.followOn[0]).toMatchObject({ kind: 'plan', plan: { type: 'interim-safety' } });
    const none = ok(convened, 'cp-ird-decisions', { ...ird, investigationNeeded: { decided: false, decision: 'No investigation', rationale: 'The account is consistent and the injury explained.' }, noInvestigation: { route: 'single-agency', reason: 'Health to follow up the missed appointments.' } }, 'team-leader');
    expect(none.to).toBe('ird');
    expect(none.followOn[0]).toMatchObject({ kind: 'offer', creates: { kind: 'dialog', dialog: 'close' } });
    expect((record(convened, 'cp-ird-decisions', { ...ird, investigationNeeded: { decided: false, decision: 'No', rationale: 'The account is consistent and explained.' } }, 'team-leader') as { errors: string[] }).errors).toContain('noInvestigationRouteRequired');
  });
  it('records the JII and the medical, schedules the CPPM with the notice clock counting back, and holds it', () => {
    const investigation = ok(ok(open('cp'), 'cp-convene-ird', { ...schedule, outOfHours: false }, 'social-worker-children').process, 'cp-ird-decisions', ird, 'team-leader').process;
    const jii = ok(investigation, 'cp-record-jii', { heldAt: '2026-09-04T10:00:00Z', summary: 'The child described what happened on Saturday.' }, 'detective-sergeant-ppu', 'police');
    expect((jii.process as CpProcess).detail.investigation?.jiiModel).toBe('SCIM');
    const medical = ok(jii.process, 'cp-record-medical', { heldAt: '2026-09-04T14:00:00Z', kind: 'jpfe', summary: 'Bruising consistent with gripping.' }, 'cp-nurse-adviser', 'health');
    const cppm = ok(medical.process, 'cp-schedule-cppm', { ...schedule, parents: 'invited', childInvited: false }, 'social-worker-children');
    expect(cppm.clocks.starts).toEqual([{ ruleId: 'cp.cppm.notice', triggeredAt: schedule.scheduledAt }]);
    expect((cppm.process as CpProcess).detail.cppm?.decision).toBe('pending');
    expect((record(medical.process, 'cp-schedule-cppm', { ...schedule, parents: 'excluded', childInvited: false }, 'social-worker-children') as { errors: string[] }).errors).toContain('parentsExcludedReasonRequired');
    const inquorate = ok(cppm.process, 'cp-cppm-held', { meetingId: 'mtg_c', quorate: false, decision: 'register', concerns: [], rationale: '', coreGroupMemberUserIds: [] }, 'chair');
    expect(inquorate.to).toBe('investigation');
    expect(inquorate.clocks.starts).toEqual([{ ruleId: 'cp.cppm.inquorate.reconvene' }]);
    expect(inquorate.followOn[0]).toMatchObject({ kind: 'reschedule', meetingId: 'mtg_c' });
    const registered = ok(cppm.process, 'cp-cppm-held', { meetingId: 'mtg_c', quorate: true, decision: 'register', concerns: ['physical-abuse', 'domestic-abuse'], rationale: 'The meeting agreed the child is at risk of significant harm.', coreGroupMemberUserIds: ['usr_sw', 'usr_health'], leadProfessionalUserId: 'usr_sw', plan: { ...plan, title: "Child's plan" } }, 'chair');
    expect(registered.to).toBe('childs-plan');
    expect(registered.process.stageHistory.map((h) => h.stage).slice(-2)).toEqual(['cppm', 'childs-plan']);
    expect((registered.process as CpProcess).detail.register?.concerns).toEqual(['physical-abuse', 'domestic-abuse']);
    expect(registered.clocks.completes).toEqual(['cp.cppm.initial', 'cp.cppm.notice', 'cp.cppm.inquorate.reconvene']);
    expect(registered.clocks.starts.map((s) => s.ruleId)).toEqual(['cp.coregroup.first', 'cp.cppm.review.first', 'cp.cppm.record.distribute']);
    expect(registered.eventType).toBe('process.registration');
    expect(registered.addMembers[0]?.userId).toBe('usr_sw');
    const notRegistered = ok(cppm.process, 'cp-cppm-held', { meetingId: 'mtg_c', quorate: true, decision: 'not-register', concerns: [], rationale: 'The risk can be managed without registration.', coreGroupMemberUserIds: [] }, 'chair');
    expect(notRegistered.to).toBe('cppm');
    expect(record(cppm.process, 'cp-cppm-held', { meetingId: 'mtg_c', quorate: true, decision: 'not-register', concerns: [], rationale: 'Manageable.', coreGroupMemberUserIds: [] }, 'social-worker-children').ok).toBe(false);
  });
  it('core group meetings complete the first-meeting clock and a significant change escalates to the lead professional', () => {
    const registered = ok(ok(ok(ok(open('cp'), 'cp-convene-ird', { ...schedule, outOfHours: false }, 'social-worker-children').process, 'cp-ird-decisions', ird, 'team-leader').process, 'cp-schedule-cppm', { ...schedule, parents: 'invited', childInvited: false }, 'social-worker-children').process, 'cp-cppm-held', { meetingId: 'mtg_c', quorate: true, decision: 'register', concerns: ['neglect'], rationale: 'The meeting agreed the child is at risk of significant harm.', coreGroupMemberUserIds: ['usr_sw'], leadProfessionalUserId: 'usr_sw', plan }, 'chair').process;
    const first = ok(registered, 'cp-core-group-meeting', { heldAt: '2026-09-20T10:00:00Z', attendance: [{ userId: 'usr_sw', name: 'A Social Worker', present: true }], progress: 'The plan is being followed and school attendance is up.', significantChange: false }, 'health-visitor', 'health');
    expect(first.clocks.completes).toEqual(['cp.coregroup.first']);
    expect(first.clocks.starts).toEqual([]);
    const change = ok(first.process, 'cp-core-group-meeting', { heldAt: '2026-10-04T10:00:00Z', attendance: [{ name: 'A Social Worker', present: true }], progress: 'The father has returned to the household.', significantChange: true, changeNote: 'The father has returned against the plan.' }, 'social-worker-children');
    expect(change.clocks.completes).toEqual([]);
    expect(change.clocks.starts).toEqual([{ ruleId: 'cp.coregroup.escalate', ownerUserId: 'usr_sw' }]);
    expect((change.process as CpProcess).detail.coreGroup?.meetings).toHaveLength(2);
    const review = ok(change.process, 'cp-schedule-review-cppm', { ...schedule, parents: 'invited', childInvited: true }, 'team-leader');
    expect(review.followOn[0]).toMatchObject({ kind: 'meeting', meeting: { type: 'cppm-review' } });
    const cont = ok(review.process, 'cp-review-cppm-held', { meetingId: 'mtg_r', quorate: true, decision: 'continue', rationale: 'Registration continues while the plan beds in.' }, 'chair');
    expect(cont.to).toBe('review');
    expect(cont.clocks.starts.map((s) => s.ruleId)).toEqual(['cp.cppm.review.subsequent', 'cp.cppm.record.distribute']);
    const dereg = ok(cont.process, 'cp-review-cppm-held', { meetingId: 'mtg_r2', quorate: true, decision: 'deregister', rationale: 'The risk has reduced and the home situation has improved.', deregistration: { reason: 'improved-home-situation', note: 'Home situation improved.' } }, 'chair');
    expect(dereg.followOn[0]).toMatchObject({ kind: 'offer', creates: { kind: 'transition', transition: 'cp-deregister' } });
    const done = ok(dereg.process, 'cp-deregister', { reason: 'improved-home-situation', note: 'The home situation has improved and the plan has run its course.' }, 'chair');
    expect(done.to).toBe('deregistered');
    expect(done.eventType).toBe('process.deregistration');
    expect(done.followOn[0]).toMatchObject({ kind: 'close', reasonId: 'improved-home-situation' });
    expect((done.process as CpProcess).detail.register?.deregistrationReason).toBe('improved-home-situation');
  });
  it('pre-birth: the same engine with its own clocks, and the birth swaps them for the child protection clocks', () => {
    const unborn = open('cp', { preBirth: { expectedDeliveryDate: '2026-11-01', motherPersonId: 'per_mother' } }, { clocks: [{ id: 'clk_pb', ruleId: 'cp.prebirth.cppm', triggeredAt: AT }] }) as CpProcess;
    expect(record(open('cp'), 'cp-birth', { bornAt: '2026-10-28T03:00:00Z' }, 'midwife', 'health').ok).toBe(false);
    const born = ok(unborn, 'cp-birth', { bornAt: '2026-10-28T03:00:00Z' }, 'midwife', 'health');
    expect(born.clocks).toMatchObject({ completes: ['cp.prebirth.cppm'], starts: [{ ruleId: 'cp.cppm.initial', triggeredAt: '2026-10-28T03:00:00Z' }] });
    expect(born.followOn[0]).toMatchObject({ kind: 'birth', personId: 'per_subject' });
    expect(born.eventType).toBe('family.birth');
    expect((born.process as CpProcess).detail.preBirth).toBeUndefined();
    const investigation = ok(ok(unborn, 'cp-convene-ird', { ...schedule, outOfHours: false }, 'social-worker-children').process, 'cp-ird-decisions', ird, 'team-leader');
    expect(investigation.clocks.starts).toEqual([]);
    const cppm = ok(investigation.process, 'cp-schedule-cppm', { ...schedule, parents: 'invited', childInvited: false }, 'social-worker-children');
    expect(cppm.followOn[0]).toMatchObject({ kind: 'meeting', meeting: { type: 'pre-birth-cppm' } });
    const registered = ok(cppm.process, 'cp-cppm-held', { meetingId: 'mtg_c', quorate: true, decision: 'register', concerns: ['parental-substance-use'], rationale: 'The meeting agreed the unborn child will be at risk.', coreGroupMemberUserIds: ['usr_sw'], leadProfessionalUserId: 'usr_sw', plan }, 'chair');
    expect(registered.clocks.completes).toContain('cp.prebirth.cppm');
    expect(registered.clocks.starts.map((s) => s.ruleId)).toContain('cp.prebirth.review');
  });
});

describe('MARAC', () => {
  it('schedules the meeting first, because the research counts back from it', () => {
    const marac = open('marac');
    const refused = record(marac, 'marac-send-research-requests', { agencies: ['health'], wording: 'MARAC case list wording for the meeting on the 15th.', dueAt: '2026-09-12' }, 'marac-coordinator');
    expect((refused as { missing: Array<{ code: string; creates?: unknown }> }).missing[0]).toMatchObject({ code: 'maracMeetingRequired', creates: { kind: 'transition', transition: 'marac-schedule-meeting' } });
    const scheduled = ok(marac, 'marac-schedule-meeting', schedule, 'marac-coordinator');
    expect((scheduled.process as MaracProcess).detail.meetingId).toBeDefined();
    const sent = ok(scheduled.process, 'marac-send-research-requests', { agencies: ['health', 'housing'], wording: 'MARAC case list wording for the meeting on the 15th.', dueAt: '2026-09-12' }, 'marac-coordinator');
    expect(sent.to).toBe('research');
    expect((sent.process as MaracProcess).detail.researchRequests).toHaveLength(2);
    expect(sent.followOn[0]).toMatchObject({ kind: 'requests', agencies: ['health', 'housing'], dueAt: '2026-09-12' });
    expect(sent.clocks.starts[0]?.ruleId).toBe('marac.research.return');
    expect(record(scheduled.process, 'marac-send-research-requests', { agencies: ['health'], wording: 'Wording in enough words.', dueAt: '2026-09-12' }, 'idaa', 'third-sector').ok).toBe(false);
  });
  it('each agency records its own return with the proportionality confirmation, and the last return completes the clock', () => {
    const sent = ok(ok(open('marac'), 'marac-schedule-meeting', schedule, 'marac-coordinator').process, 'marac-send-research-requests', { agencies: ['health', 'housing'], wording: 'MARAC case list wording for the meeting on the 15th.', dueAt: '2026-09-12' }, 'marac-coordinator').process as MaracProcess;
    const [health, housing] = sent.detail.researchRequests;
    expect((record(sent, 'marac-record-research-return', { requestId: health!.id, summary: 'Attended A&E twice in June.', nothingKnown: false, relevantNecessaryProportionate: false }, 'gp', 'health') as { errors: string[] }).errors).toContain('proportionalityRequired');
    const first = ok(sent, 'marac-record-research-return', { requestId: health!.id, summary: 'Attended A&E twice in June with injuries.', nothingKnown: false, relevantNecessaryProportionate: true }, 'gp', 'health');
    expect(first.clocks.completes).toEqual([]);
    expect(first.followOn[0]).toMatchObject({ kind: 'request-response', requestId: health!.id });
    expect(first.addMembers[0]).toMatchObject({ userId: 'usr_gp', agency: 'health' });
    const second = ok(first.process, 'marac-record-research-return', { requestId: housing!.id, summary: '', nothingKnown: true, relevantNecessaryProportionate: true }, 'housing-officer', 'housing');
    expect(second.clocks.completes).toEqual(['marac.research.return']);
    expect((second.process as MaracProcess).detail.researchRequests.map((r) => r.status)).toEqual(['returned', 'nothing-known']);
  });
  it('is heard, records the plan with flags and MATAC and DSDAS considered, links a child concern, takes feedback, and closes or transfers', () => {
    const sent = ok(ok(open('marac'), 'marac-schedule-meeting', schedule, 'marac-coordinator').process, 'marac-send-research-requests', { agencies: ['health'], wording: 'MARAC case list wording for the meeting on the 15th.', dueAt: '2026-09-12' }, 'marac-coordinator').process;
    const heard = ok(sent, 'marac-heard', { meetingId: 'mtg_m', informationShared: [{ agency: 'police', summary: 'Three calls in a year.' }], riskDiscussion: 'High risk; the perpetrator has breached bail.' }, 'marac-coordinator');
    expect(heard.to).toBe('meeting');
    expect(heard.clocks).toMatchObject({ completes: ['marac.research.return'], starts: [{ ruleId: 'marac.repeat.window' }] });
    expect(heard.eventType).toBe('process.marac');
    const refused = record(heard.process, 'marac-record-action-plan', { plan, flags: [], matac: { considered: false }, dsdas: { considered: true }, flagExpiresAt: '2027-09-15' }, 'marac-coordinator');
    expect((refused as { errors: string[] }).errors).toContain('matacRequired');
    const planned = ok(heard.process, 'marac-record-action-plan', { plan, flags: [{ agency: 'health', system: 'EMIS', receiptRef: 'F1' }, { agency: 'housing', system: 'Housing', receiptRef: 'F2' }], matac: { considered: true, referred: true }, dsdas: { considered: true, note: 'Right to know considered for the new partner.' }, flagExpiresAt: '2027-09-15' }, 'marac-coordinator');
    expect(planned.to).toBe('action-plan');
    expect((planned.process as MaracProcess).detail.flags).toHaveLength(2);
    expect((planned.process as MaracProcess).detail.links.matacReferredAt).toBe('2026-09-02');
    expect(planned.clocks.starts).toEqual([{ ruleId: 'marac.flag.expiry' }]);
    const linked = ok(planned.process, 'marac-link-cp-concern', { childPersonIds: ['per_child'], summary: 'The child witnessed the assault and is frightened.' }, 'marac-coordinator');
    expect(linked.followOn[0]).toMatchObject({ kind: 'open-process', type: 'cp', subjectIds: ['per_child'] });
    expect((linked.process as MaracProcess).detail.referral.childPersonIds).toEqual(['per_child']);
    const another = ok(planned.process, 'marac-link-cp-concern', { childPersonIds: ['per_other'], summary: 'A child the meeting learned of, not on the referral.' }, 'marac-coordinator');
    expect((another.process as MaracProcess).detail.referral.childPersonIds).toEqual(['per_child', 'per_other']);
    expect((another.process as MaracProcess).detail.safeLivesReturn.childrenCount).toBe(2);
    expect((record(planned.process, 'marac-link-cp-concern', { childPersonIds: [], summary: 'No child named.' }, 'marac-coordinator') as { errors: string[] }).errors).toContain('childRequired');
    const feedback = ok(planned.process, 'marac-idaa-feedback', { summary: 'The victim has moved and feels safer.', victimResponse: 'Relieved.' }, 'idaa', 'third-sector');
    expect(feedback.to).toBe('feedback');
    const closed = ok(feedback.process, 'marac-close', { reasonId: 'risk-reduced', note: 'Risk reduced after the perpetrator was remanded.' }, 'marac-coordinator');
    expect(closed.followOn[0]).toMatchObject({ kind: 'close', reasonId: 'risk-reduced' });
    const transferred = ok(feedback.process, 'marac-transfer', { toArea: 'Lanarkshire', receivingCoordinator: 'J Smith' }, 'marac-coordinator');
    expect(transferred.process.status).toBe('transferred');
    expect(transferred.to).toBe('transferred');
  });
});

describe('MAPPA', () => {
  it('a level 1 case sits at notification and needs a risk assessment before a referral up', () => {
    const mappa = open('mappa');
    expect(whatHappensNext(mappa, { roleId: 'mappa-coordinator' }).map((n) => n.transition.id)).toEqual(['mappa-refer-level', 'mappa-record-disclosure', 'mappa-exit']);
    const refused = record(mappa, 'mappa-refer-level', { level: 2, reason: 'Escalating risk to a known victim.', riskAssessmentId: 'ra_1', referringAuthority: 'police' }, 'offender-management', 'police');
    expect((refused as { missing: Array<{ code: string }> }).missing[0]?.code).toBe('riskAssessmentRequired');
    const assessed = { ...mappa, riskAssessmentIds: ['ra_1'] } as MappaProcess;
    const referred = ok(assessed, 'mappa-refer-level', { level: 2, reason: 'Escalating risk to a known victim.', riskAssessmentId: 'ra_1', referringAuthority: 'police', category: 2, visorReference: 'V-2026-0417', imminentRisk: true, victimConsiderations: 'The victim has been offered the notification scheme.', mustNotReceive: [{ name: 'Kevin Muir', party: 'perpetrator-associates', relationship: "the subject's brother", reason: 'Would tell him.' }], via: 'the MAPPA referral' }, 'offender-management', 'police');
    expect(referred.to).toBe('referral');
    expect((referred.process as MappaProcess).detail.referral).toMatchObject({ riskAssessmentIds: ['ra_1'], levelSought: 2, imminentRisk: true });
    expect((referred.process as MappaProcess).detail).toMatchObject({ category: 2, visorReference: 'V-2026-0417', level: 1 });
    expect(referred.process.parties.some((p) => p.name === 'Kevin Muir' && p.party === 'perpetrator-associates')).toBe(true);
    expect(record(assessed, 'mappa-refer-level', { level: 2, reason: 'Escalating risk.', riskAssessmentId: 'ra_1', referringAuthority: 'police' }, 'housing-officer', 'housing').ok).toBe(false);
  });
  it('requests returns, records them per agency, schedules and holds the meeting, and exits', () => {
    const referred = ok({ ...open('mappa'), riskAssessmentIds: ['ra_1'] }, 'mappa-refer-level', { level: 2, reason: 'Escalating risk to a known victim.', riskAssessmentId: 'ra_1', referringAuthority: 'police' }, 'offender-management', 'police').process;
    const asked = ok(referred, 'mappa-request-returns', { agencies: [{ agency: 'housing', contact: 'M Hepburn' }, { agency: 'health', contact: 'Dr Farouk' }], dueAt: '2026-09-10' }, 'mappa-coordinator');
    expect(asked.to).toBe('pre-meeting');
    expect(asked.followOn[0]).toMatchObject({ kind: 'requests', agencies: ['housing', 'health'] });
    const back = ok(asked.process, 'mappa-record-return', { agency: 'housing', summary: 'Tenancy stable; no complaints.', nothingKnown: false, requestId: 'req_h' }, 'housing-officer', 'housing');
    expect((back.process as MappaProcess).detail.preMeetingReturns.map((r) => r.status)).toEqual(['returned', 'requested']);
    expect(back.followOn[0]).toMatchObject({ kind: 'request-response', requestId: 'req_h', nothingKnown: false });
    const meeting = ok(back.process, 'mappa-schedule-meeting', schedule, 'mappa-coordinator');
    expect(meeting.to).toBe('meeting');
    expect(meeting.followOn[0]).toMatchObject({ kind: 'meeting', meeting: { type: 'mappa-level2' } });
    const held = ok(meeting.process, 'mappa-meeting-held', { meetingId: 'mtg_p', level: 2, levelReason: 'Level 2 management is proportionate to the risk.', rmp: { plan: { ...plan, title: 'Risk management plan' }, triggers: ['Alcohol'], contingencies: ['Recall'], controls: ['Curfew'], victimSafety: 'Victim aware', accommodation: 'Stable', employment: 'None', associates: 'Monitored' }, victimConsiderations: 'The victim has been offered the notification scheme.', reviewDate: '2026-12-02' }, 'chair');
    expect(held.to).toBe('managed');
    expect(held.clocks).toMatchObject({ completes: ['mappa.level2.review', 'mappa.level3.review'], starts: [{ ruleId: 'mappa.level2.review' }] });
    expect((held.process as MappaProcess).detail.rmp?.reviewedAt).toBe('2026-09-02');
    expect((held.process as MappaProcess).detail.levelHistory.at(-1)?.level).toBe(2);
    expect(held.eventType).toBe('process.mappa-level');
    const disclosure = ok(held.process, 'mappa-record-disclosure', {}, 'mappa-coordinator');
    expect(disclosure.followOn[0]).toMatchObject({ kind: 'offer', creates: { kind: 'dialog', dialog: 'disclosure' } });
    const review = ok(held.process, 'mappa-request-returns', { agencies: [{ agency: 'health', contact: 'Dr Farouk' }], dueAt: '2026-11-20' }, 'mappa-coordinator');
    expect(review.to).toBe('pre-meeting');
    const exit = ok(held.process, 'mappa-exit', { kind: 'level-down', note: 'Risk reduced to level 1 management.' }, 'mappa-coordinator');
    expect(exit.to).toBe('exit');
    expect(exit.followOn[0]).toMatchObject({ kind: 'close', reasonId: 'level-down' });
    expect((record(held.process, 'mappa-exit', { kind: 'transfer', note: 'Moving to another area for good.' }, 'mappa-coordinator') as { errors: string[] }).errors).toContain('areaRequired');
  });
});

describe('adults with incapacity', () => {
  const powers = { reference: 'OPG-1', powerOfAttorney: { exists: false }, guardianship: { exists: false } };
  const assessed = (process: AwiProcess): AwiProcess => ({ ...process, detail: { ...process.detail, capacityAssessments: [{ id: 'ca_1', decision: 'Where to live', assessedAt: AT, assessorName: 'Dr Farouk', assessorRole: 'GP', outcome: 'lacks-capacity', evidence: 'Cannot retain the information.' }] } });
  it('checks existing powers, then decides the route with will and preferences, and needs a capacity assessment first', () => {
    const awi = open('awi') as AwiProcess;
    const checked = ok(awi, 'awi-check-existing-powers', powers, 'social-worker-adults');
    expect(checked.to).toBe('existing-powers');
    expect((checked.process as AwiProcess).detail.opgResult?.reference).toBe('OPG-1');
    const refused = record(checked.process, 'awi-route-decision', { route: 'guardianship-welfare', rationale: 'A welfare guardian is needed for decisions about care.', willAndPreferences: { pastWishes: 'Wanted to stay at home', presentWishes: 'Wants to stay at home', communicationMethod: 'Speech' } }, 'mho');
    expect((refused as { missing: Array<{ code: string; creates?: unknown }> }).missing[0]).toMatchObject({ code: 'capacityAssessmentRequired', creates: { kind: 'dialog', dialog: 'capacity-assessment' } });
    const decided = ok(assessed(checked.process as AwiProcess), 'awi-route-decision', { route: 'guardianship-welfare', rationale: 'A welfare guardian is needed for decisions about care.', willAndPreferences: { pastWishes: 'Wanted to stay at home', presentWishes: 'Wants to stay at home', communicationMethod: 'Speech' } }, 'mho');
    expect(decided.to).toBe('route-decision');
    expect(decided.followOn[0]).toMatchObject({ kind: 'offer', creates: { kind: 'transition', transition: 'awi-open-application' } });
    const informal = ok(assessed(checked.process as AwiProcess), 'awi-route-decision', { route: 'informal-support', rationale: 'Support can be arranged with the family informally.', willAndPreferences: { pastWishes: '', presentWishes: 'Happy with the family arranging things', communicationMethod: 'Speech' } }, 'social-worker-adults');
    expect(informal.followOn[0]).toMatchObject({ kind: 'offer', creates: { kind: 'dialog', dialog: 'close' } });
    const objection = record(assessed(checked.process as AwiProcess), 'awi-route-decision', { route: 's13za', rationale: 'Section 13ZA would allow the move.', s13za: { considered: true, applied: true, reasoning: 'Considered', objectionFrom: 'Daughter' }, willAndPreferences: { pastWishes: '', presentWishes: 'Unclear', communicationMethod: 'Speech' } }, 'mho');
    expect((objection as { errors: string[] }).errors).toContain('s13zaObjection');
  });
  it('opens the application, which tells the MHO and starts their report clock, records reports and court events, and an order begins supervision', () => {
    const decided = ok(assessed(ok(open('awi'), 'awi-check-existing-powers', powers, 'social-worker-adults').process as AwiProcess), 'awi-route-decision', { route: 'guardianship-welfare', rationale: 'A welfare guardian is needed for decisions about care.', willAndPreferences: { pastWishes: '', presentWishes: 'Wants to stay at home', communicationMethod: 'Speech' } }, 'mho').process;
    const application = ok(decided, 'awi-open-application', { applicant: 'council', applicantName: 'Clydeshore Council', powersSought: ['Decide where to live'], mhoUserId: 'usr_mho', sheriffCourt: 'Dunlarrick Sheriff Court' }, 'social-worker-adults');
    expect(application.to).toBe('application');
    expect(application.clocks.starts).toEqual([{ ruleId: 'awi.mho.report', ownerUserId: 'usr_mho' }]);
    expect(application.addMembers[0]).toMatchObject({ userId: 'usr_mho' });
    const medical = ok(application.process, 'awi-record-report', { kind: 'medical', practitioner: 'Dr Farouk', practitionerKind: 'approved-medical-practitioner', receivedAt: '2026-09-10' }, 'mho');
    expect((medical.process as AwiProcess).detail.application?.medicalReports).toHaveLength(1);
    const mho = ok(medical.process, 'awi-record-report', { kind: 'mho', submittedAt: '2026-09-20T09:00:00Z' }, 'mho');
    expect(mho.clocks.completes).toEqual(['awi.mho.report']);
    const lodged = ok(mho.process, 'awi-court-event', { event: 'lodged', at: '2026-09-22' }, 'mho');
    expect((lodged.process as AwiProcess).detail.application?.court.lodgedAt).toBe('2026-09-22');
    const interim = ok(lodged.process, 'awi-court-event', { event: 'interim-granted', at: '2026-09-30', expiresAt: '2026-12-30' }, 'mho');
    expect(interim.clocks.starts.map((s) => s.ruleId)).toEqual(['awi.interim.warning', 'awi.interim.maximum']);
    // A trigger is an instant, whatever the form typed: a date alone fails the clock schema on the next write.
    for (const start of interim.clocks.starts) expect(start.triggeredAt).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/);
    const granted = ok(interim.process, 'awi-court-event', { event: 'order-granted', at: '2026-11-15', order: { kind: 'welfare-guardianship', expiresAt: '2029-11-15', guardianName: 'Clydeshore Council CSWO', powers: ['Decide where to live'] } }, 'mho');
    expect(granted.to).toBe('order');
    expect(granted.clocks.completes).toEqual(['awi.interim.warning', 'awi.interim.maximum', 'awi.mho.report']);
    expect(granted.eventType).toBe('legal.guardianship');
    const supervision = ok(granted.process, 'awi-begin-supervision', { supervisingOfficerUserId: 'usr_so', supervisingOfficerName: 'A Supervisor', firstVisitAt: '2026-12-01' }, 'team-leader');
    expect(supervision.to).toBe('supervision');
    expect((supervision.process as AwiProcess).detail.orders[0]?.supervisingOfficerUserId).toBe('usr_so');
    const visit = ok(supervision.process, 'awi-record-visit', {}, 'social-worker-adults');
    expect(visit.followOn[0]).toMatchObject({ kind: 'offer', creates: { kind: 'dialog', dialog: 'supervision-visit' } });
    const closed = ok(supervision.process, 'awi-close', { reasonId: 'order-expired', note: 'The order ran to its end date.' }, 'social-worker-adults');
    expect(closed.followOn[0]).toMatchObject({ kind: 'close', reasonId: 'order-expired' });
    expect(record(decided, 'awi-open-application', { applicant: 'council', applicantName: 'Council', powersSought: ['x'], mhoUserId: 'usr_mho', sheriffCourt: 'Court' }, 'gp', 'health').ok).toBe(false);
  });
  it('supervision can follow a section 13ZA route without an order', () => {
    const decided = ok(assessed(ok(open('awi'), 'awi-check-existing-powers', powers, 'social-worker-adults').process as AwiProcess), 'awi-route-decision', { route: 's13za', rationale: 'Section 13ZA allows the move with no objection raised.', s13za: { considered: true, applied: true, reasoning: 'No objection from anyone consulted.' }, willAndPreferences: { pastWishes: '', presentWishes: 'Content to move', communicationMethod: 'Speech' } }, 'mho');
    expect(decided.followOn.map((f) => f.kind)).toEqual(['offer', 'offer']);
    const supervision = ok(decided.process, 'awi-begin-supervision', { supervisingOfficerUserId: 'usr_so', supervisingOfficerName: 'A Supervisor', firstVisitAt: '2026-10-01' }, 'social-worker-adults');
    expect(supervision.to).toBe('supervision');
  });
});

describe('permission across the tables', () => {
  it('refuses every oversight role on every transition, with a route naming who does record it', () => {
    for (const type of Object.keys(TRANSITIONS) as ProcessType[]) {
      for (const transition of TRANSITIONS[type]) {
        for (const roleId of ['inspector', 'apc-lead-officer', 'caldicott-guardian', 'system-administrator'] as const) {
          const decision = canRecordTransition({ roleId }, transition);
          expect(decision.allowed, `${transition.id} ${roleId}`).toBe(false);
          if (!decision.allowed) expect(decision.route.length).toBeGreaterThan(0);
        }
        for (const roleId of transition.roles) expect(canRecordTransition({ roleId }, transition).allowed, `${transition.id} ${roleId}`).toBe(true);
      }
    }
  });
});

describe('scheduling routes (D-213)', () => {
  it('routes a type through the transition that schedules it from the current stage', () => {
    const route = scheduleRoute(open('marac'), 'marac');
    expect(route.kind).toBe('transition');
    expect((route as { transition: { id: string } }).transition.id).toBe('marac-schedule-meeting');
    expect(scheduleRoute(at(open('asp'), 'investigation'), 'asp-case-conference')).toMatchObject({ kind: 'transition', transition: { id: 'asp-schedule-case-conference' } });
  });

  it('refuses a type the tables schedule from another stage, naming the stages', () => {
    const route = scheduleRoute(open('asp'), 'asp-case-conference');
    expect(route).toMatchObject({ kind: 'refused', code: 'meetingWrongStage', stages: ['investigation'] });
    expect(scheduleRoute(open('cp'), 'cppm-review')).toMatchObject({ kind: 'refused', stages: ['childs-plan', 'review'] });
  });

  it('is a plain write where the engine awaits the type at this stage, or has no view of it', () => {
    // A second IRD while the case sits at ird: the held transition fires from here, so nothing moves.
    expect(scheduleRoute(at(open('cp'), 'ird'), 'ird')).toEqual({ kind: 'plain' });
    // A core group is recorded when it is held; scheduling it moves nothing.
    expect(scheduleRoute(at(open('cp'), 'childs-plan'), 'core-group')).toEqual({ kind: 'plain' });
    expect(scheduleRoute(open('asp'), 'asp-inter-agency-discussion')).toEqual({ kind: 'plain' });
    expect(scheduleRoute(open('awi'), 'awi-mdt')).toEqual({ kind: 'plain' });
  });

  it('names the transition a held meeting fires from the current stage, and every stage it could fire from', () => {
    expect(heldTransitionFor(at(open('asp'), 'investigation'), 'asp-case-conference')?.id).toBe('asp-case-conference-held');
    expect(heldTransitionFor(open('asp'), 'asp-case-conference')).toBeUndefined();
    expect(heldTransitionsFor('asp', 'asp-case-conference').map((t) => t.id)).toEqual(['asp-case-conference-held']);
    expect(heldTransitionFor(at(open('cp'), 'childs-plan'), 'core-group')?.id).toBe('cp-core-group-meeting');
    expect(heldTransitionFor(open('asp'), 'lsi-planning')).toBeUndefined();
  });

  it('every meeting type a case type holds is either scheduled by a transition, awaited by one, or free', () => {
    for (const type of Object.keys(MEETING_TYPES_BY_PROCESS) as ProcessType[]) {
      for (const meetingType of MEETING_TYPES_BY_PROCESS[type]) {
        const schedulers = TRANSITIONS[type].filter((t) => t.schedules?.includes(meetingType));
        const holders = TRANSITIONS[type].filter((t) => t.firedBy?.includes(meetingType));
        // A type the tables schedule is also one they hold, so a scheduled meeting always has an outcome form.
        if (schedulers.length > 0) expect(holders.length, `${type} ${meetingType} is scheduled but never held`).toBeGreaterThan(0);
      }
    }
  });

  it('a scheduled meeting carries the people left off, so the omission is a decision', () => {
    const out = ok(open('marac'), 'marac-schedule-meeting', { ...schedule, leftOff: [{ name: 'A Perpetrator', reason: 'Excluded party' }] }, 'marac-coordinator');
    const meeting = out.followOn.find((f) => f.kind === 'meeting');
    expect(meeting && meeting.kind === 'meeting' ? meeting.meeting.leftOff : undefined).toEqual([{ name: 'A Perpetrator', reason: 'Excluded party' }]);
  });
});
