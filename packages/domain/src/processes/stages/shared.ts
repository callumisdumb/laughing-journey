import { t, tKey } from '@mas/messages';
import { ROLE_DEFINITIONS, keySegment, roleLabel, type Agency, type EventType, type MeetingType, type PlanType, type ProcessType, type RoleId, type Stage } from '../../enums';
import { stageLabel } from '../../config/labels';
import type { Action, Plan } from '../../schemas/action-plan';
import type { Meeting } from '../../schemas/meeting';
import type { Process } from '../../schemas/process';
import type { PermissionDecision } from '../eligibility';

/**
 * The stage engine: the only route to a stage (D-211).
 *
 * A stage is never picked. It is reached by recording the decision that moves the case there, and
 * each decision is a transition in the tables under `./stages`: what it needs the record to already
 * hold, who may record it, what it writes, which clocks it completes and starts, and where the case
 * goes. The stepper on the process screen is a view of these tables and offers the transitions the
 * current stage carries; nothing else on it is clickable.
 *
 * Everything here is pure. `applyTransition` returns the record after the decision and a list of
 * what the store must do beside writing it: the meeting to create, the plan and its actions, the
 * information requests to send, the closure to run. The store does those through the same pipeline
 * as everything else, so a transition's consequences carry the audit entry, the milestone, the
 * clocks, the rewrap, the notifications and the connector proposal that any write carries.
 *
 * Forward only, by default. The way back is reopen, or an explicit return with a reason, and both
 * are their own transitions rather than a stage picker in disguise.
 */
export type TransitionId = string;

export interface TransitionActor {
  userId: string;
  name: string;
  roleId: RoleId;
  agency: Agency;
}

export interface TransitionContext {
  at: string;
  actor: TransitionActor;
  newId: (prefix: string) => string;
  /** The subject's name, for the titles a transition writes; the case title stands in where it is not given. */
  subjectName?: string;
}

/** Who a meeting or a plan is titled after: the person, where the store knows them. */
export function caseName(process: Pick<Process, 'title'>, ctx: Pick<TransitionContext, 'subjectName'>): string {
  return ctx.subjectName ?? process.title;
}

/** A dialog that already exists in the product, offered as the way to create what is missing. */
export type DialogId = 'three-point-test' | 'risk-assessment' | 'capacity-assessment' | 'protection-order' | 'plan' | 'disclosure' | 'mappa-referral' | 'supervision-visit' | 'awi-investigation' | 'close' | 'schedule-meeting';

export type Creates = { kind: 'dialog'; dialog: DialogId; meetingType?: MeetingType; planType?: PlanType } | { kind: 'transition'; transition: TransitionId };

/** What the record lacks, and the action that creates it. A refusal that names no route is a dead end. */
export interface MissingThing {
  code: string;
  creates?: Creates;
}

export interface ScheduleInput {
  scheduledAt: string;
  location: string;
  chairUserId: string;
  chairName: string;
  minuteTakerUserId?: string;
  minuteTakerName?: string;
  invitees: Array<{ userId?: string; name: string; agency: Agency; role: string; reason: string; required?: boolean }>;
  /** Everybody the need-to-know answer left off, listed so the omission is a decision and not an oversight. */
  leftOff?: Array<{ name: string; reason: string }>;
}

export interface PlanInput {
  title: string;
  outcomes: string[];
  coordinatorUserId?: string;
  coordinatorName: string;
  reviewDate?: string;
  consentNote?: string;
  actions: Array<{ title: string; ownerUserId?: string; ownerRoleId?: RoleId; ownerName: string; ownerAgency: Agency; due: string }>;
}

/** What a transition asks the store to do beside writing the process. Named here, composed there. */
export type FollowOn =
  | { kind: 'meeting'; meeting: Meeting }
  | { kind: 'plan'; plan: Plan; actions: Action[] }
  | { kind: 'plan-review'; planId: string; reviewDate: string }
  | { kind: 'requests'; ids: string[]; agencies: Agency[]; purpose: string; dueAt?: string }
  | { kind: 'request-response'; requestId: string; text: string; nothingKnown: boolean }
  | { kind: 'close'; reasonId: string; note: string }
  | { kind: 'open-process'; type: ProcessType; subjectIds: string[]; summary: string; source: string }
  | { kind: 'offer'; creates: Creates }
  | { kind: 'birth'; personId: string; bornAt: string }
  | { kind: 'reschedule'; meetingId: string };

