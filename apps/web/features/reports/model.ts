/**
 * Shared shapes for the five inspection-ready reports. Every figure is computed from the
 * record store; the model is plain data so the screen and the print pack render the same numbers.
 */
import type { Agency, RecordClassification } from '@mas/domain';
import { t } from '@mas/messages';
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
  /** Copy for an empty table. Defaults to the catalogue's reports.table.empty. */
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
  classification: RecordClassification;
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

/** The catalogue keys behind each report's index card, so no key is ever built from a string. */
const CATALOGUE_KEYS = {
  asp: { title: 'reports.asp.title', purpose: 'reports.asp.purpose', recipient: 'reports.asp.recipient', periodLabel: 'reports.asp.periodLabel' },
  cp: { title: 'reports.cp.title', purpose: 'reports.cp.purpose', recipient: 'reports.cp.recipient', periodLabel: 'reports.cp.periodLabel' },
  marac: { title: 'reports.marac.title', purpose: 'reports.marac.purpose', recipient: 'reports.marac.recipient', periodLabel: 'reports.marac.periodLabel' },
  mappa: { title: 'reports.mappa.title', purpose: 'reports.mappa.purpose', recipient: 'reports.mappa.recipient', periodLabel: 'reports.mappa.periodLabel' },
  awi: { title: 'reports.awi.title', purpose: 'reports.awi.purpose', recipient: 'reports.awi.recipient', periodLabel: 'reports.awi.periodLabel' },
} as const;

/** The five reports in index order. Read when asked for, not at module load, so an Admin override applies. */
export function reportCatalogue(): ReportCatalogueEntry[] {
  return (['asp', 'cp', 'marac', 'mappa', 'awi'] as const).map((kind) => {
    const keys = CATALOGUE_KEYS[kind];
    return { kind, title: t(keys.title), purpose: t(keys.purpose), recipient: t(keys.recipient), periodLabel: t(keys.periodLabel) };
  });
}

/** `guardianship-welfare` to `guardianshipWelfare`: a catalogue key segment from an enum value. */
export function messageSegment(id: string): string {
  return id
    .split(/[.-]/)
    .map((part, i) => (i === 0 ? part : part.charAt(0).toUpperCase() + part.slice(1)))
    .join('');
}

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

/** "50.0%", or the catalogue's not applicable value when there is nothing to divide by. */
export function pct(part: number, whole: number, digits = 1): string {
  if (whole === 0) return t('reports.values.notApplicable');
  return `${((part / whole) * 100).toFixed(digits)}%`;
}

/** Cases per 10,000 of a population, to two decimals. */
export function per10k(count: number, population: number): string {
  if (population <= 0) return t('reports.values.notApplicable');
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
