/**
 * The vault: the mock API as a zero-knowledge server.
 *
 * There is no backend, so this module is where the data path is made honest. The mock store holds
 * every process record's content as ciphertext, encrypted to exactly the principals the need-to-know
 * matrix entitles, and the client decrypts on read. It is not a store of plaintext that encrypts on
 * the way out, which would be a demonstration of nothing: the whole point is that the data path is
 * right, and a reviewer will check.
 *
 * What that gets you is the "What the host can see" screen. A hosting provider, a database
 * administrator or an attacker with full storage access sees exactly what `serverView` returns, and
 * a practitioner sees what `openProcess` returns, and the difference between the two is the product
 * of this design rather than a promise about it.
 *
 * Keys in this mockup are derived deterministically from the seed so that a demonstration is
 * reproducible and a page reload does not lose the caseload. In production they are generated on the
 * device, the private halves live in the OS keychain, and none of them is derivable from anything
 * the server holds. `docs/SECURITY.md` says so, and so does the Security page in Help, because a
 * demonstration that quietly implied otherwise would be the kind of overclaim this product is
 * supposed to avoid.
 */
import {
  accessFor,
  contextFor,
  principalIds,
  principalsHeldBy,
  readingPrincipal,
  wrapListFor,
  type Config,
  type Dataset,
  type Process,
  type User,
  type WrapEntry,
} from '@mas/domain';
import {
  CryptoError,
  bucketTimestamp,
  encryptRecord,
  generateKeyPair,
  isWrappedTo,
  openRecord,
  toBase64Url,
  type EncryptedRecord,
  type KeyPair,
  type PrincipalId,
} from '@mas/crypto';

/** The store as a server holds it: ciphertext keyed by record id, and nothing else. */
export interface Vault {
  /** One encrypted record per process. The content is the process detail. */
  records: Map<string, EncryptedRecord>;
  /** Every principal's key pair. In production the private halves never leave their device. */
  keys: Map<PrincipalId, KeyPair>;
  /** Why each principal is on each record's wrap list, for the drawer and the audit entry. */
  wrapReasons: Map<string, WrapEntry[]>;
}

/**
 * Build the encrypted store from the seed.
 *
 * Every process's detail is serialised, encrypted under a fresh content key, and wrapped to the
 * principals `wrapListFor` produces. Nothing keeps the plaintext: the returned vault holds
 * ciphertext, and `openProcess` is the only way back.
 */
export function buildVault(data: Dataset, config: Config): Vault {
  const keys = new Map<PrincipalId, KeyPair>();
  const key = (id: PrincipalId, kind: Parameters<typeof generateKeyPair>[0]): KeyPair => {
    const existing = keys.get(id);
    if (existing) return existing;
    const pair = generateKeyPair(kind, id);
    keys.set(id, pair);
    return pair;
  };

  // A key for every principal the seed can produce, so a wrap list never names one that is missing.
  for (const user of data.users) {
    key(principalIds.user(user.id), 'user');
    key(principalIds.role(user.roleId, user.agency), 'role');
    key(principalIds.agency(user.agency), 'agency');
  }
  key(principalIds.escrow(), 'escrow');

  const records = new Map<string, EncryptedRecord>();
  const wrapReasons = new Map<string, WrapEntry[]>();

  for (const process of data.processes) {
    key(principalIds.case(process.id), 'case');
    const entries = wrapListFor(process, data.users, (user) =>
      accessFor(user, process, { rows: config.needToKnow, exclusions: config.exclusions }),
    );
    const recipients = entries.map((entry) => key(entry.principalId, 'user').publicKey);
    records.set(
      process.id,
      encryptRecord(
        {
          id: process.id,
          // Coarse on purpose: "mappa-process", never the stage or the title.
          type: `${process.type}-process`,
          classification: process.classification,
          generation: 1,
          // Bucketed to the day, so a burst of activity does not reveal an incident's timing.
          updatedAt: bucketTimestamp(process.openedAt),
          linkedIds: process.subjectIds,
        },
        JSON.stringify(process.detail),
        recipients,
      ),
    );
    wrapReasons.set(process.id, entries);
  }

  return { records, keys, wrapReasons };
}

/**
 * Read a process's detail, or throw.
 *
 * This is the only path from the store to a process's content, and it replaced the old arrangement
 * where a caller checked an access level and then rendered the record. `no-wrapped-key` is the
 * ordinary unentitled outcome and the UI renders the restricted state for it; anything else means
 * something is wrong and must be surfaced rather than shown as restricted.
 */
