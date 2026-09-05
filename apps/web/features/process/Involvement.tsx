'use client';

import { agencyShort, formatDateTime, roleLabel, type InvolvementRequest, type Process } from '@mas/domain';
import { useT } from '@mas/messages';
import { Button, Dialog, Pill, Sheet, SheetBody, SheetHead, TextField, TextareaField, useToast } from '@mas/ui';
import { UserCheck, UserX } from 'lucide-react';
import { useState } from 'react';
import { PractitionerLink } from '@/components/EntityLink';
import { useAppStore, useCurrentUser, useData } from '@/lib/store';
import { useWriteErrors } from '@/lib/writeErrors';
import styles from './ProcessScreen.module.css';

/**
 * Asking to be involved, and deciding it (D-227). Somebody who can see that a case exists and no
 * more says why they need to be on it; the lead, or anybody on the case, accepts or declines from
 * the case; accepted, the requester joins the members with the reason on the membership, and
 * either way they are told.
 */
export function AskToBeInvolvedDialog({ process, open, onClose }: { process: Process; open: boolean; onClose: () => void }) {
  const t = useT();
  const request = useAppStore((s) => s.requestInvolvement);
  const readErrors = useWriteErrors();
  const { toast } = useToast();
  const data = useData();
  const [reason, setReason] = useState('');
  const [errors, setErrors] = useState<string[]>([]);
  const lead = data.users.find((u) => u.id === process.leadUserId);

  function submit() {
    const result = request(process.id, reason);
    if (!result.ok) {
      setErrors(result.errors);
      return;
    }
    toast({ title: t('processes.head.requestSent.title'), text: t('processes.head.requestSent.text', { hasLead: lead ? 'yes' : 'no', name: lead ? `${lead.givenName} ${lead.familyName}` : '' }), tone: 'success' });
    onClose();
  }

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={t('processes.involvement.dialogTitle', { reference: process.reference })}
      size="md"
      errors={readErrors(errors)}
      actions={
        <>
          <Button variant="quiet" onClick={onClose}>
            {t('common.actions.cancel')}
          </Button>
          <Button variant="primary" onClick={submit} data-testid="involve-submit">
            {t('processes.involvement.submit')}
          </Button>
        </>
      }
    >
      <div className="stack">
        <p>{t('processes.involvement.intro')}</p>
        <TextareaField label={t('processes.involvement.reason')} hint={t('processes.involvement.reasonHint')} value={reason} onChange={(e) => setReason(e.target.value)} rows={4} required data-testid="involve-reason" />
      </div>
    </Dialog>
  );
}

/** The requests on this case, for the people who decide them. Nothing to show when nobody has asked. */
export function InvolvementRequests({ process }: { process: Process }) {
  const t = useT();
  const data = useData();
  const user = useCurrentUser();
  const decide = useAppStore((s) => s.decideInvolvement);
  const readErrors = useWriteErrors();
  const { toast } = useToast();
  const [notes, setNotes] = useState<Record<string, string>>({});
  const requests = data.involvementRequests.filter((r) => r.processId === process.id).sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));
  if (!user || requests.length === 0) return null;
  const pending = requests.filter((r) => r.status === 'pending');

  function settle(request: InvolvementRequest, decision: 'accepted' | 'declined') {
    const result = decide(request.id, decision, notes[request.id]);
    if (!result.ok) {
      toast({ title: t('processes.involvement.refused'), text: readErrors(result.errors).join(' '), tone: 'error' });
      return;
    }
    toast({ title: t('processes.involvement.decidedToast.title', { decision }), text: t('processes.involvement.decidedToast.text', { name: request.requesterName }), tone: 'success' });
  }

  return (
    <Sheet tone={pending.length > 0 ? 'accent' : 'default'} data-testid="involvement-requests">
      <SheetHead title={t('processes.involvement.sheetTitle')} meta={t('processes.involvement.sheetMeta', { count: pending.length })} />
      <SheetBody>
        <div className={styles.members}>
          {requests.map((r) => (
            <div key={r.id} className={styles.member} data-testid={`involvement-request-${r.id}`} data-state={r.status}>
              <span className={styles.memberName}>
                <PractitionerLink userId={r.requesterUserId}>{r.requesterName}</PractitionerLink>{' '}
                <Pill size="sm" tone={r.status === 'pending' ? 'medium' : r.status === 'accepted' ? 'low' : 'outline'}>
                  {t(`processes.involvement.status.${r.status}`)}
                </Pill>
              </span>
              <span className={styles.memberMeta}>{t('processes.involvement.request', { role: roleLabel(r.requesterRoleId), agency: agencyShort(r.requesterAgency), when: formatDateTime(r.createdAt) })}</span>
              <span className={styles.memberMeta}>{r.reason}</span>
              {r.status !== 'pending' ? <span className={styles.memberMeta}>{t('processes.involvement.decidedBy', { name: r.decidedByName ?? '', when: r.decidedAt ? formatDateTime(r.decidedAt) : '', hasNote: r.decisionNote ? 'yes' : 'no', note: r.decisionNote ?? '' })}</span> : null}
              {r.status === 'pending' ? (
                <div className="stack" style={{ marginTop: 6 }}>
                  <TextField label={t('processes.involvement.note')} hint={t('processes.involvement.noteHint')} value={notes[r.id] ?? ''} onChange={(e) => setNotes({ ...notes, [r.id]: e.target.value })} data-testid={`involve-note-${r.id}`} />
                  <div className="cluster">
                    <Button size="sm" variant="primary" icon={<UserCheck size={14} aria-hidden="true" />} onClick={() => settle(r, 'accepted')} data-testid={`involve-accept-${r.id}`}>
                      {t('processes.involvement.accept')}
                    </Button>
                    <Button size="sm" variant="secondary" icon={<UserX size={14} aria-hidden="true" />} onClick={() => settle(r, 'declined')} data-testid={`involve-decline-${r.id}`}>
                      {t('processes.involvement.decline')}
                    </Button>
                  </div>
                </div>
              ) : null}
            </div>
          ))}
        </div>
      </SheetBody>
    </Sheet>
  );
}
