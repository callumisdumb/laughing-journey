'use client';

import { useT } from '@mas/messages';
import { EmptyState } from '@mas/ui';
import { useEffect, type ReactNode } from 'react';
import { AppLink } from '@/components/AppLink';
import { useSelection } from '@/lib/selection';
import { useCurrentUser } from '@/lib/store';
import styles from './Admin.module.css';
import { Agencies } from './Agencies';
import { Copy } from './Copy';
import { Defaults } from './Defaults';
import { Forms } from './Forms';
import { Markings } from './Markings';
import { NeedToKnow } from './NeedToKnow';
import { Overview } from './Overview';
import { SectionHead } from './SectionHead';
import { Timescales } from './Timescales';
import { Users } from './Users';
import { ADMIN_SECTIONS, isAdminSection, sectionLabel } from './sections';

export interface AdminProps {
  /** The path segment after /admin, or undefined for the overview. */
  section?: string;
}

/** Local configuration (brief 10.14): a left sub-navigation and one section at a time. */
export function Admin({ section }: AdminProps) {
  const t = useT();
  const user = useCurrentUser();
  const select = useSelection((s) => s.select);

  useEffect(() => {
    select(null);
  }, [select]);

  if (!user) return null;

  let body: ReactNode;
  if (!section) body = <Overview />;
  else if (!isAdminSection(section)) {
    body = (
      <>
        <SectionHead title={t('admin.title')} lede={t('admin.unknown.lede')} />
        <EmptyState title={t('admin.unknown.emptyTitle')} text={t('admin.unknown.emptyText', { section })} />
      </>
    );
  } else {
    switch (section) {
      case 'labels':
        body = <Copy />;
        break;
      case 'timescales':
        body = <Timescales />;
        break;
      case 'forms':
        body = <Forms />;
        break;
      case 'need-to-know':
        body = <NeedToKnow />;
        break;
      case 'agencies':
        body = <Agencies />;
        break;
      case 'users':
        body = <Users />;
        break;
      case 'markings':
        body = <Markings />;
        break;
      case 'defaults':
        body = <Defaults />;
        break;
    }
  }

  return (
    <div className="page">
      <div className={styles.layout}>
        <nav className={styles.subnav} aria-label={t('admin.nav.label')}>
          <AppLink href="/admin" current="exact" className={styles.navLink}>
            {t('admin.nav.overview')}
          </AppLink>
          {ADMIN_SECTIONS.map((s) => (
            <AppLink key={s.id} href={`/admin/${s.id}`} current="section" className={styles.navLink}>
              {sectionLabel(s.id)}
            </AppLink>
          ))}
        </nav>
        <div className={styles.content}>{body}</div>
      </div>
    </div>
  );
}
