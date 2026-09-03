/**
 * The audit chain, and the client-side search that replaced the server-side index.
 *
 * The chain's value is entirely in detecting a break. A verification function that has only ever
 * been run against an intact chain proves nothing, so a deliberately tampered fixture is tested
 * here and shown on the Admin screen.
 */
import { DEFAULT_CONFIG, type AuditEntry } from '@mas/domain';
import { buildDataset } from '@mas/mock-data';
import { describe, expect, it } from 'vitest';
import { appendAudit, auditDetailKey, chainHead, emptyChain, linkFor, tamperedCopy, verifyAuditChain } from './auditChain';
import { blindTag, buildClientIndex, searchIndex } from './clientSearch';
import { buildVault } from './vault';

const data = buildDataset();
const vault = buildVault(data, DEFAULT_CONFIG);

function entry(id: string, userId: string, act: AuditEntry['act'], restricted = false): AuditEntry {
  const user = data.users.find((u) => u.id === userId)!;
  return {
    id,
    synthetic: true,
    at: `2026-09-02T09:${id.padStart(2, '0')}:00+01:00`,
    userId,
    userName: `${user.givenName} ${user.familyName}`,
    agency: user.agency,
    act,
    targetType: 'process',
    targetId: 'prc_mappa_derek',
    targetLabel: 'MAPPA-2026-0034: Derek Muir',
    restricted,
  };
}

function chainOf(count: number) {
  let chain = emptyChain();
  const users = ['usr_janet_kerr', 'usr_priya_sharif'];
  for (let i = 0; i < count; i += 1) {
    chain = appendAudit(chain, entry(String(i), users[i % 2]!, i === 0 ? 'sign-in' : 'read-restricted', i > 0), auditDetailKey());
  }
  return chain;
}

describe('the audit chain', () => {
  it('verifies a chain it built', () => {
    const chain = chainOf(8);
    expect(verifyAuditChain(chain)).toEqual({ ok: true, entries: 8 });
    expect(linkFor(chain, '0')).toBe('genesis');
    expect(linkFor(chain, '4')).toHaveLength(12);
    expect(linkFor(chain, 'not-an-entry')).toBe('');
  });

  it('finds an entry someone edited to cover their tracks', () => {
    // The change an attacker would actually make: turn a restricted read into an ordinary one.
    const tampered = tamperedCopy(chainOf(8), 3);
    const result = verifyAuditChain(tampered);
    expect(result.ok).toBe(false);
    expect(result.brokenAt).toBe(3);
    expect(result.reason).toBe('signature-invalid');
  });

  it('finds a removed entry, which no per-entry signature would catch on its own', () => {
    const chain = chainOf(6);
    const shortened = { entries: chain.entries.filter((_entry, i) => i !== 2), index: chain.index };
    const result = verifyAuditChain(shortened);
    expect(result.ok).toBe(false);
    expect(result.brokenAt).toBe(2);
    expect(result.reason).toBe('link-broken');
  });

  it('encrypts the free text and leaves the rest readable, which is what oversight needs', () => {
    const chain = chainOf(3);
    const dump = JSON.stringify(chain.entries, (_key: string, value: unknown) => (value instanceof Uint8Array ? '[bytes]' : value));
    // Who, what, when and at what classification stay in the clear.
    expect(dump).toContain('read-restricted');
    expect(dump).toContain('prc_mappa_derek');
    expect(dump).toContain('official-sensitive-restricted');
    // The practitioner's own words do not.
    expect(dump).not.toContain('Derek Muir');
  });

  it('has a head that changes as it grows', () => {
    expect(chainHead(emptyChain())).toBe('genesis');
    expect(chainHead(chainOf(3))).not.toBe(chainHead(chainOf(4)));
  });
});

describe('client-side search', () => {
  const janet = data.users.find((u) => u.id === 'usr_janet_kerr')!;
  const priya = data.users.find((u) => u.id === 'usr_priya_sharif')!;

  it('indexes only what the user can decrypt', () => {
    const built = buildClientIndex(data, vault, janet);
    expect(built.recordCount).toBeGreaterThan(0);
    // A search that silently covered less than expected would be worse than one that says so.
    expect(built.recordCount + built.withheldCount).toBe(data.processes.length);
  });

  it('cannot surface a record the user holds no key for', () => {
    const built = buildClientIndex(data, vault, janet);
    const mappaVisible = searchIndex(built, 'derek').includes('prc_mappa_derek');
    const priyaBuilt = buildClientIndex(data, vault, priya);
    // Priya is the MAPPA co-ordinator and finds it; Janet is not on it and cannot, even by searching
    // for exactly the right thing. The index contains only what she can already read.
    expect(searchIndex(priyaBuilt, 'derek')).toContain('prc_mappa_derek');
    expect(mappaVisible).toBe(false);
  });

  it('finds a record by a term from inside its encrypted detail', () => {
    // Proof that the index is built from decrypted content rather than from metadata alone.
    const built = buildClientIndex(data, vault, janet);
    const anyProcess = data.processes.find((p) => searchIndex(built, p.reference).includes(p.id));
    expect(anyProcess).toBeDefined();
  });

  it('requires every term to match', () => {
    const built = buildClientIndex(data, vault, janet);
    expect(searchIndex(built, '')).toEqual([]);
    expect(searchIndex(built, 'zzzzzz')).toEqual([]);
  });
});

describe('the blind index', () => {
  it('reveals equality and nothing more, which is exactly what is claimed for it', () => {
    const a = blindTag('reference', 'CP-2026-0412');
    expect(blindTag('reference', 'CP-2026-0412')).toBe(a);
    expect(blindTag('reference', 'CP-2026-0413')).not.toBe(a);
    // The tag is not the value: an operator holding it learns only which records share it.
    expect(a).not.toContain('CP-2026');
  });

  it('buckets a date of birth to the month, so a frequency attack has less to work with', () => {
    // Two people born in the same month share a tag; two born in the same year do not.
    expect(blindTag('date-of-birth-month', '1948-03-14')).toBe(blindTag('date-of-birth-month', '1948-03-29'));
    expect(blindTag('date-of-birth-month', '1948-03-14')).not.toBe(blindTag('date-of-birth-month', '1948-04-14'));
  });

  it('keeps the field in the tag, so a reference cannot collide with a date', () => {
    expect(blindTag('reference', '2026-03')).not.toBe(blindTag('date-of-birth-month', '2026-03'));
  });
});
