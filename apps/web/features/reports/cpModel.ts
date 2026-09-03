/**
 * Child Protection Register statistics, computed from the register block of every child protection
 * process. Children are counted, not cases: a sibling group registered at one CPPM counts once per child.
 */
import { CP_CONCERNS, CP_DEREGISTRATION_REASONS, cpConcernLabel, cpDeregistrationReasonLabel, daysBetween, formatDate, formatDateTime, localDateOf, type CpConcern, type CpDeregistrationReason, type CpProcess, type Dataset, type Person } from '@mas/domain';
import { formatNumber, t, tKey } from '@mas/messages';
import { personById } from '@/lib/selectors';
import { ageOn } from './helpers';
import { countBy, scaleColour, type ChartSpec, type ReportModel, type ReportSection, type TableSpec } from './model';
import { inPeriod, monthsIn, type Period } from './period';

/** Age bands in table order; the wording comes from the catalogue by band id. */
/**
 * Age and sex bands as Children's Social Work Statistics: Child Protection prints them. The
 * register is counted at 31 July; the publication has no under-1 band, and carries an Unknown row.
 */
const AGE_BANDS = ['unborn', 'zeroToFour', 'fiveToTen', 'elevenToFifteen', 'sixteenAndOver', 'unknown'] as const;
type AgeBand = (typeof AGE_BANDS)[number];
const SEX_ROWS = ['male', 'female', 'unborn', 'unknown'] as const;
type SexRow = (typeof SEX_ROWS)[number];
/** Length of registration bands, with the publication's row for a registration with no date. */
const LENGTH_BANDS = ['underSixMonths', 'sixMonthsToOneYear', 'oneToEighteenMonths', 'eighteenMonthsToTwoYears', 'twoYearsOrMore', 'noDateInformation'] as const;
type LengthBand = (typeof LENGTH_BANDS)[number];

/** Time since the child's last de-registration, for registrations in the year. */
const SINCE_BANDS = ['never', 'beforeTimeUnknown', 'underSixMonths', 'sixMonthsToOneYear', 'oneToEighteenMonths', 'eighteenMonthsToTwoYears', 'twoYearsOrMore', 'unknownWhether'] as const;
type SinceBand = (typeof SINCE_BANDS)[number];

const ageBandLabel = (band: AgeBand) => tKey(`reports.cp.ageBands.${band}`);
const lengthBandLabel = (band: LengthBand) => tKey(`reports.cp.lengthBands.${band}`);
const sinceBandLabel = (band: SinceBand) => tKey(`reports.cp.sinceBands.${band}`);
const sexRowLabel = (row: SexRow) => tKey(`reports.cp.sexRows.${row}`);

interface Entry {
  personId: string;
  processId: string;
  person: Person | undefined;
  registeredAt: string;
  deregisteredAt?: string;
  concerns: CpConcern[];
  deregistrationReason?: CpDeregistrationReason;
  preBirth: boolean;
}

function ageBand(e: Entry, isoDate: string): AgeBand {
  const p = e.person;
  if (!p) return 'unknown';
  if (!p.dateOfBirth || p.dateOfBirth > isoDate) return 'unborn';
  const years = ageOn(p.dateOfBirth, isoDate);
  if (years <= 4) return 'zeroToFour';
  if (years <= 10) return 'fiveToTen';
  if (years <= 15) return 'elevenToFifteen';
  return 'sixteenAndOver';
}

function sexRow(e: Entry, isoDate: string): SexRow {
  const p = e.person;
  if (!p) return 'unknown';
  if (!p.dateOfBirth || p.dateOfBirth > isoDate) return 'unborn';
  if (p.sex === 'male' || p.sex === 'female') return p.sex;
  return 'unknown';
}

function lengthBand(days: number | undefined): LengthBand {
  if (days === undefined) return 'noDateInformation';
  if (days < 182) return 'underSixMonths';
  if (days < 365) return 'sixMonthsToOneYear';
  if (days < 548) return 'oneToEighteenMonths';
  if (days < 730) return 'eighteenMonthsToTwoYears';
  return 'twoYearsOrMore';
}

