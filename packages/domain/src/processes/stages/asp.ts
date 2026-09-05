import { t } from '@mas/messages';
import { ASP_INQUIRY_ACTIONS, type Agency, type AspInquiryAction, type ConsentStatus } from '../../enums';
import type { AspProcess } from '../../schemas/process';
import { buildMeeting, buildPlan, moved, outcome, requireText, validatePlan, validateSchedule, type MissingThing, type PlanInput, type ScheduleInput, type Transition, type TransitionContext } from './shared';

/**
 * Adult support and protection, from an adult concern to closure (task section 1.2).
 *
 * The screening decision is the team leader's; the inquiry outcome is the council officer's; the
 * case conference outcome is the chair's. The three-point test has to have been done before a case
 * can proceed past screening, because the test is the decision that the Act applies at all.
 */
export interface ScreeningInput {
  outcome: 'no-further-asp-action' | 'proceed-to-inquiry' | 'emergency-action';
  rationale: string;
  /** Where the outcome is no further action: the NMDS action-taken reason the closure carries. */
  closure?: { reasonId: AspInquiryAction; note: string };
}

export interface OpenInquiryInput {
  agenciesToContact: Agency[];
  /** Whether an inter-agency discussion is convened; the store offers the schedule form when it is. */
  interAgencyDiscussion: boolean;
  /** Why the agencies are being asked, which becomes the purpose on each information request. */
  purpose: string;
}

export interface InquiryOutcomeInput {
  outcome: 'no-further-action' | 'support-only' | 'proceed-to-investigation';
  action: AspInquiryAction;
  rationale: string;
  consent?: { status: ConsentStatus; note: string };
  capacity?: { assessed: boolean; summary: string; fluctuates?: boolean };
  unduePressure?: { considered: boolean; found?: boolean; reasoning?: string };
  advocacy?: { offered: boolean; accepted?: boolean; provider?: string; advocateName?: string };
  closure?: { note: string };
}

export type InvestigatoryStepInput =
  | { power: 's7'; attended: string[]; adultPresent: boolean; note: string }
  | { power: 's8'; withPersonId: string; adultDeclined: boolean; note: string }
  | { power: 's9'; practitioner: string; consent: boolean; outcome?: string }
  | { power: 's10'; holder: string; holderAgency: Agency; records: string[]; lawfulBasis: string };

export interface CaseConferenceHeldInput {
  meetingId: string;
  adultAtRisk: boolean;
  protectionPlanNeeded: boolean;
  rationale: string;
}

export interface ReviewHeldInput {
  meetingId?: string;
  decision: 'continue' | 'close';
  newReviewDate?: string;
  rationale: string;
  closure?: { reasonId: AspInquiryAction; note: string };
}

const SCHEDULERS = ['council-officer-asp', 'team-leader', 'chair', 'minute-taker', 'social-worker-adults'] as const;

function threePointTestDone(process: AspProcess): MissingThing[] {
  const test = process.detail.threePointTest;
  // The opening writes the test as unclear on every limb with a placeholder reason, so a limb that
  // has been decided, or an outcome, is what says somebody has done it.
  const done = test.outcome !== 'unclear' || [test.a, test.b, test.c].some((limb) => limb.met !== 'unclear');
  return done ? [] : [{ code: 'threePointTestRequired', creates: { kind: 'dialog', dialog: 'three-point-test' } }];
}

function investigationSkeleton(process: AspProcess, ctx: TransitionContext): NonNullable<AspProcess['detail']['investigation']> {
  return (
    process.detail.investigation ?? {
      councilOfficerUserId: ctx.actor.roleId === 'council-officer-asp' ? ctx.actor.userId : (process.leadUserId ?? ctx.actor.userId),
      visits: [],
      interviews: [],
      recordsRequests: [],
      consent: { status: 'not-sought-risk', note: '' },
      capacity: { assessed: false, summary: '' },
      unduePressure: { considered: false },
      advocacy: { offered: false },
    }
  );
}

