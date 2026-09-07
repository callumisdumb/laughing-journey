'use client';

import { CP_DEREGISTRATION_REASONS, cpDeregistrationReasonLabel, irdMedicalKindLabel, londonToIso, type BirthInput, type CpDeregistrationReason, type DeregisterInput, type JiiInput, type MedicalInput } from '@mas/domain';
import { useT } from '@mas/messages';
import { DateField, RadioGroup, SelectField, TextField, TextareaField } from '@mas/ui';
import { transitionForm, type TransitionFormProps } from './registry';
import styles from './transitions.module.css';

/**
 * The child protection decisions recorded from the case rather than from a meeting: the joint
 * investigative interview and the medical during the investigation, de-registration, and the
 * birth on a pre-birth case. The IRD's decisions and the planning meeting's live with their
 * meetings, in the outcome forms.
 */
type Timed<I> = I & { date: string; time: string };

function JiiForm({ value, onChange }: TransitionFormProps<Timed<JiiInput>>) {
  const t = useT();
  const set = (patch: Partial<Timed<JiiInput>>) => {
    const next = { ...value, ...patch };
    onChange({ ...next, heldAt: next.date ? londonToIso(next.date, next.time) : '' });
  };
  return (
    <div className="stack">
      <div className={styles.grid}>
        <DateField label={t('processes.forms.cpJii.date')} value={value.date} onChange={(d) => set({ date: d })} required data-testid="transition-date" />
        <TextField label={t('processes.forms.cpJii.time')} type="time" value={value.time} onChange={(e) => set({ time: e.target.value })} />
      </div>
      <TextareaField label={t('processes.forms.cpJii.summary')} hint={t('processes.forms.cpJii.summaryHint')} value={value.summary} onChange={(e) => set({ summary: e.target.value })} rows={3} required data-testid="transition-summary" />
    </div>
  );
}

function MedicalForm({ value, onChange }: TransitionFormProps<Timed<MedicalInput>>) {
  const t = useT();
  const set = (patch: Partial<Timed<MedicalInput>>) => {
    const next = { ...value, ...patch };
    onChange({ ...next, heldAt: next.date ? londonToIso(next.date, next.time) : '' });
  };
  return (
    <div className="stack">
      <RadioGroup legend={t('processes.forms.cpMedical.kind')} name="cp-medical-kind" value={value.kind} onChange={(v) => set({ kind: v as MedicalInput['kind'] })} orientation="horizontal" options={[{ value: 'jpfe', label: irdMedicalKindLabel('jpfe'), hint: t('processes.forms.cpMedical.jpfeHint') }, { value: 'comprehensive', label: irdMedicalKindLabel('comprehensive'), hint: t('processes.forms.cpMedical.comprehensiveHint') }]} />
      <div className={styles.grid}>
        <DateField label={t('processes.forms.cpMedical.date')} value={value.date} onChange={(d) => set({ date: d })} required data-testid="transition-date" />
        <TextField label={t('processes.forms.cpMedical.time')} type="time" value={value.time} onChange={(e) => set({ time: e.target.value })} />
      </div>
      <TextareaField label={t('processes.forms.cpMedical.summary')} value={value.summary} onChange={(e) => set({ summary: e.target.value })} rows={3} required data-testid="transition-summary" />
    </div>
  );
}

function DeregisterForm({ value, onChange }: TransitionFormProps<DeregisterInput>) {
  const t = useT();
  return (
    <div className="stack">
      <SelectField label={t('processes.forms.cpDeregister.reason')} hint={t('processes.forms.cpDeregister.reasonHint')} value={value.reason} onChange={(e) => onChange({ ...value, reason: e.target.value as CpDeregistrationReason })} options={CP_DEREGISTRATION_REASONS.map((r) => ({ value: r, label: cpDeregistrationReasonLabel(r) }))} required data-testid="transition-reason" />
      <TextareaField label={t('processes.forms.cpDeregister.note')} hint={t('processes.forms.cpDeregister.noteHint')} value={value.note} onChange={(e) => onChange({ ...value, note: e.target.value })} rows={3} required data-testid="transition-note" />
    </div>
  );
}

function BirthForm({ value, onChange }: TransitionFormProps<Timed<BirthInput>>) {
  const t = useT();
  const set = (patch: Partial<Timed<BirthInput>>) => {
    const next = { ...value, ...patch };
    onChange({ ...next, bornAt: next.date ? londonToIso(next.date, next.time) : '' });
  };
  return (
    <div className="stack">
      <p className={styles.hint}>{t('processes.forms.cpBirth.hint')}</p>
      <div className={styles.grid}>
        <DateField label={t('processes.forms.cpBirth.date')} value={value.date} onChange={(d) => set({ date: d })} required data-testid="transition-date" />
        <TextField label={t('processes.forms.cpBirth.time')} type="time" value={value.time} onChange={(e) => set({ time: e.target.value })} />
      </div>
    </div>
  );
}

export const CP_RECORD_JII = transitionForm<Timed<JiiInput>>(() => ({ heldAt: '', date: '', time: '10:00', summary: '' }), JiiForm);
export const CP_RECORD_MEDICAL = transitionForm<Timed<MedicalInput>>(() => ({ heldAt: '', date: '', time: '10:00', kind: 'jpfe', summary: '' }), MedicalForm);
export const CP_DEREGISTER = transitionForm<DeregisterInput>(() => ({ reason: 'improved-home-situation', note: '' }), DeregisterForm);
export const CP_BIRTH = transitionForm<Timed<BirthInput>>(() => ({ bornAt: '', date: '', time: '00:00' }), BirthForm);
