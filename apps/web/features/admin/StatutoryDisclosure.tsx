'use client';

import { processLabel } from '@mas/domain';
import { useT } from '@mas/messages';
import { Button, CheckboxField, Pill, SelectField, Sheet, SheetBody, SheetHead, TextareaField, TextField, useToast } from '@mas/ui';
import { ShieldAlert } from 'lucide-react';
import { useState } from 'react';
import { useAppStore, useConfig, useData, useNow } from '@/lib/store';
import { ESCROW_HOLDERS, casesWithheldFromRecovery, escrowDecision, signEscrowUse, type EscrowHolder, type EscrowPurpose } from '@/lib/keyManagement';
import { deviceSigningKey } from '@/lib/auditChain';
import styles from './StatutoryDisclosure.module.css';
import { SectionHead } from './SectionHead';
import { sectionLabel } from './sections';

/**
 * Statutory disclosure: producing a record under a subject access request or a sheriff's order.
 *
 * **The existence of this screen is what makes the whole design lawful.** A system that could not
 * produce a record on a sheriff's order would not be deployable, and one that could not answer a
 * subject access request would put the controller in breach. So this is a first-class, governed
 * action with a form and an audit trail, rather than something achieved by a database administrator
 * with a script at the end of a long week.
 *
 * It needs two escrow holders in different organisations. That is the same control as break-glass
 * and for the same reason: one person, however senior, should not be able to reach any record in the
 * partnership on their own. The refusal when both come from the same organisation is enforced here
 * rather than written in a policy, because the policy is not what runs at two in the morning.
 */
