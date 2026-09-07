'use client';

import { echoedWrite, formatDateTime, type ConnectorId, type InboundChange } from '@mas/domain';
import { tKey, useT } from '@mas/messages';
import { Button, Dialog, EmptyState, Pill, Sheet, SheetBody, SheetHead, TextareaField, useToast } from '@mas/ui';
import { useState } from 'react';
import { useNavigate } from '@/lib/router';
import { processPath } from '@/lib/routes';
import { useAppStore, useData } from '@/lib/store';
import { useWriteErrors } from '@/lib/writeErrors';
import styles from './Outbox.module.css';

/**
 * Cases opened in a source system, waiting for somebody here to accept or decline them.
 *
 * These arrive on the same feed as chronology events and are deliberately a different thing: a
 * chronology event is a fact to promote, and this is a case to open. Accepting one creates the
 * matching process linked by the source system's own reference, so the two records are joined by
 * something the far side recognises rather than by a name and a date.
 *
 * An entry that is our own write coming back is marked as an echo and is never offered for
 * acceptance. Accepting it would create a duplicate process and, with a feed running, a loop.
 */
export function InboundPanel({ connectorId, systemName }: { connectorId?: ConnectorId; systemName?: string }) {
  const t = useT();
  const data = useData();
  const navigate = useNavigate();
  const accept = useAppStore((s) => s.acceptInbound);
  const readErrors = useWriteErrors();
  const { toast } = useToast();

  const [declining, setDeclining] = useState<InboundChange | null>(null);
  const [errors, setErrors] = useState<string[]>([]);

  const changes = data.inbound
    .filter((c) => (connectorId ? c.connectorId === connectorId : true))
    .slice()
    .sort((a, b) => (a.receivedAt < b.receivedAt ? 1 : -1));

  function onAccept(change: InboundChange) {
    const result = accept(change.id);
    if (!result.ok) {
      setErrors(result.errors);
      return;
    }
    if (result.process) {
      toast({ title: t('connectors.inbound.acceptedTitle'), text: t('connectors.inbound.acceptedText', { reference: result.process.reference, external: change.externalRef, system: systemName ?? change.connectorId }), tone: 'success' });
      navigate(processPath(result.process.id));
      return;
    }
    toast({ title: t('connectors.inbound.echoTitle'), text: t('connectors.inbound.echoText'), tone: 'info' });
  }

  return (
    <>
      <Sheet>
        <SheetHead title={t('connectors.inbound.title')} meta={t('connectors.inbound.lede')} headingLevel={3} />
        <SheetBody>
          {readErrors(errors).map((message) => (
            <p key={message} className={styles.failure} role="alert">
              {message}
            </p>
          ))}
          {changes.length === 0 ? (
            <EmptyState title={t('connectors.inbound.empty')} />
          ) : (
            <div className={styles.inboundList}>
              {changes.map((change) => {
                const echo = echoedWrite(change, data.outbox);
                return (
                  <div key={change.id} className={styles.inbound} data-testid={`inbound-${change.id}`}>
                    <div className={styles.inboundHead}>
                      <span className={styles.inboundName}>{change.subjectHint.displayName}</span>
                      <Pill size="sm" tone={echo ? 'outline' : change.status === 'pending' ? 'medium' : 'low'}>
                        {echo ? t('connectors.inbound.echoBadge') : tKey(`connectors.inbound.statuses.${change.status}`)}
                      </Pill>
                      <span className={styles.meta}>{t('connectors.inbound.from', { system: systemName ?? change.connectorId, when: formatDateTime(change.receivedAt) })}</span>
                      <span className={styles.meta}>{t('connectors.inbound.reference', { reference: change.externalRef })}</span>
                    </div>
                    <dl className={styles.payload}>
                      {change.payload.map((field) => (
                        <div key={field.field}>
                          <dt className={styles.field}>{field.field}</dt>
                          <dd>{field.value}</dd>
                        </div>
                      ))}
                    </dl>
                    {echo ? (
                      <p className={styles.meta} data-testid={`inbound-echo-${change.id}`}>
                        {t('connectors.inbound.echoText')}
                      </p>
                    ) : change.status === 'pending' ? (
                      <span className={styles.actions}>
                        <Button size="sm" variant="primary" onClick={() => onAccept(change)} data-testid={`inbound-accept-${change.id}`}>
                          {t('connectors.inbound.accept')}
                        </Button>
                        <Button size="sm" variant="quiet" onClick={() => setDeclining(change)} data-testid={`inbound-decline-${change.id}`}>
                          {t('connectors.inbound.decline')}
                        </Button>
                      </span>
                    ) : change.declineReason ? (
                      <p className={styles.meta}>{change.declineReason}</p>
                    ) : null}
                  </div>
                );
              })}
            </div>
          )}
        </SheetBody>
      </Sheet>

      {declining ? <DeclineDialog change={declining} systemName={systemName ?? declining.connectorId} open onClose={() => setDeclining(null)} /> : null}
    </>
  );
}

function DeclineDialog({ change, systemName, open, onClose }: { change: InboundChange; systemName: string; open: boolean; onClose: () => void }) {
  const t = useT();
  const decline = useAppStore((s) => s.declineInbound);
  const readErrors = useWriteErrors();
  const { toast } = useToast();
  const [reason, setReason] = useState('');
  const [errors, setErrors] = useState<string[]>([]);

  function submit() {
    const result = decline(change.id, reason);
    if (!result.ok) {
      setErrors(result.errors);
      return;
    }
    toast({ title: t('connectors.inbound.declinedTitle'), text: t('connectors.inbound.declinedText', { system: systemName }), tone: 'success' });
    onClose();
  }

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={t('connectors.inbound.declineTitle')}
      size="md"
      errors={readErrors(errors)}
      actions={
        <>
          <Button variant="quiet" onClick={onClose}>
            {t('common.actions.cancel')}
          </Button>
          <Button variant="primary" onClick={submit} data-testid="inbound-decline-submit">
            {t('connectors.inbound.declineSubmit')}
          </Button>
        </>
      }
    >
      <TextareaField label={t('connectors.inbound.declineReason')} hint={t('connectors.inbound.declineHint')} value={reason} onChange={(e) => setReason(e.target.value)} rows={3} required data-testid="inbound-decline-reason" />
    </Dialog>
  );
}
