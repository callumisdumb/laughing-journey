/**
 * Date helpers. UI shows dd Mon yyyy and 24-hour times in Europe/London.
 * Data stays ISO 8601. All functions are pure.
 */
import { differenceInCalendarDays, differenceInYears, format, isValid, parse, parseISO } from 'date-fns';
import { formatInTimeZone, fromZonedTime, toZonedTime } from 'date-fns-tz';

export const TIME_ZONE = 'Europe/London';

/** The fixed demo clock. Settings can switch to the real clock. */
export const DEMO_NOW_ISO = '2026-09-02T09:00:00+01:00';

export function demoNow(): Date {
  return parseISO(DEMO_NOW_ISO);
}

/**
 * The demo instant as set, falling back to the seeded one.
 *
 * The demo clock is settable so a statutory clock can be watched going overdue rather than described
 * as being about to, and one bad value must not take every date on the screen with it. An
 * unparseable string returns the seeded instant rather than an Invalid Date, because a screen full
 * of "NaN days remaining" is a worse failure than a clock that did not move.
 */
export function isValidIso(iso: string): boolean {
  return !Number.isNaN(parseISO(iso).getTime());
}

export function parseDemoNow(iso: string | undefined | null): Date {
  if (!iso) return parseISO(DEMO_NOW_ISO);
  const parsed = parseISO(iso);
  return Number.isNaN(parsed.getTime()) ? parseISO(DEMO_NOW_ISO) : parsed;
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

/** The format practitioners type a date in, and the example shown beside every date field. */
export const UI_DATE_FORMAT = 'dd Mon yyyy';
export const UI_DATE_EXAMPLE = '02 Sep 2026';

const TYPED_DATE_FORMATS = ['dd MMM yyyy', 'd MMM yyyy', 'dd MMMM yyyy', 'd MMMM yyyy', 'dd/MM/yyyy', 'd/M/yyyy', 'dd.MM.yyyy', 'yyyy-MM-dd'];

/**
 * Parse a date as a practitioner types it (02 Sep 2026, 2 September 2026, 02/09/2026 or ISO)
 * to a yyyy-MM-dd calendar date. Returns undefined when the text is not a real date.
 */
export function parseTypedDate(text: string): string | undefined {
  const trimmed = text.trim().replace(/\s+/g, ' ');
  if (!trimmed) return undefined;
  for (const pattern of TYPED_DATE_FORMATS) {
    const d = parse(trimmed, pattern, new Date(2000, 0, 1));
    if (isValid(d) && d.getFullYear() >= 1900 && d.getFullYear() <= 2100) return format(d, 'yyyy-MM-dd');
  }
  return undefined;
}

/** dd Mon yyyy for a calendar date (yyyy-MM-dd) without any time zone shift; empty for an empty or invalid value. */
export function formatCalendarDate(iso: string): string {
  const d = parse(iso, 'yyyy-MM-dd', new Date(2000, 0, 1));
  return isValid(d) ? format(d, 'dd MMM yyyy') : '';
}

/** A wall-clock date and time in Europe/London (`2026-09-14`, `10:00`) as the ISO instant it names. */
export function londonToIso(date: string, time: string): string {
  return fromZonedTime(`${date}T${time || '00:00'}:00`, TIME_ZONE).toISOString();
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
