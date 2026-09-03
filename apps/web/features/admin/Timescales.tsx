'use client';

import { DEFAULT_CONFIG, PROCESS_TYPES, clockRuleLabel, clockRuleTrigger, processLabel, type ClockRule } from '@mas/domain';
import { tKey, useT, type Translator } from '@mas/messages';
import { Button, Dialog, Pill, ProcessMark, SelectField, Sheet, SheetBody, SheetHead, Table, TableWrap, TextField, TextareaField, type PillTone } from '@mas/ui';
import { zodResolver } from '@hookform/resolvers/zod';
import { useMemo, useState } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { SectionHead } from './SectionHead';
import styles from './Timescales.module.css';
import { sectionLabel } from './sections';
import { useAdminConfig } from './useAdminConfig';

const UNITS = ['hours', 'calendar-days', 'working-days', 'weeks', 'months'] as const;
const UNIT_KEYS: Record<ClockRule['unit'], string> = { hours: 'hours', 'calendar-days': 'calendarDays', 'working-days': 'workingDays', weeks: 'weeks', months: 'months' };
const CONFIDENCE_TONE: Record<ClockRule['confidence'], PillTone> = { high: 'low', verify: 'medium', local: 'accent', advisory: 'outline' };

/** The bare unit name, for the unit select. */
const unitLabel = (unit: ClockRule['unit']) => tKey(`admin.timescales.unit.${UNIT_KEYS[unit]}`);
/** The amount and unit together, for example "5 working days". */
const timescale = (unit: ClockRule['unit'], count: number) => tKey(`common.clockUnit.${UNIT_KEYS[unit]}`, { count });
const kindLabel = (kind: ClockRule['kind']) => tKey(`admin.timescales.kind.${kind}`);
const confidenceWord = (c: ClockRule['confidence']) => tKey(`admin.timescales.confidenceWord.${c}`);
const confidenceText = (c: ClockRule['confidence']) => tKey(`admin.timescales.confidenceText.${c}`);

function needsVerify(rule: ClockRule): boolean {
  return rule.todoVerify === true || rule.confidence === 'verify' || rule.confidence === 'local';
}

function ruleSchema(t: Translator) {
  return z.object({
    amount: z.number({ error: t('admin.timescales.errors.amount') }).positive(t('admin.timescales.errors.amountPositive')),
    unit: z.enum(UNITS),
    warnDays: z.number({ error: t('admin.timescales.errors.warnDays') }).int(t('admin.timescales.errors.warnDaysInt')).nonnegative(t('admin.timescales.errors.warnDaysNonnegative')),
    localNote: z.string().max(300, t('admin.timescales.errors.localNoteMax')),
  });
}
type RuleValues = z.infer<ReturnType<typeof ruleSchema>>;

