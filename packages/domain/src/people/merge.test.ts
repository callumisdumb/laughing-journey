import { describe, expect, it } from 'vitest';
import type { Dataset } from '../schemas/dataset';
import type { Person, PersonMerge } from '../schemas/person';
import { mergePeople, mergeRefusals, resolvePersonId, standingMerges, unionPerson, unmergePeople } from './merge';

const WHO = { id: 'mrg_1', at: '2026-09-04T10:00:00+01:00', byUserId: 'usr_janet_kerr', byName: 'Janet Kerr', reason: 'Two records for the same child, confirmed with the health visitor.' };

function person(over: Partial<Person> & { id: string }): Person {
  return {
    synthetic: true,
    givenName: 'Aiden',
    familyName: 'Boyle',
    aliases: [],
    lifeStage: 'child',
    sex: 'male',
    addressHistory: [],
    communicationNeeds: { needs: [] },
    alerts: [],
    contact: {},
    createdAt: '2026-01-05T09:00:00Z',
    ...over,
  };
}

/**
 * A dataset shaped like the real one where a merge touches it, and empty everywhere else.
 *
 * The walk is generic over plain JSON, so what these tests need is the *shapes* a person id appears
 * in: a bare field, an array of ids, a field nested three deep inside a process detail, and the
 * audit ledger, which is never rewritten. Building a schema-valid process here would be forty lines
 * of statutory detail that prove nothing about the walk; the seed exercises that, in
 * `packages/mock-data/src/merge.test.ts`.
 */
function fixture(): Dataset {
  return {
    meta: { seed: 'merge', generatedAt: '2026-09-04T00:00:00Z', now: '2026-09-04T00:00:00Z', synthetic: true },
    organisations: [],
    teams: [],
    users: [],
    addresses: [],
    people: [person({ id: 'per_a', chi: undefined }), person({ id: 'per_b', givenName: 'Aidan', chi: '1403192341', gpPractice: 'Ardvale Medical Practice' })],
    personMerges: [],
    households: [{ id: 'hh_1', synthetic: true, addressId: 'adr_1', memberIds: ['per_a', 'per_b'] }],
    relationships: [{ id: 'rel_1', synthetic: true, fromPersonId: 'per_c', toPersonId: 'per_b', type: 'mother-of' }],
    processes: [{ id: 'prc_1', detail: { referral: { perpetratorPersonId: 'per_b', childPersonIds: ['per_b', 'per_d'] } }, subjectIds: ['per_b'] }],
    events: [{ id: 'evt_1', subjectIds: ['per_b'], linkedPersonIds: [] }],
    analyses: [],
    meetings: [{ id: 'mtg_1', subjectIds: ['per_b'] }],
    actions: [],
    plans: [],
    riskAssessments: [],
    viewsRecords: [],
    lawfulBases: [],
    sharingRecords: [],
    informationRequests: [],
    connectorEvents: [],
    audit: [{ id: 'aud_1', targetId: 'per_b', targetType: 'person' }],
  } as unknown as Dataset;
}

/** Every string in the dataset, so a repoint is checked exhaustively rather than field by field. */
function strings(node: unknown, out: string[] = []): string[] {
  if (typeof node === 'string') out.push(node);
  else if (Array.isArray(node)) for (const item of node) strings(item, out);
  else if (node && typeof node === 'object') for (const value of Object.values(node)) strings(value, out);
  return out;
}

describe('mergeRefusals', () => {
  it('refuses a record merged into itself', () => {
    expect(mergeRefusals(fixture(), 'per_a', 'per_a', WHO.reason)).toContain('mergeSameRecord');
  });

  it('refuses a reason that is not one', () => {
    expect(mergeRefusals(fixture(), 'per_a', 'per_b', 'dup')).toContain('mergeReasonRequired');
  });

  it('refuses a record that does not exist, naming which one', () => {
    expect(mergeRefusals(fixture(), 'per_a', 'per_nobody', WHO.reason)).toEqual(['mergeOtherMissing']);
    expect(mergeRefusals(fixture(), 'per_nobody', 'per_a', WHO.reason)).toEqual(['mergeSurvivorMissing']);
  });

  it('allows a real merge', () => {
    expect(mergeRefusals(fixture(), 'per_a', 'per_b', WHO.reason)).toEqual([]);
  });
});

