import type { DetailLevel } from '../enums';
import { computeClock, findClockRule } from '../clocks';
import { workingCalendarFrom } from '../config/default-config';
import { contextFor } from '../permissions/access';
import { isExcludedParty } from '../need-to-know/parties';
import { resolveNeedToKnow } from '../need-to-know/resolve';
import type { Action } from '../schemas/action-plan';
import type { Config, Exclusion } from '../schemas/config';
import type { ConnectorEvent } from '../schemas/connector';
import type { Meeting } from '../schemas/meeting';
import type { Notification, NotificationKind, NotificationRole, NotificationSource } from '../schemas/notification';
import type { Relationship } from '../schemas/person';
import type { Process } from '../schemas/process';
import type { InformationRequest, SharingRecord } from '../schemas/sharing';
import type { User } from '../schemas/user';
import { localDateOf } from '../dates';
import { differenceInCalendarDays, parseISO } from 'date-fns';

/**
 * Who is told what, derived from what a write changed.
 *
 * Every function here is pure and answers one question: given a record before and after a write,
 * which notifications does the change imply? They return drafts rather than records because the
 * pipeline owns the id, the timestamp, the actor, the exclusion check and the de-duplication, and a
 * draft carries only what the change itself knows. Nothing here stores case content: a draft names
 * a source record and a kind, and the summary is rendered from those at read time (D-207).
 *
 * The one rule every function shares is in the key. Two drafts with the same key are the same
 * notification, so a clock re-evaluated on every render raises one warning and a stage change
 * announced to a member is announced once.
 */
export type NotificationDraft = Omit<Notification, 'id' | 'synthetic' | 'createdAt' | 'createdByUserId' | 'readAt' | 'dismissedAt'>;

type Recipient = { toUserId: string } | { toRole: NotificationRole };

function recipientKey(r: Recipient): string {
  return 'toUserId' in r ? r.toUserId : `${r.toRole.agency}:${r.toRole.roleId}`;
}

function draft(kind: NotificationKind, source: NotificationSource, sourceId: string, to: Recipient, extra: { processId?: string; subjectId?: string; detailLevel?: DetailLevel; lawfulBasisId?: string; keySuffix?: string }): NotificationDraft {
  return {
    ...to,
    kind,
    sourceType: source,
    sourceId,
    processId: extra.processId,
    subjectId: extra.subjectId,
    detailLevel: extra.detailLevel ?? 'full',
    lawfulBasisId: extra.lawfulBasisId,
    key: `${kind}:${sourceId}:${recipientKey(to)}${extra.keySuffix ? `:${extra.keySuffix}` : ''}`,
  };
}

/** The owner of an action, as a recipient: a named user, or everybody holding a role in an agency. */
export function actionOwner(action: Pick<Action, 'ownerUserId' | 'ownerRoleId' | 'ownerAgency'>): Recipient | null {
  if (action.ownerUserId) return { toUserId: action.ownerUserId };
  if (action.ownerRoleId) return { toRole: { agency: action.ownerAgency, roleId: action.ownerRoleId } };
  return null;
}

function sameRecipient(a: Recipient | null, b: Recipient | null): boolean {
  if (!a || !b) return a === b;
  return recipientKey(a) === recipientKey(b);
}

export interface ActionContext {
  meetings: readonly Meeting[];
  plans: ReadonlyArray<{ id: string; coordinatorUserId?: string }>;
}

/**
 * An action: assigned when it gains an owner, reassigned when the owner changes (both the new and
 * the previous owner are told), completed to whoever asked for it: the chair of the meeting it came
 * from, the coordinator of the plan it sits under, and the person who created it.
 */
