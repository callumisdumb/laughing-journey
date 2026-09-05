/**
 * Reporting periods. Each report has its own calendar (year to 31 July, biennium to 31 March,
 * rolling quarters) and every option is a closed range of ISO calendar dates. Pure functions.
 */
import { formatDate, localDateOf } from '@mas/domain';
import { t } from '@mas/messages';
import { addDays, addMonths, endOfMonth, format, parseISO, startOfMonth } from 'date-fns';
import type { ReportKind } from './model';

export interface Period {
  id: string;
  label: string;
  /** ISO calendar date, inclusive. */
  from: string;
  /** ISO calendar date, inclusive. For a period in progress this is today. */
  to: string;
  inProgress: boolean;
}

export interface Bucket {
  /** yyyy-MM of the first month in the bucket. */
  key: string;
  /** Axis label, e.g. "Aug 25". */
  short: string;
  /** Table label, e.g. "August 2025" or "Apr to Jun 2024". */
  long: string;
  /** Last calendar date of the bucket, clipped to the period. */
  end: string;
}

function iso(d: Date): string {
  return format(d, 'yyyy-MM-dd');
}

function dayAfter(isoDate: string): string {
  return iso(addDays(parseISO(isoDate), 1));
}

function range(from: string, to: string): string {
  return t('reports.period.range', { from: formatDate(from), to: formatDate(to) });
}

/** The Europe/London calendar date of an instant; a date-only string is already one. */
export function calendarDate(isoValue: string): string {
  return isoValue.length === 10 ? isoValue : localDateOf(isoValue);
}

interface YearShape {
  prefix: string;
  endMonth: number;
  endDay: number;
  /** 1 for annual, 2 for biennial. */
  step: number;
  count: number;
  name: (endYear: number) => string;
}

function yearEnd(year: number, s: YearShape): string {
  return `${year}-${String(s.endMonth).padStart(2, '0')}-${String(s.endDay).padStart(2, '0')}`;
}

function yearPeriods(s: YearShape, today: string): Period[] {
  const thisYear = Number(today.slice(0, 4));
  let latest = yearEnd(thisYear, s) <= today ? thisYear : thisYear - 1;
  if (s.step === 2 && latest % 2 !== 0) latest -= 1;
  const out: Period[] = [];
  const next = latest + s.step;
  const nextFrom = dayAfter(yearEnd(latest, s));
  out.push({ id: `${s.prefix}${next}`, label: t('reports.period.inProgress', { name: s.name(next), range: range(nextFrom, today) }), from: nextFrom, to: today, inProgress: true });
  for (let k = 0; k < s.count; k += 1) {
    const end = latest - k * s.step;
    const from = dayAfter(yearEnd(end - s.step, s));
    out.push({ id: `${s.prefix}${end}`, label: t('reports.period.complete', { name: s.name(end), range: range(from, yearEnd(end, s)) }), from, to: yearEnd(end, s), inProgress: false });
  }
  return out;
}

/** Rolling windows of four quarters, the first one still in progress. */
function quarterPeriods(today: string, count: number): Period[] {
  const d = parseISO(today);
  const quarterEndMonth = Math.floor(d.getMonth() / 3) * 3 + 2;
  const currentEnd = endOfMonth(new Date(d.getFullYear(), quarterEndMonth, 1));
  const out: Period[] = [];
  for (let k = 0; k <= count; k += 1) {
    const end = endOfMonth(addMonths(currentEnd, -3 * k));
    const from = iso(startOfMonth(addMonths(end, -11)));
    const endIso = iso(end);
    const id = `q${end.getFullYear()}-${Math.floor(end.getMonth() / 3) + 1}`;
    const name = t('reports.period.fourQuartersTo', { date: formatDate(endIso) });
    if (k === 0) out.push({ id, label: t('reports.period.inProgress', { name, range: range(from, today) }), from, to: today, inProgress: true });
    else out.push({ id, label: t('reports.period.complete', { name, range: range(from, endIso) }), from, to: endIso, inProgress: false });
  }
  return out;
}

