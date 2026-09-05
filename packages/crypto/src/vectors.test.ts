/**
 * Known-answer tests against published vectors.
 *
 * Round-trip tests prove a package is self-consistent, which is not the same as correct: a package
 * that encrypted and decrypted under its own private mistake would pass every round trip and produce
 * ciphertext nothing else in the world could read. These tests check the primitives against the
 * numbers in the standards, so a wrong curve, a wrong hash or a wrong mode is caught here rather
 * than in 2031 when a record has to be migrated to a new suite.
 *
 * Sources, all quoted from the published documents:
 *   RFC 7748 section 6.1 (X25519 Diffie-Hellman)
 *   RFC 8032 section 7.1 (Ed25519 test vector 1)
 *   RFC 5869 appendix A.1 (HKDF-SHA-256 basic test case)
 *   NIST CAVP GCM test vectors, 256-bit key
 *   FIPS 180-4 SHA-256 one-block message
 */
import { gcm } from '@noble/ciphers/aes.js';
import { ed25519, x25519 } from '@noble/curves/ed25519.js';
import { hkdf } from '@noble/hashes/hkdf.js';
import { sha256 } from '@noble/hashes/sha2.js';
import { ml_dsa65 } from '@noble/post-quantum/ml-dsa.js';
import { ml_kem768 } from '@noble/post-quantum/ml-kem.js';
import { describe, expect, it } from 'vitest';
import { utf8 } from './bytes';

/** Hex to bytes, for the vectors, which are all published as hex. */
function hex(text: string): Uint8Array {
  const clean = text.replace(/\s+/g, '');
  const out = new Uint8Array(clean.length / 2);
  for (let i = 0; i < out.length; i += 1) out[i] = Number.parseInt(clean.slice(i * 2, i * 2 + 2), 16);
  return out;
}

function toHex(bytes: Uint8Array): string {
  return [...bytes].map((b) => b.toString(16).padStart(2, '0')).join('');
}

describe('X25519, RFC 7748 section 6.1', () => {
  // Alice and Bob's key pairs and the shared secret they must both compute.
  const alicePrivate = hex('77076d0a7318a57d3c16c17251b26645df4c2f87ebc0992ab177fba51db92c2a');
  const alicePublic = hex('8520f0098930a754748b7ddcb43ef75a0dbf3a0d26381af4eba4a98eaa9b4e6a');
  const bobPrivate = hex('5dab087e624a8a4b79e17f8b83800ee66f3bb1292618b6fd1c2f8b27ff88e0eb');
  const bobPublic = hex('de9edb7d7b7dc1b4d35b61c2ece435373f8343c85b78674dadfc7e146f882b4f');
  const shared = hex('4a5d9d5ba4ce2de1728e3bf480350f25e07e21c947d19e3376f09b3c1e161742');

  it('derives the published public keys', () => {
    expect(toHex(x25519.getPublicKey(alicePrivate))).toBe(toHex(alicePublic));
    expect(toHex(x25519.getPublicKey(bobPrivate))).toBe(toHex(bobPublic));
  });

  it('derives the published shared secret from both sides', () => {
    expect(toHex(x25519.getSharedSecret(alicePrivate, bobPublic))).toBe(toHex(shared));
    expect(toHex(x25519.getSharedSecret(bobPrivate, alicePublic))).toBe(toHex(shared));
  });
});

describe('Ed25519, RFC 8032 section 7.1 test vector 1', () => {
  const secret = hex('9d61b19deffd5a60ba844af492ec2cc44449c5697b326919703bac031cae7f60');
  const publicKey = hex('d75a980182b10ab7d54bfed3c964073a0ee172f3daa62325af021a68f707511a');
  const signature = hex(
    'e5564300c360ac729086e2cc806e828a84877f1eb8e5d974d873e065224901555fb8821590a33bacc61e39701cf9b46bd25bf5f0595bbe24655141438e7a100b',
  );

  it('derives the published public key', () => {
    expect(toHex(ed25519.getPublicKey(secret))).toBe(toHex(publicKey));
  });

  it('produces and verifies the published signature over the empty message', () => {
    expect(toHex(ed25519.sign(new Uint8Array(0), secret))).toBe(toHex(signature));
    expect(ed25519.verify(signature, new Uint8Array(0), publicKey)).toBe(true);
  });

  it('rejects the signature over a different message', () => {
    expect(ed25519.verify(signature, utf8('not the empty message'), publicKey)).toBe(false);
  });
});

describe('HKDF-SHA-256, RFC 5869 appendix A.1', () => {
  const ikm = hex('0b0b0b0b0b0b0b0b0b0b0b0b0b0b0b0b0b0b0b0b0b0b');
  const salt = hex('000102030405060708090a0b0c');
  const info = hex('f0f1f2f3f4f5f6f7f8f9');
  const okm = hex('3cb25f25faacd57a90434f64d0362f2a2d2d0a90cf1a5a4c5db02d56ecc4c5bf34007208d5b887185865');

  it('derives the published output keying material', () => {
    expect(toHex(hkdf(sha256, ikm, salt, info, 42))).toBe(toHex(okm));
  });
});