export function actionNotifications(before: Action | undefined, after: Action, ctx: ActionContext): NotificationDraft[] {
  const out: NotificationDraft[] = [];
  const base = { processId: after.processId };
  const was = before ? actionOwner(before) : null;
  const now = actionOwner(after);
  if (now && !sameRecipient(was, now)) {
    if (!before || !was) out.push(draft('action-assigned', 'action', after.id, now, base));
    else {
      out.push(draft('action-reassigned', 'action', after.id, now, { ...base, keySuffix: 'to' }));
      out.push(draft('action-reassigned', 'action', after.id, was, { ...base, keySuffix: 'from' }));
    }
  }
  if (after.status === 'complete' && before?.status !== 'complete') {
    const tell = new Set<string>();
    const chair = after.meetingId ? ctx.meetings.find((m) => m.id === after.meetingId)?.chairUserId : undefined;
    const coordinator = after.planId ? ctx.plans.find((p) => p.id === after.planId)?.coordinatorUserId : undefined;
    for (const userId of [chair, coordinator, after.createdByUserId]) {
      if (!userId || tell.has(userId)) continue;
      tell.add(userId);
      out.push(draft('action-completed', 'action', after.id, { toUserId: userId }, base));
    }
  }
  return out;
}

/**
 * A meeting: invitees are told when they are invited, when the date, time or place moves, and
 * when it is cancelled; a distributed minute tells each recipient at the level they were given.
 * A pre-meeting request lands with the person asked, and its return with the chair.
 */
export function meetingNotifications(before: Meeting | undefined, after: Meeting, sharingRecords: readonly SharingRecord[]): NotificationDraft[] {
  const out: NotificationDraft[] = [];
  const base = { processId: after.processId, subjectId: after.subjectIds[0] };
  const invitedBefore = new Set((before?.invitees ?? []).map((i) => i.userId).filter((id): id is string => Boolean(id)));
  for (const invitee of after.invitees) {
    if (!invitee.userId || invitedBefore.has(invitee.userId)) continue;
    if (after.status === 'cancelled' || after.status === 'held') continue;
    out.push(draft('meeting-invited', 'meeting', after.id, { toUserId: invitee.userId }, base));
  }
  const people = [...after.invitees.map((i) => i.userId), after.chairUserId, after.minuteTakerUserId].filter((id): id is string => Boolean(id));
  if (before && after.status === 'cancelled' && before.status !== 'cancelled') {
    for (const userId of new Set(people)) out.push(draft('meeting-cancelled', 'meeting', after.id, { toUserId: userId }, base));
  } else if (before && after.status === 'scheduled' && (before.scheduledAt !== after.scheduledAt || before.location !== after.location)) {
    const suffix = after.scheduledAt.slice(0, 16);
    for (const userId of new Set(people)) out.push(draft('meeting-changed', 'meeting', after.id, { toUserId: userId }, { ...base, keySuffix: suffix }));
  }
  const distributedBefore = new Set((before?.distribution ?? []).filter((d) => d.sharingRecordId).map((d) => d.id));
  if (after.minute.status === 'distributed') {
    for (const entry of after.distribution) {
      if (!entry.recipientUserId || !entry.sharingRecordId || distributedBefore.has(entry.id)) continue;
      const share = sharingRecords.find((s) => s.id === entry.sharingRecordId);
      out.push(draft('minute-distributed', 'meeting', after.id, { toUserId: entry.recipientUserId }, { ...base, detailLevel: entry.detailLevel, lawfulBasisId: share?.lawfulBasisId, keySuffix: entry.id }));
    }
  }
  const requestsBefore = new Map((before?.preMeetingRequests ?? []).map((r) => [r.id, r]));
  for (const request of after.preMeetingRequests) {
    const previous = requestsBefore.get(request.id);
    if (!previous) {
      const to: Recipient = request.toUserId ? { toUserId: request.toUserId } : { toRole: { agency: request.agency, roleId: 'any' } };
      out.push(draft('request', 'meeting', after.id, to, { ...base, keySuffix: request.id }));
    } else if (previous.status !== request.status && (request.status === 'returned' || request.status === 'nothing-known') && after.chairUserId) {
      out.push(draft('request-returned', 'meeting', after.id, { toUserId: after.chairUserId }, { ...base, keySuffix: request.id }));
    }
  }
  return out;
}

export interface ProcessContext {
  config: Pick<Config, 'needToKnow' | 'exclusions'>;
}

/**
 * A process: a stage change is told to every current member at full detail and to every audience
 * the need-to-know matrix names for the new stage at the level the row gives them; a member
 * joining or leaving is told; a raised marking is told to the case lead; a research request or a
 * pre-meeting return lands with the agency asked and comes back to the lead.
 */
