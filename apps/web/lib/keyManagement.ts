/**
 * Key management, which is where systems like this actually fail.
 *
 * The cryptography in @mas/crypto is the easy part: it is audited primitives composed carefully, and
 * it either works or it does not. What breaks encrypted systems in the field is everything around
 * the keys. A practitioner loses a laptop on a Friday and cannot work until Wednesday. A key server
 * is unreachable at three in the morning on a bank holiday and the out-of-hours team cannot open a
 * safety plan. A leaver keeps their keys for a year because nobody remembered the checklist. Each of
 * those is a safety incident in this domain, and each is a failure of process rather than of maths.
 *
 * So the flows here are first-class and tested, not helpers bolted on afterwards:
 *
 *   Enrolment      a new device needs an existing one or two colleagues, and a fingerprint read back
 *   Recovery       a lost device is replaced within the hour, not the week
 *   Escrow         two holders in different organisations, always audited, never one administrator
 *   Break-glass    the same, with the reconstructed key living only for the configured window
 *   Disclosure     the same again, and the reason the whole design is lawful
 *   Offline        a cached grace period, because public protection does not stop for connectivity
 *   Leavers        revoke, remove, rotate, and keep the signatures verifiable
 */
import {
  ESCROW_SHARES,
  ESCROW_THRESHOLD,
  combine,
  randomBytes,
  sign,
  split,
  toBase64Url,
  utf8,
  type Share,
  type Signature,
  type SigningKeyPair,
} from '@mas/crypto';
import { isExcludedParty, type Agency, type Exclusion, type Process, type Relationship, type RoleId, type User } from '@mas/domain';

/* ------------------------------------------------------------------ enrolment */

/** A device enrolled to a user. Listed in Settings with last use, and revocable by the user. */
export interface Device {
  id: string;
  userId: string;
  label: string;
  enrolledAt: string;
  lastUsedAt: string;
  /** Where it was last used, so an unexpected place is visible. Coarse: a place name, not a position. */
  lastUsedPlace: string;
  revokedAt?: string;
  /** How the enrolment was approved. */
  approvedBy: 'existing-device' | 'two-colleagues';
  approverIds: string[];
}

/**
 * A short fingerprint of a device's public key, read aloud by the approver.
 *
 * Six groups of four characters from the key itself. The approver reads it back to the person
 * enrolling, which is what stops an enrolment being silently redirected to an attacker's device: an
 * attacker can intercept the request but cannot make their key produce someone else's fingerprint.
 */
export function deviceFingerprint(publicKey: Uint8Array): string {
  const text = toBase64Url(publicKey).toUpperCase().replace(/[^A-Z0-9]/g, '');
  return Array.from({ length: 6 }, (_, i) => text.slice(i * 4, i * 4 + 4)).join(' ');
}

/** What an enrolment needs before it can complete. */
export interface EnrolmentRequest {
  userId: string;
  deviceLabel: string;
  fingerprint: string;
  /** An existing enrolled device of this user's, or two colleagues who have approved. */
  approvals: string[];
  approvedBy: 'existing-device' | 'two-colleagues';
}

/**
 * Whether an enrolment has what it needs. One existing device of the user's own, or two colleagues.
 *
 * Two colleagues rather than one, for the same reason escrow is split: one person should not be able
 * to add a device to someone else's account, whether through malice or through being talked into it
 * over the phone.
 */
export function enrolmentReady(request: EnrolmentRequest): boolean {
  return request.approvedBy === 'existing-device' ? request.approvals.length >= 1 : request.approvals.length >= 2;
}

/* --------------------------------------------------------------------- escrow */

/** Who holds an escrow share. Seeded across five organisations, per docs/THREAT-MODEL.md 1.9. */
export interface EscrowHolder {
  shareIndex: number;
  roleId: RoleId;
  agency: Agency;
  /** The organisation, which is what has to differ between the two who act. */
  organisation: string;
  /**
   * Who currently holds the share, as far as the platform knows them: a platform account, a person
   * record, or a name. The exclusion check needs an identity to match against the register, and the
   * register records people all three ways, so all three are carried and all three are checked. A
   * share held by a role with nobody named against it cannot be checked at all.
   */
  userId?: string;
  personId?: string;
  name?: string;
}

/**
 * The seeded holders: the MAPPA Coordinator, the Chief Social Work Officer, the health board
 * Caldicott guardian, the police public protection superintendent and the Adult Protection
 * Committee lead officer.
 *
 * Five organisations with different lines of accountability, which is the whole control. Five people
 * in one council would satisfy the threshold and defeat the purpose.
 */
export const ESCROW_HOLDERS: EscrowHolder[] = [
  { shareIndex: 1, roleId: 'mappa-coordinator', agency: 'police', organisation: 'MAPPA Strategic Oversight Group' },
  { shareIndex: 2, roleId: 'cswo', agency: 'social-work', organisation: 'Clydeshore Council' },
  { shareIndex: 3, roleId: 'caldicott-guardian', agency: 'health', organisation: 'NHS Clydeshore' },
  { shareIndex: 4, roleId: 'detective-sergeant-ppu', agency: 'police', organisation: 'Police Scotland' },
  { shareIndex: 5, roleId: 'apc-lead-officer', agency: 'social-work', organisation: 'Adult Protection Committee' },
];

