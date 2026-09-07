/**
 * MARAC SafeLives return fields, computed from MARAC referrals and meetings. SafeLives collects
 * meeting-level counts, so nothing here identifies a victim.
 *
 * The field set is the Scotland template's (docs/templates/New-Marac-data-template-Scotland-2025.xlsx,
 * docs/RESEARCH.md 9.2): the fourteen referral sources of its columns G to T, and the victim and
 * perpetrator characteristics of its columns U to AF. Older victims are counted from 65, the
 * template's own threshold. What the record store does not hold (ethnicity, sexual orientation and
 * gender identity, disability) is shown as not recorded, never as nought.
 */
import { SAFELIVES_COLUMNS, SAFELIVES_NOT_HELD, SAFELIVES_SOURCES, SAFELIVES_SOURCE_AGENCY, formatDateTime, localDateOf, safeLivesColumnHeader, safeLivesSourceLabel, type Dataset, type MaracProcess, type SafeLivesColumn, type SafeLivesSource, OFFICIAL } from '@mas/domain';
import { formatNumber, t, tKey } from '@mas/messages';
import { agencyColourVar } from '@mas/ui';
import { personById } from '@/lib/selectors';
import { ageOn } from './helpers';
import { countBy, pct, per10k, scaleColour, sum, type ChartSpec, type ReportModel, type ReportSection, type TableSpec } from './model';
import { inPeriod, type Period } from './period';

/** The chart's axis label for a source: short, so fourteen fit; the data table carries the full header. */
const shortSourceLabel = (source: SafeLivesSource) => tKey(`reports.safeLives.short.${source}`);

/** The characteristic columns of the template, U to AF, in order. */
const CHARACTERISTIC_COLUMNS = SAFELIVES_COLUMNS.slice(SAFELIVES_COLUMNS.indexOf('minoritisedTotal')) as readonly SafeLivesColumn[];

