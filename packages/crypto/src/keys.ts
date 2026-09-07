/**
 * Key pairs for every principal in the hierarchy.
 *
 * A principal is anything a content key can be wrapped to: a device, a user, a role in an agency, an
 * agency, a case, or the escrow key. They all share one key pair shape because wrapping does not
 * care what a key belongs to, which is what lets the need-to-know resolver emit a list of principal
 * ids without knowing anything about cryptography.
 *
 * Every encryption key pair is hybrid: an X25519 pair and an ML-KEM-768 pair carried together. Both
 * shared secrets go into HKDF, so the wrap is secure if either component holds. ML-KEM is not used
 * alone; that is the NCSC's expected transitional posture and it also means an implementation flaw
 * in the newer primitive does not cost the whole scheme. The reasoning specific to this product is
 * in docs/THREAT-MODEL.md 1.7: safeguarding records outlive the cryptography that protects them by
 * decades, so harvest-now-decrypt-later is a real threat here rather than a theoretical one.
 *
 * Signing keys are separate from encryption keys and always have been: one key, one purpose.
 */
import { ed25519, x25519 } from '@noble/curves/ed25519.js';
import { ml_dsa65 } from '@noble/post-quantum/ml-dsa.js';
import { ml_kem768 } from '@noble/post-quantum/ml-kem.js';
import { randomBytes } from './bytes';
import { CURRENT_SUITE, CryptoError, type SuiteId } from './suite';

/** What a key belongs to. Wrapping treats them all alike; the hierarchy is who wraps to whom. */
export const PRINCIPAL_KINDS = ['device', 'user', 'role', 'agency', 'case', 'escrow'] as const;
export type PrincipalKind = (typeof PRINCIPAL_KINDS)[number];

/**
 * A principal's opaque identifier. Never a name, an email address or a staff number: the platform
 * operator sees these in the clear on every record, so they are the metadata leak in
 * docs/THREAT-MODEL.md section 3 and are kept meaningless on purpose.
 */
export type PrincipalId = string;

/** The public half, which is what a record carries and what the operator may see. */
export interface PublicKey {
  suite: SuiteId;
  kind: PrincipalKind;
  id: PrincipalId;
  /** X25519 public key, 32 bytes. */
  classical: Uint8Array;
  /** ML-KEM-768 encapsulation key, 1184 bytes. */
  postQuantum: Uint8Array;
}

/** The private half. Never leaves the device for a device key, and is wrapped for every other kind. */
export interface PrivateKey {
  suite: SuiteId;
  kind: PrincipalKind;
  id: PrincipalId;
  classical: Uint8Array;
  postQuantum: Uint8Array;
}

export interface KeyPair {
  publicKey: PublicKey;
  privateKey: PrivateKey;
}

/** A signing pair. Ed25519 for now, ML-DSA-65 for anything that must verify in decades. */
export interface SigningKeyPair {
  suite: SuiteId;
  id: PrincipalId;
  classicalPublic: Uint8Array;
  classicalPrivate: Uint8Array;
  longTermPublic: Uint8Array;
  longTermPrivate: Uint8Array;
}

/** Public halves of a signing pair, which is all a verifier needs. A leaver's stay valid forever. */
export interface VerifyingKey {
  suite: SuiteId;
  id: PrincipalId;
  classicalPublic: Uint8Array;
  longTermPublic: Uint8Array;
}

/**
 * A fresh hybrid encryption key pair.
 *
 * `id` is supplied rather than generated here so the caller controls the opaque identifier scheme
 * and its rotation. Nothing in this package derives an id from a name.
 */
export function generateKeyPair(kind: PrincipalKind, id: PrincipalId, suite: SuiteId = CURRENT_SUITE): KeyPair {
  if (!id) throw new CryptoError('bad-length', 'A principal needs an identifier');
  const classicalPrivate = x25519.utils.randomSecretKey();
  const classicalPublic = x25519.getPublicKey(classicalPrivate);
  const kem = ml_kem768.keygen(randomBytes(64));
  return {
    publicKey: { suite, kind, id, classical: classicalPublic, postQuantum: kem.publicKey },
    privateKey: { suite, kind, id, classical: classicalPrivate, postQuantum: kem.secretKey },
  };
}

export function generateSigningKeyPair(id: PrincipalId, suite: SuiteId = CURRENT_SUITE): SigningKeyPair {
  const classicalPrivate = ed25519.utils.randomSecretKey();
  const dsa = ml_dsa65.keygen(randomBytes(32));
  return {
    suite,
    id,
    classicalPublic: ed25519.getPublicKey(classicalPrivate),
    classicalPrivate,
    longTermPublic: dsa.publicKey,
    longTermPrivate: dsa.secretKey,
  };
}

export function verifyingKey(pair: SigningKeyPair): VerifyingKey {
  return { suite: pair.suite, id: pair.id, classicalPublic: pair.classicalPublic, longTermPublic: pair.longTermPublic };
}

/** The public half of an encryption pair, which is what is published and what a record carries. */
export function publicKeyOf(pair: KeyPair): PublicKey {
  return pair.publicKey;
}