describe('SHA-256, FIPS 180-4', () => {
  it('hashes the one-block message "abc"', () => {
    expect(toHex(sha256(utf8('abc')))).toBe('ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad');
  });

  it('hashes the empty message', () => {
    expect(toHex(sha256(new Uint8Array(0)))).toBe('e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855');
  });
});

describe('AES-256-GCM, NIST CAVP vectors', () => {
  it('encrypts the all-zero plaintext under the all-zero key and nonce', () => {
    // Key 256 bits of zero, IV 96 bits of zero, no AAD, 128-bit plaintext of zero.
    const key = hex('0000000000000000000000000000000000000000000000000000000000000000');
    const nonce = hex('000000000000000000000000');
    const plaintext = hex('00000000000000000000000000000000');
    const out = gcm(key, nonce).encrypt(plaintext);
    // Ciphertext followed by the 16-byte tag, which is how noble returns it.
    expect(toHex(out.slice(0, 16))).toBe('cea7403d4d606b6e074ec5d3baf39d18');
    expect(toHex(out.slice(16))).toBe('d0d1c8a799996bf0265b98b5d48ab919');
  });

  it('produces the published tag for an empty plaintext with no AAD', () => {
    const key = hex('0000000000000000000000000000000000000000000000000000000000000000');
    const nonce = hex('000000000000000000000000');
    expect(toHex(gcm(key, nonce).encrypt(new Uint8Array(0)))).toBe('530f8afbc74536b9a963b4f1c4cb738b');
  });

  it('refuses a ciphertext whose additional authenticated data differs', () => {
    const key = hex('0000000000000000000000000000000000000000000000000000000000000000');
    const nonce = hex('000000000000000000000000');
    const sealed = gcm(key, nonce, utf8('context A')).encrypt(utf8('hello'));
    expect(() => gcm(key, nonce, utf8('context B')).decrypt(sealed)).toThrow();
  });
});

describe('ML-KEM-768, FIPS 203 shapes and round trip', () => {
  it('produces keys and ciphertexts of the sizes FIPS 203 specifies', () => {
    const pair = ml_kem768.keygen();
    expect(pair.publicKey.length).toBe(1184);
    expect(pair.secretKey.length).toBe(2400);
    const { cipherText, sharedSecret } = ml_kem768.encapsulate(pair.publicKey);
    expect(cipherText.length).toBe(1088);
    expect(sharedSecret.length).toBe(32);
  });

  it('decapsulates to the shared secret that was encapsulated', () => {
    const pair = ml_kem768.keygen();
    const { cipherText, sharedSecret } = ml_kem768.encapsulate(pair.publicKey);
    expect(toHex(ml_kem768.decapsulate(cipherText, pair.secretKey))).toBe(toHex(sharedSecret));
  });

  it('is deterministic given the same seed, which is what makes a vector possible at all', () => {
    const seed = new Uint8Array(64).fill(7);
    expect(toHex(ml_kem768.keygen(seed).publicKey)).toBe(toHex(ml_kem768.keygen(seed).publicKey));
  });

  it('decapsulates a corrupted ciphertext to a different secret rather than failing', () => {
    // FIPS 203 specifies implicit rejection: a bad ciphertext yields an unrelated secret, not an
    // error. Anything relying on decapsulation failing to detect tampering would be wrong, which is
    // why the wrap in this package puts the real check on the AES-GCM tag.
    const pair = ml_kem768.keygen();
    const { cipherText, sharedSecret } = ml_kem768.encapsulate(pair.publicKey);
    const tampered = Uint8Array.from(cipherText);
    tampered[0] = (tampered[0] ?? 0) ^ 0xff;
    expect(toHex(ml_kem768.decapsulate(tampered, pair.secretKey))).not.toBe(toHex(sharedSecret));
  });
});

describe('ML-DSA-65, FIPS 204 shapes and round trip', () => {
  it('produces keys of the sizes FIPS 204 specifies', () => {
    const pair = ml_dsa65.keygen();
    expect(pair.publicKey.length).toBe(1952);
    expect(pair.secretKey.length).toBe(4032);
  });

  it('signs and verifies, and rejects a changed message', () => {
    const pair = ml_dsa65.keygen();
    const message = utf8('MAPPA minute, 02 Sep 2026');
    const signature = ml_dsa65.sign(message, pair.secretKey);
    expect(ml_dsa65.verify(signature, message, pair.publicKey)).toBe(true);
    expect(ml_dsa65.verify(signature, utf8('MAPPA minute, 03 Sep 2026'), pair.publicKey)).toBe(false);
  });
});
