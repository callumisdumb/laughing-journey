/**
 * ASP biennial report figures, computed from adult concern records, inquiries, investigations,
 * case conferences and orders in the record store for the chosen biennium.
 */
import { AGENCIES, HARM_TYPES, agencyShort, formatDateTime, harmTypeLabel, localDateOf, type AspProcess, type Dataset } from '@mas/domain';
import { t, tKey } from '@mas/messages';
import { agencyColourVar } from '@mas/ui';
import { personById } from '@/lib/selectors';
import { addressLineAt } from './helpers';
import { countBy, messageSegment, type ChartSpec, type ReportModel, type ReportSection, type TableSpec } from './model';
import { inPeriod, quarterKeyOf, quartersIn, type Period } from './period';

const ORDER_TYPES = ['assessment-order-s11', 'removal-order-s14', 'banning-order-s19', 'warrant-for-entry'] as const;
type OrderType = (typeof ORDER_TYPES)[number];
type OrderDecision = AspProcess['detail']['ordersConsidered'][number]['decision'];
type Location = 'care-home' | 'hospital' | 'own-home';

const orderLabel = (type: OrderType) => tKey(`reports.asp.orders.${messageSegment(type)}`);
const locationLabel = (location: Location) => tKey(`reports.asp.location.${messageSegment(location)}`);

function investigationStartedAt(p: AspProcess): string | undefined {
  if (!p.detail.investigation) return undefined;
  return p.stageHistory.find((s) => s.stage === 'investigation')?.at ?? p.detail.investigation.visits[0]?.at;
}

/** The concern record has no location field yet, so the location is read from the adult's address on the day. */
function locationOfHarm(data: Dataset, p: AspProcess): Location {
  if (p.detail.lsi) return 'care-home';
  const subject = personById(data, p.subjectIds[0]);
  const line = subject ? (addressLineAt(data, subject, p.detail.concern.receivedAt) ?? '') : '';
  if (/care home/i.test(line)) return 'care-home';
  if (/infirmary|hospital|ward/i.test(line)) return 'hospital';
  return 'own-home';
}