export interface ClockStart {
  ruleId: string;
  /** Defaults to the transition's instant. A notice period counting back names the meeting. */
  triggeredAt?: string;
  /** Who is told beside the case lead when it warns or breaches. */
  ownerUserId?: string;
}

export interface TransitionOutcome {
  process: Process;
  to: Stage;
  clocks: { completes: string[]; starts: ClockStart[]; note?: string };
  followOn: FollowOn[];
  /** The one-line record of the decision: the stage entry's note, the ledger line and the milestone. */
  summary: string;
  /** Propose the stage write to the source system where a connector takes it. */
  outbound: 'stage-change' | null;
  /** People the decision puts on the case: the recorder, a chair, a minute taker, an MHO, a lead professional. */
  addMembers: Array<{ userId: string; caseRole: string; agency: Agency; reason: string }>;
  eventType: EventType;
}

export interface Transition<P extends Process = Process, I = unknown> {
  id: TransitionId;
  process: ProcessType;
  from: readonly Stage[];
  /** Where it can go. The input decides which, where there is more than one. */
  to: readonly Stage[];
  roles: readonly RoleId[];
  /** Records a step and may leave the stage where it is. */
  repeatable?: boolean;
  /** Fired by the meeting workspace when a meeting of this type is held, not from the stepper. */
  firedBy?: readonly MeetingType[];
  /** Schedules a meeting of these types: the schedule dialog routes the type through this transition. */
  schedules?: readonly MeetingType[];
  /** Recorded through a dialog that already exists, rather than a form of its own. */
  via?: Creates;
  requires: (process: P) => MissingThing[];
  validate: (input: I, process: P) => string[];
  apply: (process: P, input: I, ctx: TransitionContext) => TransitionOutcome;
}

/** A transition definition with its process type erased, for the registry. */
export type AnyTransition = Transition<Process, never>;

const READ_ONLY_OVERSIGHT: ReadonlyArray<NonNullable<(typeof ROLE_DEFINITIONS)[RoleId]['oversight']>> = ['read-only', 'audit', 'redacted', 'admin'];

/**
 * Who may record a transition: the roles the table names, and never an oversight role. The refusal
 * names the roles that do record it, so it is a route and not a wall.
 */
export function canRecordTransition(actor: Pick<TransitionActor, 'roleId'>, transition: Pick<AnyTransition, 'id' | 'roles'>): PermissionDecision {
  const role = ROLE_DEFINITIONS[actor.roleId];
  if (!role) return { allowed: false, reason: tKey('permissions.create.unknownRole'), route: tKey('permissions.create.routeAskAdmin') };
  const roles = transition.roles.map((id) => roleLabel(id)).join(', ');
  if (role.oversight && READ_ONLY_OVERSIGHT.includes(role.oversight)) {
    return { allowed: false, reason: t('processes.transitions.oversight', { transition: transitionLabel(transition.id) }), route: t('processes.transitions.route', { roles }) };
  }
  if (transition.roles.includes(actor.roleId)) return { allowed: true };
  return { allowed: false, reason: t('processes.transitions.notYourRole', { transition: transitionLabel(transition.id), roles }), route: t('processes.transitions.route', { roles }) };
}

export function transitionLabel(id: TransitionId): string {
  return tKey(`domain.transitions.${keySegment(id)}`);
}

/** The stage entry a transition appends, or nothing where the case stays where it is. */
export function moved<P extends Process>(process: P, to: Stage, ctx: TransitionContext, note: string): P {
  if (to === process.stage) return process;
  return { ...process, stage: to, stageHistory: [...process.stageHistory, { stage: to, at: ctx.at, byUserId: ctx.actor.userId, byName: ctx.actor.name, note }] };
}

