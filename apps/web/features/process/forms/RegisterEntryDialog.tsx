'use client';

import { EXCLUSION_PARTIES, exclusionPartyLabel, mustNotReceiveQuestion, withMustNotReceive, type ExclusionParty, type Process } from '@mas/domain';
import { useT } from '@mas/messages';
import { Button, Dialog, SelectField, TextField, TextareaField, useToast } from '@mas/ui';
import { useState } from 'react';
import { useAppStore, useNow } from '@/lib/store';
import { useWriteErrors } from '@/lib/writeErrors';
import styles from './records.module.css';

/**
 * A manual entry on the case-role register: somebody who must not receive information about a case.
 *
 * The register is mostly derived, from the referral and from relationships, and derivation is the
 * right default. What it cannot do is know about the housing officer who is the perpetrator's
 * brother, because no record links them to the case. That knowledge arrives in a phone call, and if
 * there is nowhere to put it, it stays in somebody's head until the wrong person is invited to a
 * meeting. So this is a create path, keyed by the typed name, with the reason on the record.
 *
 * The wording of the question is the one the DAQ and the MAPPA referral ask, read from the
 * catalogue, so an Admin override changes it in all three places at once.
 */
export function RegisterEntryDialog({ process, open, onClose }: { process: Process; open: boolean; onClose: () => void }) {
  const t = useT();
  const now = useNow();
  const write = useAppStore((s) => s.write);
  const readErrors = useWriteErrors();
  const { toast } = useToast();

  const [name, setName] = useState('');
  const [party, setParty] = useState<ExclusionParty>('perpetrator-associates');
  const [relationship, setRelationship] = useState('');
  const [reason, setReason] = useState('');
  const [errors, setErrors] = useState<string[]>([]);

  function submit() {
    const rules: string[] = [];
    if (name.trim().length < 2) rules.push('registerNameRequired');
    if (reason.trim().length < 5) rules.push('registerReasonRequired');

    const update = withMustNotReceive(
      process.parties,
      [{ name: name.trim(), party, relationship: relationship.trim() || undefined, reason: reason.trim() }],
      now.toISOString().slice(0, 10),
      t('processes.parties.via'),
    );

    const result = write({
      collection: 'processes',
      record: { ...process, parties: update.parties },
      intent: 'update',
      act: 'edit',
      targetType: 'process',
      targetLabel: t('processes.parties.audit', { name: name.trim(), party: exclusionPartyLabel(party) }),
      processId: process.id,
      rules,
      event: {
        eventType: 'sharing',
        significance: 'moderate',
        // Naming somebody who must not receive information is itself information about that person
        // and about the case. It stays with the agencies working the case.
        visibility: 'agency-only',
        title: t('processes.parties.eventTitle'),
        detail: t('processes.parties.eventDetail', { name: name.trim(), party: exclusionPartyLabel(party), reason: reason.trim() }),
        subjectIds: process.subjectIds,
        linkedProcessIds: [process.id],
      },
    });

    if (!result.ok) {
      setErrors(result.errors);
      return;
    }
    toast({
      title: update.updated > 0 ? t('processes.parties.done.updatedTitle') : t('processes.parties.done.addedTitle'),
      text: t('processes.parties.done.text', { name: name.trim() }),
      tone: 'success',
    });
    onClose();
  }

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={t('processes.parties.addTitle')}
      size="md"
      errors={readErrors(errors)}
      actions={
        <>
          <Button variant="quiet" onClick={onClose}>
            {t('common.actions.cancel')}
          </Button>
          <Button variant="primary" onClick={submit} data-testid="register-submit">
            {t('processes.parties.submit')}
          </Button>
        </>
      }
    >
      <div className="stack">
        <p>{mustNotReceiveQuestion()}</p>
        <div className={styles.grid}>
          <TextField label={t('processes.parties.name')} value={name} onChange={(e) => setName(e.target.value)} required data-testid="register-name" />
          <SelectField label={t('processes.parties.party')} value={party} onChange={(e) => setParty(e.target.value as ExclusionParty)} options={EXCLUSION_PARTIES.map((p) => ({ value: p, label: exclusionPartyLabel(p) }))} data-testid="register-party" />
        </div>
        <TextField label={t('processes.parties.relationship')} hint={t('processes.parties.relationshipHint')} value={relationship} onChange={(e) => setRelationship(e.target.value)} data-testid="register-relationship" />
        <TextareaField label={t('processes.parties.reason')} hint={t('processes.parties.reasonHint')} value={reason} onChange={(e) => setReason(e.target.value)} rows={2} required data-testid="register-reason" />
        <p className={styles.hint}>{t('processes.parties.consequence')}</p>
      </div>
    </Dialog>
  );
}
