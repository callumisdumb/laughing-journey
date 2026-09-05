'use client';

import { canRecordTransition, clockRuleLabel, heldTransitionFor, heldTransitionsFor, stageLabel, transitionLabel, type Meeting, type Process } from '@mas/domain';
import { useT } from '@mas/messages';
import { Button, Dialog, TextareaField, useToast } from '@mas/ui';
import { useState } from 'react';
import { useAppStore, useCurrentUser } from '@/lib/store';
import { useWriteErrors } from '@/lib/writeErrors';
import { HELD_FORMS } from './outcomes';
import styles from './outcomes/outcomes.module.css';

/**
 * Closing a meeting is recording the decision it made (D-213).
 *
 * The meeting's type names the transition it fires from the case's current stage, and that
 * transition's outcome form is what this dialog shows: the case conference's two questions, the
 * review's continue or close, the MARAC's information shared and risk discussion. Submitting runs
 * the transition through the store, which writes the case, its clocks and its follow-ons, tells
 * everybody the stage moved, and marks the meeting held with the transition it fired. A meeting the
 * engine has no view of at this stage is held here with a note and its minute opened; a meeting
 * whose transition fires from a stage the case has not reached is told which, rather than closed
 * with nothing decided.
 */
export function HoldMeetingDialog({ open, onClose, meeting, process, onHeld }: { open: boolean; onClose: () => void; meeting: Meeting; process: Process; onHeld?: () => void }) {
  const t = useT();
  const user = useCurrentUser();
  const recordTransition = useAppStore((s) => s.recordTransition);
  const hold = useAppStore((s) => s.holdMeeting);
  const readErrors = useWriteErrors();
  const { toast } = useToast();

  const transition = heldTransitionFor(process, meeting.type);
  const elsewhere = transition ? [] : heldTransitionsFor(process.type, meeting.type);
  const permission = transition && user ? canRecordTransition(user, transition) : null;
  const missing = transition ? transition.requires(process) : [];
  const entry = transition ? HELD_FORMS[transition.id] : undefined;
  const blocked = elsewhere.length > 0 || (permission !== null && !permission.allowed) || missing.length > 0 || (transition !== undefined && entry === undefined);

  const [value, setValue] = useState<unknown>(() => (entry ? entry.initial(meeting, process, { user }) : null));
  const [note, setNote] = useState('');
  const [errors, setErrors] = useState<string[]>([]);


  function submit() {
    const result = transition ? recordTransition(process.id, transition.id, { ...(value as object), meetingId: meeting.id }) : hold(meeting.id, note);
    if (!result.ok) {
      setErrors(result.errors);
      return;
    }
    const none = t('common.values.none');
    const inquorate = 'reschedule' in result && result.reschedule === meeting.id;
    toast({
      title: inquorate ? t('meetings.hold.inquorateToast') : t('meetings.close.toastTitle'),
      text: inquorate ? t('meetings.hold.inquorateToastText') : t('meetings.close.toastText', { completed: result.clocks?.completed.map(clockRuleLabel).join(', ') || none, started: result.clocks?.started.map(clockRuleLabel).join(', ') || none }),
      tone: 'success',
    });
    onClose();
    onHeld?.();
  }

  const routeText = transition
    ? t('meetings.hold.transition', { transition: transitionLabel(transition.id), moves: transition.to.some((s) => s !== process.stage) ? 'yes' : 'no', stage: transition.to.filter((s) => s !== process.stage).map((s) => stageLabel(process.type, s)).join(', ') })
    : elsewhere.length > 0
      ? t('meetings.hold.wrongStage', { transition: transitionLabel(elsewhere[0]!.id), stages: [...new Set(elsewhere.flatMap((x) => [...x.from]))].map((s) => stageLabel(process.type, s)).join(', '), stage: stageLabel(process.type, process.stage) })
      : t('meetings.hold.noTransition');

  const Form = entry?.Form;

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={t('meetings.hold.title', { title: meeting.title })}
      size="lg"
      errors={readErrors(errors)}
      actions={
        <>
          <Button variant="quiet" onClick={onClose}>
            {t('common.actions.cancel')}
          </Button>
          <Button variant="primary" onClick={submit} disabled={blocked} data-testid="hold-submit">
            {t('meetings.hold.submit')}
          </Button>
        </>
      }
    >
      <div className="stack">
        <p className={styles.hint} data-testid="hold-route" data-state={transition ? (entry ? 'transition' : 'pending') : elsewhere.length > 0 ? 'refused' : 'plain'}>
          {routeText}
          {permission && !permission.allowed ? ` ${permission.reason} ${permission.route ?? ''}` : ''}
          {missing.length > 0 ? ` ${readErrors(missing.map((m) => m.code)).join(' ')}` : ''}
          {transition && !entry ? ` ${t('meetings.hold.formPending', { transition: transitionLabel(transition.id) })}` : ''}
        </p>
        {Form && value !== null && !blocked ? <Form meeting={meeting} process={process} value={value} onChange={setValue} /> : null}
        {!transition && elsewhere.length === 0 ? <TextareaField label={t('meetings.hold.note')} hint={t('meetings.hold.noteHint')} value={note} onChange={(e) => setNote(e.target.value)} rows={2} data-testid="hold-note" /> : null}
      </div>
    </Dialog>
  );
}
