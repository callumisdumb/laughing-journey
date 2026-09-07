import type { Submission, ReturnKind } from '../schemas/submission';

/** The submission for one return and period, where it has been made. */
export function submissionFor(submissions: readonly Submission[], kind: ReturnKind, periodId: string): Submission | undefined {
  return submissions.find((s) => s.kind === kind && s.periodId === periodId && !s.recordedInError);
}

/** Why a submission cannot be recorded, as codes the screen words. */
export function submissionRefusals(input: { recipient: string; submittedOn: string; today: string; existing: Submission | undefined }): string[] {
  const errors: string[] = [];
  if (input.existing) errors.push('submissionAlreadyRecorded');
  if (input.recipient.trim().length < 3) errors.push('submissionRecipientRequired');
  if (!input.submittedOn) errors.push('submissionDateRequired');
  else if (input.submittedOn > input.today) errors.push('submissionDateInFuture');
  return errors;
}

/**
 * The clock rules a submission completes. The ASP return is the one with deadline clocks: each
 * quarter's rule (`asp.nmds.q1` to `q4`) is answered by the submission that names that quarter, and
 * the other returns have no clock in the tables, so they complete nothing (D-247).
 */
export function clocksCompletedBySubmission(submission: Pick<Submission, 'kind' | 'nmdsQuarter'>): string[] {
  return submission.kind === 'asp' && submission.nmdsQuarter ? [`asp.nmds.${submission.nmdsQuarter}`] : [];
}
