'use client';

import { formatDateTime, roleLabel, type Meeting, type Process, type User } from '@mas/domain';
import { useT } from '@mas/messages';
import { Button, RadioGroup, SelectField, Sheet, SheetBody, SheetHead, TextareaField, useToast } from '@mas/ui';
import { useState } from 'react';
import { mayBeInvited } from '@/lib/invites';
import { userName } from '@/lib/selectors';
import { useAppStore, useConfig, useData } from '@/lib/store';
import { useWriteErrors } from '@/lib/writeErrors';
import styles from './MeetingWorkspace.module.css';

type Status = 'accepted' | 'declined' | 'substitute';

/**
 * Your own invitation (D-239): accept, decline with a reason, or send a colleague from your agency.
 * The card is only on the workspace of somebody the meeting invited, and it reads back what they
 * answered. A substitute is offered from the people the case may seat, which is the same test the
 * invite generator applies, and the near-match gate the workspace runs on every name added runs on
 * this one too, before the store is asked.
 */
export function InvitationCard({ meeting, process, user, guard }: { meeting: Meeting; process: Process; user: User; guard: (name: string, add: () => void) => void }) {
  const t = useT();
  const data = useData();
  const config = useConfig();
  const respond = useAppStore((s) => s.respondToInvitation);
  const readErrors = useWriteErrors();
  const { toast } = useToast();
  const invitee = meeting.invitees.find((i) => i.userId === user.id);
  const [status, setStatus] = useState<Status>('accepted');
  const [reason, setReason] = useState('');
  const [substituteId, setSubstituteId] = useState('');
  const [changing, setChanging] = useState(false);
  const [errors, setErrors] = useState<string[]>([]);
  if (!invitee || meeting.status !== 'scheduled') return null;
  const answered = invitee.response;
  const colleagues = data.users.filter((u) => u.id !== user.id && u.agency === user.agency && mayBeInvited(data, config, process, u) && !meeting.invitees.some((i) => i.userId === u.id));

  function send() {
    const submit = () => {
      const result = respond(meeting.id, { status, reason, substituteUserId: status === 'substitute' ? substituteId : undefined });
      if (!result.ok) {
        setErrors(result.errors);
        return;
      }
      setErrors([]);
      setChanging(false);
      toast({ title: t(`meetings.invitation.toast.${status}`), text: t('meetings.invitation.toastText'), tone: 'success' });
    };
    const substitute = status === 'substitute' ? data.users.find((u) => u.id === substituteId) : undefined;
    if (substitute) guard(userName(substitute), submit);
    else submit();
  }

  const metaStatus = answered ? answered.status : 'none';
  return (
    <Sheet className={styles.col12} tone="well" data-testid="your-invitation">
      <SheetHead title={t('meetings.invitation.title')} meta={t('meetings.invitation.meta', { status: metaStatus })} />
      <SheetBody>
        <div className="stack">
          <p className={styles.meta}>{t('meetings.invitation.intro', { role: invitee.role, reason: invitee.reason })}</p>
          {answered && !changing ? (
            <>
              <p data-testid="invitation-answer">{t('meetings.invitation.answered', { status: answered.status, at: formatDateTime(answered.at), reason: answered.reason ?? '', substitute: answered.substitute?.name ?? '' })}</p>
              <div>
                <Button size="sm" variant="secondary" onClick={() => setChanging(true)} data-testid="invitation-change">
                  {t('meetings.invitation.changeAnswer')}
                </Button>
              </div>
            </>
          ) : (
            <>
              {errors.length > 0 ? (
                <p role="alert" className={styles.meta} data-testid="invitation-errors">
                  {readErrors(errors).join(' ')}
                </p>
              ) : null}
              <RadioGroup
                legend={t('meetings.invitation.title')}
                name="invitation-response"
                orientation="horizontal"
                value={status}
                onChange={(v) => setStatus(v as Status)}
                options={[
                  { value: 'accepted', label: t('meetings.invitation.accept') },
                  { value: 'declined', label: t('meetings.invitation.decline') },
                  { value: 'substitute', label: t('meetings.invitation.substitute') },
                ]}
              />
              {status === 'declined' ? <TextareaField label={t('meetings.invitation.declineReason')} hint={t('meetings.invitation.declineReasonHint')} value={reason} onChange={(e) => setReason(e.target.value)} rows={2} required data-testid="invitation-reason" /> : null}
              {status === 'substitute' ? (
                <>
                  <SelectField label={t('meetings.invitation.substituteWho')} hint={t('meetings.invitation.substituteHint')} required value={substituteId} onChange={(e) => setSubstituteId(e.target.value)} placeholder={t('meetings.invitation.substitutePlaceholder')} options={colleagues.map((u) => ({ value: u.id, label: `${userName(u)}, ${roleLabel(u.roleId)}` }))} data-testid="invitation-substitute" />
                  <TextareaField label={t('meetings.invitation.substituteNote')} value={reason} onChange={(e) => setReason(e.target.value)} rows={2} data-testid="invitation-substitute-note" />
                </>
              ) : null}
              <div className="cluster">
                <Button variant="primary" onClick={send} data-testid="invitation-submit">
                  {t('meetings.invitation.submit')}
                </Button>
                {changing ? (
                  <Button variant="quiet" onClick={() => setChanging(false)}>
                    {t('common.actions.cancel')}
                  </Button>
                ) : null}
              </div>
            </>
          )}
        </div>
      </SheetBody>
    </Sheet>
  );
}
