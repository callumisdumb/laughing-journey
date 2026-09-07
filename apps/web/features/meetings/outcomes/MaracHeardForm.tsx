'use client';

import { AGENCIES, agencyShort, type Agency, type MaracHeardInput } from '@mas/domain';
import { useT } from '@mas/messages';
import { Button, SelectField, TextField, TextareaField } from '@mas/ui';
import { Plus, X } from 'lucide-react';
import { heldForm, type OutcomeFormProps } from './registry';
import styles from './outcomes.module.css';

/**
 * What the MARAC heard: each agency's contribution, pre-filled from the information shared in the
 * workspace during the meeting, and the risk discussion the protocol asks the chair to record.
 */
function MaracHeardForm({ value, onChange }: OutcomeFormProps<MaracHeardInput>) {
  const t = useT();
  const rows = value.informationShared;
  const setRow = (i: number, patch: Partial<MaracHeardInput['informationShared'][number]>) => onChange({ ...value, informationShared: rows.map((r, j) => (j === i ? { ...r, ...patch } : r)) });
  return (
    <div className="stack">
      <fieldset className={styles.section}>
        <legend className={styles.legend}>{t('meetings.outcome.marac.shared')}</legend>
        <p className={styles.hint}>{t('meetings.outcome.marac.sharedHint')}</p>
        {rows.map((row, i) => (
          <div key={i} className={styles.sharedRow}>
            <SelectField label={t('meetings.outcome.marac.agency')} value={row.agency} onChange={(e) => setRow(i, { agency: e.target.value as Agency })} options={AGENCIES.map((a) => ({ value: a, label: agencyShort(a) }))} data-testid={`outcome-shared-agency-${i}`} />
            <TextField label={t('meetings.outcome.marac.summary')} value={row.summary} onChange={(e) => setRow(i, { summary: e.target.value })} data-testid={`outcome-shared-summary-${i}`} />
            <Button size="sm" variant="quiet" icon={<X size={14} aria-hidden="true" />} onClick={() => onChange({ ...value, informationShared: rows.filter((_, j) => j !== i) })} aria-label={t('meetings.outcome.marac.remove')}>
              {t('meetings.outcome.marac.remove')}
            </Button>
          </div>
        ))}
        <div>
          <Button size="sm" variant="secondary" icon={<Plus size={14} aria-hidden="true" />} onClick={() => onChange({ ...value, informationShared: [...rows, { agency: 'police', summary: '' }] })} data-testid="outcome-shared-add">
            {t('meetings.outcome.marac.add')}
          </Button>
        </div>
      </fieldset>
      <TextareaField label={t('meetings.outcome.marac.riskDiscussion')} hint={t('meetings.outcome.marac.riskDiscussionHint')} value={value.riskDiscussion} onChange={(e) => onChange({ ...value, riskDiscussion: e.target.value })} rows={3} required data-testid="outcome-risk-discussion" />
    </div>
  );
}

export const MARAC_HEARD = heldForm<MaracHeardInput>((meeting) => ({ meetingId: meeting.id, informationShared: meeting.informationShared.map((s) => ({ agency: s.agency, summary: s.summary })), riskDiscussion: '' }), MaracHeardForm);
