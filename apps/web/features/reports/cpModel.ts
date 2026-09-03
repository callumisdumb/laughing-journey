/**
 * Child Protection Register statistics, computed from the register block of every child protection
 * process. Children are counted, not cases: a sibling group registered at one CPPM counts once per child.
 */
import { CP_REGISTER_CATEGORIES, CP_REGISTER_CATEGORY_LABELS, daysBetween, formatDate, formatDateTime, localDateOf, type CpProcess, type CpRegisterCategory, type Dataset, type Person } from '@mas/domain';
import { t, tKey } from '@mas/messages';
import { personById } from '@/lib/selectors';
import { ageOn } from './helpers';
import { countBy, scaleColour, type ChartSpec, type ReportModel, type ReportSection, type TableSpec } from './model';
import { inPeriod, monthsIn, type Period } from './period';

/** Age bands in table order; the wording comes from the catalogue by band id. */
const AGE_BANDS = ['unborn', 'underOne', 'oneToFour', 'fiveToTen', 'elevenToFifteen', 'sixteenAndOver'] as const;
type AgeBand = (typeof AGE_BANDS)[number] | 'notRecorded';
const LENGTH_BANDS = ['underSixMonths', 'sixMonthsToOneYear', 'oneToTwoYears', 'twoYearsOrMore'] as const;
type LengthBand = (typeof LENGTH_BANDS)[number];

const ageBandLabel = (band: AgeBand) => tKey(`reports.cp.ageBands.${band}`);
const lengthBandLabel = (band: LengthBand) => tKey(`reports.cp.lengthBands.${band}`);

interface Entry {
  personId: string;
  person: Person | undefined;
  registeredAt: string;
  deregisteredAt?: string;
  categories: CpRegisterCategory[];
  preBirth: boolean;
}

function ageBand(e: Entry, isoDate: string): AgeBand {
  const p = e.person;
  if (!p) return 'notRecorded';
  if (!p.dateOfBirth || p.dateOfBirth > isoDate) return 'unborn';
  const years = ageOn(p.dateOfBirth, isoDate);
  if (years < 1) return 'underOne';
  if (years <= 4) return 'oneToFour';
  if (years <= 10) return 'fiveToTen';
  if (years <= 15) return 'elevenToFifteen';
  return 'sixteenAndOver';
}

function lengthBand(days: number): LengthBand {
  if (days < 182) return LENGTH_BANDS[0];
  if (days < 365) return LENGTH_BANDS[1];
  if (days < 730) return LENGTH_BANDS[2];
  return LENGTH_BANDS[3];
}

