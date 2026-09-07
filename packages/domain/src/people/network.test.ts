import { describe, expect, it } from 'vitest';
import { RELATIONSHIP_TYPES } from '../enums';
import type { Dataset } from '../schemas/dataset';
import type { Household, Person, Relationship } from '../schemas/person';
import { covers, householdOn, householdOnlyMembers, inverseOf, isSymmetric, membersOn, networkOn, subjectsOf, withRelationship } from './network';

function person(over: Partial<Person> & { id: string }): Person {
  return {
    synthetic: true,
    givenName: 'A',
    familyName: 'Person',
    aliases: [],
    lifeStage: 'adult',
    sex: 'not-recorded',
    addressHistory: [],
    communicationNeeds: { needs: [] },
    alerts: [],
    contact: {},
    createdAt: '2026-01-05T09:00:00Z',
    ...over,
  };
}

const HOUSE: Household = {
  id: 'hh_1',
  synthetic: true,
  addressId: 'adr_1',
  label: 'Docherty household',
  members: [
    { personId: 'per_mum', from: '2023-01-20' },
    { personId: 'per_kid', from: '2023-01-20' },
    { personId: 'per_ex', from: '2023-01-20', to: '2026-03-14', endedReason: 'Relationship ended' },
    { personId: 'per_new', from: '2026-08-01' },
  ],
};

function fixture(): Dataset {
  return {
    meta: { seed: 'network', generatedAt: '2026-09-04T00:00:00Z', now: '2026-09-04T00:00:00Z', synthetic: true },
    organisations: [],
    teams: [],
    users: [],
    addresses: [{ id: 'adr_1', synthetic: true, line1: '14 Vennel Brae', town: 'Ardvale', postcode: 'QA1 2BC' }],
    people: [
      person({ id: 'per_mum', givenName: 'Kayleigh', familyName: 'Docherty', householdId: 'hh_1' }),
      person({ id: 'per_kid', givenName: 'Lily', familyName: 'Docherty', lifeStage: 'child', householdId: 'hh_1' }),
      person({ id: 'per_ex', givenName: 'Craig', familyName: 'Beattie' }),
      person({ id: 'per_new', givenName: 'Ryan', familyName: 'Kerr', householdId: 'hh_1' }),
      person({ id: 'per_gran', givenName: 'Senga', familyName: 'Docherty' }),
    ],
    personMerges: [],
    households: [HOUSE],
    relationships: [
      { id: 'rel_1', synthetic: true, fromPersonId: 'per_mum', toPersonId: 'per_kid', type: 'mother-of' },
      { id: 'rel_2', synthetic: true, fromPersonId: 'per_mum', toPersonId: 'per_ex', type: 'ex-partner-of', from: '2016-04-11', to: '2026-03-14' },
      { id: 'rel_3', synthetic: true, fromPersonId: 'per_gran', toPersonId: 'per_mum', type: 'mother-of' },
    ],
    processes: [],
    events: [],
    analyses: [],
    meetings: [],
    actions: [],
    plans: [],
    riskAssessments: [],
    viewsRecords: [],
    lawfulBases: [],
    sharingRecords: [],
    informationRequests: [],
    connectorEvents: [],
    audit: [],
  } as unknown as Dataset;
}

describe('inverseOf', () => {
  it('reads a parent relationship from the child side', () => {
    expect(inverseOf('mother-of')).toBe('child-of');
    expect(inverseOf('father-of')).toBe('child-of');
    expect(inverseOf('child-of')).toBe('parent-of');
  });

  it('says nothing rather than guessing where the vocabulary has no inverse', () => {
    expect(inverseOf('attorney-for')).toBeNull();
    expect(inverseOf('guardian-for')).toBeNull();
    expect(inverseOf('carer-of')).toBeNull();
    expect(inverseOf('landlord-of')).toBeNull();
    expect(inverseOf('professional-for')).toBeNull();
    expect(inverseOf('step-parent-of')).toBeNull();
  });

  it('knows which types read the same in both directions', () => {
    expect(isSymmetric('partner-of')).toBe(true);
    expect(isSymmetric('sibling-of')).toBe(true);
    expect(isSymmetric('mother-of')).toBe(false);
    expect(isSymmetric('attorney-for')).toBe(false);
  });

  it('has an answer, one way or the other, for every type in the vocabulary', () => {
    for (const type of RELATIONSHIP_TYPES) {
      const inverse = inverseOf(type);
      expect(inverse === null || RELATIONSHIP_TYPES.includes(inverse)).toBe(true);
    }
  });
});

describe('covers and membersOn', () => {
  it('treats a period with no end as still running', () => {
    expect(covers('2020-01-01', undefined, '2026-09-04')).toBe(true);
  });

  it('excludes a period that has not started and one that has ended', () => {
    expect(covers('2027-01-01', undefined, '2026-09-04')).toBe(false);
    expect(covers('2020-01-01', '2026-03-14', '2026-09-04')).toBe(false);
  });

  it('includes the day a period ends, because a person lived there that day', () => {
    expect(covers('2020-01-01', '2026-09-04', '2026-09-04')).toBe(true);
  });

  it('answers who was in the household on a date rather than only who is now', () => {
    expect(membersOn(HOUSE, '2026-09-04').map((m) => m.personId)).toEqual(['per_mum', 'per_kid', 'per_new']);
    expect(membersOn(HOUSE, '2026-02-01').map((m) => m.personId)).toEqual(['per_mum', 'per_kid', 'per_ex']);
    expect(membersOn(HOUSE, '2022-01-01')).toEqual([]);
  });
});

