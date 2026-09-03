/**
 * The encrypted record: what the store holds, and the only way to read it.
 *
 * This is the shape a zero-knowledge server sees. Metadata in the clear because the server must
 * store, route and audit; content as ciphertext; and one wrapped key per entitled principal. What
 * the metadata leaks is stated in docs/THREAT-MODEL.md section 3 and shown on the "What the host can
 * see" screen, because a design that hid its own leakage from the people evaluating it would not
 * deserve to be trusted with the rest.
 *
 * There is no `canRead`. The old resolver returned a permission boolean that a caller had to
 * remember to consult, and a caller that forgot rendered the record anyway. `openRecord` either
 * returns plaintext or throws, so forgetting is not possible: entitlement and decryptability are the
 * same fact rather than two facts that have to agree.
 */
import { generateContentKey, open, seal, type AeadContext, type Sealed } from './aead';
import { fromUtf8, utf8, wipe } from './bytes';
import type { PrincipalId, PublicKey, PrivateKey } from './keys';
import { CURRENT_SUITE, CryptoError, type SuiteId } from './suite';
import { unwrapKey, wrapFor, wrapToAll, type WrappedKey } from './wrap';

/**
 * Metadata the server sees in the clear. Deliberately minimal and deliberately coarse: this is the
 * leak, so every field here had to earn its place by being needed to store, route or audit.
 */
export interface RecordMetadata {
  id: string;
  /** Coarse: "mappa-process", never "MAPPA Level 3 review with disclosure decision". */
  type: string;
  /** The Annex 2 classification, which the AAD also binds so it cannot be downgraded. */
  classification: string;
  /** Which generation of the content key the ciphertext is under. Rotation increments it. */
  generation: number;
  /** Bucketed to the day on sensitive types, not the second. See `bucketTimestamp`. */
  updatedAt: string;
  /** Ids of other records this one links to. The existence of a link is visible; its meaning is not. */
  linkedIds: string[];
}

/** A record as stored. Content is ciphertext; there is no plaintext field anywhere in this type. */
export interface EncryptedRecord {
  suite: SuiteId;
  metadata: RecordMetadata;
  sealed: Sealed;
  /** One per entitled principal. An unentitled principal simply does not appear. */
  wrappedKeys: WrappedKey[];
}

/**
 * Bucket a timestamp to the day, for record types where the time of day would itself say something.
 * A burst of activity at 03:00 on a MAPPA record is information; the date alone is much less.
 */
export function bucketTimestamp(isoDateTime: string): string {
  return isoDateTime.slice(0, 10);
}

function contextOf(metadata: RecordMetadata): AeadContext {
  return { recordId: metadata.id, classification: metadata.classification, generation: metadata.generation };
}

/**
 * Encrypt a record to exactly the principals entitled to it.
 *
 * The recipient list comes from the need-to-know resolver and nowhere else. An empty list is refused:
 * a record nobody can open is not a secure record, it is a lost one, and losing access to personal
 * data is itself a failure the ICO treats as a breach. Escrow is always among the recipients in
 * practice, which is what makes that guarantee hold.
 */
export function encryptRecord(metadata: RecordMetadata, plaintext: string, recipients: readonly PublicKey[], suite: SuiteId = CURRENT_SUITE): EncryptedRecord {
  if (recipients.length === 0) throw new CryptoError('no-wrapped-key', `Refusing to encrypt ${metadata.id} to nobody: a record no one can open is a record that has been lost`);
  const contentKey = generateContentKey();
  try {
    return { suite, metadata, sealed: seal(contentKey, utf8(plaintext), contextOf(metadata), suite), wrappedKeys: wrapToAll(contentKey, recipients, suite) };
  } finally {
    wipe(contentKey);
  }
}

/**
 * Recover a record's content key, or throw.
 *
 * This is the function that replaced `canRead`. `no-wrapped-key` means the reader is not entitled,
 * which is the ordinary case the UI renders as the restricted state. `unwrap-failed` or
 * `decrypt-failed` mean something is wrong and must be surfaced rather than shown as restricted.
 */
export function unwrapRecordKey(record: EncryptedRecord, reader: PrivateKey, readerPublic: PublicKey): Uint8Array {
  const wrapped = wrapFor(record.wrappedKeys, reader.id);
  if (!wrapped) throw new CryptoError('no-wrapped-key', `Principal ${reader.id} holds no key for record ${record.metadata.id}`);
  return unwrapKey(wrapped, reader, readerPublic);
}

