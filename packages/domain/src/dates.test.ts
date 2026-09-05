import { describe, expect, it } from 'vitest';
import { demoNow, formatCalendarDate, isValidIso, parseDemoNow, parseTypedDate } from './dates';

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

describe('the settable demo instant', () => {
  it('takes a valid instant', () => {
    expect(parseDemoNow('2026-10-01T09:00:00+01:00').toISOString()).toBe('2026-10-01T08:00:00.000Z');
  });

  it('falls back to the seeded instant rather than returning an Invalid Date', () => {
    // A screen full of "NaN days remaining" is a worse failure than a clock that did not move, so
    // the parse is total. The store refuses the bad value separately, so this is the last defence
    // rather than the only one.
    expect(parseDemoNow('the day before yesterday').toISOString()).toBe(demoNow().toISOString());
    expect(parseDemoNow('').toISOString()).toBe(demoNow().toISOString());
    expect(parseDemoNow(undefined).toISOString()).toBe(demoNow().toISOString());
    expect(parseDemoNow(null).toISOString()).toBe(demoNow().toISOString());
  });

  it('tells a caller whether an instant is usable, so a control can refuse rather than reset', () => {
    expect(isValidIso('2026-10-01T09:00:00+01:00')).toBe(true);
    expect(isValidIso('2026-10-01')).toBe(true);
    expect(isValidIso('the day before yesterday')).toBe(false);
    expect(isValidIso('')).toBe(false);
  });
});
