/**
 * The local store, encrypted at rest under a device key held in the OS keychain.
 *
 * Everything the product keeps between sessions goes through here: the overlay of changes made
 * during a demonstration, the session, and the cached wrapped keys that make the offline grace period
 * work. Close the desktop app, open the data file on disk, and you get ciphertext. That is
 * demonstrable rather than asserted, and `pnpm desktop:electron:dev` plus a text editor is all it
 * takes to check.
 *
 * The device key never enters this file's control. On the desktop it lives in the OS keychain
 * (Electron's `safeStorage`, which is backed by the Keychain on macOS, DPAPI on Windows and the
 * Secret Service on Linux; Tauri's keyring plugin does the same job), and the shell hands back only
 * a wrapped blob. In a browser there is no keychain, so the key lives in localStorage and the
 * Security page says so in as many words: a browser tab cannot protect a key from someone with the
 * profile directory, and pretending otherwise would be exactly the overclaim this product avoids.
 *
 * The threat this defends against is docs/THREAT-MODEL.md 1.6, a lost or stolen device. It is not a
 * defence against an attacker who has the machine unlocked and the OS user logged in; nothing at
 * this layer can be.
 */
import { deriveKey, fromBase64Url, open, randomBytes, seal, toBase64Url, utf8, type Sealed } from '@mas/crypto';
import { classificationTag, officialSensitive } from '@mas/domain';

/** What the desktop shells expose. Absent in a browser, which is the difference that matters. */
interface DesktopBridge {
  deviceKey?: {
    /** The device key, unwrapped by the OS keychain. Created on first run. */
    load: () => Promise<string | null>;
    save: (base64: string) => Promise<void>;
  };
  shell?: string;
}

function bridge(): DesktopBridge | undefined {
  return (globalThis as { masDesktop?: DesktopBridge }).masDesktop;
}

/** Where the device key is actually protected. Shown on the Security page, honestly. */
export type KeyProtection = 'os-keychain' | 'browser-storage' | 'memory-only';

export function keyProtection(): KeyProtection {
  if (bridge()?.deviceKey) return 'os-keychain';
  try {
    if (typeof window !== 'undefined' && window.localStorage) return 'browser-storage';
  } catch {
    /* storage unavailable */
  }
  return 'memory-only';
}

const DEVICE_KEY_STORAGE = 'mas.device-key.v1';
const SALT_STORAGE = 'mas.device-salt.v1';

let cachedDeviceKey: Uint8Array | undefined;

/**
 * The device key: from the OS keychain on the desktop, from browser storage otherwise, created on
 * first use. Memoised, because deriving it on every write would be pointless work.
 */
export async function deviceKey(): Promise<Uint8Array> {
  if (cachedDeviceKey) return cachedDeviceKey;
  const desktop = bridge()?.deviceKey;
  if (desktop) {
    const existing = await desktop.load();
    if (existing) {
      cachedDeviceKey = fromBase64Url(existing);
      return cachedDeviceKey;
    }
    const fresh = randomBytes(32);
    await desktop.save(toBase64Url(fresh));
    cachedDeviceKey = fresh;
    return fresh;
  }
  // No keychain: the key lives where the data lives, which is worth less and is said so.
  try {
    const existing = window.localStorage.getItem(DEVICE_KEY_STORAGE);
    if (existing) {
      cachedDeviceKey = fromBase64Url(existing);
      return cachedDeviceKey;
    }
    const fresh = randomBytes(32);
    window.localStorage.setItem(DEVICE_KEY_STORAGE, toBase64Url(fresh));
    cachedDeviceKey = fresh;
    return fresh;
  } catch {
    // No storage at all: the key lives for this session only, and nothing persists.
    cachedDeviceKey = randomBytes(32);
    return cachedDeviceKey;
  }
}

/** A per-installation salt, so two installations derive different store keys from the same device key. */
function salt(): Uint8Array {
  try {
    const existing = window.localStorage.getItem(SALT_STORAGE);
    if (existing) return fromBase64Url(existing);
    const fresh = randomBytes(16);
    window.localStorage.setItem(SALT_STORAGE, toBase64Url(fresh));
    return fresh;
  } catch {
    return new Uint8Array(16);
  }
}

/** The at-rest shape: base64url of the nonce and the ciphertext, and nothing readable. */
export interface SealedBlob {
  v: 1;
  n: string;
  c: string;
}

function context(key: string) {
  return { recordId: key, classification: classificationTag(officialSensitive(), false), generation: 1 };
}

/**
 * Prime the device key so the store's reads and writes can be synchronous.
 *
 * Reaching the OS keychain is asynchronous, and the store's persistence is not: threading a promise
 * through every write would be a large change for no security gain. So the key is fetched once at
 * start-up and held in memory for the session, which is what a running application does anyway.
 * Call this before `init`.
 */
export async function primeDeviceKey(): Promise<KeyProtection> {
  await deviceKey();
  return keyProtection();
}

/** The store key, or undefined before priming. Undefined means nothing is written rather than that
 * something is written in the clear: a failure to protect must not silently become a failure to
 * encrypt. */
function storeKey(): Uint8Array | undefined {
  return cachedDeviceKey ? deriveKey(cachedDeviceKey, salt(), 'localStore') : undefined;
}

/** Encrypt a value for the local store. The key never appears in the output. */
export function sealLocal(key: string, value: unknown): SealedBlob | undefined {
  const derived = storeKey();
  if (!derived) return undefined;
  const sealed = seal(derived, utf8(JSON.stringify(value)), context(key));
  return { v: 1, n: toBase64Url(sealed.nonce), c: toBase64Url(sealed.ciphertext) };
}

/**
 * Decrypt a value from the local store, or undefined.
 *
 * Undefined on a failure rather than a throw: a store written under a device key that has since been
 * replaced is unreadable, and the right response is to start clean rather than to refuse to launch.
 * A safeguarding product that would not open because of a stale cache would be worse than one that
 * loses a demonstration's worth of local changes.
 */
export function openLocal<T>(key: string, blob: SealedBlob | null): T | undefined {
  if (!blob || blob.v !== 1) return undefined;
  const derived = storeKey();
  if (!derived) return undefined;
  try {
    const sealed: Sealed = { suite: 'v1-x25519-mlkem768-aes256gcm', nonce: fromBase64Url(blob.n), ciphertext: fromBase64Url(blob.c) };
    return JSON.parse(new TextDecoder().decode(open(derived, sealed, context(key)))) as T;
  } catch {
    // A store written under a device key that has since been replaced is unreadable. Start clean:
    // a safeguarding product that would not launch because of a stale cache is the worse failure.
    return undefined;
  }
}

/** Whether a stored value looks like one of ours, so a plaintext leftover is not read as a blob. */
export function isSealedBlob(value: unknown): value is SealedBlob {
  return typeof value === 'object' && value !== null && (value as SealedBlob).v === 1 && typeof (value as SealedBlob).c === 'string';
}

/** Forget the cached device key. Used by tests and by device revocation. */
export function forgetDeviceKey(): void {
  cachedDeviceKey = undefined;
}
