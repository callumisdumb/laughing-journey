import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { SAFELIVES_SOURCES } from '../enums';
import { Xlsx } from '../test-support/xlsx';
import { SAFELIVES_FIRST_DATA_ROW, emptySafeLivesSources, safeLivesCellMap, safeLivesChecks, type SafeLivesMeetingRow } from './cellMap';
import { SAFELIVES_COLUMNS, SAFELIVES_NOT_HELD, SAFELIVES_SOURCE_AGENCY, safeLivesColumnHeader, safeLivesColumnLetter, safeLivesColumnSource, safeLivesSourceColumn, safeLivesSourceFor } from './columns';

/**
 * The column map, checked against the templates it fills.
 *
 * docs/templates/New-Marac-data-template-Scotland-2025.xlsx is the one the product fills; the UK
 * template beside it differs only in how it heads the fourteen source columns. Both are read here so
 * the header row this module expects is the template's own, cell by cell, and so the claim that the
 * two differ only in the source columns is proved rather than stated.
 */
const TEMPLATES = resolve(import.meta.dirname, '../../../../docs/templates');
const scotland = new Xlsx(resolve(TEMPLATES, 'New-Marac-data-template-Scotland-2025.xlsx'));
const uk = new Xlsx(resolve(TEMPLATES, 'New-Marac-data-template-2025.xlsx'));

function headers(book: Xlsx): Map<string, string> {
  const [name] = [...book.sheets.keys()];
  const cells = book.cells(name ?? '');
  const out = new Map<string, string>();
  for (const [ref, cell] of cells) if (/^[A-Z]+1$/.test(ref)) out.set(ref, cell.text);
  return out;
}

const scotlandHeaders = headers(scotland);
const ukHeaders = headers(uk);

function row(overrides: Partial<SafeLivesMeetingRow> = {}): SafeLivesMeetingRow {
  return {
    maracName: 'Clydeshore MARAC',
    meetingDate: '2026-09-09',
    casesDiscussed: 3,
    repeatCases: 1,
    childrenInHousehold: 4,
    casesWithChildren: 2,
    sources: { ...emptySafeLivesSources(), police: 2, secondaryCare: 1 },
    characteristics: { maleVictims: 0, victims16or17: 0, harmingUnder18: 0, victims65Plus: 1 },
    ...overrides,
  };
}

describe('the Scotland template', () => {
  it('has one sheet with the 32 headers in row 1, A to AF, and nothing under them', () => {
    expect(scotland.sheets.size).toBe(1);
    expect([...scotlandHeaders.keys()]).toHaveLength(32);
    expect(SAFELIVES_COLUMNS).toHaveLength(32);
    expect(safeLivesColumnLetter('maracName')).toBe('A');
    expect(safeLivesColumnLetter('ethnicityOther')).toBe('AF');
    const [name] = [...scotland.sheets.keys()];
    const below = [...scotland.cells(name ?? '').entries()].filter(([ref, cell]) => !/^[A-Z]+1$/.test(ref) && cell.text !== '');
    expect(below).toEqual([]);
  });

  it.each(SAFELIVES_COLUMNS.map((column) => [column, `${safeLivesColumnLetter(column)}1`] as const))('%s is the header the template prints in %s', (column, ref) => {
    expect(scotlandHeaders.get(ref)).toBe(safeLivesColumnHeader(column));
  });

  it('differs from the UK template in the fourteen source columns and nowhere else', () => {
    const differing = SAFELIVES_COLUMNS.filter((column) => scotlandHeaders.get(`${safeLivesColumnLetter(column)}1`) !== ukHeaders.get(`${safeLivesColumnLetter(column)}1`));
    expect(differing).toEqual(SAFELIVES_SOURCES.map((s) => safeLivesSourceColumn(s)));
    expect(ukHeaders.get('H1')).toBe('IDVA');
    expect(ukHeaders.get('O1')).toBe('Probation');
  });
});

