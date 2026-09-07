import { useRef, type KeyboardEvent, type ReactNode } from 'react';
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
  /** Shared with the matching TabPanels so tab and panel ids always pair up. */
  idPrefix: string;
}

export function Tabs({ items, value, onChange, label, idPrefix }: TabsProps) {
  const prefix = idPrefix;
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

/** The panel stays in the document when inactive (hidden) so every tab's aria-controls resolves; children render only when active. */
export function TabPanel({ id, active, idPrefix, children }: { id: string; active: boolean; idPrefix: string; children: ReactNode }) {
  return (
    <div role="tabpanel" id={`${idPrefix}-panel-${id}`} aria-labelledby={`${idPrefix}-tab-${id}`} tabIndex={active ? 0 : -1} hidden={!active} className={styles.panel}>
      {active ? children : null}
    </div>
  );
}
