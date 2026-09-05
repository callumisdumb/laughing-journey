'use client';

import { classificationFor, marking, processLabel, type Process } from '@mas/domain';
import { useT } from '@mas/messages';
import { Pill, SelectField, Sheet, SheetBody, SheetHead, Table, TableWrap } from '@mas/ui';
import { useMemo, useState } from 'react';
import { useConfig, useCurrentUser, useData, useVault } from '@/lib/store';
import { readProcessDetail, serverView } from '@/lib/vault';
import styles from './ServerView.module.css';
import { SectionHead } from './SectionHead';
import { sectionLabel } from './sections';

/**
 * "What the host can see": the store as a hosting provider, a database administrator or an attacker
 * with full storage access would see it, beside the same record as the signed-in practitioner sees it.
 *
 * Every information governance conversation in Scottish public protection eventually reaches "but
 * who at the supplier can see my patients' records", and the honest answer has always been a policy
 * document. Here it is a screen, and the two panels are rendered from the same store: the left from
 * `serverView`, which reads only the metadata a server must hold, and the right from `openProcess`,
 * which needs a key that unwraps.
 *
 * It has to be honest to be worth anything. The metadata that genuinely is visible is shown, in
 * full, including the classification and the opaque identifiers of everyone who holds a key. A
 * version that showed only ciphertext would be a lie, and the one person in the room who knows that
 * is the one who needs convincing.
 */
export function ServerView() {
  const t = useT();
  const data = useData();
  const config = useConfig();
  const vault = useVault();
  const user = useCurrentUser();
  const [selected, setSelected] = useState<string>(data.processes[0]?.id ?? '');

  const rows = useMemo(() => serverView(vault), [vault]);
  const row = rows.find((r) => r.id === selected);
  const process: Process | undefined = data.processes.find((p) => p.id === selected);
  const decrypted = process && user ? readProcessDetail(vault, process, user, false) : undefined;

  return (
    <>
      <SectionHead title={sectionLabel('server-view')} lede={t('admin.serverView.lede')} />

      <Sheet>
        <SheetHead title={t('admin.serverView.storeTitle')} meta={t('admin.serverView.storeMeta', { count: rows.length })} headingLevel={2} />
        <SheetBody>
          <p className={styles.note}>{t('admin.serverView.storeNote')}</p>
          <TableWrap>
            <Table>
              <thead>
                <tr>
                  <th scope="col">{t('admin.serverView.columns.id')}</th>
                  <th scope="col">{t('admin.serverView.columns.type')}</th>
                  <th scope="col">{t('admin.serverView.columns.classification')}</th>
                  <th scope="col">{t('admin.serverView.columns.updatedAt')}</th>
                  <th scope="col">{t('admin.serverView.columns.keyHolders')}</th>
                  <th scope="col">{t('admin.serverView.columns.ciphertext')}</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.id} data-selected={r.id === selected ? 'true' : undefined}>
                    <th scope="row" className={styles.opaque}>
                      {r.id}
                    </th>
                    <td>{r.type}</td>
                    <td>{r.classification}</td>
                    <td>{r.updatedAt}</td>
                    <td className={styles.numeric}>{r.keyHolders}</td>
                    <td className={styles.cipher}>{t('admin.serverView.ciphertextCell', { preview: r.ciphertextPreview, bytes: r.ciphertextBytes })}</td>
                  </tr>
                ))}
              </tbody>
            </Table>
          </TableWrap>
        </SheetBody>
      </Sheet>

      <div className={styles.controls}>
        <SelectField
          label={t('admin.serverView.pickRecord')}
          value={selected}
          onChange={(e) => setSelected(e.target.value)}
          options={data.processes.map((p) => ({ value: p.id, label: `${p.reference}: ${processLabel(p.type)}` }))}
        />
      </div>

      <div className={styles.split}>
        <Sheet>
          <SheetHead
            title={t('admin.serverView.hostTitle')}
            meta={t('admin.serverView.hostMeta')}
            headingLevel={2}
            actions={<Pill size="sm" tone="critical">{t('admin.serverView.hostBadge')}</Pill>}
          />
          <SheetBody>
            {row ? (
              <>
                <dl className={styles.kv}>
                  <dt>{t('admin.serverView.columns.id')}</dt>
                  <dd className={styles.opaque}>{row.id}</dd>
                  <dt>{t('admin.serverView.columns.type')}</dt>
                  <dd>{row.type}</dd>
                  <dt>{t('admin.serverView.columns.classification')}</dt>
                  <dd>{row.classification}</dd>
                  <dt>{t('admin.serverView.columns.updatedAt')}</dt>
                  <dd>{row.updatedAt}</dd>
                  <dt>{t('admin.serverView.linked')}</dt>
                  <dd className={styles.opaque}>{row.linkedIds.join(', ') || t('common.values.none')}</dd>
                  <dt>{t('admin.serverView.holders')}</dt>
                  <dd className={styles.opaque}>{row.principalIds.join(', ')}</dd>
                </dl>
                <p className={styles.cipherBlock}>{row.ciphertextPreview}…</p>
                <p className={styles.note}>{t('admin.serverView.hostNote', { bytes: row.ciphertextBytes })}</p>
              </>
            ) : null}
          </SheetBody>
        </Sheet>

        <Sheet>
          <SheetHead
            title={t('admin.serverView.practitionerTitle')}
            meta={t('admin.serverView.practitionerMeta', { name: user ? `${user.givenName} ${user.familyName}` : '' })}
            headingLevel={2}
            actions={<Pill size="sm" tone="low">{t('admin.serverView.practitionerBadge')}</Pill>}
          />
          <SheetBody>
            {process && decrypted?.detail ? (
              <>
                <dl className={styles.kv}>
                  <dt>{t('admin.serverView.reference')}</dt>
                  <dd>{process.reference}</dd>
                  <dt>{t('admin.serverView.titleField')}</dt>
                  <dd>{process.title}</dd>
                  <dt>{t('admin.serverView.marking')}</dt>
                  <dd>{marking(classificationFor(config, process)) ?? t('nav.drawer.fields.noMarking')}</dd>
                </dl>
                <pre className={styles.plaintext}>{JSON.stringify(decrypted.detail, null, 2).slice(0, 1200)}</pre>
                <p className={styles.note}>{t('admin.serverView.practitionerNote')}</p>
              </>
            ) : (
              <p className={styles.note}>{t('admin.serverView.noKey')}</p>
            )}
          </SheetBody>
        </Sheet>
      </div>

      <Sheet>
        <SheetHead title={t('admin.serverView.leakageTitle')} meta={t('admin.serverView.leakageMeta')} headingLevel={2} />
        <SheetBody>
          <p className={styles.note}>{t('admin.serverView.leakageNote')}</p>
          <TableWrap>
            <Table>
              <thead>
                <tr>
                  <th scope="col">{t('admin.serverView.leakage.visible')}</th>
                  <th scope="col">{t('admin.serverView.leakage.infers')}</th>
                </tr>
              </thead>
              <tbody>
                {(['ids', 'holders', 'type', 'classification', 'timestamps', 'links'] as const).map((key) => (
                  <tr key={key}>
                    <th scope="row">{t(`admin.serverView.leakage.${key}Visible` as const)}</th>
                    <td>{t(`admin.serverView.leakage.${key}Infers` as const)}</td>
                  </tr>
                ))}
              </tbody>
            </Table>
          </TableWrap>
        </SheetBody>
      </Sheet>
    </>
  );
}
