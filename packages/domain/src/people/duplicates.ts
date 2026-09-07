/**
 * Searching for someone before creating them.
 *
 * The single most damaging thing this product could do is make it easy to create a second record for
 * someone already in it. Two records for one child is precisely how information fails to join up,
 * and it is a named finding in review after review. A multi-agency system multiplies the harm,
 * because the two records end up held by different agencies who each believe they have the whole
 * picture.
 *
 * So this is not a convenience. It is the check the create path is built around, and it has to be
 * fuzzy in the ways real duplicates are actually created: a forename and a middle name swapped
 * between agencies, Mc and Mac, a hyphen somebody dropped, initials on one system and full names on
 * another, and dates of birth with two digits transposed or the day and month the wrong way round
 * because one system reads dates the American way.
 *
 * Every match says why it matched. A candidate list that offers no reason is a list a practitioner
 * cannot act on: "same date of birth and a similar surname" is a decision they can make, and
 * "possible match" is not.
 */
import type { Address, Person } from '../schemas/person';
import { nameSimilarity, normaliseForComparison, type NameSimilarity } from '../need-to-know/similarity';

/** Why a candidate came back, in the words the interface uses. */
export type MatchReason =
  | { kind: 'chi' }
  | { kind: 'name'; similarity: NameSimilarity }
  | { kind: 'name-transposed' }
  | { kind: 'alias'; alias: string }
  | { kind: 'dob-exact' }
  | { kind: 'dob-transposed' }
  | { kind: 'dob-day-month-swapped' }
  | { kind: 'dob-year' }
  | { kind: 'address'; current: boolean }
  | { kind: 'expected-delivery' };

export interface DuplicateQuery {
  givenName?: string;
  familyName?: string;
  /** Full or partial. A year alone is a legitimate search. */
  dateOfBirth?: string;
  chi?: string;
  /** Any part of an address: a line, a town or a postcode. */
  address?: string;
}

export interface DuplicateCandidate {
  person: Person;
  /** Highest first. Only used for ordering; the reasons are what a person reads. */
  score: number;
  reasons: MatchReason[];
}

/**
 * Names that are the same name written differently, beyond what `normaliseForComparison` catches.
 *
 * Mc and Mac are one family name spelled two ways and no edit-distance threshold that catches them
 * is tight enough to leave unrelated names alone. Hyphens are stripped to a space by the normaliser,
 * which turns "Smith-Jones" into two tokens and "Smithjones" into one, so the collapsed form is
 * compared as well as the spaced one.
 */
function nameVariants(name: string): string[] {
  const base = normaliseForComparison(name);
  const variants = new Set([base]);
  variants.add(base.replace(/\bmac(?=[a-z])/g, 'mc'));
  variants.add(base.replace(/\bmc(?=[a-z])/g, 'mac'));
  variants.add(base.replace(/ /g, ''));
  return [...variants].filter((v) => v !== '');
}

function namesMatch(a: string, b: string): NameSimilarity | null {
  for (const left of nameVariants(a)) {
    for (const right of nameVariants(b)) {
      if (left === right) return { score: 1, kind: 'same-after-normalising' };
    }
  }
  return nameSimilarity(a, b);
}

/** "Ryan James" recorded as "James Ryan": the same two names in the other order. */
function transposed(a: string, b: string): boolean {
  const left = normaliseForComparison(a).split(' ').filter(Boolean).sort();
  const right = normaliseForComparison(b).split(' ').filter(Boolean).sort();
  return left.length > 1 && left.length === right.length && left.every((tok, i) => tok === right[i]) && normaliseForComparison(a) !== normaliseForComparison(b);
}

/**
 * Dates of birth as opaque `YYYY-MM-DD` strings, compared lexically.
 *
 * Never through a `Date`: `new Date('2019-03-14')` is UTC midnight and `new Date(2019, 2, 14)` is
 * local midnight, and the difference moves a date across a day boundary exactly once a year in a way
 * that passes every test written in summer.
 */
function dobReasons(query: string, candidate: string | undefined): MatchReason[] {
  if (!candidate) return [];
  const q = query.trim();
  if (q === '') return [];
  if (q === candidate) return [{ kind: 'dob-exact' }];

  // A year on its own is a legitimate search: an age is often all anybody knows.
  if (/^\d{4}$/.test(q)) return q === candidate.slice(0, 4) ? [{ kind: 'dob-year' }] : [];
  if (!/^\d{4}-\d{2}-\d{2}$/.test(q)) return [];

  const [qy, qm, qd] = q.split('-') as [string, string, string];
  const [cy, cm, cd] = candidate.split('-') as [string, string, string];

  // Day and month the wrong way round, which is what happens when one system reads dates the
  // American way and somebody retypes what they see.
  if (qy === cy && qm === cd && qd === cm) return [{ kind: 'dob-day-month-swapped' }];

  // Two adjacent digits transposed, which is the commonest typing error in a date.
  const qDigits = q.replace(/-/g, '');
  const cDigits = candidate.replace(/-/g, '');
  for (let i = 0; i < qDigits.length - 1; i += 1) {
    const swapped = `${qDigits.slice(0, i)}${qDigits[i + 1]}${qDigits[i]}${qDigits.slice(i + 2)}`;
    if (swapped === cDigits) return [{ kind: 'dob-transposed' }];
  }
  return [];
}

