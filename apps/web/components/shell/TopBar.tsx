'use client';

import { useT } from '@mas/messages';
import { AlarmClock, Bell, ChevronDown } from 'lucide-react';
import { useState } from 'react';
import { Badge, IconButton } from '@mas/ui';
import { AppLink } from '@/components/AppLink';
import { PersonaSwitcher } from '@/components/shell/PersonaSwitcher';
import { SearchBox } from '@/components/shell/SearchBox';
import { useNavigate } from '@/lib/router';
import { clocksForUser, unreadSharesForUser, userName } from '@/lib/selectors';
import { useConfig, useCurrentUser, useData, useNow } from '@/lib/store';
import styles from './TopBar.module.css';

export function TopBar() {
  const t = useT();
  const navigate = useNavigate();
  const user = useCurrentUser();
  const data = useData();
  const config = useConfig();
  const now = useNow();
  const [switcherOpen, setSwitcherOpen] = useState(false);

  const clocks = user ? clocksForUser(data, config, user, now).filter((c) => c.daysRemaining <= 7) : [];
  const worst = clocks[0]?.band ?? 'low';
  const unread = user ? unreadSharesForUser(data, user).length : 0;

  return (
    <header className={styles.bar}>
      <SearchBox />
      <AppLink href="/worklist?view=clocks" className={styles.clocks} data-band={worst} aria-label={t('nav.topBar.clocksLabel', { count: clocks.length })}>
        <AlarmClock size={16} aria-hidden="true" />
        <span>{t('nav.topBar.clocksDue', { count: clocks.length })}</span>
      </AppLink>
      <span className={styles.notify}>
        <IconButton aria-label={t('nav.topBar.notifications', { count: unread })} onClick={() => navigate('/sharing?tab=inbound')}>
          <Bell size={18} aria-hidden="true" />
        </IconButton>
        {unread > 0 ? <Badge className={styles.notifyBadge} count={unread} label={t('nav.topBar.unread')} tone="critical" /> : null}
      </span>
      <button type="button" className={styles.persona} onClick={() => setSwitcherOpen(true)} aria-haspopup="dialog" aria-expanded={switcherOpen}>
        <span>{user ? userName(user) : t('nav.topBar.signIn')}</span>
        <span className={styles.demoTag}>{t('nav.topBar.demo')}</span>
        <ChevronDown size={14} aria-hidden="true" />
      </button>
      <PersonaSwitcher open={switcherOpen} onClose={() => setSwitcherOpen(false)} />
    </header>
  );
}
