import { DEFAULT_CONFIG, demoNow, safeLivesCellMap, safeLivesChecks, type Dataset } from '@mas/domain';
import { buildDataset } from '@mas/mock-data';
import { describe, expect, it } from 'vitest';
import { safeLivesFileName, safeLivesQuarters, safeLivesRows } from './safeLivesFigures';

const now = demoNow();

/** The seed with Kayleigh Docherty's MARAC held, which the seed leaves scheduled for 9 Sep 2026. */
function withKayleighHeard(): Dataset {
  const data = buildDataset({});
  return { ...data, meetings: data.meetings.map((m) => (m.id === 'mtg_docherty_marac' ? { ...m, status: 'held' as const, heldAt: '2026-09-09T09:30:00.000Z' } : m)) };
}

describe('the SafeLives quarters', () => {
  it('run on the financial year, the quarter in progress first, five in all', () => {
    const quarters = safeLivesQuarters(now);
    expect(quarters.map((q) => q.id)).toEqual(['q2-2026', 'q1-2026', 'q4-2025', 'q3-2025', 'q2-2025']);
    expect(quarters[0]).toMatchObject({ from: '2026-07-01', to: '2026-09-30', inProgress: true });
    expect(quarters[2]).toMatchObject({ from: '2026-01-01', to: '2026-03-31', inProgress: false });
    expect(quarters[0]?.label).toBe('Q2 2026/27, 01 Jul 2026 to 30 Sep 2026');
  });
});

describe('the SafeLives rows', () => {
  it('holds no row for a quarter in which no MARAC was held', () => {
    expect(safeLivesRows(buildDataset({}), DEFAULT_CONFIG, safeLivesQuarters(now)[0]!)).toEqual([]);
  });

  it('counts the cases a held meeting heard, by source and characteristic, on the day it was held', () => {
    const rows = safeLivesRows(withKayleighHeard(), DEFAULT_CONFIG, safeLivesQuarters(now)[0]!);
    expect(rows).toHaveLength(1);
    const [figures] = rows;
    expect(figures?.date).toBe('2026-09-09');
    expect(figures?.references).toHaveLength(1);
    expect(figures?.row).toMatchObject({
      maracName: 'Clydeshore MARAC',
      meetingDate: '2026-09-09',
      casesDiscussed: 1,
      repeatCases: 1,
      childrenInHousehold: 2,
      casesWithChildren: 1,
      characteristics: { maleVictims: 0, victims16or17: 0, harmingUnder18: 0, victims65Plus: 0 },
    });
    expect(figures?.row.sources.police).toBe(1);
    expect(Object.values(figures?.row.sources ?? {}).reduce((a, b) => a + b, 0)).toBe(1);
    // Not held, so not on the row at all.
    expect(figures?.row.characteristics.lgbtq).toBeUndefined();
    expect(figures?.row.characteristics.ethnicityAsian).toBeUndefined();
    expect(safeLivesChecks(figures!.row).every((c) => c.state === 'pass')).toBe(true);
    expect(safeLivesCellMap(rows.map((r) => r.row))).toHaveLength(24);
  });

  it('names the quarter and the MARAC in the file, with no marking because nothing in it names anyone', () => {
    expect(safeLivesFileName(safeLivesQuarters(now)[0]!, 'Clydeshore MARAC')).toBe('MARAC-SafeLives-return-Q2-2026-27-Clydeshore-MARAC.xlsx');
  });
});
