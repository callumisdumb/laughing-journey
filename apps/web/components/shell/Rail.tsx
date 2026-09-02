'use client';

import { ROLE_DEFINITIONS } from '@mas/domain';
import { AGENCY_GLYPHS, Badge, IconButton, WordmarkGlyph } from '@mas/ui';
import { BarChart3, CalendarDays, ClipboardList, Home, ListChecks, PanelLeftClose, PanelLeftOpen, Plug, Send, Settings2, Users } from 'lucide-react';
import type { ReactNode } from 'react';
import { AppLink } from '@/components/AppLink';
import { useAppearance } from '@/lib/appearance';
import { actionsForUser, inboxForUser } from '@/lib/selectors';
import { useCurrentUser, useData } from '@/lib/store';
import styles from './Rail.module.css';

interface NavItem {
  href: string;
  label: string;
  icon: ReactNode;
  count?: number;
}

export function Rail() {
  const collapsed = useAppearance((s) => s.railCollapsed);
  const toggle = useAppearance((s) => s.toggleRail);
  const user = useCurrentUser();
  const data = useData();
  const inboxCount = user ? inboxForUser(data, user).length : 0;
  const actionCount = user ? actionsForUser(data, user).length : 0;

  const items: NavItem[] = [
    { href: '/', label: 'Home', icon: <Home size={20} aria-hidden="true" /> },
    { href: '/worklist', label: 'Worklist', icon: <ClipboardList size={20} aria-hidden="true" />, count: inboxCount },
    { href: '/people', label: 'People', icon: <Users size={20} aria-hidden="true" /> },
    { href: '/meetings', label: 'Meetings', icon: <CalendarDays size={20} aria-hidden="true" /> },
    { href: '/actions', label: 'Actions', icon: <ListChecks size={20} aria-hidden="true" />, count: actionCount },
    { href: '/sharing', label: 'Sharing', icon: <Send size={20} aria-hidden="true" /> },
    { href: '/reports', label: 'Reports', icon: <BarChart3 size={20} aria-hidden="true" /> },
    { href: '/connectors', label: 'Connectors', icon: <Plug size={20} aria-hidden="true" /> },
    { href: '/admin', label: 'Admin', icon: <Settings2 size={20} aria-hidden="true" /> },
  ];

  const AgencyGlyph = user ? AGENCY_GLYPHS[user.agency] : null;

  return (
    <nav className={styles.rail} data-collapsed={collapsed ? 'true' : 'false'} aria-label="Main">
      <div className={styles.brand}>
        <WordmarkGlyph size={24} variant="filled" title="Platform" />
        <span className={styles.brandText}>Platform</span>
      </div>
      <div className={styles.nav}>
        {items.map((it) => (
          <AppLink key={it.href} href={it.href} className={styles.item} current={it.href === '/' ? 'exact' : 'section'} title={collapsed ? it.label : undefined}>
            <span className={styles.icon}>{it.icon}</span>
            <span className={styles.label}>{it.label}</span>
            {it.count ? <Badge className={styles.count} count={it.count} label={`${it.label.toLowerCase()} waiting`} /> : null}
          </AppLink>
        ))}
      </div>
      <div className={styles.foot}>
        {user && AgencyGlyph ? (
          <div className={styles.persona} title={collapsed ? `${user.givenName} ${user.familyName}, ${ROLE_DEFINITIONS[user.roleId].label}` : undefined}>
            <span className={styles.icon} style={{ color: `var(--color-agency-${user.agency})` }}>
              <AgencyGlyph size={24} variant="filled" title={collapsed ? user.agency : undefined} />
            </span>
            <span className={styles.personaText}>
              <span className={styles.personaName}>
                {user.givenName} {user.familyName}
              </span>
              <span className={styles.personaRole}>{ROLE_DEFINITIONS[user.roleId].label}</span>
            </span>
          </div>
        ) : null}
        <IconButton className={styles.collapse} aria-label={collapsed ? 'Expand navigation' : 'Collapse navigation'} aria-expanded={!collapsed} onClick={toggle}>
          {collapsed ? <PanelLeftOpen size={18} aria-hidden="true" /> : <PanelLeftClose size={18} aria-hidden="true" />}
        </IconButton>
      </div>
    </nav>
  );
}
