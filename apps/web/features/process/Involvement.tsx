'use client';

import { agencyShort, formatDateTime, roleLabel, type InvolvementRequest, type Process } from '@mas/domain';
import { useT } from '@mas/messages';
import { Button, Dialog, Pill, Sheet, SheetBody, SheetHead, TextField, TextareaField, useToast } from '@mas/ui';
import { Pencil, UserCheck, UserMinus, UserX } from 'lucide-react';
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

/**
 * The requester's own pending request, with the two things they may do to it before it is decided
 * (D-246): change the reason the lead will read, or withdraw it. Shown to the requester only; the
 * lead sees the same request in the list below, with the decision buttons.
 */
export function YourInvolvementRequest({ process }: { process: Process }) {
  const t = useT();
  const data = useData();
  const user = useCurrentUser();
  const amend = useAppStore((s) => s.amendInvolvement);
  const withdraw = useAppStore((s) => s.withdrawInvolvement);
  const readErrors = useWriteErrors();
  const { toast } = useToast();
  const [amending, setAmending] = useState(false);
  const [withdrawing, setWithdrawing] = useState(false);
  const [reason, setReason] = useState('');
  const [errors, setErrors] = useState<string[]>([]);
  const request = data.involvementRequests.find((r) => r.processId === process.id && r.requesterUserId === user?.id && r.status === 'pending');
  const lead = data.users.find((u) => u.id === process.leadUserId);
  if (!request) return null;

  function open(kind: 'amend' | 'withdraw') {
    setErrors([]);
    setReason(kind === 'amend' ? request!.reason : '');
    if (kind === 'amend') setAmending(true);
    else setWithdrawing(true);
  }

  function submitAmend() {
    const result = amend(request!.id, reason);
    if (!result.ok) {
      setErrors(result.errors);
      return;
    }
    toast({ title: t('processes.involvement.amendToast'), text: t('processes.involvement.amendIntro'), tone: 'success' });
    setAmending(false);
  }

  function submitWithdraw() {
    const result = withdraw(request!.id, reason);
    if (!result.ok) {
      setErrors(result.errors);
      return;
    }
    toast({ title: t('processes.involvement.withdrawToast'), text: t('processes.involvement.withdrawToastText', { hasLead: lead ? 'yes' : 'no', name: lead ? `${lead.givenName} ${lead.familyName}` : '' }), tone: 'success' });
    setWithdrawing(false);
  }

  return (
    <Sheet tone="well" data-testid="your-involvement-request">
      <SheetHead title={t('processes.involvement.sheetTitle')} meta={t('processes.involvement.pending', { name: lead ? `${lead.givenName} ${lead.familyName}` : agencyShort(process.leadAgency) })} />
      <SheetBody>
        <div className="stack">
          <p>{t('processes.involvement.yours', { at: formatDateTime(request.createdAt), reason: request.reason })}</p>
          {(request.amendments ?? []).length > 0 ? <p className={styles.memberMeta}>{t('processes.involvement.amended', { count: (request.amendments ?? []).length, at: formatDateTime(request.amendments!.at(-1)!.at) })}</p> : null}
          <div className="cluster">
            <Button size="sm" variant="secondary" icon={<Pencil size={14} aria-hidden="true" />} onClick={() => open('amend')} data-testid="involve-amend">
              {t('processes.involvement.amend')}
            </Button>
            <Button size="sm" variant="quiet" icon={<UserMinus size={14} aria-hidden="true" />} onClick={() => open('withdraw')} data-testid="involve-withdraw">
              {t('processes.involvement.withdraw')}
            </Button>
          </div>
        </div>
      </SheetBody>

      <Dialog
        open={amending}
        onClose={() => setAmending(false)}
        title={t('processes.involvement.amendDialogTitle', { reference: process.reference })}
        errors={readErrors(errors)}
        actions={
          <>
            <Button variant="quiet" onClick={() => setAmending(false)}>
              {t('common.actions.cancel')}
            </Button>
            <Button variant="primary" onClick={submitAmend} data-testid="involve-amend-submit">
              {t('processes.involvement.amendSubmit')}
            </Button>
          </>
        }
      >
        <div className="stack">
          <p>{t('processes.involvement.amendIntro')}</p>
          <TextareaField label={t('processes.involvement.reason')} hint={t('processes.involvement.reasonHint')} value={reason} onChange={(e) => setReason(e.target.value)} rows={4} required data-testid="involve-amend-reason" />
        </div>
      </Dialog>

      <Dialog
        open={withdrawing}
        onClose={() => setWithdrawing(false)}
        title={t('processes.involvement.withdrawDialogTitle', { reference: process.reference })}
        errors={readErrors(errors)}
        actions={
          <>
            <Button variant="quiet" onClick={() => setWithdrawing(false)}>
              {t('common.actions.cancel')}
            </Button>
            <Button variant="primary" onClick={submitWithdraw} data-testid="involve-withdraw-submit">
              {t('processes.involvement.withdrawSubmit')}
            </Button>
          </>
        }
      >
        <div className="stack">
          <p>{t('processes.involvement.withdrawIntro')}</p>
          <TextareaField label={t('processes.involvement.withdrawReason')} value={reason} onChange={(e) => setReason(e.target.value)} rows={2} data-testid="involve-withdraw-reason" />
        </div>
      </Dialog>
    </Sheet>
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
              {r.status === 'withdrawn' ? <span className={styles.memberMeta}>{t('processes.involvement.withdrawn', { at: r.withdrawnAt ? formatDateTime(r.withdrawnAt) : '', hasReason: r.withdrawnReason ? 'yes' : 'no', reason: r.withdrawnReason ?? '' })}</span> : null}
              {r.status !== 'pending' && r.status !== 'withdrawn' ? <span className={styles.memberMeta}>{t('processes.involvement.decidedBy', { name: r.decidedByName ?? '', when: r.decidedAt ? formatDateTime(r.decidedAt) : '', hasNote: r.decisionNote ? 'yes' : 'no', note: r.decisionNote ?? '' })}</span> : null}
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