describe('the column map', () => {
  it('counts each source in its own column, G to T, in the template order', () => {
    expect(SAFELIVES_SOURCES.map((s) => safeLivesColumnLetter(safeLivesSourceColumn(s)))).toEqual(['G', 'H', 'I', 'J', 'K', 'L', 'M', 'N', 'O', 'P', 'Q', 'R', 'S', 'T']);
    for (const s of SAFELIVES_SOURCES) expect(safeLivesColumnSource(safeLivesSourceColumn(s))).toBe(s);
    expect(safeLivesColumnSource('maracName')).toBeUndefined();
  });

  it('writes the first meeting in row 2 and each next meeting one row down', () => {
    const cells = safeLivesCellMap([row(), row({ meetingDate: '2026-09-23', casesDiscussed: 1, repeatCases: 0, childrenInHousehold: 0, casesWithChildren: 0, sources: { ...emptySafeLivesSources(), idaa: 1 } })]);
    expect(SAFELIVES_FIRST_DATA_ROW).toBe(2);
    const byCell = new Map(cells.map((c) => [c.cell, c]));
    expect(byCell.get('A2')).toMatchObject({ kind: 'text', value: 'Clydeshore MARAC' });
    expect(byCell.get('B2')).toMatchObject({ kind: 'date', value: '2026-09-09' });
    expect(byCell.get('C2')).toMatchObject({ kind: 'count', value: 3 });
    expect(byCell.get('G2')?.value).toBe(2);
    expect(byCell.get('K2')?.value).toBe(1);
    expect(byCell.get('AA2')?.value).toBe(1);
    expect(byCell.get('H3')?.value).toBe(1);
    expect(byCell.get('B3')?.value).toBe('2026-09-23');
    expect(cells.filter((c) => c.row === 2)).toHaveLength(32 - SAFELIVES_NOT_HELD.length);
  });

  it('emits no cell for a characteristic the product does not hold, so a blank is never a nought', () => {
    const cells = safeLivesCellMap([row()]);
    for (const column of SAFELIVES_NOT_HELD) expect(cells.find((c) => c.column === column)).toBeUndefined();
    expect(cells.find((c) => c.cell === 'U2')).toBeUndefined();
    expect(cells.find((c) => c.cell === 'AF2')).toBeUndefined();
    // Held, and written even when zero: a zero male victims is a count of none.
    expect(cells.find((c) => c.cell === 'X2')?.value).toBe(0);
  });

  it('checks repeats and children against the cases discussed, and the sources against them too', () => {
    expect(safeLivesChecks(row()).map((c) => c.state)).toEqual(['pass', 'pass', 'pass']);
    const bad = safeLivesChecks(row({ repeatCases: 4, casesWithChildren: 5, sources: { ...emptySafeLivesSources(), police: 1 } }));
    expect(bad.map((c) => [c.id, c.state, c.counted, c.expected])).toEqual([
      ['repeats', 'fail', 4, 3],
      ['children', 'fail', 5, 3],
      ['sources', 'fail', 1, 3],
    ]);
  });
});

describe('the referral source of a referral', () => {
  it('follows the agency where the agency has one source', () => {
    expect(safeLivesSourceFor('police')).toBe('police');
    expect(safeLivesSourceFor('police', 'domestic-abuse-officer')).toBe('police');
    expect(safeLivesSourceFor('education')).toBe('education');
    expect(safeLivesSourceFor('housing', 'housing-officer')).toBe('housing');
    expect(safeLivesSourceFor('sps', 'prison-social-worker')).toBe('other');
    expect(safeLivesSourceFor('court')).toBe('other');
  });

  it('follows the role where the agency spans several sources', () => {
    expect(safeLivesSourceFor('social-work', 'social-worker-children')).toBe('childrenAndFamiliesSocialWork');
    expect(safeLivesSourceFor('social-work', 'justice-social-worker')).toBe('justiceSocialWork');
    expect(safeLivesSourceFor('social-work', 'council-officer-asp')).toBe('adultSupportAndProtection');
    expect(safeLivesSourceFor('social-work')).toBe('childrenAndFamiliesSocialWork');
    expect(safeLivesSourceFor('health', 'gp')).toBe('primaryCare');
    expect(safeLivesSourceFor('health', 'midwife')).toBe('secondaryCare');
    expect(safeLivesSourceFor('health', 'cmhn')).toBe('mentalHealth');
    expect(safeLivesSourceFor('third-sector', 'idaa')).toBe('idaa');
    expect(safeLivesSourceFor('third-sector', 'womens-aid-worker')).toBe('voluntarySector');
  });

  it('never proposes MASH, which Scotland does not have', () => {
    const agencies = ['police', 'social-work', 'health', 'education', 'housing', 'third-sector', 'sps', 'scra', 'court', 'regulator', 'fire-rescue'] as const;
    for (const a of agencies) expect(safeLivesSourceFor(a)).not.toBe('mash');
    expect(SAFELIVES_SOURCE_AGENCY.mash).toBeUndefined();
  });
});
