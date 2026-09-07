'use client';

import { NMDS_QUARTERS, type NmdsQuarter, type ReturnKind } from '@mas/domain';
import { useT } from '@mas/messages';
import { Button, DateField, Dialog, SelectField, TextField, TextareaField, useToast } from '@mas/ui';
import { useState } from 'react';
import { useAppStore, useNow } from '@/lib/store';
import { useWriteErrors } from '@/lib/writeErrors';
import styles from './ReportFrame.module.css';

/**
 * Marking a return as submitted (D-247). The product sends nothing: this records that a person did,
 * so "did we send Q2" has an answer on a screen, and so the submission deadline clock the quarter
 * carries is completed by the act that answers it rather than by time passing.
 */
export function SubmitReturnDialog({ open, onClose, kind, title, periodId, periodLabel, defaultRecipient }: { open: boolean; onClose: () => void; kind: ReturnKind; title: string; periodId: string; periodLabel: string; defaultRecipient: string }) {
  const t = useT();
  const now = useNow();
  const record = useAppStore((s) => s.recordSubmission);
  const readErrors = useWriteErrors();
  const { toast } = useToast();
  const [recipient, setRecipient] = useState(defaultRecipient);
  const [route, setRoute] = useState('');
  const [submittedOn, setSubmittedOn] = useState(now.toISOString().slice(0, 10));
  const [reference, setReference] = useState('');
  const [note, setNote] = useState('');
  const [quarter, setQuarter] = useState<NmdsQuarter | ''>('');
  const [errors, setErrors] = useState<string[]>([]);

  function submit() {
    const result = record({ kind, periodId, periodLabel, recipient, route, submittedOn, reference, note, nmdsQuarter: quarter || undefined });
    if (!result.ok) {
      setErrors(result.errors);
      return;
    }
    toast({ title: t('reports.submission.toastTitle'), text: t('reports.submission.toastText', { title, period: periodLabel, clocks: result.effects.filter((e) => e.kind === 'clock').length }), tone: 'success' });
    onClose();
  }

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={t('reports.submission.dialogTitle', { title })}
      errors={readErrors(errors)}
      actions={
        <>
          <Button variant="quiet" onClick={onClose}>
            {t('common.actions.cancel')}
          </Button>
          <Button variant="primary" onClick={submit} data-testid="submission-submit">
            {t('reports.submission.submit')}
          </Button>
        </>
      }
    >
      <div className="stack">
        <p className={styles.hint}>{t('reports.submission.intro', { hasClock: kind === 'asp' ? 'yes' : 'no' })}</p>
        <TextField label={t('reports.submission.recipient')} hint={t('reports.submission.recipientHint')} value={recipient} onChange={(e) => setRecipient(e.target.value)} required data-testid="submission-recipient" />
        <DateField label={t('reports.submission.submittedOn')} value={submittedOn} onChange={setSubmittedOn} required data-testid="submission-on" />
        {kind === 'asp' ? (
          <SelectField label={t('reports.submission.nmdsQuarter')} hint={t('reports.submission.nmdsQuarterHint')} value={quarter} onChange={(e) => setQuarter(e.target.value as NmdsQuarter | '')} placeholder={t('common.values.none')} options={NMDS_QUARTERS.map((q) => ({ value: q, label: t(`reports.nmds.quarters.${q}` as const) }))} data-testid="submission-quarter" />
        ) : null}
        <TextField label={t('reports.submission.route')} hint={t('reports.submission.routeHint')} value={route} onChange={(e) => setRoute(e.target.value)} data-testid="submission-route" />
        <TextField label={t('reports.submission.reference')} value={reference} onChange={(e) => setReference(e.target.value)} data-testid="submission-reference" />
        <TextareaField label={t('reports.submission.note')} value={note} onChange={(e) => setNote(e.target.value)} rows={2} data-testid="submission-note" />
        <p className={styles.hint}>{t('reports.submission.eventless')}</p>
      </div>
    </Dialog>
  );
}
