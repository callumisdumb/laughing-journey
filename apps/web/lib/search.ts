/**
 * Search over the records this reader can actually open.
 *
 * Two things make this different from a search box over a table. The first is scope: a practitioner
 * looking for "Docherty" is as likely to be after the core group meeting, the action they owe, or
 * the chronology entry from the police as they are after the person, so the index covers people,
 * practitioners, cases, chronology, meetings, actions and plans, and the results are grouped by
 * what they are rather than mixed into one ranked list where a meeting sits between two people.
 *
 * The second is the encryption claim. A case's content is encrypted to the principals the
 * need-to-know matrix entitles, so a client-side index can only contain what this client could
 * decrypt. `readableCaseIds` is therefore built by attempting the decryption rather than by reading
 * an access level, and everything hanging off a case the reader cannot open is left out of the
 * index entirely. It is not filtered out afterwards: filtering afterwards is what you write when
 * the plaintext was available all along, and it would be the wrong demonstration.
 *
 * What the reader is told instead is how many cases could not be searched. That is the honest
 * sentence, and it is the one a real client could write: it knows how many wrap lists it is not on,
 * and it knows nothing at all about what is inside them.
 */
import { formatDate, type Action, type ChronologyEvent, type Meeting, type Person, type Plan, type Process, type User } from '@mas/domain';
import { chronologyPath, meetingPath, personPath, practitionerPath, processPath } from './routes';

/** What the query matched on, so a result can say why it is a result. */
export type Matched = 'name' | 'preferredName' | 'alias' | 'chi' | 'dateOfBirth' | 'address' | 'reference' | 'title' | 'detail' | 'people' | 'owner' | 'location' | 'outcome' | 'role';

export type SearchKind = 'people' | 'cases' | 'chronology' | 'meetings' | 'actions' | 'plans' | 'practitioners';

/** The order the groups are shown in: who, then what case, then what happened, then what is owed. */
export const SEARCH_KINDS: readonly SearchKind[] = ['people', 'cases', 'chronology', 'meetings', 'actions', 'plans', 'practitioners'];

interface Base {
  id: string;
  score: number;
  matched: Matched;
}

export type SearchHit =
  | (Base & { kind: 'people'; person: Person })
  | (Base & { kind: 'practitioners'; user: User })
  | (Base & { kind: 'cases'; process: Process })
  | (Base & { kind: 'chronology'; event: ChronologyEvent })
  | (Base & { kind: 'meetings'; meeting: Meeting })
  | (Base & { kind: 'actions'; action: Action })
  | (Base & { kind: 'plans'; plan: Plan });

export interface SearchGroup {
  kind: SearchKind;
  /** The hits being shown, already capped. */
  hits: SearchHit[];
  /** How many matched in total, so a capped group can say what it is not showing. */
  total: number;
}

export interface SearchResults {
  query: string;
  groups: SearchGroup[];
  total: number;
  /** Cases whose content this reader holds no key for, so the index never saw them. */
  unsearchableCases: number;
}

function norm(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
}

function dobForms(dob: string | undefined): string[] {
  if (!dob) return [];
  const [y, m, d] = dob.split('-');
  return [dob, `${d}/${m}/${y}`, `${d}${m}${y}`, `${d}/${m}/${(y ?? '').slice(2)}`, formatDate(dob).toLowerCase()];
}

/** Every term present somewhere in the text. Two terms in either order find "Docherty Kayleigh". */
function hasAll(text: string, terms: string[]): boolean {
  return terms.length > 0 && terms.every((term) => text.includes(term));
}

export interface SearchInput {
  /** People and practitioners are always indexed; case-bound records only for these cases. */
  readableCaseIds: ReadonlySet<string>;
  /** Cases the reader holds no key for, counted rather than described. */
  unsearchableCases: number;
  people: Person[];
  users: User[];
  processes: Process[];
  events: ChronologyEvent[];
  meetings: Meeting[];
  actions: Action[];
  plans: Plan[];
  /** Address lines by person id, resolved by the caller so this module stays pure. */
  addressLines: ReadonlyMap<string, string[]>;
  /** Subject names by person id, so a case-bound record can be found by who it is about. */
  personNames: ReadonlyMap<string, string>;
}

