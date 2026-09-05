/**
 * The package's own behaviour: wrapping, records, rotation, escrow, signing and the audit chain.
 *
 * The known-answer vectors in vectors.test.ts prove the primitives are the ones the standards
 * describe. These tests prove the constructions built on them behave the way docs/THREAT-MODEL.md
 * says they do, which is the part a reviewer will actually want to check.
 */
import { describe, expect, it } from 'vitest';
import { aeadAad, generateContentKey, open, seal, CONTENT_KEY_BYTES, NONCE_BYTES } from './aead';
import { concat, equalConstantTime, fromBase64Url, fromUtf8, randomBytes, toBase64Url, utf8, wipe } from './bytes';
import { appendEntry, auditEntryBytes, auditEntryHash, GENESIS_HASH, linksMatch, verifyChain, type AuditEntry, type AuditEntryBody } from './chain';
import { ARGON2_PARAMETERS, blindIndexTag, deriveFromPassphrase, deriveKey } from './kdf';
import { generateKeyPair, generateSigningKeyPair, publicKeyOf, verifyingKey, PRINCIPAL_KINDS } from './keys';
import { addPrincipals, bucketTimestamp, encryptRecord, isWrappedTo, openRecord, rewrapToSuite, rotateRecord, unwrapRecordKey, type RecordMetadata } from './record';
import { assertVerified, sign, verify } from './sign';
import { combine, ESCROW_SHARES, ESCROW_THRESHOLD, split } from './shamir';
import { CryptoError, CURRENT_SUITE, KDF_INFO, suiteSpec, SUITES } from './suite';
import { unwrapKey, wrapFor, wrapKey, wrapToAll } from './wrap';

const METADATA: RecordMetadata = {
  id: 'prc_mappa_derek',
  type: 'mappa-process',
  classification: 'official-sensitive',
  generation: 1,
  updatedAt: '2026-09-02',
  linkedIds: ['per_derek_muir'],
};

const PLAINTEXT = 'Risk management plan: Level 2, reviewed 20 Jul 2026.';

describe('bytes', () => {
  it('round trips base64url without padding', () => {
    for (const length of [1, 2, 3, 31, 32, 33, 1184]) {
      const bytes = randomBytes(length);
      const text = toBase64Url(bytes);
      expect(text).not.toContain('=');
      expect(text).not.toContain('+');
      expect(text).not.toContain('/');
      expect([...fromBase64Url(text)]).toEqual([...bytes]);
    }
  });

  it('refuses a character that is not base64url', () => {
    expect(() => fromBase64Url('abc!')).toThrow(CryptoError);
  });

  it('refuses a random length that is not a positive integer', () => {
    expect(() => randomBytes(0)).toThrow(CryptoError);
    expect(() => randomBytes(-1)).toThrow(CryptoError);
    expect(() => randomBytes(1.5)).toThrow(CryptoError);
  });

  it('round trips UTF-8 including characters outside Latin-1', () => {
    const text = 'Ewa Zielińska, Auchentorran';
    expect(fromUtf8(utf8(text))).toBe(text);
  });

  it('concatenates in order', () => {
    expect([...concat(utf8('a'), utf8('bc'), utf8('d'))]).toEqual([...utf8('abcd')]);
    expect(concat().length).toBe(0);
  });

  it('compares in constant time and still gets the answer right', () => {
    const a = randomBytes(32);
    const b = Uint8Array.from(a);
    expect(equalConstantTime(a, b)).toBe(true);
    b[31] = (b[31] ?? 0) ^ 1;
    expect(equalConstantTime(a, b)).toBe(false);
    expect(equalConstantTime(a, a.slice(0, 31))).toBe(false);
  });

  it('wipes a buffer', () => {
    const bytes = randomBytes(16);
    wipe(bytes);
    expect([...bytes]).toEqual(Array.from({ length: 16 }, () => 0));
  });
});

