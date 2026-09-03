/**
 * MAPPA annual report: Annex 3 Tables 1 to 9 of the MAPPA National Guidance, computed from the
 * record store for a year to 31 March. The underlying records are restricted, so this model carries
 * counts only: no names, references or dates that could identify an offender. The table wording
 * lives in the catalogue under reports.mappaAnnex3 (see mappaAnnex3.ts); every figure here is
 * keyed on a row id, never on the label.
 */
import { dueDateFor, findClockRule, formatDate, formatDateTime, localDateOf, type ClockRule, type Config, type Dataset, type MappaProcess } from '@mas/domain';
import { t, tKey } from '@mas/messages';
import { MAPPA_ANNEX3_TABLES, annexColumns, annexRowLabel, annexTitle, dataNotHeld, type AnnexTable } from './mappaAnnex3';
import { messageSegment, scaleColour, sum, type ChartSpec, type ReportModel, type ReportSection, type TableSpec } from './model';
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
  if (!rule) return t('reports.mappa.interval.none');
  return t('reports.mappa.interval.text', { amount: rule.amount, unit: tKey(`reports.mappa.units.${messageSegment(rule.unit)}`) });
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
  const width = table.columnCount - 1;
  return {
    id: `mappa-${table.id}`,
    columns: annexColumns(table),
    numeric: Array.from({ length: width }, (_, i) => i + 1),
    rows: table.rows.map((row) => [annexRowLabel(table, row), ...(cells[row.id] ?? Array.from({ length: width }, () => dataNotHeld()))]),
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
    'table-1': { community: [community.length], 'per-100k': [dataNotHeld()], breach: [sonrBreaches], wanted: [dataNotHeld()], missing: [missingAtEnd] },
    'table-2': {
      'sopo-in-force': [inForce('sopo')],
      'sopo-made': [made('sopo')],
      'rsho-in-force': [inForce('rsho')],
      'rsho-made': [made('rsho')],
      'shpo-in-force': [inForce('shpo')],
      'shpo-made': [made('shpo')],
      'sro-in-force': [inForce('sro')],
      'sro-made': [made('sro')],
      'breach-convictions': [dataNotHeld()],
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
    'table-1': t('reports.mappa.notes.table1', { date: endLabel }),
    'table-2': t('reports.mappa.notes.table2'),
    'table-3': t('reports.mappa.notes.table3', { date: endLabel, level2: intervalText(rules[2]), level3: intervalText(rules[3]) }),
    'table-4': t('reports.mappa.notes.table4', { date: endLabel }),
    'table-5': t('reports.mappa.notes.table5', { date: endLabel }),
    'table-6': t('reports.mappa.notes.table6'),
    'table-7': t('reports.mappa.notes.table7', { date: endLabel }),
    'table-8': t('reports.mappa.notes.table8'),
    'table-9': t('reports.mappa.notes.table9'),
  };

  const chart: ChartSpec = {
    id: 'mappa-grid',
    kind: 'stacked',
    title: t('reports.mappa.chart.title', { date: endLabel }),
    summary: t('reports.mappa.chart.summary', { date: endLabel, count: atEnd.length, levels: LEVELS.map((l) => t('reports.mappa.chart.summaryLevel', { count: sum(grid.map((row) => row[l - 1] ?? 0)), level: l })).join(', ') }),
    categories: LEVELS.map((l) => t('reports.mappa.chart.level', { level: l })),
    series: CATEGORIES.map((cat, i) => ({ key: `cat-${cat}`, label: t('reports.mappa.chart.category', { category: cat }), colour: scaleColour(i) })),
    values: grid,
    xLabel: t('reports.mappa.chart.xLabel'),
    yLabel: t('reports.mappa.chart.yLabel'),
  };

  const sections: ReportSection[] = MAPPA_ANNEX3_TABLES.map((table) => ({
    id: table.id,
    title: t('reports.mappa.sections.tableTitle', { number: table.number, title: annexTitle(table) }),
    note: notes[table.id],
    ...(table.id === 'table-3' ? { chart } : {}),
    tables: [annexTableSpec(table, table.source === 'not-held' ? {} : cells[table.id])],
  }));

  const extracted = MAPPA_ANNEX3_TABLES.filter((table) => table.confidence === 'extract').map((table) => table.number).join(', ');
  const reconstructed = MAPPA_ANNEX3_TABLES.filter((table) => table.confidence === 'reconstructed').map((table) => table.number).join(', ');

  return {
    kind: 'mappa',
    title: t('reports.mappa.title'),
    lede: t('reports.mappa.lede'),
    period,
    classification: 'official-sensitive',
    meta: [t('reports.meta.period', { period: period.label }), t('reports.mappa.meta.computed', { dateTime: formatDateTime(now), records: mappas.length, managed: during.length }), t('reports.mappa.meta.fieldSet')],
    verify: [t('reports.mappa.verify.wording', { extracted, reconstructed }), t('reports.mappa.verify.interval')],
    sources: [t('reports.mappa.sources.guidance'), t('reports.mappa.sources.sogReports'), t('reports.mappa.sources.overview')],
    figures: [
      { id: 'at-end', label: t('reports.mappa.figures.atEnd', { date: endLabel }), value: String(atEnd.length) },
      { id: 'l2', label: t('reports.mappa.figures.l2'), value: String(heldIn.filter((m) => m.type === 'mappa-level2').length) },
      { id: 'l3', label: t('reports.mappa.figures.l3'), value: String(heldIn.filter((m) => m.type === 'mappa-level3').length) },
      { id: 'late', label: t('reports.mappa.figures.late'), value: String(lateReviews), note: lateReviews === 0 ? t('reports.figures.noneInPeriod') : undefined },
      { id: 'orders', label: t('reports.mappa.figures.orders', { date: endLabel }), value: String(ordersInForce), note: ordersInForce === 0 ? t('reports.mappa.figures.ordersNote') : undefined },
      { id: 'sonr', label: t('reports.mappa.figures.sonr'), value: String(sonrBreaches), note: sonrBreaches === 0 ? t('reports.figures.noneInPeriod') : undefined },
    ],
    sections,
    activity: during.length,
  };
}
