'use client';

import { AGENCIES, MAPPA_EXIT_KINDS, agencyShort, mappaExitKindLabel, researchStatusLabel, type Agency, type ExitInput, type MappaProcess, type PreMeetingReturnInput, type PreMeetingReturnsInput } from '@mas/domain';
import { useT } from '@mas/messages';
import { Button, CheckboxField, DateField, RadioGroup, SelectField, TextField, TextareaField } from '@mas/ui';
import { Plus, X } from 'lucide-react';
import { transitionForm, type TransitionFormProps } from './registry';
import styles from './transitions.module.css';

/**
 * The MAPPA decisions recorded from the case (task section 1.5): the pre-meeting returns the
 * coordinator asks for, an agency's return, and the exit. The referral up opens the referral form
 * the case already had, a disclosure opens the register's dialog, and the meeting's decisions live
 * with the meeting.
 */
const mappa = (process: TransitionFormProps<unknown>['process']): MappaProcess => process as MappaProcess;

function ReturnsRequestForm({ value, onChange }: TransitionFormProps<PreMeetingReturnsInput>) {
  const t = useT();
  const rows = value.agencies;
  const setRow = (i: number, patch: Partial<PreMeetingReturnsInput['agencies'][number]>) => onChange({ ...value, agencies: rows.map((r, j) => (j === i ? { ...r, ...patch } : r)) });
  return (
    <div className="stack">
      <fieldset className={styles.section}>
        <legend className={styles.legend}>{t('processes.forms.mappaReturns.agencies')}</legend>
        <p className={styles.hint}>{t('processes.forms.mappaReturns.agenciesHint')}</p>
        {rows.map((row, i) => (
          <div key={i} className={styles.actionRow}>
            <SelectField label={t('processes.forms.mappaReturns.agency')} value={row.agency} onChange={(e) => setRow(i, { agency: e.target.value as Agency })} options={AGENCIES.map((a) => ({ value: a, label: agencyShort(a) }))} data-testid={`return-agency-${i}`} />
            <TextField label={t('processes.forms.mappaReturns.contact')} value={row.contact} onChange={(e) => setRow(i, { contact: e.target.value })} data-testid={`return-contact-${i}`} />
            <span />
            <Button size="sm" variant="quiet" icon={<X size={14} aria-hidden="true" />} onClick={() => onChange({ ...value, agencies: rows.filter((_, j) => j !== i) })} aria-label={t('processes.forms.mappaReturns.removeAgency')}>
              {t('processes.forms.mappaReturns.removeAgency')}
            </Button>
          </div>
        ))}
        <div>
          <Button size="sm" variant="secondary" icon={<Plus size={14} aria-hidden="true" />} onClick={() => onChange({ ...value, agencies: [...rows, { agency: 'housing', contact: '' }] })} data-testid="transition-add-return">
            {t('processes.forms.mappaReturns.addAgency')}
          </Button>
        </div>
      </fieldset>
      <DateField label={t('processes.forms.mappaReturns.due')} hint={t('processes.forms.mappaReturns.dueHint')} value={value.dueAt} onChange={(d) => onChange({ ...value, dueAt: d })} required data-testid="transition-due" />
    </div>
  );
}

function ReturnForm({ process, value, onChange }: TransitionFormProps<PreMeetingReturnInput>) {
  const t = useT();
  const outstanding = mappa(process).detail.preMeetingReturns.filter((r) => r.status === 'requested');
  return (
    <div className="stack">
      <SelectField
        label={t('processes.forms.mappaReturn.agency')}
        hint={t('processes.forms.mappaReturn.agencyHint')}
        value={value.agency}
        onChange={(e) => onChange({ ...value, agency: e.target.value as Agency })}
        placeholder={outstanding.length === 0 ? t('processes.forms.mappaReturn.none') : undefined}
        options={outstanding.map((r) => ({ value: r.agency, label: t('processes.forms.mappaReturn.agencyOption', { agency: agencyShort(r.agency), contact: r.contact, status: researchStatusLabel(r.status) }) }))}
        required
        data-testid="transition-agency"
      />
      <CheckboxField label={t('processes.forms.mappaReturn.nothingKnown')} hint={t('processes.forms.mappaReturn.nothingKnownHint')} checked={value.nothingKnown} onChange={(e) => onChange({ ...value, nothingKnown: e.target.checked })} data-testid="transition-nothing-known" />
      {value.nothingKnown ? null : <TextareaField label={t('processes.forms.mappaReturn.summary')} hint={t('processes.forms.mappaReturn.summaryHint')} value={value.summary} onChange={(e) => onChange({ ...value, summary: e.target.value })} rows={4} required data-testid="transition-summary" />}
    </div>
  );
}

function ExitForm({ value, onChange }: TransitionFormProps<ExitInput>) {
  const t = useT();
  return (
    <div className="stack">
      <RadioGroup legend={t('processes.forms.mappaExit.kind')} name="mappa-exit-kind" value={value.kind} onChange={(v) => onChange({ ...value, kind: v as ExitInput['kind'] })} options={MAPPA_EXIT_KINDS.map((k) => ({ value: k, label: mappaExitKindLabel(k) }))} />
      <p className={styles.hint}>{t('processes.forms.mappaExit.kindHint')}</p>
      {value.kind === 'transfer' ? <TextField label={t('processes.forms.mappaExit.area')} hint={t('processes.forms.mappaExit.areaHint')} value={value.transferArea ?? ''} onChange={(e) => onChange({ ...value, transferArea: e.target.value })} required data-testid="transition-area" /> : null}
      <TextareaField label={t('processes.forms.mappaExit.note')} hint={t('processes.forms.mappaExit.noteHint')} value={value.note} onChange={(e) => onChange({ ...value, note: e.target.value })} rows={3} required data-testid="transition-note" />
    </div>
  );
}

export const MAPPA_REQUEST_RETURNS = transitionForm<PreMeetingReturnsInput>(() => ({ agencies: [], dueAt: '' }), ReturnsRequestForm);
export const MAPPA_RECORD_RETURN = transitionForm<PreMeetingReturnInput>((process, { user }) => {
  const outstanding = (process as MappaProcess).detail.preMeetingReturns.filter((r) => r.status === 'requested');
  return { agency: (outstanding.find((r) => r.agency === user?.agency) ?? outstanding[0])?.agency ?? 'housing', summary: '', nothingKnown: false };
}, ReturnForm);
export const MAPPA_EXIT = transitionForm<ExitInput>(() => ({ kind: 'level-down', note: '' }), ExitForm);
