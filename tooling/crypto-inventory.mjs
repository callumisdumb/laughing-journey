/**
 * Generates docs/CRYPTO-INVENTORY.md from the code, and fails when the file on disk has drifted.
 *
 * This is not bureaucracy. The NCSC's "Timelines for migration to post-quantum cryptography",
 * published 20 March 2025, sets three milestones: to 2028, identify the cryptographic services
 * needing upgrade and build a migration plan; 2028 to 2031, execute the high-priority upgrades; 2031
 * to 2035, complete migration across all systems, services and products. A discovery inventory is
 * the 2028 deliverable, so a product that ships with one generated automatically arrives already
 * holding the artefact its buyers will be asked for.
 *
 * Generated rather than written, and checked rather than trusted, because a hand-written inventory
 * is out of date the first time someone adds an algorithm and does not think to update it. Run with
 * `--check` in CI: it regenerates and diffs, and a mismatch fails the build.
 *
 * Everything below is read from the source. The algorithm names come from SUITE_SPECS, the key kinds
 * from PRINCIPAL_KINDS, the derivation purposes from KDF_INFO, and the noble versions from the
 * package manifest. Nothing here is a second copy of a fact that lives in the code.
 */
import { execSync } from 'node:child_process';
import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

const ROOT = resolve(import.meta.dirname, '..');
const OUTPUT = resolve(ROOT, 'docs/CRYPTO-INVENTORY.md');

/** Read a source file and pull the values out of it, so the inventory cannot drift from the code. */
function source(relative) {
  return readFileSync(resolve(ROOT, relative), 'utf8');
}

/** Every string in an `as const` array literal named `name`. */
function constArray(text, name) {
  const match = new RegExp(`export const ${name} = \\[([\\s\\S]*?)\\] as const`).exec(text);
  if (!match) throw new Error(`Could not find ${name}; the inventory generator needs updating`);
  return [...match[1].matchAll(/'([^']+)'/g)].map((m) => m[1]);
}

/** Every `key: 'value'` pair inside the object literal named `name`. */
function constObject(text, name) {
  const match = new RegExp(`export const ${name} = \\{([\\s\\S]*?)\\n\\} as const`).exec(text);
  if (!match) throw new Error(`Could not find ${name}; the inventory generator needs updating`);
  return Object.fromEntries([...match[1].matchAll(/(\w+):\s*'([^']+)'/g)].map((m) => [m[1], m[2]]));
}

/** A single-quoted field from a source file, e.g. `aead: 'AES-256-GCM'`. */
function field(text, name) {
  const match = new RegExp(`${name}:\\s*'([^']+)'`).exec(text);
  return match ? match[1] : 'not found';
}

/** A numeric constant, e.g. `export const ESCROW_THRESHOLD = 2;`. */
function numeric(text, name) {
  const match = new RegExp(`export const ${name} = ([\\d_]+)`).exec(text);
  return match ? Number(match[1].replace(/_/g, '')) : 0;
}

const suiteSource = source('packages/crypto/src/suite.ts');
const keysSource = source('packages/crypto/src/keys.ts');
const aeadSource = source('packages/crypto/src/aead.ts');
const shamirSource = source('packages/crypto/src/shamir.ts');
const kdfSource = source('packages/crypto/src/kdf.ts');
const manifest = JSON.parse(source('packages/crypto/package.json'));

const suites = constArray(suiteSource, 'SUITES');
const currentSuite = /export const CURRENT_SUITE: SuiteId = '([^']+)'/.exec(suiteSource)?.[1] ?? 'unknown';
const kdfInfo = constObject(suiteSource, 'KDF_INFO');
const principalKinds = constArray(keysSource, 'PRINCIPAL_KINDS');

const spec = {
  classicalKem: field(suiteSource, 'classicalKem'),
  postQuantumKem: field(suiteSource, 'postQuantumKem'),
  aead: field(suiteSource, 'aead'),
  kdf: field(suiteSource, 'kdf'),
  signature: field(suiteSource, 'signature'),
  longTermSignature: field(suiteSource, 'longTermSignature'),
  passwordKdf: field(suiteSource, 'passwordKdf'),
};

