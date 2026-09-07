/**
 * The SafeLives return cell map: one meeting's figures to the cells of one row.
 *
 * Pure, and a function of figures rather than of the dataset, for the same reason the NMDS map is:
 * the counting and the placing can be wrong independently, and a test can prove the placing against
 * the template without a seed. The first meeting goes in row 2, under the headers, and each meeting
 * takes the next row; nothing is written to row 1.
 *
 * A characteristic the product does not hold is `undefined` on the row and emits no cell at all.
 * The template has no formulas, so there is nothing to refuse; what there is to get wrong is writing
 * a zero where the honest answer is a blank, and the map cannot, because it has no zero to write.
 */
import { SAFELIVES_SOURCES, type SafeLivesSource } from '../enums';
import { SAFELIVES_COLUMNS, safeLivesColumnLetter, safeLivesSourceColumn, type SafeLivesColumn } from './columns';

/** The victim and perpetrator characteristics of the cases at one meeting. Optional ones are not held. */
export interface SafeLivesCharacteristics {
  minoritisedTotal?: number;
  lgbtq?: number;
  disabled?: number;
  maleVictims: number;
  victims16or17: number;
  harmingUnder18: number;
  victims65Plus: number;
  ethnicityAsian?: number;
  ethnicityBlack?: number;
  ethnicityMixed?: number;
  ethnicityOtherWhite?: number;
  ethnicityOther?: number;
}

/** One row of the return: one meeting. */
export interface SafeLivesMeetingRow {
  maracName: string;
  /** The meeting date as a calendar date (yyyy-MM-dd); the writer makes it a date cell. */
  meetingDate: string;
  casesDiscussed: number;
  repeatCases: number;
  childrenInHousehold: number;
  casesWithChildren: number;
  sources: Record<SafeLivesSource, number>;
  characteristics: SafeLivesCharacteristics;
}

export interface SafeLivesCell {
  /** The spreadsheet row, 2 for the first meeting. */
  row: number;
  column: SafeLivesColumn;
  /** The cell reference, e.g. `G2`. */
  cell: string;
  kind: 'text' | 'date' | 'count';
  value: string | number;
}

export const SAFELIVES_FIRST_DATA_ROW = 2;

export function emptySafeLivesSources(): Record<SafeLivesSource, number> {
  return Object.fromEntries(SAFELIVES_SOURCES.map((s) => [s, 0])) as Record<SafeLivesSource, number>;
}

/** The value one column takes on a row, or undefined where the product holds nothing for it. */
export function safeLivesRowValue(row: SafeLivesMeetingRow, column: SafeLivesColumn): string | number | undefined {
  switch (column) {
    case 'maracName':
      return row.maracName;
    case 'meetingDate':
      return row.meetingDate;
    case 'casesDiscussed':
      return row.casesDiscussed;
    case 'repeatCases':
      return row.repeatCases;
    case 'childrenInHousehold':
      return row.childrenInHousehold;
    case 'casesWithChildren':
      return row.casesWithChildren;
    default: {
      const source = SAFELIVES_SOURCES.find((s) => safeLivesSourceColumn(s) === column);
      if (source) return row.sources[source];
      return row.characteristics[column as keyof SafeLivesCharacteristics];
    }
  }
}

function kindOf(column: SafeLivesColumn): SafeLivesCell['kind'] {
  if (column === 'maracName') return 'text';
  if (column === 'meetingDate') return 'date';
  return 'count';
}

/** Every cell the return writes for these meetings, row by row, column by column, template order. */
export function safeLivesCellMap(rows: readonly SafeLivesMeetingRow[]): SafeLivesCell[] {
  const out: SafeLivesCell[] = [];
  rows.forEach((row, i) => {
    const rowNumber = SAFELIVES_FIRST_DATA_ROW + i;
    for (const column of SAFELIVES_COLUMNS) {
      const value = safeLivesRowValue(row, column);
      if (value === undefined) continue;
      out.push({ row: rowNumber, column, cell: `${safeLivesColumnLetter(column)}${rowNumber}`, kind: kindOf(column), value });
    }
  });
  return out;
}

/** The three arithmetic checks the return has to pass before it is sent, per meeting. */
export interface SafeLivesCheck {
  id: 'repeats' | 'children' | 'sources';
  state: 'pass' | 'fail';
  counted: number;
  expected: number;
}

export function safeLivesChecks(row: SafeLivesMeetingRow): SafeLivesCheck[] {
  const sourceTotal = SAFELIVES_SOURCES.reduce((n, s) => n + row.sources[s], 0);
  return [
    { id: 'repeats', state: row.repeatCases <= row.casesDiscussed ? 'pass' : 'fail', counted: row.repeatCases, expected: row.casesDiscussed },
    { id: 'children', state: row.casesWithChildren <= row.casesDiscussed ? 'pass' : 'fail', counted: row.casesWithChildren, expected: row.casesDiscussed },
    { id: 'sources', state: sourceTotal === row.casesDiscussed ? 'pass' : 'fail', counted: sourceTotal, expected: row.casesDiscussed },
  ];
}