describe('unionPerson', () => {
  const [a, b] = [fixture().people[0]!, fixture().people[1]!];

  it('keeps the survivor values and fills its gaps from the other record', () => {
    const union = unionPerson(a, b);
    expect(union.id).toBe('per_a');
    expect(union.givenName).toBe('Aiden');
    expect(union.chi).toBe('1403192341');
    expect(union.gpPractice).toBe('Ardvale Medical Practice');
  });

  it('keeps the other name as an alias, so an old reference still finds them', () => {
    expect(unionPerson(a, b).aliases).toContain('Aidan Boyle');
  });

  it('does not record the same name twice as an alias', () => {
    expect(unionPerson(a, { ...b, givenName: 'Aiden' }).aliases).toEqual([]);
  });

  it('unions the address history without duplicating a period both records hold', () => {
    const shared = { addressId: 'adr_1', from: '2020-01-01' };
    const union = unionPerson({ ...a, addressHistory: [shared] }, { ...b, addressHistory: [shared, { addressId: 'adr_2', from: '2018-06-01' }] });
    expect(union.addressHistory).toHaveLength(2);
    expect(union.addressHistory[0]!.from).toBe('2020-01-01');
  });
});

describe('mergePeople', () => {
  it('leaves one record where there were two', () => {
    const result = mergePeople(fixture(), { ...WHO, survivorId: 'per_a', mergedId: 'per_b' });
    expect(result.data.people.map((p) => p.id)).toEqual(['per_a']);
  });

  it('repoints every reference, wherever it was nested', () => {
    const data = fixture();
    expect(strings(data).filter((s) => s === 'per_b')).toHaveLength(9);
    const result = mergePeople(data, { ...WHO, survivorId: 'per_a', mergedId: 'per_b' });
    // Only the audit's own reference and the merge record's are left.
    expect(strings({ ...result.data, audit: [] }).filter((s) => s === 'per_b')).toEqual([]);
    expect(result.merge.repointed).toContain('processes.0.detail.referral.perpetratorPersonId');
    expect(result.merge.repointed).toContain('processes.0.detail.referral.childPersonIds.0');
    expect(result.merge.repointed).toContain('households.0.memberIds.1');
  });

  it('never touches the audit ledger, because it records what happened', () => {
    const data = fixture();
    const result = mergePeople(data, { ...WHO, survivorId: 'per_a', mergedId: 'per_b' });
    expect(result.data.audit).toBe(data.audit);
    expect(result.merge.repointed.some((path) => path.startsWith('audit.'))).toBe(false);
  });

  it('leaves records it did not touch referentially equal, so a merge is not a rewrite', () => {
    const data = fixture();
    const result = mergePeople(data, { ...WHO, survivorId: 'per_a', mergedId: 'per_b' });
    expect(result.data.events[0]).not.toBe(data.events[0]);
    expect(result.data.connectorEvents).toBe(data.connectorEvents);
  });

  it('keeps both records whole on the merge, so an unmerge restores rather than reconstructs', () => {
    const data = fixture();
    const result = mergePeople(data, { ...WHO, survivorId: 'per_a', mergedId: 'per_b' });
    expect(result.merge.mergedPerson).toEqual(data.people[1]);
    expect(result.merge.survivorBefore).toEqual(data.people[0]);
  });
});

