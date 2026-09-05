'use client';

import { formatDateTime, history, isRecordedInError, type Correctable } from '@mas/domain';
import { useT } from '@mas/messages';
import { Button, Pill, Sheet, SheetBody, SheetHead } from '@mas/ui';
import { FileX } from 'lucide-react';
import { useRetire, type RetireTarget } from '@/lib/retire';
import styles from './RecordHistory.module.css';

/**
 * What has changed on a record, newest first.
 *
 * A version list is not decoration on a safeguarding record. The fact that a date of birth was
 * recorded as one thing and corrected to another is sometimes the significant fact, and a reader who
 * can only see the current value has lost it. So each entry shows what changed, who changed it,
 * when, the reason where one was required, and the values the changed fields held before.
 *
 * Nested values are named rather than printed. "clocks changed" is useful; a page of JSON is not.
 */
export function RecordHistory({ record, headingLevel = 2, retire }: { record: Correctable; headingLevel?: 2 | 3; retire?: RetireTarget }) {
  const t = useT();
  const open = useRetire((s) => s.retire);
  const entries = history(record);
  const retired = isRecordedInError(record);

  return (
    <Sheet>
      <SheetHead
        title={t('person.history.title')}
        meta={t('person.history.meta', { count: entries.length })}
        headingLevel={headingLevel}
        actions={
          retire && !retired ? (
            <Button size="sm" variant="quiet" icon={<FileX size={14} aria-hidden="true" />} onClick={() => open(retire)} data-testid="retire-record">
              {t('common.recordedInError.action')}
            </Button>
          ) : null
        }
      />
      <SheetBody>
        {record.recordedInError ? (
          <div className={styles.retired} data-testid="retired-badge">
            <Pill size="sm" tone="critical">
              {t('common.recordedInError.badge')}
            </Pill>
            <span>
              {t('common.recordedInError.by', {
                name: record.recordedInError.byName,
                date: formatDateTime(record.recordedInError.at),
                reason: record.recordedInError.reason,
              })}
            </span>
          </div>
        ) : null}
        {entries.length === 0 ? (
          <p className={styles.empty}>{t('person.history.empty')}</p>
        ) : (
          <ol className={styles.list} data-testid="record-history">
            {entries.map((entry, i) => (
              <li key={`${entry.at}-${i}`} className={styles.entry}>
                <span className={styles.change}>{t('person.history.entry', { change: entry.change })}</span>
                <span className={styles.who}>{t('person.history.who', { name: entry.byName, date: formatDateTime(entry.at) })}</span>
                {entry.reason ? <span className={styles.reason}>{t('person.history.reason', { reason: entry.reason })}</span> : null}
                {entry.before && Object.keys(entry.before).length > 0 ? (
                  <span className={styles.was}>
                    {t('person.history.was', {
                      values: Object.entries(entry.before)
                        .map(([field, value]) => t('person.history.wasField', { field, value: value === '' ? t('person.history.wasBlank') : value }))
                        .join('; '),
                    })}
                  </span>
                ) : null}
              </li>
            ))}
          </ol>
        )}
      </SheetBody>
    </Sheet>
  );
}
