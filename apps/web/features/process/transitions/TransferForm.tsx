'use client';

import type { TransferInput } from '@mas/domain';
import { useT } from '@mas/messages';
import { TextField } from '@mas/ui';
import { transitionForm, type TransitionFormProps } from './registry';
import styles from './transitions.module.css';

/**
 * Transferring a case to another authority (D-248). One form for adult support and protection,
 * child protection and adults with incapacity, because each asks the same two things and the tables
 * decide the rest. The consequence line says what stops, so nobody presses it expecting the case to
 * carry on here. MARAC keeps its own wording, which is the protocol's.
 */
function TransferForm({ value, onChange }: TransitionFormProps<TransferInput>) {
  const t = useT();
  return (
    <div className="stack">
      <p className={styles.hint}>{t('processes.forms.transfer.consequence')}</p>
      <div className={styles.grid}>
        <TextField label={t('processes.forms.transfer.area')} hint={t('processes.forms.transfer.areaHint')} value={value.toArea} onChange={(e) => onChange({ ...value, toArea: e.target.value })} required data-testid="transition-area" />
        <TextField label={t('processes.forms.transfer.coordinator')} hint={t('processes.forms.transfer.coordinatorHint')} value={value.receivingCoordinator} onChange={(e) => onChange({ ...value, receivingCoordinator: e.target.value })} required data-testid="transition-coordinator" />
      </div>
    </div>
  );
}

export const TRANSFER_TO_AUTHORITY = transitionForm<TransferInput>(() => ({ toArea: '', receivingCoordinator: '' }), TransferForm);
