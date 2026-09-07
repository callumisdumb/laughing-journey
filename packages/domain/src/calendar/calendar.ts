/**
 * Working days, and the three lists that decide them.
 *
 * The gov.uk bank holidays feed is the national input and it is not, on its own, a Scottish
 * council's working calendar. Treating it as one produces deadlines a practitioner knows are wrong,
 * which is the fastest way to lose a room. Three things compose here and none of them overrides
 * another:
 *
 * 1. The national list, Scotland division, committed as a fixture and never fetched at runtime.
 * 2. Which of those the organisation actually observes. Councils and health boards do not
 *    universally close on every bank holiday and some substitute local days for them.
 * 3. The council's own local holidays, which differ between neighbouring authorities: an officer in
 *    one area is off on a day their counterpart two miles away is working.
 *
 * A working day is a day that is none of a Saturday, a Sunday, an observed national holiday or a
 * council local holiday. That sentence is this file, and there is no second implementation of it
 * anywhere: `packages/domain/src/clocks/compute.ts` calls in here and so does the Admin calendar.
 *
 * Dates are opaque `YYYY-MM-DD` strings throughout, compared as strings and held in a Set. Never
 * round-trip one through a local-time `Date` constructor: `new Date('2026-01-01')` is UTC midnight
 * and `new Date(2026, 0, 1)` is local midnight, and west of Greenwich the difference moves a
 * holiday across a day boundary exactly once a year, in a way that passes every test written in
 * summer.
 */

/** One national holiday, as the feed gives it. `bunting` is dropped; `notes` is not. */
export interface BankHoliday {
  date: string;
  title: string;
  notes: string;
}

/** A council's own local holiday, kept entirely separate from the national list. */
export interface CouncilHoliday {
  date: string;
  title: string;
}

/**
 * Whether an organisation observes a national holiday. Absent means observed, because that is the
 * ordinary case and a list of every holiday every organisation does take would be noise.
 * `organisationId` absent means the whole partnership.
 */
export interface HolidayObservance {
  date: string;
  organisationId?: string;
  observed: boolean;
  reason?: string;
}

/** Where the national list came from, shown on the Admin calendar so nobody has to ask. */
export interface CalendarProvenance {
  source: string;
  division: string;
  fetchedAt: string;
  coversFrom: string;
  coversTo: string;
}

/**
 * The calendars a clock can be counted against.
 *
 * `council` is the default and the only one populated. `health` exists because a health board's
 * observed set is its own. `everyDay` exists because `marac.research.return` counts backwards
 * across agencies that include Police Scotland, which operates every day of the year: the shape is
 * here so it is right when somebody needs it, and nothing uses it yet (D-194).
 */
export const CALENDARS = ['council', 'health', 'everyDay'] as const;
export type CalendarId = (typeof CALENDARS)[number];

export interface WorkingCalendar {
  provenance: CalendarProvenance;
  national: BankHoliday[];
  observance: HolidayObservance[];
  councilHolidays: CouncilHoliday[];
}

/**
 * Thrown when a date falls outside the committed fixture.
 *
 * It does not guess and it does not fall back to weekends only, because a weekends-only answer
 * looks exactly like a correct one and nobody would find out until an inspection. The clock
 * computation catches this and marks the result unverified, which the interface renders as a note
 * on the countdown; nothing else swallows it.
 */
export class CalendarCoverageError extends Error {
  constructor(
    readonly date: string,
    readonly coversFrom: string,
    readonly coversTo: string,
  ) {
    super(`${date} is outside the committed holiday calendar, which covers ${coversFrom} to ${coversTo}`);
    this.name = 'CalendarCoverageError';
  }
}

/** Why a day is not a working day, so a screen can say which list it came from. */
export type NonWorkingReason = 'weekend' | 'national' | 'council';

export interface DayVerdict {
  date: string;
  working: boolean;
  reason?: NonWorkingReason;
  /** The holiday's own title, for the reason a reader is given. */
  title?: string;
  notes?: string;
}

/** UTC, deliberately: a date-only string has no time zone and must not acquire one. */
function weekdayOf(date: string): number {
  const [y, m, d] = date.split('-').map(Number);
  return new Date(Date.UTC(y ?? 0, (m ?? 1) - 1, d ?? 1)).getUTCDay();
}

