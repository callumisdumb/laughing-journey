/**
 * MARAC SafeLives return fields, computed from MARAC referrals and meetings. SafeLives collects
 * meeting-level counts, so nothing here identifies a victim.
 */
import { AGENCIES, AGENCY_SHORT, formatDateTime, localDateOf, type Dataset, type MaracProcess } from '@mas/domain';
import { formatNumber, t } from '@mas/messages';
import { agencyColourVar } from '@mas/ui';
import { personById } from '@/lib/selectors';
import { ageOn } from './helpers';
import { countBy, pct, per10k, scaleColour, sum, type ChartSpec, type ReportModel, type ReportSection, type TableSpec } from './model';
import { inPeriod, type Period } from './period';

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
  const byAgency = countBy(referrals, (p) => p.detail.referral.referringAgency);
  const agencies = AGENCIES.filter((a) => (byAgency.get(a) ?? 0) > 0);
  const police = byAgency.get('police') ?? 0;
  const populationLabel = formatNumber(population);

  const victims = referrals.map((p) => ({ p, v: personById(data, p.detail.referral.victimPersonId) }));
  const male = victims.filter(({ v }) => v?.sex === 'male').length;
  const older = victims.filter(({ p, v }) => v?.dateOfBirth && ageOn(v.dateOfBirth, localDateOf(p.detail.referral.receivedAt)) >= 61).length;
  const minority = victims.filter(({ v }) => v?.ethnicity && v.ethnicity !== 'scottish').length;
  const interpreter = victims.filter(({ v }) => v?.communicationNeeds.interpreterLanguage).length;

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

  const chart: ChartSpec = {
    id: 'marac-by-agency',
    kind: 'bar',
    title: t('reports.marac.chart.title'),
    summary: t('reports.marac.chart.summary', { referrals: referrals.length, breakdown: agencies.length > 0 ? t('reports.marac.chart.summaryBreakdown', { list: agencies.map((a) => t('reports.marac.chart.summaryItem', { count: byAgency.get(a) ?? 0, agency: AGENCY_SHORT[a] })).join(', ') }) : '' }),
    categories: agencies.map((a) => AGENCY_SHORT[a]),
    categoryColours: agencies.map((a) => agencyColourVar(a)),
    categoryLegend: agencies.map((a) => ({ key: a, label: AGENCY_SHORT[a], colour: agencyColourVar(a), agency: a })),
    series: [{ key: 'referrals', label: t('reports.marac.chart.series'), colour: scaleColour(0) }],
    values: [agencies.map((a) => byAgency.get(a) ?? 0)],
    xLabel: t('reports.marac.chart.xLabel'),
    yLabel: t('reports.marac.chart.yLabel'),
  };

  const agencyTable: TableSpec = {
    id: 'marac-agency-table',
    columns: [t('reports.marac.columns.referringAgency'), t('reports.marac.columns.referrals'), t('reports.marac.columns.share')],
    numeric: [1, 2],
    rows: agencies.map((a) => [AGENCY_SHORT[a], byAgency.get(a) ?? 0, pct(byAgency.get(a) ?? 0, referrals.length)]),
    empty: t('reports.marac.tables.agencyEmpty'),
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

  const victimTable: TableSpec = {
    id: 'marac-victims',
    columns: [t('reports.marac.columns.characteristic'), t('reports.marac.columns.cases'), t('reports.marac.columns.derived')],
    numeric: [1],
    rows: [
      [t('reports.marac.victims.male'), male, t('reports.marac.victims.maleHow')],
      [t('reports.marac.victims.older'), older, t('reports.marac.victims.olderHow')],
      [t('reports.marac.victims.minority'), minority, t('reports.marac.victims.minorityHow')],
      [t('reports.marac.victims.interpreter'), interpreter, t('reports.marac.victims.interpreterHow')],
      [t('reports.marac.victims.lgbt'), t('reports.marac.victims.notRecorded'), t('reports.marac.victims.notRecordedHow')],
      [t('reports.marac.victims.disability'), t('reports.marac.victims.notRecorded'), t('reports.marac.victims.notRecordedHow')],
    ],
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
    { id: 'agency', title: t('reports.marac.sections.agency'), note: t('reports.marac.sections.agencyNote'), chart, tables: [agencyTable] },
    { id: 'cases', title: t('reports.marac.sections.cases'), note: t('reports.marac.sections.casesNote'), tables: [casesTable] },
    { id: 'victims', title: t('reports.marac.sections.victims'), note: t('reports.marac.sections.victimsNote'), tables: [victimTable] },
    { id: 'risk', title: t('reports.marac.sections.risk'), tables: [riskTable] },
    { id: 'links', title: t('reports.marac.sections.links'), tables: [linksTable] },
  ];

  return {
    kind: 'marac',
    title: t('reports.marac.title'),
    lede: t('reports.marac.lede'),
    period,
    classification: 'official-sensitive',
    meta: [t('reports.meta.period', { period: period.label }), t('reports.marac.meta.computed', { dateTime: formatDateTime(now), records: maracs.length, referrals: referrals.length }), t('reports.marac.meta.population', { population: populationLabel }), t('reports.meta.verify')],
    verify: [t('reports.marac.verify.template'), t('reports.marac.verify.olderThreshold')],
    sources: [t('reports.marac.sources.guidance'), t('reports.marac.sources.keyFindings'), t('reports.marac.sources.spotlight')],
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
