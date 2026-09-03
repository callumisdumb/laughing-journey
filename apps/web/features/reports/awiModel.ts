/**
 * AWI application timeliness: route and applicant, the MHO report against the 21 day rule in
 * section 57(4), interim orders against the statutory maximum, and days from application to order.
 */
import { daysBetween, dueDateFor, findClockRule, formatDate, formatDateTime, localDateOf, type AwiProcess, type ClockRule, type Config, type Dataset } from '@mas/domain';
import { addDays, format, parseISO } from 'date-fns';
import { countBy, median, plural, scaleColour, type ChartSpec, type ReportModel, type ReportSection, type TableSpec } from './model';
import { inPeriod, type Period } from './period';

type Route = NonNullable<AwiProcess['detail']['routeDecision']>['route'];
type OrderKind = AwiProcess['detail']['orders'][number]['kind'];

const APPLICATION_ROUTES = ['guardianship-welfare', 'guardianship-financial', 'guardianship-combined', 'intervention-order'] as const;
type ApplicationRoute = (typeof APPLICATION_ROUTES)[number];

const ROUTE_LABELS: Record<Route, string> = {
  'informal-support': 'Informal support and supported decision making',
  s13za: 'Section 13ZA arrangement',
  'poa-covers': 'Existing power of attorney covers the decision',
  'intervention-order': 'Intervention order',
  'guardianship-welfare': 'Welfare guardianship',
  'guardianship-financial': 'Financial guardianship',
  'guardianship-combined': 'Welfare and financial guardianship',
  'part5-certificate': 'Part 5 certificate (medical treatment)',
};

const ORDER_LABELS: Record<OrderKind, string> = {
  'welfare-guardianship': 'Welfare guardianship order',
  'financial-guardianship': 'Financial guardianship order',
  'combined-guardianship': 'Combined guardianship order',
  'intervention-order': 'Intervention order',
  'interim-order': 'Interim order',
};

function applicationStartedAt(p: AwiProcess): string | undefined {
  return p.detail.application?.mhoNotifiedAt ?? p.detail.routeDecision?.decidedAt;
}

function applicationRoute(p: AwiProcess): ApplicationRoute | undefined {
  const r = p.detail.routeDecision?.route;
  return r && (APPLICATION_ROUTES as readonly string[]).includes(r) ? (r as ApplicationRoute) : undefined;
}

function dueFrom(rule: ClockRule | undefined, triggeredAt: string, fallbackDays: number, bankHolidays: string[]): string {
  if (rule) return localDateOf(dueDateFor(rule, triggeredAt, { bankHolidays }));
  return format(addDays(parseISO(triggeredAt), fallbackDays), 'yyyy-MM-dd');
}

