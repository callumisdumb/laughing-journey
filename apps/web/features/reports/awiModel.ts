/**
 * AWI guardianship monitoring and application timeliness.
 *
 * The field set is the Mental Welfare Commission's Adults with Incapacity Act monitoring report
 * 2024-25 (docs/templates/MWC-AWI-Monitoring-Report-2024-25.pdf, docs/RESEARCH.md 9.3): orders
 * granted in the period by the five categories of its Table 1, the time from application to grant in
 * its four bands, new against renewed orders, guardian type by primary diagnosis (its Table 2), and
 * the guardianships in force at the period end by the blocks of its Table A1. The welfare, financial
 * and combined split comes from the Office of the Public Guardian's performance page (5.11), which is
 * a different source, and stays. After the Commission's tables come the local measures: the MHO
 * report against the 21 day rule, interim orders against the statutory limits, and the route decisions.
 *
 * Where the product holds no diagnosis, which is the deliberate position unless an assessor records
 * one, a row reads Unknown, as the Commission's own Table 2 does. Nothing here names an adult.
 */
import { AWI_DIAGNOSTIC_GROUPS, awiDiagnosticGroupLabel, clockRuleLabel, daysBetween, dueDateFor, findClockRule, formatDate, formatDateTime, localDateOf, OFFICIAL, workingCalendarFrom, type AwiDiagnosticGroup, type AwiProcess, type ClockRule, type Config, type Dataset, type WorkingCalendar } from '@mas/domain';
import { t, tKey } from '@mas/messages';
import { addDays, differenceInDays, differenceInMonths, format, parseISO } from 'date-fns';
import { personById } from '@/lib/selectors';
import { ageOn } from './helpers';
import { countBy, median, messageSegment, pct, scaleColour, type ChartSpec, type ReportModel, type ReportSection, type TableSpec } from './model';
import { inPeriod, type Period } from './period';

type Route = NonNullable<AwiProcess['detail']['routeDecision']>['route'];
type Order = AwiProcess['detail']['orders'][number];
type OrderKind = Order['kind'];
type Diagnosis = AwiDiagnosticGroup | 'unknown';

/** Every route a route decision can take, in the order the decisions table lists them. */
const ROUTES: Route[] = ['informal-support', 's13za', 'poa-covers', 'intervention-order', 'guardianship-welfare', 'guardianship-financial', 'guardianship-combined', 'part5-certificate'];
const APPLICATION_ROUTES = ['guardianship-welfare', 'guardianship-financial', 'guardianship-combined', 'intervention-order'] as const;
type ApplicationRoute = (typeof APPLICATION_ROUTES)[number];
/** The orders the Commission counts as guardianships: welfare, financial and combined. Interim and intervention orders are not. */
const GUARDIANSHIP_KINDS: readonly OrderKind[] = ['welfare-guardianship', 'financial-guardianship', 'combined-guardianship'];
const DIAGNOSES: readonly Diagnosis[] = [...AWI_DIAGNOSTIC_GROUPS, 'unknown'];
const AGE_BANDS = ['age16to24', 'age25to44', 'age45to64', 'age65Plus'] as const;
const LENGTHS = ['zeroToThree', 'fourToFive', 'overFive', 'indefinite'] as const;
const TIME_BANDS = ['twoMonthsOrLess', 'threeToFour', 'fiveToSix', 'overSix'] as const;

const routeLabel = (route: Route) => tKey(`reports.awi.routes.${messageSegment(route)}`);
const orderKindLabel = (kind: OrderKind) => tKey(`reports.awi.orderKinds.${messageSegment(kind)}`);
const groupLabel = (key: string) => tKey(`reports.awi.groups.${key}`);

function applicationStartedAt(p: AwiProcess): string | undefined {
  return p.detail.application?.mhoNotifiedAt ?? p.detail.routeDecision?.decidedAt;
}

/** The day the application was made to the court, or where that is not recorded, the day the MHO was notified. */
function applicationMadeAt(p: AwiProcess): string | undefined {
  const lodged = p.detail.application?.court.lodgedAt;
  if (lodged) return lodged;
  const started = applicationStartedAt(p);
  return started ? localDateOf(started) : undefined;
}

