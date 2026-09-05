'use client';

import { FIELD_AUTHORITY, WRITE_CAPABILITIES, authorityLabel, writeCeilingLabel, writeCeilingReason, type ConnectorId } from '@mas/domain';
import { MOCK_ADAPTERS, type MockAdapter } from '@mas/connectors';
import { useT } from '@mas/messages';
import { Pill, Table, TableWrap } from '@mas/ui';
import styles from './Outbox.module.css';

/** How much of each source system this product can read. Write is the column that differs. */
const READ: Partial<Record<ConnectorId, 'full' | 'reference' | 'lookup'>> = {
  visor: 'reference',
  opg: 'lookup',
};

/**
 * The capability matrix, read and write side by side.
 *
 * The honesty of this table is itself a selling point. Anyone who has run an integration programme
 * will trust a supplier who says iVPD is notify-only more than one who claims everything writes, and
 * a product that says it writes to ViSOR loses the room in the first minute. So the ceilings are
 * real, they differ, and each carries the reason it is where it is.
 */
export function WriteMatrix() {
  const t = useT();
  const read = (id: ConnectorId) => (READ[id] === 'reference' ? t('connectors.write.readReference') : READ[id] === 'lookup' ? t('connectors.write.readLookup') : t('connectors.write.readFull'));

  return (
    <section className={styles.subject}>
      <h4 className={styles.previewHead}>{t('connectors.write.matrixTitle')}</h4>
      <p className={styles.meta}>{t('connectors.write.matrixMeta')}</p>
      <TableWrap>
        <Table>
          <thead>
            <tr>
              <th scope="col">{t('connectors.write.columns.connector')}</th>
              <th scope="col">{t('connectors.write.columns.read')}</th>
              <th scope="col">{t('connectors.write.columns.write')}</th>
              <th scope="col">{t('connectors.write.columns.why')}</th>
            </tr>
          </thead>
          <tbody data-testid="write-matrix">
            {MOCK_ADAPTERS.map((adapter) => {
              const capability = WRITE_CAPABILITIES[adapter.id];
              return (
                <tr key={adapter.id}>
                  <th scope="row">{adapter.displayName}</th>
                  <td>{read(adapter.id)}</td>
                  <td>
                    <Pill size="sm" tone={capability.ceiling === 'none' ? 'outline' : capability.ceiling === 'full' ? 'low' : 'medium'}>
                      {writeCeilingLabel(capability.ceiling)}
                    </Pill>
                    {capability.todoVerify ? <span className={styles.meta}>{t('connectors.write.unverified')}</span> : null}
                  </td>
                  <td className={styles.meta}>{writeCeilingReason(capability.ceiling)}</td>
                </tr>
              );
            })}
          </tbody>
        </Table>
      </TableWrap>
    </section>
  );
}

/**
 * Who owns which field when both sides have changed it.
 *
 * Written down per connector rather than resolved by a rule about recency, because last-write-wins
 * in safeguarding means the most recent click beats the more informed one. The pattern is the same
 * everywhere: demographics and the source system's own identifiers belong to the source; the
 * multi-agency process belongs here, because no single source system knows about the others.
 */
export function AuthorityTable({ adapter }: { adapter: MockAdapter }) {
  const t = useT();
  const fields = FIELD_AUTHORITY[adapter.id];
  if (!fields || fields.length === 0) return null;

  return (
    <section className={styles.subject}>
      <h4 className={styles.previewHead}>{t('connectors.write.authorityTitle')}</h4>
      <p className={styles.meta}>{t('connectors.write.authorityMeta')}</p>
      <TableWrap>
        <Table>
          <tbody data-testid="authority-table">
            {fields.map((field) => (
              <tr key={field.field}>
                <th scope="row" className={styles.field}>
                  {field.field}
                </th>
                <td>{authorityLabel(field.authority)}</td>
              </tr>
            ))}
          </tbody>
        </Table>
      </TableWrap>
    </section>
  );
}
