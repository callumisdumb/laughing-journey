'use client';

import { agencyShort, canLeadProcess, processLabel, roleLabel, type Process } from '@mas/domain';
import { useT } from '@mas/messages';
import { Button, Dialog, SelectField, TextareaField, useToast } from '@mas/ui';
import { useState } from 'react';
import { mayBeInvited } from '@/lib/invites';
import { userName } from '@/lib/selectors';
import { useAppStore, useConfig, useData } from '@/lib/store';
import { useWriteErrors } from '@/lib/writeErrors';
import styles from './transitions/transitions.module.css';

/**
 * Reallocating the lead (D-240). The list is exactly the people the domain rule admits: in the
 * lead agency, holding a role that may lead the type, not an excluded party. The store writes the
 * case, the membership follows, both people are told, the chronology carries it and the source
 * system is asked to record the new allocated worker where its connector allows the intent.
 */
export function ReallocateLeadDialog({ process, open, onClose }: { process: Process; open: boolean; onClose: () => void }) {
  const t = useT();
  const data = useData();
  const config = useConfig();
  const reallocate = useAppStore((s) => s.reallocateLead);
  const readErrors = useWriteErrors();
  const { toast } = useToast();
  const [userId, setUserId] = useState('');
  const [reason, setReason] = useState('');
  const [errors, setErrors] = useState<string[]>([]);
  const lead = data.users.find((u) => u.id === process.leadUserId);
  const candidates = data.users.filter((u) => u.id !== process.leadUserId && u.agency === process.leadAgency && canLeadProcess(u.roleId, process.type) && mayBeInvited(data, config, process, u));

  function submit() {
    const result = reallocate(process.id, userId, reason);
    if (!result.ok) {
      setErrors(result.errors);
      return;
    }
    const next = data.users.find((u) => u.id === userId);
    toast({ title: t('processes.lead.toastTitle'), text: t('processes.lead.toastText', { name: next ? userName(next) : '' }), tone: 'success' });
    onClose();
  }

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={t('processes.lead.dialogTitle', { reference: process.reference })}
      errors={readErrors(errors)}
      actions={
        <>
          <Button variant="quiet" onClick={onClose}>
            {t('common.actions.cancel')}
          </Button>
          <Button variant="primary" onClick={submit} disabled={!userId} data-testid="reallocate-submit">
            {t('processes.lead.submit')}
          </Button>
        </>
      }
    >
      <div className="stack">
        <p className={styles.hint}>{t('processes.lead.intro', { hasLead: lead ? 'yes' : 'no', name: lead ? userName(lead) : '', agency: agencyShort(process.leadAgency), type: processLabel(process.type) })}</p>
        <SelectField label={t('processes.lead.to')} required value={userId} onChange={(e) => setUserId(e.target.value)} placeholder={t('processes.lead.toPlaceholder')} options={candidates.map((u) => ({ value: u.id, label: `${userName(u)}, ${roleLabel(u.roleId)}` }))} data-testid="reallocate-to" />
        <TextareaField label={t('processes.lead.reason')} hint={t('processes.lead.reasonHint')} value={reason} onChange={(e) => setReason(e.target.value)} rows={2} required data-testid="reallocate-reason" />
      </div>
    </Dialog>
  );
}
