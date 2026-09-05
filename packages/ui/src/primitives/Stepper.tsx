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

/**
 * The stage list, which scrolls rather than compressing.
 *
 * The scrolling lives on a labelled focusable region around the list rather than on the list
 * itself, which is the shape `TableWrap` uses and for the same reason (D-024): a keyboard user who
 * cannot reach a scroll container cannot see what is past its edge, and here that is the stages.
 * The list keeps its own semantics inside it. It only actually overflows in a narrow record, so the
 * product hid this until two of them were drawn side by side in one window.
 */
export function Stepper({ steps, label, className }: { steps: Step[]; label: string; className?: string }) {
  return (
    <div className={cn(styles.wrap, className)} role="region" aria-label={label} tabIndex={0}>
      <ol className={styles.stepper}>
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
    </div>
  );
}