function observedNational(calendar: WorkingCalendar, organisationId?: string): Map<string, BankHoliday> {
  const out = new Map<string, BankHoliday>();
  for (const holiday of calendar.national) {
    const entry = calendar.observance.find((o) => o.date === holiday.date && (o.organisationId === undefined || o.organisationId === organisationId));
    if (entry && !entry.observed) continue;
    out.set(holiday.date, holiday);
  }
  return out;
}

export interface CalendarQuery {
  calendarId?: CalendarId;
  organisationId?: string;
}

/**
 * Whether a date is a working day, with the reason when it is not.
 *
 * Throws `CalendarCoverageError` outside the fixture's range rather than answering. Callers that
 * can render an approximation catch it; callers that cannot must not.
 */
export function dayVerdict(date: string, calendar: WorkingCalendar, query: CalendarQuery = {}): DayVerdict {
  if (date < calendar.provenance.coversFrom || date > calendar.provenance.coversTo) {
    throw new CalendarCoverageError(date, calendar.provenance.coversFrom, calendar.provenance.coversTo);
  }
  const calendarId = query.calendarId ?? 'council';
  // Police Scotland operates every day of the year, weekends and holidays alike.
  if (calendarId === 'everyDay') return { date, working: true };
  const day = weekdayOf(date);
  if (day === 0 || day === 6) return { date, working: false, reason: 'weekend' };
  const national = observedNational(calendar, query.organisationId).get(date);
  if (national) return { date, working: false, reason: 'national', title: national.title, notes: national.notes || undefined };
  // The council's local list applies to the council's own calendar and to nobody else's.
  if (calendarId === 'council') {
    const local = calendar.councilHolidays.find((h) => h.date === date);
    if (local) return { date, working: false, reason: 'council', title: local.title };
  }
  return { date, working: true };
}

/** The single implementation. Everything that asks "is this a working day" asks this. */
export function isWorkingDay(date: string, calendar: WorkingCalendar, query: CalendarQuery = {}): boolean {
  return dayVerdict(date, calendar, query).working;
}

function shiftDate(date: string, days: number): string {
  const [y, m, d] = date.split('-').map(Number);
  const at = new Date(Date.UTC(y ?? 0, (m ?? 1) - 1, d ?? 1));
  at.setUTCDate(at.getUTCDate() + days);
  return at.toISOString().slice(0, 10);
}

export interface WorkingDayStep {
  date: string;
  counted: boolean;
  reason?: NonWorkingReason;
  title?: string;
}

export interface WorkingDayResult {
  from: string;
  amount: number;
  date: string;
  /** Every day walked, so a screen can show which were skipped and why. */
  steps: WorkingDayStep[];
}

/**
 * Count working days forwards or backwards from a date.
 *
 * Backwards is not the same code path with a sign flipped in one place and it is where the
 * off-by-one lives, so it is the same loop with one step variable and it is tested against a case
 * that crosses the Scottish new year cluster. The start date is never counted, in either direction:
 * "five working days from Monday" is the following Monday, not the Friday.
 */
export function addWorkingDays(from: string, amount: number, calendar: WorkingCalendar, query: CalendarQuery = {}): WorkingDayResult {
  const step = amount < 0 ? -1 : 1;
  let remaining = Math.abs(amount);
  let date = from;
  const steps: WorkingDayStep[] = [];
  while (remaining > 0) {
    date = shiftDate(date, step);
    const verdict = dayVerdict(date, calendar, query);
    steps.push({ date, counted: verdict.working, reason: verdict.reason, title: verdict.title });
    if (verdict.working) remaining -= 1;
  }
  return { from, amount, date, steps };
}

/** Every non-working day in a window, which is what a team leader actually wants to look at. */
export function nonWorkingDaysBetween(from: string, to: string, calendar: WorkingCalendar, query: CalendarQuery = {}): DayVerdict[] {
  const out: DayVerdict[] = [];
  const start = from < calendar.provenance.coversFrom ? calendar.provenance.coversFrom : from;
  const end = to > calendar.provenance.coversTo ? calendar.provenance.coversTo : to;
  for (let date = start; date <= end; date = shiftDate(date, 1)) {
    const verdict = dayVerdict(date, calendar, query);
    if (!verdict.working) out.push(verdict);
  }
  return out;
}
