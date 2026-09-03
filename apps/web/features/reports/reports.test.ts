import { DEFAULT_CONFIG, demoNow } from '@mas/domain';
import { buildDataset } from '@mas/mock-data';
import { describe, expect, it } from 'vitest';
import { buildModel } from './buildModel';
import type { ReportKind } from './model';
import { periodsFor, resolvePeriod } from './period';

const data = buildDataset({});
const now = demoNow();

function figures(kind: ReportKind, periodId: string | null) {
  const period = resolvePeriod(kind, now, periodId);
  const model = buildModel(kind, data, DEFAULT_CONFIG, now, period, { population: 41000 });
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
    const age = y2026.model.sections.find((s) => s.id === 'age')?.tables[0]?.rows.find((r) => r[0] === '5 to 10');
    expect(age?.[1]).toBe(1);
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
    expect(y2027.model.meta.join(' ')).toContain('Annex 3 tables 1 to 9 (MAPPA National Guidance)');
    expect(y2027.model.meta.join(' ')).not.toContain('Field set to verify');

    // Nine sections, one per table, in the annex order, and the only chart sits on Table 3.
    expect(y2027.model.sections.map((s) => s.id)).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9].map((n) => `table-${n}`));
    expect(y2027.model.sections.map((s) => s.title.startsWith('Table '))).not.toContain(false);
    expect(y2027.model.sections.filter((s) => s.chart).map((s) => s.id)).toEqual(['table-3']);

    // Figures are keyed on row ids, so the checks read the cells by position rather than by label.
    const values = (model: typeof y2027.model, id: string) => model.sections.find((s) => s.id === id)?.tables[0]?.rows.map((r) => r.slice(1));
    expect(values(y2027.model, 'table-1')).toEqual([[1], ['Data not held'], [0], ['Data not held'], [0]]);
    expect(values(y2027.model, 'table-2')).toEqual([[0], [0], [0], [0], [1], [1], [0], [0], ['Data not held']]);
    expect(values(y2026.model, 'table-2')?.[4]).toEqual([0]);
    expect(values(y2027.model, 'table-3')).toEqual([[0, 1, 0, 1]]);
    expect(values(y2027.model, 'table-4')).toEqual([[0], [0], [0], [0]]);
    expect(values(y2027.model, 'table-5')).toEqual([[0], [0], [0], [0]]);
    expect(values(y2027.model, 'table-6')).toEqual([[1], [0], [0], [1]]);
    expect(values(y2027.model, 'table-7')).toEqual([[1], [0], [1]]);
    expect(values(y2027.model, 'table-8')?.flat()).toEqual(['Data not held', 'Data not held', 'Data not held']);
    expect(values(y2027.model, 'table-9')).toEqual([[0], [1], [0], [0]]);

    const json = JSON.stringify(y2027.model);
    for (const identifying of ['Muir', 'Derek', 'MAPPA-2026-0034', '1974-06-08', '08 Jun 1974', 'ViSOR', 'Ardvale Sheriff Court']) expect(json).not.toContain(identifying);
  });

  it('AWI: one council welfare application with the MHO report still running and no order yet', () => {
    const ytd = figures('awi', null);
    expect(ytd.map['applications']).toBe('1');
    expect(ytd.map['interim']).toBe('1');
    expect(ytd.map['median']).toBe('n/a');
    expect(ytd.model.sections.find((s) => s.id === 'mho')?.tables[0]?.rows[0]?.[3]).toMatch(/In progress, 12 days left/);
  });
});
