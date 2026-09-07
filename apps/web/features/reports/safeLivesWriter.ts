/**
 * Filling the SafeLives MARAC data template.
 *
 * The template is one sheet with a header row and nothing else, so there is nothing to refuse the
 * way the ASP workbook's formulas are refused (D-060). What there is to check is that the file is
 * the template at all: the writer reads row 1 of whatever it was handed and compares every header
 * with the one the column map expects. A file whose headers differ is refused whole, with the
 * mismatches listed, because a return written under the wrong headers would be uploaded to the
 * wrong columns and would look right. A template that already holds rows is refused too: the return
 * is a fresh file per quarter, not an append.
 *
 * The meeting date is written as a real date cell, not text, so the platform reads it as a date.
 * Every other written cell is a number. Cells the product holds nothing for are not written at all.
 */
import { SAFELIVES_COLUMNS, SAFELIVES_FIRST_DATA_ROW, safeLivesCellMap, safeLivesColumnHeader, safeLivesColumnLetter, type SafeLivesCell, type SafeLivesMeetingRow } from '@mas/domain';
import ExcelJS from 'exceljs';

export interface HeaderMismatch {
  cell: string;
  expected: string;
  found: string;
}

export interface SafeLivesFillResult {
  /** The filled return, ready to be saved. Absent where the file was refused. */
  file?: Blob;
  written: SafeLivesCell[];
  headerMismatches: HeaderMismatch[];
  error?: 'unreadable' | 'no-sheet' | 'headers' | 'not-empty';
}

const XLSX_TYPE = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';

export async function fillSafeLivesTemplate(template: ArrayBuffer, rows: readonly SafeLivesMeetingRow[]): Promise<SafeLivesFillResult> {
  const book = new ExcelJS.Workbook();
  try {
    await book.xlsx.load(template);
  } catch {
    return { written: [], headerMismatches: [], error: 'unreadable' };
  }
  const sheet = book.worksheets[0];
  if (!sheet) return { written: [], headerMismatches: [], error: 'no-sheet' };

  const headerMismatches: HeaderMismatch[] = [];
  for (const column of SAFELIVES_COLUMNS) {
    const cell = `${safeLivesColumnLetter(column)}1`;
    const expected = safeLivesColumnHeader(column);
    const found = sheet.getCell(cell).text.trim();
    if (found !== expected) headerMismatches.push({ cell, expected, found });
  }
  if (headerMismatches.length > 0) return { written: [], headerMismatches, error: 'headers' };

  // Anything under the header row means this is not a blank copy of the template.
  let occupied = false;
  sheet.eachRow({ includeEmpty: false }, (row, n) => {
    if (n < SAFELIVES_FIRST_DATA_ROW) return;
    row.eachCell({ includeEmpty: false }, (c) => {
      if (c.value !== null && c.value !== undefined && String(c.text).trim() !== '') occupied = true;
    });
  });
  if (occupied) return { written: [], headerMismatches: [], error: 'not-empty' };

  const cells = safeLivesCellMap(rows);
  for (const target of cells) {
    const cell = sheet.getCell(target.cell);
    if (target.kind === 'date') {
      const [y, m, d] = String(target.value).split('-').map(Number);
      cell.value = new Date(Date.UTC(y ?? 1970, (m ?? 1) - 1, d ?? 1));
      cell.numFmt = 'dd/mm/yyyy';
    } else {
      cell.value = target.value;
    }
  }
  const buffer = await book.xlsx.writeBuffer();
  return { file: new Blob([buffer], { type: XLSX_TYPE }), written: cells, headerMismatches: [] };
}
