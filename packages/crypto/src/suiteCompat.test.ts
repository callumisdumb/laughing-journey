/**
 * Backward compatibility: a record sealed under an earlier build must still open.
 *
 * `fixtures/v1-record.json` was produced once, on 03 September 2026, and committed. It is never
 * regenerated. Its whole value is that it was made by code nobody can now change: if a refactor
 * alters the wire format, the additional authenticated data, the HKDF info string, the salt
 * construction or the field order, this test fails and every record in every deployment would have
 * become unreadable.
 *
 * The NCSC's timeline expects this product to migrate suite between 2028 and 2035, well inside the
 * lifetime of the records it holds. When v2 arrives, the thing that proves v1 still opens already
 * exists rather than being written under pressure at the point of migration.
 */
import { gcm } from '@noble/ciphers/aes.js';
import { describe, expect, it } from 'vitest';
import { AAD_ENCODINGS, CURRENT_AAD_ENCODING, aeadAad, open, seal } from './aead';
import { fromBase64Url } from './bytes';
import type { PrivateKey, PublicKey } from './keys';
import { openRecord, unwrapRecordKey, type EncryptedRecord } from './record';
import { SUITES, type CryptoError, type SuiteId } from './suite';
import FIXTURE from './fixtures/v1-record.json';

/** Rebuild the typed shapes from the committed JSON, which holds byte arrays as base64url. */
function readFixture() {
  const reader: PrivateKey = {
    suite: FIXTURE.reader.suite as SuiteId,
    kind: 'user',
    id: FIXTURE.reader.id,
    classical: fromBase64Url(FIXTURE.reader.classical),
    postQuantum: fromBase64Url(FIXTURE.reader.postQuantum),
  };
  const readerPublic: PublicKey = {
    suite: FIXTURE.readerPublic.suite as SuiteId,
    kind: 'user',
    id: FIXTURE.readerPublic.id,
    classical: fromBase64Url(FIXTURE.readerPublic.classical),
    postQuantum: fromBase64Url(FIXTURE.readerPublic.postQuantum),
  };
  const record: EncryptedRecord = {
    suite: FIXTURE.record.suite as SuiteId,
    metadata: FIXTURE.record.metadata,
    sealed: {
      suite: FIXTURE.record.sealed.suite as SuiteId,
      nonce: fromBase64Url(FIXTURE.record.sealed.nonce),
      ciphertext: fromBase64Url(FIXTURE.record.sealed.ciphertext),
    },
    wrappedKeys: FIXTURE.record.wrappedKeys.map((wrap) => ({
      suite: wrap.suite as SuiteId,
      principalId: wrap.principalId,
      ephemeralClassical: fromBase64Url(wrap.ephemeralClassical),
      kemCiphertext: fromBase64Url(wrap.kemCiphertext),
      nonce: fromBase64Url(wrap.nonce),
      wrapped: fromBase64Url(wrap.wrapped),
    })),
  };
  return { reader, readerPublic, record };
}

describe('a record sealed under v1', () => {
  it('still opens, which is the only reason this fixture exists', () => {
    const { reader, readerPublic, record } = readFixture();
    expect(openRecord(record, reader, readerPublic)).toBe(FIXTURE.plaintext);
  });

  it('was sealed under a suite this build still knows', () => {
    expect(SUITES).toContain(FIXTURE.record.suite);
  });

  it('carries the shapes FIPS 203 specifies, so the wire format has not shifted', () => {
    const { record } = readFixture();
    for (const wrap of record.wrappedKeys) {
      expect(wrap.ephemeralClassical.length).toBe(32);
      expect(wrap.kemCiphertext.length).toBe(1088);
      expect(wrap.nonce.length).toBe(12);
    }
    expect(record.sealed.nonce.length).toBe(12);
  });

  it('still wraps to escrow, so a lawful disclosure could still reach it', () => {
    const { record } = readFixture();
    expect(record.wrappedKeys.map((wrap) => wrap.principalId)).toContain('escrow');
  });

  it('was sealed under the v1 additional authenticated data, and would not open under v2 alone', () => {
    // The point of the encoding list. On 03 September 2026 the classification field stopped being a
    // single value that conflated the Government Security Classification with access restriction and
    // became two properties, so the domain separator moved. A fixture that opened under both would
    // prove nothing, so this asserts the v2 encoding genuinely fails and the v1 one genuinely works.
    const { reader, readerPublic, record } = readFixture();
    const contentKey = unwrapRecordKey(record, reader, readerPublic);
    const context = { recordId: record.metadata.id, classification: record.metadata.classification, generation: record.metadata.generation };

    expect(() => gcm(contentKey, record.sealed.nonce, aeadAad(context, 'v2')).decrypt(record.sealed.ciphertext)).toThrow();
    expect(gcm(contentKey, record.sealed.nonce, aeadAad(context, 'v1')).decrypt(record.sealed.ciphertext)).toBeInstanceOf(Uint8Array);
  });

  it('seals new records under the current encoding, and opens them without falling back', () => {
    const key = new Uint8Array(32).fill(7);
    const context = { recordId: 'prc_new', classification: 'official/sensitive/restricted', generation: 1 };
    const sealed = seal(key, new Uint8Array([1, 2, 3]), context);
    expect(CURRENT_AAD_ENCODING).toBe('v2');
    expect(AAD_ENCODINGS[0]).toBe(CURRENT_AAD_ENCODING);
    expect(gcm(key, sealed.nonce, aeadAad(context, 'v2')).decrypt(sealed.ciphertext)).toEqual(new Uint8Array([1, 2, 3]));
    expect(open(key, sealed, context)).toEqual(new Uint8Array([1, 2, 3]));
  });

  it('still refuses a reader who was never wrapped to it', () => {
    const { record, readerPublic } = readFixture();
    const stranger: PrivateKey = { ...readFixture().reader, id: 'usr_stranger' };
    try {
      unwrapRecordKey(record, stranger, readerPublic);
      expect.unreachable('a stranger should hold no key');
    } catch (error) {
      expect((error as CryptoError).reason).toBe('no-wrapped-key');
    }
  });
});
