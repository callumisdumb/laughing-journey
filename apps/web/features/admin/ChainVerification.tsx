'use client';

import { formatDateTime } from '@mas/domain';
import { useT } from '@mas/messages';
import { Button, Pill, Sheet, SheetBody, SheetHead, Table, TableWrap } from '@mas/ui';
import { AlertTriangle, Check, ShieldAlert } from 'lucide-react';
import { useMemo, useState } from 'react';
import { useAppStore } from '@/lib/store';
import { chainHead, tamperedCopy, verifyAuditChain } from '@/lib/auditChain';
import styles from './ChainVerification.module.css';
import { SectionHead } from './SectionHead';
import { sectionLabel } from './sections';

/**
 * The audit chain verification screen.
 *
 * A verification screen that has only ever reported "verified" proves nothing: anyone can write a
 * function that returns true. So this one has a second button that verifies a deliberately tampered
 * copy of the same chain, editing an entry the way someone covering their tracks would, and shows
 * the break being found. The real ledger is untouched.
 *
 * The chain is what stops an entry being edited or removed quietly. Each entry carries the hash of
 * its predecessor and is signed by the actor's device key, so altering one breaks its own signature
 * and removing one breaks the link of the entry after it. Verification walks from the genesis entry
 * and stops at the first break, because everything after it is unverifiable anyway and a cascade of
 * consequential failures would bury the one that matters.
 */
export function ChainVerification() {
  const t = useT();
  const chain = useAppStore((s) => s.chain);
  const audit = useAppStore((s) => s.data.audit);
  const [showTampered, setShowTampered] = useState(false);

  const result = useMemo(() => verifyAuditChain(chain), [chain]);
  const tampered = useMemo(() => (chain.entries.length > 2 ? verifyAuditChain(tamperedCopy(chain, 1)) : undefined), [chain]);
  const shown = showTampered && tampered ? tampered : result;

  return (
    <>
      <SectionHead
        title={sectionLabel('audit-chain')}
        lede={t('admin.chain.lede')}
        actions={
          <>
            <Button variant="quiet" onClick={() => setShowTampered(false)} disabled={!showTampered}>
              {t('admin.chain.verifyReal')}
            </Button>
            <Button variant="secondary" icon={<ShieldAlert size={16} aria-hidden="true" />} onClick={() => setShowTampered(true)} disabled={showTampered || !tampered}>
              {t('admin.chain.verifyTampered')}
            </Button>
          </>
        }
      />

      <Sheet>
        <SheetHead
          title={showTampered ? t('admin.chain.tamperedTitle') : t('admin.chain.realTitle')}
          meta={showTampered ? t('admin.chain.tamperedMeta') : t('admin.chain.realMeta', { head: chainHead(chain) })}
          headingLevel={2}
          actions={
            <Pill size="sm" tone={shown.ok ? 'low' : 'critical'} icon={shown.ok ? <Check size={12} aria-hidden="true" /> : <AlertTriangle size={12} aria-hidden="true" />}>
              {shown.ok ? t('admin.chain.verified') : t('admin.chain.broken')}
            </Pill>
          }
        />
        <SheetBody>
          <p className={styles.result} data-ok={shown.ok ? 'true' : 'false'} role="status">
            {shown.ok
              ? t('admin.chain.okText', { count: shown.entries })
              : t('admin.chain.brokenText', { at: (shown.brokenAt ?? 0) + 1, count: shown.entries, reason: t(`admin.chain.reasons.${shown.reason === 'link-broken' ? 'linkBroken' : shown.reason === 'signature-invalid' ? 'signatureInvalid' : 'unknownSigner'}` as const) })}
          </p>
          {shown.entries === 0 ? <p className={styles.note}>{t('admin.chain.emptyNote')}</p> : null}
          <p className={styles.note}>{t('admin.chain.explain')}</p>
        </SheetBody>
      </Sheet>

      <Sheet>
        <SheetHead title={t('admin.chain.entriesTitle')} meta={t('admin.chain.entriesMeta', { count: chain.entries.length })} headingLevel={2} />
        <SheetBody>
          <TableWrap>
            <Table>
              <thead>
                <tr>
                  <th scope="col">{t('admin.chain.columns.position')}</th>
                  <th scope="col">{t('admin.chain.columns.when')}</th>
                  <th scope="col">{t('admin.chain.columns.actor')}</th>
                  <th scope="col">{t('admin.chain.columns.action')}</th>
                  <th scope="col">{t('admin.chain.columns.link')}</th>
                  <th scope="col">{t('admin.chain.columns.detail')}</th>
                </tr>
              </thead>
              <tbody>
                {chain.entries.slice(-40).map((entry, i) => {
                  const position = chain.entries.length - Math.min(40, chain.entries.length) + i;
                  const broken = !shown.ok && shown.brokenAt === position;
                  return (
                    <tr key={entry.body.id} className={broken ? styles.brokenRow : undefined}>
                      <td className={styles.numeric}>{position + 1}</td>
                      <td style={{ whiteSpace: 'nowrap' }}>{formatDateTime(entry.body.at)}</td>
                      <td className={styles.opaque}>{entry.body.actorId}</td>
                      <td>{entry.body.action}</td>
                      <td className={styles.opaque}>{entry.previousHash === '' ? t('admin.chain.genesis') : entry.previousHash.slice(0, 12)}</td>
                      <td className={styles.opaque}>{t('admin.chain.detailSealed')}</td>
                    </tr>
                  );
                })}
                {chain.entries.length === 0 ? (
                  <tr>
                    <td colSpan={6} data-muted="true">
                      {t('admin.chain.noEntries', { ledger: audit.length })}
                    </td>
                  </tr>
                ) : null}
              </tbody>
            </Table>
          </TableWrap>
        </SheetBody>
      </Sheet>
    </>
  );
}
