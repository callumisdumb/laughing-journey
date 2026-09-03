'use client';

import { DEFAULT_CONFIG, PROCESS_LABELS, PROCESS_TYPES, type ClockRule } from '@mas/domain';
import { Button, Dialog, Pill, ProcessMark, SelectField, Sheet, SheetBody, SheetHead, Table, TableWrap, TextField, TextareaField, type PillTone } from '@mas/ui';
import { zodResolver } from '@hookform/resolvers/zod';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { SectionHead } from './SectionHead';
import styles from './Timescales.module.css';
import { useAdminConfig } from './useAdminConfig';

const UNITS = ['calendar-days', 'working-days', 'weeks', 'months'] as const;
const UNIT_LABELS: Record<ClockRule['unit'], string> = {
  'calendar-days': 'calendar days',
  'working-days': 'working days',
  weeks: 'weeks',
  months: 'months',
};
const KIND_LABELS: Record<ClockRule['kind'], string> = { deadline: 'Deadline', warning: 'Warning', expiry: 'Expiry', review: 'Review' };
const CONFIDENCE: Record<ClockRule['confidence'], { word: string; tone: PillTone; text: string }> = {
  high: { word: 'Statutory', tone: 'low', text: 'Read in the primary source' },
  verify: { word: 'To verify', tone: 'medium', text: 'Seeded from an extract, not yet checked against the primary source' },
  local: { word: 'Local', tone: 'accent', text: 'Local procedure, not a national timescale' },
  advisory: { word: 'Advisory', tone: 'outline', text: 'Good practice rather than a requirement' },
};

function needsVerify(rule: ClockRule): boolean {
  return rule.todoVerify === true || rule.confidence === 'verify' || rule.confidence === 'local';
}

const ruleSchema = z.object({
  amount: z.number({ error: 'Enter a number' }).positive('Enter a number greater than zero'),
  unit: z.enum(UNITS),
  warnDays: z.number({ error: 'Enter whole days' }).int('Whole days only').nonnegative('Zero or more days'),
  localNote: z.string().max(300, 'Keep the note under 300 characters'),
});
type RuleValues = z.infer<typeof ruleSchema>;

function RuleDialog({ rule, canEdit, onClose, onSave }: { rule: ClockRule; canEdit: boolean; onClose: () => void; onSave: (next: ClockRule) => string[] }) {
  const [saveErrors, setSaveErrors] = useState<string[]>([]);
  const form = useForm<RuleValues>({ resolver: zodResolver(ruleSchema), defaultValues: { amount: rule.amount, unit: rule.unit, warnDays: rule.warnDays, localNote: rule.localNote ?? '' } });
  const errors = form.formState.errors;
  const seeded = DEFAULT_CONFIG.clockRules.find((r) => r.id === rule.id);

  function submit(values: RuleValues) {
    const statutoryChanged = seeded !== undefined && seeded.confidence === 'high' && (values.amount !== seeded.amount || values.unit !== seeded.unit);
    const next: ClockRule = {
      ...rule,
      amount: values.amount,
      unit: values.unit,
      warnDays: values.warnDays,
      localNote: values.localNote.trim() || undefined,
      confidence: statutoryChanged ? 'local' : rule.confidence,
      todoVerify: needsVerify(rule) || statutoryChanged ? true : rule.todoVerify,
    };
    const errs = onSave(next);
    if (errs.length > 0) setSaveErrors(errs);
    else onClose();
  }

  return (
    <Dialog
      open
      onClose={onClose}
      title={`Edit timescale: ${rule.label}`}
      size="lg"
      actions={
        <>
          <Button variant="quiet" onClick={onClose}>
            Cancel
          </Button>
          <Button variant="primary" disabled={!canEdit} onClick={() => void form.handleSubmit(submit)()}>
            Save timescale
          </Button>
        </>
      }
    >
      <form className="stack" onSubmit={(e) => e.preventDefault()} noValidate>
        <dl className={styles.ruleFacts}>
          <dt>Trigger</dt>
          <dd>{rule.trigger}</dd>
          <dt>Source</dt>
          <dd>
            {rule.source}
            {rule.sourceRef ? <span className={styles.sourceRef}>{rule.sourceRef}</span> : null}
          </dd>
          <dt>Confidence</dt>
          <dd>
            <Pill size="sm" tone={CONFIDENCE[rule.confidence].tone}>
              {CONFIDENCE[rule.confidence].word}
            </Pill>{' '}
            {CONFIDENCE[rule.confidence].text}
            {needsVerify(rule) ? '. This rule stays marked to verify after editing.' : ''}
          </dd>
        </dl>
        <div className={styles.dialogGrid}>
          <TextField label="Amount" type="number" min={1} step={1} required disabled={!canEdit} {...form.register('amount', { valueAsNumber: true })} error={errors.amount?.message} />
          <SelectField label="Unit" required disabled={!canEdit} {...form.register('unit')} options={UNITS.map((u) => ({ value: u, label: UNIT_LABELS[u] }))} error={errors.unit?.message} />
          <TextField label="Warn (days before due)" type="number" min={0} step={1} required disabled={!canEdit} {...form.register('warnDays', { valueAsNumber: true })} error={errors.warnDays?.message} hint="The clock turns amber this many days before it is due." />
        </div>
        {seeded?.confidence === 'high' ? <p className={styles.hint}>Changing the amount or unit of a statutory rule records it as a local value to verify. The national figure stays in the source column.</p> : null}
        <TextareaField label="Local note" disabled={!canEdit} maxLength={300} {...form.register('localNote')} error={errors.localNote?.message} hint="Where the local value comes from, for example the local procedures and their date." />
        {saveErrors.length > 0 ? (
          <ul className={styles.errors} role="alert">
            {saveErrors.map((e) => (
              <li key={e}>{e}</li>
            ))}
          </ul>
        ) : null}
      </form>
    </Dialog>
  );
}