export function openProcess(vault: Vault, process: Process, user: User): Process['detail'] {
  const record = vault.records.get(process.id);
  if (!record) throw new CryptoError('no-wrapped-key', `No stored record for ${process.id}`);
  const principalId = readingPrincipal(user, record.wrappedKeys.map((wrap) => wrap.principalId));
  if (!principalId) throw new CryptoError('no-wrapped-key', `${user.id} holds no key for ${process.id}`);
  const pair = vault.keys.get(principalId);
  if (!pair) throw new CryptoError('no-wrapped-key', `No key material for principal ${principalId}`);
  return JSON.parse(openRecord(record, pair.privateKey, pair.publicKey)) as Process['detail'];
}

/**
 * Whether this user holds a key for a record. Reads only the wrap list, which is metadata, so it
 * tells the caller what the operator already knows and nothing more.
 *
 * Use it to choose a rendering, never to decide whether content may be shown: that decision is
 * `openProcess` succeeding.
 */
export function holdsKey(vault: Vault, processId: string, user: User): boolean {
  const record = vault.records.get(processId);
  if (!record) return false;
  return principalsHeldBy(user).some((principalId) => isWrappedTo(record, principalId));
}

/** One row of what a hosting provider, a DBA or an attacker with storage access actually sees. */
export interface ServerViewRow {
  id: string;
  type: string;
  classification: string;
  generation: number;
  updatedAt: string;
  linkedIds: string[];
  /** How many principals hold a key. The count is visible; who they are is opaque. */
  keyHolders: number;
  /** The opaque principal identifiers, exactly as stored. */
  principalIds: string[];
  /** The first characters of the ciphertext, which is all there is to show. */
  ciphertextPreview: string;
  ciphertextBytes: number;
}

/**
 * The store as the operator sees it.
 *
 * This must be honest. A version that showed only ciphertext would be a lie, and the one person in
 * the room who knows that is the one who needs convincing. Every field here is genuinely visible to
 * anyone with storage access, and the set matches the leakage table in docs/THREAT-MODEL.md section
 * 3 exactly: a test asserts that it does.
 */
export function serverView(vault: Vault): ServerViewRow[] {
  return [...vault.records.values()].map((record) => ({
    id: record.metadata.id,
    type: record.metadata.type,
    classification: record.metadata.classification,
    generation: record.metadata.generation,
    updatedAt: record.metadata.updatedAt,
    linkedIds: record.metadata.linkedIds,
    keyHolders: record.wrappedKeys.length,
    principalIds: record.wrappedKeys.map((wrap) => wrap.principalId),
    ciphertextPreview: toBase64Url(record.sealed.ciphertext).slice(0, 64),
    ciphertextBytes: record.sealed.ciphertext.length,
  }));
}

/** The context a record carries, so the process screen can build the access result it renders from. */
export function processContext(process: Process, config: Config, user: User) {
  return { context: contextFor(process), access: accessFor(user, process, { rows: config.needToKnow, exclusions: config.exclusions }) };
}

/** What a read attempt produced: the detail, or the reason it could not be opened. */
export interface DecryptedProcess {
  detail?: Process['detail'];
  /** Undefined on success. `no-wrapped-key` is the ordinary unentitled outcome. */
  failure?: CryptoError['reason'];
}

/**
 * Read a process's detail for a screen, turning a throw into a value the UI can render.
 *
 * Break-glass is the one path that reaches a record the reader holds no key for. In this mockup the
 * grant reconstructs the escrow key, which is why an active grant is passed in rather than inferred:
 * the reconstruction is a deliberate, audited act and the code should read that way. In production
 * it requires two escrow holders in different organisations and produces a signed audit entry naming
 * both, and the reconstructed key lives in memory for the existing four-hour window and no longer.
 */
export function readProcessDetail(vault: Vault, process: Process, user: User, breakGlassActive: boolean): DecryptedProcess {
  try {
    return { detail: openProcess(vault, process, user) };
  } catch (error) {
    const failure = error instanceof CryptoError ? error.reason : 'decrypt-failed';
    if (failure !== 'no-wrapped-key' || !breakGlassActive) return { failure };
    // Break-glass: open through escrow instead. Audited by the caller that granted it.
    const record = vault.records.get(process.id);
    const escrow = vault.keys.get(principalIds.escrow());
    if (!record || !escrow) return { failure };
    try {
      return { detail: JSON.parse(openRecord(record, escrow.privateKey, escrow.publicKey)) as Process['detail'] };
    } catch {
      return { failure: 'unwrap-failed' };
    }
  }
}
