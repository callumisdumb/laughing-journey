'use client';

import { formatDate } from '@mas/domain';
import { Button, DateField, IconButton, RadioGroup, Sheet, SheetBody, SheetHead, TextField } from '@mas/ui';
import { zodResolver } from '@hookform/resolvers/zod';
import { Plus, X } from 'lucide-react';
import { useState } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { z } from 'zod';
import styles from './Defaults.module.css';
import { SectionHead } from './SectionHead';
import { useAdminConfig } from './useAdminConfig';

const defaultsSchema = z.object({
  theme: z.enum(['light', 'dark', 'system']),
  density: z.enum(['comfortable', 'compact']),
  breakGlassHours: z.number({ error: 'Enter whole hours' }).int('Whole hours only').min(1, 'At least 1 hour').max(24, 'No more than 24 hours'),
});
type DefaultsValues = z.infer<typeof defaultsSchema>;
const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

export function Defaults() {
  const { config, canEdit, save } = useAdminConfig();
  const form = useForm<DefaultsValues>({ resolver: zodResolver(defaultsSchema), defaultValues: { theme: config.defaults.theme, density: config.defaults.density, breakGlassHours: config.breakGlassHours } });
  const [holidays, setHolidays] = useState<string[]>(config.bankHolidays);
  const [newHoliday, setNewHoliday] = useState('');
  const [holidayError, setHolidayError] = useState<string | null>(null);
  const [rules, setRules] = useState<string[]>(config.aspCouncilOfficerEligibility);
  const [councilHolidays, setCouncilHolidays] = useState<string[]>(config.councilHolidays);
  const [newCouncilHoliday, setNewCouncilHoliday] = useState('');
  const [councilHolidayError, setCouncilHolidayError] = useState<string | null>(null);
  const [reasons, setReasons] = useState<string[]>(config.breakGlassReasons);
  const [newReason, setNewReason] = useState('');
  const [newRule, setNewRule] = useState('');
  const [ruleError, setRuleError] = useState<string | null>(null);
  const [listsDirty, setListsDirty] = useState(false);
  const [saveErrors, setSaveErrors] = useState<string[]>([]);
  const errors = form.formState.errors;
  const dirty = form.formState.isDirty || listsDirty;

  function addHoliday() {
    const v = newHoliday.trim();
    if (!ISO_DATE.test(v)) {
      setHolidayError('Enter a date');
      return;
    }
    if (holidays.includes(v)) {
      setHolidayError(`${formatDate(v)} is already in the list`);
      return;
    }
    setHolidays([...holidays, v].sort());
    setNewHoliday('');
    setHolidayError(null);
    setListsDirty(true);
  }
  function removeHoliday(d: string) {
    setHolidays(holidays.filter((x) => x !== d));
    setListsDirty(true);
  }

  function addCouncilHoliday() {
    const v = newCouncilHoliday.trim();
    if (!/^\d{4}-\d{2}-\d{2}$/.test(v)) {
      setCouncilHolidayError('Enter a date');
      return;
    }
    if (councilHolidays.includes(v)) {
      setCouncilHolidayError(`${formatDate(v)} is already in the list`);
      return;
    }
    setCouncilHolidays([...councilHolidays, v].sort());
    setNewCouncilHoliday('');
    setCouncilHolidayError(null);
    setListsDirty(true);
  }

  function removeCouncilHoliday(d: string) {
    setCouncilHolidays(councilHolidays.filter((x) => x !== d));
    setListsDirty(true);
  }

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
      setRuleError('Describe the eligibility rule in a sentence');
      return;
    }
    if (rules.includes(v)) {
      setRuleError('That rule is already in the list');
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
      { ...config, defaults: { theme: values.theme, density: values.density }, breakGlassHours: values.breakGlassHours, bankHolidays: holidays, councilHolidays, breakGlassReasons: reasons, aspCouncilOfficerEligibility: rules },
      'defaults',
      `Defaults: theme ${values.theme}, density ${values.density}, break-glass ${values.breakGlassHours} hours, ${holidays.length} bank holidays, ${councilHolidays.length} council holidays, ${reasons.length} break-glass reason categories, ${rules.length} eligibility rules`,
    );
    setSaveErrors(result.errors);
    if (result.ok) {
      form.reset(values);
      setListsDirty(false);
    }
  }
  function discard() {
    form.reset({ theme: config.defaults.theme, density: config.defaults.density, breakGlassHours: config.breakGlassHours });
    setHolidays(config.bankHolidays);
    setCouncilHolidays(config.councilHolidays);
    setNewCouncilHoliday('');
    setCouncilHolidayError(null);
    setReasons(config.breakGlassReasons);
    setNewReason('');
    setRules(config.aspCouncilOfficerEligibility);
    setNewHoliday('');
    setNewRule('');
    setHolidayError(null);
    setRuleError(null);
    setListsDirty(false);
    setSaveErrors([]);
  }

  return (
    <>
      <SectionHead
        title="Defaults"
        lede="What a new sign-in on this device starts with, the break-glass window, and the calendar and eligibility values the clocks and ASP screens rely on."
        actions={
          <>
            <Button variant="quiet" disabled={!dirty} onClick={discard}>
              Discard changes
            </Button>
            <Button variant="primary" disabled={!canEdit || !dirty} onClick={() => void form.handleSubmit(submit)()}>
              Save defaults
            </Button>
          </>
        }
      />
      <form className="stack" onSubmit={(e) => e.preventDefault()} noValidate>
        <Sheet>
          <SheetHead title="Appearance" meta="Applied to a new sign-in on this device. Each person can change their own theme and density in Settings." />
          <SheetBody>
            <div className={styles.twoUp}>
              <Controller
                control={form.control}
                name="theme"
                render={({ field }) => (
                  <RadioGroup
                    legend="Theme"
                    name="theme"
                    value={field.value}
                    onChange={(v) => canEdit && field.onChange(v)}
                    options={[
                      { value: 'system', label: 'Follow the device', hint: 'Light or dark from the operating system.' },
                      { value: 'light', label: 'Light', hint: 'Cream paper, warm ink.' },
                      { value: 'dark', label: 'Dark', hint: 'Peat paper, pale ink.' },
                    ]}
                  />
                )}
              />
              <Controller
                control={form.control}
                name="density"
                render={({ field }) => (
                  <RadioGroup
                    legend="Density"
                    name="density"
                    value={field.value}
                    onChange={(v) => canEdit && field.onChange(v)}
                    options={[
                      { value: 'comfortable', label: 'Comfortable', hint: '40px rows, 20px panel padding.' },
                      { value: 'compact', label: 'Compact', hint: '32px rows, 12px panel padding.' },
                    ]}
                  />
                )}
              />
            </div>
          </SheetBody>
        </Sheet>

        <Sheet>
          <SheetHead title="Break-glass window" meta="How long access to a restricted record lasts after someone opens it with a recorded reason." />
          <SheetBody>
            <div className={styles.hours}>
              <TextField label="Hours" type="number" min={1} max={24} step={1} required disabled={!canEdit} {...form.register('breakGlassHours', { valueAsNumber: true })} error={errors.breakGlassHours?.message} hint="Between 1 and 24. Every read within the window is audited." />
            </div>
          </SheetBody>
        </Sheet>

        <Sheet>
          <SheetHead title="Bank holidays" meta="Scottish bank holidays, to verify against the current list. Working-day clocks skip these dates and weekends." />
          <SheetBody>
            <ul className={styles.list} aria-label="Bank holidays">
              {holidays.map((d) => (
                <li key={d} className={styles.listItem}>
                  <span>
                    {formatDate(d)}
                    <span className={styles.iso}>{d}</span>
                  </span>
                  {canEdit ? (
                    <IconButton size="sm" aria-label={`Remove ${formatDate(d)}`} onClick={() => removeHoliday(d)}>
                      <X size={14} aria-hidden="true" />
                    </IconButton>
                  ) : null}
                </li>
              ))}
            </ul>
            {canEdit ? (
              <div className={styles.addRow}>
                <DateField label="Add a bank holiday (dd Mon yyyy)" hint={null} value={newHoliday} onChange={setNewHoliday} onKeyDown={(e) => e.key === 'Enter' && addHoliday()} error={holidayError} />
                <Button variant="secondary" icon={<Plus size={14} aria-hidden="true" />} onClick={addHoliday}>
                  Add date
                </Button>
              </div>
            ) : null}
          </SheetBody>
        </Sheet>

        <Sheet>
          <SheetHead title="Council local holidays" meta="Clydeshore's own holidays, kept apart from the national list. Working-day clocks skip these dates too. Fictional dates, to verify against the council calendar." />
          <SheetBody>
            <ul className={styles.list} aria-label="Council local holidays">
              {councilHolidays.map((d) => (
                <li key={d} className={styles.listItem}>
                  <span>
                    {formatDate(d)} <span className={styles.muted}>{d}</span>
                  </span>
                  {canEdit ? (
                    <IconButton size="sm" aria-label={`Remove council holiday ${formatDate(d)}`} onClick={() => removeCouncilHoliday(d)}>
                      <X size={14} aria-hidden="true" />
                    </IconButton>
                  ) : null}
                </li>
              ))}
              {councilHolidays.length === 0 ? <li className={styles.muted}>No council holidays. Only the national list applies.</li> : null}
            </ul>
            {canEdit ? (
              <div className={styles.addRow}>
                <DateField label="Add a council holiday (dd Mon yyyy)" hint={null} value={newCouncilHoliday} onChange={setNewCouncilHoliday} onKeyDown={(e) => e.key === 'Enter' && addCouncilHoliday()} error={councilHolidayError} />
                <Button variant="secondary" icon={<Plus size={14} aria-hidden="true" />} onClick={addCouncilHoliday}>
                  Add date
                </Button>
              </div>
            ) : null}
          </SheetBody>
        </Sheet>

        <Sheet>
          <SheetHead title="ASP council officer eligibility" meta="Who may act as a council officer under section 52 of the Adult Support and Protection (Scotland) Act 2007, to verify against the local rule." />
          <SheetBody>
            <ul className={styles.rules} aria-label="Eligibility rules">
              {rules.map((r) => (
                <li key={r} className={styles.listItem}>
                  <span>{r}</span>
                  {canEdit ? (
                    <IconButton size="sm" aria-label={`Remove rule: ${r}`} onClick={() => removeRule(r)}>
                      <X size={14} aria-hidden="true" />
                    </IconButton>
                  ) : null}
                </li>
              ))}
              {rules.length === 0 ? <li className={styles.muted}>No eligibility rules. Nobody can be recorded as a council officer until one is added.</li> : null}
            </ul>
            {canEdit ? (
              <div className={styles.addRow}>
                <TextField label="Add an eligibility rule" value={newRule} maxLength={160} placeholder="e.g. Registered social worker with the required post-qualifying experience" onChange={(e) => setNewRule(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && addRule()} error={ruleError} className={styles.ruleInput} />
                <Button variant="secondary" icon={<Plus size={14} aria-hidden="true" />} onClick={addRule}>
                  Add rule
                </Button>
              </div>
            ) : null}
          </SheetBody>
        </Sheet>

        <Sheet>
          <SheetHead title="Break-glass reason categories" meta="Offered in the dialog when someone opens a restricted record; the free-text reason is recorded with the category. At least one category must remain." />
          <SheetBody>
            <ul className={styles.rules} aria-label="Break-glass reason categories">
              {reasons.map((r) => (
                <li key={r} className={styles.listItem}>
                  <span>{r}</span>
                  {canEdit && reasons.length > 1 ? (
                    <IconButton size="sm" aria-label={`Remove reason category: ${r}`} onClick={() => removeReason(r)}>
                      <X size={14} aria-hidden="true" />
                    </IconButton>
                  ) : null}
                </li>
              ))}
            </ul>
            {canEdit ? (
              <div className={styles.addRow}>
                <TextField label="Add a reason category" value={newReason} maxLength={80} placeholder="e.g. Immediate risk to a child" onChange={(e) => setNewReason(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && addReason()} />
                <Button variant="secondary" icon={<Plus size={14} aria-hidden="true" />} onClick={addReason}>
                  Add category
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
