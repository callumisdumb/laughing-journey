'use client';

import { useT } from '@mas/messages';
import { ChevronRight } from 'lucide-react';
import { AppLink } from '@/components/AppLink';
import { useTrail } from '@/lib/trail';
import styles from './Trail.module.css';

/**
 * How you got here, as a row of the records passed through.
 *
 * Not a breadcrumb in the usual sense, which describes a hierarchy: these records have no hierarchy,
 * a person leads to a case leads to a colleague leads to another person, and the honest thing to
 * show is the path actually walked. The last entry is the record on screen and is not a link.
 *
 * Hidden when there is nowhere to go back to, rather than showing a single dead entry.
 */
export function Trail() {
  const t = useT();
  const trail = useTrail((s) => s.trail);
  if (trail.length < 2) return null;
  const previous = trail.slice(0, -1);
  const here = trail[trail.length - 1]!;

  return (
    <nav className={styles.trail} aria-label={t('nav.trail.label')}>
      <ol className={styles.list}>
        {previous.map((entry) => (
          <li key={`${entry.kind}:${entry.id}`} className={styles.item}>
            <AppLink href={entry.path} className={styles.link}>
              {entry.label}
            </AppLink>
            <ChevronRight size={13} aria-hidden="true" className={styles.chevron} />
          </li>
        ))}
        <li className={styles.item}>
          <span className={styles.here} aria-current="page">
            {here.label}
          </span>
        </li>
      </ol>
    </nav>
  );
}
