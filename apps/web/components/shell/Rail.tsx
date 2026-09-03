'use client';

import { agencyLabel, roleLabel } from '@mas/domain';
import { useT } from '@mas/messages';
import { AGENCY_GLYPHS, Badge, IconButton, WordmarkGlyph } from '@mas/ui';
import { BarChart3, CalendarDays, ClipboardList, Home, ListChecks, PanelLeftClose, PanelLeftOpen, Plug, Send, Settings2, Users } from 'lucide-react';
import type { ReactNode } from 'react';
import { AppLink } from '@/components/AppLink';
import { useAppearance } from '@/lib/appearance';
import { actionsForUser, inboxForUser, userName } from '@/lib/selectors';
import { useCurrentUser, useData } from '@/lib/store';
import styles from './Rail.module.css';

interface NavItem {
  href: string;
  label: string;
  icon: ReactNode;
  count?: number;
  /** What the count badge counts, read after the number. */
  waiting?: string;
}

export function Rail() {
  const t = useT();
  const collapsed = useAppearance((s) => s.railCollapsed);
  const toggle = useAppearance((s) => s.toggleRail);
  const user = useCurrentUser();
  const data = useData();
  const inboxCount = user ? inboxForUser(data, user).length : 0;
  const actionCount = user ? actionsForUser(data, user).length : 0;

  const items: NavItem[] = [
    { href: '/', label: t('nav.rail.items.home'), icon: <Home size={20} aria-hidden="true" /> },
    { href: '/worklist', label: t('nav.rail.items.worklist'), icon: <ClipboardList size={20} aria-hidden="true" />, count: inboxCount, waiting: t('nav.rail.waiting.worklist') },
    { href: '/people', label: t('nav.rail.items.people'), icon: <Users size={20} aria-hidden="true" /> },
    { href: '/meetings', label: t('nav.rail.items.meetings'), icon: <CalendarDays size={20} aria-hidden="true" /> },
    { href: '/actions', label: t('nav.rail.items.actions'), icon: <ListChecks size={20} aria-hidden="true" />, count: actionCount, waiting: t('nav.rail.waiting.actions') },
    { href: '/sharing', label: t('nav.rail.items.sharing'), icon: <Send size={20} aria-hidden="true" /> },
    { href: '/reports', label: t('nav.rail.items.reports'), icon: <BarChart3 size={20} aria-hidden="true" /> },
    { href: '/connectors', label: t('nav.rail.items.connectors'), icon: <Plug size={20} aria-hidden="true" /> },
    { href: '/admin', label: t('nav.rail.items.admin'), icon: <Settings2 size={20} aria-hidden="true" /> },
  ];

  const AgencyGlyph = user ? AGENCY_GLYPHS[user.agency] : null;

  return (
    <nav className={styles.rail} data-collapsed={collapsed ? 'true' : 'false'} aria-label={t('nav.rail.label')}>
      <div className={styles.brand}>
        <WordmarkGlyph size={24} variant="filled" title={t('product.name')} />
        <span className={styles.brandText}>{t('product.name')}</span>
      </div>
      <div className={styles.nav}>
        {items.map((it) => (
          <AppLink key={it.href} href={it.href} className={styles.item} current={it.href === '/' ? 'exact' : 'section'} title={collapsed ? it.label : undefined}>
            <span className={styles.icon}>{it.icon}</span>
            <span className={styles.label}>{it.label}</span>
            {it.count && it.waiting ? <Badge className={styles.count} count={it.count} label={it.waiting} /> : null}
          </AppLink>
        ))}
      </div>
      <div className={styles.foot}>
        {user && AgencyGlyph ? (
          <div className={styles.persona} title={collapsed ? t('nav.rail.personaTitle', { name: userName(user), role: roleLabel(user.roleId) }) : undefined}>
            <span className={styles.icon} style={{ color: `var(--color-agency-${user.agency})` }}>
              <AgencyGlyph size={24} variant="filled" title={collapsed ? agencyLabel(user.agency) : undefined} />
            </span>
            <span className={styles.personaText}>
              <span className={styles.personaName}>
                {user.givenName} {user.familyName}
              </span>
              <span className={styles.personaRole}>{roleLabel(user.roleId)}</span>
            </span>
          </div>
        ) : null}
        <IconButton className={styles.collapse} aria-label={collapsed ? t('nav.rail.expand') : t('nav.rail.collapse')} aria-expanded={!collapsed} onClick={toggle}>
          {collapsed ? <PanelLeftOpen size={18} aria-hidden="true" /> : <PanelLeftClose size={18} aria-hidden="true" />}
        </IconButton>
      </div>
    </nav>
  );
}
