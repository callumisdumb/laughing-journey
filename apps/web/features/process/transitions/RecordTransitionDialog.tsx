'use client';

import { canRecordTransition, clockRuleLabel, leadsTo, stageLabel, transitionLabel, type AnyTransition, type Process } from '@mas/domain';
import { useT } from '@mas/messages';
import { Button, Dialog, useToast } from '@mas/ui';
import { useState } from 'react';
import { useAppStore, useCurrentUser, useNow, type TransitionRecordResult } from '@/lib/store';
import { useWriteErrors } from '@/lib/writeErrors';
import { TRANSITION_FORMS } from './index';
import styles from './transitions.module.css';

/**
 * Recording a decision on the case (D-217). The dialog says where the decision leads, shows the
 * transition's own form, and runs it through the store, which writes the case and everything the
 * tables say follows. Refusals come back as the engine's codes and are worded here, so a refusal
 * reads the same from the case, from a meeting and from a test.
 */
export function RecordTransitionDialog({ open, onClose, process, transition, onDone, initialValue }: { open: boolean; onClose: () => void; process: Process; transition: AnyTransition; onDone?: (result: TransitionRecordResult) => void; /** A first value from the screen that opened it, in place of the form's own. */ initialValue?: unknown }) {
  const t = useT();
  const user = useCurrentUser();
  const now = useNow();
  const record = useAppStore((s) => s.recordTransition);
  const readErrors = useWriteErrors();
  const { toast } = useToast();
  const entry = TRANSITION_FORMS[transition.id];
  const permission = user ? canRecordTransition(user, transition) : null;
  const missing = transition.requires(process);
  const blocked = !entry || (permission !== null && !permission.allowed) || missing.length > 0;
  const [value, setValue] = useState<unknown>(() => (entry ? (initialValue ?? entry.initial(process, { user, now })) : null));
  const [errors, setErrors] = useState<string[]>([]);

  function submit() {
    const result = record(process.id, transition.id, value);
    if (!result.ok) {
      setErrors(result.errors);
      return;
    }
    const none = t('common.values.none');
    toast({
      title: t('processes.next.recorded', { transition: transitionLabel(transition.id) }),
      text: t('processes.next.recordedText', { summary: result.outcome?.summary ?? '', completed: result.clocks?.completed.map(clockRuleLabel).join(', ') || none, started: result.clocks?.started.map(clockRuleLabel).join(', ') || none }),
      tone: 'success',
    });
    onClose();
    onDone?.(result);
  }

  const leads = leadsTo(process, transition);
  const Form = entry?.Form;
  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={t('processes.next.dialogTitle', { transition: transitionLabel(transition.id), reference: process.reference })}
      size="lg"
      errors={readErrors(errors)}
      actions={
        <>
          <Button variant="quiet" onClick={onClose}>
            {t('common.actions.cancel')}
          </Button>
          <Button variant="primary" onClick={submit} disabled={blocked} data-testid="transition-submit">
            {t('processes.next.submit')}
          </Button>
        </>
      }
    >
      <div className="stack" data-testid="transition-dialog">
        <p className={styles.route} data-testid="transition-route">
          {t('processes.next.route', { moves: leads.length > 0 ? 'yes' : 'no', stage: leads.join(', '), stays: stageLabel(process.type, process.stage) })}
          {permission && !permission.allowed ? ` ${permission.reason} ${permission.route ?? ''}` : ''}
          {missing.length > 0 ? ` ${readErrors(missing.map((m) => m.code)).join(' ')}` : ''}
          {!entry ? ` ${t('processes.next.formPending', { transition: transitionLabel(transition.id) })}` : ''}
        </p>
        {Form && value !== null && !blocked ? <Form process={process} value={value} onChange={setValue} /> : null}
      </div>
    </Dialog>
  );
}