export function StatutoryDisclosure() {
  const t = useT();
  const data = useData();
  const config = useConfig();
  const now = useNow();
  const audit = useAppStore((s) => s.audit);
  const { toast } = useToast();

  const [purpose, setPurpose] = useState<EscrowPurpose>('statutory-disclosure');
  const [targetId, setTargetId] = useState(data.processes[0]?.id ?? '');
  const [reason, setReason] = useState('');
  const [lawfulBasis, setLawfulBasis] = useState('');
  const [selected, setSelected] = useState<number[]>([]);

  const holders: EscrowHolder[] = ESCROW_HOLDERS.filter((holder) => selected.includes(holder.shareIndex));
  const request = { purpose, reason, lawfulBasis, targetId, holders, at: now.toISOString() };
  // The record being opened, so the decision can refuse a holder who is an excluded party on it.
  const target = data.processes.find((p) => p.id === targetId);
  const decision = escrowDecision(request, target, { exclusions: config.exclusions, relationships: data.relationships });
  // What a recovery would not give back. The exclusion outlived the device.
  const withheld = purpose === 'recovery' && target ? casesWithheldFromRecovery({ userId: targetId, newDeviceLabel: '', fingerprint: '', identityVerifiedBy: '', at: now.toISOString() }, data.processes, { exclusions: config.exclusions, relationships: data.relationships }) : [];

  function toggle(shareIndex: number, on: boolean) {
    setSelected((current) => (on ? [...current, shareIndex] : current.filter((i) => i !== shareIndex)));
  }

  function submit() {
    if (decision.refusal === 'excluded-holder' && target) {
      // A refusal is a fact worth recording. The same-organisation case produces an audit entry and
      // so does this one: an attempt that got as far as pressing the button is what oversight wants.
      audit({
        act: 'export',
        targetType: 'process',
        targetId,
        targetLabel: t('admin.disclosure.excludedAudit', { organisation: decision.excluded?.organisation ?? '', reference: target.reference }),
        reason,
        restricted: true,
      });
      return;
    }
    if (!decision.ok) return;
    // Both holders sign the statement, so neither can later say they were not there.
    const use = signEscrowUse(request, holders.map((holder) => deviceSigningKey(`escrow:${holder.shareIndex}`)));
    audit({
      act: 'export',
      targetType: 'process',
      targetId,
      targetLabel: t('admin.disclosure.audit', { purpose: t(`admin.disclosure.purposes.${purpose === 'statutory-disclosure' ? 'statutoryDisclosure' : purpose === 'break-glass' ? 'breakGlass' : 'recovery'}` as const), holders: holders.map((holder) => holder.organisation).join(' and ') }),
      reason,
      restricted: true,
    });
    toast({
      title: t('admin.disclosure.done.title'),
      text: t('admin.disclosure.done.text', { signatures: use.signatures.length, notified: decision.notify.length }),
      tone: 'success',
    });
    setReason('');
    setLawfulBasis('');
    setSelected([]);
  }

  return (
    <>
      <SectionHead title={sectionLabel('disclosure')} lede={t('admin.disclosure.lede')} />

      <Sheet>
        <SheetHead title={t('admin.disclosure.whyTitle')} meta={t('admin.disclosure.whyMeta')} headingLevel={2} />
        <SheetBody>
          <p className={styles.note}>{t('admin.disclosure.whyText')}</p>
        </SheetBody>
      </Sheet>

      <Sheet>
        <SheetHead title={t('admin.disclosure.formTitle')} meta={t('admin.disclosure.formMeta')} headingLevel={2} />
        <SheetBody>
          <div className={styles.fields}>
            <SelectField
              label={t('admin.disclosure.purpose')}
              value={purpose}
              onChange={(e) => setPurpose(e.target.value as EscrowPurpose)}
              options={[
                { value: 'statutory-disclosure', label: t('admin.disclosure.purposes.statutoryDisclosure') },
                { value: 'break-glass', label: t('admin.disclosure.purposes.breakGlass') },
                { value: 'recovery', label: t('admin.disclosure.purposes.recovery') },
              ]}
            />
            <SelectField
              label={t('admin.disclosure.record')}
              value={targetId}
              onChange={(e) => setTargetId(e.target.value)}
              options={data.processes.map((p) => ({ value: p.id, label: `${p.reference}: ${processLabel(p.type)}` }))}
            />
            <TextField label={t('admin.disclosure.lawfulBasis')} value={lawfulBasis} onChange={(e) => setLawfulBasis(e.target.value)} hint={t('admin.disclosure.lawfulBasisHint')} required />
            <TextareaField label={t('admin.disclosure.reason')} value={reason} onChange={(e) => setReason(e.target.value)} hint={t('admin.disclosure.reasonHint')} required />
          </div>

          <fieldset className={styles.holders}>
            <legend className={styles.legend}>{t('admin.disclosure.holdersLegend')}</legend>
            <p className={styles.note}>{t('admin.disclosure.holdersNote')}</p>
            {ESCROW_HOLDERS.map((holder) => (
              <CheckboxField
                key={holder.shareIndex}
                label={t('admin.disclosure.holder', { organisation: holder.organisation })}
                checked={selected.includes(holder.shareIndex)}
                onChange={(e) => toggle(holder.shareIndex, e.target.checked)}
              />
            ))}
          </fieldset>

          {decision.refusal ? (
            <p className={styles.refusal} role="status">
              {decision.refusal === 'excluded-holder'
              ? t('admin.disclosure.refusals.excludedHolder', { organisation: decision.excluded?.organisation ?? '' })
              : t(`admin.disclosure.refusals.${decision.refusal === 'threshold-not-met' ? 'thresholdNotMet' : decision.refusal === 'same-organisation' ? 'sameOrganisation' : decision.refusal === 'no-reason' ? 'noReason' : 'noLawfulBasis'}` as const)}
            </p>
          ) : (
            <p className={styles.ready} role="status">
              {t('admin.disclosure.ready', { notified: decision.notify.length })}
            </p>
          )}

          {withheld.length > 0 ? (
            <p className={styles.refusal} role="status">
              {t('admin.disclosure.recovery.withheld', { count: withheld.length, references: withheld.map((p) => p.reference).join('; ') })}
            </p>
          ) : null}

          <div className={styles.actions}>
            <Button variant="danger" icon={<ShieldAlert size={16} aria-hidden="true" />} disabled={!decision.ok} onClick={submit}>
              {t('admin.disclosure.submit')}
            </Button>
          </div>
        </SheetBody>
      </Sheet>

      <Sheet>
        <SheetHead title={t('admin.disclosure.holdersTitle')} meta={t('admin.disclosure.holdersMeta')} headingLevel={2} />
        <SheetBody>
          <ul className={styles.holderList}>
            {ESCROW_HOLDERS.map((holder) => (
              <li key={holder.shareIndex}>
                <Pill size="sm" tone="outline">{t('admin.disclosure.share', { index: holder.shareIndex })}</Pill>
                <span>{holder.organisation}</span>
              </li>
            ))}
          </ul>
          <p className={styles.note}>{t('admin.disclosure.residualRisk')}</p>
        </SheetBody>
      </Sheet>
    </>
  );
}
