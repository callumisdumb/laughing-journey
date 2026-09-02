import type { HTMLAttributes, ReactNode, TableHTMLAttributes } from 'react';
import { cn } from '../cn';
import styles from './Table.module.css';

export function TableWrap({ className, children, ...rest }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={cn(styles.wrap, className)} {...rest}>
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
