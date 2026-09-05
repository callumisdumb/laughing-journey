import { t } from '@mas/messages';
import { CP_CONCERNS, CP_DEREGISTRATION_REASONS, type Agency, type CpConcern, type CpDeregistrationReason } from '../../enums';
import type { CpProcess } from '../../schemas/process';
import { buildMeeting, buildPlan, moved, outcome, requireText, validatePlan, validateSchedule, type MissingThing, type PlanInput, type ScheduleInput, type Transition, type TransitionContext, type TransitionOutcome } from './shared';
import { chairAndMinuteTaker } from './asp';

/**
 * Child protection, from a child concern to de-registration (task section 1.3), pre-birth included.
 *
 * The IRD is convened rather than recorded after the fact, its decisions are recorded in the IRD
 * workspace by the people who made them, and the child protection planning meeting is held before
 * the register is written. A pre-birth case runs the same engine with its own clocks, and the birth
 * is an event that converts the subject and re-reads the clocks.
 */
export interface IrdDecision {
  decided: boolean;
  decision: string;
  rationale: string;
}

export interface ConveneIrdInput extends ScheduleInput {
  outOfHours: boolean;
}

export interface IrdDecisionsInput {
  meetingId?: string;
  significantHarm: IrdDecision;
  investigationNeeded: IrdDecision;
  jii: IrdDecision & { plannerName?: string; informedBy?: string };
  medical: IrdDecision & { kind?: 'jpfe' | 'comprehensive' | 'none'; consentBy?: string; when?: string };
  emergencyMeasures: IrdDecision & { measure?: 'none' | 'cpo' | 'exclusion-order' | 'police-emergency-powers' };
  reporterReferral: IrdDecision;
  parentsInformed: IrdDecision & { withheld?: string };
  childViewsSought: string;
  siblingsConsidered: string[];
  contributions: Array<{ agency: Agency; byName: string; byUserId?: string; summary: string }>;
  dissent?: string;
  interimSafetyPlan?: PlanInput;
  /** Where no investigation follows: closure, or a single-agency route, each with the reason. */
  noInvestigation?: { route: 'close' | 'single-agency'; reason: string };
}

export interface JiiInput {
  heldAt: string;
  summary: string;
}

export interface MedicalInput {
  heldAt: string;
  kind: 'jpfe' | 'comprehensive';
  summary: string;
}

export interface ScheduleCppmInput extends ScheduleInput {
  parents: 'invited' | 'excluded';
  parentsExcludedReason?: string;
  childInvited: boolean;
}

export interface CppmHeldInput {
  meetingId: string;
  quorate: boolean;
  decision: 'register' | 'not-register';
  concerns: CpConcern[];
  localCategory?: string;
  rationale: string;
  coreGroupMemberUserIds: string[];
  leadProfessionalUserId?: string;
  namedPersonUserId?: string;
  plan?: PlanInput;
}

export interface CoreGroupInput {
  heldAt: string;
  attendance: Array<{ userId?: string; name: string; present: boolean }>;
  progress: string;
  significantChange: boolean;
  changeNote?: string;
}

export interface ReviewCppmHeldInput {
  meetingId: string;
  quorate: boolean;
  decision: 'continue' | 'deregister';
  rationale: string;
  deregistration?: { reason: CpDeregistrationReason; note: string };
}

export interface DeregisterInput {
  reason: CpDeregistrationReason;
  note: string;
}

export interface BirthInput {
  bornAt: string;
}

const SOCIAL_WORK = ['social-worker-children', 'team-leader'] as const;
const SCHEDULERS = ['social-worker-children', 'team-leader', 'chair', 'minute-taker'] as const;

function undecided(): IrdDecision {
  return { decided: false, decision: '', rationale: '' };
}

function requireDecision(d: IrdDecision | undefined, code: string): string[] {
  if (!d) return [code];
  return d.rationale.trim().length < 10 ? [code] : [];
}

function registered(process: CpProcess): MissingThing[] {
  return process.detail.register && !process.detail.register.deregisteredAt ? [] : [{ code: 'notRegistered', creates: { kind: 'transition', transition: 'cp-cppm-held' } }];
}

