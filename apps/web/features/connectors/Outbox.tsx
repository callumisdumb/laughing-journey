'use client';

import {
  WRITE_CAPABILITIES,
  formatDateTime,
  isConfirmed,
  needsAttention,
  outboundIntentLabel,
  outboxStateLabel,
  writeCeilingLabel,
  type ConnectorId,
  type OutboundWrite,
} from '@mas/domain';
import { useT } from '@mas/messages';
import { Button, Dialog, EmptyState, Pill, SelectField, Sheet, SheetBody, SheetHead, Table, TableWrap, TextareaField, useToast, type PillTone } from '@mas/ui';
import { useState } from 'react';
import { PersonLink } from '@/components/EntityLink';
import { personById } from '@/lib/selectors';
import { useAppStore, useData } from '@/lib/store';
import { useWriteErrors } from '@/lib/writeErrors';
import styles from './Outbox.module.css';

const STATE_TONE: Record<OutboundWrite['state'], PillTone> = {
  proposed: 'medium',
  authorised: 'accent',
  sent: 'accent',
  acknowledged: 'low',
  failed: 'critical',
  'dead-letter': 'high',
  cancelled: 'outline',
};

/**
 * Every outbound write, with the state it is actually in.
 *
 * A silent write failure is a safety incident. If this product believes the inquiry is open in the
 * council's system and the write failed, a worker looking only at that system sees nothing, and the
 * assumption that the other agency knows is the assumption that appears in significant case reviews.
 * So the states are here rather than inferred, a failure is shown to a person rather than retried
 * into silence, and "sent" and "acknowledged" are kept apart because only the second one means the
 * far side has it.
 */