export const ASP_TRANSITIONS: Array<Transition<AspProcess, never>> = [
  {
    id: 'asp-screening-decision',
    process: 'asp',
    from: ['concern'],
    to: ['screening', 'investigation'],
    roles: ['team-leader'],
    requires: (process) => (process.detail.screening ? [{ code: 'screeningAlreadyRecorded' }] : []),
    validate: (input: ScreeningInput, process) => {
      const errors = requireText(input.rationale, 'rationaleRequired');
      if (!input.outcome) errors.push('outcomeRequired');
      if (input.outcome !== 'no-further-asp-action') errors.push(...threePointTestDone(process).map((m) => m.code));
      if (input.outcome === 'no-further-asp-action' && !ASP_INQUIRY_ACTIONS.includes(input.closure?.reasonId as AspInquiryAction)) errors.push('closureReasonRequired');
      return errors;
    },
    apply: (process, input: ScreeningInput, ctx) => {
      const summary = t('processes.transitions.summary.aspScreening', { outcome: input.outcome, rationale: input.rationale });
      const screened: AspProcess = { ...process, detail: { ...process.detail, screening: { outcome: input.outcome, rationale: input.rationale, at: ctx.at, byName: ctx.actor.name } } };
      if (input.outcome === 'emergency-action') {
        const next: AspProcess = { ...screened, detail: { ...screened.detail, investigation: investigationSkeleton(screened, ctx) } };
        return outcome(moved(next, 'investigation', ctx, summary), 'investigation', summary, {
          clocks: { completes: ['asp.inquiry.decision'], starts: [], note: t('processes.transitions.clockNote.screeningDecided') },
          followOn: [{ kind: 'offer', creates: { kind: 'dialog', dialog: 'protection-order' } }],
        });
      }
      const result = outcome(moved(screened, 'screening', ctx, summary), 'screening', summary, {
        clocks: { completes: ['asp.inquiry.decision'], starts: [], note: t('processes.transitions.clockNote.screeningDecided') },
      });
      if (input.outcome === 'no-further-asp-action' && input.closure) result.followOn.push({ kind: 'close', reasonId: input.closure.reasonId, note: input.closure.note });
      return result;
    },
  },
  {
    id: 'asp-open-inquiry',
    process: 'asp',
    from: ['screening'],
    to: ['inquiry'],
    roles: ['council-officer-asp', 'team-leader'],
    requires: (process) => (process.detail.screening?.outcome === 'proceed-to-inquiry' ? [] : [{ code: 'screeningNotProceed', creates: { kind: 'transition', transition: 'asp-screening-decision' } }]),
    validate: (input: OpenInquiryInput) => {
      const errors = requireText(input.purpose, 'purposeRequired');
      if (input.agenciesToContact.length === 0) errors.push('agenciesRequired');
      return errors;
    },
    apply: (process, input: OpenInquiryInput, ctx) => {
      const summary = t('processes.transitions.summary.aspInquiryOpened', { count: input.agenciesToContact.length });
      const next: AspProcess = { ...process, detail: { ...process.detail, inquiry: { openedAt: ctx.at, agenciesContacted: input.agenciesToContact, outcome: 'pending' } } };
      const ids = input.agenciesToContact.map(() => ctx.newId('req'));
      const result = outcome(moved(next, 'inquiry', ctx, summary), 'inquiry', summary, {
        clocks: { completes: ['asp.inquiry.decision'], starts: [], note: t('processes.transitions.clockNote.inquiryOpened') },
        followOn: [{ kind: 'requests', ids, agencies: input.agenciesToContact, purpose: input.purpose }],
      });
      if (input.interAgencyDiscussion) result.followOn.push({ kind: 'offer', creates: { kind: 'dialog', dialog: 'schedule-meeting', meetingType: 'asp-inter-agency-discussion' } });
      return result;
    },
  },
  {
    id: 'asp-inquiry-outcome',
    process: 'asp',
    from: ['inquiry'],
    to: ['inquiry', 'support-plan', 'investigation'],
    roles: ['council-officer-asp'],
    requires: (process) => (process.detail.inquiry ? [] : [{ code: 'inquiryNotOpened', creates: { kind: 'transition', transition: 'asp-open-inquiry' } }]),
    validate: (input: InquiryOutcomeInput) => {
      const errors = requireText(input.rationale, 'rationaleRequired');
      if (!input.outcome) errors.push('outcomeRequired');
      if (!ASP_INQUIRY_ACTIONS.includes(input.action)) errors.push('inquiryActionRequired');
      if (input.outcome === 'proceed-to-investigation') {
        if (!input.consent) errors.push('consentRequired');
        if (!input.capacity) errors.push('capacityRequired');
        if (!input.unduePressure?.considered) errors.push('unduePressureRequired');
        if (!input.advocacy) errors.push('advocacyRequired');
      }
      return errors;
    },
    apply: (process, input: InquiryOutcomeInput, ctx) => {
      const summary = t('processes.transitions.summary.aspInquiryOutcome', { outcome: input.outcome, rationale: input.rationale });
      const inquiry = { ...process.detail.inquiry!, outcome: input.outcome, action: input.action, rationale: input.rationale, decidedAt: ctx.at };
      if (input.outcome === 'no-further-action') {
        const next: AspProcess = { ...process, detail: { ...process.detail, inquiry } };
        return outcome(next, 'inquiry', summary, { followOn: [{ kind: 'close', reasonId: input.action, note: input.closure?.note ?? input.rationale }] });
      }
      if (input.outcome === 'support-only') {
        const next: AspProcess = { ...process, detail: { ...process.detail, inquiry } };
        return outcome(moved(next, 'support-plan', ctx, summary), 'support-plan', summary, { followOn: [{ kind: 'offer', creates: { kind: 'dialog', dialog: 'plan', planType: 'adult-support' } }] });
      }
      const investigation = {
        ...investigationSkeleton(process, ctx),
        consent: input.consent!,
        capacity: input.capacity!,
        unduePressure: input.unduePressure!,
        advocacy: input.advocacy!,
      };
      const next: AspProcess = { ...process, detail: { ...process.detail, inquiry, investigation } };
      return outcome(moved(next, 'investigation', ctx, summary), 'investigation', summary);
    },
  },
  {
    id: 'asp-investigatory-step',
    process: 'asp',
    from: ['investigation'],
    to: ['investigation'],
    roles: ['council-officer-asp', 'social-worker-adults'],
    repeatable: true,
    requires: (process) => (process.detail.investigation ? [] : [{ code: 'investigationNotOpened', creates: { kind: 'transition', transition: 'asp-inquiry-outcome' } }]),
    validate: (input: InvestigatoryStepInput) => {
      switch (input.power) {
        case 's7':
          return [...requireText(input.note, 'noteRequired'), ...(input.attended.length === 0 ? ['attendeesRequired'] : [])];
        case 's8':
          return [...requireText(input.note, 'noteRequired'), ...(input.withPersonId ? [] : ['intervieweeRequired'])];
        case 's9':
          return requireText(input.practitioner, 'practitionerRequired', 3);
        case 's10':
          return [...requireText(input.holder, 'holderRequired', 3), ...(input.records.length === 0 ? ['recordsRequired'] : []), ...requireText(input.lawfulBasis, 'lawfulBasisRequired')];
      }
    },
    apply: (process, input: InvestigatoryStepInput, ctx) => {
      const inv = process.detail.investigation!;
      const summary = t('processes.transitions.summary.aspStep', { power: input.power });
      let next: AspProcess;
      const followOn: TransitionOutcomeFollowOn = [];
      switch (input.power) {
        case 's7':
          next = { ...process, detail: { ...process.detail, investigation: { ...inv, visits: [...inv.visits, { at: ctx.at, power: 's7', byNames: input.attended, note: `${input.note}${input.adultPresent ? '' : ` ${t('processes.transitions.summary.adultNotPresent')}`}` }] } } };
          break;
        case 's8':
          next = { ...process, detail: { ...process.detail, investigation: { ...inv, interviews: [...inv.interviews, { at: ctx.at, power: 's8', withPersonId: input.withPersonId, note: input.note, adultDeclined: input.adultDeclined }] } } };
          break;
        case 's9':
          next = { ...process, detail: { ...process.detail, investigation: { ...inv, medicalExamination: { requestedAt: ctx.at, power: 's9', byName: input.practitioner, outcome: input.outcome } } } };
          break;
        case 's10': {
          next = { ...process, detail: { ...process.detail, investigation: { ...inv, recordsRequests: [...inv.recordsRequests, { requestedAt: ctx.at, power: 's10', holder: input.holder, holderAgency: input.holderAgency, status: 'requested', note: input.records.join('; ') }] } } };
          followOn.push({ kind: 'requests', ids: [ctx.newId('req')], agencies: [input.holderAgency], purpose: t('processes.transitions.summary.s10Purpose', { records: input.records.join(', '), basis: input.lawfulBasis }) });
          break;
        }
      }
      return outcome(next, 'investigation', summary, { followOn, outbound: null });
    },
  },
  {
    id: 'asp-schedule-case-conference',
    process: 'asp',
    from: ['investigation'],
    to: ['investigation'],
    roles: [...SCHEDULERS],
    repeatable: true,
    requires: (process) => (process.detail.investigation ? [] : [{ code: 'investigationNotOpened', creates: { kind: 'transition', transition: 'asp-inquiry-outcome' } }]),
    validate: (input: ScheduleInput) => validateSchedule(input),
    apply: (process, input: ScheduleInput, ctx) => {
      const meeting = buildMeeting(process, 'asp-case-conference', t('processes.transitions.meetingTitle.aspCaseConference', { title: process.title }), input, ctx);
      const summary = t('processes.transitions.summary.scheduled', { title: meeting.title, date: input.scheduledAt.slice(0, 10) });
      return outcome(process, 'investigation', summary, { followOn: [{ kind: 'meeting', meeting }], outbound: null, addMembers: chairAndMinuteTaker(input) });
    },
  },
  {
    id: 'asp-case-conference-held',
    process: 'asp',
    from: ['investigation'],
    to: ['case-conference'],
    roles: ['chair', 'council-officer-asp', 'team-leader'],
    firedBy: ['asp-case-conference'],
    requires: (process) => (process.detail.investigation ? [] : [{ code: 'investigationNotOpened', creates: { kind: 'transition', transition: 'asp-inquiry-outcome' } }]),
    validate: (input: CaseConferenceHeldInput) => [...requireText(input.rationale, 'rationaleRequired'), ...(input.meetingId ? [] : ['meetingRequired'])],
    apply: (process, input: CaseConferenceHeldInput, ctx) => {
      const summary = t('processes.transitions.summary.aspConferenceHeld', { atRisk: input.adultAtRisk ? 'yes' : 'no', plan: input.protectionPlanNeeded ? 'yes' : 'no' });
      const next: AspProcess = { ...process, detail: { ...process.detail, caseConference: { meetingId: input.meetingId, heldAt: ctx.at, adultAtRisk: input.adultAtRisk, protectionPlanNeeded: input.protectionPlanNeeded, rationale: input.rationale } } };
      return outcome(moved(next, 'case-conference', ctx, summary), 'case-conference', summary, {
        clocks: { completes: ['asp.caseconference.initial'], starts: [], note: t('processes.transitions.clockNote.conferenceHeld') },
        eventType: 'process.case-conference',
      });
    },
  },
  {
    id: 'asp-record-protection-plan',
    process: 'asp',
    from: ['case-conference'],
    to: ['protection-plan'],
    roles: ['chair', 'council-officer-asp'],
    requires: (process) => (process.detail.caseConference ? [] : [{ code: 'conferenceNotHeld', creates: { kind: 'transition', transition: 'asp-case-conference-held' } }]),
    validate: (input: PlanInput) => [...validatePlan(input), ...(input?.reviewDate ? [] : ['reviewDateRequired'])],
    apply: (process, input: PlanInput, ctx) => {
      const { plan, actions } = buildPlan(process, 'adult-protection', input, ctx);
      const summary = t('processes.transitions.summary.planRecorded', { title: plan.title, count: actions.length });
      const next: AspProcess = { ...process, detail: { ...process.detail, planId: plan.id } };
      return outcome(moved(next, 'protection-plan', ctx, summary), 'protection-plan', summary, {
        clocks: { completes: [], starts: [{ ruleId: 'asp.plan.review', ownerUserId: input.coordinatorUserId }] },
        followOn: [{ kind: 'plan', plan, actions }],
        addMembers: input.coordinatorUserId ? [{ userId: input.coordinatorUserId, caseRole: t('processes.transitions.caseRole.coordinator'), agency: 'social-work', reason: t('processes.transitions.caseRole.coordinatorReason') }] : [],
      });
    },
  },
  {
    id: 'asp-record-support-plan',
    process: 'asp',
    from: ['case-conference', 'support-plan'],
    to: ['support-plan'],
    roles: ['chair', 'council-officer-asp', 'social-worker-adults'],
    requires: () => [],
    validate: (input: PlanInput) => [...validatePlan(input), ...requireText(input?.consentNote, 'consentNoteRequired')],
    apply: (process, input: PlanInput, ctx) => {
      const { plan, actions } = buildPlan(process, 'adult-support', input, ctx);
      const summary = t('processes.transitions.summary.planRecorded', { title: plan.title, count: actions.length });
      const next: AspProcess = { ...process, detail: { ...process.detail, planId: plan.id } };
      return outcome(moved(next, 'support-plan', ctx, summary), 'support-plan', summary, { followOn: [{ kind: 'plan', plan, actions }] });
    },
  },
  {
    id: 'asp-schedule-review',
    process: 'asp',
    from: ['protection-plan', 'support-plan', 'review'],
    to: ['protection-plan', 'support-plan', 'review'],
    roles: [...SCHEDULERS],
    repeatable: true,
    requires: (process) => (process.detail.planId ? [] : [{ code: 'planRequired', creates: { kind: 'dialog', dialog: 'plan' } }]),
    validate: (input: ScheduleInput) => validateSchedule(input),
    apply: (process, input: ScheduleInput, ctx) => {
      const meeting = buildMeeting(process, 'asp-review-conference', t('processes.transitions.meetingTitle.aspReview', { title: process.title }), input, ctx);
      const summary = t('processes.transitions.summary.scheduled', { title: meeting.title, date: input.scheduledAt.slice(0, 10) });
      return outcome(process, process.stage, summary, { followOn: [{ kind: 'meeting', meeting }], outbound: null, addMembers: chairAndMinuteTaker(input) });
    },
  },
  {
    id: 'asp-review-outcome',
    process: 'asp',
    from: ['protection-plan', 'support-plan', 'review'],
    to: ['review'],
    roles: ['chair', 'council-officer-asp', 'team-leader'],
    firedBy: ['asp-review-conference'],
    requires: (process) => (process.detail.planId ? [] : [{ code: 'planRequired', creates: { kind: 'dialog', dialog: 'plan' } }]),
    validate: (input: ReviewHeldInput) => {
      const errors = requireText(input.rationale, 'rationaleRequired');
      if (input.decision === 'continue' && !input.newReviewDate) errors.push('reviewDateRequired');
      if (input.decision === 'close' && !input.closure) errors.push('closureReasonRequired');
      return errors;
    },
    apply: (process, input: ReviewHeldInput, ctx) => {
      const summary = t('processes.transitions.summary.aspReview', { decision: input.decision, rationale: input.rationale });
      const reviews = [...(process.detail.reviews ?? []), { meetingId: input.meetingId, heldAt: ctx.at, decision: input.decision, rationale: input.rationale, newReviewDate: input.newReviewDate }];
      const next: AspProcess = { ...process, detail: { ...process.detail, reviews } };
      if (input.decision === 'close') {
        return outcome(moved(next, 'review', ctx, summary), 'review', summary, { followOn: [{ kind: 'close', reasonId: input.closure!.reasonId, note: input.closure!.note }] });
      }
      return outcome(moved(next, 'review', ctx, summary), 'review', summary, {
        clocks: { completes: ['asp.plan.review'], starts: [{ ruleId: 'asp.plan.review' }], note: t('processes.transitions.clockNote.reviewHeld') },
        followOn: process.detail.planId && input.newReviewDate ? [{ kind: 'plan-review', planId: process.detail.planId, reviewDate: input.newReviewDate }] : [],
      });
    },
  },
  {
    id: 'asp-close',
    process: 'asp',
    from: ['concern', 'screening', 'inquiry', 'investigation', 'case-conference', 'protection-plan', 'support-plan', 'review'],
    to: ['closed'],
    roles: ['council-officer-asp', 'team-leader', 'chair', 'social-worker-adults'],
    via: { kind: 'dialog', dialog: 'close' },
    requires: () => [],
    validate: (input: { reasonId: string; note: string }) => [...(input.reasonId ? [] : ['closureReasonRequired']), ...requireText(input.note, 'closureNoteRequired')],
    apply: (process, input: { reasonId: string; note: string }) => outcome(process, 'closed', t('processes.transitions.summary.close', { reason: input.reasonId }), { followOn: [{ kind: 'close', reasonId: input.reasonId, note: input.note }], outbound: null }),
  },
];

type TransitionOutcomeFollowOn = ReturnType<typeof outcome>['followOn'];

/** The chair and the minute taker join the case when the meeting is scheduled. */
export function chairAndMinuteTaker(input: ScheduleInput): ReturnType<typeof outcome>['addMembers'] {
  const members = [{ userId: input.chairUserId, caseRole: t('processes.transitions.caseRole.chair'), agency: 'social-work' as Agency, reason: t('processes.transitions.caseRole.chairReason') }];
  if (input.minuteTakerUserId) members.push({ userId: input.minuteTakerUserId, caseRole: t('processes.transitions.caseRole.minuteTaker'), agency: 'social-work', reason: t('processes.transitions.caseRole.minuteTakerReason') });
  return members;
}
