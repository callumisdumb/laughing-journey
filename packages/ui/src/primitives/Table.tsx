import { useT } from '@mas/messages';
import type { HTMLAttributes, ReactNode, TableHTMLAttributes } from 'react';
import { cn } from '../cn';
import styles from './Table.module.css';

export interface TableWrapProps extends HTMLAttributes<HTMLDivElement> {
  /** Accessible name for the scrollable region. Wide tables scroll sideways, so the wrapper is a focusable region. */
  label?: string;
}

export function TableWrap({ className, children, label, ...rest }: TableWrapProps) {
  const t = useT();
  return (
    <div className={cn(styles.wrap, className)} role="region" aria-label={label ?? t('common.table.region')} tabIndex={0} {...rest}>
      {children}
    </div>
  );
}

export function Table({ className, children, ...rest }: TableHTMLAttributes<HTMLTableElement>) {
  return (
    <table className={cn(styles.table, className)} {...rest}>
      {children}
    </table>
  );
}

export const tableStyles = styles;

export interface KeyValueItem {
  key: ReactNode;
  value: ReactNode;
}

export function KeyValue({ items, columns = 1, className }: { items: KeyValueItem[]; columns?: 1 | 2; className?: string }) {
  return (
    <dl className={cn(styles.kv, className)} data-columns={columns}>
      {items.map((it, i) => (
        <div key={i} style={{ display: 'contents' }}>
          <dt>{it.key}</dt>
          <dd>{it.value}</dd>
        </div>
      ))}
    </dl>
  );
}
