'use client';

import { formatDateTime, londonToIso, type Meeting } from '@mas/domain';
import { useT } from '@mas/messages';
import { Button, DateField, Dialog, TextField, TextareaField, useToast } from '@mas/ui';
import { useState } from 'react';
import { useAppStore } from '@/lib/store';
import { useWriteErrors } from '@/lib/writeErrors';
import styles from './ScheduleMeetingDialog.module.css';

/**
 * A meeting moved or called off carries the reason with it. Both are pipeline writes: the ledger
 * line names the reason, the version history keeps the date it left, and everybody invited is told
 * by the notify step, which is why neither dialog sends anything itself.
 */
export function RescheduleMeetingDialog({ open, onClose, meeting }: { open: boolean; onClose: () => void; meeting: Meeting }) {
  const t = useT();
  const reschedule = useAppStore((s) => s.rescheduleMeeting);
  const readErrors = useWriteErrors();
  const { toast } = useToast();
  const [date, setDate] = useState('');
  const [time, setTime] = useState(formatDateTime(meeting.scheduledAt).slice(-5));
  const [location, setLocation] = useState(meeting.location);
  const [reason, setReason] = useState('');
  const [errors, setErrors] = useState<string[]>([]);


  function submit() {
    const result = reschedule(meeting.id, { scheduledAt: date ? londonToIso(date, time) : '', location, reason: reason.trim() });
    if (!result.ok) {
      setErrors(result.errors);
      return;
    }
    toast({ title: t('meetings.change.rescheduledToast'), text: t('meetings.change.rescheduledToastText'), tone: 'success' });
    onClose();
  }

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={t('meetings.change.rescheduleTitle', { title: meeting.title })}
      errors={readErrors(errors)}
      actions={
        <>
          <Button variant="quiet" onClick={onClose}>
            {t('common.actions.cancel')}
          </Button>
          <Button variant="primary" onClick={submit} data-testid="reschedule-submit">
            {t('meetings.change.rescheduleSubmit')}
          </Button>
        </>
      }
    >
      <div className="stack">
        <p className={styles.hint}>{t('meetings.change.currently', { when: formatDateTime(meeting.scheduledAt), location: meeting.location })}</p>
        <div className={styles.grid}>
          <DateField label={t('meetings.change.newDate')} value={date} onChange={setDate} required data-testid="reschedule-date" />
          <TextField label={t('meetings.change.newTime')} type="time" value={time} onChange={(e) => setTime(e.target.value)} required data-testid="reschedule-time" />
          <TextField label={t('meetings.change.newLocation')} value={location} onChange={(e) => setLocation(e.target.value)} data-testid="reschedule-location" />
        </div>
        <TextareaField label={t('meetings.change.reason')} hint={t('meetings.change.reasonHint')} value={reason} onChange={(e) => setReason(e.target.value)} rows={2} required data-testid="reschedule-reason" />
      </div>
    </Dialog>
  );
}

export function CancelMeetingDialog({ open, onClose, meeting }: { open: boolean; onClose: () => void; meeting: Meeting }) {
  const t = useT();
  const cancel = useAppStore((s) => s.cancelMeeting);
  const readErrors = useWriteErrors();
  const { toast } = useToast();
  const [reason, setReason] = useState('');
  const [errors, setErrors] = useState<string[]>([]);


  function submit() {
    const result = cancel(meeting.id, reason.trim());
    if (!result.ok) {
      setErrors(result.errors);
      return;
    }
    toast({ title: t('meetings.change.cancelledToast'), text: t('meetings.change.cancelledToastText'), tone: 'success' });
    onClose();
  }

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={t('meetings.change.cancelTitle', { title: meeting.title })}
      tone="destructive"
      errors={readErrors(errors)}
      actions={
        <>
          <Button variant="quiet" onClick={onClose}>
            {t('meetings.change.keep')}
          </Button>
          <Button variant="primary" onClick={submit} data-testid="cancel-meeting-submit">
            {t('meetings.change.cancelSubmit')}
          </Button>
        </>
      }
    >
      <div className="stack">
        <p className={styles.hint}>{t('meetings.change.cancelHint', { count: meeting.invitees.length })}</p>
        <TextareaField label={t('meetings.change.reason')} hint={t('meetings.change.cancelReasonHint')} value={reason} onChange={(e) => setReason(e.target.value)} rows={2} required data-testid="cancel-meeting-reason" />
      </div>
    </Dialog>
  );
}
