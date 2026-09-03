/**
 * AWI application timeliness: route and applicant, the MHO report against the 21 day rule in
 * section 57(4), interim orders against the statutory maximum, and days from application to order.
 */
import { clockRuleLabel, daysBetween, dueDateFor, findClockRule, formatDate, formatDateTime, localDateOf, type AwiProcess, type ClockRule, type Config, type Dataset } from '@mas/domain';
import { t, tKey } from '@mas/messages';
import { addDays, format, parseISO } from 'date-fns';
import { countBy, median, messageSegment, scaleColour, type ChartSpec, type ReportModel, type ReportSection, type TableSpec } from './model';
import { inPeriod, type Period } from './period';

type Route = NonNullable<AwiProcess['detail']['routeDecision']>['route'];
type OrderKind = AwiProcess['detail']['orders'][number]['kind'];

/** Every route a route decision can take, in the order the decisions table lists them. */
const ROUTES: Route[] = ['informal-support', 's13za', 'poa-covers', 'intervention-order', 'guardianship-welfare', 'guardianship-financial', 'guardianship-combined', 'part5-certificate'];
const APPLICATION_ROUTES = ['guardianship-welfare', 'guardianship-financial', 'guardianship-combined', 'intervention-order'] as const;
type ApplicationRoute = (typeof APPLICATION_ROUTES)[number];

