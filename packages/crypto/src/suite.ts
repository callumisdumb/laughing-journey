/**
 * The cipher suite, its identifier and its version.
 *
 * Every piece of key material and every ciphertext this package produces carries the identifier of
 * the suite that made it. That is not decoration. The NCSC's migration timeline (published 20 March
 * 2025) expects high-priority post-quantum upgrades between 2028 and 2031 and complete migration by
 * 2035, so this product will change suite at least once inside the lifetime of the records it holds.
 * A record encrypted in 2026 must still open in 2035 under whatever is current then, and rewrapping
 * to a new suite has to be an ordinary operation rather than a migration script written under
 * pressure.
 *
 * So: the suite is named in the wire format, `decrypt` dispatches on the name it finds rather than
 * on the name it prefers, and a fixture produced under v1 is in the test suite so that the day v2
 * arrives, the thing that proves backward compatibility already exists.
 */

/** Suite identifiers, newest last. A value here is a wire format constant and never changes meaning. */
export const SUITES = ['v1-x25519-mlkem768-aes256gcm'] as const;
export type SuiteId = (typeof SUITES)[number];

/** The suite new material is produced under. Reading is never restricted to it. */
export const CURRENT_SUITE: SuiteId = 'v1-x25519-mlkem768-aes256gcm';

export interface SuiteSpec {
  id: SuiteId;
  /** Human description for the generated inventory and the Security page. */
  description: string;
  /** Classical key agreement, half of the hybrid. */
  classicalKem: 'X25519';
  /** Post-quantum key encapsulation, the other half. */
  postQuantumKem: 'ML-KEM-768';
  /** Bulk content encryption. */
  aead: 'AES-256-GCM';
  /** Key derivation, with a distinct info string per purpose. */
  kdf: 'HKDF-SHA-256';
  /** Signatures with a short verification horizon. */
  signature: 'Ed25519';
  /** Signatures that must still verify in decades. */
  longTermSignature: 'ML-DSA-65';
  /** Passphrase stretching, where a recovery flow needs it. */
  passwordKdf: 'Argon2id';
}

export const SUITE_SPECS: Record<SuiteId, SuiteSpec> = {
  'v1-x25519-mlkem768-aes256gcm': {
    id: 'v1-x25519-mlkem768-aes256gcm',
    description: 'Hybrid X25519 and ML-KEM-768 key establishment through HKDF-SHA-256, AES-256-GCM content encryption, Ed25519 and ML-DSA-65 signatures.',
    classicalKem: 'X25519',
    postQuantumKem: 'ML-KEM-768',
    aead: 'AES-256-GCM',
    kdf: 'HKDF-SHA-256',
    signature: 'Ed25519',
    longTermSignature: 'ML-DSA-65',
    passwordKdf: 'Argon2id',
  },
};

export function suiteSpec(id: SuiteId): SuiteSpec {
  const spec = SUITE_SPECS[id];
  if (!spec) throw new CryptoError('unknown-suite', `No such cipher suite: ${id}`);
  return spec;
}

/**
 * Distinct HKDF info strings, one per purpose. Never derive two keys for two purposes from one info
 * string: that is how a key that is safe in one context becomes an oracle in another.
 */
export const KDF_INFO = {
  /** The key that wraps a content key to one principal. */
  keyWrap: 'person360/v1/key-wrap',
  /** The key that encrypts the local store at rest under the device key. */
  localStore: 'person360/v1/local-store',
  /** The key that HMACs a blind index tag. */
  blindIndex: 'person360/v1/blind-index',
  /** The key derived from a recovery passphrase. */
  recovery: 'person360/v1/recovery',
  /** The key that encrypts an audit entry's free-text detail. */
  auditDetail: 'person360/v1/audit-detail',
} as const;
export type KdfPurpose = keyof typeof KDF_INFO;

/** Every failure this package can produce, named so a caller can tell them apart. */
export type CryptoFailure =
  | 'unknown-suite'
  | 'no-wrapped-key'
  | 'unwrap-failed'
  | 'decrypt-failed'
  | 'bad-length'
  | 'bad-signature'
  | 'threshold-not-met'
  | 'duplicate-share'
  | 'nonce-reuse';

/**
 * A cryptographic failure. Carries a machine-readable reason, because callers have to distinguish
 * "you hold no key for this record" (an ordinary, expected state that the UI renders as restricted)
 * from "the ciphertext did not authenticate" (a tampering signal that must be surfaced loudly).
 */
export class CryptoError extends Error {
  readonly reason: CryptoFailure;

  constructor(reason: CryptoFailure, message: string) {
    super(message);
    this.name = 'CryptoError';
    this.reason = reason;
  }
}
