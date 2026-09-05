'use client';

import { MAPPA_LEVELS, mappaLevelLabel, type MappaMeetingHeldInput, type MappaProcess } from '@mas/domain';
import { useT } from '@mas/messages';
import { DateField, RadioGroup, TextField, TextareaField } from '@mas/ui';
import { addWeeks, format } from 'date-fns';
import { PlanFields, emptyPlan } from '@/features/process/transitions/PlanFields';
import { userName } from '@/lib/selectors';
import { heldForm, type OutcomeFormProps } from './registry';
import styles from './outcomes.module.css';

/**
 * What a MAPPA meeting decides: the level the case is managed at with the reason, the risk
 * management plan to the RMA FRAME headings with its actions, the victim considerations, and the
 * review date the level's clock runs to. Recorded from the meeting it was decided in (D-213).
 */
const lines = (text: string) => text.split('\n').map((s) => s.trim()).filter(Boolean);

function MappaMeetingForm({ process, value, onChange }: OutcomeFormProps<MappaMeetingHeldInput>) {
  const t = useT();
  const rmp = value.rmp;
  const setRmp = (patch: Partial<MappaMeetingHeldInput['rmp']>) => onChange({ ...value, rmp: { ...rmp, ...patch } });
  return (
    <div className="stack">
      <RadioGroup legend={t('meetings.outcome.mappa.level')} name="mappa-level" value={String(value.level)} onChange={(v) => onChange({ ...value, level: Number(v) as MappaMeetingHeldInput['level'] })} orientation="horizontal" options={MAPPA_LEVELS.map((l) => ({ value: String(l), label: mappaLevelLabel(l) }))} />
      <p className={styles.hint}>{t('meetings.outcome.mappa.levelHint')}</p>
      <TextareaField label={t('meetings.outcome.mappa.levelReason')} value={value.levelReason} onChange={(e) => onChange({ ...value, levelReason: e.target.value })} rows={2} required data-testid="outcome-level-reason" />
      <fieldset className={styles.section}>
        <legend className={styles.legend}>{t('meetings.outcome.mappa.rmp')}</legend>
        <p className={styles.hint}>{t('meetings.outcome.mappa.rmpHint')}</p>
        <PlanFields process={process} value={rmp.plan} onChange={(plan) => setRmp({ plan })} />
        <div className={styles.grid}>
          <TextareaField label={t('meetings.outcome.mappa.triggers')} hint={t('meetings.outcome.mappa.oneALine')} value={rmp.triggers.join('\n')} onChange={(e) => setRmp({ triggers: lines(e.target.value) })} rows={3} data-testid="outcome-triggers" />
          <TextareaField label={t('meetings.outcome.mappa.contingencies')} hint={t('meetings.outcome.mappa.oneALine')} value={rmp.contingencies.join('\n')} onChange={(e) => setRmp({ contingencies: lines(e.target.value) })} rows={3} data-testid="outcome-contingencies" />
          <TextareaField label={t('meetings.outcome.mappa.controls')} hint={t('meetings.outcome.mappa.oneALine')} value={rmp.controls.join('\n')} onChange={(e) => setRmp({ controls: lines(e.target.value) })} rows={3} data-testid="outcome-controls" />
        </div>
        <TextField label={t('meetings.outcome.mappa.victimSafety')} value={rmp.victimSafety} onChange={(e) => setRmp({ victimSafety: e.target.value })} data-testid="outcome-victim-safety" />
        <div className={styles.grid}>
          <TextField label={t('meetings.outcome.mappa.accommodation')} value={rmp.accommodation} onChange={(e) => setRmp({ accommodation: e.target.value })} data-testid="outcome-accommodation" />
          <TextField label={t('meetings.outcome.mappa.employment')} value={rmp.employment} onChange={(e) => setRmp({ employment: e.target.value })} data-testid="outcome-employment" />
          <TextField label={t('meetings.outcome.mappa.associates')} value={rmp.associates} onChange={(e) => setRmp({ associates: e.target.value })} data-testid="outcome-associates" />
        </div>
      </fieldset>
      <TextareaField label={t('meetings.outcome.mappa.victimConsiderations')} hint={t('meetings.outcome.mappa.victimConsiderationsHint')} value={value.victimConsiderations} onChange={(e) => onChange({ ...value, victimConsiderations: e.target.value })} rows={2} required data-testid="outcome-victim-considerations" />
      <DateField label={t('meetings.outcome.mappa.reviewDate')} hint={t('meetings.outcome.mappa.reviewDateHint')} value={value.reviewDate} onChange={(d) => onChange({ ...value, reviewDate: d })} required data-testid="outcome-review-date" />
    </div>
  );
}

export const MAPPA_MEETING_HELD = heldForm<MappaMeetingHeldInput>((meeting, process, { user, now }) => {
  const detail = (process as MappaProcess).detail;
  const level = detail.referral?.levelSought ?? (detail.level === 1 ? 2 : detail.level);
  return {
    meetingId: meeting.id,
    level,
    levelReason: '',
    rmp: { plan: emptyPlan(user ? { id: user.id, name: userName(user) } : null, { title: '' }), triggers: [], contingencies: [], controls: [], victimSafety: '', accommodation: '', employment: '', associates: '' },
    victimConsiderations: detail.referral?.victimConsiderations ?? '',
    reviewDate: format(addWeeks(now, level === 3 ? 6 : 12), 'yyyy-MM-dd'),
  };
}, MappaMeetingForm);
