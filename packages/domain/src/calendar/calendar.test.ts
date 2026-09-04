/**
 * The working calendar, and the ways a holiday list gets a statutory deadline wrong.
 *
 * Every case here is one somebody has shipped: the English August holiday instead of the Scottish
 * one, a backwards count that lands a day out over the new year, a one-off holiday a hand-kept list
 * missed, and a date outside the committed range answered confidently from nothing.
 */
import { describe, expect, it } from 'vitest';
import { CalendarCoverageError, addWorkingDays, dayVerdict, isWorkingDay, nonWorkingDaysBetween, type WorkingCalendar } from './calendar';
import { DEFAULT_CONFIG, workingCalendarFrom } from '../config/default-config';
import bankHolidayFixture from '../config/bank-holidays.json';

const calendar: WorkingCalendar = workingCalendarFrom(DEFAULT_CONFIG);
/** The national list alone, so a case can prove the two lists compose rather than one masking the other. */
const nationalOnly: WorkingCalendar = { ...calendar, councilHolidays: [] };
const dates = new Set(calendar.national.map((h) => h.date));

describe('the fixture is the Scotland division', () => {
  it('has the days Scotland has and England and Wales does not', () => {
    expect(dates.has('2026-01-02')).toBe(true); // 2nd January
    expect(dates.has('2026-11-30')).toBe(true); // St Andrew's Day
    expect(dates.has('2026-06-15')).toBe(true); // the one-off World Cup holiday
  });

  it('does not have Easter Monday, which Scotland does not take', () => {
    expect(dates.has('2026-04-06')).toBe(false);
  });

  it('takes the summer holiday on the first Monday in August and not the last', () => {
    expect(dates.has('2026-08-03')).toBe(true);
    expect(dates.has('2026-08-31')).toBe(false);
  });

  it('says it is the Scotland division, and nothing reads any other', () => {
    expect(bankHolidayFixture.division).toBe('scotland');
    expect(Object.keys(bankHolidayFixture)).not.toContain('england-and-wales');
    expect(Object.keys(bankHolidayFixture)).not.toContain('northern-ireland');
  });

  it('has the year counts the feed has', () => {
    const per = (year: string) => calendar.national.filter((h) => h.date.startsWith(year)).length;
    expect(per('2025')).toBe(9);
    expect(per('2026')).toBe(10);
    expect(per('2027')).toBe(9);
    expect(per('2028')).toBe(9);
  });

  it('keeps the notes, because "Substitute day" is the answer to why 28 December 2026 is a holiday', () => {
    expect(calendar.national.find((h) => h.date === '2026-12-28')?.notes).toBe('Substitute day');
  });
});

describe('a working day is four things at once', () => {
  it('is not a weekend', () => {
    expect(isWorkingDay('2026-09-05', calendar)).toBe(false);
    expect(dayVerdict('2026-09-05', calendar).reason).toBe('weekend');
  });

  it('is not a national holiday the organisation observes', () => {
    expect(isWorkingDay('2026-11-30', calendar)).toBe(false);
    expect(dayVerdict('2026-11-30', calendar).title).toBe("St Andrew's Day");
  });

  it('is a national holiday the organisation does not observe', () => {
    const notObserved: WorkingCalendar = { ...calendar, observance: [{ date: '2026-11-30', observed: false, reason: 'A local day is taken instead' }] };
    expect(isWorkingDay('2026-11-30', notObserved)).toBe(true);
  });

  it('is not a council local holiday, and the two lists compose rather than one overriding the other', () => {
    expect(isWorkingDay('2026-09-21', nationalOnly)).toBe(true);
    expect(isWorkingDay('2026-09-21', calendar)).toBe(false);
    expect(dayVerdict('2026-09-21', calendar).reason).toBe('council');
    // And the national list still applies with the local one in place.
    expect(dayVerdict('2026-11-30', calendar).reason).toBe('national');
  });

  it('leaves the council list out of a calendar that is not the council', () => {
    expect(isWorkingDay('2026-09-21', calendar, { calendarId: 'health' })).toBe(true);
    expect(isWorkingDay('2026-11-30', calendar, { calendarId: 'health' })).toBe(false);
  });

  it('counts every day for an agency that works every day', () => {
    expect(isWorkingDay('2026-12-25', calendar, { calendarId: 'everyDay' })).toBe(true);
    expect(isWorkingDay('2026-09-05', calendar, { calendarId: 'everyDay' })).toBe(true);
  });
});

