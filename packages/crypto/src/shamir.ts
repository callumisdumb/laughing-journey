/**
 * Shamir's Secret Sharing over GF(256), for the escrow key.
 *
 * The escrow key is what makes the design lawful: it is how the controller answers a subject access
 * request, complies with a sheriff's order, and how a practitioner recovers a lost device. It is
 * also, held whole by one person, the single point at which the whole scheme collapses into "trust
 * the administrator".
 *
 * So it is never held whole. It is split two-of-five, and the five holders sit in five different
 * organisations: the MAPPA Coordinator, the Chief Social Work Officer, the health board Caldicott
 * guardian, the police public protection superintendent and the Adult Protection Committee lead
 * officer. Reconstruction needs two of them, from different organisations, and produces a signed
 * audit entry naming both.
 *
 * The residual risk is stated plainly in docs/THREAT-MODEL.md 1.9 and is not hedged: two colluding
 * holders can read anything. That is a governance control rather than a cryptographic one, and it is
 * why the holders are seeded across five organisations with different lines of accountability rather
 * than five people in one council.
 *
 * The arithmetic is GF(256) with the AES polynomial, the standard construction. Splitting is
 * information-theoretically secure below the threshold: one share tells an attacker nothing at all
 * about the secret, not merely that it is hard to compute.
 */
import { randomBytes } from './bytes';
import { CryptoError } from './suite';

/** The seeded threshold and share count. Two of five, per docs/THREAT-MODEL.md 1.9. */
export const ESCROW_THRESHOLD = 2;
export const ESCROW_SHARES = 5;

export interface Share {
  /** The share's x coordinate, 1 to 255. Never 0: that is the secret itself. */
  index: number;
  /** One y coordinate per byte of the secret. */
  value: Uint8Array;
}

/**
 * GF(256) multiplication with the AES polynomial x^8 + x^4 + x^3 + x + 1.
 *
 * Written as a loop rather than a table lookup because a table indexed by a secret is a cache timing
 * side channel, and this runs on the same machine as the browser the practitioner is using.
 */
function gfMul(a: number, b: number): number {
  let result = 0;
  let x = a;
  let y = b;
  for (let i = 0; i < 8; i += 1) {
    result ^= (y & 1) * x;
    const high = x & 0x80;
    x = (x << 1) & 0xff;
    if (high) x ^= 0x1b;
    y >>= 1;
  }
  return result;
}

/** Multiplicative inverse in GF(256) by exponentiation: a^254 = a^-1 for a != 0. */
function gfInv(a: number): number {
  if (a === 0) throw new CryptoError('bad-length', 'GF(256) has no inverse for zero');
  let result = 1;
  for (let i = 0; i < 254; i += 1) result = gfMul(result, a);
  return result;
}

/**
 * Split a secret into `shares` pieces, any `threshold` of which reconstruct it.
 *
 * Each byte of the secret is the constant term of its own random polynomial of degree
 * `threshold - 1`, and a share is that polynomial evaluated at the share's index.
 */
export function split(secret: Uint8Array, threshold = ESCROW_THRESHOLD, shares = ESCROW_SHARES): Share[] {
  if (secret.length === 0) throw new CryptoError('bad-length', 'Nothing to split');
  if (threshold < 2) throw new CryptoError('bad-length', 'A threshold below two is not split control');
  if (shares < threshold) throw new CryptoError('bad-length', `Cannot make ${shares} shares with a threshold of ${threshold}`);
  if (shares > 255) throw new CryptoError('bad-length', 'GF(256) allows at most 255 shares');

  // One random coefficient per byte per degree above the constant term.
  const coefficients = Array.from({ length: threshold - 1 }, () => randomBytes(secret.length));
  const out: Share[] = [];
  for (let index = 1; index <= shares; index += 1) {
    const value = new Uint8Array(secret.length);
    for (let byte = 0; byte < secret.length; byte += 1) {
      // Horner's method from the highest coefficient down to the secret byte.
      let accumulator = 0;
      for (let degree = threshold - 2; degree >= 0; degree -= 1) {
        accumulator = gfMul(accumulator, index) ^ (coefficients[degree]?.[byte] ?? 0);
      }
      value[byte] = gfMul(accumulator, index) ^ (secret[byte] ?? 0);
    }
    out.push({ index, value });
  }
  return out;
}

/**
 * Reconstruct a secret from at least `threshold` shares, by Lagrange interpolation at x = 0.
 *
 * Duplicate indices are refused rather than ignored: presenting the same share twice is either a bug
 * or an attempt to meet the threshold with one holder's material, and both should stop here.
 */
export function combine(shares: readonly Share[], threshold = ESCROW_THRESHOLD): Uint8Array {
  if (shares.length < threshold) throw new CryptoError('threshold-not-met', `Reconstruction needs ${threshold} shares, got ${shares.length}`);
  const indices = shares.map((share) => share.index);
  if (new Set(indices).size !== indices.length) throw new CryptoError('duplicate-share', 'The same share was presented more than once');
  const length = shares[0]?.value.length ?? 0;
  if (shares.some((share) => share.value.length !== length)) throw new CryptoError('bad-length', 'Shares are of different lengths');

  const used = shares.slice(0, threshold);
  const secret = new Uint8Array(length);
  for (let byte = 0; byte < length; byte += 1) {
    let total = 0;
    for (const [i, share] of used.entries()) {
      // The Lagrange basis polynomial for this share, evaluated at zero.
      let numerator = 1;
      let denominator = 1;
      for (const [j, other] of used.entries()) {
        if (i === j) continue;
        numerator = gfMul(numerator, other.index);
        denominator = gfMul(denominator, share.index ^ other.index);
      }
      total ^= gfMul(share.value[byte] ?? 0, gfMul(numerator, gfInv(denominator)));
    }
    secret[byte] = total;
  }
  return secret;
}
