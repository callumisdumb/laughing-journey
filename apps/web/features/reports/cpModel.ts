/**
 * Child Protection Register statistics, computed from the register block of every child protection
 * process. Children are counted, not cases: a sibling group registered at one CPPM counts once per child.
 */
import { CP_REGISTER_CATEGORIES, CP_REGISTER_CATEGORY_LABELS, daysBetween, formatDate, formatDateTime, localDateOf, type CpProcess, type CpRegisterCategory, type Dataset, type Person } from '@mas/domain';
import { personById } from '@/lib/selectors';
import { ageOn } from './helpers';
import { countBy, plural, scaleColour, type ChartSpec, type ReportModel, type ReportSection, type TableSpec } from './model';
import { inPeriod, monthsIn, type Period } from './period';

const AGE_BANDS = ['Unborn', 'Under 1', '1 to 4', '5 to 10', '11 to 15', '16 and over'] as const;
const LENGTH_BANDS = ['Under 6 months', '6 months to under 1 year', '1 year to under 2 years', '2 years or more'] as const;

interface Entry {
  personId: string;
  person: Person | undefined;
  registeredAt: string;
  deregisteredAt?: string;
  categories: CpRegisterCategory[];
  preBirth: boolean;
}

function ageBand(e: Entry, isoDate: string): string {
  const p = e.person;
  if (!p) return 'Not recorded';
  if (!p.dateOfBirth || p.dateOfBirth > isoDate) return 'Unborn';
  const years = ageOn(p.dateOfBirth, isoDate);
  if (years < 1) return 'Under 1';
  if (years <= 4) return '1 to 4';
  if (years <= 10) return '5 to 10';
  if (years <= 15) return '11 to 15';
  return '16 and over';
}

function lengthBand(days: number): string {
  if (days < 182) return LENGTH_BANDS[0];
  if (days < 365) return LENGTH_BANDS[1];
  if (days < 730) return LENGTH_BANDS[2];
  return LENGTH_BANDS[3];
}