export function processNotifications(before: Process | undefined, after: Process, ctx: ProcessContext): NotificationDraft[] {
  const out: NotificationDraft[] = [];
  const base = { processId: after.id, subjectId: after.subjectIds[0] };
  if (before && before.stage !== after.stage) {
    for (const member of after.members) {
      out.push(draft('stage-changed', 'process', after.id, { toUserId: member.userId }, { ...base, keySuffix: after.stage }));
    }
    const resolution = resolveNeedToKnow(contextFor(after), ctx.config.needToKnow, ctx.config.exclusions);
    for (const recipient of resolution.recipients) {
      out.push(draft('stage-changed', 'process', after.id, { toRole: { agency: recipient.agency, roleId: recipient.role } }, { ...base, detailLevel: recipient.detailLevel, keySuffix: after.stage }));
    }
  }
  const membersBefore = new Set((before?.members ?? []).map((m) => m.userId));
  const membersAfter = new Set(after.members.map((m) => m.userId));
  if (before) {
    for (const member of after.members) if (!membersBefore.has(member.userId)) out.push(draft('membership-added', 'process', after.id, { toUserId: member.userId }, { ...base, keySuffix: member.since }));
    for (const member of before.members) if (!membersAfter.has(member.userId)) out.push(draft('membership-removed', 'process', after.id, { toUserId: member.userId }, { ...base, keySuffix: after.stageHistory.length.toString() }));
  }
  if (after.classificationOverride?.direction === 'raised' && before?.classificationOverride?.at !== after.classificationOverride.at && after.leadUserId) {
    out.push(draft('classification-raised', 'process', after.id, { toUserId: after.leadUserId }, { ...base, keySuffix: after.classificationOverride.at }));
  }
  if (after.type === 'marac') {
    const requestsBefore = new Map((before?.type === 'marac' ? before.detail.researchRequests : []).map((r) => [r.id, r]));
    for (const request of after.detail.researchRequests) {
      const previous = requestsBefore.get(request.id);
      if (!previous) {
        const to: Recipient = request.toUserId ? { toUserId: request.toUserId } : { toRole: { agency: request.agency, roleId: 'any' } };
        out.push(draft('request', 'process', after.id, to, { ...base, keySuffix: request.id }));
      } else if (previous.status !== request.status && (request.status === 'returned' || request.status === 'nothing-known') && after.leadUserId) {
        out.push(draft('request-returned', 'process', after.id, { toUserId: after.leadUserId }, { ...base, keySuffix: request.id }));
      }
    }
  }
  if (after.type === 'mappa') {
    const returnsBefore = new Map((before?.type === 'mappa' ? before.detail.preMeetingReturns : []).map((r) => [`${r.agency}:${r.requestedAt}`, r]));
    for (const ret of after.detail.preMeetingReturns) {
      const key = `${ret.agency}:${ret.requestedAt}`;
      const previous = returnsBefore.get(key);
      if (!previous) out.push(draft('request', 'process', after.id, { toRole: { agency: ret.agency, roleId: 'any' } }, { ...base, keySuffix: key }));
      else if (previous.status !== ret.status && ret.status !== 'requested' && after.leadUserId) out.push(draft('request-returned', 'process', after.id, { toUserId: after.leadUserId }, { ...base, keySuffix: key }));
    }
  }
  return out;
}

/** An information request lands with the person or agency asked; its answer goes back to the asker. */
export function informationRequestNotifications(before: InformationRequest | undefined, after: InformationRequest): NotificationDraft[] {
  const base = { processId: after.processId, subjectId: after.subjectId, lawfulBasisId: after.lawfulBasisId };
  if (!before) {
    const to: Recipient = after.toUserId ? { toUserId: after.toUserId } : { toRole: { agency: after.toAgency, roleId: 'any' } };
    return [draft('request', 'request', after.id, to, base)];
  }
  if (before.status === 'open' && after.status !== 'open' && after.fromUserId) {
    return [draft('request-returned', 'request', after.id, { toUserId: after.fromUserId }, { ...base, keySuffix: after.status })];
  }
  return [];
}

