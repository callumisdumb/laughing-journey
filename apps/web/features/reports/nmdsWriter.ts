/**
 * Filling the ASP data workbook.
 *
 * The export takes the blank template the Scottish Government publishes, writes one quarter's
 * figures into it, and hands back a workbook a Lead Officer can open, check and send on. It does not
 * build a spreadsheet of our own: the return is a specific file with specific sheets, formulas,
 * charts and validation, and a lookalike would be rejected on sight.
 *
 * The guard is the point of this module. `nmdsCellMap` already refuses to emit a cell the workbook
 * computes, but the map is written against one edition of the template and the template changes
 * every year. So before writing anything, `fillWorkbook` reads the template it was actually handed
 * and checks each target cell again. A cell that holds a formula is refused, not overwritten, and
 * the refusal is returned rather than thrown: the preview screen shows what was skipped and why, so
 * a new edition surfaces as a visible list rather than as a workbook that quietly stops adding up
 * (D-060).
 *
 * The template is loaded from a file the user chooses. Nothing is fetched: the product makes no
 * network calls, and the template is not ours to redistribute inside the application bundle.
 */
import { nmdsCellMap, type NmdsCell, type NmdsFigures, type NmdsQuarter } from '@mas/domain';
import ExcelJS from 'exceljs';

export interface FillResult {
  /** The filled workbook, ready to be saved. Absent where the template could not be read. */
  file?: Blob;
  /** Cells written, in the order the map produced them. */
  written: NmdsCell[];
  /** Cells refused because the template computes them, with the formula found. */
  refused: Array<{ cell: NmdsCell; formula: string }>;
  /** Sheets the map expected and the template does not have. */
  missingSheets: string[];
  /** Why the fill failed outright, where it did. */
  error?: string;
}

/** The name a filled workbook is saved as. The quarter is in it, because the return is per quarter. */
export function workbookFileName(quarter: NmdsQuarter, area: string): string {
  const safeArea = area.replace(/[^A-Za-z0-9]+/g, '-').replace(/^-|-$/g, '');
  return `ASP-NMDS-2026-27-${quarter.toUpperCase()}-${safeArea}.xlsx`;
}

/**
 * Write a quarter's figures into a copy of the template. Pure in effect: the template buffer is not
 * modified, and nothing is written where the template disagrees with the map.
 */
export async function fillWorkbook(template: ArrayBuffer, figures: NmdsFigures, quarter: NmdsQuarter): Promise<FillResult> {
  const cells = nmdsCellMap(figures, quarter);
  const written: NmdsCell[] = [];
  const refused: FillResult['refused'] = [];
  const missingSheets = new Set<string>();

  const book = new ExcelJS.Workbook();
  try {
    await book.xlsx.load(template);
  } catch {
    return { written: [], refused: [], missingSheets: [], error: 'unreadable' };
  }

  for (const target of cells) {
    const sheet = book.getWorksheet(target.sheet);
    if (!sheet) {
      missingSheets.add(target.sheet);
      continue;
    }
    const cell = sheet.getCell(target.cell);
    // A formula cell is refused, never overwritten. ExcelJS exposes one as an object carrying a
    // `formula` or a `sharedFormula`; the workbook's totals are shared, so both are checked.
    const value = cell.value as { formula?: string; sharedFormula?: string } | null;
    const formula = typeof value === 'object' && value !== null ? (value.formula ?? value.sharedFormula) : undefined;
    if (formula !== undefined) {
      refused.push({ cell: target, formula });
      continue;
    }
    cell.value = target.value;
    written.push(target);
  }

  const buffer = await book.xlsx.writeBuffer();
  return {
    file: new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }),
    written,
    refused,
    missingSheets: [...missingSheets],
  };
}
