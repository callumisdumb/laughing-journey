/**
 * Hybrid key wrapping: how a content key reaches exactly the principals entitled to it.
 *
 * Wrapping is where the whole design lives. A record's content key is generated once and wrapped
 * separately to each entitled principal's public key. Entitlement comes from the need-to-know
 * resolver, which emits a list of principal ids; this module turns that list into wrapped keys. A
 * principal not on the list gets no wrapped key, and there is nothing for them to attempt: that is
 * the full defence against the curious colleague and the unentitled agency in
 * docs/THREAT-MODEL.md 1.1 and 1.2.
 *
 * Each wrap is hybrid. An ephemeral X25519 key agreement and an ML-KEM-768 encapsulation are both
 * performed against the recipient, and both shared secrets are fed into one HKDF extraction. The
 * derived key encrypts the content key under AES-256-GCM. An attacker must break both X25519 and
 * ML-KEM-768 to recover the content key, so the wrap survives a quantum computer and it survives an
 * implementation flaw in the newer of the two primitives.
 *
 * The ephemeral public key and the ML-KEM ciphertext travel with the wrap, which is why a wrapped
 * key is about 1.2 kB rather than 48 bytes. At the scale of one partnership's caseload that cost is
 * paid once per principal per record and is not worth optimising away.
 */
import { gcm } from '@noble/ciphers/aes.js';
import { x25519 } from '@noble/curves/ed25519.js';
import { hkdf } from '@noble/hashes/hkdf.js';
import { sha256 } from '@noble/hashes/sha2.js';
import { ml_kem768 } from '@noble/post-quantum/ml-kem.js';
import { CONTENT_KEY_BYTES, NONCE_BYTES } from './aead';
import { concat, randomBytes, utf8 } from './bytes';
import type { PrincipalId, PrivateKey, PublicKey } from './keys';
import { CURRENT_SUITE, CryptoError, KDF_INFO, type SuiteId } from './suite';

/** One principal's copy of a content key. A record carries one of these per entitled principal. */
export interface WrappedKey {
  suite: SuiteId;
  /** Who can open it. Opaque; see docs/THREAT-MODEL.md section 3 on what this leaks. */
  principalId: PrincipalId;
  /** Ephemeral X25519 public key for this wrap, 32 bytes. */
  ephemeralClassical: Uint8Array;
  /** ML-KEM-768 ciphertext for this wrap, 1088 bytes. */
  kemCiphertext: Uint8Array;
  nonce: Uint8Array;
  /** The content key, encrypted under the derived wrapping key, with its GCM tag. */
  wrapped: Uint8Array;
}

/**
 * Derive the wrapping key from both shared secrets.
 *
 * Both secrets go into the HKDF input keying material, along with the recipient's public keys and
 * the ephemeral public key, so the derived key is bound to this exact pairing. A wrap cannot be
 * replayed against a different recipient, and the info string is specific to key wrapping so this
 * key can never collide with the local store key or a blind index key.
 */
function deriveWrappingKey(classicalShared: Uint8Array, postQuantumShared: Uint8Array, recipient: PublicKey, ephemeralPublic: Uint8Array): Uint8Array {
  const ikm = concat(classicalShared, postQuantumShared);
  const salt = concat(ephemeralPublic, recipient.classical, recipient.postQuantum);
  return hkdf(sha256, ikm, salt, utf8(KDF_INFO.keyWrap), CONTENT_KEY_BYTES);
}

/** Wrap a content key to one principal. */
export function wrapKey(contentKey: Uint8Array, recipient: PublicKey, suite: SuiteId = CURRENT_SUITE): WrappedKey {
  if (contentKey.length !== CONTENT_KEY_BYTES) throw new CryptoError('bad-length', `A content key is ${CONTENT_KEY_BYTES} bytes, got ${contentKey.length}`);
  const ephemeralPrivate = x25519.utils.randomSecretKey();
  const ephemeralPublic = x25519.getPublicKey(ephemeralPrivate);
  const classicalShared = x25519.getSharedSecret(ephemeralPrivate, recipient.classical);
  const { cipherText, sharedSecret } = ml_kem768.encapsulate(recipient.postQuantum, randomBytes(32));
  const wrappingKey = deriveWrappingKey(classicalShared, sharedSecret, recipient, ephemeralPublic);
  const nonce = randomBytes(NONCE_BYTES);
  const wrapped = gcm(wrappingKey, nonce, utf8(recipient.id)).encrypt(contentKey);
  return { suite, principalId: recipient.id, ephemeralClassical: ephemeralPublic, kemCiphertext: cipherText, nonce, wrapped };
}

/** Wrap a content key to every entitled principal at once. The list comes from the resolver. */
export function wrapToAll(contentKey: Uint8Array, recipients: readonly PublicKey[], suite: SuiteId = CURRENT_SUITE): WrappedKey[] {
  return recipients.map((recipient) => wrapKey(contentKey, recipient, suite));
}

/**
 * Recover a content key from one wrap.
 *
 * Throws `unwrap-failed` where the key does not open it. A caller must treat that as "you are not
 * entitled to this record" and render the restricted state; it is an ordinary, expected outcome
 * rather than an error condition, because the whole design is built on unentitled readers holding
 * nothing that works.
 */
export function unwrapKey(wrapped: WrappedKey, recipient: PrivateKey, recipientPublic: PublicKey): Uint8Array {
  const classicalShared = x25519.getSharedSecret(recipient.classical, wrapped.ephemeralClassical);
  const postQuantumShared = ml_kem768.decapsulate(wrapped.kemCiphertext, recipient.postQuantum);
  const wrappingKey = deriveWrappingKey(classicalShared, postQuantumShared, recipientPublic, wrapped.ephemeralClassical);
  try {
    return gcm(wrappingKey, wrapped.nonce, utf8(recipient.id)).decrypt(wrapped.wrapped);
  } catch {
    throw new CryptoError('unwrap-failed', `No content key for principal ${recipient.id}`);
  }
}

/**
 * The wrap for a principal, or undefined. Separating "there is no wrap for you" from "the wrap did
 * not open" matters: the first is the normal unentitled case, the second means something is wrong.
 */
export function wrapFor(wraps: readonly WrappedKey[], principalId: PrincipalId): WrappedKey | undefined {
  return wraps.find((wrap) => wrap.principalId === principalId);
}
