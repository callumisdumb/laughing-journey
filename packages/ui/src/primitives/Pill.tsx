import { useT } from '@mas/messages';
import type { HTMLAttributes, ReactNode } from 'react';
import { cn } from '../cn';
import styles from './Pill.module.css';

export type PillTone = 'neutral' | 'accent' | 'critical' | 'high' | 'medium' | 'low' | 'outline' | 'restricted';

export interface PillProps extends HTMLAttributes<HTMLSpanElement> {
  tone?: PillTone;
  size?: 'sm' | 'md';
  icon?: ReactNode;
  /**
   * Lets the pill wrap to more than one line and take its height from its content.
   *
   * A pill is a short label and its default is one line, but a few carry a whole sentence: a person
   * record's alerts are the case that forced this. "Do not visit alone, previous assault on a
   * visiting worker" truncated to fit a 24px chip is either a sentence running off the edge of a
   * narrow record or, worse, an ellipsis in the middle of a staff safety warning.
   */
  wrap?: boolean;
}

export function Pill({ tone = 'neutral', size = 'md', icon, wrap = false, className, children, ...rest }: PillProps) {
  return (
    <span className={cn(styles.pill, className)} data-tone={tone} data-size={size} data-wrap={wrap ? 'true' : undefined} {...rest}>
      {icon}
      {children}
    </span>
  );
}

export interface BadgeProps extends HTMLAttributes<HTMLSpanElement> {
  count: number;
  tone?: 'accent' | 'critical' | 'neutral';
  /** What is counted, read after the number: "unread", "actions waiting". */
  label: string;
}

export function Badge({ count, tone = 'accent', label, className, ...rest }: BadgeProps) {
  const t = useT();
  return (
    <span className={cn(styles.badge, className)} data-tone={tone} aria-label={t('common.badge.count', { count, label })} {...rest}>
      {count > 99 ? '99+' : count}
    </span>
  );
}
