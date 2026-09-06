import type { LayoutMode } from './layout';

/**
 * Packing cards into a twelve-column grid.
 *
 * A screen that composes cards declares its rows once, as an ordered list of cards with the span
 * each would take at `wide`, and marks the ones that are present. This turns that declaration into
 * grid rows that always sum to twelve, so that a card which is absent because it has nothing to show
 * (there is no case, so there are no key contacts) hands its columns to the cards beside it rather
 * than leaving them empty, and a narrower mode reflows the same declaration rather than a second one.
 *
 * The modes: `wide` uses the spans as declared; `standard` turns every span of four or less into six
 * and everything wider into twelve, so a row of three fours becomes two sixes and a twelve; `compact`
 * and `narrow` are all twelve. Whatever the mode, a line is filled greedily and then scaled to twelve,
 * which is what keeps the assertion "no row has more than one empty column" true by construction
 * rather than by inspection (D-229).
 */
export interface CardSlot {
  id: string;
  /** Columns at `wide`, out of twelve. */
  span: number;
  /** Absent cards are dropped before packing. Defaults to present. */
  present?: boolean;
}

export interface PlacedCard {
  id: string;
  span: number;
}

export const GRID_COLUMNS = 12;

function spanFor(span: number, mode: LayoutMode): number {
  switch (mode) {
    case 'wide':
      return Math.min(GRID_COLUMNS, Math.max(1, span));
    case 'standard':
      return span <= 4 ? 6 : GRID_COLUMNS;
    default:
      return GRID_COLUMNS;
  }
}

/** Scale a line's spans so they sum to twelve, giving any remainder to the widest cards first. */
function fill(line: PlacedCard[]): PlacedCard[] {
  const total = line.reduce((n, c) => n + c.span, 0);
  if (total === GRID_COLUMNS) return line;
  const scaled = line.map((c) => ({ ...c, span: Math.max(1, Math.floor((c.span * GRID_COLUMNS) / total)) }));
  let remainder = GRID_COLUMNS - scaled.reduce((n, c) => n + c.span, 0);
  const byWidth = [...scaled.keys()].sort((a, b) => (scaled[b]?.span ?? 0) - (scaled[a]?.span ?? 0));
  for (let i = 0; remainder > 0; i = (i + 1) % byWidth.length) {
    const target = scaled[byWidth[i] ?? 0];
    if (target) target.span += 1;
    remainder -= 1;
  }
  return scaled;
}

export function composeRows(rows: readonly (readonly CardSlot[])[], mode: LayoutMode): PlacedCard[][] {
  const out: PlacedCard[][] = [];
  for (const row of rows) {
    const present = row.filter((c) => c.present !== false).map((c) => ({ id: c.id, span: spanFor(c.span, mode) }));
    if (present.length === 0) continue;
    let line: PlacedCard[] = [];
    let used = 0;
    for (const card of present) {
      if (used + card.span > GRID_COLUMNS && line.length > 0) {
        out.push(fill(line));
        line = [];
        used = 0;
      }
      line.push(card);
      used += card.span;
    }
    if (line.length > 0) out.push(fill(line));
  }
  return out;
}

/** The placed span of one card, or undefined when the card was absent. */
export function placedSpans(rows: PlacedCard[][]): Map<string, number> {
  const map = new Map<string, number>();
  for (const row of rows) for (const card of row) map.set(card.id, card.span);
  return map;
}
