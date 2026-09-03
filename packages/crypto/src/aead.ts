/**
 * Authenticated encryption: AES-256-GCM with a 96-bit random nonce.
 *
 * Two rules govern everything in this file.
 *
 * A nonce is never reused under a key. GCM fails catastrophically on nonce reuse, far worse than a
 * cipher without authentication would: two messages under one nonce leak the XOR of the plaintexts
 * and, worse, the authentication subkey, which lets an attacker forge. Every content key here is
 * fresh and random, and every nonce is fresh and random, so the birthday bound on 96 bits is not a
 * practical concern; `seal` generates the nonce itself and there is no way for a caller to supply one.
 *
 * The additional authenticated data binds a ciphertext to its context. Without it a ciphertext can
 * be lifted from one record and presented as another, or presented as carrying a lower
 * classification than it does, and the tag would still verify. So the AAD carries the record id, the
 * classification and the key generation number, and `open` fails if any of the three differ from
 * what the caller expects. That turns a silent substitution into a decrypt failure.
 */
import { gcm } from '@noble/ciphers/aes.js';
import { concat, randomBytes, utf8 } from './bytes';
import { CURRENT_SUITE, CryptoError, type SuiteId } from './suite';

/** AES-256 key length in bytes. */
export const CONTENT_KEY_BYTES = 32;
/** GCM nonce length in bytes. 96 bits is the size GCM is specified and analysed for. */
export const NONCE_BYTES = 12;

/** The context a ciphertext is bound to. Changing any field makes the ciphertext fail to open. */
export interface AeadContext {
  /** The record this ciphertext belongs to. */
  recordId: string;
  /**
   * The classification the record carries, canonically encoded by the caller, so a ciphertext cannot
   * be moved onto a record with a different marking or a different access restriction.
   */
  classification: string;
  /** Which generation of the content key this was sealed under; rotation increments it. */
  generation: number;
}

/**
 * AAD encodings, newest first. `open` tries each in turn; `seal` always writes the current one.
 *
 * v1 was sealed before the classification split of 03 September 2026, when the classification field
 * carried a single value from an enum that conflated the Government Security Classification with
 * access restriction. v2 carries the two separately, so the same field means something different.
 * The field layout did not change; the meaning did, which is exactly when a domain separator has to
 * move. Records sealed under v1 keep their own encoding in their metadata and still open, which is
 * what this list is for.
 */
export const AAD_ENCODINGS = ['v2', 'v1'] as const;
export type AadEncoding = (typeof AAD_ENCODINGS)[number];

/** What `seal` writes. Never changed in place: a new encoding is added to the front of the list. */
export const CURRENT_AAD_ENCODING: AadEncoding = 'v2';

/** A sealed payload. The nonce travels with it; the key does not. */
export interface Sealed {
  suite: SuiteId;
  nonce: Uint8Array;
  /** Ciphertext with the GCM tag appended, as noble returns it. */
  ciphertext: Uint8Array;
}

/**
 * The additional authenticated data for a context. A single canonical encoding, so that a value
 * containing the separator cannot be made to look like a different context: lengths are prefixed.
 */
export function aeadAad(context: AeadContext, encoding: AadEncoding = CURRENT_AAD_ENCODING): Uint8Array {
  const parts = [context.recordId, context.classification, String(context.generation)];
  const encoded = parts.map((part) => {
    const bytes = utf8(part);
    const length = new Uint8Array(4);
    new DataView(length.buffer).setUint32(0, bytes.length, false);
    return concat(length, bytes);
  });
  return concat(utf8(`person360/${encoding}/aad`), ...encoded);
}

export function generateContentKey(): Uint8Array {
  return randomBytes(CONTENT_KEY_BYTES);
}

/** Encrypt under a fresh random nonce. There is no way to supply one, which is the point. */
export function seal(key: Uint8Array, plaintext: Uint8Array, context: AeadContext, suite: SuiteId = CURRENT_SUITE): Sealed {
  if (key.length !== CONTENT_KEY_BYTES) throw new CryptoError('bad-length', `A content key is ${CONTENT_KEY_BYTES} bytes, got ${key.length}`);
  const nonce = randomBytes(NONCE_BYTES);
  const ciphertext = gcm(key, nonce, aeadAad(context)).encrypt(plaintext);
  return { suite, nonce, ciphertext };
}

/**
 * Decrypt, checking the context. A failure here is either a wrong key or a tampered or substituted
 * ciphertext, and the caller cannot tell which; both are reported as `decrypt-failed` because
 * distinguishing them for the caller would distinguish them for an attacker too.
 */
export function open(key: Uint8Array, sealed: Sealed, context: AeadContext): Uint8Array {
  if (key.length !== CONTENT_KEY_BYTES) throw new CryptoError('bad-length', `A content key is ${CONTENT_KEY_BYTES} bytes, got ${key.length}`);
  if (sealed.nonce.length !== NONCE_BYTES) throw new CryptoError('bad-length', `A nonce is ${NONCE_BYTES} bytes, got ${sealed.nonce.length}`);
  // Every known encoding is tried, newest first, exactly as suite dispatch accepts an older suite
  // identifier. A record written before an encoding change must still open: the alternative is a
  // migration script run against live data, which is how an archive is lost.
  for (const encoding of AAD_ENCODINGS) {
    try {
      return gcm(key, sealed.nonce, aeadAad(context, encoding)).decrypt(sealed.ciphertext);
    } catch {
      continue;
    }
  }
  throw new CryptoError('decrypt-failed', 'The ciphertext did not authenticate under this key and context');
}