describe('the suite', () => {
  it('names the current suite in the list', () => {
    expect(SUITES).toContain(CURRENT_SUITE);
    expect(suiteSpec(CURRENT_SUITE).aead).toBe('AES-256-GCM');
    expect(suiteSpec(CURRENT_SUITE).postQuantumKem).toBe('ML-KEM-768');
  });

  it('refuses a suite it does not know, rather than guessing', () => {
    // @ts-expect-error deliberately passing a suite that does not exist
    expect(() => suiteSpec('v0-rot13')).toThrow(CryptoError);
  });

  it('gives every derivation purpose its own info string', () => {
    const infos = Object.values(KDF_INFO);
    expect(new Set(infos).size).toBe(infos.length);
  });
});

describe('AEAD', () => {
  it('round trips under the right key and context', () => {
    const key = generateContentKey();
    const context = { recordId: 'r1', classification: 'official-sensitive', generation: 1 };
    const sealed = seal(key, utf8(PLAINTEXT), context);
    expect(sealed.nonce.length).toBe(NONCE_BYTES);
    expect(fromUtf8(open(key, sealed, context))).toBe(PLAINTEXT);
  });

  it('never reuses a nonce', () => {
    const key = generateContentKey();
    const context = { recordId: 'r1', classification: 'official-sensitive', generation: 1 };
    const nonces = new Set(Array.from({ length: 200 }, () => toBase64Url(seal(key, utf8('x'), context).nonce)));
    expect(nonces.size).toBe(200);
  });

  it('refuses a ciphertext lifted onto a different record', () => {
    const key = generateContentKey();
    const sealed = seal(key, utf8(PLAINTEXT), { recordId: 'r1', classification: 'official-sensitive', generation: 1 });
    expect(() => open(key, sealed, { recordId: 'r2', classification: 'official-sensitive', generation: 1 })).toThrow(CryptoError);
  });

  it('refuses a ciphertext presented as carrying a lower classification', () => {
    const key = generateContentKey();
    const sealed = seal(key, utf8(PLAINTEXT), { recordId: 'r1', classification: 'official-sensitive', generation: 1 });
    expect(() => open(key, sealed, { recordId: 'r1', classification: 'official', generation: 1 })).toThrow(CryptoError);
  });

  it('refuses a ciphertext from a superseded key generation', () => {
    const key = generateContentKey();
    const sealed = seal(key, utf8(PLAINTEXT), { recordId: 'r1', classification: 'official-sensitive', generation: 1 });
    expect(() => open(key, sealed, { recordId: 'r1', classification: 'official-sensitive', generation: 2 })).toThrow(CryptoError);
  });

  it('refuses a tampered ciphertext', () => {
    const key = generateContentKey();
    const context = { recordId: 'r1', classification: 'official-sensitive', generation: 1 };
    const sealed = seal(key, utf8(PLAINTEXT), context);
    sealed.ciphertext[0] = (sealed.ciphertext[0] ?? 0) ^ 0xff;
    expect(() => open(key, sealed, context)).toThrow(CryptoError);
  });

  it('refuses a key or nonce of the wrong length', () => {
    const context = { recordId: 'r1', classification: 'official', generation: 1 };
    expect(() => seal(randomBytes(16), utf8('x'), context)).toThrow(CryptoError);
    const sealed = seal(generateContentKey(), utf8('x'), context);
    expect(() => open(randomBytes(16), sealed, context)).toThrow(CryptoError);
    expect(() => open(generateContentKey(), { ...sealed, nonce: randomBytes(8) }, context)).toThrow(CryptoError);
  });

  it('encodes the AAD so one field cannot impersonate another', () => {
    // "ab" + "c" must not encode the same as "a" + "bc": length prefixes are what stop it.
    const a = aeadAad({ recordId: 'ab', classification: 'c', generation: 1 });
    const b = aeadAad({ recordId: 'a', classification: 'bc', generation: 1 });
    expect(toBase64Url(a)).not.toBe(toBase64Url(b));
  });
});

