import type { Household, Person } from '../schemas/person';
import { membersOn } from './network';

/**
 * Moving a household (D-244).
 *
 * One address, one date, everybody who lives there on that date, and a chronology event for each of
 * them written by the caller. Anybody named as staying behind leaves the household on the date and
 * either starts a household of their own at the address they give, or goes nowhere the record can
 * name, in which case their address period simply closes. Two people staying behind at the same
 * address form one household. Nothing here writes: the plan is what the store writes, in order,
 * through the pipeline, and it is the plan a unit test can hold up to the light.
 */
export interface StayBehind {
  personId: string;
  /** Where they are going instead, where the record knows. */
  addressId?: string;
}

export interface HouseholdMoveInput {
  household: Household;
  /** The people the household's current memberships name; anybody missing from here is left as they are. */
  people: readonly Person[];
  addressId: string;
  on: string;
  stayBehind: readonly StayBehind[];
  note?: string;
  newId: (prefix: string) => string;
  /** A label for a household the move creates for the people it leaves behind. */
  labelFor: (person: Person) => string;
  /** Why a membership that ends here ended, for the record. */
  endedReason: string;
}

export interface HouseholdMovePlan {
  /** The household at its new address, its stay-behind memberships ended on the date. */
  household: Household;
  /** Everybody who moved, each with the address period opened and the old one closed. */
  moving: Person[];
  /** Everybody who stayed, each with their own address period closed and, where they gave one, a new household. */
  left: Array<{ person: Person; household?: Household }>;
}

export type HouseholdMoveResult = { ok: true; plan: HouseholdMovePlan } | { ok: false; errors: string[] };

export function planHouseholdMove(input: HouseholdMoveInput): HouseholdMoveResult {
  const { household, on, addressId } = input;
  const errors: string[] = [];
  if (!on) errors.push('moveDateRequired');
  if (!addressId) errors.push('addressMissing');
  if (addressId && addressId === household.addressId) errors.push('moveSameAddress');
  const current = membersOn(household, on || '9999-12-31');
  const currentIds = new Set(current.map((m) => m.personId));
  const staying = new Set(input.stayBehind.map((s) => s.personId));
  for (const id of staying) if (!currentIds.has(id)) errors.push('householdNotAMember');
  if (current.length > 0 && current.every((m) => staying.has(m.personId))) errors.push('moveNobodyMoving');
  if (errors.length > 0) return { ok: false, errors: [...new Set(errors)] };

  const personById = new Map(input.people.map((p) => [p.id, p]));
  const closeCurrent = (person: Person): Person['addressHistory'] => person.addressHistory.map((a) => (a.to ? a : { ...a, to: on }));

  const moving: Person[] = [];
  for (const m of current) {
    if (staying.has(m.personId)) continue;
    const person = personById.get(m.personId);
    if (!person) continue;
    moving.push({ ...person, householdId: household.id, addressHistory: [{ addressId, from: on }, ...closeCurrent(person)] });
  }

  // One new household per distinct address the stay-behind people give, so two people who stay
  // together stay together on the record.
  const fresh = new Map<string, Household>();
  const left: HouseholdMovePlan['left'] = [];
  for (const stay of input.stayBehind) {
    const person = personById.get(stay.personId);
    if (!person) continue;
    if (!stay.addressId) {
      left.push({ person: { ...person, householdId: undefined, addressHistory: closeCurrent(person) } });
      continue;
    }
    let target = fresh.get(stay.addressId);
    if (!target) {
      target = { id: input.newId('hh'), synthetic: true, addressId: stay.addressId, members: [], label: input.labelFor(person) };
      fresh.set(stay.addressId, target);
    }
    target.members = [...target.members, { personId: person.id, from: on }];
    left.push({ person: { ...person, householdId: target.id, addressHistory: [{ addressId: stay.addressId, from: on }, ...closeCurrent(person)] }, household: target });
  }

  const moved: Household = {
    ...household,
    addressId,
    members: household.members.map((m) => (staying.has(m.personId) && !m.to ? { ...m, to: on, endedReason: input.endedReason } : m)),
  };
  return { ok: true, plan: { household: moved, moving, left } };
}
