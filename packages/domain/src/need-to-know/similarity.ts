/**
 * Near-match warnings on the case-role register.
 *
 * `isExcludedParty` matches a hand-recorded name exactly, case-insensitively, after trimming. That is
 * exact string matching on the mechanism that stops a MARAC perpetrator receiving information about
 * the case, and it fails silently towards inclusion: "Ryan Kerr" on the register does not match
 * "Ryan James Kerr", "R Kerr", "Kerr, Ryan" or a copy with a non-breaking space in it. The failure
 * direction is the one that gets somebody hurt.
 *
 * **This does not make the match fuzzy.** A fuzzy match that silently excludes the wrong person is
 * its own failure, and the register is deliberately explicit: it is a list somebody wrote down. What
 * this adds is a warning layer. A near match blocks the action behind a confirmation naming the
 * register entry it resembles, and the confirmation is audited whichever way the person answers, so
 * a wrong call is traceable rather than invisible.
 *
 * The check runs in both directions. Adding a recipient is checked against the register; adding a
 * register entry is checked against the people already on the distribution list, because an exclusion
 * often arrives after the sharing has started.
 */
import type { ExclusionParty, ProcessType, Stage } from '../enums';
import type { Exclusion } from '../schemas/config';
import type { Relationship } from '../schemas/person';
import type { CaseParty, Process } from '../schemas/process';
import { EXCLUSIONS } from './exclusions';
import { applicableExclusions, partyRegister } from './parties';

/**
 * Normalise a name for comparison. Deliberately more aggressive than `normalisePartyName`, which
 * feeds the exact match and must stay conservative: this one only decides whether to warn.
 *
 * Unicode spaces (a non-breaking space pasted from a document is invisible and defeats a trim),
 * punctuation, accents, and "Surname, Forename" order, which is how half of the public sector writes
 * a name and which no amount of trimming will fix.
 */
export function normaliseForComparison(name: string): string {
  const collapsed = name
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/\s+/gu, ' ')
    .trim()
    .toLocaleLowerCase('en-GB');
  // "Kerr, Ryan" is "Ryan Kerr" written the other way round, and only ever has one comma.
  const parts = collapsed.split(',');
  const ordered = parts.length === 2 && parts[1]!.trim() !== '' ? `${parts[1]!.trim()} ${parts[0]!.trim()}` : collapsed;
  return ordered.replace(/[^a-z0-9 ]/g, ' ').replace(/\s+/g, ' ').trim();
}

/** Levenshtein distance, two rows rather than a full matrix. Names are short; this is not hot. */
export function editDistance(a: string, b: string): number {
  if (a === b) return 0;
  if (a.length === 0) return b.length;
  if (b.length === 0) return a.length;
  let previous = Array.from({ length: b.length + 1 }, (_v, i) => i);
  for (let i = 1; i <= a.length; i += 1) {
    const current = [i];
    for (let j = 1; j <= b.length; j += 1) {
      const substitution = previous[j - 1]! + (a[i - 1] === b[j - 1] ? 0 : 1);
      current[j] = Math.min(previous[j]! + 1, current[j - 1]! + 1, substitution);
    }
    previous = current;
  }
  return previous[b.length]!;
}

/** Why two names resemble each other. Named so the confirmation can say what it spotted. */
export type SimilarityKind = 'same-after-normalising' | 'extra-names' | 'initials' | 'spelling';

export interface NameSimilarity {
  /** 0 to 1. 1 is identical after normalising. */
  score: number;
  kind: SimilarityKind;
}

/**
 * The threshold at which a name is close enough to warn about. Seeded to catch the four cases the
 * review named and to leave unrelated names alone. Configuration rather than a constant would be
 * better in a deployment; it is a constant here and the value is stated so it can be argued with.
 */
export const SIMILARITY_THRESHOLD = 0.82;

function tokensOf(name: string): string[] {
  return name.split(' ').filter((tok) => tok !== '');
}

/**
 * How alike two names are, or null when they are not alike at all.
 *
 * Four ways a name can be the same person written differently, in the order they are checked, because
 * the first that applies is the most specific explanation and the one worth showing a person.
 */
