'use client';

import { AGENCIES, ASP_INQUIRY_ACTIONS, CONSENT_STATUSES, agencyShort, aspInquiryActionLabel, aspInquiryOutcomeLabel, aspScreeningOutcomeLabel, closureReasonsFor, consentStatusLabel, type Agency, type AspInquiryAction, type ConsentStatus, type InquiryOutcomeInput, type InvestigatoryStepInput, type OpenInquiryInput, type PlanInput, type ScreeningInput } from '@mas/domain';
import { useT } from '@mas/messages';
import { CheckboxField, RadioGroup, SelectField, TextField, TextareaField } from '@mas/ui';
import { fullName, personById, userName } from '@/lib/selectors';
import { useData } from '@/lib/store';
import { PlanFields, emptyPlan } from './PlanFields';
import { transitionForm, type TransitionFormProps } from './registry';
import styles from './transitions.module.css';

/**
 * The adult support and protection decisions, as forms (task section 1.2). Each one is the input
 * its transition validates and nothing more: the form arranges the questions, the table decides
 * what they need, and a refusal reads the same whichever screen asked.
 */
function ScreeningForm({ process, value, onChange }: TransitionFormProps<ScreeningInput & { closureReasonId?: string; closureNote?: string }>) {
  const t = useT();
  const reasons = closureReasonsFor(process.type);
  const set = (patch: Partial<typeof value>) => {
    const next = { ...value, ...patch };
    onChange({ ...next, closure: next.outcome === 'no-further-asp-action' ? { reasonId: (next.closureReasonId ?? '') as AspInquiryAction, note: next.closureNote ?? '' } : undefined });
  };
  return (
    <div className="stack">
      <RadioGroup
        legend={t('processes.forms.aspScreening.outcome')}
        name="asp-screening-outcome"
        value={value.outcome}
        onChange={(v) => set({ outcome: v as ScreeningInput['outcome'] })}
        options={[
          { value: 'proceed-to-inquiry', label: aspScreeningOutcomeLabel('proceed-to-inquiry'), hint: t('processes.forms.aspScreening.proceedHint') },
          { value: 'emergency-action', label: aspScreeningOutcomeLabel('emergency-action'), hint: t('processes.forms.aspScreening.emergencyHint') },
          { value: 'no-further-asp-action', label: aspScreeningOutcomeLabel('no-further-asp-action'), hint: t('processes.forms.aspScreening.nfaHint') },
        ]}
      />
      {value.outcome === 'no-further-asp-action' ? (
        <div className={styles.grid}>
          <SelectField label={t('processes.forms.asp.closureReason')} value={value.closureReasonId ?? ''} onChange={(e) => set({ closureReasonId: e.target.value })} placeholder={t('processes.forms.asp.closureReasonPlaceholder')} options={reasons.map((r) => ({ value: r.id, label: r.label }))} required data-testid="transition-closure-reason" />
          <TextareaField label={t('processes.forms.asp.closureNote')} value={value.closureNote ?? ''} onChange={(e) => set({ closureNote: e.target.value })} rows={2} required data-testid="transition-closure-note" />
        </div>
      ) : null}
      <TextareaField label={t('processes.forms.rationale')} hint={t('processes.forms.rationaleHint')} value={value.rationale} onChange={(e) => set({ rationale: e.target.value })} rows={3} required data-testid="transition-rationale" />
    </div>
  );
}

function OpenInquiryForm({ value, onChange }: TransitionFormProps<OpenInquiryInput>) {
  const t = useT();
  const toggle = (agency: Agency, on: boolean) => onChange({ ...value, agenciesToContact: on ? [...value.agenciesToContact, agency] : value.agenciesToContact.filter((a) => a !== agency) });
  return (
    <div className="stack">
      <fieldset className={styles.section}>
        <legend className={styles.legend}>{t('processes.forms.aspInquiry.agencies')}</legend>
        <p className={styles.hint}>{t('processes.forms.aspInquiry.agenciesHint')}</p>
        <div className={styles.checks}>
          {AGENCIES.map((agency) => (
            <CheckboxField key={agency} label={agencyShort(agency)} checked={value.agenciesToContact.includes(agency)} onChange={(e) => toggle(agency, e.target.checked)} data-testid={`transition-agency-${agency}`} />
          ))}
        </div>
      </fieldset>
      <TextareaField label={t('processes.forms.aspInquiry.purpose')} hint={t('processes.forms.aspInquiry.purposeHint')} value={value.purpose} onChange={(e) => onChange({ ...value, purpose: e.target.value })} rows={2} required data-testid="transition-purpose" />
      <CheckboxField label={t('processes.forms.aspInquiry.discussion')} hint={t('processes.forms.aspInquiry.discussionHint')} checked={value.interAgencyDiscussion} onChange={(e) => onChange({ ...value, interAgencyDiscussion: e.target.checked })} data-testid="transition-discussion" />
    </div>
  );
}

