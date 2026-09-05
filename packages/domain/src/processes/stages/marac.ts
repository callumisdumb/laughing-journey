import { t } from '@mas/messages';
import type { Agency } from '../../enums';
import type { MaracProcess } from '../../schemas/process';
import { buildMeeting, buildPlan, caseName, moved, outcome, requireText, validatePlan, validateSchedule, type MissingThing, type PlanInput, type ScheduleInput, type Transition } from './shared';
import { chairAndMinuteTaker } from './asp';

/**
 * MARAC, from referral to feedback (task section 1.4).
 *
 * The coordinator schedules the meeting before the research goes out, because the research return
 * counts back from the meeting; each agency records its own return; the meeting is heard in the
 * workspace; the action plan places the flags and considers MATAC and DSDAS; and a concern for any
 * child on the referral opens a child protection case from the action list in one click.
 */
export interface ResearchRequestsInput {
  agencies: Agency[];
  /** The case list wording sent to every agency, which the protocol fixes. */
  wording: string;
  dueAt: string;
}

export interface ResearchReturnInput {
  requestId: string;
  summary: string;
  nothingKnown: boolean;
  /** The three-part confirmation the protocol asks for before anything is shared at MARAC. */
  relevantNecessaryProportionate: boolean;
}

export interface MaracHeardInput {
  meetingId: string;
  informationShared: Array<{ agency: Agency; summary: string }>;
  riskDiscussion: string;
}

export interface MaracActionPlanInput {
  plan: PlanInput;
  flags: Array<{ agency: Agency; system: string; receiptRef: string }>;
  matac: { considered: boolean; referred?: boolean; note?: string };
  dsdas: { considered: boolean; note?: string };
  /** The expiry the flags carry, from the local protocol; defaults to the flag clock rule. */
  flagExpiresAt: string;
}

export interface LinkCpConcernInput {
  childPersonIds: string[];
  summary: string;
}

export interface IdaaFeedbackInput {
  summary: string;
  victimResponse?: string;
}

export interface TransferInput {
  toArea: string;
  receivingCoordinator: string;
}

const PROTOCOL_AGENCIES = ['marac-coordinator', 'domestic-abuse-officer', 'detective-sergeant-ppu', 'social-worker-children', 'social-worker-adults', 'team-leader', 'idaa', 'housing-officer', 'gp', 'health-visitor', 'cp-nurse-adviser', 'education-cp-lead', 'womens-aid-worker', 'midwife', 'cmhn', 'justice-social-worker'] as const;

function meetingScheduled(process: MaracProcess): MissingThing[] {
  return process.detail.meetingId ? [] : [{ code: 'maracMeetingRequired', creates: { kind: 'transition', transition: 'marac-schedule-meeting' } }];
}

