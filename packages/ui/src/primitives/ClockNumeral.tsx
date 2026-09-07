import type { RiskBand } from '@mas/domain';
import { useT } from '@mas/messages';
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
  const t = useT();
  const overdue = status === 'overdue';
  const n = Math.abs(daysRemaining);
  const unit = status === 'complete' ? t('states.clock.unit.done') : overdue ? t('states.clock.unit.overdue', { count: n }) : t('states.clock.unit.days', { count: n });
  const flag =
    status === 'complete' ? (
      <span className={styles.flag}>
        <Check size={14} aria-hidden="true" /> {t('states.clock.flag.complete')}
      </span>
    ) : overdue ? (
      <span className={styles.flag}>
        <AlertOctagon size={14} aria-hidden="true" /> {t('states.clock.flag.overdue')}
      </span>
    ) : band === 'high' || band === 'medium' ? (
      <span className={styles.flag}>
        <AlertTriangle size={14} aria-hidden="true" /> {t('states.clock.flag.dueSoon')}
      </span>
    ) : null;
  const labelText = typeof label === 'string' ? label : undefined;
  const srText = labelText === undefined ? undefined : status === 'complete' ? t('states.clock.sr.complete', { label: labelText }) : overdue ? t('states.clock.sr.overdue', { label: labelText, count: n }) : t('states.clock.sr.remaining', { label: labelText, count: n });
  return (
    <div className={cn(styles.clock, className)} data-band={band} data-status={status} data-size={size} aria-label={srText}>
      <span className={styles.numeral} aria-hidden="true">
        {status === 'complete' ? '✓' : n}
      </span>
      <span className={styles.unit} aria-hidden="true">
        {unit}
        {flag}
      </span>
      <span className={styles.label}>{label}</span>
      {sub ? <span className={styles.sub}>{sub}</span> : null}
    </div>
  );
}