function applicationRoute(p: AwiProcess): ApplicationRoute | undefined {
  const r = p.detail.routeDecision?.route;
  return r && (APPLICATION_ROUTES as readonly string[]).includes(r) ? (r as ApplicationRoute) : undefined;
}

function dueFrom(rule: ClockRule | undefined, triggeredAt: string, fallbackDays: number, calendar: WorkingCalendar): string {
  if (rule) return localDateOf(dueDateFor(rule, triggeredAt, { calendar }));
  return format(addDays(parseISO(triggeredAt), fallbackDays), 'yyyy-MM-dd');
}

/** One guardianship order with the characteristics the Commission tables it by. */
interface GrantedOrder {
  p: AwiProcess;
  o: Order;
  gender: 'male' | 'female' | 'unknown';
  ageBand?: (typeof AGE_BANDS)[number];
  guardian?: 'localAuthority' | 'private';
  length: (typeof LENGTHS)[number];
  diagnosis: Diagnosis;
  renewal: boolean;
}

function characterise(data: Dataset, p: AwiProcess, o: Order, on: string): GrantedOrder {
  const subject = personById(data, p.subjectIds[0]);
  const age = subject?.dateOfBirth ? ageOn(subject.dateOfBirth, on) : undefined;
  const ageBand = age === undefined ? undefined : age < 25 ? 'age16to24' : age < 45 ? 'age25to44' : age < 65 ? 'age45to64' : 'age65Plus';
  const years = o.expiresAt ? differenceInDays(parseISO(o.expiresAt), parseISO(o.grantedAt)) / 365.25 : undefined;
  const length = years === undefined ? 'indefinite' : years <= 3 ? 'zeroToThree' : years <= 5 ? 'fourToFive' : 'overFive';
  const assessments = [...p.detail.capacityAssessments].sort((a, b) => (a.assessedAt < b.assessedAt ? 1 : -1));
  const diagnosis = assessments.find((a) => a.primaryDiagnosis)?.primaryDiagnosis ?? 'unknown';
  const applicant = p.detail.application?.applicant;
  return {
    p,
    o,
    gender: subject?.sex === 'male' ? 'male' : subject?.sex === 'female' ? 'female' : 'unknown',
    ageBand,
    guardian: applicant === 'council' ? 'localAuthority' : applicant === 'private' ? 'private' : undefined,
    length,
    diagnosis,
    renewal: o.renewal === true,
  };
}

function timeBand(months: number): (typeof TIME_BANDS)[number] {
  if (months <= 2) return 'twoMonthsOrLess';
  if (months <= 4) return 'threeToFour';
  if (months <= 6) return 'fiveToSix';
  return 'overSix';
}

/** A Table 1 or Table A1 block: one category, its groupings, each a count and a share of the whole. */
function block(category: string, groups: Array<[label: string, count: number]>, whole: number): Array<Array<string | number>> {
  return groups.map(([label, count], i) => [i === 0 ? category : '', label, count, pct(count, whole)]);
}

