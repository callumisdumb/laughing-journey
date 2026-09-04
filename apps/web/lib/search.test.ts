/**
 * Search, and the one property that matters more than finding things.
 *
 * A search box is the fastest way to undo a need-to-know model. It reaches every record at once,
 * it is the first thing anybody tries, and a leak here does not look like a leak: it looks like a
 * result. So the tests that matter are the ones that assert what search does not return.
 */
import { DEFAULT_CONFIG, accessFor, type Person, type Process } from '@mas/domain';
import { buildDataset } from '@mas/mock-data';
import { describe, expect, it } from 'vitest';
import { hitHref, hitTitle, searchAll, type SearchInput } from './search';

const data = buildDataset();

function readableFor(userId: string): Set<string> {
  const user = data.users.find((u) => u.id === userId);
  if (!user) throw new Error(`no such user ${userId}`);
  const ids = new Set<string>();
  for (const process of data.processes) {
    const access = accessFor(user, process, { rows: DEFAULT_CONFIG.needToKnow, exclusions: DEFAULT_CONFIG.exclusions });
    if (access.level === 'full' || access.level === 'summary' || access.level === 'fields') ids.add(process.id);
  }
  return ids;
}

function inputFor(readableCaseIds: Set<string>): SearchInput {
  const addressLines = new Map<string, string[]>();
  const personNames = new Map<string, string>();
  for (const person of data.people) {
    addressLines.set(
      person.id,
      person.addressHistory
        .map((entry) => data.addresses.find((address) => address.id === entry.addressId))
        .filter((address) => address !== undefined)
        .map((address) => `${address.line1} ${address.town} ${address.postcode}`),
    );
    personNames.set(person.id, `${person.givenName} ${person.familyName}`);
  }
  return {
    readableCaseIds,
    unsearchableCases: data.processes.length - readableCaseIds.size,
    people: data.people,
    users: data.users,
    processes: data.processes,
    events: data.events,
    meetings: data.meetings,
    actions: data.actions,
    plans: data.plans,
    addressLines,
    personNames,
  };
}

const everything = inputFor(new Set(data.processes.map((p) => p.id)));

function person(name: string): Person {
  const [given, family] = name.split(' ');
  const found = data.people.find((p) => p.givenName === given && p.familyName === family);
  if (!found) throw new Error(`no such person ${name}`);
  return found;
}

function process(reference: string): Process {
  const found = data.processes.find((p) => p.reference === reference);
  if (!found) throw new Error(`no such process ${reference}`);
  return found;
}

describe('what it finds', () => {
  it('finds a person by name, either way round', () => {
    const kayleigh = person('Kayleigh Docherty');
    for (const query of ['Kayleigh Docherty', 'docherty kayleigh', 'Docherty']) {
      const ids = searchAll(everything, query, 20).groups.flatMap((g) => g.hits.filter((h) => h.kind === 'people').map((h) => h.id));
      expect(ids, query).toContain(kayleigh.id);
    }
  });

  it('finds a person by date of birth in the form somebody would type it', () => {
    const kayleigh = person('Kayleigh Docherty');
    expect(kayleigh.dateOfBirth).toBeDefined();
    const [y, m, d] = (kayleigh.dateOfBirth ?? '').split('-');
    const hits = searchAll(everything, `${d}/${m}/${y}`, 20).groups.flatMap((g) => g.hits);
    expect(hits.some((h) => h.kind === 'people' && h.id === kayleigh.id && h.matched === 'dateOfBirth')).toBe(true);
  });

  it('finds a case by its reference', () => {
    const marac = process('MARAC-2026-0093');
    const hits = searchAll(everything, 'MARAC-2026-0093', 20).groups.flatMap((g) => g.hits);
    expect(hits.some((h) => h.kind === 'cases' && h.id === marac.id && h.matched === 'reference')).toBe(true);
  });

  it('groups by type rather than ranking everything into one list', () => {
    const results = searchAll(everything, 'docherty', 20);
    const kinds = results.groups.map((g) => g.kind);
    // The order is fixed: people first, and never a meeting between two people.
    expect(kinds).toEqual([...kinds].sort((a, b) => ['people', 'cases', 'chronology', 'meetings', 'actions', 'plans', 'practitioners'].indexOf(a) - ['people', 'cases', 'chronology', 'meetings', 'actions', 'plans', 'practitioners'].indexOf(b)));
    expect(results.total).toBe(results.groups.reduce((sum, g) => sum + g.total, 0));
  });

  it('reaches past people and cases into the records hanging off them', () => {
    const results = searchAll(everything, 'docherty', 40);
    const kinds = new Set(results.groups.map((g) => g.kind));
    expect(kinds.has('people')).toBe(true);
    expect(kinds.has('chronology')).toBe(true);
  });

  it('sends each kind of hit somewhere that exists', () => {
    for (const hit of searchAll(everything, 'docherty', 40).groups.flatMap((g) => g.hits)) {
      expect(hitHref(hit), hitTitle(hit)).toMatch(/^\/(people|processes|meetings|practitioners)\//);
      expect(hitTitle(hit).length).toBeGreaterThan(0);
    }
  });
});

describe('what it refuses to find', () => {
  it('does not name the subject of a case the reader holds no key for', () => {
    // Graeme Dunlop is a mental health officer with presence only on the Docherty MARAC.
    const readable = readableFor('usr_graeme_dunlop');
    const marac = process('MARAC-2026-0093');
    expect(readable.has(marac.id)).toBe(false);

    const results = searchAll(inputFor(readable), 'Kayleigh Docherty', 40);
    const caseHits = results.groups.find((g) => g.kind === 'cases')?.hits ?? [];
    expect(caseHits.some((h) => h.id === marac.id)).toBe(false);

    // Nothing hanging off it either: not the meeting, not an action, not the plan.
    for (const kind of ['meetings', 'actions', 'plans'] as const) {
      const hits = results.groups.find((g) => g.kind === kind)?.hits ?? [];
      for (const hit of hits) {
        const processId = hit.kind === 'meetings' ? hit.meeting.processId : hit.kind === 'actions' ? hit.action.processId : hit.kind === 'plans' ? hit.plan.processId : '';
        expect(readable.has(processId), `${kind} ${hit.id}`).toBe(true);
      }
    }
  });

  it('still finds that case by its reference, and says how many it could not search', () => {
    const readable = readableFor('usr_graeme_dunlop');
    const results = searchAll(inputFor(readable), 'MARAC-2026-0093', 40);
    const caseHits = results.groups.find((g) => g.kind === 'cases')?.hits ?? [];
    // Refusing visibly beats hiding: the reference finds the case and the case says nothing.
    expect(caseHits.map((h) => h.id)).toContain(process('MARAC-2026-0093').id);
    expect(results.unsearchableCases).toBeGreaterThan(0);
  });

  it('leaves a retired chronology entry out of the results', () => {
    const retired = data.events.find((event) => event.recordedInError);
    if (!retired) return;
    const hits = searchAll(everything, retired.title, 40).groups.flatMap((g) => g.hits);
    expect(hits.some((h) => h.kind === 'chronology' && h.id === retired.id)).toBe(false);
  });

  it('says nothing at all for a query too short to mean anything', () => {
    expect(searchAll(everything, 'a', 20).groups).toEqual([]);
    expect(searchAll(everything, '', 20).total).toBe(0);
  });
});
