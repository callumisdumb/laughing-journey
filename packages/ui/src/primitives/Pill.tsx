import { useT } from '@mas/messages';
import type { HTMLAttributes, ReactNode } from 'react';
import { cn } from '../cn';
import styles from './Pill.module.css';

export type PillTone = 'neutral' | 'accent' | 'critical' | 'high' | 'medium' | 'low' | 'outline' | 'restricted';

export interface PillProps extends HTMLAttributes<HTMLSpanElement> {
  tone?: PillTone;
  size?: 'sm' | 'md';
  icon?: ReactNode;
}

export function Pill({ tone = 'neutral', size = 'md', icon, className, children, ...rest }: PillProps) {
  return (
    <span className={cn(styles.pill, className)} data-tone={tone} data-size={size} {...rest}>
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
