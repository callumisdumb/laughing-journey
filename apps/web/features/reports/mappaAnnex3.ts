/**
 * MAPPA annual report: the nine tables in Annex 3 of the MAPPA National Guidance that every
 * Strategic Oversight Group report must carry (Management of Offenders etc. (Scotland) Act 2005
 * s11(3)). Reporting period 1 April to 31 March; point-in-time rows are read on 31 March.
 *
 * FIELD SET HIGH. The product owner confirmed on 03 Sep 2026 that the report carries these nine
 * tables for the year 1 April to 31 March: Tables 1, 3, 4, 5, 6, 7 and 9 from the record store,
 * Table 2 from the civil order register, Table 8 as "Data not held" only (D-048).
 *
 * PLACEHOLDER LABELS. The titles, column headers and row labels were recovered on 03 Sep 2026
 * from search extracts of published SOG annual reports and of the annex page; the annex itself
 * could not be read through the proxy (docs/RESEARCH.md, 6.7). They live in the message
 * catalogue under reports.mappaAnnex3.table<n> (title, column<i> by position, row<Id> by row id),
 * every one flagged verbatim; this file keeps only the ids and the shape of each table. When the
 * supplied Annex 3 text arrives, replace every title, column and row label in the catalogue word
 * for word. mappaModel.ts keys every figure on the row `id` and never on the wording, so the
 * catalogue is the only thing that changes.
 *
 * `confidence` records how each table's wording was recovered: 'extract' means the title (and
 * some rows) appear in a search extract of a published report; 'reconstructed' means the table's
 * place in the sequence is known but its wording was not read. It says nothing about the field
 * set, which is High for all nine.
 */
import { t, tKey } from '@mas/messages';

/** The cell value where the record store holds no figure. Read when asked for, so an Admin override applies. */
export function dataNotHeld(): string {
  return t('reports.mappaAnnex3.dataNotHeld');
}

/** Where the figures come from: the record store, the civil order register, or nowhere. */
export type AnnexSource = 'data' | 'orders' | 'not-held';

export interface AnnexRow {
  id: string;
}

export interface AnnexTable {
  id: 'table-1' | 'table-2' | 'table-3' | 'table-4' | 'table-5' | 'table-6' | 'table-7' | 'table-8' | 'table-9';
  number: 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9;
  /** How many columns the table has, the first being the row label column; the headers come from the catalogue by position. */
  columnCount: number;
  rows: AnnexRow[];
  source: AnnexSource;
  confidence: 'extract' | 'reconstructed';
}

/** `sopo-in-force` to `SopoInForce`: the row segment of a catalogue key. */
function pascal(id: string): string {
  return id
    .split(/[.-]/)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join('');
}

function group(table: AnnexTable): string {
  return `table${table.number}`;
}

export function annexTitle(table: AnnexTable): string {
  return tKey(`reports.mappaAnnex3.${group(table)}.title`);
}

export function annexColumns(table: AnnexTable): string[] {
  return Array.from({ length: table.columnCount }, (_, i) => tKey(`reports.mappaAnnex3.${group(table)}.column${i + 1}`));
}

export function annexRowLabel(table: AnnexTable, row: AnnexRow): string {
  return tKey(`reports.mappaAnnex3.${group(table)}.row${pascal(row.id)}`);
}

export const MAPPA_ANNEX3_TABLES: readonly AnnexTable[] = [
  {
    id: 'table-1',
    number: 1,
    columnCount: 2,
    rows: [{ id: 'community' }, { id: 'per-100k' }, { id: 'breach' }, { id: 'wanted' }, { id: 'missing' }],
    source: 'data',
    confidence: 'extract',
  },
  {
    id: 'table-2',
    number: 2,
    columnCount: 2,
    rows: [{ id: 'sopo-in-force' }, { id: 'sopo-made' }, { id: 'rsho-in-force' }, { id: 'rsho-made' }, { id: 'shpo-in-force' }, { id: 'shpo-made' }, { id: 'sro-in-force' }, { id: 'sro-made' }, { id: 'breach-convictions' }],
    source: 'orders',
    confidence: 'extract',
  },
  {
    id: 'table-3',
    number: 3,
    columnCount: 5,
    rows: [{ id: 'rso' }],
    source: 'data',
    confidence: 'reconstructed',
  },
  {
    id: 'table-4',
    number: 4,
    columnCount: 2,
    rows: [{ id: 'total' }, { id: 'level-1' }, { id: 'level-2' }, { id: 'level-3' }],
    source: 'data',
    confidence: 'extract',
  },
  {
    id: 'table-5',
    number: 5,
    columnCount: 2,
    rows: [{ id: 'total' }, { id: 'level-2' }, { id: 'level-3' }, { id: 'referred' }],
    source: 'data',
    confidence: 'reconstructed',
  },
  {
    id: 'table-6',
    number: 6,
    columnCount: 2,
    rows: [{ id: 'male' }, { id: 'female' }, { id: 'not-recorded' }, { id: 'total' }],
    source: 'data',
    confidence: 'reconstructed',
  },
  {
    id: 'table-7',
    number: 7,
    columnCount: 2,
    rows: [{ id: 'supervision' }, { id: 'sonr-only' }, { id: 'total' }],
    source: 'data',
    confidence: 'extract',
  },
  {
    id: 'table-8',
    number: 8,
    columnCount: 2,
    rows: [{ id: 'category-1' }, { id: 'category-2' }, { id: 'category-3' }],
    source: 'not-held',
    confidence: 'reconstructed',
  },
  {
    id: 'table-9',
    number: 9,
    columnCount: 2,
    rows: [{ id: 'in-custody' }, { id: 'released' }, { id: 'returned' }, { id: 'licence-breaches' }],
    source: 'data',
    confidence: 'reconstructed',
  },
];
