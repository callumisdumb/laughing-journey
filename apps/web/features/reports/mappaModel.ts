/**
 * MAPPA annual report: Annex 3 Tables 1 to 9 of the MAPPA National Guidance, computed from the
 * record store for a year to 31 March. The underlying records are restricted, so this model carries
 * counts only: no names, references or dates that could identify an offender. The table wording
 * lives in the catalogue under reports.mappaAnnex3 (see mappaAnnex3.ts); every figure here is
 * keyed on a row id, never on the label.
 */
import { ageAt, dueDateFor, findClockRule, formatDate, formatDateTime, localDateOf, type ClockRule, type Config, type Dataset, type MappaProcess } from '@mas/domain';
import { t, tKey } from '@mas/messages';
import { ETHNICITY_NOT_HELD_ROW, MAPPA_ANNEX3_TABLES, annexColumns, annexRowLabel, annexTitle, dataNotHeld, type AnnexTable } from './mappaAnnex3';
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

/**
 * An Annex 3 table with its cells keyed on the row id. A lettered heading the annex prints above
 * its numbered parts carries no figure, so its cells are blank; any other row the record store
 * cannot fill reads "Data not held" rather than a zero, which in a return to Ministers would be a
 * claim rather than an absence.
 */
function annexTableSpec(table: AnnexTable, cells: Record<string, Cell[]>): TableSpec {
  const width = table.columnCount - 1;
  const blank = Array.from({ length: width }, () => '');
  const notHeld = Array.from({ length: width }, () => dataNotHeld());
  return {
    id: `mappa-${table.id}`,
    columns: annexColumns(table),
    numeric: Array.from({ length: width }, (_, i) => i + 1),
    rows: table.rows.map((row) => [annexRowLabel(table, row), ...(row.group ? blank : (cells[row.id] ?? notHeld))]),
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

  // Table 6.
  const bySex = (sex: 'male' | 'female' | 'not-recorded') => community.filter((p) => (personOf(p)?.sex ?? 'not-recorded') === sex).length;

  // Table 7.
  const supervised = rsosAtEnd.filter((p) => p.detail.sonr.subject && onLicenceOn(p, end)).length;
  const sonrOnly = rsosAtEnd.filter((p) => p.detail.sonr.subject && !onLicenceOn(p, end)).length;

  // Table 8. The dataset holds no ethnicity by design, so every category reads zero and the whole
  // population sits under "Data Not held". Asserted in reports.test.ts.
  const ethnicityCells: Record<string, Cell[]> = Object.fromEntries(
    (MAPPA_ANNEX3_TABLES.find((table) => table.id === 'table-8')?.rows ?? []).map((row) => {
      if (row.id === ETHNICITY_NOT_HELD_ROW || row.id === 'total') return [row.id, [rsosAtEnd.length, rsosAtEnd.length === 0 ? '0.0' : '100.0']];
      return [row.id, [0, '0.0']];
    }),
  );

  // Formal disclosure decisions recorded on the Category 1 records open at the year end.
  const disclosures = rsosAtEnd.filter((p) => p.detail.disclosures.some((d) => d.status === 'made')).length;

  // Table 9. A return to custody is a police custody event on a Category 1 record after the recorded release.
  const rsos = inCategory(mappas, 1);
  const returned = data.events.filter((e) => {
    if (e.eventType !== 'police.custody' || !inPeriod(e.occurredAt, period)) return false;
    return rsos.some((p) => e.linkedProcessIds.includes(p.id) && Boolean(p.detail.custody.releasedAt) && localDateOf(e.occurredAt) > (p.detail.custody.releasedAt ?? ''));
  }).length;

  // Tables 6 to 9 carry a percentage of the RSO population, to one decimal place as the annex prints it.
  const pct = (n: number, of: number) => (of === 0 ? '0.0' : ((n / of) * 100).toFixed(1));
  const ageOf = (p: MappaProcess) => {
    const dob = personOf(p)?.dateOfBirth;
    return dob ? ageAt(dob, new Date(`${end}T12:00:00+01:00`)) : undefined;
  };
  const inBand = (lo: number, hi: number) => rsosAtEnd.filter((p) => { const a = ageOf(p); return a !== undefined && a >= lo && a <= hi; }).length;
  const ageRow = (lo: number, hi: number) => [inBand(lo, hi), pct(inBand(lo, hi), rsosAtEnd.length)];
  const sexRow = (sex: 'male' | 'female' | 'other') => {
    const n = sex === 'other' ? rsosAtEnd.length - bySex('male') - bySex('female') : bySex(sex);
    return [n, pct(n, rsosAtEnd.length)];
  };
  const inCustody = (list: MappaProcess[]) => list.filter((p) => inCustodyOn(p, end)).length;
  // Table 3 splits each level across custody and liberty.
  const levelSplit = (level: Level) => {
    const atLevel = rsosAtEnd.filter((p) => levelAt(p, end) === level);
    const custody = inCustody(atLevel);
    return [custody, atLevel.length - custody, atLevel.length];
  };
  const splitRow = (n: Cell) => [dataNotHeld(), dataNotHeld(), n];

  const cells: Record<AnnexTable['id'], Record<string, Cell[]>> = {
    'table-1': {
      'at-liberty': [community.length],
      'per-100k': [dataNotHeld()],
      breaches: [sonrBreaches],
      wanted: [dataNotHeld()],
      missing: [missingAtEnd],
    },
    'table-2': {
      'sopo-in-force': [inForce('sopo')],
      'sopo-granted': [made('sopo')],
      'rsho-in-force': [inForce('rsho')],
      'shpo-in-force': [inForce('shpo')],
      'shpo-granted': [made('shpo')],
      'sro-in-force': [inForce('sro')],
      'sopo-breach': [dataNotHeld()],
      'shpo-breach': [dataNotHeld()],
      'rsho-breach': [dataNotHeld()],
      'sro-breach': [dataNotHeld()],
      'foreign-travel': [made('fto')],
      'notification-orders': [made('notification-order')],
    },
    'table-3': {
      'level-1': levelSplit(1),
      'level-2': levelSplit(2),
      'level-3': levelSplit(3),
      'further-conviction': splitRow(dataNotHeld()),
      'returned-to-custody': splitRow(returned),
      'sonr-indefinite-review': splitRow(dataNotHeld()),
      'notification-continuation': splitRow(dataNotHeld()),
      'formal-disclosure': splitRow(disclosures),
    },
    'table-4': {
      'living-in-area': [patients.length],
      'during-year': [inCategory(during, 2).length],
      'state-hospital': [dataNotHeld()],
      'other-hospital': [dataNotHeld()],
      community: [dataNotHeld()],
      'level-1': [levelCount(patients, 1)],
      'level-2': [levelCount(patients, 2)],
      'level-3': [levelCount(patients, 3)],
      recalled: [dataNotHeld()],
    },
    'table-5': {
      'level-2': [levelCount(category3, 2)],
      'level-3': [levelCount(category3, 3)],
      'further-conviction-level-2': [dataNotHeld()],
      'further-conviction-level-3': [dataNotHeld()],
      'returned-to-custody': [dataNotHeld()],
      'dwp-notifications': [dataNotHeld()],
    },
    'table-6': {
      'under-18': ageRow(0, 17),
      'age-18-21': ageRow(18, 21),
      'age-22-25': ageRow(22, 25),
      'age-26-30': ageRow(26, 30),
      'age-31-40': ageRow(31, 40),
      'age-41-50': ageRow(41, 50),
      'age-51-60': ageRow(51, 60),
      'age-61-70': ageRow(61, 70),
      'over-70': ageRow(71, 200),
      total: [rsosAtEnd.length, pct(rsosAtEnd.length, rsosAtEnd.length)],
    },
    'table-7': {
      male: sexRow('male'),
      female: sexRow('female'),
      other: sexRow('other'),
      total: [rsosAtEnd.length, pct(rsosAtEnd.length, rsosAtEnd.length)],
    },
    'table-8': ethnicityCells,
    'table-9': {
      'statutory-supervision': [supervised, pct(supervised, supervised + sonrOnly)],
      'notification-only': [sonrOnly, pct(sonrOnly, supervised + sonrOnly)],
      total: [supervised + sonrOnly, pct(supervised + sonrOnly, supervised + sonrOnly)],
    },
  };

  const notes: Record<AnnexTable['id'], string> = {
    'table-1': t('reports.mappa.notes.table1', { date: endLabel }),
    'table-2': t('reports.mappa.notes.table2'),
    'table-3': t('reports.mappa.notes.table3', { date: endLabel, level2: intervalText(rules[2]), level3: intervalText(rules[3]) }),
    'table-4': t('reports.mappa.notes.table4', { date: endLabel }),
    'table-5': t('reports.mappa.notes.table5', { date: endLabel }),
    'table-6': t('reports.mappa.notes.table6', { date: endLabel }),
    'table-7': t('reports.mappa.notes.table7'),
    'table-8': t('reports.mappa.notes.table8'),
    'table-9': t('reports.mappa.notes.table9', { date: endLabel }),
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
    tables: [annexTableSpec(table, cells[table.id])],
  }));

  return {
    kind: 'mappa',
    title: t('reports.mappa.title'),
    lede: t('reports.mappa.lede'),
    period,
    classification: 'official-sensitive',
    meta: [t('reports.meta.period', { period: period.label }), t('reports.mappa.meta.reportingPeriod'), t('reports.mappa.meta.computed', { dateTime: formatDateTime(now), records: mappas.length, managed: during.length }), t('reports.mappa.meta.fieldSet'), t('reports.mappa.meta.noNames')],
    verify: [t('reports.mappa.verify.interval')],
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
