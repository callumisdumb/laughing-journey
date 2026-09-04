'use client';

import {  } from '@mas/domain';
import { useT, type Translator } from '@mas/messages';
import { Button, IconButton, RadioGroup, Sheet, SheetBody, SheetHead, TextField } from '@mas/ui';
import { zodResolver } from '@hookform/resolvers/zod';
import { Plus, X } from 'lucide-react';
import { useMemo, useState } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { z } from 'zod';
import styles from './Defaults.module.css';
import { SectionHead } from './SectionHead';
import { sectionLabel } from './sections';
import { useAdminConfig } from './useAdminConfig';

function defaultsSchema(t: Translator) {
  return z.object({
    theme: z.enum(['light', 'dark', 'system']),
    density: z.enum(['comfortable', 'compact']),
    breakGlassHours: z.number({ error: t('admin.defaults.errors.hours') }).int(t('admin.defaults.errors.hoursInt')).min(1, t('admin.defaults.errors.hoursMin')).max(24, t('admin.defaults.errors.hoursMax')),
  });
}
type DefaultsValues = z.infer<ReturnType<typeof defaultsSchema>>;

export function Defaults() {
  const t = useT();
  const { config, canEdit, save } = useAdminConfig();
  const schema = useMemo(() => defaultsSchema(t), [t]);
  const form = useForm<DefaultsValues>({ resolver: zodResolver(schema), defaultValues: { theme: config.defaults.theme, density: config.defaults.density, breakGlassHours: config.breakGlassHours } });
  const [rules, setRules] = useState<string[]>(config.aspCouncilOfficerEligibility);
  const [reasons, setReasons] = useState<string[]>(config.breakGlassReasons);
  const [newReason, setNewReason] = useState('');
  const [newRule, setNewRule] = useState('');
  const [ruleError, setRuleError] = useState<string | null>(null);
  const [listsDirty, setListsDirty] = useState(false);
  const [saveErrors, setSaveErrors] = useState<string[]>([]);
  const errors = form.formState.errors;
  const dirty = form.formState.isDirty || listsDirty;




  function addReason() {
    const v = newReason.trim();
    if (v.length < 3 || reasons.includes(v)) return;
    setReasons([...reasons, v]);
    setNewReason('');
    setListsDirty(true);
  }

  function removeReason(r: string) {
    if (reasons.length <= 1) return;
    setReasons(reasons.filter((x) => x !== r));
    setListsDirty(true);
  }
  function addRule() {
    const v = newRule.trim();
    if (v.length < 5) {
      setRuleError(t('admin.defaults.errors.rule'));
      return;
    }
    if (rules.includes(v)) {
      setRuleError(t('admin.defaults.errors.ruleDuplicate'));
      return;
    }
    setRules([...rules, v]);
    setNewRule('');
    setRuleError(null);
    setListsDirty(true);
  }
  function removeRule(r: string) {
    setRules(rules.filter((x) => x !== r));
    setListsDirty(true);
  }
  function submit(values: DefaultsValues) {
    const result = save(
      { ...config, defaults: { theme: values.theme, density: values.density }, breakGlassHours: values.breakGlassHours, breakGlassReasons: reasons, aspCouncilOfficerEligibility: rules },
      'defaults',
      t('admin.defaults.audit', { theme: values.theme, density: values.density, hours: values.breakGlassHours, reasons: reasons.length, rules: rules.length }),
    );
    setSaveErrors(result.errors);
    if (result.ok) {
      form.reset(values);
      setListsDirty(false);
    }
  }
  function discard() {
    form.reset({ theme: config.defaults.theme, density: config.defaults.density, breakGlassHours: config.breakGlassHours });
    setReasons(config.breakGlassReasons);
    setNewReason('');
    setRules(config.aspCouncilOfficerEligibility);
    setNewRule('');
    setRuleError(null);
    setListsDirty(false);
    setSaveErrors([]);
  }

  return (
    <>
      <SectionHead
        title={sectionLabel('defaults')}
        lede={t('admin.defaults.lede')}
        actions={
          <>
            <Button variant="quiet" disabled={!dirty} onClick={discard}>
              {t('admin.actions.discardChanges')}
            </Button>
            <Button variant="primary" disabled={!canEdit || !dirty} onClick={() => void form.handleSubmit(submit)()}>
              {t('admin.defaults.save')}
            </Button>
          </>
        }
      />
      <form className="stack" onSubmit={(e) => e.preventDefault()} noValidate>
        <Sheet>
          <SheetHead title={t('admin.defaults.appearance.title')} meta={t('admin.defaults.appearance.meta')} />
          <SheetBody>
            <div className={styles.twoUp}>
              <Controller
                control={form.control}
                name="theme"
                render={({ field }) => (
                  <RadioGroup
                    legend={t('admin.defaults.appearance.themeLegend')}
                    name="theme"
                    value={field.value}
                    onChange={(v) => canEdit && field.onChange(v)}
                    options={[
                      { value: 'system', label: t('admin.defaults.theme.system'), hint: t('admin.defaults.themeHint.system') },
                      { value: 'light', label: t('admin.defaults.theme.light'), hint: t('admin.defaults.themeHint.light') },
                      { value: 'dark', label: t('admin.defaults.theme.dark'), hint: t('admin.defaults.themeHint.dark') },
                    ]}
                  />
                )}
              />
              <Controller
                control={form.control}
                name="density"
                render={({ field }) => (
                  <RadioGroup
                    legend={t('admin.defaults.appearance.densityLegend')}
                    name="density"
                    value={field.value}
                    onChange={(v) => canEdit && field.onChange(v)}
                    options={[
                      { value: 'comfortable', label: t('admin.defaults.density.comfortable'), hint: t('admin.defaults.densityHint.comfortable') },
                      { value: 'compact', label: t('admin.defaults.density.compact'), hint: t('admin.defaults.densityHint.compact') },
                    ]}
                  />
                )}
              />
            </div>
          </SheetBody>
        </Sheet>

        <Sheet>
          <SheetHead title={t('admin.defaults.breakGlass.title')} meta={t('admin.defaults.breakGlass.meta')} />
          <SheetBody>
            <div className={styles.hours}>
              <TextField label={t('admin.defaults.breakGlass.hours')} type="number" min={1} max={24} step={1} required disabled={!canEdit} {...form.register('breakGlassHours', { valueAsNumber: true })} error={errors.breakGlassHours?.message} hint={t('admin.defaults.breakGlass.hoursHint')} />
            </div>
          </SheetBody>
        </Sheet>



        <Sheet>
          <SheetHead title={t('admin.defaults.eligibility.title')} meta={t('admin.defaults.eligibility.meta')} />
          <SheetBody>
            <ul className={styles.rules} aria-label={t('admin.defaults.eligibility.listLabel')}>
              {rules.map((r) => (
                <li key={r} className={styles.listItem}>
                  <span>{r}</span>
                  {canEdit ? (
                    <IconButton size="sm" aria-label={t('admin.defaults.eligibility.remove', { rule: r })} onClick={() => removeRule(r)}>
                      <X size={14} aria-hidden="true" />
                    </IconButton>
                  ) : null}
                </li>
              ))}
              {rules.length === 0 ? <li className={styles.muted}>{t('admin.defaults.eligibility.empty')}</li> : null}
            </ul>
            {canEdit ? (
              <div className={styles.addRow}>
                <TextField label={t('admin.defaults.eligibility.add')} value={newRule} maxLength={160} placeholder={t('admin.defaults.eligibility.addPlaceholder')} onChange={(e) => setNewRule(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && addRule()} error={ruleError} className={styles.ruleInput} />
                <Button variant="secondary" icon={<Plus size={14} aria-hidden="true" />} onClick={addRule}>
                  {t('admin.defaults.eligibility.addButton')}
                </Button>
              </div>
            ) : null}
          </SheetBody>
        </Sheet>

        <Sheet>
          <SheetHead title={t('admin.defaults.reasons.title')} meta={t('admin.defaults.reasons.meta')} />
          <SheetBody>
            <ul className={styles.rules} aria-label={t('admin.defaults.reasons.listLabel')}>
              {reasons.map((r) => (
                <li key={r} className={styles.listItem}>
                  <span>{r}</span>
                  {canEdit && reasons.length > 1 ? (
                    <IconButton size="sm" aria-label={t('admin.defaults.reasons.remove', { reason: r })} onClick={() => removeReason(r)}>
                      <X size={14} aria-hidden="true" />
                    </IconButton>
                  ) : null}
                </li>
              ))}
            </ul>
            {canEdit ? (
              <div className={styles.addRow}>
                <TextField label={t('admin.defaults.reasons.add')} value={newReason} maxLength={80} placeholder={t('admin.defaults.reasons.addPlaceholder')} onChange={(e) => setNewReason(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && addReason()} />
                <Button variant="secondary" icon={<Plus size={14} aria-hidden="true" />} onClick={addReason}>
                  {t('admin.defaults.reasons.addButton')}
                </Button>
              </div>
            ) : null}
          </SheetBody>
        </Sheet>

        {saveErrors.length > 0 ? (
          <ul className={styles.errors} role="alert">
            {saveErrors.map((e) => (
              <li key={e}>{e}</li>
            ))}
          </ul>
        ) : null}
      </form>
    </>
  );
}