function sinceBand(days: number | undefined, everRegistered: boolean): SinceBand {
  if (!everRegistered) return 'never';
  if (days === undefined) return 'beforeTimeUnknown';
  if (days < 182) return 'underSixMonths';
  if (days < 365) return 'sixMonthsToOneYear';
  if (days < 548) return 'oneToEighteenMonths';
  if (days < 730) return 'eighteenMonthsToTwoYears';
  return 'twoYearsOrMore';
}

export function cpModel(data: Dataset, now: Date, period: Period, childPopulation: number): ReportModel {
  const today = localDateOf(now);
  const endLabel = formatDate(period.to);
  const cps = data.processes.filter((p): p is CpProcess => p.type === 'cp');
  const entries: Entry[] = cps.flatMap((p) => {
    const r = p.detail.register;
    if (!r) return [];
    return p.subjectIds.map((id) => {
      const person = personById(data, id);
      const bornAfter = person ? !person.dateOfBirth || person.dateOfBirth > r.registeredAt : false;
      return { personId: id, processId: p.id, person, registeredAt: r.registeredAt, deregisteredAt: r.deregisteredAt, concerns: r.concerns, deregistrationReason: r.deregistrationReason, preBirth: Boolean(p.detail.preBirth) || bornAfter };
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
  const sexCounts = countBy(atEnd, (e) => sexRow(e, period.to));
  const concernCounts = countBy(registrations, (e) => e.concerns);
  const deregLength = countBy(deregistrations, (e) => (e.deregisteredAt ? lengthBand(daysBetween(e.registeredAt, e.deregisteredAt)) : lengthBand(undefined)));
  const currentLength = countBy(atEnd, (e) => lengthBand(daysBetween(e.registeredAt, period.to)));
  const deregReasons = countBy(deregistrations, (e) => (e.deregistrationReason ? [e.deregistrationReason] : ['reason-not-known']));

  // Time since the child's last de-registration, for registrations in the year.
  const sinceCounts = countBy(registrations, (e) => {
    const priorEnds = entries.flatMap((o) => (o !== e && o.personId === e.personId && o.deregisteredAt && o.deregisteredAt <= e.registeredAt ? [o.deregisteredAt] : [])).sort().reverse();
    const everBefore = entries.some((o) => o !== e && o.personId === e.personId && o.registeredAt < e.registeredAt);
    const last = priorEnds[0];
    return [sinceBand(last ? daysBetween(last, e.registeredAt) : undefined, everBefore)];
  });

  const meetings = data.meetings.filter((m) => inPeriod(m.scheduledAt, period));
  const held = (type: string) => meetings.filter((m) => m.type === type && m.status === 'held').length;
  const pending = (type: string) => meetings.filter((m) => m.type === type && m.status === 'scheduled' && localDateOf(m.scheduledAt) >= today).length;
  const cppmsHeld = held('cppm') + held('pre-birth-cppm') + held('cppm-review');

  /**
   * The publication's linkage measure: a planning meeting counts as "without an IRD" where no IRD
   * was recorded in the 28 days PRECEDING the meeting. It counts backwards from the meeting, which
   * is the mirror of the cp.cppm.initial clock, and is the national proxy for whether the 28 day
   * route was followed.
   */
  const irds = data.meetings.filter((m) => m.type === 'ird');
  const planningMeetings = meetings.filter((m) => (m.type === 'cppm' || m.type === 'pre-birth-cppm') && m.status === 'held');
  const hasIrdWithin28Days = (meeting: { processId: string; scheduledAt: string }) =>
    irds.some((ird) => {
      if (ird.processId !== meeting.processId || ird.status !== 'held') return false;
      const gap = daysBetween(localDateOf(ird.scheduledAt), localDateOf(meeting.scheduledAt));
      return gap >= 0 && gap <= 28;
    });
  const cppmWithIrdWithin28Days = planningMeetings.filter(hasIrdWithin28Days).length;
  const cppmWithoutIrdWithin28Days = planningMeetings.length - cppmWithIrdWithin28Days;
  // A registration follows a planning meeting, so it inherits that meeting's IRD linkage.
  const registrationsFromPlanning = registrations.filter((e) => planningMeetings.some((m) => m.processId === e.processId));
  const registrationsWithIrd = registrationsFromPlanning.filter((e) => planningMeetings.filter((m) => m.processId === e.processId).some(hasIrdWithin28Days)).length;
  const conversionRate = planningMeetings.length === 0 ? '0.0' : ((registrationsFromPlanning.length / planningMeetings.length) * 100).toFixed(1);
  const rate = (n: number) => (childPopulation === 0 ? '0.0' : ((n / childPopulation) * 1000).toFixed(1));

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

  const pct = (n: number) => (atEnd.length === 0 ? '0.0' : ((n / atEnd.length) * 100).toFixed(1));

  const sexTable: TableSpec = {
    id: 'cp-sex',
    title: t('reports.cp.tables.sexTitle', { date: endLabel }),
    columns: [t('reports.cp.columns.sex'), t('reports.cp.columns.children'), t('reports.cp.columns.percentage')],
    numeric: [1, 2],
    rows: [
      ...SEX_ROWS.map((r): [string, number, string] => [sexRowLabel(r), sexCounts.get(r) ?? 0, pct(sexCounts.get(r) ?? 0)]),
      [t('reports.cp.rows.total'), atEnd.length, pct(atEnd.length)],
    ],
  };

  // The publication reports the register as a rate per 1,000 children aged 0 to 17, using NRS
  // mid-year population estimates. The denominator here is a fictional Clydeshore figure.
  const rateTable: TableSpec = {
    id: 'cp-rate',
    columns: [t('reports.cp.columns.measure'), t('reports.cp.columns.children'), t('reports.cp.columns.ratePerThousand')],
    numeric: [1, 2],
    rows: [
      [t('reports.cp.rows.onRegisterAt', { date: endLabel }), atEnd.length, rate(atEnd.length)],
      [t('reports.cp.rows.registrationsInYear'), registrations.length, rate(registrations.length)],
      [t('reports.cp.rows.deregistrationsInYear'), deregistrations.length, rate(deregistrations.length)],
    ],
  };

  /**
   * The publication's Table 1.3a: IRDs, planning meetings and registrations, with the linkage
   * measure that counts an IRD in the 28 days preceding the planning meeting.
   */
  const linkageTable: TableSpec = {
    id: 'cp-linkage',
    columns: [t('reports.cp.columns.measure'), t('reports.cp.columns.count'), t('reports.cp.columns.ratePerThousand')],
    numeric: [1, 2],
    rows: [
      [t('reports.cp.linkage.irds'), irds.filter((m) => m.status === 'held' && inPeriod(m.scheduledAt, period)).length, rate(irds.filter((m) => m.status === 'held' && inPeriod(m.scheduledAt, period)).length)],
      [t('reports.cp.linkage.planningMeetings'), planningMeetings.length, rate(planningMeetings.length)],
      [t('reports.cp.linkage.withIrd'), cppmWithIrdWithin28Days, ''],
      [t('reports.cp.linkage.withoutIrd'), cppmWithoutIrdWithin28Days, ''],
      [t('reports.cp.linkage.registrations'), registrationsFromPlanning.length, rate(registrationsFromPlanning.length)],
      [t('reports.cp.linkage.registrationsWithIrd'), registrationsWithIrd, ''],
      [t('reports.cp.linkage.registrationsWithoutIrd'), registrationsFromPlanning.length - registrationsWithIrd, ''],
    ],
  };

  const sinceTable: TableSpec = {
    id: 'cp-since',
    columns: [t('reports.cp.columns.timeSinceLast'), t('reports.cp.columns.children')],
    numeric: [1],
    rows: [
      ...SINCE_BANDS.map((b): [string, number] => [sinceBandLabel(b), sinceCounts.get(b) ?? 0]),
      [t('reports.cp.rows.total'), registrations.length],
    ],
  };

  const reasonTable: TableSpec = {
    id: 'cp-dereg-reasons',
    title: t('reports.cp.tables.reasonTitle'),
    columns: [t('reports.cp.columns.reason'), t('reports.cp.columns.children')],
    numeric: [1],
    rows: CP_DEREGISTRATION_REASONS.map((r) => [cpDeregistrationReasonLabel(r), deregReasons.get(r) ?? 0]),
  };

  const ageTable: TableSpec = {
    id: 'cp-age',
    title: t('reports.cp.tables.ageTitle', { date: endLabel }),
    columns: [t('reports.cp.columns.ageAtEnd'), t('reports.cp.columns.children'), t('reports.cp.columns.percentage')],
    numeric: [1, 2],
    rows: [
      ...AGE_BANDS.map((b): [string, number, string] => [ageBandLabel(b), ageCounts.get(b) ?? 0, pct(ageCounts.get(b) ?? 0)]),
      [t('reports.cp.rows.total'), atEnd.length, pct(atEnd.length)],
    ],
  };

  const concernTable: TableSpec = {
    id: 'cp-concerns',
    columns: [t('reports.cp.columns.concern'), t('reports.cp.columns.childrenRegistered')],
    numeric: [1],
    rows: CP_CONCERNS.map((c, i) => ({ c, i, n: concernCounts.get(c) ?? 0 }))
      .sort((a, b) => b.n - a.n || a.i - b.i)
      .map(({ c, n }) => [cpConcernLabel(c), n]),
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
    { id: 'age', title: t('reports.cp.sections.age', { date: endLabel }), note: t('reports.cp.sections.ageNote'), tables: [sexTable, ageTable] },
    { id: 'rate', title: t('reports.cp.sections.rate'), note: t('reports.cp.sections.rateNote', { population: formatNumber(childPopulation) }), tables: [rateTable] },
    { id: 'linkage', title: t('reports.cp.sections.linkage'), note: t('reports.cp.sections.linkageNote', { rate: conversionRate }), tables: [linkageTable] },
    { id: 'concerns', title: t('reports.cp.sections.concerns'), note: t('reports.cp.sections.concernsNote'), tables: [concernTable] },
    { id: 'history', title: t('reports.cp.sections.history'), note: t('reports.cp.sections.historyNote'), tables: [historyTable, sinceTable] },
    { id: 'length', title: t('reports.cp.sections.length'), tables: [lengthDeregTable, lengthCurrentTable, reasonTable] },
    { id: 'meetings', title: t('reports.cp.sections.meetings'), note: t('reports.cp.sections.meetingsNote'), tables: [meetingTable] },
  ];

  return {
    kind: 'cp',
    title: t('reports.cp.title'),
    lede: t('reports.cp.lede'),
    period,
    classification: 'official-sensitive',
    meta: [t('reports.cp.meta.period', { period: period.label, date: endLabel }), t('reports.cp.meta.computed', { dateTime: formatDateTime(now), records: cps.length, entries: entries.length }), t('reports.cp.meta.fieldSet')],
    verify: [t('reports.cp.verify.concerns'), t('reports.cp.verify.population')],
    sources: [t('reports.cp.sources.statistics2025'), t('reports.cp.sources.statistics2024')],
    figures: [
      { id: 'registrations', label: t('reports.cp.figures.registrations'), value: String(registrations.length), note: t('reports.cp.figures.registrationsNote', { count: historyCounts.get('first') ?? 0 }) },
      { id: 'deregistrations', label: t('reports.cp.figures.deregistrations'), value: String(deregistrations.length) },
      { id: 'at-end', label: t('reports.cp.figures.atEnd', { date: endLabel }), value: String(atEnd.length) },
      { id: 'pre-birth', label: t('reports.cp.figures.preBirth'), value: String(preBirth) },
      { id: 're-registrations', label: t('reports.cp.figures.reRegistrations'), value: String(historyCounts.get('within') ?? 0) },
      { id: 'cppms', label: t('reports.cp.figures.cppms'), value: String(cppmsHeld) },
      { id: 'ird-linked', label: t('reports.cp.figures.irdLinked'), value: String(cppmWithIrdWithin28Days), note: t('reports.cp.figures.irdLinkedNote', { total: planningMeetings.length }) },
    ],
    sections,
    activity: registrations.length + deregistrations.length + atEnd.length,
  };
}
