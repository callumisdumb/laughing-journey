/**
 * ASP biennial report figures, computed from adult concern records, inquiries, investigations,
 * case conferences and orders in the record store for the chosen biennium.
 */
import { AGENCIES, ASP_AGE_BANDS, ASP_CLIENT_GROUPS, ASP_ETHNICITIES, ASP_GENDERS, ASP_HARM_LOCATIONS, ASP_INQUIRY_ACTIONS, ASP_REFERRAL_SOURCES, HARM_TYPES, ageAt, agencyShort, aspAgeBandLabel, aspAgeBandOf, aspClientGroupLabel, aspEthnicityLabel, aspGenderLabel, aspHarmLocationLabel, aspInquiryActionLabel, aspReferralSourceLabel, formatDateTime, harmTypeLabel, localDateOf, type AspProcess, type Dataset } from '@mas/domain';
import { t, tKey } from '@mas/messages';
import { agencyColourVar } from '@mas/ui';
import { countBy, messageSegment, type ChartSpec, type ReportModel, type ReportSection, type TableSpec } from './model';
import { inPeriod, quarterKeyOf, quartersIn, type Period } from './period';

const ORDER_TYPES = ['assessment-order-s11', 'removal-order-s14', 'banning-order-s19', 'warrant-for-entry'] as const;
type OrderType = (typeof ORDER_TYPES)[number];
type OrderDecision = AspProcess['detail']['ordersConsidered'][number]['decision'];

const orderLabel = (type: OrderType) => tKey(`reports.asp.orders.${messageSegment(type)}`);

