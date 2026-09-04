'use client';

import { authorityLabel, conflicts, formatDateTime, reconcile, type ConnectorId, type Divergence } from '@mas/domain';
import { useT } from '@mas/messages';
import { Button, EmptyState, Pill, Sheet, SheetBody, SheetHead, Table, TableWrap, useToast } from '@mas/ui';
import type { MockAdapter } from '@mas/connectors';
import { fullName, personById } from '@/lib/selectors';
import { useAppStore, useData, useNow } from '@/lib/store';
import styles from './Outbox.module.css';

/**
 * What this product believes each source system holds, against what the source says.
 *
 * Every real two-way integration lives or dies on this screen and almost no product demo has one.
 * The comparison is field by field in the source system's own names, because that is the only
 * vocabulary the two halves share, and each divergence carries who owns the field.
 *
 * Ownership is what stops this becoming last-write-wins, which in safeguarding means the most recent
 * click beats the more informed one. Where the source owns a field, the divergence is ours to take.
 * Where we own it, the source is behind and the fix is another write. Where either owns it and both
 * have changed it, that is a conflict and a person chooses, with both values in front of them.
 */
export function ReconcilePanel({ adapter }: { adapter: MockAdapter }) {
  const t = useT();
  const data = useData();
  const now = useNow();
  const audit = useAppStore((s) => s.audit);
  const { toast } = useToast();

  // The subjects this connector has anything to say about: the ones it has already sent us an
  // outbound write for. Reconciling a person the connector has never heard of is a blank screen.
  const subjects = [...new Set(data.outbox.filter((w) => w.connectorId === adapter.id).map((w) => w.subjectPersonId))];

  const reports = subjects.map((personId) => {
    const person = personById(data, personId);
    const process = data.processes.find((p) => p.id === data.outbox.find((w) => w.subjectPersonId === personId && w.connectorId === adapter.id)?.processId);
    // What we believe the source holds is what we last wrote to it, which is exactly the belief that
    // a reconciliation screen exists to test.
    const ours: Record<string, string> = {};
    for (const write of data.outbox.filter((w) => w.connectorId === adapter.id && w.subjectPersonId === personId && w.state === 'acknowledged')) {
      for (const field of write.payload) ours[field.field] = field.value;
    }
    if (person) {
      ours['Client.Name'] = fullName(person);
      if (person.dateOfBirth) ours['Client.DateOfBirth'] = person.dateOfBirth;
    }
    if (process) ours['Episode.Stage'] = process.stage;
    const theirs = adapter.held({ personId });
    return {
      personId,
      name: person ? fullName(person) : personId,
      report: reconcile({ connectorId: adapter.id, subjectPersonId: personId, checkedAt: now.toISOString(), ours, theirs, bothChanged: bothChanged(adapter.id) }),
    };
  });

  function resolve(personId: string, divergence: Divergence, take: 'ours' | 'theirs') {
    // Recorded rather than applied. Taking the source's value for a field the source owns is a
    // correction to our record; keeping ours is a write out. Both are decisions, and a conflict
    // resolved without a record of who resolved it is the thing an inspector asks about.
    audit({
      act: 'edit',
      targetType: 'person',
      targetId: personId,
      targetLabel: t('connectors.reconcile.audit', { field: divergence.field, value: take === 'ours' ? divergence.ours : divergence.theirs, connector: adapter.id }),
    });
    toast({ title: t('connectors.reconcile.resolvedTitle'), text: t('connectors.reconcile.resolvedText', { field: divergence.field, value: take === 'ours' ? divergence.ours : divergence.theirs }), tone: 'success' });
  }

  return (
    <Sheet>
      <SheetHead title={t('connectors.reconcile.title')} meta={t('connectors.reconcile.lede')} headingLevel={3} />
      <SheetBody>
        {reports.length === 0 ? (
          <EmptyState title={t('connectors.reconcile.agree')} />
        ) : (
          reports.map(({ personId, name, report }) => (
            <div key={personId} className={styles.subject} data-testid={`reconcile-${personId}`}>
              <h4 className={styles.previewHead}>{name}</h4>
              <p className={styles.meta}>
                {t('connectors.reconcile.divergences', { count: report.divergences.length })}, {t('connectors.reconcile.conflicts', { count: conflicts(report).length })}. {t('connectors.reconcile.checked', { when: formatDateTime(report.checkedAt) })}
              </p>
              {report.divergences.length === 0 ? (
                <p className={styles.meta}>{t('connectors.reconcile.agree')}</p>
              ) : (
                <TableWrap>
                  <Table>
                    <thead>
                      <tr>
                        <th scope="col">{t('connectors.reconcile.columns.field')}</th>
                        <th scope="col">{t('connectors.reconcile.columns.ours', { product: t('product.name') })}</th>
                        <th scope="col">{t('connectors.reconcile.columns.theirs')}</th>
                        <th scope="col">{t('connectors.reconcile.columns.owner')}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {report.divergences.map((d) => (
                        <tr key={d.field} data-conflict={d.conflict ? 'true' : undefined}>
                          <td className={styles.field}>{d.field}</td>
                          <td>{d.ours === '' ? <span className={styles.meta}>{t('connectors.reconcile.blank')}</span> : d.ours}</td>
                          <td>{d.theirs === '' ? <span className={styles.meta}>{t('connectors.reconcile.blank')}</span> : d.theirs}</td>
                          <td>
                            <Pill size="sm" tone={d.conflict ? 'critical' : 'outline'}>
                              {authorityLabel(d.authority)}
                            </Pill>
                            {d.conflict ? (
                              <span className={styles.state}>
                                <span className={styles.failure}>{t('connectors.reconcile.conflict')}</span>
                                <span className={styles.actions}>
                                  <Button size="sm" variant="secondary" onClick={() => resolve(personId, d, 'theirs')} data-testid={`reconcile-take-${d.field}`}>
                                    {t('connectors.reconcile.takeTheirs')}
                                  </Button>
                                  <Button size="sm" variant="quiet" onClick={() => resolve(personId, d, 'ours')} data-testid={`reconcile-keep-${d.field}`}>
                                    {t('connectors.reconcile.keepOurs')}
                                  </Button>
                                </span>
                              </span>
                            ) : null}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </Table>
                </TableWrap>
              )}
            </div>
          ))
        )}
      </SheetBody>
    </Sheet>
  );
}

/**
 * The fields both sides have edited since the last reconciliation, which is what makes a conflict
 * rather than a divergence.
 *
 * In a deployment this comes from the change feed's own timestamps. Here it is per connector and
 * fixed, because a reconciliation screen with no conflict on it demonstrates nothing and the
 * conflict is the part the audience has not seen a product handle before.
 */
function bothChanged(connectorId: ConnectorId): string[] {
  return connectorId === 'eclipse' ? ['Episode.AllocatedWorker'] : [];
}
