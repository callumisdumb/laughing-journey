'use client';

import { EmptyState } from '@mas/ui';
import { Hammer } from 'lucide-react';

/** A designed holding screen for routes that a later phase builds. */
export function Placeholder({ title, phase }: { title: string; phase: number }) {
  return (
    <div className="page">
      <div className="page-head">
        <div className="page-head-text">
          <h1>{title}</h1>
          <p className="page-lede">This screen is built in phase {phase}.</p>
        </div>
      </div>
      <EmptyState icon={<Hammer size={22} aria-hidden="true" />} title={`${title} is not built yet`} text="The route, navigation and need-to-know plumbing are in place. The screen arrives in a later phase of the build." />
    </div>
  );
}
