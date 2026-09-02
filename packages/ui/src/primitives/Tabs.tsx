import { useId, useRef, type KeyboardEvent, type ReactNode } from 'react';
import styles from './Tabs.module.css';

export interface TabItem {
  id: string;
  label: ReactNode;
  count?: number;
}

export interface TabsProps {
  items: TabItem[];
  value: string;
  onChange: (id: string) => void;
  label: string;
  idPrefix?: string;
}

export function Tabs({ items, value, onChange, label, idPrefix }: TabsProps) {
  const generated = useId();
  const prefix = idPrefix ?? generated;
  const refs = useRef<Array<HTMLButtonElement | null>>([]);

  function onKeyDown(e: KeyboardEvent<HTMLButtonElement>, index: number) {
    const last = items.length - 1;
    let next = index;
    if (e.key === 'ArrowRight') next = index === last ? 0 : index + 1;
    else if (e.key === 'ArrowLeft') next = index === 0 ? last : index - 1;
    else if (e.key === 'Home') next = 0;
    else if (e.key === 'End') next = last;
    else return;
    e.preventDefault();
    const item = items[next];
    if (item) {
      onChange(item.id);
      refs.current[next]?.focus();
    }
  }

  return (
    <div role="tablist" aria-label={label} className={styles.list}>
      {items.map((item, i) => (
        <button
          key={item.id}
          ref={(el) => {
            refs.current[i] = el;
          }}
          type="button"
          role="tab"
          id={`${prefix}-tab-${item.id}`}
          aria-selected={value === item.id}
          aria-controls={`${prefix}-panel-${item.id}`}
          tabIndex={value === item.id ? 0 : -1}
          className={styles.tab}
          onClick={() => onChange(item.id)}
          onKeyDown={(e) => onKeyDown(e, i)}
        >
          {item.label}
          {item.count !== undefined ? <span className={styles.count}>{item.count}</span> : null}
        </button>
      ))}
    </div>
  );
}

export function TabPanel({ id, active, idPrefix, children }: { id: string; active: boolean; idPrefix: string; children: ReactNode }) {
  if (!active) return null;
  return (
    <div role="tabpanel" id={`${idPrefix}-panel-${id}`} aria-labelledby={`${idPrefix}-tab-${id}`} tabIndex={0} className={styles.panel}>
      {children}
    </div>
  );
}
