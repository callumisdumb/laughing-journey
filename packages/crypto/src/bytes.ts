/**
 * Byte handling: random material, encoding, and constant-time comparison.
 *
 * Nothing here is a primitive. `randomBytes` is the platform CSPRNG and nothing else; the encodings
 * are base64url so that key material survives JSON without a second escaping layer; and the
 * comparison is constant time so that comparing a tag cannot be turned into a timing oracle.
 */
import { CryptoError } from './suite';

/**
 * Cryptographically secure random bytes from the platform. WebCrypto in the browser and in the
 * WebView, and `node:crypto`'s WebCrypto in Node and in Vitest. There is no fallback: a product that
 * silently degraded to `Math.random` when `crypto` was missing would be worse than one that stopped.
 */
export function randomBytes(length: number): Uint8Array {
  if (!Number.isInteger(length) || length <= 0) throw new CryptoError('bad-length', `randomBytes needs a positive length, got ${length}`);
  const out = new Uint8Array(length);
  globalThis.crypto.getRandomValues(out);
  return out;
}

const B64URL = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_';

/** base64url without padding, so key material is safe in JSON, a URL and a file name alike. */
export function toBase64Url(bytes: Uint8Array): string {
  let out = '';
  for (let i = 0; i < bytes.length; i += 3) {
    const a = bytes[i] ?? 0;
    const b = bytes[i + 1];
    const c = bytes[i + 2];
    out += B64URL[a >> 2];
    out += B64URL[((a & 3) << 4) | ((b ?? 0) >> 4)];
    if (b === undefined) break;
    out += B64URL[((b & 15) << 2) | ((c ?? 0) >> 6)];
    if (c === undefined) break;
    out += B64URL[c & 63];
  }
  return out;
}

export function fromBase64Url(text: string): Uint8Array {
  const lookup = new Map([...B64URL].map((ch, i) => [ch, i]));
  const out: number[] = [];
  let buffer = 0;
  let bits = 0;
  for (const ch of text) {
    const value = lookup.get(ch);
    if (value === undefined) throw new CryptoError('bad-length', `Not base64url: ${ch}`);
    buffer = (buffer << 6) | value;
    bits += 6;
    if (bits >= 8) {
      bits -= 8;
      out.push((buffer >> bits) & 0xff);
    }
  }
  return Uint8Array.from(out);
}

const encoder = new TextEncoder();
const decoder = new TextDecoder();

export function utf8(text: string): Uint8Array {
  return encoder.encode(text);
}

export function fromUtf8(bytes: Uint8Array): string {
  return decoder.decode(bytes);
}

/** Join byte arrays. Used to build hybrid shared secrets and additional authenticated data. */
export function concat(...parts: Uint8Array[]): Uint8Array {
  const total = parts.reduce((n, part) => n + part.length, 0);
  const out = new Uint8Array(total);
  let offset = 0;
  for (const part of parts) {
    out.set(part, offset);
    offset += part.length;
  }
  return out;
}

/**
 * Compare in time that does not depend on where the arrays differ. Use this wherever a comparison
 * result reaches an attacker, which for this product means blind index tags and hash chain links.
 */
export function equalConstantTime(a: Uint8Array, b: Uint8Array): boolean {
  if (a.length !== b.length) return false;
  let difference = 0;
  for (let i = 0; i < a.length; i += 1) difference |= (a[i] ?? 0) ^ (b[i] ?? 0);
  return difference === 0;
}

/** Overwrite a buffer once it is finished with. Best effort: JavaScript gives no stronger promise. */
export function wipe(bytes: Uint8Array): void {
  bytes.fill(0);
}