describe('hybrid key wrapping', () => {
  it('wraps and unwraps for the intended principal', () => {
    const pair = generateKeyPair('user', 'usr_janet');
    const key = generateContentKey();
    const wrapped = wrapKey(key, publicKeyOf(pair));
    expect(wrapped.ephemeralClassical.length).toBe(32);
    expect(wrapped.kemCiphertext.length).toBe(1088);
    expect([...unwrapKey(wrapped, pair.privateKey, pair.publicKey)]).toEqual([...key]);
  });

  it('does not unwrap for anyone else, which is the whole defence', () => {
    const entitled = generateKeyPair('user', 'usr_janet');
    const colleague = generateKeyPair('user', 'usr_curious');
    const wrapped = wrapKey(generateContentKey(), publicKeyOf(entitled));
    // Even given the wrap, and even substituting their own id, the curious colleague gets nothing.
    expect(() => unwrapKey(wrapped, colleague.privateKey, colleague.publicKey)).toThrow(CryptoError);
  });

  it('produces a different wrap every time, so two records do not share a wrapping key', () => {
    const pair = generateKeyPair('user', 'usr_janet');
    const key = generateContentKey();
    const a = wrapKey(key, publicKeyOf(pair));
    const b = wrapKey(key, publicKeyOf(pair));
    expect(toBase64Url(a.wrapped)).not.toBe(toBase64Url(b.wrapped));
    expect(toBase64Url(a.ephemeralClassical)).not.toBe(toBase64Url(b.ephemeralClassical));
  });

  it('refuses a content key of the wrong length', () => {
    const pair = generateKeyPair('user', 'usr_janet');
    expect(() => wrapKey(randomBytes(16), publicKeyOf(pair))).toThrow(CryptoError);
  });

  it('wraps to a whole list and finds each principal', () => {
    const pairs = ['usr_a', 'usr_b', 'usr_c'].map((id) => generateKeyPair('user', id));
    const wraps = wrapToAll(generateContentKey(), pairs.map(publicKeyOf));
    expect(wraps).toHaveLength(3);
    expect(wrapFor(wraps, 'usr_b')?.principalId).toBe('usr_b');
    expect(wrapFor(wraps, 'usr_nobody')).toBeUndefined();
  });

  it('makes a key pair for every kind of principal', () => {
    for (const kind of PRINCIPAL_KINDS) {
      const pair = generateKeyPair(kind, `${kind}_1`);
      expect(pair.publicKey.kind).toBe(kind);
      const key = generateContentKey();
      expect([...unwrapKey(wrapKey(key, pair.publicKey), pair.privateKey, pair.publicKey)]).toEqual([...key]);
    }
  });

  it('refuses a principal with no identifier', () => {
    expect(() => generateKeyPair('user', '')).toThrow(CryptoError);
  });
});