/**
 * The whole search, grouped.
 *
 * A case is matched on its reference whether or not the reader can open it, because a reference is
 * not a name and refusing visibly is the product's rule: a reader who types a reference learns the
 * case exists and, if they hold no key, nothing else. A case is matched on its title only when the
 * reader can open it, because a title reads "MARAC referral, research and action planning for
 * Kayleigh Docherty (repeat referral)" and indexing that for everybody would put the victim's name
 * in the one place the whole model exists to keep it out of.
 */
export function searchAll(input: SearchInput, query: string, limitPerGroup = 8): SearchResults {
  const q = norm(query);
  if (q.length < 2) return { query, groups: [], total: 0, unsearchableCases: input.unsearchableCases };
  const terms = q.split(' ').filter(Boolean);
  const flat = q.replace(/\s/g, '');
  const hits: SearchHit[] = [];
  const readable = (processId: string | undefined): boolean => processId !== undefined && input.readableCaseIds.has(processId);

  for (const person of input.people) {
    const name = norm(`${person.givenName} ${person.familyName}`);
    const preferred = person.preferredName ? norm(person.preferredName) : '';
    const aliases = person.aliases.map(norm);
    const dob = dobForms(person.dateOfBirth).map(norm);
    const addresses = (input.addressLines.get(person.id) ?? []).map(norm);
    let score = 0;
    let matched: Matched = 'name';
    if (name === q) score = 100;
    else if (hasAll(name, terms)) {
      score = 80 + (name.startsWith(q) ? 10 : 0);
    } else if (person.chi && person.chi.includes(flat)) {
      score = 90;
      matched = 'chi';
    } else if (dob.some((d) => d === q || d === flat)) {
      score = 75;
      matched = 'dateOfBirth';
    } else if (preferred && preferred.includes(q)) {
      score = 70;
      matched = 'preferredName';
    } else if (aliases.some((alias) => alias.includes(q))) {
      score = 70;
      matched = 'alias';
    } else if (addresses.some((address) => hasAll(address, terms))) {
      score = 60;
      matched = 'address';
    }
    if (score > 0) hits.push({ kind: 'people', id: person.id, score, matched, person });
  }

  for (const user of input.users) {
    const name = norm(`${user.givenName} ${user.familyName}`);
    const job = norm(user.jobTitle);
    if (name === q) hits.push({ kind: 'practitioners', id: user.id, score: 95, matched: 'name', user });
    else if (hasAll(name, terms)) hits.push({ kind: 'practitioners', id: user.id, score: 78, matched: 'name', user });
    else if (hasAll(job, terms)) hits.push({ kind: 'practitioners', id: user.id, score: 55, matched: 'role', user });
  }

  for (const process of input.processes) {
    const reference = norm(process.reference);
    if (reference === q || reference.replace(/\s/g, '') === flat) {
      hits.push({ kind: 'cases', id: process.id, score: 96, matched: 'reference', process });
      continue;
    }
    if (reference.includes(q)) {
      hits.push({ kind: 'cases', id: process.id, score: 66, matched: 'reference', process });
      continue;
    }
    // Title and subject: only for a case whose content this reader could open.
    if (!input.readableCaseIds.has(process.id)) continue;
    const subjects = process.subjectIds.map((id) => norm(input.personNames.get(id) ?? '')).filter(Boolean);
    if (hasAll(norm(process.title), terms)) hits.push({ kind: 'cases', id: process.id, score: 72, matched: 'title', process });
    else if (subjects.some((subject) => hasAll(subject, terms))) hits.push({ kind: 'cases', id: process.id, score: 70, matched: 'people', process });
  }

  for (const event of input.events) {
    if (event.recordedInError) continue;
    // An event on no case at all is a single-agency record on the person, which its own record
    // governs; one on a case is indexed only where the case can be opened.
    if (event.linkedProcessIds.length > 0 && !event.linkedProcessIds.some((id) => input.readableCaseIds.has(id))) continue;
    const subjects = event.subjectIds.map((id) => norm(input.personNames.get(id) ?? '')).filter(Boolean);
    if (hasAll(norm(event.title), terms)) hits.push({ kind: 'chronology', id: event.id, score: 68, matched: 'title', event });
    else if (hasAll(norm(event.detail), terms)) hits.push({ kind: 'chronology', id: event.id, score: 52, matched: 'detail', event });
    else if (subjects.some((subject) => hasAll(subject, terms))) hits.push({ kind: 'chronology', id: event.id, score: 50, matched: 'people', event });
  }

  for (const meeting of input.meetings) {
    if (!readable(meeting.processId)) continue;
    if (hasAll(norm(meeting.title), terms)) hits.push({ kind: 'meetings', id: meeting.id, score: 64, matched: 'title', meeting });
    else if (hasAll(norm(meeting.location), terms)) hits.push({ kind: 'meetings', id: meeting.id, score: 46, matched: 'location', meeting });
  }

  for (const action of input.actions) {
    if (action.recordedInError) continue;
    if (!readable(action.processId)) continue;
    if (hasAll(norm(action.title), terms)) hits.push({ kind: 'actions', id: action.id, score: 62, matched: 'title', action });
    else if (hasAll(norm(action.ownerName), terms)) hits.push({ kind: 'actions', id: action.id, score: 48, matched: 'owner', action });
  }

  for (const plan of input.plans) {
    if (plan.recordedInError) continue;
    if (!readable(plan.processId)) continue;
    if (hasAll(norm(plan.title), terms)) hits.push({ kind: 'plans', id: plan.id, score: 60, matched: 'title', plan });
    else if (plan.outcomes.some((outcome) => hasAll(norm(outcome.text), terms))) hits.push({ kind: 'plans', id: plan.id, score: 44, matched: 'outcome', plan });
  }

  const groups: SearchGroup[] = [];
  for (const kind of SEARCH_KINDS) {
    const of = hits.filter((hit) => hit.kind === kind).sort((a, b) => b.score - a.score || a.id.localeCompare(b.id));
    if (of.length > 0) groups.push({ kind, hits: of.slice(0, limitPerGroup), total: of.length });
  }

  return { query, groups, total: hits.length, unsearchableCases: input.unsearchableCases };
}

