'use client';

import { CalendarCoverageError, addWorkingDays, formatDate, nonWorkingDaysBetween, workingCalendarFrom, type CouncilHoliday, type DayVerdict } from '@mas/domain';
import { tKey, useT } from '@mas/messages';
import { Button, DateField, IconButton, SelectField, Sheet, SheetBody, SheetHead, Switch, TextField } from '@mas/ui';
import { Plus, Trash2 } from 'lucide-react';
import { useMemo, useState } from 'react';
import { SectionHead } from './SectionHead';
import { sectionLabel } from './sections';
import { useAdminConfig } from './useAdminConfig';
import { useNow } from '@/lib/store';
import styles from './Calendar.module.css';

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

/** Why a day is not a working day, in the reader's words rather than an enum. */
function reasonFor(day: DayVerdict): string {
  if (day.reason === 'weekend') return tKey('admin.calendar.reason.weekend');
  if (day.reason === 'council') return tKey('admin.calendar.reason.council', { title: day.title ?? '' });
  return tKey('admin.calendar.reason.national', { title: day.title ?? '', notes: day.notes ?? 'none' });
}

function addYear(date: string): string {
  const [y, m, d] = date.split('-').map(Number);
  return `${String((y ?? 0) + 1).padStart(4, '0')}-${String(m ?? 1).padStart(2, '0')}-${String(d ?? 1).padStart(2, '0')}`;
}

/**
 * The calendar behind every working-day clock (brief section G, holidays addendum section 9).
 *
 * Three lists, kept apart on screen because they are kept apart in the data: the national list from
 * the gov.uk feed, which the application never fetches; which of those this organisation actually
 * observes; and the council's own local days, which differ from the next authority's.
 *
 * The calculator at the foot is the part that earns the screen. A sceptical practitioner will test
 * the product against what they know, and a calculator that shows which days it skipped and why is
 * either convincing or wrong in a way somebody can point at. It calls the same function the clocks
 * call, so it cannot agree with something the product does not do.
 */