export function maracModel(data: Dataset, now: Date, period: Period, population: number): ReportModel {
  const maracs = data.processes.filter((p): p is MaracProcess => p.type === 'marac');
  const referrals = maracs.filter((p) => inPeriod(p.detail.referral.receivedAt, period));
  const heldIds = new Set(data.meetings.filter((m) => m.type === 'marac' && m.status === 'held' && inPeriod(m.scheduledAt, period)).map((m) => m.id));
  const meetingsHeld = heldIds.size;
  const discussed = maracs.filter((p) => p.detail.meetingId && heldIds.has(p.detail.meetingId));
  const awaiting = referrals.filter((p) => !(p.detail.meetingId && heldIds.has(p.detail.meetingId)));
  const repeats = referrals.filter((p) => p.detail.referral.repeat);
  const judgement = referrals.filter((p) => p.detail.referral.professionalJudgementReferral);
  const withChildren = referrals.filter((p) => p.detail.referral.childPersonIds.length > 0);
  const children = sum(referrals.map((p) => p.detail.referral.childPersonIds.length));
  const bySource = countBy(referrals, (p) => p.detail.safeLivesReturn.referralSource);
  const sources = SAFELIVES_SOURCES.filter((s) => (bySource.get(s) ?? 0) > 0);
  const police = bySource.get('police') ?? 0;
  const populationLabel = formatNumber(population);

  const on = (p: MaracProcess) => localDateOf(p.detail.referral.receivedAt);
  const victims = referrals.map((p) => ({ p, v: personById(data, p.detail.referral.victimPersonId), h: personById(data, p.detail.referral.perpetratorPersonId) }));
  const age = (dob: string | undefined, day: string) => (dob ? ageOn(dob, day) : undefined);
  const male = victims.filter(({ v }) => v?.sex === 'male').length;
  const young = victims.filter(({ p, v }) => [16, 17].includes(age(v?.dateOfBirth, on(p)) ?? -1)).length;
  const harmingUnder18 = victims.filter(({ p, h }) => (age(h?.dateOfBirth, on(p)) ?? 99) < 18).length;
  const older = victims.filter(({ p, v }) => (age(v?.dateOfBirth, on(p)) ?? -1) >= 65).length;
  const counted: Partial<Record<SafeLivesColumn, [number, string]>> = {
    maleVictims: [male, t('reports.marac.victims.maleHow')],
    victims16or17: [young, t('reports.marac.victims.youngHow')],
    harmingUnder18: [harmingUnder18, t('reports.marac.victims.perpetratorHow')],
    victims65Plus: [older, t('reports.marac.victims.olderHow')],
  };

  const risk = referrals.map((p) => data.riskAssessments.find((r) => r.id === p.detail.referral.riskAssessmentId));
  const dash = risk.filter((r) => r?.tool === 'dash').length;
  const daq = risk.filter((r) => r?.tool === 'daq').length;
  const overrides = risk.filter((r) => r?.judgementOverride).length;

  const flags = maracs.flatMap((p) => p.detail.flags).filter((f) => inPeriod(f.placedAt, period)).length;
  const cpLinked = referrals.filter((p) => p.detail.links.cpProcessId).length;
  const aspLinked = referrals.filter((p) => p.detail.links.aspProcessId).length;
  const mappaLinked = referrals.filter((p) => p.detail.links.mappaProcessId).length;
  const matac = referrals.filter((p) => p.detail.links.matacReferredAt).length;
  const dsdas = referrals.filter((p) => p.detail.links.dsdasConsidered).length;
  const transfers = maracs.filter((p) => p.detail.transfer && inPeriod(p.detail.transfer.at, period)).length;

  const colourOf = (source: SafeLivesSource) => {
    const agency = SAFELIVES_SOURCE_AGENCY[source];
    return agency ? agencyColourVar(agency) : scaleColour(1);
  };
  const chart: ChartSpec = {
    id: 'marac-by-source',
    kind: 'bar',
    title: t('reports.marac.chart.title'),
    summary: t('reports.marac.chart.summary', { referrals: referrals.length, breakdown: sources.length > 0 ? t('reports.marac.chart.summaryBreakdown', { list: sources.map((s) => t('reports.marac.chart.summaryItem', { count: bySource.get(s) ?? 0, source: shortSourceLabel(s) })).join(', ') }) : '' }),
    categories: sources.map((s) => shortSourceLabel(s)),
    categoryLabels: sources.map((s) => safeLivesSourceLabel(s)),
    categoryColours: sources.map((s) => colourOf(s)),
    categoryLegend: sources.map((s) => ({ key: s, label: shortSourceLabel(s), colour: colourOf(s), agency: SAFELIVES_SOURCE_AGENCY[s] })),
    series: [{ key: 'referrals', label: t('reports.marac.chart.series'), colour: scaleColour(0) }],
    values: [sources.map((s) => bySource.get(s) ?? 0)],
    xLabel: t('reports.marac.chart.xLabel'),
    yLabel: t('reports.marac.chart.yLabel'),
  };

  const sourceTable: TableSpec = {
    id: 'marac-source-table',
    columns: [t('reports.marac.columns.referralSource'), t('reports.marac.columns.referrals'), t('reports.marac.columns.share')],
    numeric: [1, 2],
    rows: sources.map((s) => [safeLivesSourceLabel(s), bySource.get(s) ?? 0, pct(bySource.get(s) ?? 0, referrals.length)]),
    empty: t('reports.marac.tables.sourceEmpty'),
  };

  const casesTable: TableSpec = {
    id: 'marac-cases',
    columns: [t('reports.columns.measure'), t('reports.columns.count'), t('reports.marac.columns.shareOrRate')],
    numeric: [1, 2],
    rows: [
      [t('reports.marac.fields.meetingsHeld'), meetingsHeld, ''],
      [t('reports.marac.fields.referralsReceived'), referrals.length, ''],
      [t('reports.marac.fields.casesDiscussed'), discussed.length, ''],
      [t('reports.marac.fields.awaiting'), awaiting.length, pct(awaiting.length, referrals.length)],
      [t('reports.marac.fields.repeats'), repeats.length, pct(repeats.length, referrals.length)],
      [t('reports.marac.fields.judgement'), judgement.length, pct(judgement.length, referrals.length)],
      [t('reports.marac.fields.withChildren'), withChildren.length, pct(withChildren.length, referrals.length)],
      [t('reports.marac.fields.children'), children, ''],
      [t('reports.marac.fields.police'), police, pct(police, referrals.length)],
      [t('reports.marac.fields.perTenThousand', { population: populationLabel }), discussed.length, per10k(discussed.length, population)],
      [t('reports.marac.fields.referralsPerTenThousand'), referrals.length, per10k(referrals.length, population)],
    ],
  };

  // The template's characteristic columns, U to AF, in its order and its words.
  const victimTable: TableSpec = {
    id: 'marac-victims',
    columns: [t('reports.marac.columns.characteristic'), t('reports.marac.columns.cases'), t('reports.marac.columns.derived')],
    numeric: [1],
    rows: CHARACTERISTIC_COLUMNS.map((column) => {
      const known = counted[column];
      if (known) return [safeLivesColumnHeader(column), known[0], known[1]];
      return [safeLivesColumnHeader(column), t('reports.marac.victims.notRecorded'), t('reports.marac.victims.notRecordedHow')];
    }),
  };

  const riskTable: TableSpec = {
    id: 'marac-risk',
    columns: [t('reports.marac.columns.riskIdentification'), t('reports.columns.count')],
    numeric: [1],
    rows: [
      [t('reports.marac.risk.dash'), dash],
      [t('reports.marac.risk.daq'), daq],
      [t('reports.marac.risk.overrides'), overrides],
    ],
  };

  const linksTable: TableSpec = {
    id: 'marac-links',
    columns: [t('reports.marac.columns.linkOrOutcome'), t('reports.marac.columns.cases')],
    numeric: [1],
    rows: [
      [t('reports.marac.links.cp'), cpLinked],
      [t('reports.marac.links.asp'), aspLinked],
      [t('reports.marac.links.mappa'), mappaLinked],
      [t('reports.marac.links.matac'), matac],
      [t('reports.marac.links.dsdas'), dsdas],
      [t('reports.marac.links.flags'), flags],
      [t('reports.marac.links.transfers'), transfers],
    ],
  };

  const sections: ReportSection[] = [
    { id: 'source', title: t('reports.marac.sections.source'), note: t('reports.marac.sections.sourceNote'), chart, tables: [sourceTable] },
    { id: 'cases', title: t('reports.marac.sections.cases'), note: t('reports.marac.sections.casesNote'), tables: [casesTable] },
    { id: 'victims', title: t('reports.marac.sections.victims'), note: t('reports.marac.sections.victimsNote', { count: SAFELIVES_NOT_HELD.length }), tables: [victimTable] },
    { id: 'risk', title: t('reports.marac.sections.risk'), tables: [riskTable] },
    { id: 'links', title: t('reports.marac.sections.links'), tables: [linksTable] },
  ];

  return {
    kind: 'marac',
    title: t('reports.marac.title'),
    lede: t('reports.marac.lede'),
    period,
    // Annex 2: aggregate counts that name no one are routine Official and carry no marking (D-058).
    classification: OFFICIAL,
    accessRestriction: 'none',
    meta: [t('reports.meta.period', { period: period.label }), t('reports.marac.meta.computed', { dateTime: formatDateTime(now), records: maracs.length, referrals: referrals.length }), t('reports.marac.meta.population', { population: populationLabel }), t('reports.marac.meta.fieldSet')],
    verify: [],
    sources: [t('reports.marac.sources.template'), t('reports.marac.sources.guidance'), t('reports.marac.sources.keyFindings')],
    figures: [
      { id: 'referrals', label: t('reports.marac.figures.referrals'), value: String(referrals.length) },
      { id: 'discussed', label: t('reports.marac.figures.discussed'), value: String(discussed.length), note: t('reports.marac.figures.discussedNote', { count: meetingsHeld }) },
      { id: 'repeat', label: t('reports.marac.figures.repeat'), value: pct(repeats.length, referrals.length), note: t('reports.marac.figures.repeatNote', { count: repeats.length }) },
      { id: 'children', label: t('reports.marac.figures.children'), value: String(children) },
      { id: 'police', label: t('reports.marac.figures.police'), value: pct(police, referrals.length), note: t('reports.marac.figures.policeNote', { police, referrals: referrals.length }) },
      { id: 'rate', label: t('reports.marac.figures.rate'), value: per10k(discussed.length, population), note: t('reports.marac.figures.rateNote') },
    ],
    sections,
    activity: referrals.length + discussed.length,
  };
}
