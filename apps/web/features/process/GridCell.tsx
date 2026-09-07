'use client';

import type { ReactNode } from 'react';
import { spanAt } from '@/lib/composition';
import { useLayoutMode } from '@/lib/layout';
import styles from './ProcessScreen.module.css';

/**
 * One cell of the process record's grid. A type panel declares the span it takes at `wide` and the
 * cell places it for the mode in force, from the same rule the screen's own cards are packed by
 * (`spanAt`, D-229): the panels are cells of the screen's one grid, not a grid of their own (D-238).
 */
export function GridCell({
  id,
  span,
  children,
}: {
  id: string;
  span: number;
  children: ReactNode;
}) {
  const mode = useLayoutMode();
  const placed = spanAt(span, mode);
  return (
    <div
      className={styles[`span${placed}` as keyof typeof styles]}
      data-card={id}
      data-span={placed}
    >
      {children}
    </div>
  );
}
