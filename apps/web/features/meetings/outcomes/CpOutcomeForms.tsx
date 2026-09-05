'use client';

import { CP_DEREGISTRATION_REASONS, cpDeregistrationReasonLabel, formatDateTime, type CoreGroupInput, type CpDeregistrationReason, type ReviewCppmHeldInput } from '@mas/domain';
import { useT } from '@mas/messages';
import { CheckboxField, RadioGroup, SelectField, TextareaField } from '@mas/ui';
import { heldForm, type OutcomeFormProps } from './registry';
import styles from './outcomes.module.css';

/**
 * The review child protection planning meeting: quorate or not, and if it was, whether the plan
 * continues or the child comes off the register with the national return's reason. The core group
 * meeting: who came, what moved, and whether something changed enough to bring the review forward.
 */
function ReviewCppmHeldForm({ value, onChange }: OutcomeFormProps<ReviewCppmHeldInput>) {
  const t = useT();
  return (
    <div className="stack">
      <CheckboxField label={t('meetings.outcome.cpReview.quorate')} hint={t('meetings.outcome.cpReview.quorateHint')} checked={value.quorate} onChange={(e) => onChange({ ...value, quorate: e.target.checked })} data-testid="outcome-quorate" />
      {value.quorate ? (
        <>
          <RadioGroup
            legend={t('meetings.outcome.cpReview.decision')}
            name="cp-review-decision"
            value={value.decision}
            onChange={(v) => onChange({ ...value, decision: v as ReviewCppmHeldInput['decision'], deregistration: v === 'deregister' ? (value.deregistration ?? { reason: CP_DEREGISTRATION_REASONS[0], note: '' }) : undefined })}
            orientation="horizontal"
            options={[
              { value: 'continue', label: t('meetings.outcome.cpReview.continue') },
              { value: 'deregister', label: t('meetings.outcome.cpReview.deregister') },
            ]}
          />
          {value.decision === 'deregister' ? (
            <div className={styles.grid}>
              <SelectField label={t('meetings.outcome.cpReview.deregistrationReason')} value={value.deregistration?.reason ?? ''} onChange={(e) => onChange({ ...value, deregistration: { reason: e.target.value as CpDeregistrationReason, note: value.deregistration?.note ?? '' } })} options={CP_DEREGISTRATION_REASONS.map((r) => ({ value: r, label: cpDeregistrationReasonLabel(r) }))} required data-testid="outcome-deregistration-reason" />
              <TextareaField label={t('meetings.outcome.cpReview.deregistrationNote')} value={value.deregistration?.note ?? ''} onChange={(e) => onChange({ ...value, deregistration: { reason: value.deregistration?.reason ?? CP_DEREGISTRATION_REASONS[0], note: e.target.value } })} rows={2} data-testid="outcome-deregistration-note" />
            </div>
          ) : null}
          <TextareaField label={t('meetings.outcome.rationale')} hint={t('meetings.outcome.rationaleHint')} value={value.rationale} onChange={(e) => onChange({ ...value, rationale: e.target.value })} rows={3} required data-testid="outcome-rationale" />
        </>
      ) : (
        <p className={styles.hint}>{t('meetings.outcome.cpReview.inquorateHint')}</p>
      )}
    </div>
  );
}

function CoreGroupForm({ value, meeting, onChange }: OutcomeFormProps<CoreGroupInput>) {
  const t = useT();
  return (
    <div className="stack">
      <p className={styles.hint}>{t('meetings.outcome.coreGroup.heldAt', { when: formatDateTime(meeting.scheduledAt) })}</p>
      <fieldset className={styles.section}>
        <legend className={styles.legend}>{t('meetings.outcome.coreGroup.attendance')}</legend>
        {value.attendance.map((a, i) => (
          <CheckboxField key={a.userId ?? a.name} label={a.name} checked={a.present} onChange={(e) => onChange({ ...value, attendance: value.attendance.map((x, j) => (j === i ? { ...x, present: e.target.checked } : x)) })} data-testid={`outcome-present-${a.userId ?? i}`} />
        ))}
      </fieldset>
      <TextareaField label={t('meetings.outcome.coreGroup.progress')} hint={t('meetings.outcome.coreGroup.progressHint')} value={value.progress} onChange={(e) => onChange({ ...value, progress: e.target.value })} rows={3} required data-testid="outcome-progress" />
      <CheckboxField label={t('meetings.outcome.coreGroup.significantChange')} hint={t('meetings.outcome.coreGroup.significantChangeHint')} checked={value.significantChange} onChange={(e) => onChange({ ...value, significantChange: e.target.checked })} data-testid="outcome-significant-change" />
      {value.significantChange ? <TextareaField label={t('meetings.outcome.coreGroup.changeNote')} value={value.changeNote ?? ''} onChange={(e) => onChange({ ...value, changeNote: e.target.value })} rows={2} required data-testid="outcome-change-note" /> : null}
    </div>
  );
}

export const CP_REVIEW_CPPM_HELD = heldForm<ReviewCppmHeldInput>((meeting) => ({ meetingId: meeting.id, quorate: true, decision: 'continue', rationale: '' }), ReviewCppmHeldForm);
export const CP_CORE_GROUP = heldForm<CoreGroupInput>((meeting) => ({ meetingId: meeting.id, heldAt: meeting.scheduledAt, attendance: meeting.invitees.map((i) => ({ userId: i.userId, name: i.name, present: i.attendance === 'present' || i.attendance === 'remote' })), progress: '', significantChange: false }), CoreGroupForm);
