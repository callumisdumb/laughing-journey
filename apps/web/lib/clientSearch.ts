/**
 * Search, which is where this design costs the most.
 *
 * A server that cannot read records cannot index them. That is not a detail to be worked around, it
 * is the direct consequence of the whole approach, and pretending otherwise would be the giveaway
 * that nobody thought it through.
 *
 * So search runs on the client. On sign-in the client decrypts the records it is entitled to, builds
 * an inverted index in memory, and searches locally. At the scale of one partnership's caseload that
 * is entirely tractable, and it has a property server-side search cannot have: the index contains
 * only what this user can already read, so a search can never surface the existence of something
 * they are not entitled to.
 *
 * For the one case where a server-side lookup genuinely is needed, a blind index: an HMAC of the
 * normalised value under a key only clients hold. Applied to reference numbers and to dates of birth
 * bucketed to the month, and never to names.
 *
 * **What the blind index leaks, stated plainly:** it reveals equality. An operator can tell that two
 * records share a value, and on a low-entropy field can mount a frequency attack. That is why dates
 * of birth are bucketed and names are excluded entirely. Nothing here claims to have solved
 * encrypted search: schemes with better properties exist, every one of them leaks something, and
 * naming the trade honestly is worth more than a scheme nobody on the buying side can evaluate.
 */
import { blindIndexTag, randomBytes, toBase64Url } from '@mas/crypto';
import type { Dataset, Person, Process, User } from '@mas/domain';
import { holdsKey, openProcess, type Vault } from './vault';

/** A posting list: token to the record ids that contain it. */
export type InvertedIndex = Map<string, Set<string>>;

export interface ClientIndex {
  /** Built from records this user can decrypt, and nothing else. */
  index: InvertedIndex;
  /** How many records were indexed, so the screen can say what the search covers. */
  recordCount: number;
  /** How many the user holds no key for, so the screen can say what it does not cover. */
  withheldCount: number;
}

function tokenise(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .split(' ')
    .filter((token) => token.length >= 2);
}

/**
 * Build the index from what this user can actually open.
 *
 * Records they hold no key for are counted but not indexed, and the count is shown: a search that
 * silently covered less than the user expected would be worse than one that says so, because a
 * practitioner would conclude the record does not exist rather than that they cannot see it.
 */
export function buildClientIndex(data: Dataset, vault: Vault, user: User): ClientIndex {
  const index: InvertedIndex = new Map();
  let recordCount = 0;
  let withheldCount = 0;

  const add = (token: string, id: string) => {
    const postings = index.get(token) ?? new Set<string>();
    postings.add(id);
    index.set(token, postings);
  };

  for (const process of data.processes) {
    if (!holdsKey(vault, process.id, user)) {
      withheldCount += 1;
      continue;
    }
    recordCount += 1;
    // The reference and the title come from the metadata; the detail has to be decrypted.
    for (const token of tokenise(`${process.reference} ${process.title}`)) add(token, process.id);
    try {
      for (const token of tokenise(JSON.stringify(openProcess(vault, process, user)))) add(token, process.id);
    } catch {
      // Counted as withheld rather than treated as an error: an unwrap that fails after holdsKey
      // said otherwise means the wrap list and the keys disagree, and the search should degrade
      // rather than break.
      recordCount -= 1;
      withheldCount += 1;
    }
  }

  return { index, recordCount, withheldCount };
}

/** Search the index. Every term must match, which is what a practitioner expects from a search box. */
export function searchIndex(built: ClientIndex, query: string, limit = 50): string[] {
  const terms = tokenise(query);
  if (terms.length === 0) return [];
  let matches: Set<string> | undefined;
  for (const term of terms) {
    // Prefix matching, so typing part of a reference finds it.
    const found = new Set<string>();
    for (const [token, postings] of built.index) {
      if (token.startsWith(term)) for (const id of postings) found.add(id);
    }
    matches = matches === undefined ? found : new Set([...matches].filter((id) => found.has(id)));
    if (matches.size === 0) break;
  }
  return [...(matches ?? new Set<string>())].slice(0, limit);
}

/* ------------------------------------------------------------- the blind index */

/**
 * The blind index key. Held only by clients: an operator who could compute tags could brute-force
 * a low-entropy field offline, which is the difference between "reveals equality" and "reveals the
 * value".
 */
let indexKey: Uint8Array | undefined;

export function blindIndexKey(): Uint8Array {
  indexKey ??= randomBytes(32);
  return indexKey;
}

/**
 * The fields a blind index is applied to, and only these.
 *
 * A reference number is high-entropy and an exact match is the whole query, so equality is all a
 * search of it ever needed. A date of birth is bucketed to the month first, which turns roughly
 * 36,000 possible values into about 1,200 and makes a frequency attack much less useful without
 * making the lookup useless. Names are excluded: they are low-entropy, heavily skewed, and equality
 * on a name is exactly what an operator should not be able to compute.
 */
export type BlindIndexField = 'reference' | 'date-of-birth-month';

export function blindTag(field: BlindIndexField, value: string): string {
  const normalised = field === 'date-of-birth-month' ? value.slice(0, 7) : value;
  return toBase64Url(blindIndexTag(`${field}:${normalised}`, blindIndexKey()));
}

/** The tags a server would hold for a person, which is the entirety of what it can match on. */
export function blindTagsFor(person: Person): string[] {
  return person.dateOfBirth ? [blindTag('date-of-birth-month', person.dateOfBirth)] : [];
}

export function blindTagsForProcess(process: Process): string[] {
  return [blindTag('reference', process.reference)];
}
