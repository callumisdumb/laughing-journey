import { DEFAULT_CONFIG, demoNow } from '@mas/domain';
import { t } from '@mas/messages';
import { buildDataset } from '@mas/mock-data';
import { describe, expect, it } from 'vitest';
import { buildModel } from './buildModel';
import { ETHNICITY_NOT_HELD_ROW, ETHNICITY_ZERO_ROWS, MAPPA_ANNEX3_TABLES, annexTitle } from './mappaAnnex3';
import type { AnnexTable } from './mappaAnnex3';
import type { ReportKind } from './model';
import { periodsFor, resolvePeriod } from './period';

const data = buildDataset({});
const now = demoNow();
const notHeld = t('reports.mappaAnnex3.dataNotHeld');
const notApplicable = t('reports.values.notApplicable');

function figures(kind: ReportKind, periodId: string | null) {
  const period = resolvePeriod(kind, now, periodId);
  const model = buildModel(kind, data, DEFAULT_CONFIG, now, period, { population: 41000, childPopulation: 18500 });
  return { period, model, map: Object.fromEntries(model.figures.map((f) => [f.id, f.value])) };
}

describe('report periods', () => {
  it('open on the documented defaults', () => {
    expect(resolvePeriod('cp', now, null)).toMatchObject({ id: 'y2026', from: '2025-08-01', to: '2026-07-31' });
    expect(resolvePeriod('asp', now, null)).toMatchObject({ id: 'b2026', from: '2024-04-01', to: '2026-03-31' });
    expect(resolvePeriod('mappa', now, null)).toMatchObject({ id: 'y2026', from: '2025-04-01', to: '2026-03-31' });
    expect(resolvePeriod('awi', now, null)).toMatchObject({ id: 'ytd', from: '2026-04-01', to: '2026-09-02' });
    expect(resolvePeriod('marac', now, null)).toMatchObject({ id: 'q2026-3', from: '2025-10-01', to: '2026-09-02' });
    expect(periodsFor('asp', now)[0]).toMatchObject({ id: 'b2028', from: '2026-04-01', inProgress: true });
  });

  it('falls back to the default for an unknown period id', () => {
    expect(resolvePeriod('cp', now, 'nonsense').id).toBe('y2026');
  });
});

