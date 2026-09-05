import { addressedTo, classificationFor, clockRuleLabel, detailLevelLabel, formatDateTime, isExcludedParty, notificationKindLabel, stageLabel, type Classification, type Config, type Dataset, type Notification, type User } from '@mas/domain';
import type { t as translate } from '@mas/messages';

/** The plain translate function, which both the hook's translator and the module-level `t` satisfy. */
type Translate = typeof translate;
import { meetingPath, processPath } from '@/lib/routes';
import { clocksForProcess, userName } from '@/lib/selectors';

/**
 * Notifications, read side.
 *
 * A notification stores a kind and a pointer to its source and nothing else (D-207), so everything
 * a person reads is composed here, at render time, from the catalogue and the record it points at.
 * That is what keeps a notification from carrying content its recipient's level would withhold: a
 * presence-level recipient gets the presence sentence whatever the kind, and the wording of every
 * other sentence is editable in Copy and labels like any other message.
 */
export interface RenderedNotification {
  notification: Notification;
  kindLabel: string;
  text: string;
  /** Where opening it goes. */
  href: string;
  reference?: string;
  processId?: string;
  classification?: Classification;
  unread: boolean;
  time: string;
}

function newestFirst(a: Notification, b: Notification): number {
  return a.createdAt < b.createdAt ? 1 : a.createdAt > b.createdAt ? -1 : 0;
}

/**
 * Whether the case the notification concerns excludes this reader. A role-addressed notification is
 * admissible when one holder may receive it; the check per holder happens here, on the way to the
 * screen, with the same function the pipeline used on the way in.
 */
function excludedFrom(data: Dataset, config: Config, user: User, n: Notification): boolean {
  if (!n.processId) return false;
  const process = data.processes.find((p) => p.id === n.processId);
  if (!process) return false;
  return isExcludedParty(process, { userId: user.id }, config.exclusions, process.stage, data.relationships) !== null;
}

/** Everything addressed to this person, by name or by a role they hold, not dismissed, newest first. */
export function notificationsForUser(data: Dataset, config: Config, user: User): Notification[] {
  return data.notifications.filter((n) => !n.dismissedAt && addressedTo(n, user) && !excludedFrom(data, config, user, n)).sort(newestFirst);
}

export function unreadNotificationsForUser(data: Dataset, config: Config, user: User): Notification[] {
  return notificationsForUser(data, config, user).filter((n) => !n.readAt);
}

/** What this person has been told about one case, newest first. */
export function notificationsForProcess(data: Dataset, config: Config, user: User, processId: string): Notification[] {
  return notificationsForUser(data, config, user).filter((n) => n.processId === processId);
}

/** Unread counts by kind, in the order the kinds were first seen, for the Home summary. */
export function countByKind(list: readonly Notification[]): Array<{ kind: Notification['kind']; count: number }> {
  const counts = new Map<Notification['kind'], number>();
  for (const n of list) counts.set(n.kind, (counts.get(n.kind) ?? 0) + 1);
  return [...counts.entries()].map(([kind, count]) => ({ kind, count }));
}

function hrefFor(n: Notification): string {
  switch (n.sourceType) {
    case 'action':
      return `/actions?action=${n.sourceId}`;
    case 'meeting':
      return meetingPath(n.sourceId);
    case 'sharing':
    case 'request':
      return '/sharing?tab=inbound';
    case 'inbox':
      return `/inbox?event=${n.sourceId}`;
    case 'audit':
      return n.processId ? processPath(n.processId) : '/audit';
    case 'process':
    case 'clock':
    case 'involvement':
    default:
      return n.processId ? processPath(n.processId) : '/';
  }
}

/** The last segment of the key, which is where a stage change and a decision keep their value. */
function keySuffix(n: Notification): string {
  const parts = n.key.split(':');
  return parts.length > 3 ? (parts[parts.length - 1] ?? '') : '';
}

