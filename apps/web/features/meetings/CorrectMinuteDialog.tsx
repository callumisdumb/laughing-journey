'use client';

import type { Meeting } from '@mas/domain';
import { useT } from '@mas/messages';
import { Button, Dialog, TextareaField, useToast } from '@mas/ui';
import { useState } from 'react';
import { useAppStore } from '@/lib/store';
import { useWriteErrors } from '@/lib/writeErrors';
import styles from './ScheduleMeetingDialog.module.css';

/**
 * A correction to an approved minute (D-242): what was recorded, what is now recorded, and why.
 * The store writes the addendum, the sharing records to the original distribution at their levels
 * and the notifications; the pack shows it beneath the minute.
 */
export function CorrectMinuteDialog({ open, onClose, meeting }: { open: boolean; onClose: () => void; meeting: Meeting }) {
  const t = useT();
  const correct = useAppStore((s) => s.correctMinute);
  const readErrors = useWriteErrors();
  const { toast } = useToast();
  const [recorded, setRecorded] = useState('');
  const [nowRecorded, setNowRecorded] = useState('');
  const [reason, setReason] = useState('');
  const [errors, setErrors] = useState<string[]>([]);
  const recipients = meeting.minute.status === 'distributed' ? meeting.distribution.filter((d) => d.sharingRecordId).length : 0;

  function submit() {
    const result = correct(meeting.id, { recorded, nowRecorded, reason });
    if (!result.ok) {
      setErrors(result.errors);
      return;
    }
    toast({ title: t('meetings.correction.toastTitle'), text: t('meetings.correction.toastText', { count: result.shares?.length ?? 0 }), tone: 'success' });
    onClose();
  }

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={t('meetings.correction.dialogTitle', { title: meeting.title })}
      errors={readErrors(errors)}
      actions={
        <>
          <Button variant="quiet" onClick={onClose}>
            {t('common.actions.cancel')}
          </Button>
          <Button variant="primary" onClick={submit} data-testid="correction-submit">
            {t('meetings.correction.submit')}
          </Button>
        </>
      }
    >
      <div className="stack">
        <p className={styles.hint}>{t('meetings.correction.intro', { count: recipients })}</p>
        <TextareaField label={t('meetings.correction.recorded')} value={recorded} onChange={(e) => setRecorded(e.target.value)} rows={2} required data-testid="correction-recorded" />
        <TextareaField label={t('meetings.correction.nowRecorded')} value={nowRecorded} onChange={(e) => setNowRecorded(e.target.value)} rows={2} required data-testid="correction-now" />
        <TextareaField label={t('meetings.correction.reason')} value={reason} onChange={(e) => setReason(e.target.value)} rows={2} data-testid="correction-reason" />
      </div>
    </Dialog>
  );
}