export function awiModel(data: Dataset, config: Config, now: Date, period: Period): ReportModel {
  const today = localDateOf(now);
  const awis = data.processes.filter((p): p is AwiProcess => p.type === 'awi');
  const concerns = awis.filter((p) => inPeriod(p.detail.concern.raisedAt, period));
  const applications = awis.filter((p) => p.detail.application && inPeriod(applicationStartedAt(p), period));
  const decisions = awis.filter((p) => p.detail.routeDecision && inPeriod(p.detail.routeDecision.decidedAt, period));
  const assessments = awis.flatMap((p) => p.detail.capacityAssessments).filter((a) => inPeriod(a.assessedAt, period));
  const opgChecks = awis.filter((p) => p.detail.opgResult && inPeriod(p.detail.opgResult.checkedAt, period)).length;
  const mhoRule = findClockRule(config.clockRules, 'awi.mho.report');
  const maxRule = findClockRule(config.clockRules, 'awi.interim.maximum');
  const warnRule = findClockRule(config.clockRules, 'awi.interim.warning');

  const applicants = [
    { key: 'council', label: 'Council (Chief Social Work Officer)', colour: scaleColour(0) },
    { key: 'private', label: 'Private applicant', colour: scaleColour(1) },
  ] as const;

  const chart: ChartSpec = {
    id: 'awi-routes',
    kind: 'stacked',
    title: 'Applications by route and applicant',
    summary: `Applications by route and applicant: ${plural(applications.length, 'application')} started in the period, ${applications.filter((p) => p.detail.application?.applicant === 'council').length} by the council and ${applications.filter((p) => p.detail.application?.applicant === 'private').length} private.`,
    categories: APPLICATION_ROUTES.map((r) => ROUTE_LABELS[r]),
    series: applicants.map((a) => ({ key: a.key, label: a.label, colour: a.colour })),
    values: applicants.map((a) => APPLICATION_ROUTES.map((r) => applications.filter((p) => applicationRoute(p) === r && p.detail.application?.applicant === a.key).length)),
    xLabel: 'Route',
    yLabel: 'Applications',
  };

  const mhoRows = applications.flatMap((p) => {
    const a = p.detail.application;
    if (!a) return [];
    const due = dueFrom(mhoRule, a.mhoNotifiedAt, 21, config.bankHolidays);
    const submitted = a.mhoReport.submittedAt ? localDateOf(a.mhoReport.submittedAt) : undefined;
    let status: 'on-time' | 'late' | 'running' | 'overdue';
    let text: string;
    if (submitted) {
      const days = daysBetween(localDateOf(a.mhoNotifiedAt), submitted);
      if (submitted <= due) {
        status = 'on-time';
        text = `Submitted ${formatDate(submitted)}, on time (${plural(days, 'day')})`;
      } else {
        status = 'late';
        text = `Submitted ${formatDate(submitted)}, ${plural(daysBetween(due, submitted), 'day')} late`;
      }
    } else if (today <= due) {
      status = 'running';
      text = `In progress, ${plural(daysBetween(today, due), 'day')} left`;
    } else {
      status = 'overdue';
      text = `Not submitted, overdue by ${plural(daysBetween(due, today), 'day')}`;
    }
    return [{ reference: p.reference, notified: a.mhoNotifiedAt, due, status, text }];
  });
  const mhoOnTime = mhoRows.filter((r) => r.status === 'on-time').length;
  const mhoOverdue = mhoRows.filter((r) => r.status === 'overdue' || r.status === 'late').length;

  const interimRows = applications.flatMap((p) => {
    const io = p.detail.application?.interimOrder;
    if (!io) return [];
    let text: string;
    if (io.grantedAt) {
      const age = daysBetween(io.grantedAt, today);
      const maximum = dueFrom(maxRule, io.grantedAt, 183, config.bankHolidays);
      const warning = dueFrom(warnRule, io.grantedAt, 91, config.bankHolidays);
      text = `${plural(age, 'day')} old; statutory maximum ${formatDate(maximum)}${today >= warning ? '; past the 3 month warning' : ''}${io.renewals > 0 ? `; ${plural(io.renewals, 'renewal')}` : ''}`;
    } else {
      const hearing = p.detail.application?.court.hearingAt;
      text = `Not yet granted; hearing ${hearing ? formatDate(hearing) : 'not yet listed'}`;
    }
    return [{ reference: p.reference, sought: io.soughtAt, granted: io.grantedAt, text }];
  });
  const interimGranted = interimRows.filter((r) => r.granted).length;

  const orders = awis.flatMap((p) => p.detail.orders.filter((o) => inPeriod(o.grantedAt, period)).map((o) => ({ p, o })));
  const orderDays = orders.flatMap(({ p, o }) => {
    const start = applicationStartedAt(p);
    return start ? [daysBetween(localDateOf(start), o.grantedAt)] : [];
  });
  const medianDays = median(orderDays);
  const routeCounts = countBy(decisions, (p) => p.detail.routeDecision?.route);
  const s13Considered = decisions.filter((p) => p.detail.routeDecision?.s13za?.considered).length;
  const s13Applied = decisions.filter((p) => p.detail.routeDecision?.s13za?.applied).length;
  const outcomes = countBy(assessments, (a) => a.outcome);

  const mhoTable: TableSpec = {
    id: 'awi-mho',
    columns: ['Application', 'MHO notified', 'Report due', 'Status'],
    rows: mhoRows.map((r) => [r.reference, formatDate(r.notified), formatDate(r.due), r.text]),
    empty: 'No applications with an MHO report in period',
  };

  const interimTable: TableSpec = {
    id: 'awi-interim',
    columns: ['Application', 'Sought', 'Granted', 'Age against the limits'],
    rows: interimRows.map((r) => [r.reference, formatDate(r.sought), r.granted ? formatDate(r.granted) : 'Not yet granted', r.text]),
    empty: 'No interim orders sought in period',
  };

  const orderTable: TableSpec = {
    id: 'awi-orders',
    columns: ['Application', 'Order', 'Granted', 'Days from application'],
    numeric: [3],
    rows: orders.map(({ p, o }) => {
      const start = applicationStartedAt(p);
      return [p.reference, ORDER_LABELS[o.kind], formatDate(o.grantedAt), start ? daysBetween(localDateOf(start), o.grantedAt) : 'n/a'];
    }),
    empty: 'No orders granted in period, so no median can be given',
  };

  const routeTable: TableSpec = {
    id: 'awi-routes-table',
    columns: ['Measure', 'Count'],
    numeric: [1],
    rows: [
      ['Capacity concerns raised', concerns.length],
      ['Capacity assessments completed', assessments.length],
      ['Assessed as lacking capacity for the decision', outcomes.get('lacks-capacity') ?? 0],
      ['Assessed as having capacity for the decision', outcomes.get('has-capacity') ?? 0],
      ['Assessed as fluctuating', outcomes.get('fluctuating') ?? 0],
      ['OPG register checks', opgChecks],
      ...(Object.keys(ROUTE_LABELS) as Route[]).map((r): [string, number] => [`Route decided: ${ROUTE_LABELS[r]}`, routeCounts.get(r) ?? 0]),
      ['Section 13ZA considered', s13Considered],
      ['Section 13ZA applied', s13Applied],
    ],
  };

  const sections: ReportSection[] = [
    { id: 'routes', title: 'Applications by route and applicant', note: 'An application starts when the Mental Health Officer is notified under section 57(3); the route comes from the route decision.', chart, tables: [] },
    { id: 'mho', title: 'Mental Health Officer reports against the 21 day rule', note: `${mhoRule ? `${mhoRule.label}: ${mhoRule.sourceRef ?? mhoRule.source} (${mhoRule.source}).` : 'No MHO report rule is configured; 21 calendar days assumed.'} Applications are shown by reference, never by name.`, tables: [mhoTable] },
    { id: 'interim', title: 'Interim orders', note: `Interim orders run for 3 months by default and cannot exceed 6 months in total; the age is measured to ${formatDate(today)}.`, tables: [interimTable] },
    { id: 'orders', title: 'Orders granted in the period', note: medianDays === undefined ? 'No orders were granted in the period, so no median time from application to order can be given.' : `Median ${plural(medianDays, 'day')} from application to order across ${plural(orders.length, 'order')}.`, tables: [orderTable] },
    { id: 'decisions', title: 'Capacity concerns and route decisions', tables: [routeTable] },
  ];

  return {
    kind: 'awi',
    title: 'AWI application timeliness',
    lede: 'How guardianship applications are moving: route and applicant, the Mental Health Officer report against the 21 day rule, interim orders against the statutory limits, and the days from application to order, computed from the AWI records in the record store.',
    period,
    classification: 'official-sensitive',
    meta: [
      `Period ${period.label}.`,
      `Computed ${formatDateTime(now)} from the local record store: ${plural(awis.length, 'AWI record')} in total, ${plural(applications.length, 'application')} started in the period.`,
      'Field set to verify against the current template.',
    ],
    verify: [
      'The Mental Welfare Commission monitoring report and the Office of the Public Guardian performance pages publish orders granted or registered by type (welfare, financial, combined), private against local authority guardians, order duration and the number of adults subject to guardianship. Neither publishes MHO report timeliness or time from application to order at national level, so those two measures are local and their layout is the platform\'s own.',
    ],
    sources: [
      'Mental Welfare Commission for Scotland, Adults with Incapacity Act monitoring reports 2023-24 and 2024-25 (mwcscot.org.uk).',
      'Office of the Public Guardian (Scotland), guardianship orders performance 2024-2025 and 2023-2024 (publicguardian-scotland.gov.uk).',
      'Adults with Incapacity (Scotland) Act 2000, section 57 (legislation.gov.uk).',
    ],
    figures: [
      { id: 'concerns', label: 'Capacity concerns raised', value: String(concerns.length) },
      { id: 'applications', label: 'Applications started', value: String(applications.length), note: `${applications.filter((p) => p.detail.application?.applicant === 'council').length} by the council` },
      { id: 'mho', label: 'MHO reports on time', value: mhoRows.length === 0 ? 'n/a' : `${mhoOnTime} of ${mhoRows.length}`, note: mhoRows.length === 0 ? 'none due' : mhoOverdue === 0 ? `${mhoRows.filter((r) => r.status === 'running').length} still running, none late` : `${mhoOverdue} late or overdue` },
      { id: 'interim', label: 'Interim orders sought', value: String(interimRows.length), note: `${interimGranted} granted` },
      { id: 'orders', label: 'Orders granted', value: String(orders.length), note: orders.length === 0 ? 'none in period' : undefined },
      { id: 'median', label: 'Median days, application to order', value: medianDays === undefined ? 'n/a' : String(medianDays), note: medianDays === undefined ? 'no orders granted in period' : undefined },
    ],
    sections,
    activity: concerns.length + applications.length,
  };
}
