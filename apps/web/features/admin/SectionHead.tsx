'use client';

import { useT } from '@mas/messages';
import { Lock } from 'lucide-react';
import type { ReactNode } from 'react';
import styles from './SectionHead.module.css';
import { useAdminConfig } from './useAdminConfig';

export interface SectionHeadProps {
  title: string;
  lede: ReactNode;
  actions?: ReactNode;
}

/** Page head for every admin section: kicker, h1, lede and the read-only note for non-admins. */
export function SectionHead({ title, lede, actions }: SectionHeadProps) {
  const t = useT();
  const { canEdit } = useAdminConfig();
  return (
    <div className="page-head">
      <div className="page-head-text">
        <p className={styles.kicker}>{t('admin.title')}</p>
        <h1>{title}</h1>
        <p className="page-lede">{lede}</p>
        {!canEdit ? (
          <p className={styles.readOnly} role="note">
            <Lock size={14} aria-hidden="true" />
            {t('admin.readOnly.note')}
          </p>
        ) : null}
      </div>
      {actions ? <div className={styles.actions}>{actions}</div> : null}
    </div>
  );
}