function InquiryOutcomeForm({ value, onChange }: TransitionFormProps<InquiryOutcomeInput>) {
  const t = useT();
  const investigating = value.outcome === 'proceed-to-investigation';
  const consent = value.consent ?? { status: 'sought-and-given' as ConsentStatus, note: '' };
  const capacity = value.capacity ?? { assessed: false, summary: '' };
  const pressure = value.unduePressure ?? { considered: false };
  const advocacy = value.advocacy ?? { offered: false };
  return (
    <div className="stack">
      <RadioGroup
        legend={t('processes.forms.aspOutcome.outcome')}
        name="asp-inquiry-outcome"
        value={value.outcome}
        onChange={(v) => onChange({ ...value, outcome: v as InquiryOutcomeInput['outcome'], consent: v === 'proceed-to-investigation' ? consent : undefined, capacity: v === 'proceed-to-investigation' ? capacity : undefined, unduePressure: v === 'proceed-to-investigation' ? pressure : undefined, advocacy: v === 'proceed-to-investigation' ? advocacy : undefined })}
        options={[
          { value: 'proceed-to-investigation', label: aspInquiryOutcomeLabel('proceed-to-investigation'), hint: t('processes.forms.aspOutcome.investigateHint') },
          { value: 'support-only', label: aspInquiryOutcomeLabel('support-only'), hint: t('processes.forms.aspOutcome.supportHint') },
          { value: 'no-further-action', label: aspInquiryOutcomeLabel('no-further-action'), hint: t('processes.forms.aspOutcome.nfaHint') },
        ]}
      />
      <SelectField label={t('processes.forms.aspOutcome.action')} hint={t('processes.forms.aspOutcome.actionHint')} value={value.action} onChange={(e) => onChange({ ...value, action: e.target.value as AspInquiryAction })} options={ASP_INQUIRY_ACTIONS.map((a) => ({ value: a, label: aspInquiryActionLabel(a) }))} required data-testid="transition-action" />
      {investigating ? (
        <>
          <div className={styles.grid}>
            <SelectField label={t('processes.forms.aspOutcome.consent')} value={consent.status} onChange={(e) => onChange({ ...value, consent: { ...consent, status: e.target.value as ConsentStatus } })} options={CONSENT_STATUSES.map((s) => ({ value: s, label: consentStatusLabel(s) }))} required data-testid="transition-consent" />
            <TextField label={t('processes.forms.aspOutcome.consentNote')} value={consent.note} onChange={(e) => onChange({ ...value, consent: { ...consent, note: e.target.value } })} data-testid="transition-consent-note" />
          </div>
          <div className={styles.grid}>
            <CheckboxField label={t('processes.forms.aspOutcome.capacityAssessed')} checked={capacity.assessed} onChange={(e) => onChange({ ...value, capacity: { ...capacity, assessed: e.target.checked } })} data-testid="transition-capacity" />
            <CheckboxField label={t('processes.forms.aspOutcome.capacityFluctuates')} checked={Boolean(capacity.fluctuates)} onChange={(e) => onChange({ ...value, capacity: { ...capacity, fluctuates: e.target.checked } })} />
          </div>
          <TextField label={t('processes.forms.aspOutcome.capacitySummary')} value={capacity.summary} onChange={(e) => onChange({ ...value, capacity: { ...capacity, summary: e.target.value } })} data-testid="transition-capacity-summary" />
          <div className={styles.grid}>
            <CheckboxField label={t('processes.forms.aspOutcome.pressureConsidered')} hint={t('processes.forms.aspOutcome.pressureHint')} checked={pressure.considered} onChange={(e) => onChange({ ...value, unduePressure: { ...pressure, considered: e.target.checked } })} data-testid="transition-pressure" />
            <CheckboxField label={t('processes.forms.aspOutcome.pressureFound')} checked={Boolean(pressure.found)} onChange={(e) => onChange({ ...value, unduePressure: { ...pressure, found: e.target.checked } })} />
          </div>
          <TextField label={t('processes.forms.aspOutcome.pressureReasoning')} value={pressure.reasoning ?? ''} onChange={(e) => onChange({ ...value, unduePressure: { ...pressure, reasoning: e.target.value } })} />
          <div className={styles.grid}>
            <CheckboxField label={t('processes.forms.aspOutcome.advocacyOffered')} checked={advocacy.offered} onChange={(e) => onChange({ ...value, advocacy: { ...advocacy, offered: e.target.checked } })} data-testid="transition-advocacy" />
            <CheckboxField label={t('processes.forms.aspOutcome.advocacyAccepted')} checked={Boolean(advocacy.accepted)} onChange={(e) => onChange({ ...value, advocacy: { ...advocacy, accepted: e.target.checked } })} />
          </div>
          <div className={styles.grid}>
            <TextField label={t('processes.forms.aspOutcome.advocacyProvider')} value={advocacy.provider ?? ''} onChange={(e) => onChange({ ...value, advocacy: { ...advocacy, provider: e.target.value } })} />
            <TextField label={t('processes.forms.aspOutcome.advocateName')} value={advocacy.advocateName ?? ''} onChange={(e) => onChange({ ...value, advocacy: { ...advocacy, advocateName: e.target.value } })} />
          </div>
        </>
      ) : null}
      {value.outcome === 'no-further-action' ? <TextareaField label={t('processes.forms.asp.closureNote')} value={value.closure?.note ?? ''} onChange={(e) => onChange({ ...value, closure: { note: e.target.value } })} rows={2} data-testid="transition-closure-note" /> : null}
      <TextareaField label={t('processes.forms.rationale')} hint={t('processes.forms.rationaleHint')} value={value.rationale} onChange={(e) => onChange({ ...value, rationale: e.target.value })} rows={3} required data-testid="transition-rationale" />
    </div>
  );
}