function textFor(t: Translate, data: Dataset, config: Config, n: Notification, now: Date): string {
  if (n.detailLevel === 'presence') return t('notifications.summary.presence');
  const process = n.processId ? data.processes.find((p) => p.id === n.processId) : undefined;
  const reference = process?.reference ?? '';
  const by = n.createdByUserId ? data.users.find((u) => u.id === n.createdByUserId) : undefined;
  const name = by ? userName(by) : t('notifications.summary.someone');
  const level = detailLevelLabel(n.detailLevel);
  switch (n.kind) {
    case 'share':
      return t('notifications.summary.share', { name, reference, level });
    case 'request': {
      if (n.sourceType === 'request') {
        const request = data.informationRequests.find((r) => r.id === n.sourceId);
        return t('notifications.summary.request', { name: request?.fromName ?? name, you: n.toRole ? 'agency' : 'you', reference });
      }
      return t('notifications.summary.request', { name, you: n.toRole ? 'agency' : 'you', reference });
    }
    case 'request-returned': {
      const request = n.sourceType === 'request' ? data.informationRequests.find((r) => r.id === n.sourceId) : undefined;
      return t('notifications.summary.requestReturned', { name: request?.response?.byName ?? name, reference });
    }
    case 'action-assigned':
    case 'action-reassigned':
    case 'action-completed':
    case 'action-due':
    case 'action-overdue': {
      const action = data.actions.find((a) => a.id === n.sourceId);
      const title = action?.title ?? '';
      if (n.kind === 'action-assigned') return t('notifications.summary.actionAssigned', { name, reference, title });
      if (n.kind === 'action-reassigned') return t('notifications.summary.actionReassigned', { name, reference, title });
      if (n.kind === 'action-completed') return t('notifications.summary.actionCompleted', { name, reference, title });
      if (n.kind === 'action-due') return t('notifications.summary.actionDue', { reference, title });
      // The lead hears an overdue action twice by design: once when it falls overdue and once when
      // it has sat there past the escalation interval. The second says so, or the two read the same.
      if (keySuffix(n) === 'escalated') return t('notifications.summary.actionEscalated', { reference, title, owner: action?.ownerName ?? '', days: config.actionEscalationDays });
      return t('notifications.summary.actionOverdue', { reference, title, owner: action?.ownerName ?? '' });
    }
    case 'meeting-invited':
    case 'meeting-changed':
    case 'meeting-cancelled':
    case 'minute-distributed': {
      const meeting = data.meetings.find((m) => m.id === n.sourceId);
      const title = meeting?.title ?? '';
      const date = meeting ? formatDateTime(meeting.scheduledAt) : '';
      if (n.kind === 'meeting-invited') return t('notifications.summary.meetingInvited', { title, date });
      if (n.kind === 'meeting-changed') return t('notifications.summary.meetingChanged', { title, date });
      if (n.kind === 'meeting-cancelled') return t('notifications.summary.meetingCancelled', { title });
      return t('notifications.summary.minuteDistributed', { title, level });
    }
    case 'stage-changed': {
      const stage = process ? stageLabel(process.type, keySuffix(n) || process.stage) : keySuffix(n);
      return t('notifications.summary.stageChanged', { reference, stage, hasName: by ? 'yes' : 'no', name });
    }
    case 'membership-added':
      return t('notifications.summary.membershipAdded', { name, reference });
    case 'membership-removed':
      return t('notifications.summary.membershipRemoved', { name, reference });
    case 'inbox-arrived': {
      const event = data.connectorEvents.find((c) => c.id === n.sourceId);
      return t('notifications.summary.inboxArrived', { title: event?.mapped.title ?? '', system: event?.connectorId ?? '' });
    }
    case 'break-glass':
      return t('notifications.summary.breakGlass', { name, reference });
    case 'classification-raised':
      return t('notifications.summary.classificationRaised', { name, reference });
    case 'exclusion-near-match':
      return t('notifications.summary.exclusionNearMatch', { reference });
    case 'involvement-requested':
      return t('notifications.summary.involvementRequested', { name, reference });
    case 'involvement-decided':
      return t('notifications.summary.involvementDecided', { reference, decision: keySuffix(n) === 'accepted' ? 'accepted' : 'declined' });
    case 'clock-warning':
    case 'clock-breached': {
      const trigger = process?.clocks.find((c) => c.id === n.sourceId);
      const clock = process ? clocksForProcess(data, config, process, now).find((c) => c.triggerId === n.sourceId) : undefined;
      const label = trigger ? clockRuleLabel(trigger.ruleId) : '';
      const date = clock ? formatDateTime(clock.dueAt).slice(0, 11).trim() : '';
      return n.kind === 'clock-warning' ? t('notifications.summary.clockWarning', { clock: label, reference, date }) : t('notifications.summary.clockBreached', { clock: label, reference, date });
    }
    default:
      return t('notifications.summary.presence');
  }
}

export function renderNotification(t: Translate, data: Dataset, config: Config, n: Notification, now: Date): RenderedNotification {
  const process = n.processId ? data.processes.find((p) => p.id === n.processId) : undefined;
  const identifies = n.detailLevel !== 'presence';
  return {
    notification: n,
    kindLabel: identifies ? notificationKindLabel(n.kind) : notificationKindLabel('stage-changed'),
    text: textFor(t, data, config, n, now),
    href: hrefFor(n),
    reference: identifies ? process?.reference : undefined,
    processId: n.processId,
    classification: process ? classificationFor(config, process) : undefined,
    unread: !n.readAt,
    time: formatDateTime(n.createdAt),
  };
}

export interface NotificationGroup {
  key: string;
  processId?: string;
  title?: string;
  items: RenderedNotification[];
}

/** Grouped by case, groups ordered by their newest item, items newest first within each. */
export function groupByCase(items: readonly RenderedNotification[]): NotificationGroup[] {
  const groups = new Map<string, NotificationGroup>();
  for (const item of items) {
    const key = item.processId ?? 'none';
    const group = groups.get(key) ?? { key, processId: item.processId, title: item.reference, items: [] };
    if (!group.title && item.reference) group.title = item.reference;
    group.items.push(item);
    groups.set(key, group);
  }
  return [...groups.values()];
}