function addressText(person: Person, addresses: readonly Address[]): { current: string; previous: string[] } {
  const byId = new Map(addresses.map((a) => [a.id, a]));
  const periods = [...person.addressHistory].sort((a, b) => (a.from < b.from ? 1 : -1));
  const text = (id: string): string => {
    const a = byId.get(id);
    return a ? normaliseForComparison(`${a.line1} ${a.line2 ?? ''} ${a.town} ${a.postcode}`) : '';
  };
  const current = periods[0] ? text(periods[0].addressId) : '';
  return { current, previous: periods.slice(1).map((p) => text(p.addressId)) };
}

/** How much each reason is worth when ordering. A CHI is decisive; a town in common is not. */
const WEIGHTS: Record<MatchReason['kind'], number> = {
  chi: 100,
  name: 40,
  'name-transposed': 35,
  alias: 35,
  'dob-exact': 40,
  'dob-transposed': 25,
  'dob-day-month-swapped': 25,
  'dob-year': 10,
  address: 20,
  'expected-delivery': 20,
};

/**
 * Everyone who might already be this person.
 *
 * Deliberately generous. A candidate list that is too long costs a practitioner ten seconds; a
 * candidate list that is too short costs a child a joined-up record. The interface shows enough to
 * disambiguate and the reasons make a long list quick to dismiss.
 */
export function findDuplicateCandidates(
  people: readonly Person[],
  addresses: readonly Address[],
  query: DuplicateQuery,
  options: { limit?: number; excludeId?: string } = {},
): DuplicateCandidate[] {
  const { limit = 20, excludeId } = options;
  const full = `${query.givenName ?? ''} ${query.familyName ?? ''}`.trim();
  const out: DuplicateCandidate[] = [];

  for (const person of people) {
    if (person.id === excludeId) continue;
    const reasons: MatchReason[] = [];

    // A CHI is the strongest thing anybody has, so it is checked first and on its own is enough.
    if (query.chi && person.chi && query.chi.replace(/\s/g, '') === person.chi) reasons.push({ kind: 'chi' });

    if (full !== '') {
      const personName = `${person.givenName} ${person.familyName}`;

      /*
       * Compared part against part, not only whole against whole.
       *
       * A surname on its own is the commonest search anybody does, and the first version compared
       * "Boyle" with "Aiden Boyle" and found nothing: one token against two fails the extra-names
       * rule, fails the initials rule, and scores 0.45 on edit distance. Three tests caught it at
       * once. So a query naming only one half is compared against that half, and a query naming both
       * is compared whole and part-wise, because "Marion Fraser" against "Marion Frazer" is a
       * surname typo and the whole-name distance dilutes it.
       */
      const similarity =
        (query.givenName && query.familyName ? namesMatch(full, personName) : null) ??
        (query.familyName && !query.givenName ? namesMatch(query.familyName, person.familyName) : null) ??
        (query.givenName && !query.familyName ? namesMatch(query.givenName, person.givenName) : null) ??
        (query.givenName && query.familyName && namesMatch(query.familyName, person.familyName) && namesMatch(query.givenName, person.givenName)
          ? namesMatch(query.familyName, person.familyName)
          : null);
      if (similarity) reasons.push({ kind: 'name', similarity });
      else if (transposed(full, personName)) reasons.push({ kind: 'name-transposed' });

      // Aliases and previous names are what this search exists for: a person recorded under a
      // married name on one system and a maiden name on another is the same person.
      for (const alias of person.aliases) {
        if (namesMatch(full, alias) ?? (query.familyName && !query.givenName ? namesMatch(query.familyName, alias.split(' ').slice(-1)[0] ?? alias) : null)) {
          reasons.push({ kind: 'alias', alias });
          break;
        }
      }
      if (person.preferredName && namesMatch(full, `${person.preferredName} ${person.familyName}`)) {
        reasons.push({ kind: 'alias', alias: person.preferredName });
      }
    }

    if (query.dateOfBirth) {
      reasons.push(...dobReasons(query.dateOfBirth, person.dateOfBirth));
      // An unborn baby has an expected delivery date rather than a date of birth, and a second
      // pre-birth record for the same pregnancy is exactly the duplicate this is trying to prevent.
      if (person.expectedDeliveryDate && dobReasons(query.dateOfBirth, person.expectedDeliveryDate).length > 0) {
        reasons.push({ kind: 'expected-delivery' });
      }
    }

    if (query.address && query.address.trim() !== '') {
      const needle = normaliseForComparison(query.address);
      const { current, previous } = addressText(person, addresses);
      if (needle !== '' && current.includes(needle)) reasons.push({ kind: 'address', current: true });
      else if (needle !== '' && previous.some((p) => p.includes(needle))) reasons.push({ kind: 'address', current: false });
    }

    if (reasons.length === 0) continue;
    // A town in common on its own is not a candidate: it would return half the caseload.
    if (reasons.length === 1 && reasons[0]!.kind === 'address') continue;
    const score = reasons.reduce((n, r) => n + WEIGHTS[r.kind], 0);
    out.push({ person, score, reasons });
  }

  return out.sort((a, b) => b.score - a.score || a.person.familyName.localeCompare(b.person.familyName)).slice(0, limit);
}
