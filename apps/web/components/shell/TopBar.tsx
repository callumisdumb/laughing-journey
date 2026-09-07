'use client';

import { useT } from '@mas/messages';
import { AlarmClock, Bell, ChevronDown, Menu, PanelRightOpen, Plus } from 'lucide-react';
import { useState } from 'react';
import { Badge, Button, IconButton } from '@mas/ui';
import { AppLink } from '@/components/AppLink';
import { CreateMenu } from '@/components/CreateMenu';
import { NotificationsPanel } from '@/components/shell/NotificationsPanel';
import { PersonaSwitcher } from '@/components/shell/PersonaSwitcher';
import { SearchBox } from '@/components/shell/SearchBox';
import { DRAWER_STATE, RAIL_STATE, useChrome, useLayoutMode } from '@/lib/layout';
import { unreadNotificationsForUser } from '@/lib/notifications';
import { clocksForUser, userName } from '@/lib/selectors';
import { useConfig, useCurrentUser, useData, useNow } from '@/lib/store';
import styles from './TopBar.module.css';

export function TopBar() {
  const t = useT();
  const user = useCurrentUser();
  const data = useData();
  const config = useConfig();
  const now = useNow();
  const [switcherOpen, setSwitcherOpen] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const mode = useLayoutMode();
  const railOverlayOpen = useChrome((s) => s.railOverlayOpen);
  const drawerOverlayOpen = useChrome((s) => s.drawerOverlayOpen);
  const setRailOverlayOpen = useChrome((s) => s.setRailOverlayOpen);
  const setDrawerOverlayOpen = useChrome((s) => s.setDrawerOverlayOpen);

  const clocks = user ? clocksForUser(data, config, user, now).filter((c) => c.daysRemaining <= 7) : [];
  const worst = clocks[0]?.band ?? 'low';
  const unread = user ? unreadNotificationsForUser(data, config, user).length : 0;

  return (
    <header className={styles.bar}>
      {/*
        The two buttons that reach the chrome once it stops being a column. They are rendered only in
        the modes where the panel exists, rather than always present and hidden by CSS, so a keyboard
        user never tabs through a control that opens nothing.
      */}
      {RAIL_STATE[mode] === 'overlay' ? (
        <IconButton aria-label={t('nav.topBar.openNavigation')} aria-haspopup="dialog" aria-expanded={railOverlayOpen} onClick={() => setRailOverlayOpen(true)}>
          <Menu size={18} aria-hidden="true" />
        </IconButton>
      ) : null}
      <SearchBox />
      {/*
        The global create action. It sits next to search because the two answer the same question
        from opposite ends: "where is the record" and "there is no record yet". Its accessible name
        is the word and the noun, not the icon, so it reads as an action rather than a plus sign.
      */}
      <Button className={styles.create} variant="primary" icon={<Plus size={16} aria-hidden="true" />} onClick={() => setCreateOpen(true)} aria-haspopup="dialog" aria-expanded={createOpen} data-testid="global-create">
        <span className={styles.createText}>{t('nav.create.action')}</span>
      </Button>
      {/*
        Two forms of the same link. Below 1024 the sentence goes and the number stays, because the
        number is the thing a practitioner scans for and the sentence is what explains it the first
        time. The accessible name carries the whole sentence in both, so nothing is lost to a screen
        reader by the narrow form, and the count stays visible rather than becoming an icon that
        means "some clocks, unspecified".
      */}
      <AppLink href="/worklist?view=clocks" className={styles.clocks} data-band={worst} aria-label={t('nav.topBar.clocksLabel', { count: clocks.length })}>
        <AlarmClock size={16} aria-hidden="true" />
        <span className={styles.clocksText}>{t('nav.topBar.clocksDue', { count: clocks.length })}</span>
        <span className={styles.clocksCount} aria-hidden="true">
          {clocks.length}
        </span>
      </AppLink>
      {DRAWER_STATE[mode] === 'overlay' ? (
        <IconButton aria-label={t('nav.topBar.openContext')} aria-haspopup="dialog" aria-expanded={drawerOverlayOpen} onClick={() => setDrawerOverlayOpen(true)}>
          <PanelRightOpen size={18} aria-hidden="true" />
        </IconButton>
      ) : null}
      {/*
        The bell counts everything unread of every kind and opens the panel rather than a screen,
        because the question it answers is "what happened while I was away" and the answer is a
        list, not a destination. Its name carries the count so a screen reader hears it.
      */}
      <span className={styles.notify}>
        <IconButton aria-label={t('nav.topBar.notifications', { count: unread })} aria-haspopup="dialog" aria-expanded={notificationsOpen} onClick={() => setNotificationsOpen(true)} data-testid="notifications-bell">
          <Bell size={18} aria-hidden="true" />
        </IconButton>
        {unread > 0 ? <Badge className={styles.notifyBadge} count={unread} label={t('nav.topBar.unread')} tone="critical" data-testid="notifications-unread" /> : null}
      </span>
      {/*
        The label is explicit rather than taken from the text, because below 1024 the name and the
        demo tag are hidden and a button whose only content is a chevron has no name at all. It
        contains the visible text word for word at the widths that show it, which is what 2.5.3 asks.
      */}
      <button
        type="button"
        className={styles.persona}
        onClick={() => setSwitcherOpen(true)}
        aria-haspopup="dialog"
        aria-expanded={switcherOpen}
        aria-label={t('nav.topBar.personaLabel', { name: user ? userName(user) : t('nav.topBar.signIn'), demo: t('nav.topBar.demo') })}
      >
        <span className={styles.personaName}>{user ? userName(user) : t('nav.topBar.signIn')}</span>
        <span className={styles.demoTag}>{t('nav.topBar.demo')}</span>
        <ChevronDown size={14} aria-hidden="true" />
      </button>
      <PersonaSwitcher open={switcherOpen} onClose={() => setSwitcherOpen(false)} />
      <NotificationsPanel open={notificationsOpen} onClose={() => setNotificationsOpen(false)} />
      <CreateMenu open={createOpen} onClose={() => setCreateOpen(false)} />
    </header>
  );
}
