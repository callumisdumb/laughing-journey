/**
 * Disclosure control applied to a whole report: every table through the domain rule, every headline
 * figure that is a plain count, and a note of how much was suppressed so the frame and the print
 * pack can print the footnote once (D-237). The models stay raw, so the tests that prove figures are
 * computed from the seed read the counts; what a reader sees is always this.
 */
import { applyDisclosureControl, suppressCount } from '@mas/domain';
import type { ReportModel, TableSpec } from './model';

export function discloseTable(table: TableSpec): { table: TableSpec; suppressed: number } {
  const { rows, suppressed } = applyDisclosureControl(table.rows, { numericColumns: table.numeric ?? [], totalRow: table.totalRow });
  return { table: { ...table, rows }, suppressed };
}

export function withDisclosureControl(model: ReportModel): ReportModel {
  let suppressed = 0;
  const sections = model.sections.map((section) => ({
    ...section,
    tables: section.tables.map((table) => {
      const result = discloseTable(table);
      suppressed += result.suppressed;
      return result.table;
    }),
  }));
  const figures = model.figures.map((figure) => {
    if (!/^\d+$/.test(figure.value)) return figure;
    const shown = suppressCount(Number(figure.value));
    if (shown !== figure.value) suppressed += 1;
    return { ...figure, value: shown };
  });
  return { ...model, sections, figures, disclosure: { suppressed } };
}