export function Calendar() {
  const t = useT();
  const now = useNow();
  const { config, canEdit, save } = useAdminConfig();
  const calendar = useMemo(() => workingCalendarFrom(config), [config]);

  const years = useMemo(() => [...new Set(config.bankHolidays.map((h) => h.date.slice(0, 4)))].sort(), [config.bankHolidays]);
  const [year, setYear] = useState(() => {
    const current = now.toISOString().slice(0, 4);
    return years.includes(current) ? current : (years[0] ?? '');
  });

  const [localDate, setLocalDate] = useState('');
  const [localTitle, setLocalTitle] = useState('');
  const [localError, setLocalError] = useState<string | null>(null);

  const [from, setFrom] = useState(() => now.toISOString().slice(0, 10));
  const [amount, setAmount] = useState('5');
  const [direction, setDirection] = useState<'forward' | 'back'>('forward');

  const national = config.bankHolidays.filter((h) => h.date.startsWith(year));
  const observedOf = (date: string) => config.holidayObservance.find((o) => o.date === date)?.observed !== false;

  const today = now.toISOString().slice(0, 10);
  const twelveMonths = useMemo(() => {
    try {
      return nonWorkingDaysBetween(today, addYear(today), calendar);
    } catch {
      return [];
    }
  }, [today, calendar]);

  const calculation = useMemo(() => {
    const count = Number(amount);
    if (!ISO_DATE.test(from) || !Number.isFinite(count) || count <= 0) return null;
    try {
      return { result: addWorkingDays(from, direction === 'back' ? -count : count, calendar), outside: false as const };
    } catch (error) {
      if (error instanceof CalendarCoverageError) return { result: null, outside: true as const };
      throw error;
    }
  }, [from, amount, direction, calendar]);

  function setObserved(date: string, observed: boolean) {
    const rest = config.holidayObservance.filter((o) => o.date !== date);
    const next = observed ? rest : [...rest, { date, observed: false }];
    save({ ...config, holidayObservance: next }, 'calendar', t('admin.calendar.saved'));
  }

  function addLocal() {
    if (!ISO_DATE.test(localDate.trim())) {
      setLocalError(t('admin.defaults.errors.date'));
      return;
    }
    if (config.councilHolidays.some((h) => h.date === localDate.trim())) {
      setLocalError(t('admin.defaults.errors.dateDuplicate', { date: formatDate(localDate.trim()) }));
      return;
    }
    const next: CouncilHoliday[] = [...config.councilHolidays, { date: localDate.trim(), title: localTitle.trim() || t('admin.calendar.council.title') }].sort((a, b) => a.date.localeCompare(b.date));
    const result = save({ ...config, councilHolidays: next }, 'calendar', t('admin.calendar.saved'));
    if (result.ok) {
      setLocalDate('');
      setLocalTitle('');
      setLocalError(null);
    }
  }

  function removeLocal(date: string) {
    save({ ...config, councilHolidays: config.councilHolidays.filter((h) => h.date !== date) }, 'calendar', t('admin.calendar.saved'));
  }

  return (
    <>
      <SectionHead title={sectionLabel('calendar')} lede={t('admin.sections.calendar.description')} />
      <div className={styles.grid}>
        <Sheet>
          <SheetHead title={t('admin.calendar.provenance.title')} divided />
          <SheetBody>
            <div className={styles.provenance} data-testid="calendar-provenance">
              <span className={styles.provenanceSource}>
                {config.bankHolidayProvenance.source} ({config.bankHolidayProvenance.division})
              </span>
              <span>{t('admin.calendar.provenance.fetched', { date: formatDate(config.bankHolidayProvenance.fetchedAt) })}</span>
              <span>{t('admin.calendar.provenance.coverage', { from: formatDate(config.bankHolidayProvenance.coversFrom), to: formatDate(config.bankHolidayProvenance.coversTo) })}</span>
              <span className={styles.neverFetched}>{t('admin.calendar.provenance.neverFetched')}</span>
            </div>
          </SheetBody>
        </Sheet>

        <Sheet>
          <SheetHead
            title={t('admin.calendar.national.title')}
            meta={t('admin.calendar.national.meta', { count: national.length, year })}
            actions={<SelectField label={t('admin.calendar.national.year')} value={year} onChange={(e) => setYear(e.target.value)} options={years.map((y) => ({ value: y, label: y }))} data-testid="calendar-year" />}
            divided
          />
          <SheetBody>
            <p className={styles.muted}>{t('admin.calendar.national.observedHint')}</p>
            <ul className={styles.rows} aria-label={t('admin.calendar.national.listLabel', { year })}>
              {national.map((holiday) => (
                <li key={holiday.date} className={styles.row}>
                  <span className={styles.rowDate}>{formatDate(holiday.date)}</span>
                  <span className={styles.rowTitle}>{holiday.title}</span>
                  {holiday.notes ? <span className={styles.rowNote}>{holiday.notes}</span> : null}
                  <Switch label={observedOf(holiday.date) ? t('admin.calendar.national.observed') : t('admin.calendar.national.notObserved')} checked={observedOf(holiday.date)} disabled={!canEdit} onChange={(e) => setObserved(holiday.date, e.target.checked)} />
                </li>
              ))}
            </ul>
          </SheetBody>
        </Sheet>

        <Sheet className={styles.local}>
          <SheetHead title={t('admin.calendar.council.title')} meta={t('admin.calendar.council.meta')} divided />
          <SheetBody>
            <ul className={styles.rows} aria-label={t('admin.calendar.council.listLabel')}>
              {config.councilHolidays.map((holiday) => (
                <li key={holiday.date} className={styles.row}>
                  <span className={styles.rowDate}>{formatDate(holiday.date)}</span>
                  <span className={styles.rowTitle}>{holiday.title}</span>
                  {canEdit ? (
                    <IconButton size="sm" aria-label={t('admin.calendar.council.remove', { date: formatDate(holiday.date) })} onClick={() => removeLocal(holiday.date)}>
                      <Trash2 size={14} aria-hidden="true" />
                    </IconButton>
                  ) : null}
                </li>
              ))}
              {config.councilHolidays.length === 0 ? <li className={styles.muted}>{t('admin.calendar.council.empty')}</li> : null}
            </ul>
            {canEdit ? (
              <div className={styles.add}>
                <DateField label={t('admin.calendar.council.add')} hint={null} value={localDate} onChange={setLocalDate} error={localError} />
                <TextField label={t('admin.calendar.council.titleLabel')} value={localTitle} onChange={(e) => setLocalTitle(e.target.value)} />
                <Button variant="secondary" icon={<Plus size={14} aria-hidden="true" />} onClick={addLocal} data-testid="calendar-add-local">
                  {t('admin.calendar.council.addButton')}
                </Button>
              </div>
            ) : null}
          </SheetBody>
        </Sheet>

        <Sheet>
          <SheetHead title={t('admin.calendar.combined.title')} meta={t('admin.calendar.combined.meta', { from: formatDate(today), to: formatDate(addYear(today)) })} divided />
          <SheetBody>
            <ul className={styles.rows} data-testid="calendar-twelve-months">
              {twelveMonths.length === 0 ? <li className={styles.muted}>{t('admin.calendar.combined.empty')}</li> : null}
              {twelveMonths
                .filter((day) => day.reason !== 'weekend')
                .map((day) => (
                  <li key={day.date} className={styles.row}>
                    <span className={styles.rowDate}>{formatDate(day.date)}</span>
                    <span className={styles.rowTitle}>{reasonFor(day)}</span>
                  </li>
                ))}
            </ul>
          </SheetBody>
        </Sheet>

        <Sheet>
          <SheetHead title={t('admin.calendar.calculator.title')} meta={t('admin.calendar.calculator.meta')} divided />
          <SheetBody>
            <div className={styles.calculator}>
              <DateField label={t('admin.calendar.calculator.from')} hint={null} value={from} onChange={setFrom} data-testid="calculator-from" />
              <TextField label={t('admin.calendar.calculator.amount')} type="number" min={1} value={amount} onChange={(e) => setAmount(e.target.value)} data-testid="calculator-amount" />
              <SelectField
                label={t('admin.calendar.calculator.direction')}
                value={direction}
                onChange={(e) => setDirection(e.target.value === 'back' ? 'back' : 'forward')}
                options={[
                  { value: 'forward', label: t('admin.calendar.calculator.forwards') },
                  { value: 'back', label: t('admin.calendar.calculator.backwards') },
                ]}
                data-testid="calculator-direction"
              />
            </div>
            {calculation?.outside ? <p className={styles.outside}>{t('admin.calendar.calculator.outside', { from: formatDate(config.bankHolidayProvenance.coversFrom), to: formatDate(config.bankHolidayProvenance.coversTo) })}</p> : null}
            {calculation?.result ? (
              <>
                <p className={styles.answer} data-testid="calculator-answer">
                  {t('admin.calendar.calculator.answer', { from: formatDate(calculation.result.from), direction, count: Math.abs(calculation.result.amount), to: formatDate(calculation.result.date) })}
                </p>
                <p className={styles.working}>{t('admin.calendar.calculator.skipped', { count: calculation.result.steps.filter((s) => !s.counted).length })}</p>
                <ul className={styles.rows} data-testid="calculator-skipped">
                  {calculation.result.steps
                    .filter((step) => !step.counted)
                    .map((step) => (
                      <li key={step.date} className={styles.row}>
                        <span className={styles.rowTitle}>{t('admin.calendar.calculator.skippedRow', { date: formatDate(step.date), reason: reasonFor({ date: step.date, working: false, reason: step.reason, title: step.title }) })}</span>
                      </li>
                    ))}
                </ul>
              </>
            ) : null}
          </SheetBody>
        </Sheet>
      </div>
    </>
  );
}
