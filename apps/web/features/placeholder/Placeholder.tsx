'use client';

import { useT } from '@mas/messages';
import { EmptyState } from '@mas/ui';
import { Hammer } from 'lucide-react';

/** A designed holding screen for routes that a later phase builds. */
export function Placeholder({ title, phase }: { title: string; phase: number }) {
  const t = useT();
  return (
    <div className="page">
      <div className="page-head">
        <div className="page-head-text">
          <h1>{title}</h1>
          <p className="page-lede">{t('states.placeholder.lede', { phase })}</p>
        </div>
      </div>
      <EmptyState icon={<Hammer size={22} aria-hidden="true" />} title={t('states.placeholder.title', { title })} text={t('states.placeholder.text')} />
    </div>
  );
}
