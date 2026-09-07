/**
 * From "may this user read it" to "which keys open it".
 *
 * This is the join between the need-to-know matrix and the cryptography, and it is the most
 * important thing in the refactor that introduced encryption.
 *
 * Before, `accessFor` returned a level and a caller decided what to do with it. That is a permission
 * the server chooses to honour: a caller that forgot to check, or checked the wrong field, rendered
 * the record anyway, and nothing but review would catch it. The functions here turn the same
 * decision into a key-wrapping list, so a record is encrypted to exactly the principals the matrix
 * entitles and an unentitled reader holds nothing that opens it. Entitlement and decryptability stop
 * being two facts that have to agree and become one fact.
 *
 * There is deliberately no `canRead` here and no boolean anywhere in this file. The access *level*
 * still exists, because presence, summary and full are different renderings and the UI needs to know
 * which to draw, but the level no longer gates the content: the content is gated by whether the
 * unwrap succeeds. See `openProcess` in the web app for the only path from a stored record to its
 * detail.
 */
import type { Agency, DetailLevel, RoleId } from '../enums';
import type { Process } from '../schemas/process';
import type { User } from '../schemas/user';
import type { AccessResult } from './access';

/**
 * A principal identifier as the crypto package understands it: opaque, and never a name or an email
 * address. The prefix says what kind of principal it is so the vault can find the right key.
 */
export type PrincipalId = string;

export const principalIds = {
  user: (userId: string): PrincipalId => `p:usr:${userId}`,
  role: (roleId: RoleId, agency: Agency): PrincipalId => `p:rol:${agency}:${roleId}`,
  agency: (agency: Agency): PrincipalId => `p:agy:${agency}`,
  case: (processId: string): PrincipalId => `p:cas:${processId}`,
  /** The escrow key, which every record is wrapped to so a lawful disclosure can always reach it. */
  escrow: (): PrincipalId => 'p:esc:partnership',
} as const;

/**
 * The principals a user holds keys for: themselves, their role in their agency, and their agency.
 *
 * A user holds these regardless of any particular record. Whether any of them opens a given record
 * is decided by whether that record was wrapped to one of them, which is what `wrapListFor` decides.
 */
export function principalsHeldBy(user: User): PrincipalId[] {
  return [principalIds.user(user.id), principalIds.role(user.roleId, user.agency), principalIds.agency(user.agency)];
}

/** Why a principal is on a record's wrap list, so the audit entry and the drawer can say. */
export interface WrapEntry {
  principalId: PrincipalId;
  /** The need-to-know row, case membership or rule that put them there. */
  reason: string;
  /** The detail level the matrix gives them, which decides what the UI renders, not what decrypts. */
  level: DetailLevel;
}

/**
 * The principals a process record must be wrapped to.
 *
 * Everyone the matrix entitles at summary level or better, plus the case key, plus escrow. Presence
 * is deliberately *not* on the list: presence means knowing a record exists and nothing about it,
 * which is exactly what an unentitled reader learns from the metadata anyway. Wrapping to a presence
 * reader would hand them the content and then ask the UI not to show it, which is the mistake this
 * whole refactor exists to make impossible.
 *
 * Escrow is always included. A record nobody can open is not secure, it is lost, and the ICO treats
 * personal data becoming inaccessible as a failure in its own right. See docs/THREAT-MODEL.md
 * section 2 on why the controller is not an adversary.
 */
export function wrapListFor(process: Process, users: readonly User[], accessOf: (user: User) => AccessResult): WrapEntry[] {
  const entries = new Map<PrincipalId, WrapEntry>();

  for (const user of users) {
    const access = accessOf(user);
    // 'none' holds no key, and neither does 'presence': see the note above.
    if (access.level === 'none' || access.level === 'presence') continue;
    const principalId = principalIds.user(user.id);
    if (!entries.has(principalId)) entries.set(principalId, { principalId, reason: access.reason, level: access.level });
  }

  // The case key, which is how a process is joined and left without touching every user's keys.
  entries.set(principalIds.case(process.id), { principalId: principalIds.case(process.id), reason: 'Case key', level: 'full' });
  entries.set(principalIds.escrow(), { principalId: principalIds.escrow(), reason: 'Escrow, split two of five', level: 'full' });

  return [...entries.values()];
}

/**
 * The first principal of this user's that appears on a record's wrap list, or undefined.
 *
 * Undefined is the ordinary unentitled case and the UI renders it as the restricted state. It is not
 * an error, and it is the state the design is built around.
 */
export function readingPrincipal(user: User, wrappedTo: readonly PrincipalId[]): PrincipalId | undefined {
  const held = new Set(principalsHeldBy(user));
  return wrappedTo.find((principalId) => held.has(principalId));
}
