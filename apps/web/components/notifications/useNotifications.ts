'use client';

import { useT } from '@mas/messages';
import { useCallback, useMemo } from 'react';
import { notificationsForUser, renderNotification, type RenderedNotification } from '@/lib/notifications';
import { useNavigate } from '@/lib/router';
import { useAppStore, useConfig, useCurrentUser, useData, useNow } from '@/lib/store';

/**
 * The persona's notifications, rendered, with the two things a screen does to one.
 *
 * Opening marks it read and goes where it points; dismissing hides it and nothing else. Both are the
 * recipient's own state and are written by the store without a ledger line (D-209): reading a pointer
 * to a record is not reading the record, and the record's own read is audited when it opens.
 */
export function useNotifications(): { items: RenderedNotification[]; unread: number; open: (item: RenderedNotification) => void; dismiss: (item: RenderedNotification) => void; markAllRead: () => void } {
  const t = useT();
  const data = useData();
  const config = useConfig();
  const user = useCurrentUser();
  const now = useNow();
  const navigate = useNavigate();
  const markRead = useAppStore((s) => s.markNotificationRead);
  const markAllRead = useAppStore((s) => s.markAllNotificationsRead);
  const dismissOne = useAppStore((s) => s.dismissNotification);
  const items = useMemo(() => (user ? notificationsForUser(data, config, user).map((n) => renderNotification(t, data, config, n, now)) : []), [data, config, user, t, now]);
  const open = useCallback(
    (item: RenderedNotification) => {
      markRead(item.notification.id);
      navigate(item.href);
    },
    [markRead, navigate],
  );
  const dismiss = useCallback((item: RenderedNotification) => dismissOne(item.notification.id), [dismissOne]);
  return { items, unread: items.filter((i) => i.unread).length, open, dismiss, markAllRead };
}
