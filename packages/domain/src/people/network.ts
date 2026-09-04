/**
 * Household and network, which are two different things.
 *
 * A household is people at an address, with dates. A network is everyone else who matters: family
 * elsewhere, a former partner, a carer, an attorney, a guardian, a friend, a professional. Marion
 * Fraser's nephew is network and not household, and that distinction is the whole point of her case;
 * Kayleigh Docherty's children are both. Collapsing them into one list loses the fact that decides
 * whether a person is in the room every evening or visits once a fortnight.
 *
 * Relationships are stored once and read from both ends. Storing A is B's parent and B is A's child
 * as two records is how the two drift apart, which is the failure the "automatic inverse" rule
 * exists to prevent, so this derives the other direction instead (D-129).
 */
import type { RelationshipType } from '../enums';
import { applicableExclusions, isExcludedParty, partyRegister } from '../need-to-know/parties';
import type { Config, Exclusion } from '../schemas/config';
import type { Dataset } from '../schemas/dataset';
import type { Address, Household, HouseholdMembership, Person, Relationship } from '../schemas/person';
import type { CaseParty, Process } from '../schemas/process';

/**
 * The type that says the same fact from the other person's side, where one exists.
 *
 * `null` means the vocabulary has no clean inverse, and the product says so rather than guessing:
 * the reverse of "attorney for" is not a relationship type this product holds, it is a description.
 * Note that the parent types are deliberately many-to-one. The inverse of "mother of" is "child of",
 * and the inverse of that is "parent of" rather than "mother of", because the child's side does not
 * record which parent it was. That is a reason to store one record and derive the other direction,
 * not a reason to store both and let them disagree.
 */
const INVERSE: Partial<Record<RelationshipType, RelationshipType>> = {
  'mother-of': 'child-of',
  'father-of': 'child-of',
  'parent-of': 'child-of',
  'child-of': 'parent-of',
  'unborn-child-of': 'parent-of',
  'partner-of': 'partner-of',
  'ex-partner-of': 'ex-partner-of',
  'sibling-of': 'sibling-of',
  'grandparent-of': 'grandchild-of',
  'grandchild-of': 'grandparent-of',
  'aunt-or-uncle-of': 'nephew-or-niece-of',
  'nephew-or-niece-of': 'aunt-or-uncle-of',
  'relative-of': 'relative-of',
  'lives-with': 'lives-with',
  'associate-of': 'associate-of',
};

export function inverseOf(type: RelationshipType): RelationshipType | null {
  return INVERSE[type] ?? null;
}

/** True where the type reads the same in both directions, so the wording needs no flip. */
export function isSymmetric(type: RelationshipType): boolean {
  return INVERSE[type] === type;
}

/** A relationship as read from one person's record: who the other person is, and how. */
export interface NetworkTie {
  relationship: Relationship;
  other: Person;
  /** True where the subject is the `from` side, so the wording is read from the other person's side. */
  subjectIsFrom: boolean;
  /** In the household as at the date asked about. */
  household: boolean;
  /** Ended on or before the date asked about. */
  ended: boolean;
}

/** True where a dated period covers the date, comparing ISO strings rather than Date objects. */
export function covers(from: string | undefined, to: string | undefined, on: string): boolean {
  if (from && from > on) return false;
  if (to && to < on) return false;
  return true;
}

/** Who was in a household on a date, which is the only version of that question worth asking. */
export function membersOn(household: Household, on: string): HouseholdMembership[] {
  return household.members.filter((m) => covers(m.from, m.to, on));
}

/** The household a person belongs to on a date, with its members and its address. */
export function householdOn(data: Dataset, person: Person, on: string): { household: Household; label?: string; address?: Address; members: HouseholdMembership[] } | null {
  const household = data.households.find((h) => h.id === person.householdId);
  if (!household) return null;
  return { household, label: household.label, address: data.addresses.find((a) => a.id === household.addressId), members: membersOn(household, on) };
}

