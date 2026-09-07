import { describe, expect, it } from 'vitest';
import { writeErrorText } from './writeErrors';

describe('writeErrorText', () => {
  it('words the codes the pipeline returns', () => {
    expect(writeErrorText('reasonRequired')).toMatch(/reason/i);
    expect(writeErrorText('nameRequired')).toMatch(/family name/i);
    expect(writeErrorText('classificationDowngrade')).toMatch(/lowered/i);
  });

  it('names the person on the exclusion register, because the register is a list somebody wrote', () => {
    expect(writeErrorText('excluded:Ryan Kerr')).toContain('Ryan Kerr');
  });

  it('passes a Zod issue through, since it already reads as a sentence', () => {
    expect(writeErrorText('postcode: Invalid string')).toBe('postcode: Invalid string');
  });

  it('passes an unworded code through rather than swallowing it', () => {
    expect(writeErrorText('somethingNobodyHasWordedYet')).toBe('somethingNobodyHasWordedYet');
  });

  it('leaves a code that merely starts with the excluded word alone', () => {
    expect(writeErrorText('excludedParty')).toBe('excludedParty');
  });
});
