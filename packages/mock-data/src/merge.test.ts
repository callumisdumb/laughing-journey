import { datasetSchema, mergePeople, standingMerges, unmergePeople, type Dataset } from '@mas/domain';
import { describe, expect, it } from 'vitest';
import { buildDataset } from './generator/build';
import { AIDEN } from './scenarios/04-aiden-boyle';

/**
 * The merge against the real seed, which is where the walk earns its keep.
 *
 * The unit tests in `packages/domain/src/people/merge.test.ts` prove the mechanism on a fixture
 * shaped by hand. These prove it against a person who is genuinely entangled: Aiden Boyle is on a
 * child protection process, a MARAC referral, a plan, a meeting, a chronology, a risk assessment and
 * several shares, with his id nested three deep in places nobody would think to list.
 */
const WHO = { id: 'mrg_seed', at: '2026-09-04T10:00:00+01:00', byUserId: 'usr_janet_kerr', byName: 'Janet Kerr', reason: 'Two records for the same child, confirmed with the health visitor.' };

/** Every string in the dataset, so a repoint is checked exhaustively rather than field by field. */
function strings(node: unknown, out: string[] = []): string[] {
  if (typeof node === 'string') out.push(node);
  else if (Array.isArray(node)) for (const item of node) strings(item, out);
  else if (node && typeof node === 'object') for (const value of Object.values(node)) strings(value, out);
  return out;
}

describe('merging a person the seed has entangled', () => {
  const data = buildDataset();
  const survivor = data.people.find((p) => p.id !== AIDEN.aiden && p.lifeStage === 'child')!;

  it('has something to find in the first place', () => {
    expect(strings(data).filter((s) => s === AIDEN.aiden).length).toBeGreaterThan(20);
  });

  it('repoints every reference outside the audit ledger', () => {
    const result = mergePeople(data, { ...WHO, survivorId: survivor.id, mergedId: AIDEN.aiden });
    expect(strings({ ...result.data, audit: [] }).filter((s) => s === AIDEN.aiden)).toEqual([]);
    expect(result.data.audit).toBe(data.audit);
  });

  it('leaves a dataset the schema still accepts', () => {
    const result = mergePeople(data, { ...WHO, survivorId: survivor.id, mergedId: AIDEN.aiden });
    const parsed = datasetSchema.safeParse({ ...result.data, personMerges: [result.merge] });
    if (!parsed.success) throw new Error(parsed.error.issues.slice(0, 5).map((i) => `${i.path.join('.')}: ${i.message}`).join('\n'));
    expect(parsed.success).toBe(true);
  });

  it('is reversible, down to the last string', () => {
    const { data: after, merge } = mergePeople(data, { ...WHO, survivorId: survivor.id, mergedId: AIDEN.aiden });
    const back: Dataset = unmergePeople({ ...after, personMerges: [merge] }, merge, { at: '2026-09-05T09:00:00+01:00', reason: 'Wrong child.' });
    const sorted = (d: Dataset) => JSON.stringify({ ...d, personMerges: [], people: [...d.people].sort((a, b) => a.id.localeCompare(b.id)) });
    expect(sorted(back)).toEqual(sorted(data));
    expect(standingMerges(back)).toEqual([]);
  });
});
