/**
 * Key derivation: HKDF for keys derived from keys, Argon2id for keys derived from a passphrase.
 *
 * The two are not interchangeable and confusing them is a common mistake. HKDF is fast by design and
 * is correct where the input already has full entropy: a shared secret, a device key. A passphrase
 * has nothing like full entropy, so stretching it needs a function that is deliberately expensive in
 * both time and memory, which is what Argon2id is for. Neither scrypt nor PBKDF2 is used: Argon2id
 * won the Password Hashing Competition and is the current recommendation.
 *
 * Every derivation carries a distinct info string from `KDF_INFO`. One derived key is never used for
 * two purposes, because a key that is safe in one context can become an oracle in another.
 */
import { argon2id } from '@noble/hashes/argon2.js';
import { hkdf } from '@noble/hashes/hkdf.js';
import { hmac } from '@noble/hashes/hmac.js';
import { sha256 } from '@noble/hashes/sha2.js';
import { CONTENT_KEY_BYTES } from './aead';
import { utf8 } from './bytes';
import { CryptoError, KDF_INFO, type KdfPurpose } from './suite';

/**
 * Argon2id parameters. Configuration rather than constants, because the right cost depends on the
 * hardware the product runs on and a value that is right for a 2026 laptop will be wrong later.
 * These are the seeded values; the deployment tunes them upwards, never down.
 */
export interface Argon2Parameters {
  /** Memory cost in KiB. 64 MiB. */
  memoryKib: number;
  /** Time cost, in passes over the memory. */
  passes: number;
  /** Parallelism. */
  lanes: number;
}

export const ARGON2_PARAMETERS: Argon2Parameters = { memoryKib: 65_536, passes: 3, lanes: 4 };

/** Derive a key from key material that already has full entropy. */
export function deriveKey(material: Uint8Array, salt: Uint8Array, purpose: KdfPurpose, length = CONTENT_KEY_BYTES): Uint8Array {
  if (material.length === 0) throw new CryptoError('bad-length', 'Nothing to derive from');
  return hkdf(sha256, material, salt, utf8(KDF_INFO[purpose]), length);
}

/**
 * Stretch a recovery passphrase. Slow on purpose: the cost is what stands between a leaked salt and
 * an offline dictionary attack.
 */
export function deriveFromPassphrase(passphrase: string, salt: Uint8Array, parameters: Argon2Parameters = ARGON2_PARAMETERS): Uint8Array {
  if (passphrase.length === 0) throw new CryptoError('bad-length', 'A recovery passphrase cannot be empty');
  return argon2id(utf8(passphrase), salt, { m: parameters.memoryKib, t: parameters.passes, p: parameters.lanes, dkLen: CONTENT_KEY_BYTES });
}

/**
 * A blind index tag: HMAC of a normalised value under a key only clients hold.
 *
 * This is the one place the design lets a server match on a value it cannot read, and it costs
 * something real. A blind index reveals equality: an operator can see that two records share a
 * value, and on a low-entropy field can mount a frequency attack. So it is applied only where an
 * exact match is the whole query, which means reference numbers and dates of birth bucketed to the
 * month, and never to names. docs/THREAT-MODEL.md section 4 states the leak; nothing here claims to
 * have solved encrypted search.
 */
export function blindIndexTag(value: string, indexKey: Uint8Array): Uint8Array {
  const normalised = value.trim().toLowerCase().replace(/\s+/g, ' ');
  return hmac(sha256, indexKey, utf8(`${KDF_INFO.blindIndex}:${normalised}`));
}