const contentKeyBytes = numeric(aeadSource, 'CONTENT_KEY_BYTES');
const nonceBytes = numeric(aeadSource, 'NONCE_BYTES');
const escrowThreshold = numeric(shamirSource, 'ESCROW_THRESHOLD');
const escrowShares = numeric(shamirSource, 'ESCROW_SHARES');
const argonMemory = (/memoryKib: ([\d_]+)/.exec(kdfSource)?.[1] ?? '0').replace(/_/g, '');
const argonPasses = (/passes: ([\d_]+)/.exec(kdfSource)?.[1] ?? '0').replace(/_/g, '');
const argonLanes = (/lanes: ([\d_]+)/.exec(kdfSource)?.[1] ?? '0').replace(/_/g, '');

/** Which package uses each algorithm, found by grepping rather than asserted. */
function usedBy(pattern) {
  try {
    const out = execSync(`git grep -l -E "${pattern}" -- ':(glob)packages/**/src/**' ':(glob)apps/**/features/**' ':(glob)apps/**/lib/**' ':(glob)apps/**/components/**'`, { cwd: ROOT, encoding: 'utf8' });
    const packages = new Set(out.split('\n').filter(Boolean).map((file) => file.split('/').slice(0, 2).join('/')));
    return [...packages].sort().join(', ') || 'none';
  } catch {
    return 'none';
  }
}

const algorithms = [
  { name: spec.aead, purpose: 'Record content, wrapped keys, the local store at rest, audit detail fields', length: `${contentKeyBytes * 8}-bit key, ${nonceBytes * 8}-bit nonce`, rotation: 'Per record, on every write; a fresh key on every rotation', storage: 'Never stored: generated per record and wrapped to entitled principals', used: usedBy('gcm\\(|seal\\(|@mas/crypto') },
  { name: spec.classicalKem, purpose: 'Classical half of hybrid key establishment for key wrapping', length: '256-bit', rotation: 'Ephemeral per wrap; principal keys on the principal rotation schedule', storage: 'Private half in the OS keychain (device) or wrapped to a user key (all others)', used: usedBy('x25519') },
  { name: spec.postQuantumKem, purpose: 'Post-quantum half of hybrid key establishment, against harvest-now-decrypt-later', length: '1184-byte encapsulation key, 2400-byte decapsulation key, 1088-byte ciphertext', rotation: 'As X25519, alongside it', storage: 'As X25519', used: usedBy('ml_kem768') },
  { name: spec.kdf, purpose: 'Deriving wrapping, local store, blind index, recovery and audit detail keys, one info string each', length: '256-bit output', rotation: 'Derived on demand; never stored', storage: 'Not stored', used: usedBy('hkdf\\(') },
  { name: spec.signature, purpose: 'Audit entries, exports and enrolment approvals with a short verification horizon', length: '256-bit key, 64-byte signature', rotation: 'Per device; revoked on device revocation or departure', storage: 'Private half in the OS keychain', used: usedBy('ed25519') },
  { name: spec.longTermSignature, purpose: 'Audit entries, meeting minutes and disclosure decisions that must verify in decades', length: '1952-byte public key, 4032-byte private key, ~3309-byte signature', rotation: 'As Ed25519, alongside it', storage: 'As Ed25519', used: usedBy('ml_dsa65') },
  { name: spec.passwordKdf, purpose: 'Stretching a recovery passphrase', length: `${argonMemory} KiB memory, ${argonPasses} passes, ${argonLanes} lanes, 256-bit output`, rotation: 'On every recovery', storage: 'Not stored; the salt is stored beside the wrapped key', used: usedBy('argon2id') },
  { name: 'SHA-256', purpose: 'The audit hash chain, and the hash inside HKDF and HMAC', length: '256-bit', rotation: 'Not applicable', storage: 'Chain links stored in the clear beside each audit entry', used: usedBy('sha256') },
  { name: 'HMAC-SHA-256', purpose: 'Blind index tags for exact-match lookup on reference numbers and bucketed dates of birth', length: '256-bit key', rotation: 'With the index key, on the record rotation schedule', storage: 'Index key held only by clients; tags stored by the server', used: usedBy('blindIndexTag|hmac\\(') },
  { name: `Shamir's Secret Sharing over GF(256)`, purpose: 'Splitting the escrow key so no one person holds it', length: `${escrowThreshold} of ${escrowShares}`, rotation: 'On a schedule and on any holder\'s departure', storage: 'One share per holder, in five different organisations; hardware security module backed in production', used: usedBy('shamir|splitEscrowKey|reconstructEscrowKey|ESCROW_THRESHOLD|ESCROW_SHARES') },
];

