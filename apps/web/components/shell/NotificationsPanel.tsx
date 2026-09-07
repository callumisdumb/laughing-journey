'use client';

import { useT } from '@mas/messages';
import { Button, Dialog } from '@mas/ui';
import { AppLink } from '@/components/AppLink';
import { NotificationList } from '@/components/notifications/NotificationList';
import { useNotifications } from '@/components/notifications/useNotifications';
import styles from './NotificationsPanel.module.css';

/**
 * The panel behind the bell: everything the product has told this person, grouped by case, newest
 * first. Opening one marks it read and goes to the thing; Mark all read is here because a bell with
 * forty things in it is a bell nobody looks at.
 */
export function NotificationsPanel({ open, onClose }: { open: boolean; onClose: () => void }) {
  const t = useT();
  const { items, unread, open: openOne, dismiss, markAllRead } = useNotifications();
  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={t('notifications.panel.title')}
      placement="inline-end"
      size="sm"
      className={styles.panel}
      actions={
        <>
          <Button variant="quiet" size="sm" onClick={markAllRead} disabled={unread === 0} data-testid="notifications-mark-all">
            {t('notifications.panel.markAllRead')}
          </Button>
          <AppLink href="/notifications" className={styles.seeAll} onClick={onClose}>
            {t('notifications.panel.seeAll')}
          </AppLink>
        </>
      }
    >
      {/*
        Drawn only while open. A closed dialog is still in the document, and a list of every
        notification sitting hidden on every screen is both wasted work and a trap for anything
        that looks the page up by text.
      */}
      {open ? (
        <div data-testid="notifications-panel">
          <p className={styles.count} aria-live="polite" data-testid="notifications-panel-unread">
            {t('notifications.panel.unread', { count: unread })}
          </p>
          <NotificationList
            items={items}
            grouped
            onOpen={(item) => {
              onClose();
              openOne(item);
            }}
            onDismiss={dismiss}
            emptyText={t('notifications.panel.empty.text')}
          />
        </div>
      ) : null}
    </Dialog>
  );
}