export function awiModel(data: Dataset, config: Config, now: Date, period: Period): ReportModel {
  const today = localDateOf(now);
  const awis = data.processes.filter((p): p is AwiProcess => p.type === 'awi');
  const concerns = awis.filter((p) => inPeriod(p.detail.concern.raisedAt, period));
  const applications = awis.filter((p) => p.detail.application && inPeriod(applicationStartedAt(p), period));
  const decisions = awis.filter((p) => p.detail.routeDecision && inPeriod(p.detail.routeDecision.decidedAt, period));
  const assessments = awis.flatMap((p) => p.detail.capacityAssessments).filter((a) => inPeriod(a.assessedAt, period));
  const opgChecks = awis.filter((p) => p.detail.opgResult && inPeriod(p.detail.opgResult.checkedAt, period)).length;
  const calendar = workingCalendarFrom(config);
  const mhoRule = findClockRule(config.clockRules, 'awi.mho.report');
  const maxRule = findClockRule(config.clockRules, 'awi.interim.maximum');
  const warnRule = findClockRule(config.clockRules, 'awi.interim.warning');

  /* ---------- The Commission's tables ---------- */

  const granted = awis.flatMap((p) => p.detail.orders.filter((o) => GUARDIANSHIP_KINDS.includes(o.kind) && inPeriod(o.grantedAt, period)).map((o) => characterise(data, p, o, o.grantedAt)));
  const n = granted.length;
  const count = (test: (g: GrantedOrder) => boolean) => granted.filter(test).length;

  const table1: TableSpec = {
    id: 'awi-granted',
    columns: [t('reports.awi.columns.category'), t('reports.awi.columns.grouping'), t('reports.awi.columns.orders'), t('reports.awi.columns.percent')],
    numeric: [2, 3],
    rows: [
      ...block(t('reports.awi.categories.gender'), [[groupLabel('male'), count((g) => g.gender === 'male')], [groupLabel('female'), count((g) => g.gender === 'female')]], n),
      ...block(t('reports.awi.categories.age'), AGE_BANDS.map((band) => [groupLabel(band), count((g) => g.ageBand === band)]), n),
      ...block(t('reports.awi.categories.guardianType'), [[groupLabel('localAuthority'), count((g) => g.guardian === 'localAuthority')], [groupLabel('private'), count((g) => g.guardian === 'private')]], n),
      ...block(t('reports.awi.categories.length'), LENGTHS.map((l) => [groupLabel(l), count((g) => g.length === l)]), n),
      ...block(t('reports.awi.categories.diagnosis'), DIAGNOSES.map((d) => [awiDiagnosticGroupLabel(d), count((g) => g.diagnosis === d)]), n),
    ],
    empty: t('reports.awi.tables.grantedEmpty'),
  };

  const timings = granted.flatMap((g) => {
    const made = applicationMadeAt(g.p);
    return made ? [{ g, months: differenceInMonths(parseISO(g.o.grantedAt), parseISO(made)), days: daysBetween(made, g.o.grantedAt), made }] : [];
  });
  const timelinessTable: TableSpec = {
    id: 'awi-timeliness',
    columns: [t('reports.awi.columns.timeBand'), t('reports.awi.columns.orders'), t('reports.awi.columns.percent')],
    numeric: [1, 2],
    rows: TIME_BANDS.map((band) => {
      const c = timings.filter((x) => timeBand(x.months) === band).length;
      return [t(`reports.awi.timeBands.${band}` as const), c, pct(c, timings.length)];
    }),
  };
  const medianDays = median(timings.map((x) => x.days));
  const orderTable: TableSpec = {
    id: 'awi-orders',
    title: t('reports.awi.tables.ordersTitle'),
    columns: [t('reports.awi.columns.application'), t('reports.awi.columns.order'), t('reports.awi.columns.granted'), t('reports.awi.columns.daysFromApplication')],
    numeric: [3],
    rows: awis.flatMap((p) => p.detail.orders.filter((o) => inPeriod(o.grantedAt, period)).map((o) => {
      const made = applicationMadeAt(p);
      return [p.reference, orderKindLabel(o.kind), formatDate(o.grantedAt), made ? daysBetween(made, o.grantedAt) : t('reports.values.notApplicable')];
    })),
    empty: t('reports.awi.tables.ordersEmpty'),
  };

  const renewals = count((g) => g.renewal);
  const renewalTable: TableSpec = {
    id: 'awi-renewals',
    columns: [t('reports.awi.columns.status'), t('reports.awi.columns.orders'), t('reports.awi.columns.percent')],
    numeric: [1, 2],
    rows: [
      [groupLabel('new'), n - renewals, pct(n - renewals, n)],
      [groupLabel('renewal'), renewals, pct(renewals, n)],
    ],
  };
  const renewalByDiagnosis: TableSpec = {
    id: 'awi-renewals-by-diagnosis',
    title: t('reports.awi.tables.renewalsByDiagnosisTitle'),
    columns: [t('reports.awi.columns.diagnosis'), groupLabel('new'), groupLabel('renewal')],
    numeric: [1, 2],
    rows: DIAGNOSES.map((d) => [awiDiagnosticGroupLabel(d), count((g) => g.diagnosis === d && !g.renewal), count((g) => g.diagnosis === d && g.renewal)]),
  };

  const table2: TableSpec = {
    id: 'awi-guardian-by-diagnosis',
    columns: [t('reports.awi.columns.diagnosis'), groupLabel('localAuthority'), t('reports.awi.columns.percent'), groupLabel('private'), t('reports.awi.columns.percent')],
    numeric: [1, 2, 3, 4],
    rows: DIAGNOSES.map((d) => {
      const la = count((g) => g.diagnosis === d && g.guardian === 'localAuthority');
      const priv = count((g) => g.diagnosis === d && g.guardian === 'private');
      return [awiDiagnosticGroupLabel(d), la, pct(la, la + priv), priv, pct(priv, la + priv)];
    }),
  };

  const asAt = period.to;
  const extant = awis.flatMap((p) => p.detail.orders.filter((o) => GUARDIANSHIP_KINDS.includes(o.kind) && o.grantedAt <= asAt && (!o.expiresAt || o.expiresAt >= asAt)).map((o) => characterise(data, p, o, asAt)));
  const e = extant.length;
  const countExtant = (test: (g: GrantedOrder) => boolean) => extant.filter(test).length;
  const tableA1: TableSpec = {
    id: 'awi-extant',
    columns: [t('reports.awi.columns.category'), t('reports.awi.columns.grouping'), t('reports.awi.columns.guardianships'), t('reports.awi.columns.percent')],
    numeric: [2, 3],
    rows: [
      ...block(t('reports.awi.categories.guardian'), [[groupLabel('localAuthority'), countExtant((g) => g.guardian === 'localAuthority')], [groupLabel('private'), countExtant((g) => g.guardian === 'private')]], e),
      ...block(t('reports.awi.categories.age'), AGE_BANDS.map((band) => [groupLabel(band), countExtant((g) => g.ageBand === band)]), e),
      ...block(t('reports.awi.categories.gender'), [[groupLabel('male'), countExtant((g) => g.gender === 'male')], [groupLabel('female'), countExtant((g) => g.gender === 'female')], [groupLabel('unknownGender'), countExtant((g) => g.gender === 'unknown')]], e),
      ...block(t('reports.awi.categories.length'), LENGTHS.map((l) => [groupLabel(l), countExtant((g) => g.length === l)]), e),
      ...block(t('reports.awi.categories.diagnosticCategories'), AWI_DIAGNOSTIC_GROUPS.map((d) => [awiDiagnosticGroupLabel(d), countExtant((g) => g.diagnosis === d)]), e),
    ],
    empty: t('reports.awi.tables.extantEmpty'),
  };

  /* ---------- The OPG split, and the local measures ---------- */

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
  const kindsTable: TableSpec = {
    id: 'awi-order-kinds',
    columns: [t('reports.awi.columns.order'), t('reports.awi.columns.orders')],
    numeric: [1],
    rows: (['welfare-guardianship', 'financial-guardianship', 'combined-guardianship', 'intervention-order', 'interim-order'] as const).map((kind) => [orderKindLabel(kind), awis.flatMap((p) => p.detail.orders).filter((o) => o.kind === kind && inPeriod(o.grantedAt, period)).length]),
  };

  const mhoRows = applications.flatMap((p) => {
    const a = p.detail.application;
    if (!a) return [];
    const due = dueFrom(mhoRule, a.mhoNotifiedAt, 21, calendar);
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
      const maximum = dueFrom(maxRule, io.grantedAt, 183, calendar);
      const warning = dueFrom(warnRule, io.grantedAt, 91, calendar);
      text = t('reports.awi.interim.granted', { age, maximum: formatDate(maximum), warning: today >= warning ? 'past' : 'within', renewals: io.renewals });
    } else {
      const hearing = p.detail.application?.court.hearingAt;
      text = t('reports.awi.interim.notGranted', { hearing: hearing ? formatDate(hearing) : t('reports.awi.interim.notListed') });
    }
    return [{ reference: p.reference, sought: io.soughtAt, granted: io.grantedAt, text }];
  });
  const interimGranted = interimRows.filter((r) => r.granted).length;

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
    { id: 'granted', title: t('reports.awi.sections.granted'), note: t('reports.awi.sections.grantedNote', { count: n }), tables: [table1] },
    { id: 'timeliness', title: t('reports.awi.sections.timeliness'), note: medianDays === undefined ? t('reports.awi.sections.timelinessNone') : t('reports.awi.sections.timelinessNote', { days: medianDays, orders: timings.length }), tables: [timelinessTable, orderTable] },
    { id: 'renewals', title: t('reports.awi.sections.renewals'), note: t('reports.awi.sections.renewalsNote'), tables: [renewalTable, renewalByDiagnosis] },
    { id: 'guardian-type', title: t('reports.awi.sections.guardianType'), note: t('reports.awi.sections.guardianTypeNote'), tables: [table2] },
    { id: 'extant', title: t('reports.awi.sections.extant', { date: formatDate(asAt) }), note: t('reports.awi.sections.extantNote', { count: e }), tables: [tableA1] },
    { id: 'routes', title: t('reports.awi.sections.routes'), note: t('reports.awi.sections.routesNote'), chart, tables: [kindsTable] },
    { id: 'mho', title: t('reports.awi.sections.mho'), note: t('reports.awi.sections.mhoNote', { rule: mhoNote }), tables: [mhoTable] },
    { id: 'interim', title: t('reports.awi.sections.interim'), note: t('reports.awi.sections.interimNote', { date: formatDate(today) }), tables: [interimTable] },
    { id: 'decisions', title: t('reports.awi.sections.decisions'), tables: [routeTable] },
  ];

  return {
    kind: 'awi',
    title: t('reports.awi.title'),
    lede: t('reports.awi.lede'),
    period,
    // Annex 2: aggregate counts that name no one are routine Official and carry no marking (D-058).
    classification: OFFICIAL,
    accessRestriction: 'none',
    meta: [t('reports.meta.period', { period: period.label }), t('reports.awi.meta.computed', { dateTime: formatDateTime(now), records: awis.length, applications: applications.length }), t('reports.awi.meta.fieldSet')],
    verify: [],
    sources: [t('reports.awi.sources.mwc'), t('reports.awi.sources.opg'), t('reports.awi.sources.act')],
    figures: [
      { id: 'concerns', label: t('reports.awi.figures.concerns'), value: String(concerns.length) },
      { id: 'applications', label: t('reports.awi.figures.applications'), value: String(applications.length), note: t('reports.awi.figures.applicationsNote', { count: byApplicant('council') }) },
      { id: 'granted', label: t('reports.awi.figures.granted'), value: String(n), note: n === 0 ? t('reports.figures.noneInPeriod') : t('reports.awi.figures.grantedNote', { renewals, private: count((g) => g.guardian === 'private') }) },
      { id: 'mho', label: t('reports.awi.figures.mho'), value: mhoRows.length === 0 ? t('reports.values.notApplicable') : t('reports.awi.figures.mhoValue', { onTime: mhoOnTime, total: mhoRows.length }), note: mhoRows.length === 0 ? t('reports.awi.figures.mhoNoneDue') : mhoOverdue === 0 ? t('reports.awi.figures.mhoRunning', { count: mhoRunning }) : t('reports.awi.figures.mhoLate', { count: mhoOverdue }) },
      { id: 'interim', label: t('reports.awi.figures.interim'), value: String(interimRows.length), note: t('reports.awi.figures.interimNote', { count: interimGranted }) },
      { id: 'median', label: t('reports.awi.figures.median'), value: medianDays === undefined ? t('reports.values.notApplicable') : String(medianDays), note: medianDays === undefined ? t('reports.awi.figures.medianNote') : undefined },
    ],
    sections,
    activity: concerns.length + applications.length + n,
  };
}