function InvestigatoryStepForm({ process, value, onChange }: TransitionFormProps<InvestigatoryStepInput>) {
  const t = useT();
  const data = useData();
  const subjects = process.subjectIds.map((id) => personById(data, id)).filter((p): p is NonNullable<typeof p> => Boolean(p));
  const powers: Array<{ value: InvestigatoryStepInput['power']; label: string; hint: string }> = [
    { value: 's7', label: t('processes.forms.aspStep.s7'), hint: t('processes.forms.aspStep.s7Hint') },
    { value: 's8', label: t('processes.forms.aspStep.s8'), hint: t('processes.forms.aspStep.s8Hint') },
    { value: 's9', label: t('processes.forms.aspStep.s9'), hint: t('processes.forms.aspStep.s9Hint') },
    { value: 's10', label: t('processes.forms.aspStep.s10'), hint: t('processes.forms.aspStep.s10Hint') },
  ];
  function pick(power: InvestigatoryStepInput['power']) {
    switch (power) {
      case 's7':
        onChange({ power, attended: [], adultPresent: true, note: '' });
        break;
      case 's8':
        onChange({ power, withPersonId: subjects[0]?.id ?? '', adultDeclined: false, note: '' });
        break;
      case 's9':
        onChange({ power, practitioner: '', consent: true, outcome: '' });
        break;
      case 's10':
        onChange({ power, holder: '', holderAgency: 'health', records: [], lawfulBasis: '' });
        break;
    }
  }
  const lines = (text: string) => text.split('\n').map((s) => s.trim()).filter(Boolean);
  return (
    <div className="stack">
      <RadioGroup legend={t('processes.forms.aspStep.power')} name="asp-step-power" value={value.power} onChange={(v) => pick(v as InvestigatoryStepInput['power'])} options={powers} />
      {value.power === 's7' ? (
        <>
          <TextareaField label={t('processes.forms.aspStep.attended')} hint={t('processes.forms.aspStep.attendedHint')} value={value.attended.join('\n')} onChange={(e) => onChange({ ...value, attended: lines(e.target.value) })} rows={2} required data-testid="transition-attended" />
          <CheckboxField label={t('processes.forms.aspStep.adultPresent')} checked={value.adultPresent} onChange={(e) => onChange({ ...value, adultPresent: e.target.checked })} />
          <TextareaField label={t('processes.forms.aspStep.note')} value={value.note} onChange={(e) => onChange({ ...value, note: e.target.value })} rows={3} required data-testid="transition-note" />
        </>
      ) : null}
      {value.power === 's8' ? (
        <>
          <SelectField label={t('processes.forms.aspStep.interviewee')} value={value.withPersonId} onChange={(e) => onChange({ ...value, withPersonId: e.target.value })} options={subjects.map((p) => ({ value: p.id, label: fullName(p) }))} required data-testid="transition-interviewee" />
          <CheckboxField label={t('processes.forms.aspStep.adultDeclined')} checked={value.adultDeclined} onChange={(e) => onChange({ ...value, adultDeclined: e.target.checked })} />
          <TextareaField label={t('processes.forms.aspStep.note')} value={value.note} onChange={(e) => onChange({ ...value, note: e.target.value })} rows={3} required data-testid="transition-note" />
        </>
      ) : null}
      {value.power === 's9' ? (
        <>
          <TextField label={t('processes.forms.aspStep.practitioner')} value={value.practitioner} onChange={(e) => onChange({ ...value, practitioner: e.target.value })} required data-testid="transition-practitioner" />
          <CheckboxField label={t('processes.forms.aspStep.examConsent')} checked={value.consent} onChange={(e) => onChange({ ...value, consent: e.target.checked })} />
          <TextField label={t('processes.forms.aspStep.examOutcome')} value={value.outcome ?? ''} onChange={(e) => onChange({ ...value, outcome: e.target.value })} />
        </>
      ) : null}
      {value.power === 's10' ? (
        <>
          <div className={styles.grid}>
            <TextField label={t('processes.forms.aspStep.holder')} value={value.holder} onChange={(e) => onChange({ ...value, holder: e.target.value })} required data-testid="transition-holder" />
            <SelectField label={t('processes.forms.aspStep.holderAgency')} value={value.holderAgency} onChange={(e) => onChange({ ...value, holderAgency: e.target.value as Agency })} options={AGENCIES.map((a) => ({ value: a, label: agencyShort(a) }))} />
          </div>
          <TextareaField label={t('processes.forms.aspStep.records')} hint={t('processes.forms.aspStep.recordsHint')} value={value.records.join('\n')} onChange={(e) => onChange({ ...value, records: lines(e.target.value) })} rows={2} required data-testid="transition-records" />
          <TextField label={t('processes.forms.aspStep.lawfulBasis')} value={value.lawfulBasis} onChange={(e) => onChange({ ...value, lawfulBasis: e.target.value })} required data-testid="transition-lawful-basis" />
        </>
      ) : null}
    </div>
  );
}