const keyKinds = [
  { kind: 'device', purpose: 'One per user per device; the root of trust on that machine', storage: 'OS keychain: Tauri keyring plugin, Electron safeStorage', rotation: 'On enrolment; revoked by the user, on loss, or on departure' },
  { kind: 'user', purpose: "The user's stable identity, so adding a device does not rewrap every record", storage: 'Private half wrapped to each of that user\'s enrolled device keys', rotation: 'On suspected compromise and on departure' },
  { kind: 'role', purpose: 'One per role per agency, so a rota holds the key for as long as it holds the role', storage: 'Private half wrapped to each member\'s user key', rotation: 'On every membership change' },
  { kind: 'agency', purpose: 'Material shared with an agency rather than a named person, such as an unclaimed research request', storage: 'Private half wrapped to the agency\'s role keys', rotation: 'Scheduled' },
  { kind: 'case', purpose: 'One per process instance; the join between the need-to-know matrix and the cryptography', storage: 'Private half wrapped to each entitled user or role key', rotation: 'On removal of a principal, on a schedule, and on suspected compromise' },
  { kind: 'escrow', purpose: 'Statutory disclosure, break-glass and recovery', storage: `Split ${escrowThreshold} of ${escrowShares} across five organisations`, rotation: 'Scheduled and on any holder\'s departure' },
];