/**
 * Everyone around a person on a date, split into the household and the wider network.
 *
 * Ended relationships are kept and marked rather than dropped. A former partner is a former partner
 * from a date, and that date is often the most important fact in the record.
 */
export function networkOn(data: Dataset, personId: string, on: string): { household: NetworkTie[]; network: NetworkTie[]; ended: NetworkTie[] } {
  const person = data.people.find((p) => p.id === personId);
  if (!person) return { household: [], network: [], ended: [] };
  const members = new Set((householdOn(data, person, on)?.members ?? []).map((m) => m.personId));

  const ties: NetworkTie[] = [];
  for (const relationship of data.relationships) {
    const subjectIsFrom = relationship.fromPersonId === personId;
    if (!subjectIsFrom && relationship.toPersonId !== personId) continue;
    const otherId = subjectIsFrom ? relationship.toPersonId : relationship.fromPersonId;
    const other = data.people.find((p) => p.id === otherId);
    if (!other) continue;
    /*
     * Ended means the relationship has an end date that has arrived, not that the period does not
     * cover the day. A relationship ended today is over: a practitioner who has just recorded that
     * it ended should not still see it in the live list, and `covers` keeps its own meaning for the
     * questions that are genuinely about a day.
     */
    const ended = relationship.to !== undefined && relationship.to <= on;
    ties.push({ relationship, other, subjectIsFrom, household: members.has(otherId), ended });
  }

  return {
    household: ties.filter((tie) => !tie.ended && tie.household),
    network: ties.filter((tie) => !tie.ended && !tie.household),
    ended: ties.filter((tie) => tie.ended),
  };
}

/** Household members who have no relationship record with the subject, so the household is complete. */
export function householdOnlyMembers(data: Dataset, personId: string, on: string): Person[] {
  const person = data.people.find((p) => p.id === personId);
  if (!person) return [];
  const members = (householdOn(data, person, on)?.members ?? []).map((m) => m.personId);
  const related = new Set(networkOn(data, personId, on).household.map((tie) => tie.other.id));
  return members
    .filter((id) => id !== personId && !related.has(id))
    .map((id) => data.people.find((p) => p.id === id))
    .filter((p): p is Person => p !== undefined);
}

/**
 * What a change to the relationship records does to the exclusion registers, before it is saved.
 *
 * The parties register derives a MARAC perpetrator's family and associates from relationship
 * records, so recording that somebody is Ryan Kerr's brother excludes them from that MARAC without
 * anybody typing the word exclusion. That has to be visible at the moment of saving rather than
 * discovered later, and never silent.
 *
 * The reverse is more dangerous. Ending a relationship that is the basis of an exclusion would
 * silently un-exclude a former partner who is frequently the whole risk, so a removal is reported
 * with the same weight and the screen makes the decision explicit (D-131).
 */
export interface ExclusionChange {
  process: Process;
  personId: string;
  party: CaseParty;
  exclusion: Exclusion;
  kind: 'added' | 'removed';
}

function excludedPartiesFor(process: Process, relationships: Relationship[], exclusions: Exclusion[]): Map<string, { party: CaseParty; exclusion: Exclusion }> {
  const out = new Map<string, { party: CaseParty; exclusion: Exclusion }>();
  const rules = applicableExclusions(process.type, process.stage, exclusions);
  if (rules.length === 0) return out;
  for (const party of partyRegister(process, relationships)) {
    if (!party.personId) continue;
    const hit = isExcludedParty(process, { personId: party.personId }, exclusions, process.stage, relationships);
    if (hit) out.set(party.personId, { party: hit.party, exclusion: hit.exclusion });
  }
  return out;
}

export function exclusionChanges(data: Dataset, config: Config, next: Relationship[]): ExclusionChange[] {
  const changes: ExclusionChange[] = [];
  for (const process of data.processes) {
    if (process.status !== 'open') continue;
    const before = excludedPartiesFor(process, data.relationships, config.exclusions);
    const after = excludedPartiesFor(process, next, config.exclusions);
    for (const [personId, hit] of after) if (!before.has(personId)) changes.push({ process, personId, party: hit.party, exclusion: hit.exclusion, kind: 'added' });
    for (const [personId, hit] of before) if (!after.has(personId)) changes.push({ process, personId, party: hit.party, exclusion: hit.exclusion, kind: 'removed' });
  }
  return changes;
}

