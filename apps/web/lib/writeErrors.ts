'use client';

import { tKey, useT } from '@mas/messages';
import { useCallback } from 'react';

/**
 * Turns a refusal from the write pipeline into something a person can read.
 *
 * The pipeline returns codes rather than sentences on purpose. It runs in the store, has no
 * translator to hand and no business having one: a refusal is a fact about the record, not a piece
 * of copy, and the same refusal has to be assertable in a unit test without a React tree around it.
 * So the codes stay stable and the wording lives here, next to the screens that show it.
 *
 * Anything unrecognised is passed through rather than swallowed. A Zod issue arrives as
 * `path: message` and reads well enough; a code nobody has worded yet should appear on screen ugly
 * rather than disappear, because a refusal a practitioner cannot see is a Save button that does
 * nothing.
 */
const KEYS = [
  'noUser',
  'reasonRequired',
  'classificationDowngrade',
  'nameRequired',
  'dateOfBirthFuture',
  'expectedDeliveryPast',
  'searchRequired',
  'chiNeedsDateOfBirth',
  'mergeSameRecord',
  'mergeSurvivorMissing',
  'mergeOtherMissing',
  'mergeReasonRequired',
  'unmergeMissing',
  'unmergeAlreadyUndone',
  'unmergeReasonRequired',
  'householdMissing',
  'householdAlreadyMember',
  'householdNotAMember',
  'householdEndReasonRequired',
  'householdLabelRequired',
  'relationshipSelf',
  'relationshipPersonMissing',
  'relationshipDuplicate',
  'relationshipMissing',
  'relationshipEndReasonRequired',
  'relationshipEndBeforeStart',
  'relationshipExclusionUndecided',
  'processNotYourRole',
  'processNoSubject',
  'processNotEligible',
  'processAlreadyOpen',
  'planTitleRequired',
  'planOutcomeRequired',
  'alertTextRequired',
  'alertScopeRequired',
  'alertEndsBeforeStart',
  'orderRationaleRequired',
  'disclosureRecipientRequired',
  'disclosureFactRequired',
  'disclosureRationaleRequired',
  'visitVisitorRequired',
  'visitSummaryRequired',
  'visitInFuture',
  'investigationSummaryRequired',
  'investigationInFuture',
  'registerNameRequired',
  'registerReasonRequired',
  'processMissing',
  'processAlreadyClosed',
  'processNotClosed',
  'closureReasonRequired',
  'closureNoteRequired',
  'reopenReasonRequired',
  'recordMissing',
  'alreadyRecordedInError',
  'personMissing',
  'deathAlreadyRecorded',
  'deathInFuture',
  'deathBeforeBirth',
  'deathNoteRequired',
  'nothingChanged',
  'identityReasonRequired',
] as const;

export type WriteErrorCode = (typeof KEYS)[number];

const EXCLUDED = 'excluded:';

export function writeErrorText(code: string): string {
  if (code.startsWith(EXCLUDED)) return tKey('errors.write.excluded', { name: code.slice(EXCLUDED.length) });
  return (KEYS as readonly string[]).includes(code) ? tKey(`errors.write.${code}`) : code;
}

/**
 * The same, as a hook, for the common case of a list on a dialog.
 *
 * It subscribes to the translator without calling it, which looks redundant and is not: the
 * catalogue can be overridden from the Admin copy screen at runtime, and subscribing here is what
 * re-renders the dialog when somebody rewords a refusal.
 */
export function useWriteErrors(): (codes: string[]) => string[] {
  useT();
  return useCallback((codes: string[]) => codes.map(writeErrorText), []);
}