export function Timescales() {
  const { config, canEdit, save } = useAdminConfig();
  const [editing, setEditing] = useState<ClockRule | null>(null);
  const groups = PROCESS_TYPES.map((p) => ({ process: p, rules: config.clockRules.filter((r) => r.process === p) })).filter((g) => g.rules.length > 0);
  const toVerify = config.clockRules.filter(needsVerify).length;

  function saveRule(next: ClockRule): string[] {
    const result = save({ ...config, clockRules: config.clockRules.map((r) => (r.id === next.id ? next : r)) }, 'timescales', `${next.label}: ${next.amount} ${UNIT_LABELS[next.unit]}, warn ${next.warnDays} days`);
    return result.errors;
  }

  return (
    <>
      <SectionHead title="Timescales" lede={`Statutory values come from national guidance and local values are configuration. ${config.clockRules.length} clock rules, ${toVerify} marked to verify against a primary source or the local procedures.`} />
      <div className="stack">
        {groups.map((g) => (
          <Sheet key={g.process}>
            <SheetHead title={<ProcessMark type={g.process} stage={PROCESS_LABELS[g.process]} />} meta={`${g.rules.length} ${g.rules.length === 1 ? 'rule' : 'rules'}, ${g.rules.filter(needsVerify).length} to verify`} divided />
            <SheetBody flush>
              <TableWrap label={`${PROCESS_LABELS[g.process]} timescales`} className={styles.wrap}>
                <Table>
                  <thead>
                    <tr>
                      <th scope="col">Clock</th>
                      <th scope="col">Trigger</th>
                      <th scope="col">Timescale</th>
                      <th scope="col">Confidence</th>
                      <th scope="col">Source</th>
                      <th scope="col">
                        <span className="visually-hidden">Actions</span>
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {g.rules.map((r) => (
                      <tr key={r.id} data-state={needsVerify(r) ? 'verify' : undefined}>
                        <td>
                          <span className={styles.label}>{r.label}</span>
                          <span className={styles.meta}>
                            {KIND_LABELS[r.kind]}. {r.id}
                          </span>
                        </td>
                        <td className={styles.trigger}>{r.trigger}</td>
                        <td className={styles.timescale}>
                          <span className={styles.amount}>
                            {r.amount} {UNIT_LABELS[r.unit]}
                          </span>
                          <span className={styles.meta}>warn at {r.warnDays} days</span>
                        </td>
                        <td>
                          <div className={styles.confidence}>
                            <Pill size="sm" tone={CONFIDENCE[r.confidence].tone}>
                              {CONFIDENCE[r.confidence].word}
                            </Pill>
                            {needsVerify(r) ? <span className={styles.verify}>to verify</span> : null}
                          </div>
                          {r.localNote ? <span className={styles.localNote}>{r.localNote}</span> : null}
                        </td>
                        <td className={styles.source}>
                          {r.source}
                          {r.sourceRef ? <span className={styles.sourceRef}>{r.sourceRef}</span> : null}
                        </td>
                        <td>
                          <Button size="sm" variant="secondary" onClick={() => setEditing(r)}>
                            {canEdit ? 'Edit' : 'View'}
                          </Button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </Table>
              </TableWrap>
            </SheetBody>
          </Sheet>
        ))}
      </div>
      {editing ? <RuleDialog rule={editing} canEdit={canEdit} onClose={() => setEditing(null)} onSave={saveRule} /> : null}
    </>
  );
}
