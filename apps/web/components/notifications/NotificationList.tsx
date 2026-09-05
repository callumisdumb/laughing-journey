'use client';

import { useT } from '@mas/messages';
import { ClassificationTag, IconButton, Pill } from '@mas/ui';
import { X } from 'lucide-react';
import { groupByCase, type RenderedNotification } from '@/lib/notifications';
import styles from './NotificationList.module.css';

interface Props {
  items: readonly RenderedNotification[];
  /** Opening one marks it read and goes to its source. */
  onOpen: (item: RenderedNotification) => void;
  /** Hiding one without deleting it. Absent where the list is a summary rather than the inbox. */
  onDismiss?: (item: RenderedNotification) => void;
  /** Grouped under the case each one is about, newest case first. */
  grouped?: boolean;
  emptyText: string;
}

/**
 * The one rendering of a notification, used by the bell's panel, the Notifications screen, Home and
 * the context drawer, so a notification looks the same wherever a person meets it and the test that
 * finds one finds it the same way everywhere.
 */
export function NotificationList({ items, onOpen, onDismiss, grouped = false, emptyText }: Props) {
  const t = useT();
  if (items.length === 0) return <p className={styles.empty}>{emptyText}</p>;
  const rows = (list: readonly RenderedNotification[]) => (
    <ul className={styles.list}>
      {list.map((item) => (
        <li key={item.notification.id} className={styles.item} data-state={item.unread ? 'unread' : 'read'} data-kind={item.notification.kind} data-testid="notification-item">
          <span className={styles.mark} aria-hidden="true" />
          <button type="button" className={styles.open} onClick={() => onOpen(item)} aria-label={t('notifications.item.open', { text: item.text })}>
            <span className={styles.kind}>
              {item.kindLabel}
              {item.unread ? <span className="visually-hidden">, {t('notifications.item.unread')}</span> : null}
            </span>
            <span className={styles.text}>{item.text}</span>
            <span className={styles.meta}>
              {item.reference ? <Pill size="sm" tone="outline">{item.reference}</Pill> : null}
              {item.classification && item.reference ? <ClassificationTag classification={item.classification} /> : null}
              <span className={styles.time}>{t('notifications.item.time', { date: item.time })}</span>
            </span>
          </button>
          {onDismiss ? (
            <IconButton className={styles.dismiss} aria-label={t('notifications.panel.dismissLabel', { text: item.text })} onClick={() => onDismiss(item)} data-testid="notification-dismiss">
              <X size={16} aria-hidden="true" />
            </IconButton>
          ) : (
            <span />
          )}
        </li>
      ))}
    </ul>
  );
  if (!grouped) return rows(items);
  return (
    <div>
      {groupByCase(items).map((group) => (
        <section key={group.key} className={styles.group} aria-label={group.title ?? t('notifications.groups.noCase')} data-testid="notification-group">
          <h3 className={styles.groupTitle}>{group.title ?? t('notifications.groups.noCase')}</h3>
          {rows(group.items)}
        </section>
      ))}
    </div>
  );
}
