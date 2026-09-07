import { describe, expect, it } from 'vitest';
import type { Submission } from '../schemas/submission';
import { clocksCompletedBySubmission, submissionFor, submissionRefusals } from './submissions';

const made = (over: Partial<Submission> = {}): Submission => ({ id: 'sub_1', synthetic: true, kind: 'asp', periodId: 'b2027', periodLabel: 'Two years to 31 Mar 2027', recipient: 'ASPData@gov.scot', submittedOn: '2026-08-14', submittedByName: 'Elspeth Gunn', recordedAt: '2026-08-14T10:00:00Z', ...over });

describe('submissionFor', () => {
  it('finds the submission for a return and period, and ignores one recorded in error', () => {
    const subs = [made(), made({ id: 'sub_2', kind: 'marac', periodId: 'q3-2026' })];
    expect(submissionFor(subs, 'asp', 'b2027')?.id).toBe('sub_1');
    expect(submissionFor(subs, 'asp', 'b2029')).toBeUndefined();
    expect(submissionFor([made({ recordedInError: { at: '2026-08-15T09:00:00Z', byName: 'T', reason: 'Wrong period' } })], 'asp', 'b2027')).toBeUndefined();
  });
});

describe('submissionRefusals', () => {
  const base = { recipient: 'ASPData@gov.scot', submittedOn: '2026-08-14', today: '2026-09-07', existing: undefined };
  it('accepts a submission with a recipient and a date that has happened', () => {
    expect(submissionRefusals(base)).toEqual([]);
  });
  it('refuses a second submission for the same period, a missing recipient and a future date', () => {
    expect(submissionRefusals({ ...base, existing: made() })).toEqual(['submissionAlreadyRecorded']);
    expect(submissionRefusals({ ...base, recipient: ' ' })).toEqual(['submissionRecipientRequired']);
    expect(submissionRefusals({ ...base, submittedOn: '' })).toEqual(['submissionDateRequired']);
    expect(submissionRefusals({ ...base, submittedOn: '2026-12-01' })).toEqual(['submissionDateInFuture']);
  });
});

describe('clocksCompletedBySubmission', () => {
  it('completes the quarter the ASP submission names, and nothing for the other returns', () => {
    expect(clocksCompletedBySubmission({ kind: 'asp', nmdsQuarter: 'q2' })).toEqual(['asp.nmds.q2']);
    expect(clocksCompletedBySubmission({ kind: 'asp', nmdsQuarter: undefined })).toEqual([]);
    expect(clocksCompletedBySubmission({ kind: 'marac', nmdsQuarter: 'q2' })).toEqual([]);
  });
});