function awiPeriods(today: string): Period[] {
  const y = Number(today.slice(0, 4));
  const start = `${y}-04-01` <= today ? `${y}-04-01` : `${y - 1}-04-01`;
  const ytd: Period = { id: 'ytd', label: t('reports.period.yearToDate', { range: range(start, today) }), from: start, to: today, inProgress: true };
  const years = yearPeriods({ prefix: 'y', endMonth: 3, endDay: 31, step: 1, count: 3, name: (e) => t('reports.period.yearTo31Mar', { year: e }) }, today).filter((p) => !p.inProgress);
  return [ytd, ...years];
}

export function periodsFor(kind: ReportKind, now: Date): Period[] {
  const today = localDateOf(now);
  switch (kind) {
    case 'cp':
      return yearPeriods({ prefix: 'y', endMonth: 7, endDay: 31, step: 1, count: 8, name: (e) => t('reports.period.yearTo31Jul', { year: e }) }, today);
    case 'asp':
      return yearPeriods({ prefix: 'b', endMonth: 3, endDay: 31, step: 2, count: 4, name: (e) => t('reports.period.twoYearsTo31Mar', { year: e }) }, today);
    case 'marac':
      return quarterPeriods(today, 5);
    case 'mappa':
      return yearPeriods({ prefix: 'y', endMonth: 3, endDay: 31, step: 1, count: 4, name: (e) => t('reports.period.yearTo31Mar', { year: e }) }, today);
    case 'awi':
      return awiPeriods(today);
  }
}

/** The period each report opens on: the last complete cycle, or the rolling window for MARAC and AWI. */
export function defaultPeriod(kind: ReportKind, periods: Period[]): Period {
  const first = periods[0];
  if (!first) throw new Error('No reporting periods');
  if (kind === 'marac' || kind === 'awi') return first;
  return periods.find((p) => !p.inProgress) ?? first;
}

export function resolvePeriod(kind: ReportKind, now: Date, id: string | null | undefined): Period {
  const periods = periodsFor(kind, now);
  return periods.find((p) => p.id === id) ?? defaultPeriod(kind, periods);
}

/** True when the value's calendar date (Europe/London) falls inside the period. */
export function inPeriod(isoValue: string | undefined, p: Period): boolean {
  if (!isoValue) return false;
  const d = calendarDate(isoValue);
  return d >= p.from && d <= p.to;
}

export function monthsIn(p: Period): Bucket[] {
  const out: Bucket[] = [];
  const to = parseISO(p.to);
  let d = startOfMonth(parseISO(p.from));
  while (d <= to) {
    const end = endOfMonth(d);
    out.push({ key: format(d, 'yyyy-MM'), short: format(d, 'MMM yy'), long: format(d, 'MMMM yyyy'), end: iso(end <= to ? end : to) });
    d = addMonths(d, 1);
  }
  return out;
}

export function quartersIn(p: Period): Bucket[] {
  const out: Bucket[] = [];
  const to = parseISO(p.to);
  const first = startOfMonth(parseISO(p.from));
  let d = new Date(first.getFullYear(), Math.floor(first.getMonth() / 3) * 3, 1);
  while (d <= to) {
    const end = endOfMonth(addMonths(d, 2));
    out.push({ key: format(d, 'yyyy-MM'), short: format(d, 'MMM yy'), long: t('reports.period.range', { from: format(d, 'MMM'), to: format(end, 'MMM yyyy') }), end: iso(end <= to ? end : to) });
    d = addMonths(d, 3);
  }
  return out;
}

export function monthKeyOf(isoValue: string): string {
  return calendarDate(isoValue).slice(0, 7);
}

export function quarterKeyOf(isoValue: string): string {
  const d = calendarDate(isoValue);
  const month = Number(d.slice(5, 7));
  const quarterStart = month - ((month - 1) % 3);
  return `${d.slice(0, 4)}-${String(quarterStart).padStart(2, '0')}`;
}
