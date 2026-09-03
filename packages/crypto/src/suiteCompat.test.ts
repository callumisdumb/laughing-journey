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
import { describe, expect, it } from 'vitest';
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