export function nameSimilarity(a: string, b: string): NameSimilarity | null {
  const left = normaliseForComparison(a);
  const right = normaliseForComparison(b);
  if (left === '' || right === '') return null;
  if (left === right) return { score: 1, kind: 'same-after-normalising' };

  const leftTokens = tokensOf(left);
  const rightTokens = tokensOf(right);
  const shorter = leftTokens.length <= rightTokens.length ? leftTokens : rightTokens;
  const longer = shorter === leftTokens ? rightTokens : leftTokens;

  // "Ryan Kerr" against "Ryan James Kerr": every name in the shorter version is in the longer one.
  if (shorter.length >= 2 && shorter.every((tok) => longer.includes(tok))) {
    return { score: 0.95, kind: 'extra-names' };
  }

  // "R Kerr" against "Ryan Kerr": same surname, and each initial matches the forename it stands for.
  if (shorter.length >= 2 && longer.length >= 2 && shorter[shorter.length - 1] === longer[longer.length - 1]) {
    const shortFore = shorter.slice(0, -1);
    const longFore = longer.slice(0, -1);
    const initialsMatch = shortFore.every((tok, i) => {
      const other = longFore[i];
      if (other === undefined) return false;
      if (tok === other) return true;
      return (tok.length === 1 && other.startsWith(tok)) || (other.length === 1 && tok.startsWith(other));
    });
    // At least one side has to actually be an initial, or two different forenames of the same length
    // would pass as each other. Checked across both sides because the comparison is symmetric.
    const anyInitial = [...shortFore, ...longFore].some((tok) => tok.length === 1);
    if (initialsMatch && anyInitial) return { score: 0.9, kind: 'initials' };
  }

  // A typo or a transliteration. Normalised edit distance over the longer of the two.
  const distance = editDistance(left, right);
  const score = 1 - distance / Math.max(left.length, right.length);
  return score >= SIMILARITY_THRESHOLD ? { score, kind: 'spelling' } : null;
}

export interface NearMatch {
  party: CaseParty;
  exclusion: Exclusion;
  similarity: NameSimilarity;
  /** The register entry's name as it was written down, for the confirmation to quote. */
  entryName: string;
}

/** The exclusion rules in force for a process type and stage, keyed by party. */
function exclusionsByParty(type: ProcessType, stage: Stage, exclusions: Exclusion[]): Map<ExclusionParty, Exclusion> {
  const byParty = new Map<ExclusionParty, Exclusion>();
  for (const rule of applicableExclusions(type, stage, exclusions)) if (!byParty.has(rule.party)) byParty.set(rule.party, rule);
  return byParty;
}

/**
 * Register entries whose name resembles the one being added, strongest first.
 *
 * Only hand-recorded name entries are compared. Entries that carry a person id or a user id are
 * already matched exactly by `isExcludedParty` and do not need a warning; warning on them as well
 * would train people to click through.
 */
export function nearMatchesOnRegister(
  process: Process,
  candidateName: string,
  options: { exclusions?: Exclusion[]; stage?: Stage; relationships?: Relationship[]; threshold?: number } = {},
): NearMatch[] {
  const { exclusions = EXCLUSIONS, stage = process.stage, relationships = [], threshold = SIMILARITY_THRESHOLD } = options;
  const byParty = exclusionsByParty(process.type, stage, exclusions);
  if (byParty.size === 0) return [];
  const matches: NearMatch[] = [];
  for (const party of partyRegister(process, relationships)) {
    if (party.name === undefined || party.name === '') continue;
    const exclusion = byParty.get(party.party);
    if (!exclusion) continue;
    const similarity = nameSimilarity(candidateName, party.name);
    if (!similarity || similarity.score < threshold) continue;
    matches.push({ party, exclusion, similarity, entryName: party.name });
  }
  return matches.sort((a, b) => b.similarity.score - a.similarity.score);
}

/**
 * The reverse check: people already on a list whose name resembles a register entry being added.
 *
 * An exclusion often arrives after the sharing has started, and nothing else in the product would
 * notice. Takes the names as they appear on the list, so it works for an invitee, a distribution
 * entry, a research target or a recipient without knowing which.
 */
export function nearMatchesOnList(entryName: string, listNames: readonly string[], threshold = SIMILARITY_THRESHOLD): { name: string; similarity: NameSimilarity }[] {
  const matches: { name: string; similarity: NameSimilarity }[] = [];
  for (const name of listNames) {
    const similarity = nameSimilarity(entryName, name);
    if (similarity && similarity.score >= threshold) matches.push({ name, similarity });
  }
  return matches.sort((a, b) => b.similarity.score - a.similarity.score);
}
