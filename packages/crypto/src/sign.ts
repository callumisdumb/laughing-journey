/**
 * Signatures, with two horizons.
 *
 * Ed25519 for everything, and ML-DSA-65 alongside it for anything that must still verify in decades:
 * audit entries, meeting minutes and disclosure decisions. An audit entry written in 2026 may be read
 * in a Learning Review in 2050, and a signature that cannot be verified then is worth nothing.
 *
 * Both signatures cover the same message and both must verify. A caller cannot accept one and ignore
 * the other, because a verifier that accepted either would be no stronger than the weaker of the two.
 */
import { ed25519 } from '@noble/curves/ed25519.js';
import { ml_dsa65 } from '@noble/post-quantum/ml-dsa.js';
import type { SigningKeyPair, VerifyingKey } from './keys';
import { CryptoError, type SuiteId } from './suite';

/** How long a signature must remain verifiable, which decides whether ML-DSA is added. */
export type SignatureHorizon = 'short' | 'long';

export interface Signature {
  suite: SuiteId;
  /** Who signed. Opaque, like every other principal identifier. */
  signerId: string;
  horizon: SignatureHorizon;
  /** Ed25519 signature, 64 bytes. */
  classical: Uint8Array;
  /** ML-DSA-65 signature, present only at the long horizon. About 3.3 kB. */
  longTerm?: Uint8Array;
}

/**
 * Sign a message.
 *
 * At the long horizon this produces two signatures and costs about 3.3 kB, which is why it is not
 * the default: applying it to every read in a busy audit log would be paying for a property that
 * only some entries need.
 */
export function sign(message: Uint8Array, key: SigningKeyPair, horizon: SignatureHorizon = 'short'): Signature {
  const classical = ed25519.sign(message, key.classicalPrivate);
  if (horizon === 'short') return { suite: key.suite, signerId: key.id, horizon, classical };
  return { suite: key.suite, signerId: key.id, horizon, classical, longTerm: ml_dsa65.sign(message, key.longTermPrivate) };
}

/**
 * Verify a signature. Both halves must verify at the long horizon; a missing long-term half on a
 * long-horizon signature is a failure, not a downgrade to the short horizon.
 */
export function verify(message: Uint8Array, signature: Signature, key: VerifyingKey): boolean {
  if (signature.signerId !== key.id) return false;
  if (!ed25519.verify(signature.classical, message, key.classicalPublic)) return false;
  if (signature.horizon === 'short') return true;
  if (!signature.longTerm) return false;
  return ml_dsa65.verify(signature.longTerm, message, key.longTermPublic);
}

/** Verify, throwing rather than returning false, for callers that treat a bad signature as fatal. */
export function assertVerified(message: Uint8Array, signature: Signature, key: VerifyingKey): void {
  if (!verify(message, signature, key)) throw new CryptoError('bad-signature', `Signature from ${signature.signerId} did not verify`);
}