export function cpModel(data: Dataset, now: Date, period: Period): ReportModel {
  const today = localDateOf(now);
  const endLabel = formatDate(period.to);
  const cps = data.processes.filter((p): p is CpProcess => p.type === 'cp');
  const entries: Entry[] = cps.flatMap((p) => {
    const r = p.detail.register;
    if (!r) return [];
    return p.subjectIds.map((id) => {
      const person = personById(data, id);
      const bornAfter = person ? !person.dateOfBirth || person.dateOfBirth > r.registeredAt : false;
      return { personId: id, person, registeredAt: r.registeredAt, deregisteredAt: r.deregisteredAt, categories: r.categories, preBirth: Boolean(p.detail.preBirth) || bornAfter };
    });
  });

  const registrations = entries.filter((e) => inPeriod(e.registeredAt, period));
  const deregistrations = entries.filter((e) => e.deregisteredAt && inPeriod(e.deregisteredAt, period));
  const onRegister = (date: string) => entries.filter((e) => e.registeredAt <= date && (!e.deregisteredAt || e.deregisteredAt > date));
  const atEnd = onRegister(period.to);
  const months = monthsIn(period);

  const history = (e: Entry): 'first' | 'within' | 'after' => {
    const priorEnds = entries.flatMap((o) => (o !== e && o.personId === e.personId && o.deregisteredAt && o.deregisteredAt <= e.registeredAt ? [o.deregisteredAt] : [])).sort().reverse();
    const last = priorEnds[0];
    if (!last) return 'first';
    return daysBetween(last, e.registeredAt) <= 730 ? 'within' : 'after';
  };
  const historyCounts = countBy(registrations, history);
  const preBirth = registrations.filter((e) => e.preBirth).length;
  const ageCounts = countBy(atEnd, (e) => ageBand(e, period.to));
  const concernCounts = countBy(registrations, (e) => e.categories);
  const deregLength = countBy(deregistrations, (e) => (e.deregisteredAt ? lengthBand(daysBetween(e.registeredAt, e.deregisteredAt)) : undefined));
  const currentLength = countBy(atEnd, (e) => lengthBand(daysBetween(e.registeredAt, period.to)));

  const meetings = data.meetings.filter((m) => inPeriod(m.scheduledAt, period));
  const held = (type: string) => meetings.filter((m) => m.type === type && m.status === 'held').length;
  const pending = (type: string) => meetings.filter((m) => m.type === type && m.status === 'scheduled' && localDateOf(m.scheduledAt) >= today).length;
  const cppmsHeld = held('cppm') + held('pre-birth-cppm') + held('cppm-review');

  const byMonth: ChartSpec = {
    id: 'cp-by-month',
    kind: 'bar',
    title: t('reports.cp.charts.byMonthTitle'),
    summary: t('reports.cp.charts.byMonthSummary', { registrations: registrations.length, deregistrations: deregistrations.length, months: months.length }),
    categories: months.map((m) => m.short),
    categoryLabels: months.map((m) => m.long),
    series: [
      { key: 'registrations', label: t('reports.cp.charts.registrations'), colour: scaleColour(0) },
      { key: 'deregistrations', label: t('reports.cp.charts.deregistrations'), colour: scaleColour(1) },
    ],
    values: [months.map((m) => registrations.filter((e) => e.registeredAt.slice(0, 7) === m.key).length), months.map((m) => deregistrations.filter((e) => e.deregisteredAt?.slice(0, 7) === m.key).length)],
    xLabel: t('reports.cp.charts.month'),
    yLabel: t('reports.cp.charts.children'),
  };

  const overTime: ChartSpec = {
    id: 'cp-register-over-time',
    kind: 'line',
    title: t('reports.cp.charts.overTimeTitle'),
    summary: t('reports.cp.charts.overTimeSummary', { count: atEnd.length, date: endLabel }),
    categories: months.map((m) => m.short),
    categoryLabels: months.map((m) => t('reports.cp.charts.overTimeCategory', { month: m.long, date: formatDate(m.end) })),
    series: [{ key: 'on-register', label: t('reports.cp.charts.onRegister'), colour: scaleColour(0) }],
    values: [months.map((m) => onRegister(m.end).length)],
    xLabel: t('reports.cp.charts.monthEnd'),
    yLabel: t('reports.cp.charts.children'),
  };

  const ageTable: TableSpec = {
    id: 'cp-age',
    columns: [t('reports.cp.columns.ageAtEnd'), t('reports.cp.columns.children')],
    numeric: [1],
    rows: [...AGE_BANDS.map((b): [string, number] => [ageBandLabel(b), ageCounts.get(b) ?? 0]), ...[...ageCounts.entries()].filter(([k]) => !(AGE_BANDS as readonly string[]).includes(k)).map(([k, v]): [string, number] => [ageBandLabel(k), v])],
  };

  const concernTable: TableSpec = {
    id: 'cp-concerns',
    columns: [t('reports.cp.columns.concern'), t('reports.cp.columns.childrenRegistered')],
    numeric: [1],
    rows: CP_REGISTER_CATEGORIES.map((c, i) => ({ c, i, n: concernCounts.get(c) ?? 0 }))
      .sort((a, b) => b.n - a.n || a.i - b.i)
      .map(({ c, n }) => [CP_REGISTER_CATEGORY_LABELS[c], n]),
  };

  const historyTable: TableSpec = {
    id: 'cp-history',
    columns: [t('reports.cp.columns.history'), t('reports.cp.columns.children')],
    numeric: [1],
    rows: [
      [t('reports.cp.history.first'), historyCounts.get('first') ?? 0],
      [t('reports.cp.history.within'), historyCounts.get('within') ?? 0],
      [t('reports.cp.history.after'), historyCounts.get('after') ?? 0],
    ],
  };

  const lengthDeregTable: TableSpec = {
    id: 'cp-length-dereg',
    title: t('reports.cp.tables.lengthDeregTitle'),
    columns: [t('reports.cp.columns.lengthOfRegistration'), t('reports.cp.columns.children')],
    numeric: [1],
    rows: LENGTH_BANDS.map((b) => [lengthBandLabel(b), deregLength.get(b) ?? 0]),
  };

  const lengthCurrentTable: TableSpec = {
    id: 'cp-length-current',
    title: t('reports.cp.tables.lengthCurrentTitle', { date: endLabel }),
    columns: [t('reports.cp.columns.timeOnRegister'), t('reports.cp.columns.children')],
    numeric: [1],
    rows: LENGTH_BANDS.map((b) => [lengthBandLabel(b), currentLength.get(b) ?? 0]),
  };

  const meetingTable: TableSpec = {
    id: 'cp-meetings',
    columns: [t('reports.cp.columns.meeting'), t('reports.cp.columns.held'), t('reports.cp.columns.scheduled')],
    numeric: [1, 2],
    rows: [
      [t('reports.cp.meetings.ird'), held('ird'), pending('ird')],
      [t('reports.cp.meetings.cppm'), held('cppm'), pending('cppm')],
      [t('reports.cp.meetings.preBirth'), held('pre-birth-cppm'), pending('pre-birth-cppm')],
      [t('reports.cp.meetings.review'), held('cppm-review'), pending('cppm-review')],
      [t('reports.cp.meetings.coreGroup'), held('core-group'), pending('core-group')],
    ],
  };

  const sections: ReportSection[] = [
    { id: 'by-month', title: t('reports.cp.sections.byMonth'), note: t('reports.cp.sections.byMonthNote'), chart: byMonth, tables: [] },
    { id: 'over-time', title: t('reports.cp.sections.overTime'), note: t('reports.cp.sections.overTimeNote'), chart: overTime, tables: [] },
    { id: 'age', title: t('reports.cp.sections.age', { date: endLabel }), note: t('reports.cp.sections.ageNote'), tables: [ageTable] },
    { id: 'concerns', title: t('reports.cp.sections.concerns'), note: t('reports.cp.sections.concernsNote'), tables: [concernTable] },
    { id: 'history', title: t('reports.cp.sections.history'), note: t('reports.cp.sections.historyNote'), tables: [historyTable] },
    { id: 'length', title: t('reports.cp.sections.length'), tables: [lengthDeregTable, lengthCurrentTable] },
    { id: 'meetings', title: t('reports.cp.sections.meetings'), note: t('reports.cp.sections.meetingsNote'), tables: [meetingTable] },
  ];

  return {
    kind: 'cp',
    title: t('reports.cp.title'),
    lede: t('reports.cp.lede'),
    period,
    classification: 'official-sensitive',
    meta: [t('reports.cp.meta.period', { period: period.label, date: endLabel }), t('reports.cp.meta.computed', { dateTime: formatDateTime(now), records: cps.length, entries: entries.length }), t('reports.meta.verify')],
    verify: [t('reports.cp.verify.publication')],
    sources: [t('reports.cp.sources.statistics2025'), t('reports.cp.sources.statistics2024')],
    figures: [
      { id: 'registrations', label: t('reports.cp.figures.registrations'), value: String(registrations.length), note: t('reports.cp.figures.registrationsNote', { count: historyCounts.get('first') ?? 0 }) },
      { id: 'deregistrations', label: t('reports.cp.figures.deregistrations'), value: String(deregistrations.length) },
      { id: 'at-end', label: t('reports.cp.figures.atEnd', { date: endLabel }), value: String(atEnd.length) },
      { id: 'pre-birth', label: t('reports.cp.figures.preBirth'), value: String(preBirth) },
      { id: 're-registrations', label: t('reports.cp.figures.reRegistrations'), value: String(historyCounts.get('within') ?? 0) },
      { id: 'cppms', label: t('reports.cp.figures.cppms'), value: String(cppmsHeld) },
    ],
    sections,
    activity: registrations.length + deregistrations.length + atEnd.length,
  };
}