describe('report figures are computed from the seed, never typed in', () => {
  it('CP: Aiden registered in the year to 31 Jul 2026, Chloe registered in 2019 and de-registered in 2021', () => {
    const y2026 = figures('cp', null);
    expect(y2026.map['registrations']).toBe('1');
    expect(y2026.map['at-end']).toBe('1');
    expect(y2026.map['pre-birth']).toBe('0');
    expect(y2026.map['re-registrations']).toBe('0');
    expect(figures('cp', 'y2019').map['registrations']).toBe('1');
    expect(figures('cp', 'y2021').map['deregistrations']).toBe('1');
    // The publication's tables: sex first, then age, each with a percentage column and a total.
    const ageSection = y2026.model.sections.find((s) => s.id === 'age');
    const sexRows = ageSection?.tables[0]?.rows ?? [];
    const ageRows = ageSection?.tables[1]?.rows ?? [];
    expect(sexRows.find((r) => r[0] === t('reports.cp.sexRows.male'))).toEqual([t('reports.cp.sexRows.male'), 1, '100.0']);
    expect(ageRows.find((r) => r[0] === t('reports.cp.ageBands.fiveToTen'))).toEqual([t('reports.cp.ageBands.fiveToTen'), 1, '100.0']);
    // No under-1 band: the publication bands 0 to 4 together.
    expect(ageRows.map((r) => r[0])).toContain(t('reports.cp.ageBands.zeroToFour'));
    expect(ageRows.map((r) => r[0])).toContain(t('reports.cp.ageBands.unknown'));
    expect(ageRows[ageRows.length - 1]?.[0]).toBe(t('reports.cp.rows.total'));

    // The rate per 1,000 uses the placeholder child population passed to the model.
    const rateRows = y2026.model.sections.find((s) => s.id === 'rate')?.tables[0]?.rows ?? [];
    expect(rateRows[0]?.[2]).toBe('0.1'); // 1 child in 18,500

    // Table 1.3a: Aiden's CPPM had an IRD nine days before it, so it counts as linked.
    expect(y2026.map['ird-linked']).toBe('1');
    const linkage = y2026.model.sections.find((s) => s.id === 'linkage')?.tables[0]?.rows ?? [];
    const linkageRow = (key: string) => linkage.find((r) => r[0] === t(`reports.cp.linkage.${key}` as 'reports.cp.linkage.withIrd'));
    expect(linkageRow('withIrd')?.[1]).toBe(1);
    expect(linkageRow('withoutIrd')?.[1]).toBe(0);
    expect(linkageRow('registrationsWithIrd')?.[1]).toBe(1);

    // Concerns, not a category of registration: Aiden's register entry carries three.
    const concerns = y2026.model.sections.find((s) => s.id === 'concerns')?.tables[0]?.rows ?? [];
    expect(concerns.filter((r) => r[1] === 1).map((r) => r[0])).toEqual(expect.arrayContaining([t('domain.cpConcerns.emotionalAbuse'), t('domain.cpConcerns.physicalAbuse'), t('domain.cpConcerns.domesticAbuse')]));

    // De-registration reasons come from the publication's list, and Chloe's is coded.
    const y2021 = figures('cp', 'y2021');
    const reasons = y2021.model.sections.find((s) => s.id === 'length')?.tables[2]?.rows ?? [];
    expect(reasons).toHaveLength(9);
    expect(reasons.find((r) => r[0] === t('domain.cpDeregistrationReasons.childWithOtherCarers'))?.[1]).toBe(1);
    // A child who died is never named in the report.
    expect(JSON.stringify(y2021.model)).not.toContain('Chloe');

    // Time since last de-registration, for registrations in the year.
    const since = y2026.model.sections.find((s) => s.id === 'history')?.tables[1]?.rows ?? [];
    expect(since.find((r) => r[0] === t('reports.cp.sinceBands.never'))?.[1]).toBe(1);

    expect(y2026.model.meta.join(' ')).toContain(t('reports.cp.meta.fieldSet'));
    expect(y2026.model.meta.join(' ')).not.toContain(t('reports.meta.verify'));
  });

  it('ASP: nothing in the biennium to 31 Mar 2026, three referrals in the biennium in progress', () => {
    expect(figures('asp', null).model.activity).toBe(0);
    const b2028 = figures('asp', 'b2028');
    expect(b2028.map['referrals']).toBe('3');
    expect(b2028.map['lsi']).toBe('1');
    expect(b2028.map['orders']).toBe('0');
    expect(b2028.model.sections[0]?.chart?.series.map((s) => s.key)).toEqual(['police', 'regulator', 'fire-rescue']);
  });

  it('MARAC: two referrals, one repeat, two children, half from police', () => {
    const q = figures('marac', null);
    expect(q.map['referrals']).toBe('2');
    expect(q.map['repeat']).toBe('50.0%');
    expect(q.map['children']).toBe('2');
    expect(q.map['police']).toBe('50.0%');
  });

  it('MAPPA: Annex 3 Tables 1 to 9, one Category 1 Level 2 RSO in the community in the year in progress, no names anywhere', () => {
    const y2026 = figures('mappa', null);
    expect(y2026.model.activity).toBe(0);
    const y2027 = figures('mappa', 'y2027');
    expect(y2027.map['at-end']).toBe('1');
    expect(y2027.map['l2']).toBe('1');
    expect(y2027.map['late']).toBe('0');
    expect(y2027.map['orders']).toBe('1');
    expect(y2027.model.meta.join(' ')).toContain(t('reports.mappa.meta.fieldSet'));
    expect(y2027.model.meta.join(' ')).not.toContain(t('reports.meta.verify'));

    // Nine sections, one per table, in the annex order with the catalogue's table titles, and the only chart sits on Table 3.
    expect(y2027.model.sections.map((s) => s.id)).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9].map((n) => `table-${n}`));
    expect(y2027.model.sections.map((s) => s.title)).toEqual(MAPPA_ANNEX3_TABLES.map((table) => t('reports.mappa.sections.tableTitle', { number: table.number, title: annexTitle(table) })));
    expect(y2027.model.sections.filter((s) => s.chart).map((s) => s.id)).toEqual(['table-3']);

    // Figures are keyed on row ids, so the checks read the cells by position rather than by label.
    const rowsOf = (model: typeof y2027.model, id: string) => model.sections.find((s) => s.id === id)?.tables[0]?.rows ?? [];
    const values = (model: typeof y2027.model, id: string) => rowsOf(model, id).map((r) => r.slice(1));
    const cellsFor = (model: typeof y2027.model, tableId: AnnexTable['id'], rowId: string) => {
      const table = MAPPA_ANNEX3_TABLES.find((x) => x.id === tableId);
      const index = table?.rows.findIndex((r) => r.id === rowId) ?? -1;
      return rowsOf(model, tableId)[index]?.slice(1);
    };

    // A lettered heading the annex prints above its numbered parts carries no figure.
    for (const table of MAPPA_ANNEX3_TABLES) {
      table.rows.forEach((row, i) => {
        if (row.group) expect(rowsOf(y2027.model, table.id)[i]?.slice(1).every((c) => c === '')).toBe(true);
      });
    }

    expect(cellsFor(y2027.model, 'table-1', 'at-liberty')).toEqual([1]);
    expect(cellsFor(y2027.model, 'table-1', 'per-100k')).toEqual([notHeld]);
    expect(cellsFor(y2027.model, 'table-1', 'wanted')).toEqual([notHeld]);
    expect(cellsFor(y2027.model, 'table-2', 'shpo-in-force')).toEqual([1]);
    expect(cellsFor(y2027.model, 'table-2', 'shpo-granted')).toEqual([1]);
    expect(cellsFor(y2027.model, 'table-2', 'sopo-in-force')).toEqual([0]);
    expect(cellsFor(y2026.model, 'table-2', 'shpo-in-force')).toEqual([0]);
    // Table 3 splits each level across custody and liberty: the one RSO is at liberty at Level 2.
    expect(cellsFor(y2027.model, 'table-3', 'level-2')).toEqual([0, 1, 1]);
    expect(cellsFor(y2027.model, 'table-3', 'level-1')).toEqual([0, 0, 0]);
    expect(cellsFor(y2027.model, 'table-4', 'living-in-area')).toEqual([0]);
    expect(cellsFor(y2027.model, 'table-5', 'level-2')).toEqual([0]);

    // The annex gives Category 3 offenders no Level 1 row: they cannot be managed at Level 1.
    const table5 = MAPPA_ANNEX3_TABLES.find((x) => x.id === 'table-5');
    expect(table5?.rows.map((r) => r.id)).not.toContain('level-1');
    expect(table5?.rows.filter((r) => r.id.includes('level-1'))).toEqual([]);

    // Table 6 bands the one RSO by age; Table 7 by sex. Both carry a percentage.
    expect(values(y2027.model, 'table-6')?.filter((c) => c[0] === 1)).toHaveLength(2); // the band and the total
    expect(cellsFor(y2027.model, 'table-6', 'total')).toEqual([1, '100.0']);
    expect(cellsFor(y2027.model, 'table-7', 'male')).toEqual([1, '100.0']);
    expect(cellsFor(y2027.model, 'table-7', 'other')).toEqual([0, '0.0']);

    // Table 8 renders in full: every ethnicity row is zero and the whole population sits under Data Not held.
    expect(rowsOf(y2027.model, 'table-8')).toHaveLength(22);
    for (const rowId of ETHNICITY_ZERO_ROWS) expect(cellsFor(y2027.model, 'table-8', rowId)).toEqual([0, '0.0']);
    expect(cellsFor(y2027.model, 'table-8', ETHNICITY_NOT_HELD_ROW)).toEqual([1, '100.0']);
    expect(cellsFor(y2027.model, 'table-8', 'total')).toEqual([1, '100.0']);

    expect(cellsFor(y2027.model, 'table-9', 'statutory-supervision')).toEqual([1, '100.0']);
    expect(cellsFor(y2027.model, 'table-9', 'notification-only')).toEqual([0, '0.0']);

    const json = JSON.stringify(y2027.model);
    for (const identifying of ['Muir', 'Derek', 'MAPPA-2026-0034', '1974-06-08', '08 Jun 1974', 'ViSOR', 'Ardvale Sheriff Court']) expect(json).not.toContain(identifying);
  });

  it('AWI: one council welfare application with the MHO report still running and no order yet', () => {
    const ytd = figures('awi', null);
    expect(ytd.map['applications']).toBe('1');
    expect(ytd.map['interim']).toBe('1');
    expect(ytd.map['median']).toBe(notApplicable);
    expect(ytd.model.sections.find((s) => s.id === 'mho')?.tables[0]?.rows[0]?.[3]).toBe(t('reports.awi.mho.running', { days: 12 }));
  });
});