/** Decrypt a record. The only path from an EncryptedRecord to its content. */
export function openRecord(record: EncryptedRecord, reader: PrivateKey, readerPublic: PublicKey): string {
  const contentKey = unwrapRecordKey(record, reader, readerPublic);
  try {
    return fromUtf8(open(contentKey, record.sealed, contextOf(record.metadata)));
  } finally {
    wipe(contentKey);
  }
}

/** Whether a principal appears in the wrapped key list. Metadata only: it opens nothing. */
export function isWrappedTo(record: EncryptedRecord, principalId: PrincipalId): boolean {
  return record.wrappedKeys.some((wrap) => wrap.principalId === principalId);
}

/** Why a record's keys were rotated. Recorded on the audit entry the rotation produces. */
export type RotationReason = 'principal-removed' | 'scheduled' | 'suspected-compromise' | 'leaver';

export interface Rotation {
  record: EncryptedRecord;
  reason: RotationReason;
  /** Principals who could open the previous generation and cannot open this one. */
  removed: PrincipalId[];
  /**
   * Always true, and always surfaced. Rotation stops future access; it cannot unread ciphertext
   * someone already held. A chair who believes that removing a person retracts what they already saw
   * has been misled, so the interface says this in words at the point of removal.
   */
  priorAccessRemains: true;
}

/**
 * Re-key a record to a new set of principals.
 *
 * A fresh content key, a fresh generation number, a re-encryption and a re-wrap. The old wrapped set
 * is not carried forward: keeping it would mean the removed principal's copy still opened the old
 * ciphertext from the store, which is the thing rotation exists to stop. Escrow retains the previous
 * generation, which is how a lawful disclosure can still reach what the record said before.
 */
export function rotateRecord(
  record: EncryptedRecord,
  plaintext: string,
  recipients: readonly PublicKey[],
  reason: RotationReason,
  suite: SuiteId = CURRENT_SUITE,
): Rotation {
  const before = new Set(record.wrappedKeys.map((wrap) => wrap.principalId));
  const after = new Set(recipients.map((recipient) => recipient.id));
  const metadata: RecordMetadata = { ...record.metadata, generation: record.metadata.generation + 1 };
  return {
    record: encryptRecord(metadata, plaintext, recipients, suite),
    reason,
    removed: [...before].filter((id) => !after.has(id)),
    priorAccessRemains: true,
  };
}

/**
 * Re-wrap a record's content key to a new set of principals without re-encrypting.
 *
 * This is the cheap operation and it is only correct for *adding* principals. It deliberately takes
 * the reader's key rather than the content key as an argument, so only someone who can already open
 * the record can extend it. Removing a principal must go through `rotateRecord`, because a re-wrap
 * leaves the ciphertext and its generation unchanged and the removed principal's old copy would
 * still open it.
 */
export function addPrincipals(record: EncryptedRecord, reader: PrivateKey, readerPublic: PublicKey, added: readonly PublicKey[]): EncryptedRecord {
  const contentKey = unwrapRecordKey(record, reader, readerPublic);
  try {
    const fresh = added.filter((recipient) => !isWrappedTo(record, recipient.id));
    return { ...record, wrappedKeys: [...record.wrappedKeys, ...wrapToAll(contentKey, fresh, record.suite)] };
  } finally {
    wipe(contentKey);
  }
}

/**
 * Re-wrap to a newer cipher suite.
 *
 * Supported as an ordinary operation rather than a migration script, because the NCSC timeline means
 * this product will change suite inside the lifetime of the records it holds and a rewrap written
 * under time pressure in 2031 would be the wrong place to get this right.
 */
export function rewrapToSuite(record: EncryptedRecord, reader: PrivateKey, readerPublic: PublicKey, recipients: readonly PublicKey[], suite: SuiteId): EncryptedRecord {
  const contentKey = unwrapRecordKey(record, reader, readerPublic);
  try {
    const plaintext = fromUtf8(open(contentKey, record.sealed, contextOf(record.metadata)));
    return encryptRecord(record.metadata, plaintext, recipients, suite);
  } finally {
    wipe(contentKey);
  }
}
