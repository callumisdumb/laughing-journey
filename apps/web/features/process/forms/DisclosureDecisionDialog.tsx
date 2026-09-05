'use client';

import { type MappaDetail, type MappaProcess } from '@mas/domain';
import { tKey, useT } from '@mas/messages';
import { Button, Dialog, SelectField, TextField, TextareaField, useToast } from '@mas/ui';
import { Plus, X } from 'lucide-react';
import { useState } from 'react';
import { useAppStore } from '@/lib/store';
import { useWriteErrors } from '@/lib/writeErrors';
import styles from './records.module.css';

type Disclosure = MappaDetail['disclosures'][number];
type RecipientKind = Disclosure['recipientKind'];

const RECIPIENT_KINDS = ['employer', 'school', 'partner', 'landlord', 'other'] as const satisfies readonly RecipientKind[];
const recipientKindLabel = (kind: RecipientKind) => tKey(`mappa.disclosures.recipientKind.${kind}`);

/**
 * A proposed disclosure to a third party, entered as the facts to be disclosed and nothing else.
 *
 * The facts are a list rather than a paragraph because a disclosure is limited to what was decided,
 * and a paragraph cannot be checked against that limit afterwards. Each line is one fact the
 * recipient may be told. The record opens pending: the approve and decline buttons on the register
 * are the decision, made by somebody with the authority to make it, and a dialog that recorded the
 * decision at the same time as the proposal would be recording that nobody decided anything.
 */
export function DisclosureDecisionDialog({ process, open, onClose }: { process: MappaProcess; open: boolean; onClose: () => void }) {
  const t = useT();
  const write = useAppStore((s) => s.write);
  const newId = useAppStore((s) => s.newId);
  const readErrors = useWriteErrors();
  const { toast } = useToast();

  const [recipient, setRecipient] = useState('');
  const [recipientKind, setRecipientKind] = useState<RecipientKind>('employer');
  const [facts, setFacts] = useState<string[]>(['']);
  const [rationale, setRationale] = useState('');
  const [errors, setErrors] = useState<string[]>([]);

  function submit() {
    const disclosure: Disclosure = {
      id: newId('dis'),
      recipient: recipient.trim(),
      recipientKind,
      status: 'pending',
      factsToDisclose: facts.map((f) => f.trim()).filter((f) => f !== ''),
      rationale: rationale.trim(),
    };

    const rules: string[] = [];
    if (disclosure.recipient === '') rules.push('disclosureRecipientRequired');
    if (disclosure.factsToDisclose.length === 0) rules.push('disclosureFactRequired');
    if (disclosure.rationale.length < 10) rules.push('disclosureRationaleRequired');

    const result = write({
      collection: 'processes',
      record: { ...process, detail: { ...process.detail, disclosures: [...process.detail.disclosures, disclosure] } },
      intent: 'update',
      act: 'edit',
      targetType: 'process',
      targetLabel: t('mappa.disclosures.audit', { recipient: disclosure.recipient }),
      processId: process.id,
      rules,
      event: {
        eventType: 'disclosure',
        significance: 'high',
        // A proposed disclosure names a third party and says why. It stays inside the responsible
        // authorities until it is decided, so it is agency-only and not on the integrated view.
        visibility: 'agency-only',
        title: t('mappa.disclosures.eventTitle', { recipient: disclosure.recipient }),
        detail: disclosure.rationale,
        subjectIds: process.subjectIds,
        linkedProcessIds: [process.id],
      },
    });

    if (!result.ok) {
      setErrors(result.errors);
      return;
    }
    toast({ title: t('mappa.disclosures.done.title'), text: t('mappa.disclosures.done.text', { recipient: disclosure.recipient, count: disclosure.factsToDisclose.length }), tone: 'success' });
    onClose();
  }

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={t('mappa.disclosures.addTitle')}
      size="md"
      errors={readErrors(errors)}
      actions={
        <>
          <Button variant="quiet" onClick={onClose}>
            {t('common.actions.cancel')}
          </Button>
          <Button variant="primary" onClick={submit} data-testid="disclosure-submit">
            {t('mappa.disclosures.submit')}
          </Button>
        </>
      }
    >
      <div className="stack">
        <div className={styles.grid}>
          <TextField label={t('mappa.disclosures.recipient')} value={recipient} onChange={(e) => setRecipient(e.target.value)} required data-testid="disclosure-recipient" />
          <SelectField label={t('mappa.disclosures.recipientKindLabel')} value={recipientKind} onChange={(e) => setRecipientKind(e.target.value as RecipientKind)} options={RECIPIENT_KINDS.map((k) => ({ value: k, label: recipientKindLabel(k) }))} data-testid="disclosure-recipient-kind" />
        </div>

        <fieldset className={styles.rows}>
          <legend className={styles.legend}>{t('mappa.disclosures.facts')}</legend>
          <p className={styles.hint}>{t('mappa.disclosures.factsHint')}</p>
          {facts.map((fact, i) => (
            <div key={i} className={styles.row}>
              <TextField label={t('mappa.disclosures.factLabel', { number: i + 1 })} value={fact} onChange={(e) => setFacts(facts.map((f, j) => (j === i ? e.target.value : f)))} data-testid={`disclosure-fact-${i}`} />
              {facts.length > 1 ? (
                <Button size="sm" variant="quiet" icon={<X size={14} aria-hidden="true" />} onClick={() => setFacts(facts.filter((_, j) => j !== i))}>
                  {t('mappa.disclosures.removeFact')}
                </Button>
              ) : null}
            </div>
          ))}
          <Button size="sm" variant="secondary" icon={<Plus size={14} aria-hidden="true" />} onClick={() => setFacts([...facts, ''])} data-testid="disclosure-add-fact">
            {t('mappa.disclosures.addFact')}
          </Button>
        </fieldset>

        <TextareaField label={t('mappa.disclosures.rationale')} hint={t('mappa.disclosures.rationaleHint')} value={rationale} onChange={(e) => setRationale(e.target.value)} rows={3} required data-testid="disclosure-rationale" />
        <p className={styles.hint}>{t('mappa.disclosures.pendingNote')}</p>
      </div>
    </Dialog>
  );
}