describe('unmergePeople', () => {
  const UNDO = { at: '2026-09-05T09:00:00+01:00', reason: 'Wrong child.' };

  it('puts everything back exactly as it was', () => {
    const data = fixture();
    const { data: after, merge } = mergePeople(data, { ...WHO, survivorId: 'per_a', mergedId: 'per_b' });
    const back = unmergePeople({ ...after, personMerges: [merge] }, merge, UNDO);
    expect({ ...back, personMerges: [] }).toEqual({ ...data, personMerges: [] });
  });

  it('keeps the merge record and marks it undone, because the merge happened', () => {
    const data = fixture();
    const { data: after, merge } = mergePeople(data, { ...WHO, survivorId: 'per_a', mergedId: 'per_b' });
    const back = unmergePeople({ ...after, personMerges: [merge] }, merge, UNDO);
    expect(back.personMerges).toHaveLength(1);
    expect(back.personMerges[0]!.undoneAt).toBe(UNDO.at);
    expect(back.personMerges[0]!.undoneReason).toBe(UNDO.reason);
  });

  it('drops an undone merge from the standing list', () => {
    const data = fixture();
    const { data: after, merge } = mergePeople(data, { ...WHO, survivorId: 'per_a', mergedId: 'per_b' });
    const withRecord = { ...after, personMerges: [merge] };
    expect(standingMerges(withRecord)).toHaveLength(1);
    expect(standingMerges(withRecord, 'per_a')).toHaveLength(1);
    expect(standingMerges(withRecord, 'per_z')).toHaveLength(0);
    expect(standingMerges(unmergePeople(withRecord, merge, UNDO))).toHaveLength(0);
  });

  it('survives a merge, an unmerge and the same merge again', () => {
    const data = fixture();
    const first = mergePeople(data, { ...WHO, survivorId: 'per_a', mergedId: 'per_b' });
    const back = unmergePeople({ ...first.data, personMerges: [first.merge] }, first.merge, UNDO);
    const again = mergePeople(back, { ...WHO, id: 'mrg_2', survivorId: 'per_a', mergedId: 'per_b' });
    expect(again.merge.repointed).toEqual(first.merge.repointed);
    expect(again.data.people).toEqual(first.data.people);
  });
});

describe('the unmerge writes back only what the merge wrote', () => {
  it('leaves untouched collections referentially equal', () => {
    const data = fixture();
    const { data: after, merge } = mergePeople(data, { ...WHO, survivorId: 'per_a', mergedId: 'per_b' });
    const back = unmergePeople({ ...after, personMerges: [merge] }, merge, { at: '2026-09-05T09:00:00+01:00', reason: 'Wrong child.' });
    // Nothing in these named the merged record, so the unmerge must not have rebuilt them: the store
    // diffs a dataset change on object identity, and a clone would persist the whole product.
    expect(back.connectorEvents).toBe(data.connectorEvents);
    expect(back.sharingRecords).toBe(data.sharingRecords);
    expect(back.analyses).toBe(data.analyses);
  });

  it('leaves an untouched record inside a touched collection referentially equal', () => {
    const data = { ...fixture() };
    const untouched = { id: 'evt_2', subjectIds: ['per_z'], linkedPersonIds: [] } as unknown as (typeof data.events)[number];
    data.events = [...data.events, untouched];
    const { data: after, merge } = mergePeople(data, { ...WHO, survivorId: 'per_a', mergedId: 'per_b' });
    const back = unmergePeople({ ...after, personMerges: [merge] }, merge, { at: '2026-09-05T09:00:00+01:00', reason: 'Wrong child.' });
    expect(back.events.find((e) => e.id === 'evt_2')).toBe(untouched);
  });
});

describe('resolvePersonId', () => {
  const merged = (over: Partial<PersonMerge> = {}): PersonMerge => ({
    id: 'mrg_1',
    synthetic: true,
    survivorId: 'per_a',
    mergedId: 'per_b',
    mergedPerson: fixture().people[1]!,
    survivorBefore: fixture().people[0]!,
    repointed: [],
    at: WHO.at,
    byUserId: WHO.byUserId,
    byName: WHO.byName,
    reason: WHO.reason,
    ...over,
  });

  it('leaves an id nothing has merged alone', () => {
    expect(resolvePersonId(fixture(), 'per_a')).toBe('per_a');
    expect(resolvePersonId(fixture(), 'per_nobody')).toBe('per_nobody');
  });

  it('follows a merged-away id to the record that holds them now', () => {
    const data = { ...fixture(), personMerges: [merged()] };
    expect(resolvePersonId(data, 'per_b')).toBe('per_a');
  });

  it('follows a chain, because a survivor can itself be merged later', () => {
    const data = { ...fixture(), personMerges: [merged(), merged({ id: 'mrg_2', survivorId: 'per_c', mergedId: 'per_a' })] };
    expect(resolvePersonId(data, 'per_b')).toBe('per_c');
  });

  it('stops following an undone merge, because the record is its own again', () => {
    const data = { ...fixture(), personMerges: [merged({ undoneAt: '2026-09-05T09:00:00+01:00' })] };
    expect(resolvePersonId(data, 'per_b')).toBe('per_b');
  });
});
