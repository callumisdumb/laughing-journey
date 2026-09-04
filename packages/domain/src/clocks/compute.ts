import { clockRuleLabel } from './rules';
import { addDays, addHours, addMonths, addWeeks, differenceInCalendarDays, parseISO, startOfDay } from 'date-fns';
import { CalendarCoverageError, addWorkingDays as addWorkingDaysOn, type WorkingCalendar } from '../calendar/calendar';
import type { RiskBand } from '../enums';
import type { ClockRule } from '../schemas/config';
import type { ClockTrigger } from '../schemas/process';
import { localDateOf, toLocal } from '../dates';

export interface ClockResult {
  triggerId: string;
  ruleId: string;
  label: string;
  triggeredAt: string;
  /** ISO calendar date. */
  dueAt: string;
  daysRemaining: number;
  band: RiskBand;
  status: 'running' | 'complete' | 'overdue';
  source: string;
  sourceRef: string;
  confidence: ClockRule['confidence'];
  overridden: boolean;
  overrideReason?: string;
  todoVerify: boolean;
  /** The rule allows a professional-judgement deferral, recorded as an override with a reason. */
  deferrable: boolean;
  deferralNote?: string;
  /**
   * The working-day count ran past the committed calendar, so the due date is an approximation.
   *
   * A weekends-only fallback looks exactly like a correct answer, so the calendar refuses outside
   * its range and the consequence surfaces here: the countdown is shown with a note saying the
   * calendar does not cover the period and the date is unverified. A practitioner should never see
   * a confident countdown computed from data that does not exist.
   */
  unverified?: boolean;
}

export interface ClockOptions {
  /**
   * The working calendar: the national list, what the organisation observes and the council's own
   * local days, composed in `packages/domain/src/calendar`. There is no second implementation of
   * "is this a working day" and this is how the one implementation gets here.
   */
  calendar?: WorkingCalendar;
  /** Which organisation's observed set applies, where one differs from the partnership's. */
  organisationId?: string;
}

/** Due date for a rule from a trigger instant, as a local calendar date. */
export function dueDateFor(rule: ClockRule, triggeredAt: string, options: ClockOptions = {}): Date {
  const start = startOfDay(toLocal(triggeredAt));
  // A 'before' rule counts back from its anchor (for a notice rule the trigger instant is the meeting date).
  const amount = rule.direction === 'before' ? -rule.amount : rule.amount;
  switch (rule.unit) {
    case 'hours':
      // An hours rule is still shown as a day deadline: the window is counted from the instant,
      // then the due date is the day it lands on.
      return startOfDay(addHours(toLocal(triggeredAt), amount));
    case 'calendar-days':
      return addDays(start, amount);
    case 'working-days': {
      if (!options.calendar) throw new Error(`${rule.id} counts working days and no calendar was supplied`);
      const result = addWorkingDaysOn(localDateOf(start), amount, options.calendar, { calendarId: rule.calendar ?? 'council', organisationId: options.organisationId });
      return startOfDay(toLocal(`${result.date}T00:00:00`));
    }
    case 'weeks':
      return addWeeks(start, amount);
    case 'months':
      return addMonths(start, amount);
  }
}

export function bandFor(daysRemaining: number, warnDays: number, complete: boolean): RiskBand {
  if (complete) return 'low';
  if (daysRemaining < 0) return 'critical';
  if (daysRemaining <= 2) return 'high';
  if (daysRemaining <= warnDays) return 'medium';
  return 'low';
}

/**
 * Pure clock computation: trigger + rule + now.
 * Returns the due date, days remaining, RAG band and the rule reference.
 */
export function computeClock(
  trigger: ClockTrigger,
  rule: ClockRule,
  now: Date,
  options: ClockOptions = {},
): ClockResult {
  const overridden = Boolean(trigger.dueOverride);
  let unverified = false;
  let due: Date;
  if (trigger.dueOverride) due = parseISO(trigger.dueOverride);
  else {
    try {
      due = dueDateFor(rule, trigger.triggeredAt, options);
    } catch (error) {
      if (!(error instanceof CalendarCoverageError)) throw error;
      // Outside the calendar, count weekends only and say so. The saying so is the point: without
      // the flag this line would be the silent degradation the calendar exists to prevent.
      unverified = true;
      due = approximateWorkingDays(startOfDay(toLocal(trigger.triggeredAt)), rule.direction === 'before' ? -rule.amount : rule.amount);
    }
  }
  const today = startOfDay(toLocal(now));
  const daysRemaining = differenceInCalendarDays(due, today);
  const complete = Boolean(trigger.completedAt);
  const status: ClockResult['status'] = complete ? 'complete' : daysRemaining < 0 ? 'overdue' : 'running';
  return {
    triggerId: trigger.id,
    ruleId: rule.id,
    label: clockRuleLabel(rule.id),
    triggeredAt: trigger.triggeredAt,
    dueAt: localDateOf(due),
    daysRemaining,
    band: bandFor(daysRemaining, rule.warnDays, complete),
    status,
    source: rule.source,
    sourceRef: rule.sourceRef ?? rule.source,
    confidence: rule.confidence,
    overridden,
    overrideReason: trigger.overrideReason,
    todoVerify: rule.todoVerify ?? false,
    deferrable: rule.deferrable ?? false,
    deferralNote: rule.deferralNote,
    unverified: unverified || undefined,
  };
}

/**
 * Weekdays only, used once: when the real calendar has refused because the date is outside the
 * committed range. It is never the silent fallback, because every result computed this way carries
 * `unverified` and the interface says so on the countdown.
 */
function approximateWorkingDays(start: Date, amount: number): Date {
  let date = start;
  let remaining = Math.abs(amount);
  const step = amount < 0 ? -1 : 1;
  while (remaining > 0) {
    date = addDays(date, step);
    const day = date.getDay();
    if (day !== 0 && day !== 6) remaining -= 1;
  }
  return date;
}

/** Sort running clocks by urgency: overdue first, then fewest days remaining, complete last. */
export function sortByUrgency(clocks: ClockResult[]): ClockResult[] {
  return [...clocks].sort((a, b) => {
    if (a.status === 'complete' && b.status !== 'complete') return 1;
    if (b.status === 'complete' && a.status !== 'complete') return -1;
    return a.daysRemaining - b.daysRemaining;
  });
}
