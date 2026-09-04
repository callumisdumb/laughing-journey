import { DEFAULT_CONFIG, exclusionChanges, exclusionsRestingOn, liftedEntry, partyRegister, processesTouchedByHousehold, standingEntry, withPartyEntry, withRelationship, type Relationship } from '@mas/domain';
import { describe, expect, it } from 'vitest';
import { buildDataset } from './generator/build';
import { KAYLEIGH } from './scenarios/02-kayleigh-docherty';

/**
 * The consequence warnings, against the case they exist for.
 *
 * Recording that somebody is Ryan Kerr's brother excludes them from the Kayleigh Docherty MARAC
 * without anybody typing the word exclusion. Ending a relationship that is the basis of an exclusion
 * would silently un-exclude a former partner who is frequently the whole risk. Both have to be
 * visible at the moment of saving, so both are asserted here rather than left to the screen.
 */
const ON = '2026-09-04';

describe('exclusionChanges', () => {
  const data = buildDataset();

  it('warns that a new relationship to the perpetrator excludes somebody from the MARAC', () => {
    const brother = data.people.find((p) => p.id !== KAYLEIGH.ryan && !data.relationships.some((r) => r.fromPersonId === p.id || r.toPersonId === p.id))!;
    const next: Relationship = { id: 'rel_new', synthetic: true, fromPersonId: KAYLEIGH.ryan, toPersonId: brother.id, type: 'sibling-of' };

    const changes = exclusionChanges(data, DEFAULT_CONFIG, withRelationship(data.relationships, next));
    const added = changes.filter((c) => c.kind === 'added' && c.personId === brother.id);
    expect(added.length).toBeGreaterThan(0);
    expect(added[0]!.process.type).toBe('marac');
    expect(added[0]!.exclusion.party).toBe('perpetrator-associates');
  });

  /*
   * The seed writes Craig Kerr onto the MARAC's own register as well as recording the sibling
   * relationship, so his exclusion does not rest on the relationship record at all: removing it
   * changes nothing. That is the safe arrangement and worth keeping, so the derived-only case is
   * constructed here rather than hunted for in a seed that does not contain one.
   */
  function derivedOnly() {
    const seed = buildDataset();
    const processes = seed.processes.map((p) => (p.type === 'marac' ? { ...p, parties: p.parties.filter((party) => party.party !== 'perpetrator-associates') } : p));
    return { ...seed, processes };
  }

  const siblingOf = (d: ReturnType<typeof derivedOnly>) => d.relationships.find((r) => r.type === 'sibling-of' && (r.fromPersonId === KAYLEIGH.ryan || r.toPersonId === KAYLEIGH.ryan))!;

  it('says which exclusions rest on a relationship, so ending it can ask about them', () => {
    const derived = derivedOnly();
    const resting = exclusionsRestingOn(derived, DEFAULT_CONFIG, siblingOf(derived).id);
    expect(resting).toHaveLength(1);
    expect(resting[0]!.process.type).toBe('marac');
    expect(resting[0]!.exclusion.party).toBe('perpetrator-associates');
  });

  it('finds nothing resting on a relationship whose exclusion is written on the register', () => {
    expect(exclusionsRestingOn(data, DEFAULT_CONFIG, siblingOf(data).id)).toEqual([]);
  });

  it('does not lift an exclusion when the relationship is merely ended, because the risk does not end with it', () => {
    const derived = derivedOnly();
    const ended: Relationship = { ...siblingOf(derived), to: '2026-09-01' };
    const changes = exclusionChanges(derived, DEFAULT_CONFIG, withRelationship(derived.relationships, ended));
    expect(changes.filter((c) => c.kind === 'removed')).toEqual([]);
  });

  it('lifts one only on a recorded decision, with a name and a reason on it', () => {
    const derived = derivedOnly();
    const change = exclusionsRestingOn(derived, DEFAULT_CONFIG, siblingOf(derived).id)[0]!;

    const stands = standingEntry(change, ON, 'Karen Findlay', 'Relationship ended; the risk has not.');
    expect(stands.stands).toBe(true);
    const stillExcluded = partyRegister({ ...change.process, parties: withPartyEntry(change.process.parties, stands) }, derived.relationships);
    expect(stillExcluded.some((p) => p.personId === change.personId)).toBe(true);

    const lifted = liftedEntry(change, ON, 'Karen Findlay', 'MARAC agreed on 4 Sep 2026 that the exclusion no longer applies.');
    expect(lifted.stands).toBe(false);
    expect(lifted.decisionReason).toContain('MARAC agreed');
    const afterLift = partyRegister({ ...change.process, parties: withPartyEntry(change.process.parties, lifted) }, derived.relationships);
    expect(afterLift.some((p) => p.personId === change.personId)).toBe(false);
  });

  it('reports nothing when the relationships are unchanged', () => {
    expect(exclusionChanges(data, DEFAULT_CONFIG, data.relationships)).toEqual([]);
  });

  it('never reports the victim or her children as newly excluded', () => {
    const next: Relationship = { id: 'rel_new2', synthetic: true, fromPersonId: KAYLEIGH.ryan, toPersonId: KAYLEIGH.lily, type: 'associate-of' };
    const changes = exclusionChanges(data, DEFAULT_CONFIG, withRelationship(data.relationships, next));
    expect(changes.some((c) => c.personId === KAYLEIGH.lily)).toBe(false);
    expect(changes.some((c) => c.personId === KAYLEIGH.kayleigh)).toBe(false);
  });
});

describe('processesTouchedByHousehold', () => {
  const data = buildDataset();

  it('names the open processes anybody in the household is a subject of', () => {
    const person = data.people.find((p) => p.id === KAYLEIGH.kayleigh)!;
    const touched = processesTouchedByHousehold(data, person.householdId!, ON);
    expect(touched.length).toBeGreaterThan(0);
    expect(touched.map((p) => p.type)).toContain('marac');
    expect(touched.every((p) => p.status === 'open')).toBe(true);
  });

  it('counts a person being added, before they are in the household', () => {
    const person = data.people.find((p) => p.id === KAYLEIGH.kayleigh)!;
    const withRyan = processesTouchedByHousehold(data, person.householdId!, ON, [KAYLEIGH.ryan]);
    const without = processesTouchedByHousehold(data, person.householdId!, ON);
    expect(withRyan.length).toBeGreaterThanOrEqual(without.length);
  });
});
