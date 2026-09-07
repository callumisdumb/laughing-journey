'use client';

import type { ReturnInput } from '@mas/domain';
import { useT } from '@mas/messages';
import { TextareaField } from '@mas/ui';
import { transitionForm, type TransitionFormProps } from './registry';
import styles from './transitions.module.css';

/**
 * Returning a case a stage (D-241): one form for the three ways back, because each asks the same
 * thing, a reason, and the tables decide the rest. The consequence line says what the return does
 * to the clocks and what is recorded next, per type, so nobody presses it expecting a reset.
 */
function ReturnForm({ process, value, onChange }: TransitionFormProps<ReturnInput>) {
  const t = useT();
  return (
    <div className="stack">
      <p className={styles.hint}>{t('processes.forms.return.consequence', { process: process.type })}</p>
      <TextareaField label={t('processes.forms.return.reason')} hint={t('processes.forms.return.reasonHint')} value={value.reason} onChange={(e) => onChange({ ...value, reason: e.target.value })} rows={3} required data-testid="transition-reason" />
    </div>
  );
}

export const RETURN_A_STAGE = transitionForm<ReturnInput>(() => ({ reason: '' }), ReturnForm);
