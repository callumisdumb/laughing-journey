import { describe, expect, it } from 'vitest';
import { findDuplicateCandidates, type MatchReason } from './duplicates';
import type { Address, Person } from '../schemas/person';

const ADDRESSES: Address[] = [
  { id: 'adr_1', synthetic: true, line1: '12 Brae Wynd', town: 'Craiglarrick', postcode: 'QX5 3RT' },
  { id: 'adr_2', synthetic: true, line1: '8 Harbour Brae', town: 'Ardvale', postcode: 'QX1 4LP' },
];

function person(over: Partial<Person> & Pick<Person, 'id' | 'givenName' | 'familyName'>): Person {
  return {
    synthetic: true,
    aliases: [],
    lifeStage: 'adult',
    sex: 'not-recorded',
    addressHistory: [],
    communicationNeeds: { needs: [] },
    alerts: [],
    contact: {},
    createdAt: '2026-01-01T09:00:00+00:00',
    ...over,
  };
}

const kinds = (reasons: MatchReason[]): string[] => reasons.map((r) => r.kind);

describe('the duplicate search, which is what the create path is built around', () => {
  it('finds the same name written the same way', () => {
    const people = [person({ id: 'p1', givenName: 'Aiden', familyName: 'Boyle' })];
    const found = findDuplicateCandidates(people, ADDRESSES, { givenName: 'Aiden', familyName: 'Boyle' });
    expect(found).toHaveLength(1);
    expect(kinds(found[0]!.reasons)).toContain('name');
  });

  it('finds Mc against Mac, which no edit distance catches without catching everything else', () => {
    const people = [person({ id: 'p1', givenName: 'Shona', familyName: 'MacLeod' })];
    const found = findDuplicateCandidates(people, ADDRESSES, { givenName: 'Shona', familyName: 'McLeod' });
    expect(found).toHaveLength(1);
  });

  it('finds a hyphen somebody dropped', () => {
    const people = [person({ id: 'p1', givenName: 'Erin', familyName: 'Smith-Jones' })];
    const found = findDuplicateCandidates(people, ADDRESSES, { givenName: 'Erin', familyName: 'SmithJones' });
    expect(found).toHaveLength(1);
  });

  it('finds a forename and a middle name swapped between agencies', () => {
    const people = [person({ id: 'p1', givenName: 'James Ryan', familyName: 'Kerr' })];
    const found = findDuplicateCandidates(people, ADDRESSES, { givenName: 'Ryan James', familyName: 'Kerr' });
    expect(found).toHaveLength(1);
  });

  it('finds initials against full names', () => {
    const people = [person({ id: 'p1', givenName: 'Ryan', familyName: 'Kerr' })];
    const found = findDuplicateCandidates(people, ADDRESSES, { givenName: 'R', familyName: 'Kerr' });
    expect(found).toHaveLength(1);
  });

  it('finds a married name recorded on one system against a maiden name on another', () => {
    const people = [person({ id: 'p1', givenName: 'Kayleigh', familyName: 'Docherty', aliases: ['Kayleigh Kerr'] })];
    const found = findDuplicateCandidates(people, ADDRESSES, { givenName: 'Kayleigh', familyName: 'Kerr' });
    expect(found).toHaveLength(1);
    expect(kinds(found[0]!.reasons)).toContain('alias');
  });

  describe('dates of birth, compared as strings and never through a Date', () => {
    const people = [person({ id: 'p1', givenName: 'Aiden', familyName: 'Boyle', dateOfBirth: '2019-03-14' })];

    it('matches exactly', () => {
      const found = findDuplicateCandidates(people, ADDRESSES, { familyName: 'Boyle', dateOfBirth: '2019-03-14' });
      expect(kinds(found[0]!.reasons)).toContain('dob-exact');
    });

    it('matches the day and month the wrong way round, which is what retyping an American date does', () => {
      const found = findDuplicateCandidates(people, ADDRESSES, { familyName: 'Boyle', dateOfBirth: '2019-14-03' });
      expect(kinds(found[0]!.reasons)).toContain('dob-day-month-swapped');
    });

    it('matches two transposed digits, the commonest typing error in a date', () => {
      const found = findDuplicateCandidates(people, ADDRESSES, { familyName: 'Boyle', dateOfBirth: '2019-03-41' });
      expect(kinds(found[0]!.reasons)).toContain('dob-transposed');
    });

    it('matches a year on its own, because an age is often all anybody knows', () => {
      const found = findDuplicateCandidates(people, ADDRESSES, { familyName: 'Boyle', dateOfBirth: '2019' });
      expect(kinds(found[0]!.reasons)).toContain('dob-year');
    });

    it('does not match an unrelated date', () => {
      const found = findDuplicateCandidates(people, ADDRESSES, { familyName: 'Boyle', dateOfBirth: '2011-08-02' });
      expect(kinds(found[0]!.reasons)).not.toContain('dob-exact');
    });
  });

  it('matches a second pre-birth record against the first one expected delivery date', () => {
    const people = [person({ id: 'p1', givenName: 'Unborn baby', familyName: 'Reid', lifeStage: 'unborn', expectedDeliveryDate: '2026-11-12' })];
    const found = findDuplicateCandidates(people, ADDRESSES, { familyName: 'Reid', dateOfBirth: '2026-11-12' });
    expect(kinds(found[0]!.reasons)).toContain('expected-delivery');
  });

  it('takes a CHI as decisive on its own', () => {
    const people = [person({ id: 'p1', givenName: 'Marion', familyName: 'Fraser', chi: '1403198616' })];
    const found = findDuplicateCandidates(people, ADDRESSES, { chi: '1403198616' });
    expect(found).toHaveLength(1);
    expect(kinds(found[0]!.reasons)).toEqual(['chi']);
  });

  it('finds a previous address as well as a current one, and says which', () => {
    const people = [
      person({ id: 'p1', givenName: 'Aiden', familyName: 'Boyle', addressHistory: [{ addressId: 'adr_1', from: '2025-01-01' }, { addressId: 'adr_2', from: '2020-01-01', to: '2024-12-31' }] }),
    ];
    const current = findDuplicateCandidates(people, ADDRESSES, { familyName: 'Boyle', address: 'Brae Wynd' });
    expect(current[0]!.reasons).toContainEqual({ kind: 'address', current: true });
    const previous = findDuplicateCandidates(people, ADDRESSES, { familyName: 'Boyle', address: 'Harbour Brae' });
    expect(previous[0]!.reasons).toContainEqual({ kind: 'address', current: false });
  });

  it('does not return half the caseload because two people share a town', () => {
    const people = [
      person({ id: 'p1', givenName: 'Aiden', familyName: 'Boyle', addressHistory: [{ addressId: 'adr_1', from: '2025-01-01' }] }),
      person({ id: 'p2', givenName: 'Stacey', familyName: 'Boyle', addressHistory: [{ addressId: 'adr_1', from: '2025-01-01' }] }),
    ];
    // An address on its own is not a candidate; with a name it is a reason.
    expect(findDuplicateCandidates(people, ADDRESSES, { address: 'Craiglarrick' })).toEqual([]);
    expect(findDuplicateCandidates(people, ADDRESSES, { familyName: 'Boyle', address: 'Craiglarrick' }).length).toBe(2);
  });

  it('leaves unrelated people alone, which is the half that makes the list usable', () => {
    const people = [
      person({ id: 'p1', givenName: 'Aiden', familyName: 'Boyle' }),
      person({ id: 'p2', givenName: 'Marion', familyName: 'Fraser' }),
      person({ id: 'p3', givenName: 'Tomasz', familyName: 'Nowak' }),
    ];
    expect(findDuplicateCandidates(people, ADDRESSES, { givenName: 'Aiden', familyName: 'Boyle' })).toHaveLength(1);
  });

  it('never offers the record being edited as a duplicate of itself', () => {
    const people = [person({ id: 'p1', givenName: 'Aiden', familyName: 'Boyle' })];
    expect(findDuplicateCandidates(people, ADDRESSES, { givenName: 'Aiden', familyName: 'Boyle' }, { excludeId: 'p1' })).toEqual([]);
  });

  it('orders a CHI match above a name match, because one is decisive and the other is a guess', () => {
    const people = [
      person({ id: 'p1', givenName: 'Marion', familyName: 'Fraser' }),
      person({ id: 'p2', givenName: 'Marion', familyName: 'Frazer', chi: '1403198616' }),
    ];
    const found = findDuplicateCandidates(people, ADDRESSES, { givenName: 'Marion', familyName: 'Fraser', chi: '1403198616' });
    expect(found[0]!.person.id).toBe('p2');
  });
});