/** The outcome shape most transitions share; a table entry overrides what differs. */
export function outcome(process: Process, to: Stage, summary: string, extra: Partial<Omit<TransitionOutcome, 'process' | 'to' | 'summary'>> = {}): TransitionOutcome {
  return {
    process,
    to,
    summary,
    clocks: extra.clocks ?? { completes: [], starts: [] },
    followOn: extra.followOn ?? [],
    outbound: extra.outbound === undefined ? 'stage-change' : extra.outbound,
    addMembers: extra.addMembers ?? [],
    eventType: extra.eventType ?? 'process.stage',
  };
}

/** A meeting built from a schedule input, for the store to write and the invitees to be told about. */
export function buildMeeting(process: Process, type: MeetingType, title: string, input: ScheduleInput, ctx: TransitionContext): Meeting {
  return {
    id: ctx.newId('mtg'),
    synthetic: true,
    type,
    processId: process.id,
    subjectIds: process.subjectIds,
    title,
    scheduledAt: input.scheduledAt,
    location: input.location,
    status: 'scheduled',
    chairUserId: input.chairUserId,
    chairName: input.chairName,
    minuteTakerUserId: input.minuteTakerUserId,
    minuteTakerName: input.minuteTakerName,
    invitees: input.invitees.map((i) => ({ userId: i.userId, name: i.name, agency: i.agency, role: i.role, required: i.required ?? true, attendance: 'invited', reason: i.reason })),
    agenda: [],
    preMeetingRequests: [],
    pack: [],
    informationShared: [],
    decisions: [],
    actionIds: [],
    viewsRecordIds: [],
    minute: { status: 'not-started' },
    distribution: [],
    leftOff: input.leftOff && input.leftOff.length > 0 ? input.leftOff : undefined,
  };
}

/** A plan and its actions from a plan input, ids allocated so the process can cite the plan. */
export function buildPlan(process: Process, type: PlanType, input: PlanInput, ctx: TransitionContext): { plan: Plan; actions: Action[] } {
  const planId = ctx.newId('pln');
  const actions: Action[] = input.actions.map((a) => ({
    id: ctx.newId('act'),
    synthetic: true,
    processId: process.id,
    planId,
    title: a.title,
    ownerUserId: a.ownerUserId,
    ownerRoleId: a.ownerRoleId,
    ownerName: a.ownerName,
    ownerAgency: a.ownerAgency,
    due: a.due,
    status: 'open',
    createdAt: ctx.at,
    createdByName: ctx.actor.name,
    createdByUserId: ctx.actor.userId,
  }));
  const plan: Plan = {
    id: planId,
    synthetic: true,
    processId: process.id,
    type,
    title: input.title,
    outcomes: input.outcomes.map((text, i) => ({ id: ctx.newId('out'), text, actionIds: i === 0 ? actions.map((a) => a.id) : [] })),
    coordinatorUserId: input.coordinatorUserId,
    coordinatorName: input.coordinatorName,
    agreedAt: ctx.at.slice(0, 10),
    reviewDate: input.reviewDate,
    status: 'active',
    consentNote: input.consentNote,
  };
  return { plan, actions };
}

/** Shared validations, so every form refuses the same thing the same way. */
export function requireText(value: string | undefined, code: string, min = 10): string[] {
  return (value ?? '').trim().length < min ? [code] : [];
}

export function validateSchedule(input: ScheduleInput | undefined): string[] {
  const errors: string[] = [];
  if (!input) return ['scheduleRequired'];
  if (!input.scheduledAt) errors.push('meetingDateRequired');
  if (!input.chairUserId) errors.push('chairRequired');
  if (input.invitees.length === 0) errors.push('inviteesRequired');
  return errors;
}

export function validatePlan(input: PlanInput | undefined): string[] {
  const errors: string[] = [];
  if (!input) return ['planRequired'];
  errors.push(...requireText(input.title, 'planTitleRequired', 3));
  if (input.outcomes.filter((o) => o.trim().length > 0).length === 0) errors.push('planOutcomeRequired');
  if (!input.coordinatorName) errors.push('planCoordinatorRequired');
  for (const action of input.actions) {
    if (action.title.trim().length < 3 || !action.due) errors.push('actionIncomplete');
  }
  return errors;
}

/** The label a stepper or the drawer shows for where a transition leads. */
export function destinationLabels(process: Pick<Process, 'type'>, transition: Pick<AnyTransition, 'to'>): string[] {
  return transition.to.map((stage) => stageLabel(process.type, stage));
}