export function OutboxPanel({ connectorId, systemName }: { connectorId?: ConnectorId; systemName?: string }) {
  const t = useT();
  const data = useData();
  const [authorising, setAuthorising] = useState<OutboundWrite | null>(null);

  const all = data.outbox
    .filter((w) => (connectorId ? w.connectorId === connectorId : true))
    .slice()
    .sort((a, b) => (a.proposedAt < b.proposedAt ? 1 : -1));
  // Parked writes are kept apart, because they are a decision rather than a queue that grew, and a
  // list mixing them with live ones hides both.
  const writes = all.filter((w) => w.state !== 'dead-letter');
  const parked = all.filter((w) => w.state === 'dead-letter');
  const attention = writes.filter(needsAttention).length;

  return (
    <>
      <Sheet>
        <SheetHead
          title={t('connectors.outbox.title')}
          meta={`${t('connectors.outbox.needsAttention', { count: attention })}. ${t('connectors.outbox.lede')}`}
          headingLevel={3}
        />
        <SheetBody flush>
          {writes.length === 0 ? (
            <div className={styles.pad}>
              <EmptyState title={connectorId ? t('connectors.outbox.empty') : t('connectors.outbox.emptyAll')} />
            </div>
          ) : (
            <TableWrap style={{ border: 0, borderRadius: 0 }}>
              <Table>
                <thead>
                  <tr>
                    <th scope="col">{t('connectors.outbox.columns.when')}</th>
                    {connectorId ? null : <th scope="col">{t('connectors.outbox.columns.connector')}</th>}
                    <th scope="col">{t('connectors.outbox.columns.what')}</th>
                    <th scope="col">{t('connectors.outbox.columns.subject')}</th>
                    <th scope="col">{t('connectors.outbox.columns.state')}</th>
                    <th scope="col">{t('connectors.outbox.columns.reference')}</th>
                  </tr>
                </thead>
                <tbody>
                  {writes.map((write) => {
                    const person = personById(data, write.subjectPersonId);
                    return (
                      <tr key={write.id} data-testid={`outbox-row-${write.id}`}>
                        <td>{formatDateTime(write.proposedAt)}</td>
                        {connectorId ? null : <td>{write.connectorId}</td>}
                        <td>{outboundIntentLabel(write.intent)}</td>
                        <td>{person ? <PersonLink person={person} /> : write.subjectPersonId}</td>
                        <td>
                          <span className={styles.state}>
                            <Pill size="sm" tone={STATE_TONE[write.state]}>
                              {outboxStateLabel(write.state)}
                            </Pill>
                            {write.attempts > 0 ? <span className={styles.meta}>{t('connectors.outbox.attempts', { count: write.attempts })}</span> : null}
                            {write.failure ? <span className={styles.failure}>{write.failure.reason}</span> : null}
                            {write.authorisation ? (
                              <span className={styles.meta}>{t('connectors.outbox.purposeLine', { name: write.authorisation.byName, date: formatDateTime(write.authorisation.at), purpose: write.authorisation.purpose })}</span>
                            ) : null}
                            {write.relayedBytes ? <span className={styles.meta}>{t('connectors.outbox.relayed', { bytes: write.relayedBytes })}</span> : null}
                          </span>
                        </td>
                        <td>
                          {isConfirmed(write) ? <span className={styles.reference}>{write.externalRef}</span> : null}
                          <Actions write={write} onAuthorise={() => setAuthorising(write)} />
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </Table>
            </TableWrap>
          )}
        </SheetBody>
      </Sheet>

      {parked.length > 0 ? (
        <Sheet tone="well">
          <SheetHead title={t('connectors.outbox.deadLetterTitle')} meta={t('connectors.outbox.deadLetterMeta')} headingLevel={3} />
          <SheetBody>
            <ul className={styles.inboundList} data-testid="outbox-parked">
              {parked.map((write) => (
                <li key={write.id} className={styles.state}>
                  <span>{outboundIntentLabel(write.intent)}</span>
                  <span className={styles.failure}>{write.failure?.reason}</span>
                  <span className={styles.meta}>{t('connectors.outbox.attempts', { count: write.attempts })}</span>
                </li>
              ))}
            </ul>
          </SheetBody>
        </Sheet>
      ) : null}

      {authorising ? <AuthoriseWriteDialog write={authorising} systemName={systemName ?? authorising.connectorId} open onClose={() => setAuthorising(null)} /> : null}
    </>
  );
}

function Actions({ write, onAuthorise }: { write: OutboundWrite; onAuthorise: () => void }) {
  const t = useT();
  const park = useAppStore((s) => s.parkOutbound);
  const cancel = useAppStore((s) => s.cancelOutbound);

  if (write.state === 'proposed') {
    return (
      <span className={styles.actions}>
        <Button size="sm" variant="primary" onClick={onAuthorise} data-testid={`outbox-authorise-${write.id}`}>
          {t('connectors.outbox.authorise')}
        </Button>
        <Button size="sm" variant="quiet" onClick={() => cancel(write.id)} data-testid={`outbox-cancel-${write.id}`}>
          {t('connectors.outbox.cancel')}
        </Button>
      </span>
    );
  }
  if (write.state === 'failed') {
    return (
      <span className={styles.actions}>
        <Button size="sm" variant="secondary" onClick={onAuthorise} data-testid={`outbox-retry-${write.id}`}>
          {t('connectors.outbox.retry')}
        </Button>
        <Button size="sm" variant="quiet" onClick={() => park(write.id)} data-testid={`outbox-park-${write.id}`}>
          {t('connectors.outbox.park')}
        </Button>
      </span>
    );
  }
  return null;
}

/**
 * The preview before authorising, and the authorisation itself.
 *
 * The payload is shown in the target system's own field names beside the value it was mapped from,
 * because a practitioner authorising a write into a GP record should see what lands there. A mapping
 * a reader cannot check is a mapping they have to trust, and trust is not what an information
 * governance review is looking for.
 *
 * It carries a purpose and a lawful basis for the same reason a share does. It is a share: a
 * disclosure into another organisation's record, with a named human author.
 */
export function AuthoriseWriteDialog({ write, systemName, open, onClose }: { write: OutboundWrite; systemName: string; open: boolean; onClose: () => void }) {
  const t = useT();
  const data = useData();
  const authorise = useAppStore((s) => s.authoriseOutbound);
  const readErrors = useWriteErrors();
  const { toast } = useToast();

  const [purpose, setPurpose] = useState(write.authorisation?.purpose ?? '');
  const [basis, setBasis] = useState(write.authorisation?.lawfulBasisId ?? '');
  const [errors, setErrors] = useState<string[]>([]);

  const bases = data.lawfulBases;

  function submit() {
    const result = authorise(write.id, purpose, basis);
    if (!result.ok) {
      setErrors(result.errors);
      return;
    }
    toast({ title: t('connectors.authorise.doneTitle'), text: t('connectors.authorise.doneText', { system: systemName }), tone: 'success' });
    onClose();
  }

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={t('connectors.authorise.title', { system: systemName })}
      size="lg"
      errors={readErrors(errors)}
      actions={
        <>
          <Button variant="quiet" onClick={onClose}>
            {t('common.actions.cancel')}
          </Button>
          <Button variant="primary" onClick={submit} data-testid="authorise-submit">
            {t('connectors.authorise.submit')}
          </Button>
        </>
      }
    >
      <div className="stack">
        <p>{t('connectors.authorise.intro')}</p>
        <p className={styles.ceiling}>{t('connectors.authorise.ceilingNote', { system: systemName, ceiling: writeCeilingLabel(WRITE_CAPABILITIES[write.connectorId].ceiling) })}</p>

        <div>
          <h3 className={styles.previewHead}>{t('connectors.authorise.previewHead', { system: systemName })}</h3>
          <p className={styles.meta}>{t('connectors.authorise.previewMeta')}</p>
          <TableWrap>
            <Table>
              <thead>
                <tr>
                  <th scope="col">{t('connectors.authorise.columns.field')}</th>
                  <th scope="col">{t('connectors.authorise.columns.value')}</th>
                  <th scope="col">{t('connectors.authorise.columns.from')}</th>
                </tr>
              </thead>
              <tbody data-testid="authorise-preview">
                {write.payload.map((field) => (
                  <tr key={field.field}>
                    <td className={styles.field}>{field.field}</td>
                    <td>{field.value}</td>
                    <td className={styles.meta}>{field.from}</td>
                  </tr>
                ))}
              </tbody>
            </Table>
          </TableWrap>
        </div>

        <TextareaField label={t('connectors.authorise.purpose')} hint={t('connectors.authorise.purposeHint')} value={purpose} onChange={(e) => setPurpose(e.target.value)} rows={2} required data-testid="authorise-purpose" />
        <SelectField
          label={t('connectors.authorise.lawfulBasis')}
          value={basis}
          onChange={(e) => setBasis(e.target.value)}
          placeholder={t('connectors.authorise.lawfulBasis')}
          options={bases.map((b) => ({ value: b.id, label: t('connectors.authorise.basisOption', { purpose: b.purpose, article: b.article6 }) }))}
          required
          data-testid="authorise-basis"
        />
      </div>
    </Dialog>
  );
}
