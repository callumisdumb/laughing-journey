'use client';

import type { Figure } from './model';
import styles from './FigureGrid.module.css';

/** Headline figures set as display numerals with a plain label, the way the clocks are set. */
export function FigureGrid({ figures }: { figures: Figure[] }) {
  return (
    <dl className={styles.grid}>
      {figures.map((f) => (
        <div key={f.id} className={styles.item}>
          <dt className={styles.label}>
            {f.label}
            {f.note ? <span className={styles.note}>{f.note}</span> : null}
          </dt>
          <dd className={styles.value}>{f.value}</dd>
        </div>
      ))}
    </dl>
  );
}
