/**
 * Merging two person records, and taking it back.
 *
 * A merge is the most destructive thing a practitioner can do to a person record in this product,
 * and it is also the fix for the thing that does the most damage, which is holding two records for
 * one child. Both halves of that sentence matter: the merge has to be real, so that every process,
 * event, relationship, meeting and share follows the surviving record, and it has to be reversible,
 * because conflating two children is worse than the duplicate it was meant to fix and it does
 * happen.
 *
 * Reversibility is why this repoints by walking the dataset rather than by a hand-written list of
 * the places a person id can appear. There are more than twenty such places, several of them nested
 * three deep inside a process detail, and a hand-written list is wrong the first time a schema gains
 * a field. The walk records the path of every reference it changed, so the unmerge sets exactly
 * those back rather than guessing, and it keeps the two records as they were rather than trying to
 * reverse a field-by-field union afterwards.
 */
import type { Dataset } from '../schemas/dataset';
import type { Person, PersonMerge } from '../schemas/person';

export type { PersonMerge };

/** The dataset keys a merge walks. `people` is handled separately; `audit` is never rewritten. */
const WALKED: ReadonlyArray<keyof Dataset> = [
  'households',
  'relationships',
  'processes',
  'events',
  'analyses',
  'meetings',
  'actions',
  'plans',
  'riskAssessments',
  'viewsRecords',
  'lawfulBases',
  'sharingRecords',
  'informationRequests',
  'connectorEvents',
];

/**
 * Replace one id with another everywhere below `node`, recording the path of each replacement.
 *
 * Returns a new node where anything changed and the same node where nothing did, so a merge does not
 * rewrite the whole dataset's object identity and every untouched record stays referentially equal.
 */
function repoint(node: unknown, from: string, to: string, path: string, out: string[]): unknown {
  if (typeof node === 'string') {
    if (node !== from) return node;
    out.push(path);
    return to;
  }
  if (Array.isArray(node)) {
    let changed = false;
    const next = node.map((item, i) => {
      const value = repoint(item, from, to, `${path}.${i}`, out);
      if (value !== item) changed = true;
      return value;
    });
    return changed ? next : node;
  }
  if (node && typeof node === 'object') {
    let changed = false;
    const next: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(node as Record<string, unknown>)) {
      const replaced = repoint(value, from, to, `${path}.${key}`, out);
      if (replaced !== value) changed = true;
      next[key] = replaced;
    }
    return changed ? next : node;
  }
  return node;
}

/**
 * Put a value back at exactly the paths the merge recorded, rebuilding only what is on the way.
 *
 * The obvious implementation clones the collection and assigns into it, and it is wrong for a
 * reason that is not about correctness: the store persists a dataset change by diffing on object
 * identity, so a clone of every walked collection would put every record in the product into local
 * storage on an unmerge. This returns the same object for every subtree that holds none of the
 * recorded paths, so an unmerge writes back exactly what a merge wrote.
 */
function restore(node: unknown, path: string, targets: Set<string>, onTheWay: Set<string>, value: string): unknown {
  if (targets.has(path)) return value;
  if (!onTheWay.has(path)) return node;
  if (Array.isArray(node)) {
    let changed = false;
    const next = node.map((item, i) => {
      const replaced = restore(item, `${path}.${i}`, targets, onTheWay, value);
      if (replaced !== item) changed = true;
      return replaced;
    });
    return changed ? next : node;
  }
  if (node && typeof node === 'object') {
    let changed = false;
    const next: Record<string, unknown> = {};
    for (const [key, item] of Object.entries(node as Record<string, unknown>)) {
      const replaced = restore(item, `${path}.${key}`, targets, onTheWay, value);
      if (replaced !== item) changed = true;
      next[key] = replaced;
    }
    return changed ? next : node;
  }
  return node;
}

/** Every ancestor prefix of every recorded path, so a subtree holding none is skipped whole. */
function ancestors(paths: string[]): Set<string> {
  const out = new Set<string>();
  for (const path of paths) {
    const parts = path.split('.');
    for (let i = 1; i < parts.length; i += 1) out.add(parts.slice(0, i).join('.'));
  }
  return out;
}

function unique(values: string[]): string[] {
  return [...new Set(values.filter((v) => v.trim() !== ''))];
}

const fullName = (p: Person) => `${p.givenName} ${p.familyName}`.trim();

/**
 * The surviving record after the union.
 *
 * The survivor's own values win where both records hold one, because somebody chose which record
 * survives and that choice is the answer to "which of these two is right". Where the survivor is
 * silent the merged record fills the gap, which is the usual reason for merging in the first place:
 * one record has the CHI number and the other has the address.
 */