describe('householdOn', () => {
  it('carries the address and the label, so the household can be named the way people name it', () => {
    const on = householdOn(fixture(), fixture().people[0]!, '2026-09-04');
    expect(on?.label).toBe('Docherty household');
    expect(on?.address?.line1).toBe('14 Vennel Brae');
  });

  it('is null for a person in no household', () => {
    expect(householdOn(fixture(), fixture().people[2]!, '2026-09-04')).toBeNull();
  });
});

describe('networkOn', () => {
  const data = fixture();

  it('separates the household from the wider network, which is the whole point', () => {
    const { household, network } = networkOn(data, 'per_mum', '2026-09-04');
    expect(household.map((t) => t.other.id)).toEqual(['per_kid']);
    expect(network.map((t) => t.other.id)).toEqual(['per_gran']);
  });

  it('treats a relationship ended today as ended, because a practitioner has just said so', () => {
    const data = fixture();
    data.relationships[0] = { ...data.relationships[0]!, to: '2026-09-04' };
    const { ended, household } = networkOn(data, 'per_mum', '2026-09-04');
    expect(ended.map((t) => t.other.id)).toContain('per_kid');
    expect(household.map((t) => t.other.id)).not.toContain('per_kid');
  });

  it('keeps an ended relationship and marks it, because the date it ended is often the point', () => {
    const { ended, household, network } = networkOn(data, 'per_mum', '2026-09-04');
    expect(ended.map((t) => t.other.id)).toEqual(['per_ex']);
    expect([...household, ...network].map((t) => t.other.id)).not.toContain('per_ex');
  });

  it('reads the relationship from the subject side, so the direction is not lost', () => {
    const { household, network } = networkOn(data, 'per_mum', '2026-09-04');
    expect(household[0]!.subjectIsFrom).toBe(true);
    expect(network[0]!.subjectIsFrom).toBe(false);
  });

  it('reads the same relationship from the other person record', () => {
    const { network } = networkOn(data, 'per_kid', '2026-09-04');
    // Lily has no household relationship of her own recorded with Kayleigh's side reversed, so the
    // tie appears from her side with subjectIsFrom false and the household flag still set.
    const { household } = networkOn(data, 'per_kid', '2026-09-04');
    expect(household.map((t) => t.other.id)).toEqual(['per_mum']);
    expect(household[0]!.subjectIsFrom).toBe(false);
    expect(network).toEqual([]);
  });

  it('was different in February, because the household was', () => {
    const { ended, household } = networkOn(data, 'per_mum', '2026-02-01');
    expect(ended).toEqual([]);
    expect(household.map((t) => t.other.id)).toEqual(['per_kid', 'per_ex']);
  });

  it('is empty for a person who does not exist', () => {
    expect(networkOn(data, 'per_nobody', '2026-09-04')).toEqual({ household: [], network: [], ended: [] });
  });
});

describe('householdOnlyMembers', () => {
  it('names the people in the household with no relationship recorded, so the gap is visible', () => {
    expect(householdOnlyMembers(fixture(), 'per_mum', '2026-09-04').map((p) => p.id)).toEqual(['per_new']);
  });

  it('does not name the subject themselves', () => {
    expect(householdOnlyMembers(fixture(), 'per_mum', '2026-09-04').map((p) => p.id)).not.toContain('per_mum');
  });
});

describe('withRelationship', () => {
  const next: Relationship = { id: 'rel_9', synthetic: true, fromPersonId: 'per_new', toPersonId: 'per_kid', type: 'lives-with' };

  it('adds one that is not there', () => {
    expect(withRelationship(fixture().relationships, next)).toHaveLength(4);
  });

  it('replaces one that is, rather than adding a second', () => {
    const edited = { ...fixture().relationships[0]!, to: '2026-09-04' };
    const out = withRelationship(fixture().relationships, edited);
    expect(out).toHaveLength(3);
    expect(out[0]!.to).toBe('2026-09-04');
  });

  it('leaves the original list alone', () => {
    const original = fixture().relationships;
    withRelationship(original, next);
    expect(original).toHaveLength(3);
  });
});

describe('subjectsOf', () => {
  it('gathers the people a MARAC is about, not only its subjectIds', () => {
    const marac = {
      id: 'prc_1',
      type: 'marac',
      status: 'open',
      subjectIds: ['per_mum'],
      detail: { referral: { victimPersonId: 'per_mum', perpetratorPersonId: 'per_ex', childPersonIds: ['per_kid'] } },
    } as unknown as Parameters<typeof subjectsOf>[0];
    expect(subjectsOf(marac).sort()).toEqual(['per_ex', 'per_kid', 'per_mum']);
  });
});
