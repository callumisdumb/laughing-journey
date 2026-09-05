import { describe, expect, it } from 'vitest';
import { isSyntheticChiShape, syntheticChi } from './chi';

describe('syntheticChi', () => {
  it('opens with the date of birth as ddmmyy', () => {
    expect(syntheticChi('1988-05-14', 'male', 1).slice(0, 6)).toBe('140588');
  });

  it('is ten digits', () => {
    for (const serial of [0, 1, 7, 42, 899, 900, 1234]) {
      const chi = syntheticChi('2019-03-04', 'female', serial);
      expect(chi).toHaveLength(10);
      expect(isSyntheticChiShape(chi)).toBe(true);
    }
  });

  it('gives men an odd ninth digit and everybody else an even one', () => {
    for (const serial of [0, 1, 2, 3, 4, 5, 17, 88]) {
      expect(Number(syntheticChi('1974-06-08', 'male', serial)[8]) % 2).toBe(1);
      expect(Number(syntheticChi('1974-06-08', 'female', serial)[8]) % 2).toBe(0);
      expect(Number(syntheticChi('1974-06-08', 'not-recorded', serial)[8]) % 2).toBe(0);
    }
  });

  it('is deterministic, so the same person generated twice is the same number', () => {
    expect(syntheticChi('2007-01-25', 'female', 12)).toBe(syntheticChi('2007-01-25', 'female', 12));
  });

  it('satisfies the schema the person record holds CHI numbers in', () => {
    expect(/^\d{10}$/.test(syntheticChi('1947-02-19', 'female', 3))).toBe(true);
  });

  it('rejects anything that is not ten digits as a CHI shape', () => {
    expect(isSyntheticChiShape('140588123')).toBe(false);
    expect(isSyntheticChiShape('14058812345')).toBe(false);
    expect(isSyntheticChiShape('14058812a4')).toBe(false);
  });
});