function ProtectionPlanForm({ process, value, onChange }: TransitionFormProps<PlanInput>) {
  return <PlanFields process={process} value={value} onChange={onChange} reviewRequired />;
}

function SupportPlanForm({ process, value, onChange }: TransitionFormProps<PlanInput>) {
  return <PlanFields process={process} value={value} onChange={onChange} consent />;
}

export const ASP_SCREENING = transitionForm<ScreeningInput & { closureReasonId?: string; closureNote?: string }>(() => ({ outcome: 'proceed-to-inquiry', rationale: '' }), ScreeningForm);
export const ASP_OPEN_INQUIRY = transitionForm<OpenInquiryInput>(() => ({ agenciesToContact: [], interAgencyDiscussion: false, purpose: '' }), OpenInquiryForm);
export const ASP_INQUIRY_OUTCOME = transitionForm<InquiryOutcomeInput>(() => ({ outcome: 'proceed-to-investigation', action: 'criteria-ongoing', rationale: '', consent: { status: 'sought-and-given', note: '' }, capacity: { assessed: false, summary: '' }, unduePressure: { considered: false }, advocacy: { offered: false } }), InquiryOutcomeForm);
export const ASP_INVESTIGATORY_STEP = transitionForm<InvestigatoryStepInput>(() => ({ power: 's7', attended: [], adultPresent: true, note: '' }), InvestigatoryStepForm);
export const ASP_PROTECTION_PLAN = transitionForm<PlanInput>((_, { user }) => emptyPlan(user ? { id: user.id, name: userName(user) } : null), ProtectionPlanForm);
export const ASP_SUPPORT_PLAN = transitionForm<PlanInput>((_, { user }) => emptyPlan(user ? { id: user.id, name: userName(user) } : null), SupportPlanForm);
