/**
 * MAPPA annual report counts. The underlying records are restricted, so this model carries counts only:
 * no names, references or dates that could identify an offender.
 */
import { RISK_TOOL_LABELS, dueDateFor, findClockRule, formatDate, formatDateTime, localDateOf, type ClockRule, type Config, type Dataset, type MappaProcess } from '@mas/domain';
import { countBy, plural, scaleColour, sum, type ChartSpec, type ReportModel, type ReportSection, type TableSpec } from './model';
import { inPeriod, type Period } from './period';

type Level = 1 | 2 | 3;
const LEVELS: Level[] = [1, 2, 3];

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
  if (!rule) return 'no rule configured';
  return `${rule.amount} ${rule.unit.replace('-', ' ')}`;
}

export function mappaModel(data: Dataset, config: Config, now: Date, period: Period): ReportModel {
  const today = localDateOf(now);
  const mappas = data.processes.filter((p): p is MappaProcess => p.type === 'mappa');
  const ids = new Set(mappas.map((p) => p.id));
  const atEnd = mappas.filter((p) => openOn(p, period.to));
  const during = mappas.filter((p) => openDuring(p, period));

  const grid = LEVELS.map((cat) => LEVELS.map((level) => atEnd.filter((p) => p.detail.category === cat && levelAt(p, period.to) === level).length));
  const notifications = mappas.filter((p) => inPeriod(p.detail.notification.at, period)).length;
  const referrals = mappas.filter((p) => p.detail.referral && inPeriod(p.detail.referral.at, period)).length;
  const exits = mappas.filter((p) => p.detail.exit && inPeriod(p.detail.exit.at, period)).length;
  const releases = mappas.filter((p) => inPeriod(p.detail.custody.releasedAt, period)).length;
  const levelChanges = mappas.flatMap((p) => p.detail.levelHistory).filter((h) => inPeriod(h.at, period)).length;

  const meetings = data.meetings.filter((m) => (m.type === 'mappa-level2' || m.type === 'mappa-level3') && ids.has(m.processId));
  const heldIn = meetings.filter((m) => m.status === 'held' && inPeriod(m.scheduledAt, period));
  const scheduled = meetings.filter((m) => m.status === 'scheduled' && inPeriod(m.scheduledAt, period) && localDateOf(m.scheduledAt) >= today);
  const rules: Record<2 | 3, ClockRule | undefined> = { 2: findClockRule(config.clockRules, 'mappa.level2.review'), 3: findClockRule(config.clockRules, 'mappa.level3.review') };

  const reviewRows = ([2, 3] as const).map((level) => {
    const type = level === 2 ? 'mappa-level2' : 'mappa-level3';
    const rule = rules[level];
    const held = heldIn.filter((m) => m.type === type);
    let onTime = 0;
    let late = 0;
    let notDue = 0;
    for (const m of held) {
      if (!rule) continue;
      const due = localDateOf(dueDateFor(rule, m.scheduledAt, { bankHolidays: config.bankHolidays }));
      const next = meetings.filter((x) => x.processId === m.processId && x.status === 'held' && x.scheduledAt > m.scheduledAt).sort((a, b) => (a.scheduledAt < b.scheduledAt ? -1 : 1))[0];
      if (next && localDateOf(next.scheduledAt) <= due) onTime += 1;
      else if (due < today) late += 1;
      else notDue += 1;
    }
    return { level, held: held.length, onTime, late, notDue, interval: intervalText(rule) };
  });
  const lateTotal = sum(reviewRows.map((r) => r.late));

  const disclosures = during.flatMap((p) => p.detail.disclosures);
  const made = disclosures.filter((d) => d.status === 'made' && inPeriod(d.decidedAt, period)).length;
  const approved = disclosures.filter((d) => d.status === 'approved' && inPeriod(d.decidedAt, period)).length;
  const declined = disclosures.filter((d) => d.status === 'declined' && inPeriod(d.decidedAt, period)).length;
  const pendingDisclosures = disclosures.filter((d) => d.status === 'pending').length;
  const byRecipient = countBy(disclosures.filter((d) => d.status === 'made' && inPeriod(d.decidedAt, period)), (d) => d.recipientKind);

  const sonrSubjects = atEnd.filter((p) => p.detail.sonr.subject).length;
  const sonrCompliant = atEnd.filter((p) => p.detail.sonr.subject && p.detail.sonr.compliant).length;
  const sonrBreaches = during.filter((p) => p.detail.sonr.subject && !p.detail.sonr.compliant).length;
  const licenceBreaches = sum(during.map((p) => p.detail.licenceConditions.filter((l) => l.status === 'breached').length));
  const custody = data.events.filter((e) => e.eventType === 'police.custody' && e.linkedProcessIds.some((id) => ids.has(id)) && inPeriod(e.occurredAt, period)).length;
  const scr = during.filter((p) => p.detail.significantCaseReviewTrigger).length;
  const eras = during.filter((p) => p.detail.era && inPeriod(p.detail.era.startedAt, period)).length;

  const tools = countBy(
    data.riskAssessments.filter((r) => r.processId && ids.has(r.processId) && inPeriod(r.assessedAt, period)),
    (r) => r.tool,
  );

  const chart: ChartSpec = {
    id: 'mappa-grid',
    kind: 'stacked',
    title: `Offenders by level and category at ${formatDate(period.to)}`,
    summary: `Offenders by level and category at ${formatDate(period.to)}: ${plural(atEnd.length, 'offender')} managed under MAPPA, ${LEVELS.map((l) => `${sum(grid.map((row) => row[l - 1] ?? 0))} at Level ${l}`).join(', ')}.`,
    categories: LEVELS.map((l) => `Level ${l}`),
    series: LEVELS.map((cat, i) => ({ key: `cat-${cat}`, label: `Category ${cat}`, colour: scaleColour(i) })),
    values: grid,
    xLabel: 'Management level',
    yLabel: 'Offenders',
  };

  const gridTable: TableSpec = {
    id: 'mappa-grid-table',
    columns: ['Category', 'Level 1', 'Level 2', 'Level 3', 'Total'],
    numeric: [1, 2, 3, 4],
    rows: [
      ...LEVELS.map((cat) => {
        const row = grid[cat - 1] ?? [0, 0, 0];
        return [`Category ${cat}: ${cat === 1 ? 'registered sex offenders' : cat === 2 ? 'restricted patients' : 'other risk of serious harm offenders'}`, row[0] ?? 0, row[1] ?? 0, row[2] ?? 0, sum(row)];
      }),
      ['All categories', ...LEVELS.map((l) => sum(grid.map((row) => row[l - 1] ?? 0))), atEnd.length],
    ],
  };

  const movementTable: TableSpec = {
    id: 'mappa-movement',
    columns: ['Measure', 'Count'],
    numeric: [1],
    rows: [
      ['Offenders managed at any point in the period', during.length],
      ['New notifications in the period', notifications],
      ['Referrals for multi-agency management in the period', referrals],
      ['Level decisions recorded in the period', levelChanges],
      ['Released from custody on licence in the period', releases],
      ['Exits in the period (level down, deregistration, transfer)', exits],
      ['Environmental Risk Assessments started in the period', eras],
    ],
  };

  const meetingTable: TableSpec = {
    id: 'mappa-meetings',
    columns: ['Meeting', 'Held in period', 'Scheduled, not yet held'],
    numeric: [1, 2],
    rows: [
      ['Level 2 meetings', heldIn.filter((m) => m.type === 'mappa-level2').length, scheduled.filter((m) => m.type === 'mappa-level2').length],
      ['Level 3 (MAPPP) meetings', heldIn.filter((m) => m.type === 'mappa-level3').length, scheduled.filter((m) => m.type === 'mappa-level3').length],
    ],
  };

  const reviewTable: TableSpec = {
    id: 'mappa-reviews',
    columns: ['Level', 'Interval', 'Meetings held in period', 'Next review held on time', 'Late', 'Not yet due'],
    numeric: [2, 3, 4, 5],
    rows: reviewRows.map((r) => [`Level ${r.level}`, r.interval, r.held, r.onTime, r.late, r.notDue]),
  };

  const disclosureTable: TableSpec = {
    id: 'mappa-disclosures',
    columns: ['Disclosure decisions', 'Count'],
    numeric: [1],
    rows: [
      ['Disclosures made to a third party in the period', made],
      ...[...byRecipient.entries()].map(([k, v]): [string, number] => [`Made to: ${k}`, v]),
      ['Approved, not yet made', approved],
      ['Declined', declined],
      ['Pending decision', pendingDisclosures],
    ],
  };

  const complianceTable: TableSpec = {
    id: 'mappa-compliance',
    columns: ['Measure', 'Count'],
    numeric: [1],
    rows: [
      [`Subject to Sex Offender Notification Requirements at ${formatDate(period.to)}`, sonrSubjects],
      ['Of whom compliant', sonrCompliant],
      ['Notification requirement breaches recorded', sonrBreaches],
      ['Licence conditions breached', licenceBreaches],
      ['Returned to custody in the period', custody],
      ['Significant Case Review triggers', scr],
    ],
    note: sonrBreaches === 0 && licenceBreaches === 0 && custody === 0 ? 'No breaches or returns to custody in period.' : undefined,
  };

  const toolTable: TableSpec = {
    id: 'mappa-tools',
    columns: ['Risk assessment tool', 'Assessments in period'],
    numeric: [1],
    rows: [...tools.entries()].map(([k, v]): [string, number] => [RISK_TOOL_LABELS[k], v]),
    empty: 'No risk assessments in period',
  };

  const sections: ReportSection[] = [
    { id: 'grid', title: 'Offenders by category and level', note: 'Level at the period end from the level history; an offender is Level 1 until the first multi-agency level decision.', chart, tables: [gridTable, movementTable] },
    { id: 'meetings', title: 'Level 2 and Level 3 meetings', note: 'Meetings marked held in the meeting record.', tables: [meetingTable] },
    { id: 'reviews', title: 'Reviews against the national interval', note: `Intervals from the clock rules in Admin: Level 2 every ${intervalText(rules[2])}, Level 3 every ${intervalText(rules[3])}. Review interval to verify against the current MAPPA National Guidance. A meeting held in the period is on time when the next meeting was held by the interval, late when the interval has passed with no meeting, and not yet due otherwise.`, tables: [reviewTable] },
    { id: 'disclosures', title: 'Disclosures to third parties', note: 'From the disclosure decisions register, dated by the decision.', tables: [disclosureTable] },
    { id: 'compliance', title: 'Notification requirements, breaches and custody', note: 'Returns to custody are read from police custody events linked to a MAPPA record.', tables: [complianceTable] },
    { id: 'tools', title: 'Risk assessment tools used', tables: [toolTable] },
  ];

  return {
    kind: 'mappa',
    title: 'MAPPA annual report counts',
    lede: 'Counts only, never names. The MAPPA records behind these figures are restricted and stay on their distribution list; this report and its print pack carry no identifying detail.',
    period,
    classification: 'official-sensitive',
    meta: [
      `Period ${period.label}.`,
      `Computed ${formatDateTime(now)} from the local record store: ${plural(mappas.length, 'MAPPA record')} in total, ${during.length} managed at some point in the period.`,
      'Field set to verify against the current template.',
    ],
    verify: [
      'Annex 3 of the MAPPA National Guidance asks for Tables 1 to 9; the search extracts confirmed Table 1 (registered sex offenders at liberty, per 100,000, breaches of notification requirements, wanted and missing) and the appearance of restricted patients, Category 3, levels, returns to custody and civil orders across the national overview reports, but the exact table titles were not read. Rows here follow those headings until the current annex is checked.',
      'Review interval to verify against the current MAPPA National Guidance: the seeded intervals are 12 weeks at Level 2 and 6 weeks at Level 3.',
    ],
    sources: [
      'MAPPA National Guidance (2022 refresh), Annex 3: Annual Reports (gov.scot).',
      'MAPPA in Scotland: national overview report 2023-24, Appendix C MAPPA National Data, and the 2024-25 overview report (gov.scot).',
    ],
    figures: [
      { id: 'at-end', label: `Offenders managed at ${formatDate(period.to)}`, value: String(atEnd.length) },
      { id: 'l2', label: 'Level 2 meetings held', value: String(heldIn.filter((m) => m.type === 'mappa-level2').length) },
      { id: 'l3', label: 'Level 3 (MAPPP) meetings held', value: String(heldIn.filter((m) => m.type === 'mappa-level3').length) },
      { id: 'late', label: 'Reviews late', value: String(lateTotal), note: lateTotal === 0 ? 'none in period' : undefined },
      { id: 'disclosures', label: 'Disclosures made', value: String(made), note: made === 0 ? 'none in period' : undefined },
      { id: 'sonr', label: 'SONR breaches', value: String(sonrBreaches), note: sonrBreaches === 0 ? 'none in period' : undefined },
    ],
    sections,
    activity: during.length,
  };
}
