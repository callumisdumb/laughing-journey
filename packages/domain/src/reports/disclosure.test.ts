import { describe, expect, it } from 'vitest';
import { SUPPRESSED, SUPPRESSION_THRESHOLD, applyDisclosureControl, isSmallCount, suppressCount } from './disclosure';

describe('statistical disclosure control', () => {
  it('suppresses a count of one to five and leaves zero and six alone', () => {
    expect(SUPPRESSION_THRESHOLD).toBe(5);
    expect([0, 1, 5, 6, 12].map(isSmallCount)).toEqual([false, true, true, false, false]);
    expect(suppressCount(3)).toBe(SUPPRESSED);
    expect(suppressCount(0)).toBe('0');
    expect(suppressCount(40)).toBe('40');
    expect(isSmallCount('3')).toBe(false);
  });

  it('applies secondary suppression to the smallest remaining count when one small count would otherwise be recoverable', () => {
    const { rows, suppressed } = applyDisclosureControl(
      [
        ['Male', 3, '20.0%'],
        ['Female', 12, '80.0%'],
        ['Total', 15, '100.0%'],
      ],
      { numericColumns: [1, 2], totalRow: true },
    );
    expect(rows).toEqual([
      ['Male', SUPPRESSED, SUPPRESSED],
      ['Female', SUPPRESSED, SUPPRESSED],
      ['Total', 15, '100.0%'],
    ]);
    expect(suppressed).toBe(4);
  });

  it('leaves a column alone where two or more counts are already suppressed, or none are', () => {
    expect(applyDisclosureControl([['a', 2], ['b', 4], ['c', 30]], { numericColumns: [1] }).rows).toEqual([['a', SUPPRESSED], ['b', SUPPRESSED], ['c', 30]]);
    expect(applyDisclosureControl([['a', 0], ['b', 40], ['c', 30]], { numericColumns: [1] }).suppressed).toBe(0);
  });

  it('suppresses the total where the only other counts are zero', () => {
    const { rows } = applyDisclosureControl([['a', 2], ['b', 0], ['Total', 2]], { numericColumns: [1], totalRow: true });
    expect(rows).toEqual([['a', SUPPRESSED], ['b', 0], ['Total', SUPPRESSED]]);
  });

  it('takes a derived value with its count and never touches a label or a text cell', () => {
    const { rows } = applyDisclosureControl([['Cases per 10,000', 4, '0.98'], ['Not recorded', 'Not recorded', 'The record store holds no field'], ['Police', 40, '100.0%']], { numericColumns: [1, 2] });
    expect(rows[0]).toEqual(['Cases per 10,000', SUPPRESSED, SUPPRESSED]);
    expect(rows[1]).toEqual(['Not recorded', 'Not recorded', 'The record store holds no field']);
    // The next smallest is 40, which is not small, but it is the only other count and it hides the 4.
    expect(rows[2]).toEqual(['Police', SUPPRESSED, SUPPRESSED]);
  });

  it('does not modify the rows it was given', () => {
    const input = [['a', 2]];
    applyDisclosureControl(input, { numericColumns: [1] });
    expect(input).toEqual([['a', 2]]);
  });
});
