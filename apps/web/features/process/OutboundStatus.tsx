'use client';

import { MOCK_ADAPTERS } from '@mas/connectors';
import { confirmationKey, formatTime, isConfirmed, type OutboundWrite } from '@mas/domain';
import { tKey, useT } from '@mas/messages';
import { AlertTriangle, CheckCircle2, Clock } from 'lucide-react';
import { AppLink } from '@/components/AppLink';
import { useData } from '@/lib/store';
import styles from './OutboundStatus.module.css';

/**
 * What each source system has actually been told about this case.
 *
 * Every line here is one sentence, and the difference between the sentences is the whole point: a
 * write that has been acknowledged carries the far side's own reference and justifies believing the
 * other agency knows; a write that has been sent and not acknowledged says do not assume that; a
 * write that failed says nobody there has been told. A product that showed the same tick for all
 * three would be teaching exactly the assumption that appears in significant case reviews.
 */
export function OutboundStatus({ processId }: { processId: string }) {
  const t = useT();
  const data = useData();

  const writes = data.outbox.filter((w) => w.processId === processId && w.state !== 'cancelled');
  if (writes.length === 0) return null;

  return (
    <ul className={styles.lines} data-testid="outbound-status">
      {writes.map((write) => (
        <li key={write.id} className={styles.line} data-state={write.state}>
          <Icon write={write} />
          <span>{line(t, write)}</span>
          <AppLink href={`/connectors?adapter=${write.connectorId}&tab=outbox`} className={styles.link}>
            {t('connectors.outbox.title')}
          </AppLink>
        </li>
      ))}
    </ul>
  );
}

function Icon({ write }: { write: OutboundWrite }) {
  if (isConfirmed(write)) return <CheckCircle2 size={14} aria-hidden="true" />;
  if (write.state === 'failed' || write.state === 'dead-letter') return <AlertTriangle size={14} aria-hidden="true" />;
  return <Clock size={14} aria-hidden="true" />;
}

function line(t: ReturnType<typeof useT>, write: OutboundWrite): string {
  const system = MOCK_ADAPTERS.find((a) => a.id === write.connectorId)?.systemName ?? write.connectorId;
  const key = confirmationKey(write);
  if (key === 'connectors.outbox.confirmed') {
    return t('connectors.outbox.confirmed', { system, time: formatTime(write.acknowledgedAt ?? write.sentAt ?? write.proposedAt), reference: write.externalRef ?? '' });
  }
  if (key === 'connectors.outbox.failedLine') return t('connectors.outbox.failedLine', { system, reason: write.failure?.reason ?? '' });
  return tKey(key === 'connectors.outbox.sentNotConfirmed' ? 'connectors.outbox.sentNotConfirmed' : 'connectors.outbox.notSent', { system });
}