/** A share reaches its recipient the moment it is sent, at the level it was sent at. */
export function sharingNotifications(before: SharingRecord | undefined, after: SharingRecord): NotificationDraft[] {
  if (!after.recipient.userId) return [];
  const sentNow = after.status === 'sent' || after.status === 'read';
  const sentBefore = before ? before.status === 'sent' || before.status === 'read' : false;
  if (!sentNow || sentBefore) return [];
  return [draft('share', 'sharing', after.id, { toUserId: after.recipient.userId }, { processId: after.processId, subjectId: after.subjectId, detailLevel: after.detailLevel, lawfulBasisId: after.lawfulBasisId })];
}

/** A share the need-to-know matrix named on a write, addressed to a person or to a role. */
export interface MatrixShare {
  recipientUserId?: string;
  toRole?: NotificationRole;
  detailLevel?: DetailLevel;
  lawfulBasisId: string;
}

export function matrixShareNotifications(shares: readonly MatrixShare[], process: Process, sourceId: string): NotificationDraft[] {
  const out: NotificationDraft[] = [];
  for (const share of shares) {
    const to: Recipient | null = share.recipientUserId ? { toUserId: share.recipientUserId } : share.toRole ? { toRole: share.toRole } : null;
    if (!to) continue;
    out.push(draft('share', 'process', process.id, to, { processId: process.id, subjectId: process.subjectIds[0], detailLevel: share.detailLevel ?? 'summary', lawfulBasisId: share.lawfulBasisId, keySuffix: sourceId }));
  }
  return out;
}

export interface ClockContext {
  config: Config;
  now: Date;
}

/**
 * The clock engine's half. A running clock inside its rule's warning window raises one warning to
 * the case lead, and one breach when it falls due; the keys carry the trigger so re-evaluation on
 * every tick raises nothing twice.
 */
export function clockNotifications(processes: readonly Process[], ctx: ClockContext): NotificationDraft[] {
  const out: NotificationDraft[] = [];
  const calendar = workingCalendarFrom(ctx.config);
  for (const process of processes) {
    if (process.status !== 'open' || !process.leadUserId) continue;
    for (const trigger of process.clocks) {
      if (trigger.completedAt) continue;
      const rule = findClockRule(ctx.config.clockRules, trigger.ruleId);
      if (!rule) continue;
      const clock = computeClock(trigger, rule, ctx.now, { calendar });
      const base = { processId: process.id, subjectId: process.subjectIds[0] };
      if (clock.status === 'overdue') out.push(draft('clock-breached', 'clock', trigger.id, { toUserId: process.leadUserId }, base));
      else if (clock.daysRemaining <= rule.warnDays) out.push(draft('clock-warning', 'clock', trigger.id, { toUserId: process.leadUserId }, base));
    }
  }
  return out;
}

export interface ActionClockResult {
  drafts: NotificationDraft[];
  /** Actions whose owner's silence has run past the escalation interval and which are not yet escalated. */
  escalate: Action[];
}

/**
 * The other half: an action is due to its owner on the day, overdue to its owner and the case lead
 * the day after, and escalated to the lead once the configured interval has passed without
 * completion. The escalation is recorded on the action, which is the caller's write.
 */
export function actionClockNotifications(actions: readonly Action[], processes: readonly Process[], ctx: ClockContext): ActionClockResult {
  const drafts: NotificationDraft[] = [];
  const escalate: Action[] = [];
  const today = localDateOf(ctx.now);
  for (const action of actions) {
    if (action.status === 'complete' || action.status === 'cancelled') continue;
    const owner = actionOwner(action);
    const process = processes.find((p) => p.id === action.processId);
    const base = { processId: action.processId, subjectId: process?.subjectIds[0] };
    const days = differenceInCalendarDays(parseISO(today), parseISO(action.due));
    if (days === 0 && owner) drafts.push(draft('action-due', 'action', action.id, owner, base));
    if (days > 0) {
      if (owner) drafts.push(draft('action-overdue', 'action', action.id, owner, base));
      // The lead hears it as lead unless the lead is the owner, who has already heard it once.
      const leadIsOwner = owner !== null && 'toUserId' in owner && owner.toUserId === process?.leadUserId;
      if (process?.leadUserId && !leadIsOwner) drafts.push(draft('action-overdue', 'action', action.id, { toUserId: process.leadUserId }, { ...base, keySuffix: 'lead' }));
      if (days >= ctx.config.actionEscalationDays) {
        if (process?.leadUserId) drafts.push(draft('action-overdue', 'action', action.id, { toUserId: process.leadUserId }, { ...base, keySuffix: 'escalated' }));
        if (!action.escalatedAt) escalate.push(action);
      }
    }
  }
  return { drafts, escalate };
}

