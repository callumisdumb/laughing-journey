/**
 * The SafeLives MARAC return, one row per meeting.
 *
 * SafeLives collects meeting-level counts: for each MARAC held in a quarter, how many cases were
 * discussed and how they break down by referral source and by a handful of victim and perpetrator
 * characteristics. This module counts; `safeLivesCellMap` in the domain package places. The cases at
 * a meeting are the MARAC records the meeting heard (`detail.meetingId`), and every characteristic is
 * read from the person records on the day of the meeting.
 *
 * What the product cannot count it leaves off the row rather than writing a nought (D-234). The
 * characteristics the row omits are listed in `SAFELIVES_NOT_HELD` and the preview says why.
 */
import { emptySafeLivesSources, formatCalendarDate, localDateOf, type Config, type Dataset, type MaracProcess, type Meeting, type SafeLivesMeetingRow } from '@mas/domain';
import { t } from '@mas/messages';
import { personById } from '@/lib/selectors';
import { ageOn } from './helpers';

export interface SafeLivesQuarter {
  id: string;
  label: string;
  from: string;
  to: string;
  inProgress: boolean;
}

const pad = (n: number) => String(n).padStart(2, '0');

/** The five most recent financial-year quarters (April to March), the one in progress first. */
export function safeLivesQuarters(now: Date): SafeLivesQuarter[] {
  const today = localDateOf(now.toISOString());
  const year = Number(today.slice(0, 4));
  const month = Number(today.slice(5, 7));
  let fy = month >= 4 ? year : year - 1;
  let quarter = month >= 4 ? Math.floor((month - 4) / 3) + 1 : 4;
  const out: SafeLivesQuarter[] = [];
  for (let i = 0; i < 5; i += 1) {
    const startMonth = 4 + (quarter - 1) * 3;
    const startYear = startMonth > 12 ? fy + 1 : fy;
    const sm = ((startMonth - 1) % 12) + 1;
    const lastDay = new Date(Date.UTC(startYear, sm + 2, 0)).getUTCDate();
    const from = `${startYear}-${pad(sm)}-01`;
    const to = `${startYear}-${pad(sm + 2)}-${pad(lastDay)}`;
    const fyLabel = `${fy}/${String(fy + 1).slice(2)}`;
    out.push({ id: `q${quarter}-${fy}`, label: t('reports.safeLives.quarter', { quarter, year: fyLabel, from: formatCalendarDate(from), to: formatCalendarDate(to) }), from, to, inProgress: i === 0 });
    quarter -= 1;
    if (quarter === 0) {
      quarter = 4;
      fy -= 1;
    }
  }
  return out;
}

export interface SafeLivesMeetingFigures {
  meeting: Meeting;
  /** The day the meeting was held, as a calendar date. */
  date: string;
  row: SafeLivesMeetingRow;
  /** The case references behind the row, for the preview; never written to the file. */
  references: string[];
}

/** The rows of the return for a quarter: every MARAC held in it, in date order. */
export function safeLivesRows(data: Dataset, config: Config, quarter: Pick<SafeLivesQuarter, 'from' | 'to'>): SafeLivesMeetingFigures[] {
  const dateOf = (m: Meeting) => localDateOf(m.heldAt ?? m.scheduledAt);
  const meetings = data.meetings.filter((m) => m.type === 'marac' && m.status === 'held' && dateOf(m) >= quarter.from && dateOf(m) <= quarter.to).sort((a, b) => (dateOf(a) < dateOf(b) ? -1 : 1));
  return meetings.map((meeting) => {
    const date = dateOf(meeting);
    const cases = data.processes.filter((p): p is MaracProcess => p.type === 'marac' && p.detail.meetingId === meeting.id);
    const sources = emptySafeLivesSources();
    for (const c of cases) sources[c.detail.safeLivesReturn.referralSource] += 1;
    const victims = cases.map((c) => personById(data, c.detail.referral.victimPersonId));
    const perpetrators = cases.map((c) => personById(data, c.detail.referral.perpetratorPersonId));
    const age = (dob: string | undefined) => (dob ? ageOn(dob, date) : undefined);
    const row: SafeLivesMeetingRow = {
      maracName: config.area.maracArea,
      meetingDate: date,
      casesDiscussed: cases.length,
      repeatCases: cases.filter((c) => c.detail.referral.repeat).length,
      childrenInHousehold: cases.reduce((n, c) => n + c.detail.referral.childPersonIds.length, 0),
      casesWithChildren: cases.filter((c) => c.detail.referral.childPersonIds.length > 0).length,
      sources,
      characteristics: {
        maleVictims: victims.filter((v) => v?.sex === 'male').length,
        victims16or17: victims.filter((v) => [16, 17].includes(age(v?.dateOfBirth) ?? -1)).length,
        harmingUnder18: perpetrators.filter((p) => (age(p?.dateOfBirth) ?? 99) < 18).length,
        victims65Plus: victims.filter((v) => (age(v?.dateOfBirth) ?? -1) >= 65).length,
      },
    };
    return { meeting, date, row, references: cases.map((c) => c.reference) };
  });
}

/** The name a filled return is saved as: the quarter and the MARAC are in it, because the return is per quarter per MARAC. */
export function safeLivesFileName(quarter: SafeLivesQuarter, maracName: string): string {
  const safeName = maracName.replace(/[^A-Za-z0-9]+/g, '-').replace(/^-|-$/g, '');
  const [q, fy] = quarter.id.split('-');
  return `MARAC-SafeLives-return-${(q ?? 'q').toUpperCase()}-${fy}-${Number(fy) + 1 - 2000}-${safeName}.xlsx`;
}