function RuleDialog({ rule, canEdit, onClose, onSave }: { rule: ClockRule; canEdit: boolean; onClose: () => void; onSave: (next: ClockRule) => string[] }) {
  const t = useT();
  const [saveErrors, setSaveErrors] = useState<string[]>([]);
  const schema = useMemo(() => ruleSchema(t), [t]);
  const form = useForm<RuleValues>({ resolver: zodResolver(schema), defaultValues: { amount: rule.amount, unit: rule.unit, warnDays: rule.warnDays, localNote: rule.localNote ?? '' } });
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

  const text = confidenceText(rule.confidence);

  return (
    <Dialog
      open
      onClose={onClose}
      title={t('admin.timescales.dialog.title', { label: clockRuleLabel(rule.id) })}
      size="lg"
      actions={
        <>
          <Button variant="quiet" onClick={onClose}>
            {t('common.actions.cancel')}
          </Button>
          <Button variant="primary" disabled={!canEdit} onClick={() => void form.handleSubmit(submit)()}>
            {t('admin.timescales.dialog.save')}
          </Button>
        </>
      }
    >
      <form className="stack" onSubmit={(e) => e.preventDefault()} noValidate>
        <dl className={styles.ruleFacts}>
          <dt>{t('admin.timescales.dialog.trigger')}</dt>
          <dd>{clockRuleTrigger(rule.id)}</dd>
          <dt>{t('admin.timescales.dialog.source')}</dt>
          <dd>
            {rule.source}
            {rule.sourceRef ? <span className={styles.sourceRef}>{rule.sourceRef}</span> : null}
          </dd>
          <dt>{t('admin.timescales.dialog.confidence')}</dt>
          <dd>
            <Pill size="sm" tone={CONFIDENCE_TONE[rule.confidence]}>
              {confidenceWord(rule.confidence)}
            </Pill>{' '}
            {needsVerify(rule) ? t('admin.timescales.dialog.confidenceVerify', { text }) : text}
          </dd>
        </dl>
        <div className={styles.dialogGrid}>
          <TextField label={t('admin.timescales.dialog.amount')} type="number" min={1} step={1} required disabled={!canEdit} {...form.register('amount', { valueAsNumber: true })} error={errors.amount?.message} />
          <SelectField label={t('admin.timescales.dialog.unit')} required disabled={!canEdit} {...form.register('unit')} options={UNITS.map((u) => ({ value: u, label: unitLabel(u) }))} error={errors.unit?.message} />
          <TextField label={t('admin.timescales.dialog.warn')} type="number" min={0} step={1} required disabled={!canEdit} {...form.register('warnDays', { valueAsNumber: true })} error={errors.warnDays?.message} hint={t('admin.timescales.dialog.warnHint')} />
        </div>
        {seeded?.confidence === 'high' ? <p className={styles.hint}>{t('admin.timescales.dialog.statutoryNote')}</p> : null}
        <TextareaField label={t('admin.timescales.dialog.localNote')} disabled={!canEdit} maxLength={300} {...form.register('localNote')} error={errors.localNote?.message} hint={t('admin.timescales.dialog.localNoteHint')} />
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
  const t = useT();
  const { config, canEdit, save } = useAdminConfig();
  const [editing, setEditing] = useState<ClockRule | null>(null);
  const groups = PROCESS_TYPES.map((p) => ({ process: p, rules: config.clockRules.filter((r) => r.process === p) })).filter((g) => g.rules.length > 0);
  const toVerify = config.clockRules.filter(needsVerify).length;

  function saveRule(next: ClockRule): string[] {
    const result = save({ ...config, clockRules: config.clockRules.map((r) => (r.id === next.id ? next : r)) }, 'timescales', t('admin.timescales.audit', { label: clockRuleLabel(next.id), timescale: timescale(next.unit, next.amount), days: next.warnDays }));
    return result.errors;
  }

  return (
    <>
      <SectionHead title={sectionLabel('timescales')} lede={t('admin.timescales.lede', { count: config.clockRules.length, toVerify })} />
      <div className="stack">
        {groups.map((g) => (
          <Sheet key={g.process}>
            <SheetHead title={<ProcessMark type={g.process} stage={processLabel(g.process)} />} meta={t('admin.timescales.groupMeta', { count: g.rules.length, toVerify: g.rules.filter(needsVerify).length })} divided />
            <SheetBody flush>
              <TableWrap label={t('admin.timescales.tableLabel', { process: processLabel(g.process) })} className={styles.wrap}>
                <Table>
                  <thead>
                    <tr>
                      <th scope="col">{t('admin.timescales.columns.clock')}</th>
                      <th scope="col">{t('admin.timescales.columns.trigger')}</th>
                      <th scope="col">{t('admin.timescales.columns.timescale')}</th>
                      <th scope="col">{t('admin.timescales.columns.confidence')}</th>
                      <th scope="col">{t('admin.timescales.columns.source')}</th>
                      <th scope="col">
                        <span className="visually-hidden">{t('common.columns.actions')}</span>
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {g.rules.map((r) => (
                      <tr key={r.id} data-state={needsVerify(r) ? 'verify' : undefined}>
                        <td>
                          <span className={styles.label}>{clockRuleLabel(r.id)}</span>
                          <span className={styles.meta}>{t('admin.timescales.kindAndId', { kind: kindLabel(r.kind), id: r.id })}</span>
                        </td>
                        <td className={styles.trigger}>{clockRuleTrigger(r.id)}</td>
                        <td className={styles.timescale}>
                          <span className={styles.amount}>{timescale(r.unit, r.amount)}</span>
                          <span className={styles.meta}>{t('admin.timescales.warnAt', { days: r.warnDays })}</span>
                        </td>
                        <td>
                          <div className={styles.confidence}>
                            <Pill size="sm" tone={CONFIDENCE_TONE[r.confidence]}>
                              {confidenceWord(r.confidence)}
                            </Pill>
                            {needsVerify(r) ? <span className={styles.verify}>{t('admin.timescales.toVerify')}</span> : null}
                          </div>
                          {r.localNote ? <span className={styles.localNote}>{r.localNote}</span> : null}
                        </td>
                        <td className={styles.source}>
                          {r.source}
                          {r.sourceRef ? <span className={styles.sourceRef}>{r.sourceRef}</span> : null}
                        </td>
                        <td>
                          <Button size="sm" variant="secondary" onClick={() => setEditing(r)}>
                            {canEdit ? t('common.actions.edit') : t('common.actions.view')}
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
