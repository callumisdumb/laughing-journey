/**
 * The vault, and the two properties the whole design rests on.
 *
 * One: the mock store contains no plaintext record content. If it did, everything above it would be
 * theatre, and a reviewer opening the store would find that out in ten seconds.
 *
 * Two: there is no path from a stored record to its content that does not go through a successful
 * key unwrap. The old arrangement returned a permission boolean that a caller had to remember to
 * consult; this test exists so that if anyone reintroduces one, the suite says so.
 */
import { CryptoError, toBase64Url } from '@mas/crypto';
import { DEFAULT_CONFIG, accessFor, principalIds, wrapListFor, type Process, type User } from '@mas/domain';
import { buildDataset } from '@mas/mock-data';
import { readFileSync, readdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { buildVault, holdsKey, openProcess, serverView } from './vault';

const data = buildDataset();
const config = DEFAULT_CONFIG;
const vault = buildVault(data, config);

function user(id: string): User {
  const found = data.users.find((u) => u.id === id);
  if (!found) throw new Error(`no such user ${id}`);
  return found;
}

function process(id: string): Process {
  const found = data.processes.find((p) => p.id === id);
  if (!found) throw new Error(`no such process ${id}`);
  return found;
}

describe('the mock store holds ciphertext and nothing else', () => {
  it('encrypts every process record', () => {
    expect(vault.records.size).toBe(data.processes.length);
    for (const record of vault.records.values()) {
      expect(record.sealed.ciphertext.length).toBeGreaterThan(0);
      expect(record.wrappedKeys.length).toBeGreaterThan(0);
    }
  });

  it('contains no plaintext from any record it holds', () => {
    // Serialise the whole store the way a database dump would and look for content that is in the
    // seed. Any hit means the store is keeping plaintext somewhere it should not.
    const dump = JSON.stringify([...vault.records.values()], (_key: string, value: unknown) => (value instanceof Uint8Array ? toBase64Url(value) : value));
    const phrases = data.processes.flatMap((p) => {
      const detail = JSON.stringify(p.detail);
      // A handful of distinctive runs from each record, long enough not to collide by chance.
      return [detail.slice(200, 260), detail.slice(600, 660)].filter((phrase) => phrase.length > 40);
    });
    expect(phrases.length).toBeGreaterThan(10);
    for (const phrase of phrases) expect(dump).not.toContain(phrase);
  });

  it('keeps the metadata coarse, as the threat model admits to and no more', () => {
    for (const record of vault.records.values()) {
      // The type is the process kind, never the stage or the title.
      expect(record.metadata.type).toMatch(/^(asp|cp|marac|mappa|awi)-process$/);
      // The timestamp is a date, not an instant: no time of day reaches the operator.
      expect(record.metadata.updatedAt).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    }
  });
});

describe('reading a record', () => {
  it('opens for someone the matrix entitles', () => {
    // Janet Kerr is the lead on Aiden Boyle's child protection process.
    const detail = openProcess(vault, process('prc_cp_aiden'), user('usr_janet_kerr'));
    expect(JSON.stringify(detail)).toContain('concern');
  });

  it('refuses someone it does not, with the unentitled reason rather than a decryption error', () => {
    // Whoever the matrix leaves off the MAPPA record: chosen from the seed rather than named, so the
    // test keeps meaning if the cast changes.
    const outsider = data.users.find((u) => !holdsKey(vault, 'prc_mappa_derek', u));
    expect(outsider, 'the seed should contain someone not on the MAPPA record').toBeDefined();
    try {
      openProcess(vault, process('prc_mappa_derek'), outsider!);
      expect.unreachable('an unentitled reader should hold no key');
    } catch (error) {
      expect(error).toBeInstanceOf(CryptoError);
      // The UI renders this as the restricted state; a decrypt-failed would mean something is wrong.
      expect((error as CryptoError).reason).toBe('no-wrapped-key');
    }
  });

  it('agrees with the matrix: everyone the resolver entitles holds a key, and nobody else does', () => {
    for (const p of data.processes) {
      const entitled = new Set(
        wrapListFor(p, data.users, (u) => accessFor(u, p, { rows: config.needToKnow, exclusions: config.exclusions }))
          .map((entry) => entry.principalId),
      );
      for (const u of data.users) {
        const expected = entitled.has(principalIds.user(u.id));
        expect(holdsKey(vault, p.id, u), `${u.id} on ${p.id}`).toBe(expected);
        if (expected) expect(() => openProcess(vault, p, u)).not.toThrow();
        else expect(() => openProcess(vault, p, u)).toThrow(CryptoError);
      }
    }
  });

  it('wraps every record to escrow, so a lawful disclosure can always reach it', () => {
    // A record nobody can open is not secure, it is lost, and the ICO treats inaccessibility as a
    // failure in its own right. See docs/THREAT-MODEL.md section 2.
    for (const record of vault.records.values()) {
      expect(record.wrappedKeys.map((wrap) => wrap.principalId)).toContain(principalIds.escrow());
    }
  });

  it('does not wrap to a presence-level reader', () => {
    // Presence means knowing a record exists and nothing about it. Wrapping to a presence reader
    // would hand them the content and ask the UI not to show it, which is the mistake the whole
    // refactor exists to make impossible.
    let presenceReaders = 0;
    for (const p of data.processes) {
      for (const u of data.users) {
        if (accessFor(u, p, { rows: config.needToKnow, exclusions: config.exclusions }).level !== 'presence') continue;
        presenceReaders += 1;
        expect(holdsKey(vault, p.id, u), `${u.id} has presence on ${p.id} and must hold no key`).toBe(false);
      }
    }
    expect(presenceReaders, 'the seed should produce at least one presence-level reader').toBeGreaterThan(0);
  });
});

describe('what the host can see', () => {
  it('shows exactly the fields the threat model admits to, and no more', () => {
    const rows = serverView(vault);
    expect(rows.length).toBe(data.processes.length);
    const fields = Object.keys(rows[0] ?? {}).sort();
    // If a field is added here it must also be added to docs/THREAT-MODEL.md section 3 and to the
    // Security page, because the screen is the honest statement of the leakage, not a summary of it.
    expect(fields).toEqual(['ciphertextBytes', 'ciphertextPreview', 'classification', 'generation', 'id', 'keyHolders', 'linkedIds', 'principalIds', 'type', 'updatedAt']);
  });

  it('shows no name, no title and no case content', () => {
    // The ciphertext preview is random base64 and will contain any two-letter run by chance, so the
    // claim is tested against the metadata, which is what it is actually about.
    const dump = JSON.stringify(serverView(vault).map(({ ciphertextPreview: _preview, ...metadata }) => metadata));
    const names = new Set(data.people.flatMap((person) => [person.givenName, person.familyName]).filter((name) => name.length >= 4));
    expect(names.size).toBeGreaterThan(10);
    for (const name of names) expect(dump, `the operator must not see ${name}`).not.toContain(name);
    for (const p of data.processes) expect(dump).not.toContain(p.title);
    for (const p of data.processes) expect(dump).not.toContain(p.reference);
  });

  it('shows principal identifiers that are opaque rather than names or addresses', () => {
    for (const row of serverView(vault)) {
      for (const id of row.principalIds) {
        expect(id).toMatch(/^p:(usr|rol|agy|cas|esc):/);
        expect(id).not.toMatch(/@/);
      }
    }
  });
});

describe('the boolean path is gone', () => {
  it('has no canRead or canSee anywhere in the app or the domain', () => {
    // The refactor replaced a permission boolean with an unwrap. A boolean is something a caller can
    // forget to consult, and a caller that forgot rendered the record anyway. This test is what stops
    // it coming back, because nothing else would notice for months.
    const root = resolve(import.meta.dirname, '../../..');
    const files: string[] = [];
    const walk = (dir: string) => {
      for (const entry of readdirSync(dir, { withFileTypes: true })) {
        const full = resolve(dir, entry.name);
        if (entry.isDirectory()) {
          if (entry.name === 'node_modules' || entry.name === '.next' || entry.name === 'out' || entry.name === '.git') continue;
          walk(full);
        } else if (/\.(ts|tsx)$/.test(entry.name)) {
          files.push(full);
        }
      }
    };
    walk(resolve(root, 'apps/web'));
    walk(resolve(root, 'packages/domain/src'));
    const offenders = files.filter((file) => {
      if (file.endsWith('vault.test.ts')) return false;
      // Comments are stripped first: access.ts explains why the boolean was removed, and an
      // explanation of a mistake is not the mistake.
      const code = readFileSync(file, 'utf8').replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');
      return /\bcanRead\s*\(|\bcanSee\s*\(/.test(code);
    });
    expect(offenders).toEqual([]);
  });
});
