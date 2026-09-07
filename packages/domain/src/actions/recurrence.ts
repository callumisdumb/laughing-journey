import { addDays, addMonths, addWeeks, format, parseISO } from 'date-fns';
import type { Action } from '../schemas/action-plan';

/**
 * The next occurrence of a repeating action (D-250).
 *
 * Completing an action that repeats creates the next one, due the interval after the one just
 * completed rather than after the day it was finished: a weekly visit done three days late is still
 * due on the same weekday next week, which is what a plan means by weekly. The series ends when the
 * next date would pass the end date, and the last one says so rather than silently stopping.
 */
export function nextOccurrence(action: Action, newId: (prefix: string) => string, at: string): Action | null {
  const recurrence = action.recurrence;
  if (!recurrence) return null;
  const from = parseISO(action.due);
  const due = recurrence.unit === 'days' ? addDays(from, recurrence.every) : recurrence.unit === 'weeks' ? addWeeks(from, recurrence.every) : addMonths(from, recurrence.every);
  const dueIso = format(due, 'yyyy-MM-dd');
  if (recurrence.until && dueIso > recurrence.until) return null;
  return {
    ...action,
    id: newId('act'),
    due: dueIso,
    status: 'open',
    completedAt: undefined,
    evidence: undefined,
    escalatedAt: undefined,
    escalatedToName: undefined,
    createdAt: at,
    recurrence: { ...recurrence, previousActionId: action.id, nextActionId: undefined },
  };
}

/** Whether this action is one of a series, and where it sits in it, for the line a reader sees. */
export function seriesPosition(action: Action): { of: boolean; first: boolean; last: boolean } {
  const r = action.recurrence;
  if (!r) return { of: false, first: false, last: false };
  return { of: true, first: !r.previousActionId, last: Boolean(r.until && r.until <= action.due) };
}