describe('records', () => {
  const janet = generateKeyPair('user', 'usr_janet');
  const priya = generateKeyPair('user', 'usr_priya');
  const curious = generateKeyPair('user', 'usr_curious');
  const escrow = generateKeyPair('escrow', 'escrow');

  it('opens for an entitled reader and for nobody else', () => {
    const record = encryptRecord(METADATA, PLAINTEXT, [janet.publicKey, escrow.publicKey]);
    expect(openRecord(record, janet.privateKey, janet.publicKey)).toBe(PLAINTEXT);
    expect(() => openRecord(record, curious.privateKey, curious.publicKey)).toThrow(CryptoError);
  });

  it('reports being unentitled as its own reason, not as a decryption failure', () => {
    const record = encryptRecord(METADATA, PLAINTEXT, [janet.publicKey]);
    try {
      unwrapRecordKey(record, curious.privateKey, curious.publicKey);
      expect.unreachable('should have thrown');
    } catch (error) {
      // The UI renders this as the restricted state; a decrypt-failed would mean something is wrong.
      expect((error as CryptoError).reason).toBe('no-wrapped-key');
    }
  });

  it('holds no plaintext anywhere in the stored shape', () => {
    const record = encryptRecord(METADATA, PLAINTEXT, [janet.publicKey]);
    const asJson = JSON.stringify(record, (_key: string, value: unknown) => (value instanceof Uint8Array ? toBase64Url(value) : value));
    expect(asJson).not.toContain('Risk management plan');
  });

  it('refuses to encrypt a record to nobody', () => {
    // A record no one can open is not secure, it is lost, and losing access is itself a breach.
    expect(() => encryptRecord(METADATA, PLAINTEXT, [])).toThrow(CryptoError);
  });

  it('adds a principal without re-encrypting', () => {
    const record = encryptRecord(METADATA, PLAINTEXT, [janet.publicKey]);
    const extended = addPrincipals(record, janet.privateKey, janet.publicKey, [priya.publicKey]);
    expect(isWrappedTo(extended, 'usr_priya')).toBe(true);
    expect(openRecord(extended, priya.privateKey, priya.publicKey)).toBe(PLAINTEXT);
    expect(extended.metadata.generation).toBe(record.metadata.generation);
    // Adding twice does not duplicate the wrap.
    expect(addPrincipals(extended, janet.privateKey, janet.publicKey, [priya.publicKey]).wrappedKeys).toHaveLength(2);
  });

  it('cannot be extended by someone who cannot already open it', () => {
    const record = encryptRecord(METADATA, PLAINTEXT, [janet.publicKey]);
    expect(() => addPrincipals(record, curious.privateKey, curious.publicKey, [priya.publicKey])).toThrow(CryptoError);
  });

  it('rotates on removal, and says plainly that rotation does not unread', () => {
    const record = encryptRecord(METADATA, PLAINTEXT, [janet.publicKey, priya.publicKey, escrow.publicKey]);
    const rotation = rotateRecord(record, PLAINTEXT, [janet.publicKey, escrow.publicKey], 'principal-removed');
    expect(rotation.removed).toEqual(['usr_priya']);
    expect(rotation.record.metadata.generation).toBe(2);
    expect(openRecord(rotation.record, janet.privateKey, janet.publicKey)).toBe(PLAINTEXT);
    expect(() => openRecord(rotation.record, priya.privateKey, priya.publicKey)).toThrow(CryptoError);
    // The honest part: the removed principal could still open the copy they already had.
    expect(rotation.priorAccessRemains).toBe(true);
    expect(openRecord(record, priya.privateKey, priya.publicKey)).toBe(PLAINTEXT);
  });

  it('rewraps to a suite, so a change of suite is an operation rather than a migration', () => {
    const record = encryptRecord(METADATA, PLAINTEXT, [janet.publicKey]);
    const rewrapped = rewrapToSuite(record, janet.privateKey, janet.publicKey, [janet.publicKey, priya.publicKey], CURRENT_SUITE);
    expect(openRecord(rewrapped, priya.privateKey, priya.publicKey)).toBe(PLAINTEXT);
  });

  it('buckets a timestamp to the day', () => {
    expect(bucketTimestamp('2026-09-02T03:14:07+01:00')).toBe('2026-09-02');
  });
});

describe('escrow, split two of five', () => {
  it('reconstructs from any two shares', () => {
    const secret = randomBytes(32);
    const shares = split(secret);
    expect(shares).toHaveLength(ESCROW_SHARES);
    for (let i = 0; i < shares.length; i += 1) {
      for (let j = i + 1; j < shares.length; j += 1) {
        expect([...combine([shares[i]!, shares[j]!])]).toEqual([...secret]);
      }
    }
  });

  it('tells one holder nothing, which is the point of split control', () => {
    const secret = randomBytes(32);
    const shares = split(secret);
    expect(() => combine([shares[0]!])).toThrow(CryptoError);
    // A single share is information-theoretically independent of the secret.
    expect([...shares[0]!.value]).not.toEqual([...secret]);
  });

  it('refuses the same share presented twice as if it were two holders', () => {
    const shares = split(randomBytes(32));
    expect(() => combine([shares[0]!, shares[0]!])).toThrow(CryptoError);
  });

  it('works at other thresholds and refuses impossible ones', () => {
    const secret = randomBytes(16);
    const shares = split(secret, 3, 5);
    expect([...combine(shares.slice(1, 4), 3)]).toEqual([...secret]);
    expect(() => split(secret, 1, 5)).toThrow(CryptoError);
    expect(() => split(secret, 4, 3)).toThrow(CryptoError);
    expect(() => split(secret, 2, 256)).toThrow(CryptoError);
    expect(() => split(new Uint8Array(0))).toThrow(CryptoError);
  });

  it('refuses shares of different lengths', () => {
    const a = split(randomBytes(32));
    const b = split(randomBytes(16));
    expect(() => combine([a[0]!, b[1]!])).toThrow(CryptoError);
  });

  it('seeds the threshold at two of five', () => {
    expect(ESCROW_THRESHOLD).toBe(2);
    expect(ESCROW_SHARES).toBe(5);
  });
});

