/**
 * ASP biennial report figures, computed from adult concern records, inquiries, investigations,
 * case conferences and orders in the record store for the chosen biennium.
 */
import { AGENCIES, AGENCY_SHORT, HARM_TYPES, HARM_TYPE_LABELS, formatDateTime, localDateOf, type AspProcess, type Dataset } from '@mas/domain';
import { agencyColourVar } from '@mas/ui';
import { personById } from '@/lib/selectors';
import { addressLineAt } from './helpers';
import { countBy, plural, type ChartSpec, type ReportModel, type ReportSection, type TableSpec } from './model';
import { inPeriod, quarterKeyOf, quartersIn, type Period } from './period';

const ORDER_TYPES = ['assessment-order-s11', 'removal-order-s14', 'banning-order-s19', 'warrant-for-entry'] as const;
type OrderType = (typeof ORDER_TYPES)[number];
type OrderDecision = AspProcess['detail']['ordersConsidered'][number]['decision'];

const ORDER_LABELS: Record<OrderType, string> = {
  'assessment-order-s11': 'Assessment order (section 11)',
  'removal-order-s14': 'Removal order (section 14)',
  'banning-order-s19': 'Banning order (section 19)',
  'warrant-for-entry': 'Warrant for entry',
};

function investigationStartedAt(p: AspProcess): string | undefined {
  if (!p.detail.investigation) return undefined;
  return p.stageHistory.find((s) => s.stage === 'investigation')?.at ?? p.detail.investigation.visits[0]?.at;
}