export function cpModel(data: Dataset, now: Date, period: Period): ReportModel {
  const today = localDateOf(now);
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
    title: 'Registrations and de-registrations by month',
    summary: `Registrations and de-registrations by month: ${plural(registrations.length, 'registration')} and ${plural(deregistrations.length, 'de-registration')} over ${plural(months.length, 'month')}.`,
    categories: months.map((m) => m.short),
    categoryLabels: months.map((m) => m.long),
    series: [
      { key: 'registrations', label: 'Registrations', colour: scaleColour(0) },
      { key: 'deregistrations', label: 'De-registrations', colour: scaleColour(1) },
    ],
    values: [months.map((m) => registrations.filter((e) => e.registeredAt.slice(0, 7) === m.key).length), months.map((m) => deregistrations.filter((e) => e.deregisteredAt?.slice(0, 7) === m.key).length)],
    xLabel: 'Month',
    yLabel: 'Children',
  };

  const overTime: ChartSpec = {
    id: 'cp-register-over-time',
    kind: 'line',
    title: 'Children on the register at each month end',
    summary: `Children on the register at each month end: ${atEnd.length} at ${formatDate(period.to)}.`,
    categories: months.map((m) => m.short),
    categoryLabels: months.map((m) => `${m.long} (at ${formatDate(m.end)})`),
    series: [{ key: 'on-register', label: 'Children on the register', colour: scaleColour(0) }],
    values: [months.map((m) => onRegister(m.end).length)],
    xLabel: 'Month end',
    yLabel: 'Children',
  };

  const ageTable: TableSpec = {
    id: 'cp-age',
    columns: ['Age at period end', 'Children'],
    numeric: [1],
    rows: [...AGE_BANDS.map((b): [string, number] => [b, ageCounts.get(b) ?? 0]), ...[...ageCounts.entries()].filter(([k]) => !(AGE_BANDS as readonly string[]).includes(k)).map(([k, v]): [string, number] => [k, v])],
  };

  const concernTable: TableSpec = {
    id: 'cp-concerns',
    columns: ['Concern identified at registration', 'Children registered'],
    numeric: [1],
    rows: CP_REGISTER_CATEGORIES.map((c, i) => ({ c, i, n: concernCounts.get(c) ?? 0 }))
      .sort((a, b) => b.n - a.n || a.i - b.i)
      .map(({ c, n }) => [CP_REGISTER_CATEGORY_LABELS[c], n]),
  };

  const historyTable: TableSpec = {
    id: 'cp-history',
    columns: ['Registration history', 'Children'],
    numeric: [1],
    rows: [
      ['Registered for the first time', historyCounts.get('first') ?? 0],
      ['Re-registered within two years of de-registration', historyCounts.get('within') ?? 0],
      ['Re-registered more than two years after de-registration', historyCounts.get('after') ?? 0],
    ],
  };

  const lengthDeregTable: TableSpec = {
    id: 'cp-length-dereg',
    title: 'Children de-registered in the period, by length of registration',
    columns: ['Length of registration', 'Children'],
    numeric: [1],
    rows: LENGTH_BANDS.map((b) => [b, deregLength.get(b) ?? 0]),
  };

  const lengthCurrentTable: TableSpec = {
    id: 'cp-length-current',
    title: `Children on the register at ${formatDate(period.to)}, by time on the register so far`,
    columns: ['Time on the register', 'Children'],
    numeric: [1],
    rows: LENGTH_BANDS.map((b) => [b, currentLength.get(b) ?? 0]),
  };

  const meetingTable: TableSpec = {
    id: 'cp-meetings',
    columns: ['Meeting', 'Held in period', 'Scheduled, not yet held'],
    numeric: [1, 2],
    rows: [
      ['Inter-agency Referral Discussion', held('ird'), pending('ird')],
      ['Initial CPPM', held('cppm'), pending('cppm')],
      ['Pre-birth CPPM', held('pre-birth-cppm'), pending('pre-birth-cppm')],
      ['Review CPPM', held('cppm-review'), pending('cppm-review')],
      ['Core group', held('core-group'), pending('core-group')],
    ],
  };

  const sections: ReportSection[] = [
    { id: 'by-month', title: 'Registrations and de-registrations by month', note: 'Dated from the register entry on each child protection process.', chart: byMonth, tables: [] },
    { id: 'over-time', title: 'The register over time', note: 'Children whose registration was open at the end of each month in the period.', chart: overTime, tables: [] },
    { id: 'age', title: `Children on the register at ${formatDate(period.to)}, by age`, note: 'Age on the reference date. Unborn babies are counted where the expected date of delivery is after the reference date.', tables: [ageTable] },
    { id: 'concerns', title: 'Concerns identified at registration', note: 'From the register categories recorded at the CPPM. A child can have more than one concern, so the column can add up to more than the number of registrations.', tables: [concernTable] },
    { id: 'history', title: 'Previous registrations', note: 'A re-registration is a child registered again after an earlier de-registration; within two years follows the national publication.', tables: [historyTable] },
    { id: 'length', title: 'Length of time on the register', tables: [lengthDeregTable, lengthCurrentTable] },
    { id: 'meetings', title: 'Child protection meetings', note: 'Meetings marked held in the meeting record.', tables: [meetingTable] },
  ];

  return {
    kind: 'cp',
    title: 'Child Protection Register statistics',
    lede: "The register figures collected each year for the Children's Social Work Statistics, computed from the register entry on every child protection process in the record store.",
    period,
    classification: 'official-sensitive',
    meta: [
      `Period ${period.label}, reference date ${formatDate(period.to)}.`,
      `Computed ${formatDateTime(now)} from the local record store: ${plural(cps.length, 'child protection record')}, ${plural(entries.length, 'register entry', 'register entries')} across all time.`,
      'Field set to verify against the current template.',
    ],
    verify: [
      "The Children's Social Work Statistics publish registrations, de-registrations, the register at 31 July, concerns at registration, unborn children, children registered before (with two years since the last de-registration as the dividing line) and length of registration. The age bands and length bands used here are the platform's own until the current publication tables are checked.",
    ],
    sources: [
      "Children's Social Work Statistics: Child Protection 2024-25, Children on the child protection register (gov.scot).",
      "Children's Social Work Statistics: Child Protection 2023-24 (gov.scot), for the concern categories and the length of registration finding.",
    ],
    figures: [
      { id: 'registrations', label: 'Registrations', value: String(registrations.length), note: `${historyCounts.get('first') ?? 0} for the first time` },
      { id: 'deregistrations', label: 'De-registrations', value: String(deregistrations.length) },
      { id: 'at-end', label: `On the register at ${formatDate(period.to)}`, value: String(atEnd.length) },
      { id: 'pre-birth', label: 'Pre-birth registrations', value: String(preBirth) },
      { id: 're-registrations', label: 'Re-registrations within two years', value: String(historyCounts.get('within') ?? 0) },
      { id: 'cppms', label: 'CPPMs held', value: String(cppmsHeld) },
    ],
    sections,
    activity: registrations.length + deregistrations.length + atEnd.length,
  };
}
