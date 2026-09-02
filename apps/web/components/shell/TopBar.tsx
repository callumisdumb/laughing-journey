'use client';

import { AlarmClock, Bell, ChevronDown, Search } from 'lucide-react';
import { useState, type FormEvent } from 'react';
import { Badge, IconButton } from '@mas/ui';
import { AppLink } from '@/components/AppLink';
import { PersonaSwitcher } from '@/components/shell/PersonaSwitcher';
import { useNavigate, useRoute } from '@/lib/router';
import { clocksForUser, unreadSharesForUser } from '@/lib/selectors';
import { useConfig, useCurrentUser, useData, useNow } from '@/lib/store';
import styles from './TopBar.module.css';

export function TopBar() {
  const navigate = useNavigate();
  const route = useRoute();
  const user = useCurrentUser();
  const data = useData();
  const config = useConfig();
  const now = useNow();
  const [switcherOpen, setSwitcherOpen] = useState(false);
  const [q, setQ] = useState(route.query.get('q') ?? '');

  const clocks = user ? clocksForUser(data, config, user, now).filter((c) => c.daysRemaining <= 7) : [];
  const worst = clocks[0]?.band ?? 'low';
  const unread = user ? unreadSharesForUser(data, user).length : 0;

  function submit(e: FormEvent) {
    e.preventDefault();
    navigate(`/search?q=${encodeURIComponent(q.trim())}`);
  }

  return (
    <header className={styles.bar}>
      <form className={styles.search} role="search" onSubmit={submit}>
        <span className={styles.searchIcon}>
          <Search size={16} aria-hidden="true" />
        </span>
        <label htmlFor="global-search" className="visually-hidden">
          Search people, cases and reference numbers
        </label>
        <input id="global-search" className={styles.searchInput} type="search" placeholder="Search people, cases, reference numbers" value={q} onChange={(e) => setQ(e.target.value)} autoComplete="off" />
      </form>
      <AppLink href="/worklist?view=clocks" className={styles.clocks} data-band={worst} aria-label={`${clocks.length} statutory clocks due within 7 days`}>
        <AlarmClock size={16} aria-hidden="true" />
        <span>{clocks.length === 0 ? 'No clocks due this week' : `${clocks.length} ${clocks.length === 1 ? 'clock' : 'clocks'} due this week`}</span>
      </AppLink>
      <span className={styles.notify}>
        <IconButton aria-label={`Notifications, ${unread} unread`} onClick={() => navigate('/sharing?tab=inbound')}>
          <Bell size={18} aria-hidden="true" />
        </IconButton>
        {unread > 0 ? <Badge className={styles.notifyBadge} count={unread} label="unread" tone="critical" /> : null}
      </span>
      <button type="button" className={styles.persona} onClick={() => setSwitcherOpen(true)} aria-haspopup="dialog" aria-expanded={switcherOpen}>
        <span>{user ? `${user.givenName} ${user.familyName}` : 'Sign in'}</span>
        <span className={styles.demoTag}>Demo</span>
        <ChevronDown size={14} aria-hidden="true" />
      </button>
      <PersonaSwitcher open={switcherOpen} onClose={() => setSwitcherOpen(false)} />
    </header>
  );
}
