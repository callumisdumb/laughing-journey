/**
 * Statistical disclosure control for the reports a partnership publishes.
 *
 * The Mental Welfare Commission suppresses any count of five or fewer in its monitoring tables, and
 * any second count that would let the first be recovered from a total, printing an asterisk and
 * saying so in a footnote (docs/RESEARCH.md 9.3). A partnership-level report has small numbers
 * everywhere, so the same rule is applied to every report screen and print pack here (D-237): a
 * Chief Officers Group can publish a table that follows it and cannot publish one that does not.
 *
 * The rule, in one place so every table reads the same way:
 *
 * - A count of one to five in a count column is suppressed. Zero is not: "none" reveals nothing.
 * - Within a count column, where exactly one count has been suppressed, the smallest remaining
 *   non-zero count is suppressed too, so the total (shown in a total row, a headline figure or the
 *   meta line) cannot give the first one back. Where no other non-zero count exists and the table
 *   carries a total row, the total is suppressed instead.
 * - A derived value in the same row (a percentage, a rate) is suppressed with the count it derives
 *   from, because a share of a known total is the count by another route.
 *
 * The two returns to national bodies (the ASP data workbook and the SafeLives return) are not
 * subject to this: they carry the raw counts the return asks for, and the national body applies its
 * own control before it publishes (D-234).
 */
export const SUPPRESSION_THRESHOLD = 5;

/** What a suppressed cell prints. The Commission's own mark. */
export const SUPPRESSED = '*';

export type Cell = string | number;

export interface DisclosureOptions {
  /** Column indexes that hold counts and derived values (right-aligned numbers). */
  numericColumns: readonly number[];
  /** The last row is a total of the rows above it. */
  totalRow?: boolean;
}

export interface DisclosureResult {
  rows: Cell[][];
  /** How many cells were suppressed, primary and secondary together. */
  suppressed: number;
}

/** Whether a value is a count that has to be suppressed on its own: an integer from one to the threshold. */
export function isSmallCount(value: Cell): boolean {
  return typeof value === 'number' && Number.isInteger(value) && value >= 1 && value <= SUPPRESSION_THRESHOLD;
}

/** A headline figure: the count, or the mark where it is small. */
export function suppressCount(value: number): string {
  return isSmallCount(value) ? SUPPRESSED : String(value);
}

/** Apply the rule to a table's rows. Pure: the rows given are not modified. */
export function applyDisclosureControl(rows: readonly (readonly Cell[])[], options: DisclosureOptions): DisclosureResult {
  const out: Cell[][] = rows.map((row) => [...row]);
  const numeric = new Set(options.numericColumns);
  const bodyEnd = options.totalRow && out.length > 0 ? out.length - 1 : out.length;
  const hidden = new Set<string>();
  const hide = (r: number, c: number) => hidden.add(`${r}:${c}`);

  // Primary suppression: every small count, total row included.
  out.forEach((row, r) => row.forEach((cell, c) => {
    if (numeric.has(c) && isSmallCount(cell)) hide(r, c);
  }));

  // Secondary suppression, per count column, over the body rows.
  for (const c of numeric) {
    const body = out.slice(0, bodyEnd).map((row, r) => ({ r, value: row[c] }));
    const counts = body.filter((x) => typeof x.value === 'number');
    if (counts.length === 0) continue;
    const primary = counts.filter((x) => hidden.has(`${x.r}:${c}`));
    if (primary.length !== 1) continue;
    const others = counts.filter((x) => !hidden.has(`${x.r}:${c}`) && (x.value as number) > 0).sort((a, b) => (a.value as number) - (b.value as number));
    const next = others[0];
    if (next) hide(next.r, c);
    else if (options.totalRow && typeof out[out.length - 1]?.[c] === 'number') hide(out.length - 1, c);
  }

  // A derived value goes with the count it derives from: any other numeric cell on a row with a hidden count.
  const rowsWithHidden = new Set([...hidden].map((key) => Number(key.split(':')[0])));
  for (const r of rowsWithHidden) {
    out[r]?.forEach((cell, c) => {
      if (numeric.has(c) && typeof cell === 'string' && cell.trim() !== '' && !hidden.has(`${r}:${c}`) && /\d/.test(cell)) hide(r, c);
    });
  }

  let suppressed = 0;
  for (const key of hidden) {
    const [r, c] = key.split(':').map(Number);
    const row = out[r ?? -1];
    if (row && c !== undefined) {
      row[c] = SUPPRESSED;
      suppressed += 1;
    }
  }
  return { rows: out, suppressed };
}
