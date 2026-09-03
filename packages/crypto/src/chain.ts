/**
 * The audit hash chain: append-only and tamper-evident.
 *
 * Audit is signed, not encrypted, and that is deliberate. Its purpose is to be readable by a
 * Caldicott guardian, an Adult Protection Committee lead officer, an inspector and, if it comes to
 * it, the ICO. Encrypting it to the people it exists to police would be backwards.
 *
 * So instead: every entry is signed by the actor's device key, and each entry carries the hash of its
 * predecessor. An entry cannot be altered without changing its hash, and changing its hash breaks
 * every link after it, so removing or editing an entry is visible rather than silent. Actor, action,
 * target identifier, classification and timestamp stay in plaintext. Only the free-text detail is
 * encrypted, to a set of oversight roles, because that is the field where a practitioner might
 * record something about a third party who is not the subject of the record.
 *
 * Signatures use the long horizon (Ed25519 plus ML-DSA-65). An entry written today may need to
 * verify in a Learning Review decades from now, and a signature nobody can check by then proves
 * nothing.
 */
import { sha256 } from '@noble/hashes/sha2.js';
import { concat, equalConstantTime, toBase64Url, utf8 } from './bytes';
import type { SigningKeyPair, VerifyingKey } from './keys';
import { sign, verify, type Signature } from './sign';
import type { Sealed } from './aead';

/** The plaintext part of an entry: everything an oversight reader needs without a key. */
export interface AuditEntryBody {
  id: string;
  at: string;
  /** Opaque principal id of the actor. */
  actorId: string;
  action: string;
  targetId: string;
  classification: string;
  /** True where the read was of a restricted record, which oversight counts separately. */
  restricted: boolean;
}

/** An entry as stored: body, previous hash, the encrypted detail, and the actor's signature. */
export interface AuditEntry {
  body: AuditEntryBody;
  /** base64url of the previous entry's hash. The genesis entry's is the empty string. */
  previousHash: string;
  /** Free text, encrypted to the oversight roles. Absent where the entry has no detail. */
  detail?: Sealed;
  signature: Signature;
}

/**
 * The bytes an entry's hash and signature cover.
 *
 * A canonical encoding with length prefixes, so a value containing the separator cannot be made to
 * look like a different entry. The encrypted detail is covered too: an attacker who could swap one
 * entry's detail for another's without breaking the chain would have defeated the point of it.
 */
export function auditEntryBytes(body: AuditEntryBody, previousHash: string, detail?: Sealed): Uint8Array {
  const fields = [body.id, body.at, body.actorId, body.action, body.targetId, body.classification, String(body.restricted), previousHash, detail ? toBase64Url(detail.ciphertext) : ''];
  const parts = fields.map((field) => {
    const bytes = utf8(field);
    const length = new Uint8Array(4);
    new DataView(length.buffer).setUint32(0, bytes.length, false);
    return concat(length, bytes);
  });
  return concat(utf8('person360/v1/audit'), ...parts);
}

/** An entry's hash, which the next entry links to. */
export function auditEntryHash(entry: AuditEntry): Uint8Array {
  return sha256(auditEntryBytes(entry.body, entry.previousHash, entry.detail));
}

/** The genesis link. An empty string rather than a hash of nothing, so the first entry is obvious. */
export const GENESIS_HASH = '';

/**
 * Append an entry to the chain, signing it with the actor's device key.
 *
 * The long horizon is used for every entry rather than only the interesting ones. It costs about
 * 3.3 kB an entry, and the alternative is deciding at write time which entries will matter in 2050,
 * which is a decision nobody is in a position to make.
 */
export function appendEntry(previous: AuditEntry | undefined, body: AuditEntryBody, key: SigningKeyPair, detail?: Sealed): AuditEntry {
  const previousHash = previous ? toBase64Url(auditEntryHash(previous)) : GENESIS_HASH;
  return { body, previousHash, detail, signature: sign(auditEntryBytes(body, previousHash, detail), key, 'long') };
}

/** What a verification pass found. `brokenAt` is the index of the first entry that failed. */
export interface ChainVerification {
  ok: boolean;
  entries: number;
  brokenAt?: number;
  reason?: 'link-broken' | 'signature-invalid' | 'unknown-signer';
}

/**
 * Walk the chain and report the first break.
 *
 * Both properties are checked at every entry: the link to the predecessor, and the actor's
 * signature. Checking only the links would let anyone who could recompute hashes rewrite history;
 * checking only the signatures would let an attacker delete an entry entirely.
 *
 * The first break stops the walk, because everything after it is unverifiable anyway and reporting a
 * cascade of consequential failures would bury the one that matters.
 */
export function verifyChain(entries: readonly AuditEntry[], keys: ReadonlyMap<string, VerifyingKey>): ChainVerification {
  let expected = GENESIS_HASH;
  for (const [i, entry] of entries.entries()) {
    if (entry.previousHash !== expected) return { ok: false, entries: entries.length, brokenAt: i, reason: 'link-broken' };
    const key = keys.get(entry.signature.signerId);
    if (!key) return { ok: false, entries: entries.length, brokenAt: i, reason: 'unknown-signer' };
    if (!verify(auditEntryBytes(entry.body, entry.previousHash, entry.detail), entry.signature, key)) {
      return { ok: false, entries: entries.length, brokenAt: i, reason: 'signature-invalid' };
    }
    expected = toBase64Url(auditEntryHash(entry));
  }
  return { ok: true, entries: entries.length };
}

/** Whether two chain links match, in constant time. */
export function linksMatch(a: string, b: string): boolean {
  return equalConstantTime(utf8(a), utf8(b));
}