/** The concern record has no location field yet, so the location is read from the adult's address on the day. */
function locationOfHarm(data: Dataset, p: AspProcess): string {
  if (p.detail.lsi) return 'Care home or other regulated setting';
  const subject = personById(data, p.subjectIds[0]);
  const line = subject ? (addressLineAt(data, subject, p.detail.concern.receivedAt) ?? '') : '';
  if (/care home/i.test(line)) return 'Care home or other regulated setting';
  if (/infirmary|hospital|ward/i.test(line)) return 'Hospital';
  return 'Own home';
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
    title: 'Referrals by quarter and source agency',
    summary: `Referrals by quarter and source agency: ${plural(referrals.length, 'referral')} over ${plural(quarters.length, 'quarter')}${agencies.length > 0 ? `, from ${agencies.map((a) => AGENCY_SHORT[a]).join(', ')}` : ''}.`,
    categories: quarters.map((q) => q.short),
    categoryLabels: quarters.map((q) => q.long),
    series: agencies.map((a) => ({ key: a, label: AGENCY_SHORT[a], colour: agencyColourVar(a), agency: a })),
    values: agencies.map((a) => quarters.map((q) => referrals.filter((p) => p.detail.concern.sourceAgency === a && quarterKeyOf(p.detail.concern.receivedAt) === q.key).length)),
    xLabel: 'Quarter',
    yLabel: 'Referrals',
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
    columns: ['Source agency', 'Referrals', 'Adults'],
    numeric: [1, 2],
    rows: agencies.map((a) => [AGENCY_SHORT[a], byAgency.get(a) ?? 0, new Set(referrals.filter((p) => p.detail.concern.sourceAgency === a).flatMap((p) => p.subjectIds)).size]),
    empty: 'No referrals in period',
  };

  const inquiryTable: TableSpec = {
    id: 'asp-inquiries',
    columns: ['Measure', 'Count'],
    numeric: [1],
    rows: [
      ['Inquiries opened under section 4', inquiries.length],
      ['Inquiry outcome: proceed to investigation', inquiryOutcome.get('proceed-to-investigation') ?? 0],
      ['Inquiry outcome: support only', inquiryOutcome.get('support-only') ?? 0],
      ['Inquiry outcome: no further ASP action', inquiryOutcome.get('no-further-action') ?? 0],
      ['Inquiry outcome: pending', inquiryOutcome.get('pending') ?? 0],
      ['Investigations started', investigations.length],
      ['Visits under section 7', visits],
      ['Interviews under section 8', interviews.length],
      ['Adults who declined to be interviewed', interviews.filter((i) => i.adultDeclined).length],
      ['Medical examinations requested under section 9', medicals],
      ['Records requests under section 10', records],
      ['Investigations where independent advocacy was offered', advocacyOffered],
      ['Investigations where capacity was assessed', capacityAssessed],
    ],
  };

  const conferenceTable: TableSpec = {
    id: 'asp-conferences',
    columns: ['Meeting', 'Held in period', 'Scheduled, not yet held'],
    numeric: [1, 2],
    rows: [
      ['Initial case conference', held('asp-case-conference'), pending('asp-case-conference')],
      ['Review case conference', held('asp-review-conference'), pending('asp-review-conference')],
    ],
  };

  const orderTable: TableSpec = {
    id: 'asp-orders',
    columns: ['Order', 'Granted', 'Applied for', 'Refused', 'Application in drafting', 'Considered, not required'],
    numeric: [1, 2, 3, 4, 5],
    rows: ORDER_TYPES.map((t) => [ORDER_LABELS[t], orderCount(t, 'granted'), orderCount(t, 'applied'), orderCount(t, 'refused'), orderCount(t, 'application-drafting'), orderCount(t, 'not-required')]),
  };

  const lsiTable: TableSpec = {
    id: 'asp-lsi',
    columns: ['Setting', 'Provider', 'Adults', 'Strands open', 'Agencies involved', 'Care Inspectorate notified'],
    numeric: [2, 3],
    rows: lsis.flatMap((p) => {
      const l = p.detail.lsi;
      if (!l) return [];
      return [[l.setting, l.provider, p.subjectIds.length, l.strands.filter((s) => s.status === 'open').length, l.agenciesInvolved.map((a) => AGENCY_SHORT[a]).join(', '), l.careInspectorateNotified ? 'Yes' : 'No']];
    }),
    empty: 'No Large Scale Investigations in period',
  };

  const harmTable: TableSpec = {
    id: 'asp-harm',
    columns: ['Harm type', 'Referrals'],
    numeric: [1],
    rows: HARM_TYPES.map((h) => [HARM_TYPE_LABELS[h], harm.get(h) ?? 0]),
  };

  const locationTable: TableSpec = {
    id: 'asp-location',
    columns: ['Location of harm', 'Referrals'],
    numeric: [1],
    rows: [...location.entries()].sort((a, b) => b[1] - a[1]).map(([k, v]) => [k, v]),
    empty: 'No referrals in period',
  };

  const sections: ReportSection[] = [
    { id: 'referrals', title: 'Referrals by quarter and source agency', note: 'A referral is an adult concern record. A Large Scale Investigation counts once; the adults column shows how many people it covers.', chart, tables: [referralTable] },
    { id: 'inquiries', title: 'Inquiries and investigations', note: 'Inquiries are dated from the section 4 inquiry record; investigations from the stage change. Powers are counted by the date each was used.', tables: [inquiryTable] },
    { id: 'conferences', title: 'Case conferences', note: 'Meetings marked held in the meeting record. Inter-agency discussions are not case conferences and are not counted here.', tables: [conferenceTable] },
    { id: 'orders', title: 'Protection orders', note: `${granted === 0 ? 'No protection orders were granted in the period: none in period. ' : ''}${drafting > 0 ? `${plural(drafting, 'application is', 'applications are')} in drafting. ` : ''}Orders are attributed to the period of the referral they belong to; the record store does not yet date each decision.`, tables: [orderTable] },
    { id: 'lsi', title: 'Large Scale Investigations', note: 'One row per LSI opened in the period, with the number of adults covered by its strands.', tables: [lsiTable] },
    { id: 'harm', title: 'Harm types recorded at referral', note: 'A referral can record more than one harm type, so the column can add up to more than the number of referrals.', tables: [harmTable] },
    { id: 'location', title: 'Location of harm (derived)', note: "Derived from the adult's recorded address on the day the concern was received: care home, hospital or own home. The concern record has no location field yet.", tables: [locationTable] },
  ];

  return {
    kind: 'asp',
    title: 'ASP biennial report figures',
    lede: 'The activity figures an Adult Protection Committee needs for its biennial report, computed from the adult concern records, inquiries, investigations, case conferences and orders in the record store.',
    period,
    classification: 'official-sensitive',
    meta: [
      `Period ${period.label}.`,
      `Computed ${formatDateTime(now)} from the local record store: ${plural(asp.length, 'ASP record')} in total, ${referrals.length} with a concern received in the period, about ${plural(adults.size, 'adult')}.`,
      'Field set to verify against the current template.',
    ],
    verify: [
      'The Scottish Government guidance for Adult Protection Committees describes what a biennial report should cover (activity, trends, inputs and outcomes) rather than a fixed table set. The tables here follow the indicators of the ASP National Minimum Dataset, of which only referrals, inquiries and Large Scale Investigations were published for 2024-25; the harm type, location and order categories are the platform\'s own until the current template is checked.',
      'Location of harm is derived from the address, not recorded on the concern; treat that table as indicative.',
    ],
    sources: [
      'Adult Support and Protection (Scotland) Act 2007: guidance for Adult Protection Committees, Biennial Report (gov.scot).',
      'Adult Support and Protection National Minimum Dataset 2024-25 and its technical report (gov.scot).',
      'Adult Support and Protection Scotland, April 2019 to March 2022 (gov.scot), the last release with case conference and protection order pages.',
    ],
    figures: [
      { id: 'referrals', label: 'Referrals', value: String(referrals.length), note: `${plural(adults.size, 'adult')} at risk` },
      { id: 'inquiries', label: 'Inquiries', value: String(inquiries.length) },
      { id: 'investigations', label: 'Investigations', value: String(investigations.length) },
      { id: 'conferences', label: 'Case conferences held', value: String(conferencesHeld) },
      { id: 'orders', label: 'Protection orders granted', value: String(granted), note: granted === 0 ? 'none in period' : undefined },
      { id: 'lsi', label: 'Large Scale Investigations', value: String(lsis.length) },
    ],
    sections,
    activity: referrals.length,
  };
}
