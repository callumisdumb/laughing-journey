/**
 * Number, date and time formatting for en-GB in Europe/London. Dates and times are never written
 * into messages; they are formatted here and passed in as arguments.
 *
 * Intl's en-GB abbreviated September is "Sept", so the month comes from a fixed table to keep the
 * brief's dd Mon yyyy exactly; Intl still does the time zone arithmetic.
 */
import { LOCALE, TIME_ZONE } from './catalogue';

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'] as const;

const parts = new Intl.DateTimeFormat(LOCALE, { day: '2-digit', month: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit', hourCycle: 'h23', timeZone: TIME_ZONE });
const number = new Intl.NumberFormat(LOCALE);

type Input = Date | string | number;

function toDate(value: Input): Date {
  if (value instanceof Date) return value;
  if (typeof value === 'number') return new Date(value);
  // A calendar date (yyyy-MM-dd) is a London day, not UTC midnight.
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) return new Date(`${value}T12:00:00+01:00`);
  return new Date(value);
}

function pieces(value: Input): { day: string; month: string; year: string; hour: string; minute: string } {
  const out = { day: '', month: '', year: '', hour: '', minute: '' };
  for (const p of parts.formatToParts(toDate(value))) {
    if (p.type in out) out[p.type as keyof typeof out] = p.value;
  }
  return out;
}

/** 02 Sep 2026 */
export function formatDate(value: Input): string {
  const p = pieces(value);
  return `${p.day} ${MONTHS[Number(p.month) - 1] ?? p.month} ${p.year}`;
}

/** 14:05 */
export function formatTime(value: Input): string {
  const p = pieces(value);
  return `${p.hour}:${p.minute}`;
}

/** 02 Sep 2026, 14:05 */
export function formatDateTime(value: Input): string {
  return `${formatDate(value)}, ${formatTime(value)}`;
}

/** 1,234 */
export function formatNumber(value: number): string {
  return number.format(value);
}
