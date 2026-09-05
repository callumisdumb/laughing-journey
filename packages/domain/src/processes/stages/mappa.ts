import { t } from '@mas/messages';
import type { Agency } from '../../enums';
import { withMustNotReceive, type MustNotReceiveEntry } from '../../forms/must-not-receive';
import type { MappaDetail, MappaProcess } from '../../schemas/process';
import { buildMeeting, buildPlan, moved, outcome, requireText, validatePlan, validateSchedule, type MissingThing, type PlanInput, type ScheduleInput, type Transition } from './shared';
import { chairAndMinuteTaker } from './asp';

/**
 * MAPPA, from notification to exit (task section 1.5).
 *
 * A level 1 case sits at notification with managed semantics and no meetings; a referral to level 2
 * or 3 needs a current risk assessment and moves it through returns, a meeting and management, and
 * the review cadence comes from the level's own clock. Exit is level down, de-registration or
 * transfer, each with a reason.
 */
export interface ReferLevelInput {
  level: 2 | 3;
  reason: string;
  riskAssessmentId: string;
  referringAuthority: MappaDetail['leadResponsibleAuthority'];
  /** The referral form's own answers, recorded with it (D-225). */
  category?: MappaDetail['category'];
  visorReference?: string;
  imminentRisk?: boolean;
  victimConsiderations?: string;
  /** Anyone the referral names as must not receive, which joins the case-role register. */
  mustNotReceive?: MustNotReceiveEntry[];
  /** How the register labels an entry the referral added, e.g. "the MAPPA referral". */
  via?: string;
}

export interface PreMeetingReturnsInput {
  agencies: Array<{ agency: Agency; contact: string }>;
  dueAt: string;
}

export interface PreMeetingReturnInput {
  agency: Agency;
  summary: string;
  nothingKnown: boolean;
  /** The information request the return answers, where it answers one; the request is marked responded. */
  requestId?: string;
}

export interface MappaMeetingHeldInput {
  meetingId: string;
  level: 1 | 2 | 3;
  levelReason: string;
  rmp: { plan: PlanInput; triggers: string[]; contingencies: string[]; controls: string[]; victimSafety: string; accommodation: string; employment: string; associates: string };
  victimConsiderations: string;
  reviewDate: string;
}

export interface ExitInput {
  kind: 'level-down' | 'deregistration' | 'transfer';
  note: string;
  transferArea?: string;
}

const RESPONSIBLE_AUTHORITIES = ['offender-management', 'justice-social-worker', 'prison-social-worker', 'mappa-coordinator', 'detective-sergeant-ppu'] as const;
const DUTY_TO_COOPERATE = ['housing-officer', 'gp', 'cmhn', 'discharge-coordinator', 'social-worker-adults', 'team-leader', 'education-cp-lead', 'social-worker-children'] as const;

function riskAssessed(process: MappaProcess): MissingThing[] {
  return process.detail.riskAssessmentIds.length > 0 || process.riskAssessmentIds.length > 0 ? [] : [{ code: 'riskAssessmentRequired', creates: { kind: 'dialog', dialog: 'risk-assessment' } }];
}

