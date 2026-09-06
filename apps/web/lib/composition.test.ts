import { describe, expect, it } from 'vitest';
import { composeRows, GRID_COLUMNS, placedSpans } from './composition';

const sum = (row: { span: number }[]) => row.reduce((n, c) => n + c.span, 0);

describe('composeRows', () => {
  const rows = [
    [
      { id: 'clocks', span: 4 },
      { id: 'alerts', span: 4 },
      { id: 'contacts', span: 4 },
    ],
    [
      { id: 'household', span: 8 },
      { id: 'voice', span: 4 },
    ],
    [
      { id: 'recent', span: 8 },
      { id: 'plans', span: 4 },
    ],
    [{ id: 'history', span: 12 }],
  ];

  it('keeps the declared spans at wide when every card is present', () => {
    const placed = composeRows(rows, 'wide');
    expect(placed.map((r) => r.map((c) => c.span))).toEqual([[4, 4, 4], [8, 4], [8, 4], [12]]);
  });

  it('hands an absent card its columns to the cards beside it', () => {
    const withoutCase = rows.map((row) => row.map((c) => ({ ...c, present: !['contacts', 'plans'].includes(c.id) })));
    const placed = composeRows(withoutCase, 'wide');
    expect(placed.map((r) => r.map((c) => `${c.id}:${c.span}`))).toEqual([['clocks:6', 'alerts:6'], ['household:8', 'voice:4'], ['recent:12'], ['history:12']]);
  });

  it('turns fours into sixes and wider cards into twelves at standard, and fills the leftover line', () => {
    const placed = composeRows(rows, 'standard');
    expect(placed.map((r) => r.map((c) => c.span))).toEqual([[6, 6], [12], [12], [12], [12], [12], [12]]);
    expect(placedSpans(placed).get('contacts')).toBe(12);
  });

  it('is one column at compact and narrow', () => {
    for (const mode of ['compact', 'narrow'] as const) {
      const placed = composeRows(rows, mode);
      expect(placed.every((r) => r.length === 1 && r[0]?.span === GRID_COLUMNS)).toBe(true);
    }
  });

  it('never leaves a row short of twelve, whatever is absent', () => {
    const ids = rows.flat().map((c) => c.id);
    for (let mask = 0; mask < 1 << ids.length; mask += 1) {
      const absent = new Set(ids.filter((_, i) => mask & (1 << i)));
      const declared = rows.map((row) => row.map((c) => ({ ...c, present: !absent.has(c.id) })));
      for (const mode of ['wide', 'standard', 'compact', 'narrow'] as const) {
        for (const row of composeRows(declared, mode)) expect(sum(row)).toBe(GRID_COLUMNS);
      }
    }
  });

  it('skips a row with nothing present rather than emitting an empty one', () => {
    expect(composeRows([[{ id: 'a', span: 4, present: false }]], 'wide')).toEqual([]);
  });
});
