/**
 * Shared shapes for the five inspection-ready reports. Every figure is computed from the
 * record store; the model is plain data so the screen and the print pack render the same numbers.
 */
import type { Agency, Classification } from '@mas/domain';
import { REPORT_KINDS } from '@/lib/routes';
import type { Period } from './period';

export type ReportKind = (typeof REPORT_KINDS)[number];

export function isReportKind(value: string): value is ReportKind {
  return (REPORT_KINDS as readonly string[]).includes(value);
}

export interface Figure {
  id: string;
  label: string;
  value: string;
  note?: string;
}

export interface TableSpec {
  id: string;
  /** Shown above the table when a section holds more than one table. */
  title?: string;
  note?: string;
  columns: string[];
  /** Column indexes that hold numbers (right aligned, tabular). */
  numeric?: number[];
  rows: Array<Array<string | number>>;
  /** Copy for an empty table. Defaults to "None in period". */
  empty?: string;
}

export interface ChartSeries {
  key: string;
  label: string;
  /** A CSS colour, always a token: var(--color-agency-police) or the accent scale. */
  colour: string;
  agency?: Agency;
}

export interface ChartSpec {
  id: string;
  kind: 'bar' | 'stacked' | 'line';
  title: string;
  /** The accessible name of the chart: what it shows and the headline number. */
  summary: string;
  categories: string[];
  /** Longer category names for the data table when the axis labels are abbreviated. */
  categoryLabels?: string[];
  /** One colour per category for a single-series bar chart (agency colours). */
  categoryColours?: string[];
  /** Legend entries for per-category colours. */
  categoryLegend?: ChartSeries[];
  series: ChartSeries[];
  /** values[seriesIndex][categoryIndex] */
  values: number[][];
  xLabel: string;
  yLabel: string;
}

export interface ReportSection {
  id: string;
  title: string;
  note?: string;
  chart?: ChartSpec;
  tables: TableSpec[];
}

export interface ReportModel {
  kind: ReportKind;
  title: string;
  lede: string;
  period: Period;
  classification: Classification;
  /** One-line context shown under the controls, ending with the verification note. */
  meta: string[];
  /** What could not be verified against the current template, in plain words. */
  verify: string[];
  sources: string[];
  figures: Figure[];
  sections: ReportSection[];
  /** The headline count used to decide whether the period is empty. */
  activity: number;
  hint?: { text: string; periodId: string };
}

export interface ReportCatalogueEntry {
  kind: ReportKind;
  title: string;
  purpose: string;
  recipient: string;
  periodLabel: string;
}

export const REPORT_CATALOGUE: ReportCatalogueEntry[] = [
  {
    kind: 'asp',
    title: 'ASP biennial report figures',
    purpose: 'The activity figures an Adult Protection Committee needs for the biennial report it must produce under the Adult Support and Protection (Scotland) Act 2007: referrals by source, inquiries, investigations, case conferences, protection orders and Large Scale Investigations, by harm type and where the harm happened.',
    recipient: 'The APC convener, for the committee, the council, the health board and Police Scotland, then Scottish Ministers.',
    periodLabel: 'Two years to 31 March',
  },
  {
    kind: 'cp',
    title: 'Child Protection Register statistics',
    purpose: "The register figures collected each year for the Children's Social Work Statistics: registrations, de-registrations, the register at 31 July by age, concerns identified at registration, unborn children, re-registrations within two years and length of time on the register.",
    recipient: "The Child Protection Committee, and the council's annual return to the Scottish Government.",
    periodLabel: 'Year to 31 July',
  },
  {
    kind: 'marac',
    title: 'MARAC SafeLives return',
    purpose: 'The meeting-level counts SafeLives collects from every MARAC each quarter: cases discussed, repeats, children in the households, referrals by agency, victim characteristics and cases per 10,000 adult women.',
    recipient: 'The MARAC Coordinator and steering group, then the SafeLives national dataset.',
    periodLabel: 'Four quarters, rolling',
  },
  {
    kind: 'mappa',
    title: 'MAPPA annual report counts',
    purpose: 'The counts in the tables Scottish Ministers ask for in every MAPPA annual report: offenders by category and level, Level 2 and Level 3 meetings, reviews against the national interval, disclosures and notification breaches. Counts only, never names.',
    recipient: 'The Strategic Oversight Group, for the annual report published each October.',
    periodLabel: 'Year to 31 March',
  },
  {
    kind: 'awi',
    title: 'AWI application timeliness',
    purpose: 'How guardianship applications are moving: route and applicant, the Mental Health Officer report against the 21 day rule in section 57(4), interim orders and their age, and the days from application to order.',
    recipient: 'The Chief Social Work Officer and the MHO service, with the figures the Mental Welfare Commission and the Office of the Public Guardian collect.',
    periodLabel: 'Reporting year to date, from 1 April',
  },
];

/** Non-agency series colours: the accent scale, never the risk colours. */
export const SCALE_COLOURS = ['var(--color-accent-1)', 'var(--color-ink-3)', 'var(--color-accent-2)', 'var(--color-line-3)'] as const;

export function scaleColour(index: number): string {
  return SCALE_COLOURS[index % SCALE_COLOURS.length] ?? SCALE_COLOURS[0];
}

export function countBy<T, K extends string>(items: T[], key: (item: T) => K | K[] | undefined): Map<K, number> {
  const out = new Map<K, number>();
  for (const item of items) {
    const k = key(item);
    if (k === undefined) continue;
    for (const each of Array.isArray(k) ? k : [k]) out.set(each, (out.get(each) ?? 0) + 1);
  }
  return out;
}

export function sum(values: number[]): number {
  return values.reduce((acc, v) => acc + v, 0);
}

/** "50.0%" or "n/a" when there is nothing to divide by. */
export function pct(part: number, whole: number, digits = 1): string {
  if (whole === 0) return 'n/a';
  return `${((part / whole) * 100).toFixed(digits)}%`;
}

/** Cases per 10,000 of a population, to two decimals. */
export function per10k(count: number, population: number): string {
  if (population <= 0) return 'n/a';
  return ((count / population) * 10000).toFixed(2);
}

export function median(values: number[]): number | undefined {
  if (values.length === 0) return undefined;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  const hi = sorted[mid] ?? 0;
  if (sorted.length % 2 === 1) return hi;
  const lo = sorted[mid - 1] ?? hi;
  return (lo + hi) / 2;
}

export function plural(n: number, one: string, many = `${one}s`): string {
  return `${n} ${n === 1 ? one : many}`;
}