export const MAPPA_TRANSITIONS: Array<Transition<MappaProcess, never>> = [
  {
    id: 'mappa-refer-level',
    process: 'mappa',
    from: ['notification'],
    to: ['referral'],
    roles: [...RESPONSIBLE_AUTHORITIES],
    via: { kind: 'dialog', dialog: 'mappa-referral' },
    requires: riskAssessed,
    validate: (input: ReferLevelInput, process) => [...requireText(input.reason, 'rationaleRequired'), ...(input.level === 2 || input.level === 3 ? [] : ['levelRequired']), ...([...process.detail.riskAssessmentIds, ...process.riskAssessmentIds].includes(input.riskAssessmentId) ? [] : ['riskAssessmentRequired'])],
    apply: (process, input: ReferLevelInput, ctx) => {
      const summary = t('processes.transitions.summary.mappaReferred', { level: input.level, reason: input.reason });
      const parties = input.mustNotReceive && input.mustNotReceive.length > 0 ? withMustNotReceive(process.parties, input.mustNotReceive, ctx.at.slice(0, 10), input.via ?? '').parties : process.parties;
      const referral = { at: ctx.at, byName: ctx.actor.name, riskAssessmentIds: [input.riskAssessmentId], reason: input.reason, levelSought: input.level, imminentRisk: input.imminentRisk, victimConsiderations: input.victimConsiderations };
      const next: MappaProcess = { ...process, parties, detail: { ...process.detail, referral, leadResponsibleAuthority: input.referringAuthority, category: input.category ?? process.detail.category, visorReference: input.visorReference || process.detail.visorReference } };
      return outcome(moved(next, 'referral', ctx, summary), 'referral', summary, { eventType: 'process.referral' });
    },
  },
  {
    id: 'mappa-request-returns',
    process: 'mappa',
    from: ['referral', 'managed'],
    to: ['pre-meeting'],
    roles: ['mappa-coordinator'],
    requires: (process) => (process.detail.referral ? [] : [{ code: 'mappaNotReferred', creates: { kind: 'transition', transition: 'mappa-refer-level' } }]),
    validate: (input: PreMeetingReturnsInput) => [...(input.agencies.length === 0 ? ['agenciesRequired'] : []), ...(input.dueAt ? [] : ['dateRequired'])],
    apply: (process, input: PreMeetingReturnsInput, ctx) => {
      const requestedAt = ctx.at.slice(0, 10);
      const preMeetingReturns = [...process.detail.preMeetingReturns, ...input.agencies.map((a) => ({ agency: a.agency, contact: a.contact, requestedAt, status: 'requested' as const }))];
      const summary = t('processes.transitions.summary.returnsRequested', { count: input.agencies.length, date: input.dueAt });
      const next: MappaProcess = { ...process, detail: { ...process.detail, preMeetingReturns } };
      return outcome(moved(next, 'pre-meeting', ctx, summary), 'pre-meeting', summary, {
        followOn: [{ kind: 'requests', ids: input.agencies.map(() => ctx.newId('req')), agencies: input.agencies.map((a) => a.agency), purpose: t('processes.transitions.summary.returnPurpose', { reference: process.reference }), dueAt: input.dueAt }],
      });
    },
  },
  {
    id: 'mappa-record-return',
    process: 'mappa',
    from: ['pre-meeting'],
    to: ['pre-meeting'],
    roles: [...RESPONSIBLE_AUTHORITIES, ...DUTY_TO_COOPERATE],
    repeatable: true,
    requires: (process) => (process.detail.preMeetingReturns.some((r) => r.status === 'requested') ? [] : [{ code: 'noReturnsOutstanding', creates: { kind: 'transition', transition: 'mappa-request-returns' } }]),
    validate: (input: PreMeetingReturnInput, process) => [...(process.detail.preMeetingReturns.some((r) => r.agency === input.agency && r.status === 'requested') ? [] : ['requestMissing']), ...(input.nothingKnown ? [] : requireText(input.summary, 'summaryRequired'))],
    apply: (process, input: PreMeetingReturnInput, ctx) => {
      let done = false;
      const preMeetingReturns = process.detail.preMeetingReturns.map((r) => {
        if (done || r.agency !== input.agency || r.status !== 'requested') return r;
        done = true;
        return { ...r, status: input.nothingKnown ? ('nothing-known' as const) : ('returned' as const), summary: input.nothingKnown ? undefined : input.summary };
      });
      const summary = t('processes.transitions.summary.returnRecorded', { agency: input.agency, nothingKnown: input.nothingKnown ? 'yes' : 'no' });
      const next: MappaProcess = { ...process, detail: { ...process.detail, preMeetingReturns } };
      return outcome(next, 'pre-meeting', summary, {
        followOn: input.requestId ? [{ kind: 'request-response', requestId: input.requestId, text: input.nothingKnown ? t('processes.transitions.summary.nothingKnown') : input.summary, nothingKnown: input.nothingKnown }] : [],
        outbound: null,
        addMembers: [{ userId: ctx.actor.userId, caseRole: t('processes.transitions.caseRole.returnAgency'), agency: ctx.actor.agency, reason: t('processes.transitions.caseRole.returnAgencyReason') }],
      });
    },
  },
  {
    id: 'mappa-schedule-meeting',
    process: 'mappa',
    from: ['pre-meeting', 'managed'],
    to: ['meeting'],
    roles: ['mappa-coordinator'],
    schedules: ['mappa-level2', 'mappa-level3'],
    requires: (process) => (process.detail.referral ? [] : [{ code: 'mappaNotReferred', creates: { kind: 'transition', transition: 'mappa-refer-level' } }]),
    validate: (input: ScheduleInput) => validateSchedule(input),
    apply: (process, input: ScheduleInput, ctx) => {
      const type = process.detail.level === 3 ? 'mappa-level3' : 'mappa-level2';
      const meeting = buildMeeting(process, type, t('processes.transitions.meetingTitle.mappa', { level: process.detail.level, reference: process.reference }), input, ctx);
      const summary = t('processes.transitions.summary.scheduled', { title: meeting.title, date: input.scheduledAt.slice(0, 10) });
      const next: MappaProcess = { ...process, detail: { ...process.detail, reviewSchedule: { ...process.detail.reviewSchedule, nextDueAt: input.scheduledAt.slice(0, 10) } } };
      return outcome(moved(next, 'meeting', ctx, summary), 'meeting', summary, { followOn: [{ kind: 'meeting', meeting }], addMembers: chairAndMinuteTaker(input) });
    },
  },
  {
    id: 'mappa-meeting-held',
    process: 'mappa',
    from: ['meeting'],
    to: ['managed'],
    roles: ['chair', 'mappa-coordinator'],
    firedBy: ['mappa-level2', 'mappa-level3'],
    requires: (process) => (process.stage === 'meeting' ? [] : [{ code: 'mappaMeetingRequired', creates: { kind: 'transition', transition: 'mappa-schedule-meeting' } }]),
    validate: (input: MappaMeetingHeldInput) => [...(input.meetingId ? [] : ['meetingRequired']), ...requireText(input.levelReason, 'rationaleRequired'), ...validatePlan(input.rmp?.plan), ...requireText(input.victimConsiderations, 'victimConsiderationsRequired'), ...(input.reviewDate ? [] : ['reviewDateRequired'])],
    apply: (process, input: MappaMeetingHeldInput, ctx) => {
      const { plan, actions } = buildPlan(process, 'mappa-rmp', { ...input.rmp.plan, reviewDate: input.reviewDate }, ctx);
      const summary = t('processes.transitions.summary.mappaHeld', { level: input.level, review: input.reviewDate });
      const rmp = { planId: plan.id, triggers: input.rmp.triggers, contingencies: input.rmp.contingencies, controls: input.rmp.controls, victimSafety: input.rmp.victimSafety, accommodation: input.rmp.accommodation, employment: input.rmp.employment, associates: input.rmp.associates, reviewedAt: ctx.at.slice(0, 10) };
      const levelHistory = input.level === process.detail.level ? process.detail.levelHistory : [...process.detail.levelHistory, { level: input.level, at: ctx.at.slice(0, 10), reason: input.levelReason, meetingId: input.meetingId }];
      const next: MappaProcess = { ...process, detail: { ...process.detail, level: input.level, levelHistory, rmp, reviewSchedule: { lastMeetingId: input.meetingId, lastMeetingAt: ctx.at.slice(0, 10), nextDueAt: input.reviewDate } } };
      const reviewRule = input.level === 3 ? 'mappa.level3.review' : 'mappa.level2.review';
      return outcome(moved(next, 'managed', ctx, summary), 'managed', summary, {
        clocks: { completes: ['mappa.level2.review', 'mappa.level3.review'], starts: input.level === 1 ? [] : [{ ruleId: reviewRule }], note: t('processes.transitions.clockNote.mappaHeld') },
        followOn: [{ kind: 'plan', plan, actions }],
        eventType: 'process.mappa-level',
      });
    },
  },
  {
    id: 'mappa-record-disclosure',
    process: 'mappa',
    from: ['notification', 'managed', 'meeting'],
    to: ['notification', 'managed', 'meeting'],
    roles: ['mappa-coordinator', 'chair', 'offender-management'],
    repeatable: true,
    via: { kind: 'dialog', dialog: 'disclosure' },
    requires: () => [],
    validate: () => [],
    apply: (process) => outcome(process, process.stage, t('processes.transitions.summary.disclosureOffered'), { followOn: [{ kind: 'offer', creates: { kind: 'dialog', dialog: 'disclosure' } }], outbound: null }),
  },
  {
    id: 'mappa-exit',
    process: 'mappa',
    from: ['notification', 'managed'],
    to: ['exit'],
    roles: ['mappa-coordinator', 'chair'],
    requires: () => [],
    validate: (input: ExitInput) => [...(['level-down', 'deregistration', 'transfer'].includes(input.kind) ? [] : ['exitKindRequired']), ...requireText(input.note, 'closureNoteRequired'), ...(input.kind === 'transfer' ? requireText(input.transferArea, 'areaRequired', 3) : [])],
    apply: (process, input: ExitInput, ctx) => {
      const summary = t('processes.transitions.summary.mappaExit', { kind: input.kind, note: input.note });
      const next: MappaProcess = { ...process, detail: { ...process.detail, exit: { at: ctx.at.slice(0, 10), kind: input.kind, note: input.kind === 'transfer' ? `${input.transferArea}: ${input.note}` : input.note } } };
      return outcome(next, 'exit', summary, {
        clocks: { completes: ['mappa.level2.review', 'mappa.level3.review'], starts: [], note: summary },
        followOn: [{ kind: 'close', reasonId: input.kind, note: input.note }],
      });
    },
  },
];
