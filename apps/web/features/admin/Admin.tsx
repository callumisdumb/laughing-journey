'use client';

import { EmptyState } from '@mas/ui';
import { useEffect, type ReactNode } from 'react';
import { AppLink } from '@/components/AppLink';
import { useSelection } from '@/lib/selection';
import { useCurrentUser } from '@/lib/store';
import styles from './Admin.module.css';
import { Agencies } from './Agencies';
import { Defaults } from './Defaults';
import { Forms } from './Forms';
import { Labels } from './Labels';
import { Markings } from './Markings';
import { NeedToKnow } from './NeedToKnow';
import { Overview } from './Overview';
import { SectionHead } from './SectionHead';
import { Timescales } from './Timescales';
import { Users } from './Users';
import { ADMIN_SECTIONS, isAdminSection } from './sections';

export interface AdminProps {
  /** The path segment after /admin, or undefined for the overview. */
  section?: string;
}

/** Local configuration (brief 10.14): a left sub-navigation and one section at a time. */
export function Admin({ section }: AdminProps) {
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
        <SectionHead title="Admin" lede="This section does not exist." />
        <EmptyState title="No such admin section" text={`"${section}" is not an admin section. Choose one from the list.`} />
      </>
    );
  } else {
    switch (section) {
      case 'labels':
        body = <Labels />;
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
        <nav className={styles.subnav} aria-label="Admin sections">
          <AppLink href="/admin" current="exact" className={styles.navLink}>
            Overview
          </AppLink>
          {ADMIN_SECTIONS.map((s) => (
            <AppLink key={s.id} href={`/admin/${s.id}`} current="section" className={styles.navLink}>
              {s.label}
            </AppLink>
          ))}
        </nav>
        <div className={styles.content}>{body}</div>
      </div>
    </div>
  );
}
