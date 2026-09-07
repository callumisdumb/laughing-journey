'use client';

import { AGENCIES, agencyShort, referralFields, referralValue, type Process } from '@mas/domain';
import { useT } from '@mas/messages';
import { Button, Dialog, SelectField, TextField, TextareaField, useToast } from '@mas/ui';
import { useState } from 'react';
import { referralFieldLabel, useAppStore } from '@/lib/store';
import { useWriteErrors } from '@/lib/writeErrors';
import styles from './transitions/transitions.module.css';

/**
 * Correcting the referral a case was opened on (D-245). The fields are the opening record's own,
 * per process type, and the ones a decision rests on are not among them: the dialog says so rather
 * than leaving a practitioner to wonder why the perpetrator is not editable here.
 */
export function CorrectReferralDialog({ process, open, onClose }: { process: Process; open: boolean; onClose: () => void }) {
  const t = useT();
  const correct = useAppStore((s) => s.correctReferral);
  const readErrors = useWriteErrors();
  const { toast } = useToast();
  const fields = referralFields(process.type);
  const [values, setValues] = useState<Record<string, string>>(() => Object.fromEntries(fields.map((f) => [f.id, referralValue(process, f.id)])));
  const [reason, setReason] = useState('');
  const [errors, setErrors] = useState<string[]>([]);
  const changed = fields.filter((f) => values[f.id] !== referralValue(process, f.id));

  function submit() {
    const result = correct(process.id, fields.map((f) => ({ field: f.id, value: values[f.id] ?? '' })), reason);
    if (!result.ok) {
      setErrors(result.errors);
      return;
    }
    toast({ title: t('processes.referral.toastTitle'), text: t('processes.referral.toastText', { count: changed.length }), tone: 'success' });
    onClose();
  }

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={t('processes.referral.dialogTitle', { reference: process.reference })}
      size="lg"
      errors={readErrors(errors)}
      actions={
        <>
          <Button variant="quiet" onClick={onClose}>
            {t('common.actions.cancel')}
          </Button>
          <Button variant="primary" onClick={submit} disabled={changed.length === 0} data-testid="referral-submit">
            {t('processes.referral.submit')}
          </Button>
        </>
      }
    >
      <div className="stack">
        <p className={styles.hint}>{t('processes.referral.intro')}</p>
        {fields.map((f) => {
          const label = referralFieldLabel(f.label);
          const value = values[f.id] ?? '';
          const set = (v: string) => setValues({ ...values, [f.id]: v });
          if (f.kind === 'agency') {
            return <SelectField key={f.id} label={label} value={value} onChange={(e) => set(e.target.value)} options={AGENCIES.map((a) => ({ value: a, label: agencyShort(a) }))} data-testid={`referral-${f.label}`} />;
          }
          if (f.kind === 'textarea') {
            return <TextareaField key={f.id} label={label} value={value} onChange={(e) => set(e.target.value)} rows={3} data-testid={`referral-${f.label}`} />;
          }
          if (f.kind === 'date-time') {
            // An instant, corrected as the instant it is: the record stores ISO, so the field edits ISO.
            return <TextField key={f.id} label={label} value={value} onChange={(e) => set(e.target.value)} data-testid={`referral-${f.label}`} />;
          }
          return <TextField key={f.id} label={label} value={value} onChange={(e) => set(e.target.value)} data-testid={`referral-${f.label}`} />;
        })}
        <p className={styles.hint}>{t('processes.referral.fixed')}</p>
        <TextareaField label={t('processes.referral.reason')} hint={t('processes.referral.reasonHint')} value={reason} onChange={(e) => setReason(e.target.value)} rows={2} required data-testid="referral-reason" />
      </div>
    </Dialog>
  );
}