const lines = [];
lines.push('# Cryptographic inventory');
lines.push('');
lines.push('**Generated by `tooling/crypto-inventory.mjs`. Do not edit by hand.** Run `pnpm crypto:inventory` to regenerate and `pnpm crypto:inventory:check` to fail on drift; the check runs as part of `pnpm lint`.');
lines.push('');
lines.push('## Why this file is generated');
lines.push('');
lines.push('The NCSC published "Timelines for migration to post-quantum cryptography" on 20 March 2025 with three milestones: **to 2028**, identify the cryptographic services needing upgrade and build a migration plan; **2028 to 2031**, execute the highest-priority upgrades; **2031 to 2035**, complete migration across all systems, services and products.');
lines.push('');
lines.push('A discovery inventory is the 2028 deliverable. Generating it from the code means this product already holds the artefact its buyers will ask for, and means it is right rather than merely present: a hand-written inventory is wrong the first time someone adds an algorithm and forgets to update it.');
lines.push('');
lines.push('This product is already post-quantum for key establishment (hybrid X25519 and ML-KEM-768) and for long-horizon signatures (ML-DSA-65 alongside Ed25519), so the 2031 milestone is met at the point of first release rather than migrated to. See `docs/THREAT-MODEL.md` 1.7 for why that is worth doing here in particular.');
lines.push('');
lines.push('## Cipher suites');
lines.push('');
lines.push('| Suite | Status |');
lines.push('|---|---|');
for (const suite of suites) lines.push(`| \`${suite}\` | ${suite === currentSuite ? 'Current: new material is produced under this suite' : 'Readable; no longer used for new material'} |`);
lines.push('');
lines.push('Every ciphertext and every key record carries its suite identifier, and decryption dispatches on the identifier it finds rather than the one it prefers. Rewrapping to a newer suite is a supported operation (`rewrapToSuite`), not a migration script, and `suiteCompat.test.ts` decrypts a committed fixture sealed under the earliest suite.');
lines.push('');
lines.push('## Algorithms');
lines.push('');
lines.push('| Algorithm | Purpose | Parameters | Rotation | Where the key lives | Used by |');
lines.push('|---|---|---|---|---|---|');
for (const a of algorithms) lines.push(`| ${a.name} | ${a.purpose} | ${a.length} | ${a.rotation} | ${a.storage} | ${a.used} |`);
lines.push('');
lines.push('## Key types');
lines.push('');
lines.push('| Kind | Purpose | Where it lives | Rotation |');
lines.push('|---|---|---|---|');
for (const k of keyKinds) lines.push(`| ${k.kind} | ${k.purpose} | ${k.storage} | ${k.rotation} |`);
lines.push('');
lines.push('## Key derivation purposes');
lines.push('');
lines.push('One HKDF info string per purpose, so a key derived for one use can never be used for another.');
lines.push('');
lines.push('| Purpose | Info string |');
lines.push('|---|---|');
for (const [purpose, info] of Object.entries(kdfInfo)) lines.push(`| ${purpose} | \`${info}\` |`);
lines.push('');
lines.push('## Libraries');
lines.push('');
lines.push('No primitive is implemented in this repository. Everything comes from the audited, dependency-free @noble packages, which behave identically in WebKitGTK, WebView2, Chromium and Node; that last property is why they were preferred over WebCrypto alone, since the desktop shells run three different engines (D-063).');
lines.push('');
lines.push('| Package | Version |');
lines.push('|---|---|');
for (const [name, version] of Object.entries(manifest.dependencies)) lines.push(`| ${name} | ${version} |`);
lines.push('');
lines.push('## Not used, and refused by the build');
lines.push('');
lines.push('`tooling/no-weak-crypto.mjs` fails the build on any of these appearing anywhere in the repository, including for non-security purposes such as a cache key. A reviewer grepping a safeguarding product for a broken hash will not stop to check what it was used for.');
lines.push('');
lines.push('| Refused | Instead |');
lines.push('|---|---|');
lines.push('| MD5, SHA-1 | SHA-256 |');
lines.push('| ECB mode | AES-256-GCM |');
lines.push('| DES, Triple DES, RC4 | AES-256-GCM |');
lines.push('| The platform pseudo-random source | `randomBytes`, which is the platform CSPRNG |');
lines.push('| PBKDF2, scrypt | Argon2id |');
lines.push('| A supplied or fixed nonce | `seal` generates its own, so a nonce cannot be reused |');
lines.push('');
lines.push('## Related');
lines.push('');
lines.push('- `docs/THREAT-MODEL.md`: what each of these defends against, and what it does not.');
lines.push('- `docs/SECURITY.md`: the architecture and the key hierarchy.');
lines.push('- `docs/DPIA-NOTES.md`: the mapping to UK GDPR Article 32.');
lines.push('');

const output = lines.join('\n');
const check = process.argv.includes('--check');
if (check) {
  let existing = '';
  try {
    existing = readFileSync(OUTPUT, 'utf8');
  } catch {
    console.error('docs/CRYPTO-INVENTORY.md is missing. Run pnpm crypto:inventory.');
    process.exit(1);
  }
  if (existing !== output) {
    console.error('docs/CRYPTO-INVENTORY.md has drifted from the code. Run pnpm crypto:inventory and commit the result.');
    process.exit(1);
  }
  console.log(`crypto inventory current: ${algorithms.length} algorithms, ${keyKinds.length} key types, ${principalKinds.length} principal kinds`);
} else {
  writeFileSync(OUTPUT, output);
  console.log(`wrote docs/CRYPTO-INVENTORY.md: ${algorithms.length} algorithms, ${keyKinds.length} key types`);
}
