import { sharingNotifications } from '@mas/domain';
import type { BuildContext } from './context';

/**
 * The notifications the seeded state has already produced: one for every share sent to a named
 * person, unread where the share is unread.
 *
 * Nothing else is seeded. A stage moving, an action assigned or a clock falling due is written by
 * the pipeline and the clock engine when it happens, and the standing warnings of the seeded clocks
 * are recorded by the store on first sign-in as already read, so the bell on a fresh seed shows what
 * the sharing inbox showed before notifications existed and nothing the demonstration did not cause
 * (D-207).
 */
export function seedNotifications(ctx: BuildContext): void {
  for (const share of ctx.data.sharingRecords) {
    for (const draft of sharingNotifications(undefined, share)) {
      ctx.data.notifications.push({
        ...draft,
        id: ctx.ids.next('ntf'),
        synthetic: true,
        createdAt: share.sentAt ?? share.createdAt,
        createdByUserId: share.createdByUserId,
        readAt: share.status === 'read' ? (share.readAt ?? share.createdAt) : undefined,
      });
    }
  }
}
