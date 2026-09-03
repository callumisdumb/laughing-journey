import { describe, expect, it } from 'vitest';
import { formatCalendarDate, parseTypedDate } from './dates';

describe('typed dates', () => {
  it('parses the formats a practitioner types to a calendar date', () => {
    expect(parseTypedDate('02 Sep 2026')).toBe('2026-09-02');
    expect(parseTypedDate('2 sep 2026')).toBe('2026-09-02');
    expect(parseTypedDate('2 September 2026')).toBe('2026-09-02');
    expect(parseTypedDate('02/09/2026')).toBe('2026-09-02');
    expect(parseTypedDate('2/9/2026')).toBe('2026-09-02');
    expect(parseTypedDate('2026-09-02')).toBe('2026-09-02');
    expect(parseTypedDate('  02  Sep   2026 ')).toBe('2026-09-02');
  });

  it('rejects text that is not a real date', () => {
    expect(parseTypedDate('')).toBeUndefined();
    expect(parseTypedDate('31 Feb 2026')).toBeUndefined();
    expect(parseTypedDate('09/02/2026 pm')).toBeUndefined();
    expect(parseTypedDate('Sep 2026')).toBeUndefined();
    expect(parseTypedDate('02 Sep 26')).toBeUndefined();
    expect(parseTypedDate('02 Sep 1850')).toBeUndefined();
  });

  it('formats a calendar date as dd Mon yyyy with no time zone shift', () => {
    expect(formatCalendarDate('2026-09-02')).toBe('02 Sep 2026');
    expect(formatCalendarDate('2026-03-29')).toBe('29 Mar 2026');
    expect(formatCalendarDate('')).toBe('');
    expect(formatCalendarDate('not a date')).toBe('');
  });
});
