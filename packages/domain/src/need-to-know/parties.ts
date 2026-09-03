import type { ExclusionParty, ProcessType, RelationshipType, Stage } from '../enums';
import type { Exclusion } from '../schemas/config';
import type { Relationship } from '../schemas/person';
import type { CaseParty, Process } from '../schemas/process';
import { EXCLUSIONS } from './exclusions';

/**
 * Case-role register.
 *
 * Hard exclusions name a party (perpetrator, victim, employer and so on), never a person. This module
 * answers "who holds that party role on this process" by combining the explicit register on the
 * process (`process.parties`, recorded from the referral or by hand) with entries derived from case
 * roles: the MARAC referral's perpetrator and the people related to them, and the MAPPA victims.
 */

type AssociateRelationship = Extract<
  RelationshipType,
  | 'partner-of'
  | 'ex-partner-of'
  | 'sibling-of'
  | 'parent-of'
  | 'mother-of'
  | 'father-of'
  | 'child-of'
  | 'grandparent-of'
  | 'grandchild-of'
  | 'aunt-or-uncle-of'
  | 'nephew-or-niece-of'
  | 'relative-of'
  | 'lives-with'
  | 'associate-of'
>;

/**
 * How the other person in a relationship is described from the perpetrator's side.
 * First entry: the other person is the `from` side (other -> perpetrator). Second: the `to` side.
 */
const ASSOCIATE_DESCRIPTIONS: Record<AssociateRelationship, readonly [string, string]> = {
  'partner-of': ['partner', 'partner'],
  'ex-partner-of': ['former partner', 'former partner'],
  'sibling-of': ['sibling', 'sibling'],
  'parent-of': ['parent', 'child'],
  'mother-of': ['mother', 'child'],
  'father-of': ['father', 'child'],
  'child-of': ['child', 'parent'],
  'grandparent-of': ['grandparent', 'grandchild'],
  'grandchild-of': ['grandchild', 'grandparent'],
  'aunt-or-uncle-of': ['aunt or uncle', 'nephew or niece'],
  'nephew-or-niece-of': ['nephew or niece', 'aunt or uncle'],
  'relative-of': ['relative', 'relative'],
  'lives-with': ['household member', 'household member'],
  'associate-of': ['associate', 'associate'],
};

/** Relationship types that make someone the perpetrator's family or an associate, in either direction. */
export const ASSOCIATE_RELATIONSHIPS: readonly RelationshipType[] = Object.keys(ASSOCIATE_DESCRIPTIONS) as AssociateRelationship[];

function isAssociateRelationship(type: RelationshipType): type is AssociateRelationship {
  return ASSOCIATE_RELATIONSHIPS.includes(type);
}

/** Relationship types read from the parent's side (parent -> child). */
const PARENT_SIDE: readonly RelationshipType[] = ['parent-of', 'mother-of', 'father-of'];
/** Relationship types read from the child's side (child -> parent). */
const CHILD_SIDE: readonly RelationshipType[] = ['child-of', 'unborn-child-of'];

/** People recorded as a person's children, born or unborn. */
function childrenOf(personId: string, relationships: Relationship[]): string[] {
  const ids: string[] = [];
  for (const r of relationships) {
    if (r.fromPersonId === personId && PARENT_SIDE.includes(r.type)) ids.push(r.toPersonId);
    if (r.toPersonId === personId && CHILD_SIDE.includes(r.type)) ids.push(r.fromPersonId);
  }
  return ids;
}

/** The exclusions that apply to a process type at a stage ('*' rows apply at every stage). */
export function applicableExclusions(type: ProcessType, stage: Stage, exclusions: Exclusion[] = EXCLUSIONS): Exclusion[] {
  return exclusions.filter((e) => e.process === type && (e.stage === '*' || e.stage === stage));
}

function maracParties(process: Extract<Process, { type: 'marac' }>, relationships: Relationship[]): CaseParty[] {
  const { victimPersonId, perpetratorPersonId, childPersonIds, receivedAt } = process.detail.referral;
  const since = receivedAt.slice(0, 10);
  const parties: CaseParty[] = [
    {
      personId: perpetratorPersonId,
      party: 'perpetrator',
      label: 'Perpetrator (named in the referral)',
      since,
      source: 'referral',
      reason: 'Named as the perpetrator in the MARAC referral',
    },
  ];
  // The victim and her children are never excluded, whatever their relationship to the perpetrator.
  const protectedIds = new Set<string>([victimPersonId, ...childPersonIds, ...childrenOf(victimPersonId, relationships)]);
  for (const r of relationships) {
    if (!isAssociateRelationship(r.type)) continue;
    let other: string | undefined;
    let side: 0 | 1 | undefined;
    if (r.fromPersonId === perpetratorPersonId) {
      other = r.toPersonId;
      side = 1;
    } else if (r.toPersonId === perpetratorPersonId) {
      other = r.fromPersonId;
      side = 0;
    }
    if (other === undefined || side === undefined || other === perpetratorPersonId) continue;
    if (protectedIds.has(other) || parties.some((p) => p.personId === other)) continue;
    const description = ASSOCIATE_DESCRIPTIONS[r.type][side];
    parties.push({
      personId: other,
      party: 'perpetrator-associates',
      label: `Perpetrator's ${description} (relationship record)`,
      since,
      source: 'relationship',
      reason: `Recorded as the perpetrator's ${description}; would increase risk to the victim`,
    });
  }
  return parties;
}

