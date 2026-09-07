'use client';

import { agencyLabel, roleLabel } from '@mas/domain';
import { useT } from '@mas/messages';
import { AGENCY_GLYPHS, Badge, Dialog, IconButton, WordmarkGlyph } from '@mas/ui';
import { BarChart3, CalendarDays, ClipboardList, Home, ListChecks, PanelLeftClose, PanelLeftOpen, Plug, Send, Settings2, Users } from 'lucide-react';
import type { ReactNode } from 'react';
import { AppLink } from '@/components/AppLink';
import { useAppearance } from '@/lib/appearance';
import { RAIL_STATE, useLayoutMode } from '@/lib/layout';
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

/**
 * The rail's contents, in one of two forms.
 *
 * `icons` is a real state, not a narrow version of `expanded`: the labels leave the accessible name
 * of the link and reappear as a title, the badge moves to the corner of the icon, and the brand
 * becomes the glyph alone. That distinction is the whole point. The rail used to keep its expanded
 * markup while its grid track shrank to 72px, so the labels were sliced down the middle rather than
 * replaced, and the only thing that decided which happened was a preference in the appearance store
 * that had nothing to do with the width available.
 */
function RailContents({ compact, onNavigate }: { compact: boolean; onNavigate?: () => void }) {
  const t = useT();
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
    <>
      <div className={styles.brand}>
        <WordmarkGlyph size={24} variant="filled" title={t('product.name')} />
        <span className={styles.brandText}>{t('product.name')}</span>
      </div>
      <div className={styles.nav}>
        {items.map((it) => (
          <AppLink key={it.href} href={it.href} className={styles.item} current={it.href === '/' ? 'exact' : 'section'} title={compact ? it.label : undefined} onClick={onNavigate}>
            <span className={styles.icon}>{it.icon}</span>
            <span className={styles.label}>{it.label}</span>
            {it.count && it.waiting ? <Badge className={styles.count} count={it.count} label={it.waiting} /> : null}
          </AppLink>
        ))}
      </div>
      <div className={styles.foot}>
        {user && AgencyGlyph ? (
          <div className={styles.persona} title={compact ? t('nav.rail.personaTitle', { name: userName(user), role: roleLabel(user.roleId) }) : undefined}>
            <span className={styles.icon} style={{ color: `var(--color-agency-${user.agency})` }}>
              <AgencyGlyph size={24} variant="filled" title={compact ? agencyLabel(user.agency) : undefined} />
            </span>
            <span className={styles.personaText}>
              <span className={styles.personaName}>
                {user.givenName} {user.familyName}
              </span>
              <span className={styles.personaRole}>{roleLabel(user.roleId)}</span>
            </span>
          </div>
        ) : null}
      </div>
    </>
  );
}

/**
 * The rail as a column, in the modes that have room for one. `expanded` above 1280, icons below it,
 * and a person can still collapse the expanded one by hand.
 */
export function Rail() {
  const t = useT();
  const mode = useLayoutMode();
  const preference = useAppearance((s) => s.railCollapsed);
  const toggle = useAppearance((s) => s.toggleRail);
  // Below 1280 the icon rail is not a preference, it is the only thing that fits, so the toggle is
  // not offered rather than being offered and ignored.
  const canExpand = RAIL_STATE[mode] === 'expanded';
  const compact = !canExpand || preference;

  return (
    <nav className={styles.rail} data-collapsed={compact ? 'true' : 'false'} aria-label={t('nav.rail.label')}>
      <RailContents compact={compact} />
      {canExpand ? (
        <div className={styles.railToggle}>
          <IconButton className={styles.collapse} aria-label={preference ? t('nav.rail.expand') : t('nav.rail.collapse')} aria-expanded={!preference} onClick={toggle}>
            {preference ? <PanelLeftOpen size={18} aria-hidden="true" /> : <PanelLeftClose size={18} aria-hidden="true" />}
          </IconButton>
        </div>
      ) : null}
    </nav>
  );
}

/**
 * The rail as a panel, below 1024, where a 72px column is a fifth of the screen and the record needs
 * every pixel. The dialog primitive at its `inline-start` placement, so a keyboard user gets Escape
 * and focus return without a second implementation of either. Choosing a destination closes it,
 * because a menu that stays open over the screen you just asked for is a menu you have to dismiss.
 */
export function RailOverlay({ open, onClose }: { open: boolean; onClose: () => void }) {
  const t = useT();
  return (
    <Dialog open={open} onClose={onClose} title={t('nav.rail.label')} placement="inline-start" size="sm" className={styles.overlay}>
      <div className={styles.overlayInner}>
        <RailContents compact={false} onNavigate={onClose} />
      </div>
    </Dialog>
  );
}
