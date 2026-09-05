import { t } from '@mas/messages';
import { londonToIso } from '../../dates';
import type { AwiDetail, AwiProcess } from '../../schemas/process';
import { moved, outcome, requireText, type MissingThing, type Transition } from './shared';

/**
 * Adults with incapacity, from a capacity concern to supervision and closure (task section 1.6).
 *
 * Existing powers are checked before a route is chosen, the route decision records the will and
 * preferences beside the rationale, and an application names its Mental Health Officer, whose report
 * clock starts the day they are told. The court events are recorded as they happen and an order
 * granted starts supervision.
 */
export interface ExistingPowersInput {
  reference: string;
  powerOfAttorney: { exists: boolean; kind?: 'welfare' | 'financial' | 'combined'; attorneyName?: string; registeredAt?: string };
  guardianship: { exists: boolean; guardianName?: string; powers?: string[]; expiresAt?: string };
}

export interface RouteDecisionInput {
  route: NonNullable<AwiDetail['routeDecision']>['route'];
  rationale: string;
  s13za?: { considered: boolean; applied: boolean; reasoning: string; objectionFrom?: string };
  willAndPreferences: { pastWishes: string; presentWishes: string; communicationMethod: string; consultedOthers?: Array<{ personId?: string; name: string; relationship: string; view: string }> };
}

export interface OpenApplicationInput {
  applicant: 'council' | 'private';
  applicantName: string;
  solicitor?: string;
  powersSought: string[];
  mhoUserId: string;
  sheriffCourt: string;
}

export type ReportInput = { kind: 'medical'; practitioner: string; practitionerKind: 'approved-medical-practitioner' | 'medical-practitioner'; receivedAt: string } | { kind: 'mho'; submittedAt: string } | { kind: 'suitability'; receivedAt: string };

export type CourtEventInput =
  | { event: 'lodged'; at: string }
  | { event: 'interim-granted'; at: string; expiresAt: string }
  | { event: 'hearing-set'; at: string }
  | { event: 'order-granted'; at: string; order: { kind: NonNullable<AwiDetail['orders']>[number]['kind']; expiresAt?: string; guardianName: string; powers: string[] } };

export interface BeginSupervisionInput {
  supervisingOfficerUserId: string;
  supervisingOfficerName: string;
  firstVisitAt: string;
}

const ADULT_ROLES = ['social-worker-adults', 'mho', 'team-leader', 'council-officer-asp'] as const;
const APPLICATION_ROUTES = ['intervention-order', 'guardianship-welfare', 'guardianship-financial', 'guardianship-combined'];

function applicationOpen(process: AwiProcess): MissingThing[] {
  return process.detail.application ? [] : [{ code: 'applicationNotOpened', creates: { kind: 'transition', transition: 'awi-open-application' } }];
}