describe('signatures', () => {
  const key = generateSigningKeyPair('dev_janet_laptop');
  const other = generateSigningKeyPair('dev_someone_else');
  const message = utf8('MAPPA minute, 02 Sep 2026');

  it('signs and verifies at the short horizon', () => {
    const signature = sign(message, key);
    expect(signature.longTerm).toBeUndefined();
    expect(verify(message, signature, verifyingKey(key))).toBe(true);
  });

  it('adds a post-quantum signature at the long horizon and requires both', () => {
    const signature = sign(message, key, 'long');
    expect(signature.longTerm).toBeDefined();
    expect(verify(message, signature, verifyingKey(key))).toBe(true);
    // A long-horizon signature missing its post-quantum half is a failure, not a downgrade.
    expect(verify(message, { ...signature, longTerm: undefined }, verifyingKey(key))).toBe(false);
  });

  it('rejects a changed message, a different signer and a mismatched id', () => {
    const signature = sign(message, key, 'long');
    expect(verify(utf8('a different minute'), signature, verifyingKey(key))).toBe(false);
    expect(verify(message, signature, verifyingKey(other))).toBe(false);
    expect(verify(message, { ...signature, signerId: 'someone' }, verifyingKey(key))).toBe(false);
  });

  it('rejects a forged post-quantum half even when the classical half is genuine', () => {
    const signature = sign(message, key, 'long');
    const forged = Uint8Array.from(signature.longTerm!);
    forged[0] = (forged[0] ?? 0) ^ 0xff;
    expect(verify(message, { ...signature, longTerm: forged }, verifyingKey(key))).toBe(false);
  });

  it('throws where a caller treats a bad signature as fatal', () => {
    expect(() => assertVerified(utf8('wrong'), sign(message, key), verifyingKey(key))).toThrow(CryptoError);
    expect(() => assertVerified(message, sign(message, key), verifyingKey(key))).not.toThrow();
  });
});

describe('key derivation', () => {
  it('derives a different key for every purpose from the same material', () => {
    const material = randomBytes(32);
    const salt = randomBytes(16);
    const keys = (['keyWrap', 'localStore', 'blindIndex', 'recovery', 'auditDetail'] as const).map((purpose) => toBase64Url(deriveKey(material, salt, purpose)));
    expect(new Set(keys).size).toBe(keys.length);
  });

  it('is deterministic for the same material, salt and purpose', () => {
    const material = randomBytes(32);
    const salt = randomBytes(16);
    expect(toBase64Url(deriveKey(material, salt, 'localStore'))).toBe(toBase64Url(deriveKey(material, salt, 'localStore')));
  });

  it('refuses to derive from nothing', () => {
    expect(() => deriveKey(new Uint8Array(0), randomBytes(16), 'keyWrap')).toThrow(CryptoError);
  });

  it('stretches a passphrase with Argon2id at the configured cost', () => {
    // Reduced cost here so the suite stays fast; the shipped parameters are asserted separately.
    const cheap = { memoryKib: 512, passes: 1, lanes: 1 };
    const salt = randomBytes(16);
    const derived = deriveFromPassphrase('correct horse battery staple', salt, cheap);
    expect(derived.length).toBe(CONTENT_KEY_BYTES);
    expect(toBase64Url(deriveFromPassphrase('correct horse battery staple', salt, cheap))).toBe(toBase64Url(derived));
    expect(toBase64Url(deriveFromPassphrase('a different passphrase', salt, cheap))).not.toBe(toBase64Url(derived));
    expect(() => deriveFromPassphrase('', salt, cheap)).toThrow(CryptoError);
  });

  it('ships Argon2id parameters that are worth having', () => {
    expect(ARGON2_PARAMETERS.memoryKib).toBeGreaterThanOrEqual(65_536);
    expect(ARGON2_PARAMETERS.passes).toBeGreaterThanOrEqual(3);
  });

  it('produces a stable blind index tag for equal values, and only for equal values', () => {
    const indexKey = randomBytes(32);
    // Normalisation means the same reference typed differently still matches.
    expect(toBase64Url(blindIndexTag('  CP-2026-0412 ', indexKey))).toBe(toBase64Url(blindIndexTag('cp-2026-0412', indexKey)));
    expect(toBase64Url(blindIndexTag('CP-2026-0413', indexKey))).not.toBe(toBase64Url(blindIndexTag('CP-2026-0412', indexKey)));
    // And a different key gives a different tag, so the operator cannot compute tags themselves.
    expect(toBase64Url(blindIndexTag('CP-2026-0412', randomBytes(32)))).not.toBe(toBase64Url(blindIndexTag('CP-2026-0412', indexKey)));
  });
});

