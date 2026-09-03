/**
 * MAPPA annual report: Annex 3 Tables 1 to 9 of the MAPPA National Guidance, computed from the
 * record store for a year to 31 March. The underlying records are restricted, so this model carries
 * counts only: no names, references or dates that could identify an offender. The table wording
 * lives in mappaAnnex3.ts; every figure here is keyed on a row id, never on the label.
 */
import { dueDateFor, findClockRule, formatDate, formatDateTime, localDateOf, type ClockRule, type Config, type Dataset, type MappaProcess } from '@mas/domain';
import { DATA_NOT_HELD, MAPPA_ANNEX3_TABLES, type AnnexTable } from './mappaAnnex3';
import { plural, scaleColour, sum, type ChartSpec, type ReportModel, type ReportSection, type TableSpec } from './model';
import { inPeriod, type Period } from './period';

type Level = 1 | 2 | 3;
type Category = 1 | 2 | 3;
type Cell = string | number;
type Order = MappaProcess['detail']['orders'][number];
const LEVELS: Level[] = [1, 2, 3];
const CATEGORIES: Category[] = [1, 2, 3];

function levelAt(p: MappaProcess, date: string): Level {
  const entries = p.detail.levelHistory.filter((h) => h.at <= date).sort((a, b) => (a.at < b.at ? -1 : 1));
  const last = entries[entries.length - 1];
  return last ? last.level : 1;
}

function openOn(p: MappaProcess, date: string): boolean {
  return localDateOf(p.openedAt) <= date && (!p.closedAt || localDateOf(p.closedAt) > date);
}

function openDuring(p: MappaProcess, period: Period): boolean {
  return localDateOf(p.openedAt) <= period.to && (!p.closedAt || localDateOf(p.closedAt) >= period.from);
}

function intervalText(rule: ClockRule | undefined): string {
  if (!rule) return 'no rule configured';
  return `${rule.amount} ${rule.unit.replace('-', ' ')}`;
}

/** In custody on a calendar date: before the recorded release, or flagged in custody with no release recorded. */
function inCustodyOn(p: MappaProcess, date: string): boolean {
  const released = p.detail.custody.releasedAt;
  if (released) return released > date;
  return p.flags['inCustody'] === true;
}

/** On licence on a calendar date: released, with a licence that has not yet expired. */
function onLicenceOn(p: MappaProcess, date: string): boolean {
  const { releasedAt, licenceExpiresAt } = p.detail.custody;
  return Boolean(releasedAt && releasedAt <= date && licenceExpiresAt && licenceExpiresAt >= date);
}

/** An order is in force from the day it was made until it expires, unless it has been discharged. */
function orderInForceOn(o: Order, date: string): boolean {
  return o.status !== 'discharged' && o.madeAt <= date && (!o.expiresAt || o.expiresAt >= date);
}

/** An Annex 3 table with its cells keyed on the row id; a row with no cells reads "Data not held" in every column. */
function annexTableSpec(table: AnnexTable, cells: Record<string, Cell[]>): TableSpec {
  const width = table.columns.length - 1;
  return {
    id: `mappa-${table.id}`,
    columns: table.columns,
    numeric: table.columns.slice(1).map((_, i) => i + 1),
    rows: table.rows.map((row) => [row.label, ...(cells[row.id] ?? Array.from({ length: width }, () => DATA_NOT_HELD))]),
  };
}

