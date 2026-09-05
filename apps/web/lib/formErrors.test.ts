import type { FieldErrors } from 'react-hook-form';
import { describe, expect, it } from 'vitest';
import { formErrorSummary } from './formErrors';

describe('formErrorSummary', () => {
  it('reads a flat field error', () => {
    expect(formErrorSummary({ title: { type: 'too_small', message: 'Say what happened in one line' } })).toEqual(['Say what happened in one line']);
  });

  it('walks into nested objects, as the three-point test schema nests its limbs', () => {
    const errors = {
      assessedAt: { type: 'invalid_type', message: 'Enter a date' },
      a: { reasoning: { type: 'too_small', message: 'Give your reasoning for limb (a)' } },
      c: { reasoning: { type: 'too_small', message: 'Give your reasoning for limb (c)' } },
    };
    expect(formErrorSummary(errors)).toEqual(['Enter a date', 'Give your reasoning for limb (a)', 'Give your reasoning for limb (c)']);
  });

  it('walks into arrays, and says the same thing once', () => {
    // A field array stores one error per item, in an actual array. React Hook Form's published type
    // models that as `Merge<FieldError, FieldErrorsImpl>`, an object with an index signature, so the
    // shape the library really produces does not satisfy the shape it declares. The cast is the gap,
    // not a shortcut: the walk has to handle the array because the library writes one.
    const errors = {
      eventIds: [{ message: 'Link at least one event' }, { message: 'Link at least one event' }],
    } as unknown as FieldErrors;
    expect(formErrorSummary(errors)).toEqual(['Link at least one event']);
  });

  it('is empty when the form is valid', () => {
    expect(formErrorSummary({})).toEqual([]);
  });
});