export const AWI_TRANSITIONS: Array<Transition<AwiProcess, never>> = [
  {
    id: 'awi-record-capacity-assessment',
    process: 'awi',
    from: ['capacity-concern', 'existing-powers', 'route-decision', 'application', 'order', 'supervision'],
    to: ['capacity-concern', 'existing-powers', 'route-decision', 'application', 'order', 'supervision'],
    roles: ['mho', 'gp', 'cmhn', 'social-worker-adults', 'team-leader'],
    repeatable: true,
    via: { kind: 'dialog', dialog: 'capacity-assessment' },
    requires: () => [],
    validate: () => [],
    apply: (process) => outcome(process, process.stage, t('processes.transitions.summary.capacityOffered'), { followOn: [{ kind: 'offer', creates: { kind: 'dialog', dialog: 'capacity-assessment' } }], outbound: null }),
  },
  {
    id: 'awi-check-existing-powers',
    process: 'awi',
    from: ['capacity-concern'],
    to: ['existing-powers'],
    roles: [...ADULT_ROLES],
    requires: () => [],
    validate: (input: ExistingPowersInput) => [...requireText(input.reference, 'referenceRequired', 3), ...(input.powerOfAttorney.exists && !input.powerOfAttorney.attorneyName ? ['attorneyRequired'] : []), ...(input.guardianship.exists && !input.guardianship.guardianName ? ['guardianRequired'] : [])],
    apply: (process, input: ExistingPowersInput, ctx) => {
      const summary = t('processes.transitions.summary.powersChecked', { poa: input.powerOfAttorney.exists ? 'yes' : 'no', guardianship: input.guardianship.exists ? 'yes' : 'no' });
      const next: AwiProcess = { ...process, detail: { ...process.detail, opgResult: { checkedAt: ctx.at, reference: input.reference, powerOfAttorney: input.powerOfAttorney, guardianship: input.guardianship } } };
      return outcome(moved(next, 'existing-powers', ctx, summary), 'existing-powers', summary);
    },
  },
  {
    id: 'awi-route-decision',
    process: 'awi',
    from: ['existing-powers'],
    to: ['route-decision'],
    roles: ['mho', 'social-worker-adults', 'team-leader'],
    requires: (process) => {
      const missing: MissingThing[] = [];
      if (!process.detail.opgResult) missing.push({ code: 'powersNotChecked', creates: { kind: 'transition', transition: 'awi-check-existing-powers' } });
      if (process.detail.capacityAssessments.length === 0) missing.push({ code: 'capacityAssessmentRequired', creates: { kind: 'dialog', dialog: 'capacity-assessment' } });
      return missing;
    },
    validate: (input: RouteDecisionInput) => {
      const errors = requireText(input.rationale, 'rationaleRequired');
      if (!input.route) errors.push('routeRequired');
      if (input.route === 's13za' && !input.s13za?.considered) errors.push('s13zaRequired');
      if (input.route === 's13za' && input.s13za?.objectionFrom) errors.push('s13zaObjection');
      errors.push(...requireText(input.willAndPreferences?.presentWishes, 'willAndPreferencesRequired'));
      return errors;
    },
    apply: (process, input: RouteDecisionInput, ctx) => {
      const summary = t('processes.transitions.summary.routeDecided', { route: input.route, rationale: input.rationale });
      const next: AwiProcess = {
        ...process,
        detail: {
          ...process.detail,
          routeDecision: { route: input.route, decidedAt: ctx.at, byName: ctx.actor.name, rationale: input.rationale, s13za: input.s13za },
          willAndPreferences: { recordedAt: ctx.at, byName: ctx.actor.name, pastWishes: input.willAndPreferences.pastWishes, presentWishes: input.willAndPreferences.presentWishes, communicationMethod: input.willAndPreferences.communicationMethod, consultedOthers: input.willAndPreferences.consultedOthers ?? [] },
        },
      };
      const followOn: ReturnType<typeof outcome>['followOn'] = [];
      if (input.route === 'informal-support' || input.route === 'poa-covers' || input.route === 'part5-certificate') followOn.push({ kind: 'offer', creates: { kind: 'dialog', dialog: 'close' } });
      if (input.route === 's13za') followOn.push({ kind: 'offer', creates: { kind: 'transition', transition: 'awi-begin-supervision' } }, { kind: 'offer', creates: { kind: 'dialog', dialog: 'close' } });
      if (APPLICATION_ROUTES.includes(input.route)) followOn.push({ kind: 'offer', creates: { kind: 'transition', transition: 'awi-open-application' } });
      return outcome(moved(next, 'route-decision', ctx, summary), 'route-decision', summary, { followOn });
    },
  },
  {
    id: 'awi-open-application',
    process: 'awi',
    from: ['route-decision'],
    to: ['application'],
    roles: ['mho', 'social-worker-adults', 'team-leader'],
    requires: (process) => (process.detail.routeDecision && APPLICATION_ROUTES.includes(process.detail.routeDecision.route) ? [] : [{ code: 'routeNotApplication', creates: { kind: 'transition', transition: 'awi-route-decision' } }]),
    validate: (input: OpenApplicationInput) => [...requireText(input.applicantName, 'applicantRequired', 3), ...(input.powersSought.length === 0 ? ['powersRequired'] : []), ...(input.mhoUserId ? [] : ['mhoRequired']), ...requireText(input.sheriffCourt, 'courtRequired', 3)],
    apply: (process, input: OpenApplicationInput, ctx) => {
      const summary = t('processes.transitions.summary.applicationOpened', { applicant: input.applicantName, count: input.powersSought.length });
      const next: AwiProcess = {
        ...process,
        detail: {
          ...process.detail,
          application: {
            applicant: input.applicant,
            applicantName: input.applicantName,
            solicitor: input.solicitor,
            powersSought: input.powersSought,
            mhoUserId: input.mhoUserId,
            mhoNotifiedAt: ctx.at,
            mhoReport: { status: 'not-started' },
            medicalReports: [],
            suitabilityReport: { required: input.applicant === 'private', status: input.applicant === 'private' ? 'requested' : 'not-required' },
            court: { sheriffCourt: input.sheriffCourt },
          },
        },
      };
      return outcome(moved(next, 'application', ctx, summary), 'application', summary, {
        clocks: { completes: [], starts: [{ ruleId: 'awi.mho.report', ownerUserId: input.mhoUserId }], note: t('processes.transitions.clockNote.mhoNotified') },
        addMembers: [{ userId: input.mhoUserId, caseRole: t('processes.transitions.caseRole.mho'), agency: 'social-work', reason: t('processes.transitions.caseRole.mhoReason') }],
      });
    },
  },
  {
    id: 'awi-record-report',
    process: 'awi',
    from: ['application'],
    to: ['application'],
    roles: ['mho', 'social-worker-adults', 'team-leader', 'gp'],
    repeatable: true,
    requires: applicationOpen,
    validate: (input: ReportInput) => (input.kind === 'medical' ? requireText(input.practitioner, 'practitionerRequired', 3) : input.kind === 'mho' ? (input.submittedAt ? [] : ['dateRequired']) : input.receivedAt ? [] : ['dateRequired']),
    apply: (process, input: ReportInput, ctx) => {
      const application = process.detail.application!;
      const summary = t('processes.transitions.summary.reportRecorded', { kind: input.kind });
      if (input.kind === 'medical') {
        const next: AwiProcess = { ...process, detail: { ...process.detail, application: { ...application, medicalReports: [...application.medicalReports, { practitioner: input.practitioner, kind: input.practitionerKind, receivedAt: input.receivedAt.slice(0, 10), status: 'received' }] } } };
        return outcome(next, 'application', summary, { outbound: null });
      }
      if (input.kind === 'mho') {
        const next: AwiProcess = { ...process, detail: { ...process.detail, application: { ...application, mhoReport: { status: 'submitted', submittedAt: input.submittedAt } } } };
        return outcome(next, 'application', summary, { clocks: { completes: ['awi.mho.report'], starts: [], note: t('processes.transitions.clockNote.mhoSubmitted') }, outbound: null });
      }
      const next: AwiProcess = { ...process, detail: { ...process.detail, application: { ...application, suitabilityReport: { required: true, status: 'received' } } } };
      void ctx;
      return outcome(next, 'application', summary, { outbound: null });
    },
  },
  {
    id: 'awi-court-event',
    process: 'awi',
    from: ['application'],
    to: ['application', 'order'],
    roles: ['mho', 'social-worker-adults', 'team-leader'],
    repeatable: true,
    requires: applicationOpen,
    validate: (input: CourtEventInput) => {
      const errors: string[] = [];
      if (!input.at) errors.push('dateRequired');
      if (input.event === 'interim-granted' && !input.expiresAt) errors.push('expiryRequired');
      if (input.event === 'order-granted') {
        if (!input.order?.guardianName) errors.push('guardianRequired');
        if ((input.order?.powers ?? []).length === 0) errors.push('powersRequired');
      }
      return errors;
    },
    apply: (process, input: CourtEventInput, ctx) => {
      const application = process.detail.application!;
      const summary = t('processes.transitions.summary.courtEvent', { event: input.event, date: input.at.slice(0, 10) });
      switch (input.event) {
        case 'lodged': {
          const next: AwiProcess = { ...process, detail: { ...process.detail, application: { ...application, court: { ...application.court, lodgedAt: input.at.slice(0, 10) } } } };
          return outcome(next, 'application', summary, { eventType: 'legal.hearing' });
        }
        case 'interim-granted': {
          const next: AwiProcess = { ...process, detail: { ...process.detail, application: { ...application, interimOrder: { soughtAt: application.interimOrder?.soughtAt ?? input.at.slice(0, 10), grantedAt: input.at.slice(0, 10), expiresAt: input.expiresAt, renewals: application.interimOrder ? application.interimOrder.renewals + 1 : 0 } } } };
          // The order is dated, not timed; its clocks run from the start of that day, as an instant.
          const granted = londonToIso(input.at.slice(0, 10), '00:00');
          return outcome(next, 'application', summary, { clocks: { completes: [], starts: [{ ruleId: 'awi.interim.warning', triggeredAt: granted }, { ruleId: 'awi.interim.maximum', triggeredAt: granted }], note: t('processes.transitions.clockNote.interimGranted') }, eventType: 'legal.order-granted' });
        }
        case 'hearing-set': {
          const next: AwiProcess = { ...process, detail: { ...process.detail, application: { ...application, court: { ...application.court, hearingAt: input.at.slice(0, 10) } } } };
          return outcome(next, 'application', summary, { eventType: 'legal.hearing' });
        }
        case 'order-granted': {
          const order = { id: ctx.newId('ord'), kind: input.order.kind, grantedAt: input.at.slice(0, 10), expiresAt: input.order.expiresAt, guardianName: input.order.guardianName, powers: input.order.powers };
          const next: AwiProcess = { ...process, detail: { ...process.detail, orders: [...process.detail.orders, order] } };
          return outcome(moved(next, 'order', ctx, summary), 'order', summary, {
            clocks: { completes: ['awi.interim.warning', 'awi.interim.maximum', 'awi.mho.report'], starts: [], note: t('processes.transitions.clockNote.orderGranted') },
            eventType: 'legal.guardianship',
          });
        }
      }
    },
  },
  {
    id: 'awi-begin-supervision',
    process: 'awi',
    from: ['order', 'route-decision'],
    to: ['supervision'],
    roles: ['social-worker-adults', 'team-leader', 'mho'],
    requires: (process) => (process.detail.orders.length > 0 || process.detail.routeDecision?.route === 's13za' ? [] : [{ code: 'orderRequired', creates: { kind: 'transition', transition: 'awi-court-event' } }]),
    validate: (input: BeginSupervisionInput) => [...(input.supervisingOfficerUserId ? [] : ['supervisingOfficerRequired']), ...(input.firstVisitAt ? [] : ['dateRequired'])],
    apply: (process, input: BeginSupervisionInput, ctx) => {
      const summary = t('processes.transitions.summary.supervisionBegun', { officer: input.supervisingOfficerName, date: input.firstVisitAt.slice(0, 10) });
      const orders = process.detail.orders.map((o, i) => (i === process.detail.orders.length - 1 ? { ...o, supervisingOfficerUserId: input.supervisingOfficerUserId } : o));
      const next: AwiProcess = { ...process, detail: { ...process.detail, orders } };
      return outcome(moved(next, 'supervision', ctx, summary), 'supervision', summary, {
        addMembers: [{ userId: input.supervisingOfficerUserId, caseRole: t('processes.transitions.caseRole.supervisingOfficer'), agency: 'social-work', reason: t('processes.transitions.caseRole.supervisingOfficerReason') }],
      });
    },
  },
  {
    id: 'awi-record-visit',
    process: 'awi',
    from: ['supervision'],
    to: ['supervision'],
    roles: ['social-worker-adults', 'mho', 'team-leader'],
    repeatable: true,
    via: { kind: 'dialog', dialog: 'supervision-visit' },
    requires: () => [],
    validate: () => [],
    apply: (process) => outcome(process, 'supervision', t('processes.transitions.summary.visitOffered'), { followOn: [{ kind: 'offer', creates: { kind: 'dialog', dialog: 'supervision-visit' } }], outbound: null }),
  },
  {
    id: 'awi-record-investigation',
    process: 'awi',
    from: ['capacity-concern', 'existing-powers', 'route-decision', 'application', 'order', 'supervision'],
    to: ['capacity-concern', 'existing-powers', 'route-decision', 'application', 'order', 'supervision'],
    roles: ['social-worker-adults', 'mho', 'team-leader'],
    repeatable: true,
    via: { kind: 'dialog', dialog: 'awi-investigation' },
    requires: () => [],
    validate: () => [],
    apply: (process) => outcome(process, process.stage, t('processes.transitions.summary.investigationOffered'), { followOn: [{ kind: 'offer', creates: { kind: 'dialog', dialog: 'awi-investigation' } }], outbound: null }),
  },
  {
    id: 'awi-close',
    process: 'awi',
    from: ['capacity-concern', 'existing-powers', 'route-decision', 'application', 'order', 'supervision'],
    to: ['closed'],
    roles: ['social-worker-adults', 'mho', 'team-leader'],
    via: { kind: 'dialog', dialog: 'close' },
    requires: () => [],
    validate: (input: { reasonId: string; note: string }) => [...(input.reasonId ? [] : ['closureReasonRequired']), ...requireText(input.note, 'closureNoteRequired')],
    apply: (process, input: { reasonId: string; note: string }) => outcome(process, 'closed', t('processes.transitions.summary.close', { reason: input.reasonId }), { followOn: [{ kind: 'close', reasonId: input.reasonId, note: input.note }], outbound: null }),
  },
];
