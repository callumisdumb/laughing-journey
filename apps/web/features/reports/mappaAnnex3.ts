/**
 * MAPPA annual report: the nine tables Annex 3 of the MAPPA National Guidance requires in every
 * Strategic Oversight Group report. Section 11 of the Management of Offenders etc. (Scotland) Act
 * 2005 sets out the duty to publish an annual report and to give information to Scottish Ministers.
 * The reporting period is 1 April to 31 March, and point-in-time rows are read on 31 March.
 *
 * The row labels, column headers and table titles are the annex's own wording, supplied verbatim by
 * the product owner on 03 Sep 2026 from the 2022 guidance (docs/RESEARCH.md, 5.12). They are
 * flagged verbatim in en-GB.context.json: an editor may correct them against a newer edition of the
 * annex but must not paraphrase them. The catalogue holds the text; this file holds the shape, and
 * mappaModel.ts keys every figure on a row id so wording and figures never depend on each other.
 *
 * The first column of a table the annex prints without a corner heading carries a short accessible
 * heading of ours (a column header cannot be empty for a screen reader); every other header is the
 * annex's.
 */
import { t, tKey } from '@mas/messages';

/** The cell value where the record store holds no figure. Read when asked for, so an Admin override applies. */
export function dataNotHeld(): string {
  return t('reports.mappaAnnex3.dataNotHeld');
}

/** Where the figures come from: the record store, or the civil order register. */
export type AnnexSource = 'data' | 'orders';

export interface AnnexRow {
  id: string;
  /** A lettered heading the annex prints above its numbered parts; it carries no figure of its own. */
  group?: true;
}

export interface AnnexTable {
  id: 'table-1' | 'table-2' | 'table-3' | 'table-4' | 'table-5' | 'table-6' | 'table-7' | 'table-8' | 'table-9';
  number: 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9;
  /** How many columns the table has, the first being the row label column; the headers come from the catalogue by position. */
  columnCount: number;
  rows: AnnexRow[];
  source: AnnexSource;
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
    rows: [{ id: 'rsos', group: true }, { id: 'at-liberty' }, { id: 'per-100k' }, { id: 'breaches' }, { id: 'wanted' }, { id: 'missing' }],
    source: 'data',
  },
  {
    id: 'table-2',
    number: 2,
    columnCount: 2,
    rows: [
      { id: 'sopo-in-force' },
      { id: 'sopo-granted' },
      { id: 'rsho-in-force' },
      { id: 'shpo-in-force' },
      { id: 'shpo-granted' },
      { id: 'sro-in-force' },
      { id: 'sopo-breach' },
      { id: 'shpo-breach' },
      { id: 'rsho-breach' },
      { id: 'sro-breach' },
      { id: 'foreign-travel' },
      { id: 'notification-orders' },
    ],
    source: 'orders',
  },
  {
    id: 'table-3',
    number: 3,
    columnCount: 4,
    rows: [
      { id: 'by-level', group: true },
      { id: 'level-1' },
      { id: 'level-2' },
      { id: 'level-3' },
      { id: 'further-conviction' },
      { id: 'returned-to-custody' },
      { id: 'sonr-indefinite-review' },
      { id: 'notification-continuation' },
      { id: 'formal-disclosure' },
    ],
    source: 'data',
  },
  {
    id: 'table-4',
    number: 4,
    columnCount: 2,
    rows: [
      { id: 'patients', group: true },
      { id: 'living-in-area' },
      { id: 'during-year' },
      { id: 'setting', group: true },
      { id: 'state-hospital' },
      { id: 'other-hospital' },
      { id: 'community' },
      { id: 'by-level', group: true },
      { id: 'level-1' },
      { id: 'level-2' },
      { id: 'level-3' },
      { id: 'recalled' },
    ],
    source: 'data',
  },
  {
    id: 'table-5',
    number: 5,
    // The annex gives Category 3 offenders no Level 1 row: they cannot be managed at Level 1.
    columnCount: 2,
    rows: [
      { id: 'by-level', group: true },
      { id: 'level-2' },
      { id: 'level-3' },
      { id: 'further-conviction', group: true },
      { id: 'further-conviction-level-2' },
      { id: 'further-conviction-level-3' },
      { id: 'returned-to-custody' },
      { id: 'dwp-notifications' },
    ],
    source: 'data',
  },
  {
    id: 'table-6',
    number: 6,
    columnCount: 3,
    rows: [{ id: 'under-18' }, { id: 'age-18-21' }, { id: 'age-22-25' }, { id: 'age-26-30' }, { id: 'age-31-40' }, { id: 'age-41-50' }, { id: 'age-51-60' }, { id: 'age-61-70' }, { id: 'over-70' }, { id: 'total' }],
    source: 'data',
  },
  {
    id: 'table-7',
    number: 7,
    columnCount: 3,
    rows: [{ id: 'male' }, { id: 'female' }, { id: 'other' }, { id: 'total' }],
    source: 'data',
  },
  {
    id: 'table-8',
    number: 8,
    // Every row is present and every count is zero except "Data Not held": the dataset holds no
    // ethnicity by design (brief section 9), and a return to Ministers must show that honestly
    // rather than leave the table out.
    columnCount: 3,
    rows: [
      { id: 'white-scottish' },
      { id: 'other-british' },
      { id: 'irish' },
      { id: 'gypsy-traveller' },
      { id: 'polish' },
      { id: 'other-white' },
      { id: 'mixed-or-multiple' },
      { id: 'pakistani' },
      { id: 'indian' },
      { id: 'bangladeshi' },
      { id: 'chinese' },
      { id: 'other-asian' },
      { id: 'african' },
      { id: 'other-african' },
      { id: 'caribbean' },
      { id: 'black' },
      { id: 'other-caribbean-or-black' },
      { id: 'arab' },
      { id: 'other-ethnic-group' },
      { id: 'prefer-not-to-say' },
      { id: 'data-not-held' },
      { id: 'total' },
    ],
    source: 'data',
  },
  {
    id: 'table-9',
    number: 9,
    columnCount: 3,
    rows: [{ id: 'statutory-supervision' }, { id: 'notification-only' }, { id: 'total' }],
    source: 'data',
  },
];

/** The ethnicity row that carries the whole population while the dataset holds no ethnicity. */
export const ETHNICITY_NOT_HELD_ROW = 'data-not-held';

/** Table 8's rows that must always read zero. Asserted in reports.test.ts. */
export const ETHNICITY_ZERO_ROWS: readonly string[] = (MAPPA_ANNEX3_TABLES.find((table) => table.id === 'table-8')?.rows ?? [])
  .map((row) => row.id)
  .filter((id) => id !== ETHNICITY_NOT_HELD_ROW && id !== 'total');