/** Every hit in group order, which is what the typeahead's arrow keys walk. */
export function flatHits(results: SearchResults): SearchHit[] {
  return results.groups.flatMap((group) => group.hits);
}

/** Where a hit goes. The typeahead and the results screen must agree, so they share one answer. */
export function hitHref(hit: SearchHit): string {
  switch (hit.kind) {
    case 'people':
      return personPath(hit.person.id);
    case 'practitioners':
      return practitionerPath(hit.user.id);
    case 'cases':
      return processPath(hit.process.id);
    case 'chronology': {
      // A chronology entry is read on the person's chronology, which is where it means anything.
      const subjectId = hit.event.subjectIds[0];
      return subjectId ? chronologyPath(subjectId) : processPath(hit.event.linkedProcessIds[0] ?? '');
    }
    case 'meetings':
      return meetingPath(hit.meeting.id);
    case 'actions':
      return processPath(hit.action.processId);
    case 'plans':
      return processPath(hit.plan.processId);
  }
}

/** What a hit is called. Names for people, references for cases, titles for everything else. */
export function hitTitle(hit: SearchHit): string {
  switch (hit.kind) {
    case 'people':
      return `${hit.person.givenName} ${hit.person.familyName}`;
    case 'practitioners':
      return `${hit.user.givenName} ${hit.user.familyName}`;
    case 'cases':
      return hit.process.reference;
    case 'chronology':
      return hit.event.title;
    case 'meetings':
      return hit.meeting.title;
    case 'actions':
      return hit.action.title;
    case 'plans':
      return hit.plan.title;
  }
}