function investigationStartedAt(p: AspProcess): string | undefined {
  if (!p.detail.investigation) return undefined;
  return p.stageHistory.find((s) => s.stage === 'investigation')?.at ?? p.detail.investigation.visits[0]?.at;
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
  // The return counts one primary harm per inquiry and one primary client group.
  const primaryHarm = (p: AspProcess) => p.detail.concern.primaryHarmType ?? p.detail.concern.harmTypes[0];
  const harm = countBy(referrals, (p) => { const h = primaryHarm(p); return h ? [h] : []; });
  const clientGroup = countBy(referrals, (p) => { const g = p.detail.concern.primaryClientGroup; return g ? [g] : []; });
  const inquiryAction = countBy(inquiries, (p) => { const a = p.detail.inquiry?.action; return a ? [a] : ['pending-unknown']; });
  const location = countBy(referrals, (p) => p.detail.concern.locationOfHarm);
  const referralSource = countBy(referrals, (p) => p.detail.concern.referralSource);

  // Indicator 1: the workbook's own thirty-three sources, in its order, showing only the ones with a
  // figure. The by-agency table stays as well: it is the one an area's own oversight group reads.
  const referralSourceTable: TableSpec = {
    id: 'asp-referrals-by-source',
    columns: [t('reports.asp.columns.referralSource'), t('reports.asp.columns.referrals')],
    numeric: [1],
    rows: ASP_REFERRAL_SOURCES.filter((source) => (referralSource.get(source) ?? 0) > 0).map((source) => [aspReferralSourceLabel(source), referralSource.get(source) ?? 0]),
    empty: t('reports.asp.tables.referralsEmpty'),
  };

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
      ...ASP_INQUIRY_ACTIONS.map((action) => [aspInquiryActionLabel(action), inquiryAction.get(action) ?? 0] as [string, number]),
      [t('reports.asp.measures.investigatoryPowersUsed'), investigations.length],
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

  // Indicators 5 and 6: invitations to a case conference and the uptake of them, for the adult at
  // risk and for an independent advocate. The uptake is the point of the pair, so it is reported as
  // a percentage of the invitations rather than as a second raw count, and reads as not applicable
  // where nobody was invited: nought per cent of nothing is a false negative.
  const invitations = (of: 'adult' | 'advocate') => conferences.filter((m) => (of === 'adult' ? m.aspAttendance?.adultInvited : m.aspAttendance?.advocateInvited)).length;
  const uptake = (of: 'adult' | 'advocate') => conferences.filter((m) => (of === 'adult' ? m.aspAttendance?.adultAttended : m.aspAttendance?.advocateAttended)).length;
  const uptakePercent = (of: 'adult' | 'advocate') => {
    const invited = invitations(of);
    return invited === 0 ? t('reports.asp.notApplicable') : `${Math.round((uptake(of) / invited) * 100)}%`;
  };
  const attendanceTable: TableSpec = {
    id: 'asp-conference-attendance',
    columns: [t('reports.asp.columns.attendee'), t('reports.asp.columns.invited'), t('reports.asp.columns.attended'), t('reports.asp.columns.uptake')],
    numeric: [1, 2],
    rows: [
      [t('reports.asp.attendance.adult'), invitations('adult'), uptake('adult'), uptakePercent('adult')],
      [t('reports.asp.attendance.advocate'), invitations('advocate'), uptake('advocate'), uptakePercent('advocate')],
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
    columns: [t('reports.asp.columns.harmType'), t('reports.asp.columns.inquiries')],
    numeric: [1],
    rows: HARM_TYPES.map((h) => [harmTypeLabel(h), harm.get(h) ?? 0]),
  };

  const clientGroupTable: TableSpec = {
    id: 'asp-client-group',
    columns: [t('reports.asp.columns.clientGroup'), t('reports.asp.columns.inquiries')],
    numeric: [1],
    rows: ASP_CLIENT_GROUPS.map((g) => [aspClientGroupLabel(g), clientGroup.get(g) ?? 0]),
  };

  // Age and gender, indicator 13. The twelve bands are the workbook's own and live in the domain
  // package with the ranges they cover, so the report and the export cannot disagree about them. An
  // adult with no date of birth lands in "Not known" rather than being dropped from the table.
  // Gender has four categories: the record holds sex, so trans or non-binary and prefer not to say
  // read as not collected rather than zero. A return that reports zero has claimed to have asked.
  const adultAges = referrals.flatMap((p) => p.subjectIds.map((id) => data.people.find((x) => x.id === id))).map((person) => (person?.dateOfBirth ? ageAt(person.dateOfBirth, now) : undefined));
  const ageTable: TableSpec = {
    id: 'asp-age',
    columns: [t('reports.asp.columns.ageBand'), t('reports.asp.columns.adults')],
    numeric: [1],
    rows: ASP_AGE_BANDS.map((band) => [aspAgeBandLabel(band), adultAges.filter((age) => aspAgeBandOf(age) === band).length]),
  };

  const sexOf = (p: AspProcess) => data.people.find((x) => x.id === p.subjectIds[0])?.sex;
  const genderTable: TableSpec = {
    id: 'asp-gender',
    columns: [t('reports.asp.columns.gender'), t('reports.asp.columns.adults')],
    numeric: [1],
    rows: ASP_GENDERS.map((g) => {
      if (g === 'male') return [aspGenderLabel(g), referrals.filter((p) => sexOf(p) === 'male').length];
      if (g === 'female') return [aspGenderLabel(g), referrals.filter((p) => sexOf(p) === 'female').length];
      return [aspGenderLabel(g), t('reports.asp.notCollected')];
    }),
  };

  // Ethnicity, indicator 14: the eight categories mirror Scotland's Census 2022 for comparability.
  // Every row is present and every one reads as not collected, because the dataset holds no ethnicity
  // by design (brief section 9). A return that showed zero in every category would be claiming to
  // have asked and been told nothing; showing the rows and saying they are not held is the honest form.
  const ethnicityTable: TableSpec = {
    id: 'asp-ethnicity',
    columns: [t('reports.asp.columns.ethnicity'), t('reports.asp.columns.adults')],
    numeric: [1],
    rows: ASP_ETHNICITIES.map((e) => [aspEthnicityLabel(e), t('reports.asp.notCollected')]),
  };

  const locationTable: TableSpec = {
    id: 'asp-location',
    columns: [t('reports.asp.columns.locationOfHarm'), t('reports.asp.columns.referrals')],
    numeric: [1],
    rows: ASP_HARM_LOCATIONS.map((l) => [aspHarmLocationLabel(l), location.get(l) ?? 0]),
    empty: t('reports.asp.tables.referralsEmpty'),
  };

  const sections: ReportSection[] = [
    { id: 'referrals', title: t('reports.asp.sections.referrals'), note: t('reports.asp.sections.referralsNote'), chart, tables: [referralSourceTable, referralTable] },
    { id: 'inquiries', title: t('reports.asp.sections.inquiries'), note: t('reports.asp.sections.inquiriesNote'), tables: [inquiryTable] },
    { id: 'conferences', title: t('reports.asp.sections.conferences'), note: t('reports.asp.sections.conferencesNote'), tables: [conferenceTable, attendanceTable] },
    { id: 'orders', title: t('reports.asp.sections.orders'), note: t('reports.asp.sections.ordersNote', { granted: granted === 0 ? 'none' : 'some', drafting }), tables: [orderTable] },
    { id: 'lsi', title: t('reports.asp.sections.lsi'), note: t('reports.asp.sections.lsiNote'), tables: [lsiTable] },
    { id: 'harm', title: t('reports.asp.sections.harm'), note: t('reports.asp.sections.harmNote'), tables: [harmTable] },
    { id: 'client-group', title: t('reports.asp.sections.clientGroup'), note: t('reports.asp.sections.clientGroupNote'), tables: [clientGroupTable] },
    { id: 'age-gender', title: t('reports.asp.sections.ageGender'), note: t('reports.asp.sections.ageGenderNote'), tables: [ageTable, genderTable] },
    { id: 'ethnicity', title: t('reports.asp.sections.ethnicity'), note: t('reports.asp.sections.ethnicityNote'), tables: [ethnicityTable] },
    { id: 'location', title: t('reports.asp.sections.location'), note: t('reports.asp.sections.locationNote'), tables: [locationTable] },
  ];

  return {
    kind: 'asp',
    title: t('reports.asp.title'),
    lede: t('reports.asp.lede'),
    period,
    // Annex 2: aggregate counts that name no one are routine Official and carry no marking (D-058).
    classification: 'official',
    meta: [t('reports.meta.period', { period: period.label }), t('reports.asp.meta.computed', { dateTime: formatDateTime(now), records: asp.length, referrals: referrals.length, adults: adults.size }), t('reports.asp.meta.fieldSet')],
    verify: [t('reports.asp.verify.deadlines')],
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
