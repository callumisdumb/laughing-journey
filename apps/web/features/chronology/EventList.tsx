'use client';

import { eventFamily, eventFamilyLabel, formatDate, formatDateTime, significanceLabel, visibilityLabel, type ChronologyEvent } from '@mas/domain';
import { useT } from '@mas/messages';
import { AgencyMark } from '@mas/ui';
import { useVirtualizer } from '@tanstack/react-virtual';
import { AlertTriangle, Circle, Flag } from 'lucide-react';
import { useEffect, useRef, type CSSProperties } from 'react';
import styles from './EventList.module.css';

export interface EventListProps {
  events: ChronologyEvent[];
  selectedEventId: string | null;
  highlighted: Set<string>;
  onSelect: (id: string) => void;
  height?: number;
}

const SIG_ICON = { high: <AlertTriangle size={12} aria-hidden="true" />, moderate: <Flag size={12} aria-hidden="true" />, low: <Circle size={10} aria-hidden="true" /> } as const;

const COLUMNS = [
  'chronology.eventList.columns.date',
  'chronology.eventList.columns.agency',
  'chronology.eventList.columns.type',
  'chronology.eventList.columns.title',
  'chronology.eventList.columns.response',
  'chronology.eventList.columns.outcome',
  'chronology.eventList.columns.significance',
  'chronology.eventList.columns.source',
  'chronology.eventList.columns.visibility',
] as const;

/** Virtualised, keyboard-navigable chronology table. Newest first. */
export function EventList({ events, selectedEventId, highlighted, onSelect, height = 480 }: EventListProps) {
  // TanStack Virtual hands back functions the React Compiler cannot memoise safely, and it said so
  // on every lint. Opting this component out is the documented answer; the rule still reports the
  // call, so the one line is excused where it stands, and the warning count stays at zero so a real
  // one is visible when it arrives (D-204).
  'use no memo';
  const t = useT();
  const parentRef = useRef<HTMLDivElement>(null);
  const rowHeight = typeof document !== 'undefined' && document.documentElement.dataset.density === 'compact' ? 32 : 40;
  // eslint-disable-next-line react-hooks/incompatible-library
  const virtualizer = useVirtualizer({ count: events.length, getScrollElement: () => parentRef.current, estimateSize: () => rowHeight, overscan: 12 });

  useEffect(() => {
    if (!selectedEventId) return;
    const i = events.findIndex((e) => e.id === selectedEventId);
    if (i >= 0) virtualizer.scrollToIndex(i, { align: 'auto' });
  }, [selectedEventId, events, virtualizer]);

  const dimming = highlighted.size > 0;

  return (
    <div className={styles.list} role="table" aria-label={t('chronology.eventList.label')} aria-rowcount={events.length} style={{ '--list-height': `${height}px` } as CSSProperties}>
      <div className={styles.header} role="row">
        {COLUMNS.map((key) => (
          <div key={key} role="columnheader" className={styles.cell}>
            {t(key)}
          </div>
        ))}
      </div>
      <div className={styles.viewport} ref={parentRef}>
        {events.length === 0 ? <div className={styles.empty}>{t('chronology.eventList.empty')}</div> : null}
        <div className={styles.inner} style={{ height: virtualizer.getTotalSize() }} role="rowgroup">
          {virtualizer.getVirtualItems().map((v) => {
            const e = events[v.index]!;
            return (
              <div
                key={e.id}
                role="row"
                aria-rowindex={v.index + 1}
                aria-selected={selectedEventId === e.id}
                tabIndex={0}
                className={styles.row}
                data-selected={selectedEventId === e.id ? 'true' : undefined}
                data-dim={dimming && !highlighted.has(e.id) ? 'true' : undefined}
                style={{ transform: `translateY(${v.start}px)` }}
                onClick={() => onSelect(e.id)}
                onKeyDown={(k) => {
                  if (k.key === 'Enter' || k.key === ' ') {
                    k.preventDefault();
                    onSelect(e.id);
                  } else if (k.key === 'ArrowDown') {
                    k.preventDefault();
                    (k.currentTarget.nextElementSibling as HTMLElement | null)?.focus();
                  } else if (k.key === 'ArrowUp') {
                    k.preventDefault();
                    (k.currentTarget.previousElementSibling as HTMLElement | null)?.focus();
                  }
                }}
              >
                <div role="cell" className={`${styles.cell} ${styles.date}`}>
                  {e.hasTime ? formatDateTime(e.occurredAt) : formatDate(e.occurredAt)}
                  {e.approximate ? <span className={styles.approx}> {t('chronology.eventList.approximate')}</span> : null}
                </div>
                <div role="cell" className={styles.cell}>
                  <AgencyMark agency={e.agency} />
                </div>
                <div role="cell" className={styles.cell}>
                  {eventFamilyLabel(eventFamily(e.eventType))}
                </div>
                <div role="cell" className={`${styles.cell} ${styles.title}`} title={e.detail}>
                  {e.title}
                </div>
                <div role="cell" className={`${styles.cell} ${styles.muted}`} title={e.response}>
                  {e.response ?? ''}
                </div>
                <div role="cell" className={`${styles.cell} ${styles.muted}`} title={e.outcome}>
                  {e.outcome ?? ''}
                </div>
                <div role="cell" className={styles.cell}>
                  <span className={styles.sig} data-sig={e.significance}>
                    {SIG_ICON[e.significance]} {significanceLabel(e.significance)}
                  </span>
                </div>
                <div role="cell" className={`${styles.cell} ${styles.muted}`}>
                  {e.sourceSystem === 'manual' ? t('chronology.eventList.sourceManual') : e.sourceSystem}
                </div>
                <div role="cell" className={`${styles.cell} ${styles.muted}`}>
                  {visibilityLabel(e.visibility)}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
