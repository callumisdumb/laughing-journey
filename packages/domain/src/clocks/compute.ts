import { clockRuleLabel } from './rules';
import { addDays, addHours, addMonths, addWeeks, differenceInCalendarDays, isSaturday, isSunday, parseISO, startOfDay } from 'date-fns';
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
}

export interface ClockOptions {
  bankHolidays?: string[];
  /** Council local holidays, kept separately in configuration; working-day clocks skip both lists. */
  councilHolidays?: string[];
}

function isWorkingDay(date: Date, holidays: Set<string>): boolean {
  if (isSaturday(date) || isSunday(date)) return false;
  return !holidays.has(localDateOf(date));
}

export function addWorkingDays(start: Date, amount: number, holidays: Set<string>): Date {
  let d = start;
  let remaining = Math.abs(amount);
  const step = amount < 0 ? -1 : 1;
  while (remaining > 0) {
    d = addDays(d, step);
    if (isWorkingDay(d, holidays)) remaining -= 1;
  }
  return d;
}

/** Due date for a rule from a trigger instant, as a local calendar date. */
export function dueDateFor(rule: ClockRule, triggeredAt: string, options: ClockOptions = {}): Date {
  const start = startOfDay(toLocal(triggeredAt));
  const holidays = new Set([...(options.bankHolidays ?? []), ...(options.councilHolidays ?? [])]);
  // A 'before' rule counts back from its anchor (for a notice rule the trigger instant is the meeting date).
  const amount = rule.direction === 'before' ? -rule.amount : rule.amount;
  switch (rule.unit) {
    case 'hours':
      // An hours rule is still shown as a day deadline: the window is counted from the instant,
      // then the due date is the day it lands on.
      return startOfDay(addHours(toLocal(triggeredAt), amount));
    case 'calendar-days':
      return addDays(start, amount);
    case 'working-days':
      return addWorkingDays(start, amount, holidays);
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
  const due = trigger.dueOverride ? parseISO(trigger.dueOverride) : dueDateFor(rule, trigger.triggeredAt, options);
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
  };
}

/** Sort running clocks by urgency: overdue first, then fewest days remaining, complete last. */
export function sortByUrgency(clocks: ClockResult[]): ClockResult[] {
  return [...clocks].sort((a, b) => {
    if (a.status === 'complete' && b.status !== 'complete') return 1;
    if (b.status === 'complete' && a.status !== 'complete') return -1;
    return a.daysRemaining - b.daysRemaining;
  });
}