/** Why the escrow key was reconstructed. A fixed list: there is no "other". */
export const ESCROW_PURPOSES = ['statutory-disclosure', 'break-glass', 'recovery'] as const;
export type EscrowPurpose = (typeof ESCROW_PURPOSES)[number];

export interface EscrowRequest {
  purpose: EscrowPurpose;
  /** What is being reached, and why. Recorded verbatim on the audit entry. */
  reason: string;
  /** The lawful basis, exactly as every other share in the product records one. */
  lawfulBasis: string;
  targetId: string;
  /** The two holders acting, who must be in different organisations. */
  holders: EscrowHolder[];
  at: string;
}

export type EscrowRefusal = 'threshold-not-met' | 'same-organisation' | 'no-reason' | 'no-lawful-basis' | 'excluded-holder';

export interface EscrowDecision {
  ok: boolean;
  refusal?: EscrowRefusal;
  /** The holders who must be told this happened: everyone who did not act. */
  notify: EscrowHolder[];
  /** The holder who is an excluded party on the record, when that is what refused it. */
  excluded?: EscrowHolder;
}

/**
 * Whether an escrow request may proceed.
 *
 * Five conditions. Two matter more than the rest.
 *
 * Two holders from the same organisation would meet the cryptographic threshold and defeat the
 * governance control, so that is refused here rather than left to a policy document nobody reads at
 * two in the morning.
 *
 * And a holder who is themselves an excluded party on the record being opened must not be one of the
 * two. An escrow holder who is the perpetrator's relative, or a named victim on the MAPPA case,
 * reconstructing the key for that case is remote, and the check is cheap, and the register already
 * records exactly that relationship. Refusing in code costs nothing and closes it; leaving it to the
 * holders to notice about themselves closes nothing.
 */
export function escrowDecision(request: EscrowRequest, target?: Process, options: { exclusions?: Exclusion[]; relationships?: Relationship[] } = {}): EscrowDecision {
  const notify = ESCROW_HOLDERS.filter((holder) => !request.holders.some((acting) => acting.shareIndex === holder.shareIndex));
  if (request.holders.length < ESCROW_THRESHOLD) return { ok: false, refusal: 'threshold-not-met', notify };
  const organisations = new Set(request.holders.map((holder) => holder.organisation));
  if (organisations.size < request.holders.length) return { ok: false, refusal: 'same-organisation', notify };
  if (target) {
    const excluded = request.holders.find((holder) => {
      if (!holder.userId && !holder.personId && !holder.name) return false;
      return isExcludedParty(target, { userId: holder.userId, personId: holder.personId, name: holder.name }, options.exclusions, target.stage, options.relationships) !== null;
    });
    if (excluded) return { ok: false, refusal: 'excluded-holder', notify, excluded };
  }
  if (request.reason.trim().length < 15) return { ok: false, refusal: 'no-reason', notify };
  if (request.lawfulBasis.trim().length === 0) return { ok: false, refusal: 'no-lawful-basis', notify };
  return { ok: true, notify };
}

/** The bytes an escrow audit entry is signed over, by both holders. */
export function escrowStatement(request: EscrowRequest): Uint8Array {
  const holders = request.holders.map((holder) => `${holder.roleId}@${holder.organisation}`).join(' and ');
  return utf8(`person360/v1/escrow|${request.purpose}|${request.targetId}|${request.at}|${holders}|${request.reason}|${request.lawfulBasis}`);
}

/** An escrow use, signed by both holders so neither can later say they were not there. */
export interface EscrowUse {
  request: EscrowRequest;
  signatures: Signature[];
}

export function signEscrowUse(request: EscrowRequest, keys: readonly SigningKeyPair[]): EscrowUse {
  const statement = escrowStatement(request);
  // The long horizon: a disclosure made under a sheriff's order in 2026 may be questioned in 2050.
  return { request, signatures: keys.map((key) => sign(statement, key, 'long')) };
}

/** Split the escrow key across the five holders. Called once, at partnership set-up. */
export function splitEscrowKey(key: Uint8Array): Share[] {
  return split(key, ESCROW_THRESHOLD, ESCROW_SHARES);
}

/** Reconstruct from two shares. Refuses before it computes anything if the request is not permitted. */
export function reconstructEscrowKey(shares: readonly Share[], request: EscrowRequest, target?: Process, options: { exclusions?: Exclusion[]; relationships?: Relationship[] } = {}): Uint8Array {
  const decision = escrowDecision(request, target, options);
  if (!decision.ok) throw new Error(`Escrow refused: ${decision.refusal}`);
  return combine(shares, ESCROW_THRESHOLD);
}

/* ------------------------------------------------------------------- recovery */

export interface RecoveryRequest {
  userId: string;
  newDeviceLabel: string;
  fingerprint: string;
  /** How the person was identified. Recorded, because this is the step an attacker would target. */
  identityVerifiedBy: string;
  at: string;
}