function preBirth(process: CpProcess): boolean {
  return Boolean(process.detail.preBirth);
}

/** The review the record is due next: the first after registration, then each subsequent one. */
function reviewRule(process: CpProcess): string {
  const first = process.clocks.some((c) => c.ruleId === 'cp.cppm.review.first' && !c.completedAt);
  return first ? 'cp.cppm.review.first' : 'cp.cppm.review.subsequent';
}

export const CP_TRANSITIONS: Array<Transition<CpProcess, never>> = [
  {
    id: 'cp-convene-ird',
    process: 'cp',
    from: ['concern'],
    to: ['ird'],
    roles: [...SOCIAL_WORK, 'detective-sergeant-ppu', 'concern-hub-officer'],
    requires: () => [],
    validate: (input: ConveneIrdInput) => {
      const errors = validateSchedule(input);
      const agencies = new Set(input?.invitees.map((i) => i.agency) ?? []);
      if (!agencies.has('social-work') || !agencies.has('police') || !agencies.has('health')) errors.push('irdTripartiteRequired');
      return errors;
    },
    apply: (process, input: ConveneIrdInput, ctx) => {
      const meeting = buildMeeting(process, 'ird', t('processes.transitions.meetingTitle.ird', { title: process.title }), input, ctx);
      const summary = t('processes.transitions.summary.irdConvened', { date: input.scheduledAt.slice(0, 10), outOfHours: input.outOfHours ? 'yes' : 'no' });
      const ird: NonNullable<CpProcess['detail']['ird']> = {
        meetingId: meeting.id,
        heldAt: input.scheduledAt,
        outOfHours: input.outOfHours,
        participants: input.invitees.map((i) => ({ agency: i.agency, name: i.name, role: i.role, userId: i.userId })),
        contributions: [],
        decisions: { significantHarm: undecided(), investigationNeeded: undecided(), jii: undecided(), medical: undecided(), emergencyMeasures: undecided(), reporterReferral: undecided(), parentsInformed: undecided() },
        siblingsConsidered: [],
        childViewsSought: '',
      };
      const next: CpProcess = { ...process, detail: { ...process.detail, ird } };
      return outcome(moved(next, 'ird', ctx, summary), 'ird', summary, { followOn: [{ kind: 'meeting', meeting }], addMembers: chairAndMinuteTaker(input), eventType: 'process.ird' });
    },
  },
  {
    id: 'cp-ird-decisions',
    process: 'cp',
    from: ['ird'],
    to: ['investigation', 'ird'],
    roles: [...SOCIAL_WORK, 'detective-sergeant-ppu'],
    firedBy: ['ird'],
    requires: (process) => (process.detail.ird ? [] : [{ code: 'irdNotConvened', creates: { kind: 'transition', transition: 'cp-convene-ird' } }]),
    validate: (input: IrdDecisionsInput) => {
      const errors: string[] = [];
      errors.push(...requireDecision(input.significantHarm, 'significantHarmDecisionRequired'));
      errors.push(...requireDecision(input.investigationNeeded, 'investigationDecisionRequired'));
      errors.push(...requireDecision(input.jii, 'jiiDecisionRequired'));
      errors.push(...requireDecision(input.medical, 'medicalDecisionRequired'));
      errors.push(...requireDecision(input.reporterReferral, 'reporterDecisionRequired'));
      errors.push(...requireDecision(input.parentsInformed, 'parentsDecisionRequired'));
      if (input.parentsInformed && !input.parentsInformed.decided && !(input.parentsInformed.withheld ?? '').trim()) errors.push('parentsWithheldReasonRequired');
      errors.push(...requireText(input.childViewsSought, 'childViewsRequired'));
      if (input.contributions.length === 0) errors.push('contributionsRequired');
      if (input.investigationNeeded && !input.investigationNeeded.decided && !input.noInvestigation) errors.push('noInvestigationRouteRequired');
      if (input.interimSafetyPlan) errors.push(...validatePlan(input.interimSafetyPlan));
      return errors;
    },
    apply: (process, input: IrdDecisionsInput, ctx) => {
      const ird = process.detail.ird!;
      const stamp = (d: IrdDecision) => ({ ...d, at: ctx.at, byName: ctx.actor.name, byUserId: ctx.actor.userId });
      const followOn: TransitionOutcome['followOn'] = [];
      let interimSafetyPlanId: string | undefined;
      if (input.interimSafetyPlan) {
        const { plan, actions } = buildPlan(process, 'interim-safety', input.interimSafetyPlan, ctx);
        interimSafetyPlanId = plan.id;
        followOn.push({ kind: 'plan', plan, actions });
      }
      const decided: NonNullable<CpProcess['detail']['ird']> = {
        ...ird,
        meetingId: input.meetingId ?? ird.meetingId,
        contributions: input.contributions.map((c) => ({ ...c, at: ctx.at })),
        decisions: {
          significantHarm: stamp(input.significantHarm),
          investigationNeeded: stamp(input.investigationNeeded),
          jii: { ...stamp(input.jii), plannerName: input.jii.plannerName, informedBy: input.jii.informedBy },
          medical: { ...stamp(input.medical), kind: input.medical.kind, consentBy: input.medical.consentBy, when: input.medical.when },
          emergencyMeasures: { ...stamp(input.emergencyMeasures), measure: input.emergencyMeasures.measure },
          reporterReferral: stamp(input.reporterReferral),
          parentsInformed: { ...stamp(input.parentsInformed), withheld: input.parentsInformed.withheld },
        },
        siblingsConsidered: input.siblingsConsidered,
        interimSafetyPlanId,
        childViewsSought: input.childViewsSought,
      };
      const summary = t('processes.transitions.summary.irdDecided', { investigation: input.investigationNeeded.decided ? 'yes' : 'no', harm: input.significantHarm.decided ? 'yes' : 'no' });
      if (input.investigationNeeded.decided) {
        const next: CpProcess = { ...process, detail: { ...process.detail, ird: decided, proceduresInitiatedAt: ctx.at, investigation: { openedAt: ctx.at, summary: input.investigationNeeded.rationale } } };
        return outcome(moved(next, 'investigation', ctx, summary), 'investigation', summary, {
          clocks: { completes: [], starts: preBirth(process) ? [] : [{ ruleId: 'cp.cppm.initial' }], note: t('processes.transitions.clockNote.irdDecided') },
          followOn,
          eventType: 'process.ird',
        });
      }
      const next: CpProcess = { ...process, detail: { ...process.detail, ird: decided } };
      const route = input.noInvestigation!;
      if (route.route === 'close') followOn.push({ kind: 'close', reasonId: 'other-reason', note: route.reason });
      else followOn.push({ kind: 'offer', creates: { kind: 'dialog', dialog: 'close' } });
      return outcome(next, 'ird', t('processes.transitions.summary.irdNoInvestigation', { route: route.route, reason: route.reason }), { followOn, eventType: 'process.ird' });
    },
  },
  {
    id: 'cp-record-jii',
    process: 'cp',
    from: ['investigation'],
    to: ['investigation'],
    roles: [...SOCIAL_WORK, 'detective-sergeant-ppu'],
    repeatable: true,
    requires: (process) => (process.detail.investigation ? [] : [{ code: 'investigationNotOpened', creates: { kind: 'transition', transition: 'cp-ird-decisions' } }]),
    validate: (input: JiiInput) => [...(input.heldAt ? [] : ['dateRequired']), ...requireText(input.summary, 'summaryRequired')],
    apply: (process, input: JiiInput) => {
      const next: CpProcess = { ...process, detail: { ...process.detail, investigation: { ...process.detail.investigation!, jiiHeldAt: input.heldAt, jiiModel: 'SCIM', jiiSummary: input.summary } } };
      return outcome(next, 'investigation', t('processes.transitions.summary.jii', { date: input.heldAt.slice(0, 10) }), { outbound: null });
    },
  },
  {
    id: 'cp-record-medical',
    process: 'cp',
    from: ['investigation'],
    to: ['investigation'],
    roles: [...SOCIAL_WORK, 'cp-nurse-adviser', 'detective-sergeant-ppu'],
    repeatable: true,
    requires: (process) => (process.detail.investigation ? [] : [{ code: 'investigationNotOpened', creates: { kind: 'transition', transition: 'cp-ird-decisions' } }]),
    validate: (input: MedicalInput) => [...(input.heldAt ? [] : ['dateRequired']), ...(input.kind ? [] : ['medicalKindRequired']), ...requireText(input.summary, 'summaryRequired')],
    apply: (process, input: MedicalInput) => {
      const next: CpProcess = { ...process, detail: { ...process.detail, investigation: { ...process.detail.investigation!, medicalHeldAt: input.heldAt, medicalKind: input.kind, medicalSummary: input.summary } } };
      return outcome(next, 'investigation', t('processes.transitions.summary.medical', { kind: input.kind, date: input.heldAt.slice(0, 10) }), { outbound: null });
    },
  },
  {
    id: 'cp-schedule-cppm',
    process: 'cp',
    from: ['investigation'],
    to: ['investigation'],
    roles: [...SCHEDULERS],
    repeatable: true,
    requires: (process) => (process.detail.investigation ? [] : [{ code: 'investigationNotOpened', creates: { kind: 'transition', transition: 'cp-ird-decisions' } }]),
    validate: (input: ScheduleCppmInput) => [...validateSchedule(input), ...(input?.parents === 'excluded' ? requireText(input.parentsExcludedReason, 'parentsExcludedReasonRequired') : [])],
    apply: (process, input: ScheduleCppmInput, ctx) => scheduleCppm(process, input, ctx, preBirth(process) ? 'pre-birth-cppm' : 'cppm'),
  },
  {
    id: 'cp-cppm-held',
    process: 'cp',
    from: ['investigation'],
    to: ['cppm', 'childs-plan', 'investigation'],
    roles: ['chair'],
    firedBy: ['cppm', 'pre-birth-cppm'],
    requires: (process) => (process.detail.cppm?.meetingId ? [] : [{ code: 'cppmNotScheduled', creates: { kind: 'transition', transition: 'cp-schedule-cppm' } }]),
    validate: (input: CppmHeldInput) => {
      const errors: string[] = [];
      if (!input.meetingId) errors.push('meetingRequired');
      if (!input.quorate) return errors;
      errors.push(...requireText(input.rationale, 'rationaleRequired'));
      if (input.decision === 'register') {
        if (input.concerns.filter((c) => CP_CONCERNS.includes(c)).length === 0) errors.push('concernsRequired');
        if (input.coreGroupMemberUserIds.length === 0) errors.push('coreGroupRequired');
        if (!input.leadProfessionalUserId) errors.push('leadProfessionalRequired');
        if (!input.plan) errors.push('planRequired');
        else errors.push(...validatePlan(input.plan));
      }
      return errors;
    },
    apply: (process, input: CppmHeldInput, ctx) => {
      if (!input.quorate) {
        const summary = t('processes.transitions.summary.cppmInquorate');
        return outcome(process, 'investigation', summary, {
          clocks: { completes: [], starts: [{ ruleId: 'cp.cppm.inquorate.reconvene' }], note: summary },
          followOn: [{ kind: 'reschedule', meetingId: input.meetingId }],
          eventType: 'process.cppm',
        });
      }
      const completes = preBirth(process) ? ['cp.prebirth.cppm', 'cp.cppm.initial', 'cp.cppm.notice', 'cp.cppm.inquorate.reconvene'] : ['cp.cppm.initial', 'cp.cppm.notice', 'cp.cppm.inquorate.reconvene'];
      const cppm = { meetingId: input.meetingId, heldAt: ctx.at, decision: input.decision, rationale: input.rationale };
      if (input.decision === 'not-register') {
        const summary = t('processes.transitions.summary.cppmNotRegistered', { rationale: input.rationale });
        const next: CpProcess = { ...process, detail: { ...process.detail, cppm } };
        return outcome(moved(next, 'cppm', ctx, summary), 'cppm', summary, { clocks: { completes, starts: [] }, followOn: [{ kind: 'offer', creates: { kind: 'dialog', dialog: 'close' } }], eventType: 'process.cppm' });
      }
      const { plan, actions } = buildPlan(process, 'childs-plan', input.plan!, ctx);
      const summary = t('processes.transitions.summary.cppmRegistered', { count: input.concerns.length });
      const next: CpProcess = {
        ...process,
        detail: {
          ...process.detail,
          cppm,
          register: { registeredAt: ctx.at.slice(0, 10), concerns: input.concerns, localCategory: input.localCategory },
          coreGroup: { memberUserIds: input.coreGroupMemberUserIds, leadProfessionalUserId: input.leadProfessionalUserId, namedPersonUserId: input.namedPersonUserId, meetings: [] },
          childsPlanId: plan.id,
        },
      };
      const review = preBirth(process) ? 'cp.prebirth.review' : 'cp.cppm.review.first';
      return outcome(moved(moved(next, 'cppm', ctx, summary), 'childs-plan', ctx, summary), 'childs-plan', summary, {
        clocks: { completes, starts: [{ ruleId: 'cp.coregroup.first', ownerUserId: input.leadProfessionalUserId }, { ruleId: review }, { ruleId: 'cp.cppm.record.distribute' }], note: t('processes.transitions.clockNote.cppmHeld') },
        followOn: [{ kind: 'plan', plan, actions }],
        addMembers: input.leadProfessionalUserId ? [{ userId: input.leadProfessionalUserId, caseRole: t('processes.transitions.caseRole.leadProfessional'), agency: 'social-work', reason: t('processes.transitions.caseRole.leadProfessionalReason') }] : [],
        eventType: 'process.registration',
      });
    },
  },
  {
    id: 'cp-core-group-meeting',
    process: 'cp',
    from: ['childs-plan', 'review'],
    to: ['childs-plan', 'review'],
    roles: [...SOCIAL_WORK, 'health-visitor', 'education-cp-lead', 'cp-nurse-adviser', 'chair'],
    repeatable: true,
    requires: registered,
    validate: (input: CoreGroupInput) => [...(input.heldAt ? [] : ['dateRequired']), ...(input.attendance.some((a) => a.present) ? [] : ['attendanceRequired']), ...requireText(input.progress, 'progressRequired'), ...(input.significantChange ? requireText(input.changeNote, 'changeNoteRequired') : [])],
    apply: (process, input: CoreGroupInput) => {
      const coreGroup = process.detail.coreGroup ?? { memberUserIds: [] };
      const meetings = [...(coreGroup.meetings ?? []), { heldAt: input.heldAt, attendance: input.attendance, progress: input.progress, significantChange: input.significantChange, changeNote: input.changeNote }];
      const next: CpProcess = { ...process, detail: { ...process.detail, coreGroup: { ...coreGroup, firstMeetingAt: coreGroup.firstMeetingAt ?? input.heldAt, meetings } } };
      const summary = input.significantChange ? t('processes.transitions.summary.coreGroupChange', { note: input.changeNote ?? '' }) : t('processes.transitions.summary.coreGroup', { date: input.heldAt.slice(0, 10) });
      return outcome(next, process.stage, summary, {
        clocks: { completes: coreGroup.firstMeetingAt ? [] : ['cp.coregroup.first'], starts: input.significantChange ? [{ ruleId: 'cp.coregroup.escalate', ownerUserId: coreGroup.leadProfessionalUserId }] : [], note: summary },
        outbound: null,
        eventType: 'process.core-group',
      });
    },
  },
  {
    id: 'cp-schedule-review-cppm',
    process: 'cp',
    from: ['childs-plan', 'review'],
    to: ['childs-plan', 'review'],
    roles: [...SCHEDULERS],
    repeatable: true,
    requires: registered,
    validate: (input: ScheduleCppmInput) => [...validateSchedule(input), ...(input?.parents === 'excluded' ? requireText(input.parentsExcludedReason, 'parentsExcludedReasonRequired') : [])],
    apply: (process, input: ScheduleCppmInput, ctx) => scheduleCppm(process, input, ctx, 'cppm-review'),
  },
  {
    id: 'cp-review-cppm-held',
    process: 'cp',
    from: ['childs-plan', 'review'],
    to: ['review', 'deregistered'],
    roles: ['chair'],
    firedBy: ['cppm-review'],
    requires: registered,
    validate: (input: ReviewCppmHeldInput) => {
      const errors: string[] = [];
      if (!input.meetingId) errors.push('meetingRequired');
      if (!input.quorate) return errors;
      errors.push(...requireText(input.rationale, 'rationaleRequired'));
      if (input.decision === 'deregister' && !CP_DEREGISTRATION_REASONS.includes(input.deregistration?.reason as CpDeregistrationReason)) errors.push('deregistrationReasonRequired');
      return errors;
    },
    apply: (process, input: ReviewCppmHeldInput, ctx) => {
      if (!input.quorate) {
        const summary = t('processes.transitions.summary.cppmInquorate');
        return outcome(process, process.stage, summary, { clocks: { completes: [], starts: [{ ruleId: 'cp.cppm.inquorate.reconvene' }], note: summary }, followOn: [{ kind: 'reschedule', meetingId: input.meetingId }], eventType: 'process.cppm' });
      }
      const cppm = { meetingId: input.meetingId, heldAt: ctx.at, decision: 'register' as const, rationale: input.rationale };
      if (input.decision === 'deregister') {
        const summary = t('processes.transitions.summary.reviewDeregister', { rationale: input.rationale });
        const next: CpProcess = { ...process, detail: { ...process.detail, cppm } };
        return outcome(moved(next, 'review', ctx, summary), 'review', summary, {
          clocks: { completes: [reviewRule(process), 'cp.cppm.notice', 'cp.cppm.inquorate.reconvene'], starts: [{ ruleId: 'cp.cppm.record.distribute' }] },
          followOn: [{ kind: 'offer', creates: { kind: 'transition', transition: 'cp-deregister' } }],
          eventType: 'process.cppm',
        });
      }
      const summary = t('processes.transitions.summary.reviewContinue', { rationale: input.rationale });
      const next: CpProcess = { ...process, detail: { ...process.detail, cppm } };
      return outcome(moved(next, 'review', ctx, summary), 'review', summary, {
        clocks: { completes: [reviewRule(process), 'cp.cppm.notice', 'cp.cppm.inquorate.reconvene'], starts: [{ ruleId: 'cp.cppm.review.subsequent' }, { ruleId: 'cp.cppm.record.distribute' }], note: t('processes.transitions.clockNote.reviewHeld') },
        eventType: 'process.cppm',
      });
    },
  },
  {
    id: 'cp-deregister',
    process: 'cp',
    from: ['review', 'childs-plan'],
    to: ['deregistered'],
    roles: ['chair', 'team-leader'],
    requires: registered,
    validate: (input: DeregisterInput) => [...(CP_DEREGISTRATION_REASONS.includes(input.reason) ? [] : ['deregistrationReasonRequired']), ...requireText(input.note, 'closureNoteRequired')],
    apply: (process, input: DeregisterInput, ctx) => {
      const summary = t('processes.transitions.summary.deregistered', { reason: input.reason });
      const next: CpProcess = { ...process, detail: { ...process.detail, register: { ...process.detail.register!, deregisteredAt: ctx.at.slice(0, 10), deregistrationReason: input.reason, deregistrationNote: input.note } } };
      return outcome(moved(next, 'deregistered', ctx, summary), 'deregistered', summary, {
        clocks: { completes: process.clocks.filter((c) => !c.completedAt && c.ruleId.startsWith('cp.')).map((c) => c.ruleId), starts: [], note: summary },
        followOn: [{ kind: 'close', reasonId: input.reason, note: input.note }],
        eventType: 'process.deregistration',
      });
    },
  },
  {
    id: 'cp-birth',
    process: 'cp',
    from: ['concern', 'ird', 'investigation', 'cppm', 'childs-plan', 'review'],
    to: ['concern', 'ird', 'investigation', 'cppm', 'childs-plan', 'review'],
    roles: ['midwife', 'health-visitor', ...SOCIAL_WORK],
    repeatable: true,
    requires: (process) => (preBirth(process) ? [] : [{ code: 'notPreBirth' }]),
    validate: (input: BirthInput) => (input.bornAt ? [] : ['dateRequired']),
    apply: (process, input: BirthInput) => {
      const summary = t('processes.transitions.summary.birth', { date: input.bornAt.slice(0, 10) });
      const running = new Set(process.clocks.filter((c) => !c.completedAt).map((c) => c.ruleId));
      const completes = ['cp.prebirth.cppm', 'cp.prebirth.review'].filter((id) => running.has(id));
      const starts = [...(running.has('cp.prebirth.cppm') ? [{ ruleId: 'cp.cppm.initial', triggeredAt: input.bornAt }] : []), ...(running.has('cp.prebirth.review') ? [{ ruleId: 'cp.cppm.review.first', triggeredAt: input.bornAt }] : [])];
      const next: CpProcess = { ...process, detail: { ...process.detail, preBirth: undefined } };
      return outcome(next, process.stage, summary, {
        clocks: { completes, starts, note: t('processes.transitions.clockNote.birth') },
        followOn: [{ kind: 'birth', personId: process.subjectIds[0]!, bornAt: input.bornAt }],
        outbound: null,
        eventType: 'family.birth',
      });
    },
  },
  {
    id: 'cp-close',
    process: 'cp',
    from: ['concern', 'ird', 'investigation', 'cppm', 'childs-plan', 'review', 'deregistered'],
    to: ['closed'],
    roles: [...SOCIAL_WORK, 'chair'],
    via: { kind: 'dialog', dialog: 'close' },
    requires: () => [],
    validate: (input: { reasonId: string; note: string }) => [...(input.reasonId ? [] : ['closureReasonRequired']), ...requireText(input.note, 'closureNoteRequired')],
    apply: (process, input: { reasonId: string; note: string }) => outcome(process, 'closed', t('processes.transitions.summary.close', { reason: input.reasonId }), { followOn: [{ kind: 'close', reasonId: input.reasonId, note: input.note }], outbound: null }),
  },
];

