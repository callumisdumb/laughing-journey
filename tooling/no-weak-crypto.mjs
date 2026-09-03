/**
 * Fails the build on a weak or homemade cryptographic construction anywhere in the repository.
 *
 * The rule is not "these are used insecurely". It is that they must not appear at all, including for
 * non-security purposes such as a cache key or a content hash. A reviewer grepping a safeguarding
 * product for MD5 will not stop to check what it was used for, and being right about a cache key is
 * worth less than not having the conversation.
 *
 * The same applies to homemade constructions. Nothing in this repository implements a cipher, a key
 * schedule or a hash: everything comes from the audited @noble packages. A hand-rolled XOR "cipher"
 * or a second layer of encryption applied in the hope that two weak things make a strong one is the
 * signature of a codebase that did not take this seriously, so both are refused here.
 *
 * The one construction this file allows is GF(256) arithmetic in the Shamir implementation, which is
 * secret sharing rather than encryption, is the standard construction, and is named explicitly below
 * rather than being caught by a general exemption.
 */
import { execSync } from 'node:child_process';
import { readFileSync } from 'node:fs';

/** Each rule: what it matches, and what to do instead. The message is what a developer will read. */
const RULES = [
  { id: 'md5', pattern: /\bmd5\b/i, message: 'MD5 is broken. Use SHA-256 from @noble/hashes, including for non-security hashing.' },
  { id: 'sha1', pattern: /\bsha-?1\b/i, message: 'SHA-1 is broken. Use SHA-256 from @noble/hashes, including for non-security hashing.' },
  { id: 'ecb', pattern: /\becb\b/i, message: 'ECB reveals plaintext structure. Use AES-256-GCM through the seal and open helpers in @mas/crypto.' },
  { id: 'des', pattern: /\b(3des|tripledes|des-ede)\b/i, message: 'DES and Triple DES are obsolete. Use AES-256-GCM.' },
  { id: 'rc4', pattern: /\brc4\b/i, message: 'RC4 is broken. Use AES-256-GCM or XChaCha20-Poly1305.' },
  { id: 'math-random', pattern: /Math\.random\s*\(/, message: 'Math.random is not a CSPRNG. Use randomBytes from @mas/crypto.' },
  { id: 'createCipheriv-ecb', pattern: /createCipher(?:iv)?\s*\(\s*['"][^'"]*ecb/i, message: 'ECB again. Use AES-256-GCM.' },
  { id: 'createCipher', pattern: /\bcreateCipher\s*\(/, message: "Node's createCipher derives a key from a passphrase with one MD5 pass. Use @mas/crypto." },
  { id: 'pbkdf2', pattern: /\bpbkdf2\b/i, message: 'Use Argon2id (deriveFromPassphrase in @mas/crypto) rather than PBKDF2.' },
  { id: 'scrypt', pattern: /\bscrypt\b/i, message: 'Use Argon2id (deriveFromPassphrase in @mas/crypto) rather than scrypt.' },
  { id: 'static-nonce', pattern: /nonce\s*[:=]\s*new Uint8Array\(\s*\d+\s*\)/, message: 'A fixed nonce under a reused key breaks GCM completely. seal() generates its own; do not supply one.' },
];

/**
 * Files exempt from one named rule, with the reason. Never a blanket exemption: each entry names the
 * file and the rule, so an exemption cannot quietly widen.
 */
const EXEMPTIONS = [
  { file: 'tooling/no-weak-crypto.mjs', rules: '*', reason: 'This file names the patterns in order to ban them.' },
  { file: 'tooling/crypto-inventory.mjs', rules: '*', reason: 'The generator writes the "not used, and refused" table, which has to name them.' },
  { file: 'packages/crypto/src/kdf.ts', rules: 'pbkdf2,scrypt', reason: 'The comment explains why Argon2id is used instead of these two.' },
  { file: 'docs/SECURITY.md', rules: '*', reason: 'The documentation names what is not used and why.' },
  { file: 'docs/THREAT-MODEL.md', rules: '*', reason: 'The documentation names what is not used and why.' },
  { file: 'docs/CRYPTO-INVENTORY.md', rules: '*', reason: 'The generated inventory names what is not used and why.' },
  { file: 'docs/DECISIONS.md', rules: '*', reason: 'D-063 and D-064 record the algorithm choices, including the rejected ones.' },
  { file: 'docs/NOTES.md', rules: '*', reason: 'The visual log records what was tried and rejected.' },
  { file: 'docs/DPIA-NOTES.md', rules: '*', reason: 'The DPIA note names the algorithms for the Article 32 mapping.' },
  { file: 'docs/HANDOVER.md', rules: '*', reason: 'Section 2 summarises D-063 and D-064, which means listing the refused algorithms.' },
];

const EXTENSIONS = /\.(ts|tsx|js|jsx|mjs|cjs|rs|md)$/;

const files = execSync('git ls-files -co --exclude-standard', { encoding: 'utf8' })
  .split('\n')
  .filter((file) => file && EXTENSIONS.test(file))
  .filter((file) => !file.startsWith('docs/SCREENSHOTS/'));

function exempt(file, ruleId) {
  return EXEMPTIONS.some((entry) => entry.file === file && (entry.rules === '*' || entry.rules.split(',').includes(ruleId)));
}

const offences = [];
for (const file of files) {
  const lines = readFileSync(file, 'utf8').split('\n');
  lines.forEach((line, i) => {
    for (const rule of RULES) {
      if (!rule.pattern.test(line)) continue;
      if (exempt(file, rule.id)) continue;
      offences.push({ file, line: i + 1, rule: rule.id, message: rule.message, text: line.trim().slice(0, 100) });
    }
  });
}

if (offences.length > 0) {
  console.error('Weak or homemade cryptography found:');
  for (const offence of offences) {
    console.error(`  ${offence.file}:${offence.line}  [${offence.rule}]  ${offence.message}`);
    console.error(`      ${offence.text}`);
  }
  process.exit(1);
}

console.log(`no weak cryptography in ${files.length} files (${RULES.length} rules, ${EXEMPTIONS.length} named exemptions)`);