/**
 * The exclusions that rest on one relationship record, which is what ending it has to ask about.
 *
 * Ending a relationship does not lift the exclusion by itself, and that is deliberate: the register
 * reads the relationship record, not its dates, so a former partner stays excluded when the
 * relationship ends. What the product must not do is let that pass silently in either direction, so
 * this names what the ending touches and the screen makes the decision explicit, defaulting to the
 * exclusion standing (D-132).
 */
export function exclusionsRestingOn(data: Dataset, config: Config, relationshipId: string): ExclusionChange[] {
  const without = data.relationships.filter((r) => r.id !== relationshipId);
  return exclusionChanges(data, config, without).filter((change) => change.kind === 'removed');
}

/**
 * An explicit register entry that keeps an exclusion standing on its own, no longer resting on the
 * relationship record. Written when a practitioner ends the relationship and confirms it stands.
 */
export function standingEntry(change: ExclusionChange, on: string, byName: string, reason: string): CaseParty {
  return { ...change.party, source: 'manual', since: change.party.since ?? on, stands: true, decidedAt: `${on}T00:00:00Z`, decidedByName: byName, decisionReason: reason };
}

/** The same entry recording a decision that the exclusion has been lifted, which suppresses it. */
export function liftedEntry(change: ExclusionChange, on: string, byName: string, reason: string): CaseParty {
  return { ...change.party, source: 'manual', since: change.party.since ?? on, stands: false, decidedAt: `${on}T00:00:00Z`, decidedByName: byName, decisionReason: reason };
}

/** The process's register with an entry replaced or added, matched on the person and the party role. */
export function withPartyEntry(parties: CaseParty[], entry: CaseParty): CaseParty[] {
  const same = (a: CaseParty, b: CaseParty) => a.party === b.party && a.personId === b.personId && a.userId === b.userId && a.name === b.name;
  const i = parties.findIndex((p) => same(p, entry));
  if (i < 0) return [...parties, entry];
  const out = [...parties];
  out[i] = entry;
  return out;
}

/** The relationship list with one record replaced, added or ended, for asking "what would this do". */
export function withRelationship(relationships: Relationship[], next: Relationship): Relationship[] {
  const i = relationships.findIndex((r) => r.id === next.id);
  if (i < 0) return [...relationships, next];
  const out = [...relationships];
  out[i] = next;
  return out;
}

/**
 * The open processes a household change touches, which is what the core group needs to hear about.
 *
 * A new adult in a household where a child is on the register is a fact the conference wants; a
 * person leaving a MAPPA subject's household changes the Environmental Risk Assessment. So the
 * question is not "what processes is the person joining on", it is "what open processes does anybody
 * in this household have", and the answer is offered at the point of the change rather than left to
 * whoever remembers.
 */
export function processesTouchedByHousehold(data: Dataset, householdId: string, on: string, alsoPersonIds: string[] = []): Process[] {
  const household = data.households.find((h) => h.id === householdId);
  const ids = new Set([...(household ? membersOn(household, on).map((m) => m.personId) : []), ...alsoPersonIds]);
  return data.processes.filter((p) => p.status === 'open' && subjectsOf(p).some((id) => ids.has(id)));
}

/** Every person id a process is about, across the shapes the different process types use. */
export function subjectsOf(process: Process): string[] {
  const ids = [...process.subjectIds];
  if (process.type === 'marac') {
    ids.push(process.detail.referral.victimPersonId, process.detail.referral.perpetratorPersonId, ...process.detail.referral.childPersonIds);
  }
  if (process.type === 'cp' && process.detail.preBirth?.motherPersonId) ids.push(process.detail.preBirth.motherPersonId);
  if (process.type === 'mappa') ids.push(...process.detail.victimPersonIds);
  return [...new Set(ids)];
}
