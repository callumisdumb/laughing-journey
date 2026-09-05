import { DEFAULT_CONFIG, actionClockNotifications, clockNotifications, sharingNotifications, type Notification, type NotificationDraft } from '@mas/domain';
import type { BuildContext } from './context';

/**
 * The notifications the seeded state has already produced, so the overlay starts empty and the
 * bell on a fresh seed shows what the demonstration did and nothing the seed was born with.
 *
 * Two kinds. One per share sent to a named person, unread where the share is unread, which is
 * exactly what the old bell counted. And the standing clock warnings and breaches of the seeded
 * clocks and actions at the seeded instant, recorded as already read, with the escalation marker
 * written onto the actions that have sat past the interval. The store re-reads the clocks at boot
 * and refuses every key it already holds, so nothing here is written twice, and a reset that leaves
 * the overlay empty leaves the dataset byte for byte what it was (D-179, D-208).
 */
export function seedNotifications(ctx: BuildContext): void {
  const push = (draft: NotificationDraft, createdAt: string, readAt: string | undefined, createdByUserId?: string) => {
    const record: Notification = { ...draft, id: ctx.ids.next('ntf'), synthetic: true, createdAt, createdByUserId, readAt };
    ctx.data.notifications.push(record);
  };
  for (const share of ctx.data.sharingRecords) {
    for (const draft of sharingNotifications(undefined, share)) {
      push(draft, share.sentAt ?? share.createdAt, share.status === 'read' ? (share.readAt ?? share.createdAt) : undefined, share.createdByUserId);
    }
  }
  const now = new Date(ctx.nowIso);
  // Written in UTC like every timestamp the store writes, so the two sort together.
  const at = now.toISOString();
  for (const draft of clockNotifications(ctx.data.processes, { config: DEFAULT_CONFIG, now })) push(draft, at, at);
  const actions = actionClockNotifications(ctx.data.actions, ctx.data.processes, { config: DEFAULT_CONFIG, now });
  for (const draft of actions.drafts) push(draft, at, at);
  for (const action of actions.escalate) {
    const lead = ctx.data.users.find((u) => u.id === ctx.data.processes.find((p) => p.id === action.processId)?.leadUserId);
    if (!lead) continue;
    action.escalatedAt = at;
    action.escalatedToName = `${lead.givenName} ${lead.familyName}`;
  }
}