function mappaParties(process: Extract<Process, { type: 'mappa' }>): CaseParty[] {
  const since = process.detail.notification.at.slice(0, 10);
  return process.detail.victimPersonIds.map((personId) => ({
    personId,
    party: 'victim',
    label: 'Victim (recorded on the MAPPA case)',
    since,
    source: 'referral',
    reason: 'MAPPA information is not given to victims; the Victim Notification Scheme is the route',
  }));
}

/**
 * Party entries derived from case roles rather than recorded by hand.
 *
 * MARAC: the referral's perpetrator, plus everyone related to them as partner, former partner,
 * sibling, parent, child, grandparent, grandchild, aunt or uncle, nephew or niece, relative,
 * household member or associate. The victim and her children are never derived as associates.
 * MAPPA: the victims recorded on the case. ASP records no alleged perpetrator on the process, and
 * CP parents-if-risk is an IRD decision, so both are recorded by hand when they apply.
 */
export function partiesFromRoles(process: Process, relationships: Relationship[] = []): CaseParty[] {
  switch (process.type) {
    case 'marac':
      return maracParties(process, relationships);
    case 'mappa':
      return mappaParties(process);
    case 'asp':
    case 'cp':
    case 'awi':
      return [];
  }
}

/** Names on hand-recorded entries match case-insensitively, after trimming and collapsing spaces. */
export function normalisePartyName(name: string): string {
  return name.trim().replace(/\s+/g, ' ').toLocaleLowerCase('en-GB');
}

function partyKey(p: CaseParty): string {
  return `${p.personId ?? ''}|${p.userId ?? ''}|${p.name ? normalisePartyName(p.name) : ''}|${p.party}`;
}

/** The explicit register on the process merged with the derived entries. Explicit entries win. */
export function partyRegister(process: Process, relationships: Relationship[] = []): CaseParty[] {
  const merged: CaseParty[] = [...process.parties];
  const seen = new Set(merged.map(partyKey));
  for (const derived of partiesFromRoles(process, relationships)) {
    const key = partyKey(derived);
    if (seen.has(key)) continue;
    seen.add(key);
    merged.push(derived);
  }
  return merged;
}

export interface PartyCandidate {
  personId?: string;
  userId?: string;
  /** A typed name, for someone with neither a record nor an account; matched against hand-recorded name entries. */
  name?: string;
}

export interface ExcludedPartyMatch {
  exclusion: Exclusion;
  party: CaseParty;
}

/**
 * Whether a person, a user or someone known only by name must not receive information about a
 * process: they hold a party role in the register that an exclusion names for this process type and
 * stage. Ids match exactly; a name matches hand-recorded name entries case-insensitively after
 * trimming. Returns the exclusion and the register entry, or null. Hard exclusions cannot be lifted here.
 */
export function isExcludedParty(
  process: Process,
  candidate: PartyCandidate,
  exclusions: Exclusion[] = EXCLUSIONS,
  stage: Stage = process.stage,
  relationships: Relationship[] = [],
): ExcludedPartyMatch | null {
  const name = candidate.name ? normalisePartyName(candidate.name) : '';
  if (!candidate.personId && !candidate.userId && !name) return null;
  const rules = applicableExclusions(process.type, stage, exclusions);
  if (rules.length === 0) return null;
  const byParty = new Map<ExclusionParty, Exclusion>();
  for (const rule of rules) if (!byParty.has(rule.party)) byParty.set(rule.party, rule);
  for (const party of partyRegister(process, relationships)) {
    const hit =
      (candidate.personId !== undefined && party.personId === candidate.personId) ||
      (candidate.userId !== undefined && party.userId === candidate.userId) ||
      (name !== '' && party.name !== undefined && normalisePartyName(party.name) === name);
    if (!hit) continue;
    const exclusion = byParty.get(party.party);
    if (exclusion) return { exclusion, party };
  }
  return null;
}
