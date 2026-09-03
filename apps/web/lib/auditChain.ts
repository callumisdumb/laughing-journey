/**
 * The audit ledger as a signed, append-only chain.
 *
 * Audit is signed rather than encrypted, and that is a decision rather than an omission. Its purpose
 * is to be readable by a Caldicott guardian, an Adult Protection Committee lead officer, an
 * inspector and, if it comes to it, the ICO. Encrypting it to the people it exists to police would
 * be backwards.
 *
 * What it does need is to be impossible to edit quietly. Every entry is signed with the actor's
 * device key and carries the hash of its predecessor, so altering an entry breaks its own signature
 * and removing one breaks the link of the entry after it. The Admin verification screen walks the
 * chain and names the first break and its kind.
 *
 * Only the free-text detail is encrypted, to the oversight roles, because that is the field where a
 * practitioner might record something about a third party who is not the subject of the record. Who
 * did what, to which record, at what classification and when all stay in the clear, which is exactly
 * what oversight needs and exactly what an operator can already infer from the metadata anyway.
 */
import {
  appendEntry,
  randomBytes,
  generateSigningKeyPair,
  seal,
  toBase64Url,
  utf8,
  verifyChain,
  verifyingKey,
  type AuditEntry as ChainEntry,
  type AuditEntryBody,
  type ChainVerification,
  type SigningKeyPair,
  type VerifyingKey,
} from '@mas/crypto';
import type { AuditEntry } from '@mas/domain';

/**
 * Device signing keys, one per user, derived once per session.
 *
 * In production these are generated on the device at enrolment and their private halves live in the
 * OS keychain, never leaving it. Here they are held in memory so a demonstration can sign and verify
 * in one session; the Security page says which is which.
 */
const signingKeys = new Map<string, SigningKeyPair>();

export function deviceSigningKey(userId: string): SigningKeyPair {
  const existing = signingKeys.get(userId);
  if (existing) return existing;
  const fresh = generateSigningKeyPair(`dev:${userId}`);
  signingKeys.set(userId, fresh);
  return fresh;
}

/** The public halves, which is all a verifier needs. A leaver's stays valid forever. */
export function verifyingKeys(): Map<string, VerifyingKey> {
  return new Map([...signingKeys.entries()].map(([userId, key]) => [`dev:${userId}`, verifyingKey(key)]));
}

/** The chain, in order. Held beside the ledger rather than inside it, so the domain type is untouched. */
export interface AuditChain {
  entries: ChainEntry[];
  /** Chain position by audit entry id, so a screen can show the link beside the row. */
  index: Map<string, number>;
}

export function emptyChain(): AuditChain {
  return { entries: [], index: new Map() };
}

function bodyOf(entry: AuditEntry): AuditEntryBody {
  return {
    id: entry.id,
    at: entry.at,
    // The actor is the device that signed, which is what a signature can actually attest to.
    actorId: `dev:${entry.userId}`,
    action: entry.act,
    targetId: entry.targetId,
    // The classification of what was touched, so oversight can filter without opening anything.
    classification: entry.restricted ? 'official-sensitive-restricted' : 'official-sensitive',
    restricted: entry.restricted,
  };
}

/**
 * Append an entry, signing it and linking it to its predecessor.
 *
 * The free-text detail is the entry's target label and reason, which is where a practitioner's own
 * words end up. It is encrypted under a key derived for the purpose; in production that key is
 * wrapped to the oversight roles, and here it is held for the session.
 */
export function appendAudit(chain: AuditChain, entry: AuditEntry, detailKey: Uint8Array): AuditChain {
  const key = deviceSigningKey(entry.userId);
  const body = bodyOf(entry);
  const detail = seal(
    detailKey,
    utf8(JSON.stringify({ targetLabel: entry.targetLabel, reason: entry.reason ?? '' })),
    { recordId: entry.id, classification: body.classification, generation: 1 },
  );
  const appended = appendEntry(chain.entries.at(-1), body, key, detail);
  const entries = [...chain.entries, appended];
  return { entries, index: new Map(chain.index).set(entry.id, entries.length - 1) };
}

/** Walk the chain and report the first break. */
export function verifyAuditChain(chain: AuditChain): ChainVerification {
  return verifyChain(chain.entries, verifyingKeys());
}

/** The link an entry carries, shortened for display beside a row. */
export function linkFor(chain: AuditChain, entryId: string): string {
  const position = chain.index.get(entryId);
  const entry = position === undefined ? undefined : chain.entries[position];
  if (!entry) return '';
  return entry.previousHash === '' ? 'genesis' : entry.previousHash.slice(0, 12);
}

/**
 * Deliberately break a chain, for the verification screen's demonstration.
 *
 * A verification screen that has only ever reported "ok" proves nothing: anyone can write a function
 * that returns true. This edits one entry the way an attacker covering their tracks would, changing
 * a restricted read into an ordinary one, so the screen can show the break being found. It is only
 * ever called from that demonstration and never touches the real ledger.
 */
export function tamperedCopy(chain: AuditChain, position: number): AuditChain {
  const entries = chain.entries.map((entry, i) =>
    i === position ? { ...entry, body: { ...entry.body, action: 'read', restricted: false } } : entry,
  );
  return { entries, index: new Map(chain.index) };
}

/** The chain's head, which is what a receipt would carry. */
export function chainHead(chain: AuditChain): string {
  const last = chain.entries.at(-1);
  return last ? toBase64Url(utf8(last.previousHash)).slice(0, 16) : 'genesis';
}

/**
 * The key that encrypts an audit entry's free-text detail.
 *
 * One per session here. In production it is wrapped to the oversight roles, so a Caldicott guardian
 * or an APC lead officer can read a detail and a practitioner cannot read someone else's.
 */
let detailKey: Uint8Array | undefined;

export function auditDetailKey(): Uint8Array {
  detailKey ??= randomBytes(32);
  return detailKey;
}