describe('counting forwards', () => {
  it('skips a weekend', () => {
    // Friday 4 September 2026, five working days, lands on Friday 11 September.
    expect(addWorkingDays('2026-09-04', 5, nationalOnly).date).toBe('2026-09-11');
  });

  it('starts from a bank holiday without counting it', () => {
    // Monday 30 November 2026 is St Andrew's Day. One working day on is Tuesday 1 December.
    expect(addWorkingDays('2026-11-30', 1, nationalOnly).date).toBe('2026-12-01');
  });

  it('crosses the one-off World Cup holiday, which a hand-kept list would miss', () => {
    // Friday 12 June 2026, one working day: Monday 15 June is the holiday, so Tuesday 16.
    expect(addWorkingDays('2026-06-12', 1, nationalOnly).date).toBe('2026-06-16');
  });

  it('crosses the August difference the Scottish way', () => {
    // Friday 31 July 2026, one working day. Scotland takes Monday 3 August, so Tuesday 4.
    expect(addWorkingDays('2026-07-31', 1, nationalOnly).date).toBe('2026-08-04');
    // The English last-Monday holiday is not in this list, so the end of August is ordinary.
    expect(addWorkingDays('2026-08-28', 1, nationalOnly).date).toBe('2026-08-31');
  });

  it('crosses St Andrew’s Day, which the English list does not have at all', () => {
    expect(addWorkingDays('2026-11-27', 1, nationalOnly).date).toBe('2026-12-01');
  });

  it('crosses the new year cluster, two holidays and a weekend', () => {
    // Wednesday 31 December 2025, one working day. 1 and 2 January are holidays, then a weekend.
    expect(addWorkingDays('2025-12-31', 1, nationalOnly).date).toBe('2026-01-05');
  });

  it('crosses the substitute-day new year in 2027 and in 2028', () => {
    // Thursday 31 December 2026, one working day. 1 January is Friday's holiday, then the weekend.
    expect(addWorkingDays('2026-12-31', 1, nationalOnly).date).toBe('2027-01-05');
    // 2028: 1 and 2 January fall at the weekend, so the substitutes are Monday 3 and Tuesday 4.
    expect(addWorkingDays('2027-12-31', 1, nationalOnly).date).toBe('2028-01-05');
  });

  it('adds a council local holiday on top without either list masking the other', () => {
    // Friday 18 September 2026, two working days. Monday 21 is the Clydeshore holiday, so Wednesday.
    expect(addWorkingDays('2026-09-18', 2, nationalOnly).date).toBe('2026-09-22');
    expect(addWorkingDays('2026-09-18', 2, calendar).date).toBe('2026-09-23');
  });

  it('says which days it skipped and why', () => {
    const walked = addWorkingDays('2026-06-12', 1, nationalOnly);
    const skipped = walked.steps.filter((s) => !s.counted);
    expect(skipped.map((s) => s.reason)).toEqual(['weekend', 'weekend', 'national']);
    expect(skipped.at(-1)?.title).toBe('World Cup bank holiday');
  });
});

describe('counting backwards, where the off-by-one lives', () => {
  it('walks back across the Scottish new year cluster', () => {
    // Five working days back from Monday 5 January 2026. Back over the weekend to Friday 2 January,
    // which is a holiday, and 1 January too, so the five are 31, 30, 29, 24 and 23 December.
    expect(addWorkingDays('2026-01-05', -5, nationalOnly).date).toBe('2025-12-23');
  });

  it('walks back from a Monday over an ordinary weekend', () => {
    expect(addWorkingDays('2026-09-07', -5, nationalOnly).date).toBe('2026-08-31');
  });

  it('walks back over the one-off World Cup holiday', () => {
    // Two working days back from Wednesday 17 June 2026: Tuesday 16, then Monday 15 is the holiday,
    // so Friday 12.
    expect(addWorkingDays('2026-06-17', -2, nationalOnly).date).toBe('2026-06-12');
  });

  it('is the mirror of counting forwards', () => {
    const forward = addWorkingDays('2026-06-10', 7, calendar).date;
    expect(addWorkingDays(forward, -7, calendar).date).toBe('2026-06-10');
  });
});

describe('the calendar knows its own bounds', () => {
  it('answers inside them', () => {
    expect(() => dayVerdict(calendar.provenance.coversFrom, calendar)).not.toThrow();
    expect(() => dayVerdict(calendar.provenance.coversTo, calendar)).not.toThrow();
  });

  it('refuses the day before coverage starts rather than guessing', () => {
    expect(() => dayVerdict('2024-12-31', calendar)).toThrow(CalendarCoverageError);
  });

  it('refuses the day after coverage ends rather than guessing', () => {
    expect(() => dayVerdict('2028-12-27', calendar)).toThrow(CalendarCoverageError);
  });

  it('refuses a count that walks out of coverage, rather than answering weekends only', () => {
    expect(() => addWorkingDays('2028-12-20', 20, calendar)).toThrow(CalendarCoverageError);
  });
});

describe('the twelve month view', () => {
  it('lists every non-working day in a window with its reason', () => {
    const days = nonWorkingDaysBetween('2026-11-01', '2026-12-31', calendar);
    expect(days.some((d) => d.date === '2026-11-30' && d.reason === 'national')).toBe(true);
    expect(days.some((d) => d.date === '2026-12-28' && d.notes === 'Substitute day')).toBe(true);
    expect(days.every((d) => !d.working)).toBe(true);
  });

  it('clamps to coverage rather than throwing on a window that runs past it', () => {
    expect(() => nonWorkingDaysBetween('2028-11-01', '2029-06-01', calendar)).not.toThrow();
  });
});
