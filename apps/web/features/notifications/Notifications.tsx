'use client';

import { useT } from '@mas/messages';
import { Button } from '@mas/ui';
import { useEffect } from 'react';
import { NotificationList } from '@/components/notifications/NotificationList';
import { useNotifications } from '@/components/notifications/useNotifications';
import { ScreenState, useDevState } from '@/components/ScreenState';
import { useSelection } from '@/lib/selection';
import styles from './Notifications.module.css';

/** The bell's panel as a screen, for the person who wants the whole list and the room to read it. */
export function Notifications() {
  const t = useT();
  const { items, unread, open, dismiss, markAllRead } = useNotifications();
  const select = useSelection((s) => s.select);
  const dev = useDevState();

  useEffect(() => {
    select(null);
  }, [select]);

  const state = dev ?? (items.length === 0 ? 'empty' : 'ready');
  return (
    <div className="page">
      <div className="page-head">
        <div className="page-head-text">
          <h1>
            {t('notifications.title')} <span className={styles.count}>{t('notifications.page.unread', { count: unread })}</span>
          </h1>
          <p className="page-lede">{t('notifications.lede')}</p>
        </div>
        <div>
          <Button variant="secondary" onClick={markAllRead} disabled={unread === 0} data-testid="notifications-mark-all">
            {t('notifications.page.markAllRead')}
          </Button>
        </div>
      </div>
      <ScreenState state={state} empty={{ title: t('notifications.panel.empty.title'), text: t('notifications.panel.empty.text') }}>
        <div className={styles.list} data-testid="notifications-screen">
          <NotificationList items={items} grouped onOpen={open} onDismiss={dismiss} emptyText={t('notifications.panel.empty.text')} />
        </div>
      </ScreenState>
    </div>
  );
}