const routeLabel = (route: Route) => tKey(`reports.awi.routes.${messageSegment(route)}`);
const orderKindLabel = (kind: OrderKind) => tKey(`reports.awi.orderKinds.${messageSegment(kind)}`);

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
    { key: 'council', label: t('reports.awi.applicants.council'), colour: scaleColour(0) },
    { key: 'private', label: t('reports.awi.applicants.private'), colour: scaleColour(1) },
  ] as const;
  const byApplicant = (applicant: 'council' | 'private') => applications.filter((p) => p.detail.application?.applicant === applicant).length;

  const chart: ChartSpec = {
    id: 'awi-routes',
    kind: 'stacked',
    title: t('reports.awi.chart.title'),
    summary: t('reports.awi.chart.summary', { applications: applications.length, council: byApplicant('council'), private: byApplicant('private') }),
    categories: APPLICATION_ROUTES.map((r) => routeLabel(r)),
    series: applicants.map((a) => ({ key: a.key, label: a.label, colour: a.colour })),
    values: applicants.map((a) => APPLICATION_ROUTES.map((r) => applications.filter((p) => applicationRoute(p) === r && p.detail.application?.applicant === a.key).length)),
    xLabel: t('reports.awi.chart.xLabel'),
    yLabel: t('reports.awi.chart.yLabel'),
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
        text = t('reports.awi.mho.onTime', { date: formatDate(submitted), days });
      } else {
        status = 'late';
        text = t('reports.awi.mho.late', { date: formatDate(submitted), days: daysBetween(due, submitted) });
      }
    } else if (today <= due) {
      status = 'running';
      text = t('reports.awi.mho.running', { days: daysBetween(today, due) });
    } else {
      status = 'overdue';
      text = t('reports.awi.mho.overdue', { days: daysBetween(due, today) });
    }
    return [{ reference: p.reference, notified: a.mhoNotifiedAt, due, status, text }];
  });
  const mhoOnTime = mhoRows.filter((r) => r.status === 'on-time').length;
  const mhoOverdue = mhoRows.filter((r) => r.status === 'overdue' || r.status === 'late').length;
  const mhoRunning = mhoRows.filter((r) => r.status === 'running').length;

  const interimRows = applications.flatMap((p) => {
    const io = p.detail.application?.interimOrder;
    if (!io) return [];
    let text: string;
    if (io.grantedAt) {
      const age = daysBetween(io.grantedAt, today);
      const maximum = dueFrom(maxRule, io.grantedAt, 183, config.bankHolidays);
      const warning = dueFrom(warnRule, io.grantedAt, 91, config.bankHolidays);
      text = t('reports.awi.interim.granted', { age, maximum: formatDate(maximum), warning: today >= warning ? 'past' : 'within', renewals: io.renewals });
    } else {
      const hearing = p.detail.application?.court.hearingAt;
      text = t('reports.awi.interim.notGranted', { hearing: hearing ? formatDate(hearing) : t('reports.awi.interim.notListed') });
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
    columns: [t('reports.awi.columns.application'), t('reports.awi.columns.mhoNotified'), t('reports.awi.columns.reportDue'), t('reports.awi.columns.status')],
    rows: mhoRows.map((r) => [r.reference, formatDate(r.notified), formatDate(r.due), r.text]),
    empty: t('reports.awi.tables.mhoEmpty'),
  };

  const interimTable: TableSpec = {
    id: 'awi-interim',
    columns: [t('reports.awi.columns.application'), t('reports.awi.columns.sought'), t('reports.awi.columns.granted'), t('reports.awi.columns.age')],
    rows: interimRows.map((r) => [r.reference, formatDate(r.sought), r.granted ? formatDate(r.granted) : t('reports.awi.interim.notYetGranted'), r.text]),
    empty: t('reports.awi.tables.interimEmpty'),
  };

  const orderTable: TableSpec = {
    id: 'awi-orders',
    columns: [t('reports.awi.columns.application'), t('reports.awi.columns.order'), t('reports.awi.columns.granted'), t('reports.awi.columns.daysFromApplication')],
    numeric: [3],
    rows: orders.map(({ p, o }) => {
      const start = applicationStartedAt(p);
      return [p.reference, orderKindLabel(o.kind), formatDate(o.grantedAt), start ? daysBetween(localDateOf(start), o.grantedAt) : t('reports.values.notApplicable')];
    }),
    empty: t('reports.awi.tables.ordersEmpty'),
  };

  const routeTable: TableSpec = {
    id: 'awi-routes-table',
    columns: [t('reports.columns.measure'), t('reports.columns.count')],
    numeric: [1],
    rows: [
      [t('reports.awi.measures.concerns'), concerns.length],
      [t('reports.awi.measures.assessments'), assessments.length],
      [t('reports.awi.measures.lacksCapacity'), outcomes.get('lacks-capacity') ?? 0],
      [t('reports.awi.measures.hasCapacity'), outcomes.get('has-capacity') ?? 0],
      [t('reports.awi.measures.fluctuating'), outcomes.get('fluctuating') ?? 0],
      [t('reports.awi.measures.opgChecks'), opgChecks],
      ...ROUTES.map((r): [string, number] => [t('reports.awi.measures.routeDecided', { route: routeLabel(r) }), routeCounts.get(r) ?? 0]),
      [t('reports.awi.measures.s13Considered'), s13Considered],
      [t('reports.awi.measures.s13Applied'), s13Applied],
    ],
  };

  const mhoNote = mhoRule ? t('reports.awi.sections.mhoRule', { label: clockRuleLabel(mhoRule.id), reference: mhoRule.sourceRef ?? mhoRule.source, source: mhoRule.source }) : t('reports.awi.sections.mhoNoRule');

  const sections: ReportSection[] = [
    { id: 'routes', title: t('reports.awi.sections.routes'), note: t('reports.awi.sections.routesNote'), chart, tables: [] },
    { id: 'mho', title: t('reports.awi.sections.mho'), note: t('reports.awi.sections.mhoNote', { rule: mhoNote }), tables: [mhoTable] },
    { id: 'interim', title: t('reports.awi.sections.interim'), note: t('reports.awi.sections.interimNote', { date: formatDate(today) }), tables: [interimTable] },
    { id: 'orders', title: t('reports.awi.sections.orders'), note: medianDays === undefined ? t('reports.awi.sections.ordersNone') : t('reports.awi.sections.ordersMedian', { days: medianDays, orders: orders.length }), tables: [orderTable] },
    { id: 'decisions', title: t('reports.awi.sections.decisions'), tables: [routeTable] },
  ];

  return {
    kind: 'awi',
    title: t('reports.awi.title'),
    lede: t('reports.awi.lede'),
    period,
    // Annex 2: aggregate counts that name no one are routine Official and carry no marking (D-058).
    classification: 'official',
    meta: [t('reports.meta.period', { period: period.label }), t('reports.awi.meta.computed', { dateTime: formatDateTime(now), records: awis.length, applications: applications.length }), t('reports.meta.verify')],
    verify: [t('reports.awi.verify.publications')],
    sources: [t('reports.awi.sources.mwc'), t('reports.awi.sources.opg'), t('reports.awi.sources.act')],
    figures: [
      { id: 'concerns', label: t('reports.awi.figures.concerns'), value: String(concerns.length) },
      { id: 'applications', label: t('reports.awi.figures.applications'), value: String(applications.length), note: t('reports.awi.figures.applicationsNote', { count: byApplicant('council') }) },
      { id: 'mho', label: t('reports.awi.figures.mho'), value: mhoRows.length === 0 ? t('reports.values.notApplicable') : t('reports.awi.figures.mhoValue', { onTime: mhoOnTime, total: mhoRows.length }), note: mhoRows.length === 0 ? t('reports.awi.figures.mhoNoneDue') : mhoOverdue === 0 ? t('reports.awi.figures.mhoRunning', { count: mhoRunning }) : t('reports.awi.figures.mhoLate', { count: mhoOverdue }) },
      { id: 'interim', label: t('reports.awi.figures.interim'), value: String(interimRows.length), note: t('reports.awi.figures.interimNote', { count: interimGranted }) },
      { id: 'orders', label: t('reports.awi.figures.orders'), value: String(orders.length), note: orders.length === 0 ? t('reports.figures.noneInPeriod') : undefined },
      { id: 'median', label: t('reports.awi.figures.median'), value: medianDays === undefined ? t('reports.values.notApplicable') : String(medianDays), note: medianDays === undefined ? t('reports.awi.figures.medianNote') : undefined },
    ],
    sections,
    activity: concerns.length + applications.length,
  };
}