describe('the audit chain', () => {
  const janetKey = generateSigningKeyPair('dev_janet_laptop');
  const priyaKey = generateSigningKeyPair('dev_priya_laptop');
  const keys = new Map([
    ['dev_janet_laptop', verifyingKey(janetKey)],
    ['dev_priya_laptop', verifyingKey(priyaKey)],
  ]);

  function body(id: string, actorId: string, action: string): AuditEntryBody {
    return { id, at: `2026-09-02T09:0${id}:00+01:00`, actorId, action, targetId: 'prc_mappa_derek', classification: 'official-sensitive', restricted: true };
  }

  function chainOf(length: number): AuditEntry[] {
    const entries: AuditEntry[] = [];
    for (let i = 0; i < length; i += 1) {
      const key = i % 2 === 0 ? janetKey : priyaKey;
      entries.push(appendEntry(entries.at(-1), body(String(i), key.id, i === 0 ? 'sign-in' : 'read-restricted'), key));
    }
    return entries;
  }

  it('verifies a chain it built', () => {
    const entries = chainOf(6);
    expect(entries[0]?.previousHash).toBe(GENESIS_HASH);
    expect(verifyChain(entries, keys)).toEqual({ ok: true, entries: 6 });
    expect(verifyChain([], keys)).toEqual({ ok: true, entries: 0 });
  });

  it('signs every entry at the long horizon, because an entry may be read in decades', () => {
    for (const entry of chainOf(3)) expect(entry.signature.horizon).toBe('long');
  });

  it('detects an altered entry', () => {
    const entries = chainOf(5);
    // Someone changes what the record says they did.
    entries[2] = { ...entries[2]!, body: { ...entries[2]!.body, action: 'read' } };
    const result = verifyChain(entries, keys);
    expect(result.ok).toBe(false);
    expect(result.brokenAt).toBe(2);
    expect(result.reason).toBe('signature-invalid');
  });

  it('detects a removed entry', () => {
    const entries = chainOf(5);
    entries.splice(2, 1);
    const result = verifyChain(entries, keys);
    expect(result.ok).toBe(false);
    expect(result.brokenAt).toBe(2);
    expect(result.reason).toBe('link-broken');
  });

  it('detects an entry from a signer it does not know', () => {
    const stranger = generateSigningKeyPair('dev_stranger');
    const entries = chainOf(2);
    entries.push(appendEntry(entries.at(-1), body('9', stranger.id, 'export'), stranger));
    const result = verifyChain(entries, keys);
    expect(result.ok).toBe(false);
    expect(result.brokenAt).toBe(2);
    expect(result.reason).toBe('unknown-signer');
  });

  it('covers the encrypted detail, so a detail cannot be swapped between entries', () => {
    const detailKey = generateContentKey();
    const context = { recordId: 'audit', classification: 'official-sensitive', generation: 1 };
    const detail = seal(detailKey, utf8('Neighbour named in the referral'), context);
    const entry = appendEntry(undefined, body('0', janetKey.id, 'read-restricted'), janetKey, detail);
    expect(verifyChain([entry], keys).ok).toBe(true);
    const swapped = { ...entry, detail: seal(detailKey, utf8('Something else entirely'), context) };
    expect(verifyChain([swapped], keys).ok).toBe(false);
  });

  it('hashes an entry over its body, its link and its detail', () => {
    const entry = appendEntry(undefined, body('0', janetKey.id, 'sign-in'), janetKey);
    expect(auditEntryHash(entry).length).toBe(32);
    expect(auditEntryBytes(entry.body, entry.previousHash, entry.detail).length).toBeGreaterThan(0);
  });

  it('compares links in constant time', () => {
    expect(linksMatch('abc', 'abc')).toBe(true);
    expect(linksMatch('abc', 'abd')).toBe(false);
  });
});