export const MARAC_TRANSITIONS: Array<Transition<MaracProcess, never>> = [
  {
    id: 'marac-schedule-meeting',
    process: 'marac',
    from: ['referral', 'research'],
    to: ['referral', 'research'],
    roles: ['marac-coordinator'],
    repeatable: true,
    schedules: ['marac'],
    requires: () => [],
    validate: (input: ScheduleInput) => validateSchedule(input),
    apply: (process, input: ScheduleInput, ctx) => {
      const meeting = buildMeeting(process, 'marac', t('processes.transitions.meetingTitle.marac', { title: caseName(process, ctx), repeat: process.detail.referral.repeat ? 'yes' : 'no' }), input, ctx);
      const summary = t('processes.transitions.summary.scheduled', { title: meeting.title, date: input.scheduledAt.slice(0, 10) });
      const next: MaracProcess = { ...process, detail: { ...process.detail, meetingId: meeting.id } };
      return outcome(next, process.stage, summary, { followOn: [{ kind: 'meeting', meeting }], outbound: null, addMembers: chairAndMinuteTaker(input) });
    },
  },
  {
    id: 'marac-send-research-requests',
    process: 'marac',
    from: ['referral'],
    to: ['research'],
    roles: ['marac-coordinator'],
    requires: meetingScheduled,
    validate: (input: ResearchRequestsInput) => [...(input.agencies.length === 0 ? ['agenciesRequired'] : []), ...requireText(input.wording, 'wordingRequired'), ...(input.dueAt ? [] : ['dateRequired'])],
    apply: (process, input: ResearchRequestsInput, ctx) => {
      const ids = input.agencies.map(() => ctx.newId('req'));
      const researchRequests = [...process.detail.researchRequests, ...input.agencies.map((agency, i) => ({ id: ids[i]!, agency, sentAt: ctx.at, dueAt: input.dueAt, status: 'sent' as const }))];
      const summary = t('processes.transitions.summary.researchSent', { count: input.agencies.length, date: input.dueAt });
      const next: MaracProcess = { ...process, detail: { ...process.detail, researchRequests } };
      return outcome(moved(next, 'research', ctx, summary), 'research', summary, {
        clocks: { completes: [], starts: [{ ruleId: 'marac.research.return', triggeredAt: process.detail.meetingId ? undefined : ctx.at }], note: t('processes.transitions.clockNote.researchSent') },
        followOn: [{ kind: 'requests', ids, agencies: input.agencies, purpose: input.wording, dueAt: input.dueAt }],
      });
    },
  },
  {
    id: 'marac-record-research-return',
    process: 'marac',
    from: ['research'],
    to: ['research'],
    roles: [...PROTOCOL_AGENCIES],
    repeatable: true,
    requires: (process) => (process.detail.researchRequests.some((r) => r.status === 'sent' || r.status === 'overdue') ? [] : [{ code: 'noResearchOutstanding', creates: { kind: 'transition', transition: 'marac-send-research-requests' } }]),
    validate: (input: ResearchReturnInput, process) => {
      const errors: string[] = [];
      const request = process.detail.researchRequests.find((r) => r.id === input.requestId);
      if (!request) errors.push('requestMissing');
      if (!input.nothingKnown) errors.push(...requireText(input.summary, 'summaryRequired'));
      if (!input.relevantNecessaryProportionate) errors.push('proportionalityRequired');
      return errors;
    },
    apply: (process, input: ResearchReturnInput, ctx) => {
      const researchRequests = process.detail.researchRequests.map((r) => (r.id === input.requestId ? { ...r, status: input.nothingKnown ? ('nothing-known' as const) : ('returned' as const), returnSummary: input.nothingKnown ? undefined : input.summary, returnedAt: ctx.at } : r));
      const request = process.detail.researchRequests.find((r) => r.id === input.requestId)!;
      const summary = t('processes.transitions.summary.researchReturned', { agency: request.agency, nothingKnown: input.nothingKnown ? 'yes' : 'no' });
      const next: MaracProcess = { ...process, detail: { ...process.detail, researchRequests } };
      const allBack = researchRequests.every((r) => r.status === 'returned' || r.status === 'nothing-known');
      return outcome(next, 'research', summary, {
        clocks: { completes: allBack ? ['marac.research.return'] : [], starts: [], note: allBack ? t('processes.transitions.clockNote.researchComplete') : undefined },
        followOn: [{ kind: 'request-response', requestId: input.requestId, text: input.nothingKnown ? t('processes.transitions.summary.nothingKnown') : input.summary, nothingKnown: input.nothingKnown }],
        outbound: null,
        addMembers: [{ userId: ctx.actor.userId, caseRole: t('processes.transitions.caseRole.researchAgency'), agency: ctx.actor.agency, reason: t('processes.transitions.caseRole.researchAgencyReason') }],
      });
    },
  },
  {
    id: 'marac-heard',
    process: 'marac',
    from: ['research'],
    to: ['meeting'],
    roles: ['marac-coordinator', 'chair'],
    firedBy: ['marac'],
    requires: meetingScheduled,
    validate: (input: MaracHeardInput) => [...(input.meetingId ? [] : ['meetingRequired']), ...requireText(input.riskDiscussion, 'riskDiscussionRequired'), ...(input.informationShared.length === 0 ? ['informationSharedRequired'] : [])],
    apply: (process, input: MaracHeardInput, ctx) => {
      const summary = t('processes.transitions.summary.maracHeard', { count: input.informationShared.length });
      const researchRequests = process.detail.researchRequests.map((r) => (r.status === 'sent' || r.status === 'overdue' ? { ...r, status: 'nothing-known' as const, returnedAt: ctx.at } : r));
      const next: MaracProcess = { ...process, detail: { ...process.detail, researchRequests, meetingId: input.meetingId } };
      return outcome(moved(next, 'meeting', ctx, summary), 'meeting', summary, {
        clocks: { completes: ['marac.research.return'], starts: [{ ruleId: 'marac.repeat.window' }], note: t('processes.transitions.clockNote.maracHeard') },
        eventType: 'process.marac',
      });
    },
  },
  {
    id: 'marac-record-action-plan',
    process: 'marac',
    from: ['meeting'],
    to: ['action-plan'],
    roles: ['marac-coordinator', 'chair'],
    requires: (process) => (process.stageHistory.some((h) => h.stage === 'meeting') ? [] : [{ code: 'maracNotHeard', creates: { kind: 'transition', transition: 'marac-heard' } }]),
    validate: (input: MaracActionPlanInput) => [...validatePlan(input.plan), ...(input.flagExpiresAt ? [] : ['dateRequired']), ...(input.matac.considered ? [] : ['matacRequired']), ...(input.dsdas.considered ? [] : ['dsdasRequired'])],
    apply: (process, input: MaracActionPlanInput, ctx) => {
      const { plan, actions } = buildPlan(process, 'marac-action', input.plan, ctx);
      const flags = [...process.detail.flags, ...input.flags.map((f) => ({ agency: f.agency, system: f.system, placedAt: ctx.at.slice(0, 10), expiresAt: input.flagExpiresAt, receiptRef: f.receiptRef }))];
      const links = { ...process.detail.links, matacConsidered: true, matacReferredAt: input.matac.referred ? ctx.at.slice(0, 10) : process.detail.links.matacReferredAt, dsdasConsidered: true, dsdasNote: input.dsdas.note ?? process.detail.links.dsdasNote };
      const summary = t('processes.transitions.summary.maracPlan', { actions: actions.length, flags: input.flags.length });
      const next: MaracProcess = { ...process, detail: { ...process.detail, actionPlanId: plan.id, flags, links } };
      return outcome(moved(next, 'action-plan', ctx, summary), 'action-plan', summary, {
        clocks: { completes: [], starts: input.flags.length > 0 ? [{ ruleId: 'marac.flag.expiry' }] : [], note: input.flags.length > 0 ? t('processes.transitions.clockNote.flagsPlaced') : undefined },
        followOn: [{ kind: 'plan', plan, actions }],
      });
    },
  },
  {
    id: 'marac-link-cp-concern',
    process: 'marac',
    from: ['meeting', 'action-plan', 'feedback'],
    to: ['meeting', 'action-plan', 'feedback'],
    roles: ['marac-coordinator', 'social-worker-children', 'team-leader', 'chair'],
    repeatable: true,
    requires: () => [],
    validate: (input: LinkCpConcernInput) => [...(input.childPersonIds.length === 0 ? ['childRequired'] : []), ...requireText(input.summary, 'summaryRequired')],
    // A child the meeting learned of is a child on the referral from then on (D-221): the concern
    // names them, and the referral, the SafeLives return and the matrix's "if there are children"
    // rows all read the same list afterwards.
    apply: (process, input: LinkCpConcernInput) => {
      const childPersonIds = [...process.detail.referral.childPersonIds, ...input.childPersonIds.filter((id) => !process.detail.referral.childPersonIds.includes(id))];
      const summary = t('processes.transitions.summary.cpLinked', { count: input.childPersonIds.length });
      const next: MaracProcess = { ...process, detail: { ...process.detail, referral: { ...process.detail.referral, childPersonIds }, safeLivesReturn: { ...process.detail.safeLivesReturn, childrenCount: childPersonIds.length } } };
      return outcome(next, process.stage, summary, {
        followOn: [{ kind: 'open-process', type: 'cp', subjectIds: input.childPersonIds, summary: input.summary, source: t('processes.transitions.summary.cpSource', { reference: process.reference }) }],
        outbound: null,
      });
    },
  },
  {
    id: 'marac-idaa-feedback',
    process: 'marac',
    from: ['action-plan', 'feedback'],
    to: ['feedback'],
    roles: ['idaa', 'marac-coordinator', 'womens-aid-worker'],
    repeatable: true,
    requires: (process) => (process.detail.actionPlanId ? [] : [{ code: 'maracPlanRequired', creates: { kind: 'transition', transition: 'marac-record-action-plan' } }]),
    validate: (input: IdaaFeedbackInput) => requireText(input.summary, 'summaryRequired'),
    apply: (process, input: IdaaFeedbackInput, ctx) => {
      const summary = t('processes.transitions.summary.idaaFeedback');
      const next: MaracProcess = { ...process, detail: { ...process.detail, idaaFeedback: [...process.detail.idaaFeedback, { at: ctx.at, byName: ctx.actor.name, summary: input.summary, victimResponse: input.victimResponse }] } };
      return outcome(moved(next, 'feedback', ctx, summary), 'feedback', summary, { outbound: null });
    },
  },
  {
    id: 'marac-transfer',
    process: 'marac',
    from: ['referral', 'research', 'meeting', 'action-plan', 'feedback'],
    to: ['transferred'],
    roles: ['marac-coordinator'],
    requires: () => [],
    validate: (input: TransferInput) => [...requireText(input.toArea, 'areaRequired', 3), ...requireText(input.receivingCoordinator, 'coordinatorRequired', 3)],
    apply: (process, input: TransferInput, ctx) => {
      const summary = t('processes.transitions.summary.transferred', { area: input.toArea, coordinator: input.receivingCoordinator });
      const next: MaracProcess = { ...process, status: 'transferred', detail: { ...process.detail, transfer: { toArea: input.toArea, at: ctx.at.slice(0, 10), receivingCoordinator: input.receivingCoordinator } } };
      return outcome(moved(next, 'transferred', ctx, summary), 'transferred', summary, {
        clocks: { completes: process.clocks.filter((c) => !c.completedAt).map((c) => c.ruleId), starts: [], note: summary },
      });
    },
  },
  {
    id: 'marac-close',
    process: 'marac',
    from: ['referral', 'research', 'meeting', 'action-plan', 'feedback'],
    to: ['closed'],
    roles: ['marac-coordinator'],
    via: { kind: 'dialog', dialog: 'close' },
    requires: () => [],
    validate: (input: { reasonId: string; note: string }) => [...(input.reasonId ? [] : ['closureReasonRequired']), ...requireText(input.note, 'closureNoteRequired')],
    apply: (process, input: { reasonId: string; note: string }) => outcome(process, 'closed', t('processes.transitions.summary.close', { reason: input.reasonId }), { followOn: [{ kind: 'close', reasonId: input.reasonId, note: input.note }], outbound: null }),
  },
];