/**
 * A name added to the case-role register resembles one already on it. The decision is in the
 * ledger; the lead is told to go and look, and nothing about either name travels with the telling.
 */
export function nearMatchNotifications(process: Process, at: string): NotificationDraft[] {
  if (!process.leadUserId) return [];
  return [draft('exclusion-near-match', 'process', process.id, { toUserId: process.leadUserId }, { processId: process.id, subjectId: process.subjectIds[0], keySuffix: at })];
}

/**
 * Break-glass: the case lead hears it in full, and the escrow holders, who answer for emergency
 * access across the partnership, hear it as a summary. The source is the ledger entry, so the
 * notification is a pointer to the record of the act rather than a second record of it.
 */
export function breakGlassNotifications(process: Process, auditId: string, holders: readonly NotificationRole[]): NotificationDraft[] {
  const out: NotificationDraft[] = [];
  const base = { processId: process.id, subjectId: process.subjectIds[0] };
  if (process.leadUserId) out.push(draft('break-glass', 'audit', auditId, { toUserId: process.leadUserId }, base));
  for (const holder of holders) out.push(draft('break-glass', 'audit', auditId, { toRole: holder }, { ...base, detailLevel: 'summary' }));
  return out;
}

/** A connector delivery lands with the agency whose inbox reviews it, as a summary. */
export function inboxNotifications(event: Pick<ConnectorEvent, 'id' | 'agency' | 'subjectId'>): NotificationDraft[] {
  return [draft('inbox-arrived', 'inbox', event.id, { toRole: { agency: event.agency, roleId: 'any' } }, { subjectId: event.subjectId, detailLevel: 'summary' })];
}

export interface AdmissibilityContext {
  /** Whoever caused the write. Never told about their own act. */
  actorUserId?: string;
  process?: Process;
  exclusions: Exclusion[];
  relationships: Relationship[];
  users: readonly User[];
}

/**
 * Whether a draft may be written at all. The actor is never told about their own act, and an
 * excluded party on the case is never a recipient, by the same check that refuses them as a share
 * recipient. A role-addressed draft is admissible when at least one holder of the role is not
 * excluded; the read-side selector applies the same check per holder.
 */
export function admissible(d: NotificationDraft, ctx: AdmissibilityContext): boolean {
  if (d.toUserId) {
    if (d.toUserId === ctx.actorUserId) return false;
    if (ctx.process && isExcludedParty(ctx.process, { userId: d.toUserId }, ctx.exclusions, ctx.process.stage, ctx.relationships)) return false;
    return true;
  }
  if (d.toRole) {
    const holders = ctx.users.filter((u) => holdsRole(u, d.toRole!));
    if (holders.length === 0) return true;
    return holders.some((u) => u.id !== ctx.actorUserId && !(ctx.process && isExcludedParty(ctx.process, { userId: u.id }, ctx.exclusions, ctx.process.stage, ctx.relationships)));
  }
  return false;
}

export function holdsRole(user: Pick<User, 'agency' | 'roleId'>, role: NotificationRole): boolean {
  return user.agency === role.agency && (role.roleId === 'any' || user.roleId === role.roleId);
}

/** Whether a notification is addressed to this user, by name or by the role they hold. */
export function addressedTo(n: Pick<Notification, 'toUserId' | 'toRole'>, user: Pick<User, 'id' | 'agency' | 'roleId'>): boolean {
  if (n.toUserId) return n.toUserId === user.id;
  if (n.toRole) return holdsRole(user, n.toRole);
  return false;
}

