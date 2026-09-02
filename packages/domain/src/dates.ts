/**
 * Date helpers. UI shows dd Mon yyyy and 24-hour times in Europe/London.
 * Data stays ISO 8601. All functions are pure.
 */
import { differenceInCalendarDays, differenceInYears, parseISO } from 'date-fns';
import { formatInTimeZone, toZonedTime } from 'date-fns-tz';

export const TIME_ZONE = 'Europe/London';

/** The fixed demo clock. Settings can switch to the real clock. */
export const DEMO_NOW_ISO = '2026-09-02T09:00:00+01:00';

export function demoNow(): Date {
  return parseISO(DEMO_NOW_ISO);
}

export function formatDate(iso: string | Date): string {
  const d = typeof iso === 'string' ? parseISO(iso) : iso;
  return formatInTimeZone(d, TIME_ZONE, 'dd MMM yyyy');
}

export function formatDateTime(iso: string | Date): string {
  const d = typeof iso === 'string' ? parseISO(iso) : iso;
  return formatInTimeZone(d, TIME_ZONE, 'dd MMM yyyy, HH:mm');
}

export function formatTime(iso: string | Date): string {
  const d = typeof iso === 'string' ? parseISO(iso) : iso;
  return formatInTimeZone(d, TIME_ZONE, 'HH:mm');
}

/** ISO calendar date (yyyy-MM-dd) of an instant in Europe/London. */
export function localDateOf(iso: string | Date): string {
  const d = typeof iso === 'string' ? parseISO(iso) : iso;
  return formatInTimeZone(d, TIME_ZONE, 'yyyy-MM-dd');
}

export function toLocal(iso: string | Date): Date {
  const d = typeof iso === 'string' ? parseISO(iso) : iso;
  return toZonedTime(d, TIME_ZONE);
}

export function ageAt(dateOfBirth: string, now: Date): number {
  return differenceInYears(now, parseISO(dateOfBirth));
}

/** Age as practitioners say it: "7 years", "18 months", "3 weeks". */
export function ageLabel(dateOfBirth: string, now: Date): string {
  const years = ageAt(dateOfBirth, now);
  if (years >= 2) return `${years} years`;
  const days = differenceInCalendarDays(now, parseISO(dateOfBirth));
  if (days >= 60) return `${Math.floor(days / 30.44)} months`;
  return `${Math.floor(days / 7)} weeks`;
}

export function daysBetween(fromIso: string, toIso: string): number {
  return differenceInCalendarDays(parseISO(toIso), parseISO(fromIso));
}

/** "in 9 days", "today", "3 days overdue". */
export function relativeDays(days: number): string {
  if (days === 0) return 'today';
  if (days === 1) return 'tomorrow';
  if (days === -1) return '1 day overdue';
  if (days < 0) return `${Math.abs(days)} days overdue`;
  return `in ${days} days`;
}