function scheduleCppm(process: CpProcess, input: ScheduleCppmInput, ctx: TransitionContext, type: 'cppm' | 'pre-birth-cppm' | 'cppm-review'): TransitionOutcome {
  const title = type === 'cppm-review' ? t('processes.transitions.meetingTitle.cppmReview', { title: process.title }) : type === 'pre-birth-cppm' ? t('processes.transitions.meetingTitle.preBirthCppm', { title: process.title }) : t('processes.transitions.meetingTitle.cppm', { title: process.title });
  const meeting = buildMeeting(process, type, title, input, ctx);
  const leftOff = [...(input.leftOff ?? [])];
  if (input.parents === 'excluded') leftOff.push({ name: t('processes.transitions.parents'), reason: input.parentsExcludedReason ?? '' });
  const summary = t('processes.transitions.summary.cppmScheduled', { title, date: input.scheduledAt.slice(0, 10), parents: input.parents, child: input.childInvited ? 'yes' : 'no' });
  const next: CpProcess = { ...process, detail: { ...process.detail, cppm: { meetingId: meeting.id, decision: 'pending' } } };
  return outcome(next, process.stage, summary, {
    clocks: { completes: [], starts: [{ ruleId: 'cp.cppm.notice', triggeredAt: input.scheduledAt }], note: t('processes.transitions.clockNote.noticeStarted') },
    followOn: [{ kind: 'meeting', meeting: { ...meeting, subjectAttendance: t('processes.transitions.attendanceNote', { parents: input.parents, child: input.childInvited ? 'yes' : 'no', reason: input.parentsExcludedReason ?? '' }) } }],
    outbound: null,
    addMembers: chairAndMinuteTaker(input),
  });
}