export function mappaModel(data: Dataset, config: Config, now: Date, period: Period): ReportModel {
  const today = localDateOf(now);
  const end = period.to;
  const endLabel = formatDate(end);
  const mappas = data.processes.filter((p): p is MappaProcess => p.type === 'mappa');
  const ids = new Set(mappas.map((p) => p.id));
  const atEnd = mappas.filter((p) => openOn(p, end));
  const during = mappas.filter((p) => openDuring(p, period));
  const inCategory = (list: MappaProcess[], cat: Category) => list.filter((p) => p.detail.category === cat);
  const levelCount = (list: MappaProcess[], level: Level) => list.filter((p) => levelAt(p, end) === level).length;
  const rsosAtEnd = inCategory(atEnd, 1);
  const rsosDuring = inCategory(during, 1);
  const community = rsosAtEnd.filter((p) => !inCustodyOn(p, end));
  const grid = CATEGORIES.map((cat) => LEVELS.map((level) => levelCount(inCategory(atEnd, cat), level)));

  // Level 2 and Level 3 meetings feed the headline figures; Annex 3 has no meetings table.
  const meetings = data.meetings.filter((m) => (m.type === 'mappa-level2' || m.type === 'mappa-level3') && ids.has(m.processId));
  const heldIn = meetings.filter((m) => m.status === 'held' && inPeriod(m.scheduledAt, period));
  const rules: Record<2 | 3, ClockRule | undefined> = { 2: findClockRule(config.clockRules, 'mappa.level2.review'), 3: findClockRule(config.clockRules, 'mappa.level3.review') };
  let lateReviews = 0;
  for (const m of heldIn) {
    const rule = rules[m.type === 'mappa-level2' ? 2 : 3];
    if (!rule) continue;
    const due = localDateOf(dueDateFor(rule, m.scheduledAt, { bankHolidays: config.bankHolidays }));
    const next = meetings.filter((x) => x.processId === m.processId && x.status === 'held' && x.scheduledAt > m.scheduledAt).sort((a, b) => (a.scheduledAt < b.scheduledAt ? -1 : 1))[0];
    const onTime = Boolean(next && localDateOf(next.scheduledAt) <= due);
    if (!onTime && due < today) lateReviews += 1;
  }

  // Table 1. The breach row reads the notification compliance flag; missing reads the person's alerts.
  const personOf = (p: MappaProcess) => data.people.find((x) => x.id === p.subjectIds[0]);
  const missingAtEnd = community.filter((p) => personOf(p)?.alerts.some((a) => a.kind === 'missing' && a.from <= end && (!a.to || a.to >= end))).length;
  const sonrBreaches = rsosDuring.filter((p) => p.detail.sonr.subject && !p.detail.sonr.compliant).length;

  // Table 2. Orders on every MAPPA record, dated by the order itself.
  const orders = mappas.flatMap((p) => p.detail.orders);
  const inForce = (kind: Order['kind']) => orders.filter((o) => o.kind === kind && orderInForceOn(o, end)).length;
  const made = (kind: Order['kind']) => orders.filter((o) => o.kind === kind && inPeriod(o.madeAt, period)).length;
  const ordersInForce = orders.filter((o) => orderInForceOn(o, end)).length;

  // Tables 4 and 5.
  const patients = inCategory(atEnd, 2);
  const category3 = inCategory(atEnd, 3);
  const category3Referred = inCategory(mappas, 3).filter((p) => p.detail.referral && inPeriod(p.detail.referral.at, period)).length;

  // Table 6.
  const bySex = (sex: 'male' | 'female' | 'not-recorded') => community.filter((p) => (personOf(p)?.sex ?? 'not-recorded') === sex).length;

  // Table 7.
  const supervised = rsosAtEnd.filter((p) => p.detail.sonr.subject && onLicenceOn(p, end)).length;
  const sonrOnly = rsosAtEnd.filter((p) => p.detail.sonr.subject && !onLicenceOn(p, end)).length;

  // Table 9. A return to custody is a police custody event on a Category 1 record after the recorded release.
  const rsos = inCategory(mappas, 1);
  const releasedIn = rsosDuring.filter((p) => inPeriod(p.detail.custody.releasedAt, period)).length;
  const returned = data.events.filter((e) => {
    if (e.eventType !== 'police.custody' || !inPeriod(e.occurredAt, period)) return false;
    return rsos.some((p) => e.linkedProcessIds.includes(p.id) && Boolean(p.detail.custody.releasedAt) && localDateOf(e.occurredAt) > (p.detail.custody.releasedAt ?? ''));
  }).length;
  const licenceBreaches = sum(rsosDuring.map((p) => p.detail.licenceConditions.filter((l) => l.status === 'breached').length));

  const cells: Record<AnnexTable['id'], Record<string, Cell[]>> = {
    'table-1': { community: [community.length], 'per-100k': [DATA_NOT_HELD], breach: [sonrBreaches], wanted: [DATA_NOT_HELD], missing: [missingAtEnd] },
    'table-2': {
      'sopo-in-force': [inForce('sopo')],
      'sopo-made': [made('sopo')],
      'rsho-in-force': [inForce('rsho')],
      'rsho-made': [made('rsho')],
      'shpo-in-force': [inForce('shpo')],
      'shpo-made': [made('shpo')],
      'sro-in-force': [inForce('sro')],
      'sro-made': [made('sro')],
      'breach-convictions': [DATA_NOT_HELD],
    },
    'table-3': { rso: [...LEVELS.map((level) => levelCount(rsosAtEnd, level)), rsosAtEnd.length] },
    'table-4': { total: [patients.length], 'level-1': [levelCount(patients, 1)], 'level-2': [levelCount(patients, 2)], 'level-3': [levelCount(patients, 3)] },
    'table-5': { total: [category3.length], 'level-2': [levelCount(category3, 2)], 'level-3': [levelCount(category3, 3)], referred: [category3Referred] },
    'table-6': { male: [bySex('male')], female: [bySex('female')], 'not-recorded': [bySex('not-recorded')], total: [community.length] },
    'table-7': { supervision: [supervised], 'sonr-only': [sonrOnly], total: [supervised + sonrOnly] },
    'table-8': {},
    'table-9': { 'in-custody': [rsosAtEnd.length - community.length], released: [releasedIn], returned: [returned], 'licence-breaches': [licenceBreaches] },
  };

  const notes: Record<AnnexTable['id'], string> = {
    'table-1': `In the community means a Category 1 record open on ${endLabel} with the offender not in custody. The rate per 100,000 needs the mid-year population estimate, which the record store does not hold. The breach row reads the notification compliance flag, missing reads the person's alerts, and wanted is not recorded.`,
    'table-2': 'From the civil order register on each MAPPA record: an order is in force from the day it was made until it expires or is discharged, and made in the year by the date of the order. Convictions for breach are not recorded.',
    'table-3': `Level on ${endLabel} from the level history; an offender is Level 1 until the first multi-agency level decision. Review intervals from the clock rules in Admin: Level 2 every ${intervalText(rules[2])}, Level 3 every ${intervalText(rules[3])}. Review interval to verify against the current MAPPA National Guidance.`,
    'table-4': `Category 2 records open on ${endLabel}, by level. Whether a patient is in hospital or in the community is not recorded.`,
    'table-5': `Category 3 records open on ${endLabel}, by level; referrals dated by the referral for multi-agency management.`,
    'table-6': 'Sex as recorded on the person record, for the RSOs in the community counted in Table 1.',
    'table-7': `On licence means released with a licence that has not expired on ${endLabel}.`,
    'table-8': 'The record store holds no charge or conviction data for further offending. Every cell reads Data not held until a police or Crown Office feed supplies it.',
    'table-9': 'Returns to custody are police custody events linked to a Category 1 record after the recorded release; licence breaches count breached conditions on records managed in the year.',
  };

  const chart: ChartSpec = {
    id: 'mappa-grid',
    kind: 'stacked',
    title: `Offenders by level and category on ${endLabel}`,
    summary: `Offenders by level and category on ${endLabel}: ${plural(atEnd.length, 'offender')} managed under MAPPA, ${LEVELS.map((l) => `${sum(grid.map((row) => row[l - 1] ?? 0))} at Level ${l}`).join(', ')}.`,
    categories: LEVELS.map((l) => `Level ${l}`),
    series: CATEGORIES.map((cat, i) => ({ key: `cat-${cat}`, label: `Category ${cat}`, colour: scaleColour(i) })),
    values: grid,
    xLabel: 'Management level',
    yLabel: 'Offenders',
  };

  const sections: ReportSection[] = MAPPA_ANNEX3_TABLES.map((t) => ({
    id: t.id,
    title: `Table ${t.number}: ${t.title}`,
    note: notes[t.id],
    ...(t.id === 'table-3' ? { chart } : {}),
    tables: [annexTableSpec(t, t.source === 'not-held' ? {} : cells[t.id])],
  }));

  const extracted = MAPPA_ANNEX3_TABLES.filter((t) => t.confidence === 'extract').map((t) => t.number).join(', ');
  const reconstructed = MAPPA_ANNEX3_TABLES.filter((t) => t.confidence === 'reconstructed').map((t) => t.number).join(', ');

  return {
    kind: 'mappa',
    title: 'MAPPA annual report counts',
    lede: 'Counts only, never names. The MAPPA records behind these figures are restricted and stay on their distribution list; this report and its print pack carry no identifying detail.',
    period,
    classification: 'official-sensitive',
    meta: [
      `Period ${period.label}.`,
      `Computed ${formatDateTime(now)} from the local record store: ${plural(mappas.length, 'MAPPA record')} in total, ${during.length} managed at some point in the period.`,
      'Field set High: Annex 3 Tables 1 to 9 as the MAPPA National Guidance requires, for the year 1 April to 31 March. Every figure is a count; no offender is named.',
    ],
    verify: [
      `Table wording only: the field set is confirmed, but the titles and rows of Tables ${extracted} were read from search extracts of published Strategic Oversight Group reports and Tables ${reconstructed} are placed from the sequence with reconstructed wording. Every label is a placeholder in one file, to be replaced word for word when the supplied Annex 3 text arrives.`,
      'Review interval to verify against the current MAPPA National Guidance: the seeded intervals are 12 weeks at Level 2 and 6 weeks at Level 3.',
    ],
    sources: [
      'MAPPA National Guidance (2022 refresh), Annex 3: Annual Reports (gov.scot).',
      'Lanarkshire MAPPA Annual Reports 2024 and 2025, statistical information (South Lanarkshire Council); Tayside MAPPA Annual Report 2024-25 (Perth and Kinross Council); Highland and Islands MAPPA Annual Report 2024-25 (Orkney Islands Council).',
      'MAPPA in Scotland: national overview reports 2023-24 (Appendix C, MAPPA National Data) and 2024-25 (gov.scot).',
    ],
    figures: [
      { id: 'at-end', label: `Offenders managed at ${endLabel}`, value: String(atEnd.length) },
      { id: 'l2', label: 'Level 2 meetings held', value: String(heldIn.filter((m) => m.type === 'mappa-level2').length) },
      { id: 'l3', label: 'Level 3 (MAPPP) meetings held', value: String(heldIn.filter((m) => m.type === 'mappa-level3').length) },
      { id: 'late', label: 'Reviews late', value: String(lateReviews), note: lateReviews === 0 ? 'none in period' : undefined },
      { id: 'orders', label: `Civil orders in force at ${endLabel}`, value: String(ordersInForce), note: ordersInForce === 0 ? 'none on the register' : undefined },
      { id: 'sonr', label: 'Notification requirement breaches', value: String(sonrBreaches), note: sonrBreaches === 0 ? 'none in period' : undefined },
    ],
    sections,
    activity: during.length,
  };
}