/**
 * A recovery: re-enrol a device and rewrap the user key from escrow.
 *
 * The requirement is an hour, not a week. An untested recovery path is the single most common way an
 * encrypted system becomes unavailable, and unavailability in this domain is a safety incident and,
 * per the ICO, potentially a breach in its own right.
 */
/**
 * The cases a recovery must not restore.
 *
 * Recovery rewraps the user's keys from escrow, which would hand back everything they held. If they
 * are an excluded party on one of those cases, that case is not theirs to have back: the exclusion
 * outlived the device. The same register answers it, and the recovery flow lists what it withheld
 * rather than restoring quietly and leaving somebody to find out later.
 */
export function casesWithheldFromRecovery(
  recovery: RecoveryRequest,
  processes: readonly Process[],
  options: { exclusions?: Exclusion[]; relationships?: Relationship[] } = {},
): Process[] {
  // The id may be an account or a person record depending on how the register recorded them, so both
  // are offered; `isExcludedParty` matches whichever it holds and ignores the other.
  return processes.filter((process) => isExcludedParty(process, { userId: recovery.userId, personId: recovery.userId }, options.exclusions, process.stage, options.relationships) !== null);
}

export function recoveryEscrowRequest(recovery: RecoveryRequest, holders: EscrowHolder[]): EscrowRequest {
  return {
    purpose: 'recovery',
    reason: `Device recovery for ${recovery.userId}, identity verified by ${recovery.identityVerifiedBy}`,
    lawfulBasis: 'Article 6(1)(e) public task: restoring a practitioner\'s access to records they are entitled to',
    targetId: recovery.userId,
    holders,
    at: recovery.at,
  };
}

/* -------------------------------------------------------- offline grace period */

/** Seeded at 72 hours. Configurable: see docs/THREAT-MODEL.md 1.6 on the trade this makes. */
export const OFFLINE_GRACE_HOURS = 72;

export interface OfflineState {
  /** When the client last reached the key service. */
  lastSyncAt: string;
  graceHours: number;
}

export interface OfflineValidity {
  /** Whether cached keys still open the cases this user already had. */
  valid: boolean;
  hoursRemaining: number;
  /** True once inside the last quarter of the window, when the status bar starts saying so. */
  warning: boolean;
}

/**
 * How much offline validity remains.
 *
 * Public protection runs at three in the morning on a bank holiday, sometimes from a car with one
 * bar of signal. A key service that is unreachable then is a safety incident and will be reported as
 * one, so a practitioner already on a case keeps working from cached wrapped keys for the grace
 * period. New entitlements need connectivity, and the interface says which is which rather than
 * failing silently in a way that looks like the record is empty.
 */
export function offlineValidity(state: OfflineState, now: Date): OfflineValidity {
  const elapsedHours = (now.getTime() - new Date(state.lastSyncAt).getTime()) / 3_600_000;
  const remaining = state.graceHours - elapsedHours;
  return { valid: remaining > 0, hoursRemaining: Math.max(0, Math.floor(remaining)), warning: remaining > 0 && remaining <= state.graceHours / 4 };
}

/* -------------------------------------------------------------------- leavers */

/** One step of the leaver checklist, which exists because this is the step that gets forgotten. */
export interface LeaverStep {
  id: 'revoke-devices' | 'remove-from-roles' | 'rotate-case-keys' | 'retain-audit';
  done: boolean;
  /** How many things the step covers, so the checklist says what it is about to do. */
  count: number;
}

export interface LeaverPlan {
  user: User;
  steps: LeaverStep[];
  /** Complete only when every step is done. A partial leaver is the failure mode. */
  complete: boolean;
}

/**
 * The leaver checklist.
 *
 * Revoke the devices, remove from the roles, rotate every case key they held, and *retain* the
 * historical audit entries and signatures. The last is not an oversight: signature verification
 * needs only the public key, so a leaver's entries stay verifiable forever, which is exactly what an
 * inspector or a Learning Review needs years later.
 *
 * Rotation is the expensive step and the one that would be skipped under time pressure. It is on the
 * checklist with a count, so skipping it is a visible choice rather than an omission.
 */
export function leaverPlan(user: User, devices: readonly Device[], caseIds: readonly string[], roleCount: number, auditCount: number): LeaverPlan {
  const steps: LeaverStep[] = [
    { id: 'revoke-devices', done: false, count: devices.filter((device) => device.userId === user.id && !device.revokedAt).length },
    { id: 'remove-from-roles', done: false, count: roleCount },
    { id: 'rotate-case-keys', done: false, count: caseIds.length },
    { id: 'retain-audit', done: true, count: auditCount },
  ];
  return { user, steps, complete: steps.every((step) => step.done) };
}

/** Mark a step done and recompute completeness. */
export function completeStep(plan: LeaverPlan, id: LeaverStep['id']): LeaverPlan {
  const steps = plan.steps.map((step) => (step.id === id ? { ...step, done: true } : step));
  return { ...plan, steps, complete: steps.every((step) => step.done) };
}

/** A fresh escrow key, for partnership set-up and for rotation. */
export function generateEscrowKey(): Uint8Array {
  return randomBytes(32);
}
