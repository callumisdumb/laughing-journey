import type { ReactNode } from 'react';
import { cn } from '../cn';
import styles from './Stepper.module.css';

export interface Step {
  id: string;
  label: ReactNode;
  state: 'done' | 'current' | 'upcoming';
  /** e.g. "20 May 2026, DS Mackay" */
  meta?: ReactNode;
}

export function Stepper({ steps, label, className }: { steps: Step[]; label: string; className?: string }) {
  return (
    <ol className={cn(styles.stepper, className)} aria-label={label}>
      {steps.map((s) => (
        <li key={s.id} className={styles.step} data-state={s.state} aria-current={s.state === 'current' ? 'step' : undefined}>
          <div className={styles.track}>
            <span className={styles.dot} aria-hidden="true" />
          </div>
          <span className={styles.label}>{s.label}</span>
          {s.meta ? <span className={styles.meta}>{s.meta}</span> : null}
        </li>
      ))}
    </ol>
  );
}
