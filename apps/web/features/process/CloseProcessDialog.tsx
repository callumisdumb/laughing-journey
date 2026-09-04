'use client';

import { closureReasonsFor, computeClock, contextFor, findClockRule, formatDate, resolveNeedToKnow, runningClocks, type Process } from '@mas/domain';
import { useT } from '@mas/messages';
import { Button, Dialog, SelectField, TextareaField, useToast } from '@mas/ui';
import { useState } from 'react';
import { useAppStore, useConfig, useNow } from '@/lib/store';
import { useWriteErrors } from '@/lib/writeErrors';
import styles from './terminal.module.css';

/**
 * Closing a case, which is not a status change.
 *
 * The reason comes from the list the process's own national return uses, and where there is no
 * national list the dialog says so rather than letting a locally agreed reason be mistaken for a
 * counted one. Everything the closure does is on screen before the button: the clocks that will stop
 * with the dates they were due, and the agencies that will get a closure notice. A case that closes
 * silently leaves four agencies working to a plan nobody is coordinating any more.
 */
export function CloseProcessDialog({ process, open, onClose }: { process: Process; open: boolean; onClose: () => void }) {
  const t = useT();
  const config = useConfig();
  const now = useNow();
  const close = useAppStore((s) => s.closeProcess);
  const readErrors = useWriteErrors();
  const { toast } = useToast();

  const [reasonId, setReasonId] = useState('');
  const [note, setNote] = useState('');
  const [errors, setErrors] = useState<string[]>([]);

  const reasons = closureReasonsFor(process.type);
  const statutory = reasons.every((r) => r.statutory);
  const running = runningClocks(process);
  const stopping = running.flatMap((trigger) => {
    const rule = findClockRule(config.clockRules, trigger.ruleId);
    if (!rule) return [];
    const clock = computeClock(trigger, rule, now, { bankHolidays: config.bankHolidays, councilHolidays: config.councilHolidays });
    return [{ id: trigger.id, label: clock.label, dueAt: clock.dueAt }];
  });

  // The same resolver the write uses, so the list on screen is who actually gets the notice. A case
  // that closes silently leaves several agencies working to a plan nobody is coordinating any more.
  const telling = resolveNeedToKnow(contextFor(process), config.needToKnow, config.exclusions).recipients;

  function submit() {
    const result = close(process.id, { reasonId, note });
    if (!result.ok) {
      setErrors(result.errors);
      return;
    }
    toast({ title: t('processes.close.doneTitle'), text: t('processes.close.doneText', { count: result.stopped?.length ?? 0 }), tone: 'success' });
    onClose();
  }

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={t('processes.close.title', { reference: process.reference })}
      size="md"
      errors={readErrors(errors)}
      actions={
        <>
          <Button variant="quiet" onClick={onClose}>
            {t('common.actions.cancel')}
          </Button>
          <Button variant="primary" onClick={submit} data-testid="close-submit">
            {t('processes.close.submit')}
          </Button>
        </>
      }
    >
      <div className="stack">
        <SelectField
          label={t('processes.close.reason')}
          hint={statutory ? t('processes.close.statutoryNote') : t('processes.close.localNote')}
          value={reasonId}
          onChange={(e) => setReasonId(e.target.value)}
          placeholder={t('processes.close.reasonPlaceholder')}
          options={reasons.map((r) => ({ value: r.id, label: r.label }))}
          required
          data-testid="close-reason"
        />
        <TextareaField label={t('processes.close.note')} hint={t('processes.close.noteHint')} value={note} onChange={(e) => setNote(e.target.value)} rows={3} required data-testid="close-note" />

        <div className={styles.consequence} data-testid="close-clocks">
          <span className={styles.consequenceHead}>{stopping.length > 0 ? t('processes.close.clocksHead') : t('processes.close.clocksNone')}</span>
          {stopping.map((clock) => (
            <span key={clock.id}>{t('processes.close.clockLine', { label: clock.label, date: formatDate(clock.dueAt) })}</span>
          ))}
        </div>

        <div className={styles.consequence} data-testid="close-telling">
          <span className={styles.consequenceHead}>{telling.length > 0 ? t('processes.close.tellHead') : t('processes.close.tellNone')}</span>
          {telling.map((recipient) => (
            <span key={recipient.rowId}>{recipient.label}</span>
          ))}
        </div>
      </div>
    </Dialog>
  );
}

/**
 * Reopening, which restores the deadlines rather than restarting them.
 *
 * A clock the closure stopped resumes against the date it started, because the case was shut and the
 * statutory period was running the whole time. The dialog says so, with the dates, because "the
 * clocks resume" and "the clocks restart" produce very different due dates and a practitioner needs
 * to know which one they are about to get.
 */
export function ReopenProcessDialog({ process, open, onClose }: { process: Process; open: boolean; onClose: () => void }) {
  const t = useT();
  const config = useConfig();
  const now = useNow();
  const reopen = useAppStore((s) => s.reopenProcess);
  const readErrors = useWriteErrors();
  const { toast } = useToast();

  const [reason, setReason] = useState('');
  const [errors, setErrors] = useState<string[]>([]);

  const resuming = process.clocks
    .filter((trigger) => trigger.stoppedByClosure)
    .flatMap((trigger) => {
      const rule = findClockRule(config.clockRules, trigger.ruleId);
      if (!rule) return [];
      const clock = computeClock({ ...trigger, completedAt: undefined }, rule, now, { bankHolidays: config.bankHolidays, councilHolidays: config.councilHolidays });
      return [{ id: trigger.id, label: clock.label, dueAt: clock.dueAt }];
    });

  function submit() {
    const result = reopen(process.id, reason);
    if (!result.ok) {
      setErrors(result.errors);
      return;
    }
    toast({ title: t('processes.reopen.doneTitle'), text: t('processes.reopen.doneText', { count: result.resumed?.length ?? 0 }), tone: 'success' });
    onClose();
  }

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={t('processes.reopen.title', { reference: process.reference })}
      size="md"
      errors={readErrors(errors)}
      actions={
        <>
          <Button variant="quiet" onClick={onClose}>
            {t('common.actions.cancel')}
          </Button>
          <Button variant="primary" onClick={submit} data-testid="reopen-submit">
            {t('processes.reopen.submit')}
          </Button>
        </>
      }
    >
      <div className="stack">
        <TextareaField label={t('processes.reopen.reason')} hint={t('processes.reopen.reasonHint')} value={reason} onChange={(e) => setReason(e.target.value)} rows={3} required data-testid="reopen-reason" />

        <div className={styles.consequence} data-testid="reopen-clocks">
          <span className={styles.consequenceHead}>{resuming.length > 0 ? t('processes.reopen.clocksHead') : t('processes.reopen.clocksNone')}</span>
          {resuming.map((clock) => (
            <span key={clock.id}>{t('processes.reopen.clockLine', { label: clock.label, date: formatDate(clock.dueAt) })}</span>
          ))}
          {resuming.length > 0 ? <span className={styles.consequenceNote}>{t('processes.reopen.clocksNote')}</span> : null}
        </div>
      </div>
    </Dialog>
  );
}
