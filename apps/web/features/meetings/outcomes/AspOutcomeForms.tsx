'use client';

import { closureReasonsFor, type AspInquiryAction, type CaseConferenceHeldInput, type ReviewHeldInput } from '@mas/domain';
import { useT } from '@mas/messages';
import { DateField, RadioGroup, SelectField, TextareaField } from '@mas/ui';
import { heldForm, type OutcomeFormProps } from './registry';
import styles from './outcomes.module.css';

/**
 * The adult protection case conference's two questions, and the review conference's one. The
 * conference decides whether the adult is an adult at risk and whether a protection plan is
 * needed; the review decides whether the plan continues, with its next date, or the case closes,
 * with the closure reason the national return asks for.
 */
function CaseConferenceHeldForm({ value, onChange }: OutcomeFormProps<CaseConferenceHeldInput>) {
  const t = useT();
  const yesNo = [
    { value: 'yes', label: t('meetings.outcome.yes') },
    { value: 'no', label: t('meetings.outcome.no') },
  ];
  return (
    <div className="stack">
      <div className={styles.grid}>
        <RadioGroup legend={t('meetings.outcome.asp.adultAtRisk')} name="asp-adult-at-risk" value={value.adultAtRisk ? 'yes' : 'no'} onChange={(v) => onChange({ ...value, adultAtRisk: v === 'yes' })} orientation="horizontal" options={yesNo} />
        <RadioGroup legend={t('meetings.outcome.asp.protectionPlan')} name="asp-protection-plan" value={value.protectionPlanNeeded ? 'yes' : 'no'} onChange={(v) => onChange({ ...value, protectionPlanNeeded: v === 'yes' })} orientation="horizontal" options={yesNo} />
      </div>
      <TextareaField label={t('meetings.outcome.rationale')} hint={t('meetings.outcome.rationaleHint')} value={value.rationale} onChange={(e) => onChange({ ...value, rationale: e.target.value })} rows={3} required data-testid="outcome-rationale" />
    </div>
  );
}

function ReviewOutcomeForm({ value, process, onChange }: OutcomeFormProps<ReviewHeldInput & { closureReasonId?: string; closureNote?: string }>) {
  const t = useT();
  const reasons = closureReasonsFor(process.type);
  const set = (patch: Partial<typeof value>) => {
    const next = { ...value, ...patch };
    onChange({ ...next, closure: next.decision === 'close' ? { reasonId: (next.closureReasonId ?? '') as AspInquiryAction, note: next.closureNote ?? '' } : undefined });
  };
  return (
    <div className="stack">
      <RadioGroup
        legend={t('meetings.outcome.aspReview.decision')}
        name="asp-review-decision"
        value={value.decision}
        onChange={(v) => set({ decision: v as ReviewHeldInput['decision'] })}
        orientation="horizontal"
        options={[
          { value: 'continue', label: t('meetings.outcome.aspReview.continue'), hint: t('meetings.outcome.aspReview.continueHint') },
          { value: 'close', label: t('meetings.outcome.aspReview.close'), hint: t('meetings.outcome.aspReview.closeHint') },
        ]}
      />
      {value.decision === 'continue' ? <DateField label={t('meetings.outcome.aspReview.newReviewDate')} value={value.newReviewDate ?? ''} onChange={(d) => set({ newReviewDate: d || undefined })} required data-testid="outcome-review-date" /> : null}
      {value.decision === 'close' ? (
        <div className={styles.grid}>
          <SelectField label={t('meetings.outcome.aspReview.closureReason')} value={value.closureReasonId ?? ''} onChange={(e) => set({ closureReasonId: e.target.value })} placeholder={t('meetings.outcome.aspReview.closureReasonPlaceholder')} options={reasons.map((r) => ({ value: r.id, label: r.label }))} required data-testid="outcome-closure-reason" />
          <TextareaField label={t('meetings.outcome.aspReview.closureNote')} value={value.closureNote ?? ''} onChange={(e) => set({ closureNote: e.target.value })} rows={2} required data-testid="outcome-closure-note" />
        </div>
      ) : null}
      <TextareaField label={t('meetings.outcome.rationale')} hint={t('meetings.outcome.rationaleHint')} value={value.rationale} onChange={(e) => set({ rationale: e.target.value })} rows={3} required data-testid="outcome-rationale" />
    </div>
  );
}

export const ASP_CASE_CONFERENCE_HELD = heldForm<CaseConferenceHeldInput>((meeting) => ({ meetingId: meeting.id, adultAtRisk: true, protectionPlanNeeded: true, rationale: '' }), CaseConferenceHeldForm);
export const ASP_REVIEW_OUTCOME = heldForm<ReviewHeldInput & { closureReasonId?: string; closureNote?: string }>((meeting) => ({ meetingId: meeting.id, decision: 'continue', rationale: '', newReviewDate: meeting.reviewDate }), ReviewOutcomeForm);
