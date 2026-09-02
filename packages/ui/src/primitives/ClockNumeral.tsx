import type { RiskBand } from '@mas/domain';
import { AlertOctagon, AlertTriangle, Check } from 'lucide-react';
import type { ReactNode } from 'react';
import { cn } from '../cn';
import styles from './ClockNumeral.module.css';

export interface ClockNumeralProps {
  daysRemaining: number;
  band: RiskBand;
  status: 'running' | 'complete' | 'overdue';
  label: ReactNode;
  /** e.g. "due 14 Sep 2026, from IRD on 20 May" */
  sub?: ReactNode;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

/** A statutory countdown set as typography: numeral, unit, label, trigger. */
export function ClockNumeral({ daysRemaining, band, status, label, sub, size = 'md', className }: ClockNumeralProps) {
  const overdue = status === 'overdue';
  const n = Math.abs(daysRemaining);
  const unit = status === 'complete' ? 'done' : n === 1 ? 'day' : 'days';
  const flag =
    status === 'complete' ? (
      <span className={styles.flag}>
        <Check size={14} aria-hidden="true" /> complete
      </span>
    ) : overdue ? (
      <span className={styles.flag}>
        <AlertOctagon size={14} aria-hidden="true" /> overdue
      </span>
    ) : band === 'high' || band === 'medium' ? (
      <span className={styles.flag}>
        <AlertTriangle size={14} aria-hidden="true" /> due soon
      </span>
    ) : null;
  const labelText = typeof label === 'string' ? label : undefined;
  const srText = labelText === undefined ? undefined : status === 'complete' ? `${labelText}: complete` : overdue ? `${labelText}: ${n} ${unit} overdue` : `${labelText}: ${n} ${unit} remaining`;
  return (
    <div className={cn(styles.clock, className)} data-band={band} data-status={status} data-size={size} aria-label={srText}>
      <span className={styles.numeral} aria-hidden="true">
        {status === 'complete' ? '✓' : n}
      </span>
      <span className={styles.unit} aria-hidden="true">
        {unit}
        {overdue ? ' overdue' : ''}
        {flag}
      </span>
      <span className={styles.label}>{label}</span>
      {sub ? <span className={styles.sub}>{sub}</span> : null}
    </div>
  );
}