export function unionPerson(survivor: Person, merged: Person): Person {
  const mergedName = fullName(merged);
  const aliases = unique([...survivor.aliases, ...(mergedName === fullName(survivor) ? [] : [mergedName]), ...merged.aliases]);
  const seen = new Set(survivor.addressHistory.map((a) => `${a.addressId}:${a.from}`));
  const addressHistory = [...survivor.addressHistory, ...merged.addressHistory.filter((a) => !seen.has(`${a.addressId}:${a.from}`))].sort((a, b) => (a.from < b.from ? 1 : -1));
  return {
    ...survivor,
    aliases,
    addressHistory,
    preferredName: survivor.preferredName ?? merged.preferredName,
    pronouns: survivor.pronouns ?? merged.pronouns,
    dateOfBirth: survivor.dateOfBirth ?? merged.dateOfBirth,
    dateOfBirthPrecision: survivor.dateOfBirth ? survivor.dateOfBirthPrecision : merged.dateOfBirthPrecision,
    expectedDeliveryDate: survivor.expectedDeliveryDate ?? merged.expectedDeliveryDate,
    chi: survivor.chi ?? merged.chi,
    householdId: survivor.householdId ?? merged.householdId,
    gpPractice: survivor.gpPractice ?? merged.gpPractice,
    school: survivor.school ?? merged.school,
    deceased: survivor.deceased ?? merged.deceased,
    alerts: [...survivor.alerts, ...merged.alerts.filter((a) => !survivor.alerts.some((s) => s.id === a.id))],
    contact: { phone: survivor.contact.phone ?? merged.contact.phone, email: survivor.contact.email ?? merged.contact.email },
    communicationNeeds: {
      interpreterLanguage: survivor.communicationNeeds.interpreterLanguage ?? merged.communicationNeeds.interpreterLanguage,
      needs: unique([...survivor.communicationNeeds.needs, ...merged.communicationNeeds.needs]),
      note: survivor.communicationNeeds.note ?? merged.communicationNeeds.note,
    },
  };
}

export interface MergeResult {
  data: Dataset;
  merge: PersonMerge;
}

/** Refusals, in the words the screen shows keys for. Empty means the merge may proceed. */
export function mergeRefusals(data: Dataset, survivorId: string, mergedId: string, reason: string): string[] {
  const errors: string[] = [];
  if (survivorId === mergedId) errors.push('mergeSameRecord');
  if (!data.people.some((p) => p.id === survivorId)) errors.push('mergeSurvivorMissing');
  if (!data.people.some((p) => p.id === mergedId)) errors.push('mergeOtherMissing');
  if (reason.trim().length < 10) errors.push('mergeReasonRequired');
  return errors;
}

export function mergePeople(
  data: Dataset,
  { id, survivorId, mergedId, at, byUserId, byName, reason }: { id: string; survivorId: string; mergedId: string; at: string; byUserId: string; byName: string; reason: string },
): MergeResult {
  const survivor = data.people.find((p) => p.id === survivorId);
  const merged = data.people.find((p) => p.id === mergedId);
  if (!survivor || !merged) throw new Error('mergePeople: both records must exist; call mergeRefusals first');

  const repointed: string[] = [];
  const next = { ...data } as Record<string, unknown>;
  for (const key of WALKED) {
    next[key] = repoint(data[key], mergedId, survivorId, key, repointed);
  }
  next.people = data.people.filter((p) => p.id !== mergedId).map((p) => (p.id === survivorId ? unionPerson(survivor, merged) : p));

  return {
    data: next as Dataset,
    merge: { id, synthetic: true, survivorId, mergedId, mergedPerson: merged, survivorBefore: survivor, repointed, at, byUserId, byName, reason },
  };
}

/**
 * Take a merge back.
 *
 * Both records return exactly as they were, and every reference the merge repointed goes back to the
 * record it named. The merge record itself stays and gains `undoneAt`, because the merge happened
 * and an audit trail that deletes its own evidence is not one.
 */
export function unmergePeople(data: Dataset, merge: PersonMerge, { at, reason }: { at: string; reason: string }): Dataset {
  const targets = new Set(merge.repointed);
  const onTheWay = ancestors(merge.repointed);
  const next = { ...data } as Record<string, unknown>;
  for (const key of WALKED) next[key] = restore(data[key], key, targets, onTheWay, merge.mergedId);
  next.people = [...data.people.filter((p) => p.id !== merge.survivorId && p.id !== merge.mergedId), merge.survivorBefore, merge.mergedPerson].sort((a, b) => a.id.localeCompare(b.id));
  next.personMerges = data.personMerges.map((m) => (m.id === merge.id ? { ...m, undoneAt: at, undoneReason: reason } : m));
  return next as Dataset;
}

/**
 * Follow a person id through any merges it has been through, to the record that holds them now.
 *
 * A merged-away id does not stop existing the moment the merge happens. It is in somebody's
 * bookmarks, in a printed pack, in a connector event that was queued before the merge and arrives
 * after it. Resolving it to the survivor is what `docs/RECORDS.md` means by the old reference still
 * landing, and returning the id unchanged where nothing matches keeps every caller simple.
 *
 * The walk is bounded: merges cannot form a cycle in practice, since a retired record cannot be
 * merged again, but a bound costs one line and a hang costs an afternoon.
 */
export function resolvePersonId(data: Dataset, personId: string): string {
  let current = personId;
  for (let i = 0; i < 16; i += 1) {
    const merge = data.personMerges.find((m) => !m.undoneAt && m.mergedId === current);
    if (!merge) return current;
    current = merge.survivorId;
  }
  return current;
}

/** Merges that are still standing, which is what an unmerge can be offered for. */
export function standingMerges(data: Dataset, personId?: string): PersonMerge[] {
  return data.personMerges.filter((m) => !m.undoneAt && (personId === undefined || m.survivorId === personId));
}