export function aspModel(data: Dataset, now: Date, period: Period): ReportModel {
  const today = localDateOf(now);
  const asp = data.processes.filter((p): p is AspProcess => p.type === 'asp');
  const referrals = asp.filter((p) => inPeriod(p.detail.concern.receivedAt, period));
  const adults = new Set(referrals.flatMap((p) => p.subjectIds));
  const byAgency = countBy(referrals, (p) => p.detail.concern.sourceAgency);
  const agencies = AGENCIES.filter((a) => (byAgency.get(a) ?? 0) > 0);
  const quarters = quartersIn(period);

  const chart: ChartSpec = {
    id: 'asp-referrals-chart',
    kind: 'stacked',
    title: t('reports.asp.chart.title'),
    summary: t('reports.asp.chart.summary', { referrals: referrals.length, quarters: quarters.length, from: agencies.length > 0 ? t('reports.asp.chart.summaryFrom', { agencies: agencies.map((a) => agencyShort(a)).join(', ') }) : '' }),
    categories: quarters.map((q) => q.short),
    categoryLabels: quarters.map((q) => q.long),
    series: agencies.map((a) => ({ key: a, label: agencyShort(a), colour: agencyColourVar(a), agency: a })),
    values: agencies.map((a) => quarters.map((q) => referrals.filter((p) => p.detail.concern.sourceAgency === a && quarterKeyOf(p.detail.concern.receivedAt) === q.key).length)),
    xLabel: t('reports.asp.chart.xLabel'),
    yLabel: t('reports.asp.chart.yLabel'),
  };

  const inquiries = asp.filter((p) => p.detail.inquiry && inPeriod(p.detail.inquiry.openedAt, period));
  const inquiryOutcome = countBy(inquiries, (p) => p.detail.inquiry?.outcome);
  const investigations = asp.filter((p) => inPeriod(investigationStartedAt(p), period));
  const allInvestigations = asp.flatMap((p) => (p.detail.investigation ? [p.detail.investigation] : []));
  const visits = allInvestigations.flatMap((i) => i.visits).filter((v) => inPeriod(v.at, period)).length;
  const interviews = allInvestigations.flatMap((i) => i.interviews).filter((v) => inPeriod(v.at, period));
  const medicals = allInvestigations.filter((i) => i.medicalExamination && inPeriod(i.medicalExamination.requestedAt, period)).length;
  const records = allInvestigations.flatMap((i) => i.recordsRequests).filter((r) => inPeriod(r.requestedAt, period)).length;
  const advocacyOffered = investigations.filter((p) => p.detail.investigation?.advocacy.offered).length;
  const capacityAssessed = investigations.filter((p) => p.detail.investigation?.capacity.assessed).length;

  const conferences = data.meetings.filter((m) => (m.type === 'asp-case-conference' || m.type === 'asp-review-conference') && inPeriod(m.scheduledAt, period));
  const held = (type: string) => conferences.filter((m) => m.type === type && m.status === 'held').length;
  const pending = (type: string) => conferences.filter((m) => m.type === type && m.status === 'scheduled' && localDateOf(m.scheduledAt) >= today).length;
  const conferencesHeld = held('asp-case-conference') + held('asp-review-conference');

  const orders = referrals.flatMap((p) => p.detail.ordersConsidered);
  const orderCount = (type: OrderType, decision: OrderDecision) => orders.filter((o) => o.order === type && o.considered && o.decision === decision).length;
  const granted = orders.filter((o) => o.decision === 'granted').length;
  const drafting = orders.filter((o) => o.decision === 'application-drafting').length;

  const lsis = referrals.filter((p) => p.detail.lsi);
  const harm = countBy(referrals, (p) => p.detail.concern.harmTypes);
  const location = countBy(referrals, (p) => locationOfHarm(data, p));

  const referralTable: TableSpec = {
    id: 'asp-referrals-by-agency',
    columns: [t('reports.asp.columns.sourceAgency'), t('reports.asp.columns.referrals'), t('reports.asp.columns.adults')],
    numeric: [1, 2],
    rows: agencies.map((a) => [agencyShort(a), byAgency.get(a) ?? 0, new Set(referrals.filter((p) => p.detail.concern.sourceAgency === a).flatMap((p) => p.subjectIds)).size]),
    empty: t('reports.asp.tables.referralsEmpty'),
  };

  const inquiryTable: TableSpec = {
    id: 'asp-inquiries',
    columns: [t('reports.columns.measure'), t('reports.columns.count')],
    numeric: [1],
    rows: [
      [t('reports.asp.measures.inquiriesOpened'), inquiries.length],
      [t('reports.asp.measures.outcomeInvestigation'), inquiryOutcome.get('proceed-to-investigation') ?? 0],
      [t('reports.asp.measures.outcomeSupport'), inquiryOutcome.get('support-only') ?? 0],
      [t('reports.asp.measures.outcomeNoAction'), inquiryOutcome.get('no-further-action') ?? 0],
      [t('reports.asp.measures.outcomePending'), inquiryOutcome.get('pending') ?? 0],
      [t('reports.asp.measures.investigationsStarted'), investigations.length],
      [t('reports.asp.measures.visits'), visits],
      [t('reports.asp.measures.interviews'), interviews.length],
      [t('reports.asp.measures.adultsDeclined'), interviews.filter((i) => i.adultDeclined).length],
      [t('reports.asp.measures.medicals'), medicals],
      [t('reports.asp.measures.records'), records],
      [t('reports.asp.measures.advocacyOffered'), advocacyOffered],
      [t('reports.asp.measures.capacityAssessed'), capacityAssessed],
    ],
  };

  const conferenceTable: TableSpec = {
    id: 'asp-conferences',
    columns: [t('reports.asp.columns.meeting'), t('reports.asp.columns.held'), t('reports.asp.columns.scheduled')],
    numeric: [1, 2],
    rows: [
      [t('reports.asp.conferences.initial'), held('asp-case-conference'), pending('asp-case-conference')],
      [t('reports.asp.conferences.review'), held('asp-review-conference'), pending('asp-review-conference')],
    ],
  };

  const orderTable: TableSpec = {
    id: 'asp-orders',
    columns: [t('reports.asp.columns.order'), t('reports.asp.columns.granted'), t('reports.asp.columns.appliedFor'), t('reports.asp.columns.refused'), t('reports.asp.columns.drafting'), t('reports.asp.columns.notRequired')],
    numeric: [1, 2, 3, 4, 5],
    rows: ORDER_TYPES.map((type) => [orderLabel(type), orderCount(type, 'granted'), orderCount(type, 'applied'), orderCount(type, 'refused'), orderCount(type, 'application-drafting'), orderCount(type, 'not-required')]),
  };

  const lsiTable: TableSpec = {
    id: 'asp-lsi',
    columns: [t('reports.asp.columns.setting'), t('reports.asp.columns.provider'), t('reports.asp.columns.adults'), t('reports.asp.columns.strandsOpen'), t('reports.asp.columns.agenciesInvolved'), t('reports.asp.columns.careInspectorateNotified')],
    numeric: [2, 3],
    rows: lsis.flatMap((p) => {
      const l = p.detail.lsi;
      if (!l) return [];
      return [[l.setting, l.provider, p.subjectIds.length, l.strands.filter((s) => s.status === 'open').length, l.agenciesInvolved.map((a) => agencyShort(a)).join(', '), l.careInspectorateNotified ? t('common.answers.yes') : t('common.answers.no')]];
    }),
    empty: t('reports.asp.tables.lsiEmpty'),
  };

  const harmTable: TableSpec = {
    id: 'asp-harm',
    columns: [t('reports.asp.columns.harmType'), t('reports.asp.columns.referrals')],
    numeric: [1],
    rows: HARM_TYPES.map((h) => [harmTypeLabel(h), harm.get(h) ?? 0]),
  };

  const locationTable: TableSpec = {
    id: 'asp-location',
    columns: [t('reports.asp.columns.locationOfHarm'), t('reports.asp.columns.referrals')],
    numeric: [1],
    rows: [...location.entries()].sort((a, b) => b[1] - a[1]).map(([k, v]) => [locationLabel(k), v]),
    empty: t('reports.asp.tables.referralsEmpty'),
  };

  const sections: ReportSection[] = [
    { id: 'referrals', title: t('reports.asp.sections.referrals'), note: t('reports.asp.sections.referralsNote'), chart, tables: [referralTable] },
    { id: 'inquiries', title: t('reports.asp.sections.inquiries'), note: t('reports.asp.sections.inquiriesNote'), tables: [inquiryTable] },
    { id: 'conferences', title: t('reports.asp.sections.conferences'), note: t('reports.asp.sections.conferencesNote'), tables: [conferenceTable] },
    { id: 'orders', title: t('reports.asp.sections.orders'), note: t('reports.asp.sections.ordersNote', { granted: granted === 0 ? 'none' : 'some', drafting }), tables: [orderTable] },
    { id: 'lsi', title: t('reports.asp.sections.lsi'), note: t('reports.asp.sections.lsiNote'), tables: [lsiTable] },
    { id: 'harm', title: t('reports.asp.sections.harm'), note: t('reports.asp.sections.harmNote'), tables: [harmTable] },
    { id: 'location', title: t('reports.asp.sections.location'), note: t('reports.asp.sections.locationNote'), tables: [locationTable] },
  ];

  return {
    kind: 'asp',
    title: t('reports.asp.title'),
    lede: t('reports.asp.lede'),
    period,
    classification: 'official-sensitive',
    meta: [t('reports.meta.period', { period: period.label }), t('reports.asp.meta.computed', { dateTime: formatDateTime(now), records: asp.length, referrals: referrals.length, adults: adults.size }), t('reports.meta.verify')],
    verify: [t('reports.asp.verify.nmds'), t('reports.asp.verify.location')],
    sources: [t('reports.asp.sources.apcGuidance'), t('reports.asp.sources.nmds'), t('reports.asp.sources.statistics')],
    figures: [
      { id: 'referrals', label: t('reports.asp.figures.referrals'), value: String(referrals.length), note: t('reports.asp.figures.referralsNote', { count: adults.size }) },
      { id: 'inquiries', label: t('reports.asp.figures.inquiries'), value: String(inquiries.length) },
      { id: 'investigations', label: t('reports.asp.figures.investigations'), value: String(investigations.length) },
      { id: 'conferences', label: t('reports.asp.figures.conferences'), value: String(conferencesHeld) },
      { id: 'orders', label: t('reports.asp.figures.orders'), value: String(granted), note: granted === 0 ? t('reports.figures.noneInPeriod') : undefined },
      { id: 'lsi', label: t('reports.asp.figures.lsi'), value: String(lsis.length) },
    ],
    sections,
    activity: referrals.length,
  };
}
