import { describe, expect, it } from 'vitest';
import type { Household, Person } from '../schemas/person';
import { planHouseholdMove } from './move';

const person = (id: string, addressId: string): Person =>
  ({ id, synthetic: true, givenName: id, familyName: 'Test', dateOfBirth: '1990-01-01', sex: 'female', chi: undefined, aliases: [], contacts: [], communicationNeeds: [], alerts: [], addressHistory: [{ addressId, from: '2020-01-01' }], householdId: 'hh_1', lifeStage: 'adult' }) as unknown as Person;

const household: Household = { id: 'hh_1', synthetic: true, addressId: 'adr_old', members: [{ personId: 'a', from: '2020-01-01' }, { personId: 'b', from: '2020-01-01' }, { personId: 'c', from: '2021-06-01' }, { personId: 'd', from: '2019-01-01', to: '2020-05-01' }], label: 'Test household' };
const people = [person('a', 'adr_old'), person('b', 'adr_old'), person('c', 'adr_old'), person('d', 'adr_old')];
let n = 0;
const base = { household, people, addressId: 'adr_new', on: '2026-09-02', newId: (p: string) => `${p}_${(n += 1)}`, labelFor: (p: Person) => `${p.familyName} household`, endedReason: 'Stayed behind' };

describe('planHouseholdMove', () => {
  it('moves everybody who lives there on the date, and nobody who had already left', () => {
    const result = planHouseholdMove({ ...base, stayBehind: [] });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.plan.household.addressId).toBe('adr_new');
    expect(result.plan.moving.map((p) => p.id)).toEqual(['a', 'b', 'c']);
    for (const p of result.plan.moving) {
      expect(p.addressHistory[0]).toEqual({ addressId: 'adr_new', from: '2026-09-02' });
      expect(p.addressHistory[1]).toMatchObject({ addressId: 'adr_old', to: '2026-09-02' });
      expect(p.householdId).toBe('hh_1');
    }
    expect(result.plan.left).toEqual([]);
    // The ended membership is untouched: address history is kept, never rewritten.
    expect(result.plan.household.members.find((m) => m.personId === 'd')).toEqual({ personId: 'd', from: '2019-01-01', to: '2020-05-01' });
  });

  it('leaves named people behind, with a household of their own where they gave an address and none where they did not', () => {
    const result = planHouseholdMove({ ...base, stayBehind: [{ personId: 'b', addressId: 'adr_b' }, { personId: 'c' }] });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.plan.moving.map((p) => p.id)).toEqual(['a']);
    const b = result.plan.left.find((l) => l.person.id === 'b')!;
    expect(b.household).toMatchObject({ addressId: 'adr_b', members: [{ personId: 'b', from: '2026-09-02' }] });
    expect(b.person.householdId).toBe(b.household!.id);
    expect(b.person.addressHistory[0]).toEqual({ addressId: 'adr_b', from: '2026-09-02' });
    const c = result.plan.left.find((l) => l.person.id === 'c')!;
    expect(c.household).toBeUndefined();
    expect(c.person.householdId).toBeUndefined();
    expect(c.person.addressHistory).toEqual([{ addressId: 'adr_old', from: '2020-01-01', to: '2026-09-02' }]);
    // Their memberships in the moving household end on the date, with the reason.
    expect(result.plan.household.members.filter((m) => m.to === '2026-09-02').map((m) => m.personId)).toEqual(['b', 'c']);
  });

  it('puts two people who stay behind at the same address into one household', () => {
    const result = planHouseholdMove({ ...base, stayBehind: [{ personId: 'b', addressId: 'adr_b' }, { personId: 'c', addressId: 'adr_b' }] });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const ids = new Set(result.plan.left.map((l) => l.household?.id));
    expect(ids.size).toBe(1);
    expect(result.plan.left[0]!.household!.members.map((m) => m.personId)).toEqual(['b', 'c']);
  });

  it('refuses a move with nobody moving, to the same address, without a date, or naming somebody who does not live there', () => {
    expect(planHouseholdMove({ ...base, stayBehind: [{ personId: 'a' }, { personId: 'b' }, { personId: 'c' }] })).toEqual({ ok: false, errors: ['moveNobodyMoving'] });
    expect(planHouseholdMove({ ...base, addressId: 'adr_old', stayBehind: [] })).toEqual({ ok: false, errors: ['moveSameAddress'] });
    expect(planHouseholdMove({ ...base, on: '', stayBehind: [] })).toEqual({ ok: false, errors: ['moveDateRequired'] });
    expect(planHouseholdMove({ ...base, stayBehind: [{ personId: 'd' }] })).toEqual({ ok: false, errors: ['householdNotAMember'] });
  });
});
