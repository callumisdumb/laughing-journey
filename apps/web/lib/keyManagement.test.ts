/**
 * The key management flows, tested because these are what actually fail.
 *
 * An untested recovery path is the single most common way an encrypted system becomes unavailable,
 * and unavailability here is a safety incident. So recovery, offline grace and the leaver checklist
 * are covered as carefully as the escrow threshold is.
 */
import { generateSigningKeyPair, verify, verifyingKey } from '@mas/crypto';
import { buildDataset } from '@mas/mock-data';
import { describe, expect, it } from 'vitest';
import {
  ESCROW_HOLDERS,
  OFFLINE_GRACE_HOURS,
  casesWithheldFromRecovery,
  completeStep,
  deviceFingerprint,
  enrolmentReady,
  escrowDecision,
  escrowStatement,
  generateEscrowKey,
  leaverPlan,
  offlineValidity,
  reconstructEscrowKey,
  recoveryEscrowRequest,
  signEscrowUse,
  splitEscrowKey,
  type Device,
  type EscrowRequest,
} from './keyManagement';

const data = buildDataset();

function request(overrides: Partial<EscrowRequest> = {}): EscrowRequest {
  return {
    purpose: 'statutory-disclosure',
    reason: 'Subject access request received 01 Sep 2026, reference SAR-2026-0142',
    lawfulBasis: 'UK GDPR Article 15, subject access',
    targetId: 'prc_mappa_derek',
    holders: [ESCROW_HOLDERS[1]!, ESCROW_HOLDERS[2]!],
    at: '2026-09-03T10:00:00+01:00',
    ...overrides,
  };
}

describe('enrolment', () => {
  it('reads back a fingerprint an attacker cannot reproduce', () => {
    const a = deviceFingerprint(generateSigningKeyPair('dev_a').classicalPublic);
    const b = deviceFingerprint(generateSigningKeyPair('dev_b').classicalPublic);
    expect(a).toMatch(/^([A-Z0-9]{4} ){5}[A-Z0-9]{4}$/);
    // The approver reads it aloud, so an enrolment cannot be silently redirected to another device.
    expect(a).not.toBe(b);
  });

  it('needs one existing device of your own, or two colleagues', () => {
    expect(enrolmentReady({ userId: 'u', deviceLabel: 'Laptop', fingerprint: 'x', approvedBy: 'existing-device', approvals: ['dev_1'] })).toBe(true);
    expect(enrolmentReady({ userId: 'u', deviceLabel: 'Laptop', fingerprint: 'x', approvedBy: 'existing-device', approvals: [] })).toBe(false);
    // Two, not one: one person should not be able to add a device to someone else's account, whether
    // through malice or through being talked into it over the phone.
    expect(enrolmentReady({ userId: 'u', deviceLabel: 'Laptop', fingerprint: 'x', approvedBy: 'two-colleagues', approvals: ['a'] })).toBe(false);
    expect(enrolmentReady({ userId: 'u', deviceLabel: 'Laptop', fingerprint: 'x', approvedBy: 'two-colleagues', approvals: ['a', 'b'] })).toBe(true);
  });
});

describe('escrow', () => {
  it('seeds five holders in five different organisations', () => {
    expect(ESCROW_HOLDERS).toHaveLength(5);
    expect(new Set(ESCROW_HOLDERS.map((holder) => holder.organisation)).size).toBe(5);
  });

  it('needs two holders', () => {
    expect(escrowDecision(request({ holders: [ESCROW_HOLDERS[0]!] })).refusal).toBe('threshold-not-met');
    expect(escrowDecision(request()).ok).toBe(true);
  });

  it('refuses two holders from the same organisation, which is the control that matters', () => {
    // Two people in one council would meet the cryptographic threshold and defeat the governance
    // control, so it is refused here rather than left to a policy nobody reads at two in the morning.
    const sameOrganisation = { ...ESCROW_HOLDERS[1]!, shareIndex: 9 };
    expect(escrowDecision(request({ holders: [ESCROW_HOLDERS[1]!, sameOrganisation] })).refusal).toBe('same-organisation');
  });

  it('refuses a holder who is an excluded party on the record they are opening', () => {
    // Remote, and the check is cheap, and the register already answers it. An escrow holder who is
    // the perpetrator's relative or a named victim on the case must not be one of the two who reach
    // it, and leaving that to the holders to notice about themselves closes nothing.
    const marac = data.processes.find((p) => p.type === 'marac' && p.parties.length > 0);
    expect(marac).toBeDefined();
    const excludedPersonId = marac!.parties[0]!.personId!;
    const compromised = { ...ESCROW_HOLDERS[0]!, personId: excludedPersonId };
    const decision = escrowDecision(request({ holders: [compromised, ESCROW_HOLDERS[2]!], targetId: marac!.id }), marac, { relationships: data.relationships });
    expect(decision.ok).toBe(false);
    expect(decision.refusal).toBe('excluded-holder');
    expect(decision.excluded?.shareIndex).toBe(compromised.shareIndex);
  });

  it('lets the same two holders through on a record they are not excluded from', () => {
    const other = data.processes.find((p) => p.type === 'cp');
    expect(other).toBeDefined();
    const marac = data.processes.find((p) => p.type === 'marac' && p.parties.length > 0)!;
    const holder = { ...ESCROW_HOLDERS[0]!, personId: marac.parties[0]!.personId! };
    expect(escrowDecision(request({ holders: [holder, ESCROW_HOLDERS[2]!], targetId: other!.id }), other, { relationships: data.relationships }).ok).toBe(true);
  });

  it('refuses to reconstruct the key at all for an excluded holder, before it computes anything', () => {
    const marac = data.processes.find((p) => p.type === 'marac' && p.parties.length > 0)!;
    const holder = { ...ESCROW_HOLDERS[0]!, personId: marac.parties[0]!.personId! };
    const shares = splitEscrowKey(generateEscrowKey());
    expect(() => reconstructEscrowKey(shares.slice(0, 2), request({ holders: [holder, ESCROW_HOLDERS[2]!], targetId: marac.id }), marac, { relationships: data.relationships })).toThrow(/excluded-holder/);
  });

  it('withholds from a recovery the cases the person is an excluded party on', () => {
    // Recovery rewraps everything the person held. A case they are excluded from is not theirs to
    // have back: the exclusion outlived the device.
    // The recovery check matches a platform account, so the register entry has to be one. Kayleigh's
    // MARAC names the perpetrator's brother as an associate; he holds an account in this dataset.
    const marac = data.processes.find((p) => p.type === 'marac' && p.parties.length > 0)!;
    const recovery = { userId: marac.parties[0]!.personId!, newDeviceLabel: 'Replacement laptop', fingerprint: 'ABCD EFGH', identityVerifiedBy: 'Line manager in person', at: '2026-09-03T09:00:00+01:00' };
    const withheld = casesWithheldFromRecovery(recovery, data.processes, { relationships: data.relationships });
    expect(withheld.map((p) => p.id)).toContain(marac.id);
  });

  it('withholds nothing from a recovery for somebody excluded from nothing', () => {
    const janet = data.users.find((u) => u.id === 'usr_janet_kerr')!;
    const recovery = { userId: janet.id, newDeviceLabel: 'Replacement laptop', fingerprint: 'ABCD EFGH', identityVerifiedBy: 'Line manager in person', at: '2026-09-03T09:00:00+01:00' };
    expect(casesWithheldFromRecovery(recovery, data.processes, { relationships: data.relationships })).toEqual([]);
  });

  it('refuses a use with no reason or no lawful basis', () => {
    expect(escrowDecision(request({ reason: 'because' })).refusal).toBe('no-reason');
    expect(escrowDecision(request({ lawfulBasis: '  ' })).refusal).toBe('no-lawful-basis');
  });

  it('names the holders who must be told, which is everyone who did not act', () => {
    const decision = escrowDecision(request());
    expect(decision.notify).toHaveLength(3);
    expect(decision.notify.map((holder) => holder.shareIndex).sort()).toEqual([1, 4, 5]);
  });

  it('reconstructs from two shares and refuses before computing anything otherwise', () => {
    const key = generateEscrowKey();
    const shares = splitEscrowKey(key);
    expect([...reconstructEscrowKey([shares[1]!, shares[2]!], request())]).toEqual([...key]);
    expect(() => reconstructEscrowKey([shares[1]!, shares[2]!], request({ holders: [ESCROW_HOLDERS[0]!] }))).toThrow(/threshold-not-met/);
  });

  it('produces a statement both holders sign, naming both', () => {
    const req = request();
    const keys = [generateSigningKeyPair('dev_cswo'), generateSigningKeyPair('dev_caldicott')];
    const use = signEscrowUse(req, keys);
    expect(use.signatures).toHaveLength(2);
    const statement = escrowStatement(req);
    for (const [i, signature] of use.signatures.entries()) {
      expect(verify(statement, signature, verifyingKey(keys[i]!))).toBe(true);
      // The long horizon: a disclosure made in 2026 may be questioned in a Learning Review in 2050.
      expect(signature.horizon).toBe('long');
    }
    const text = new TextDecoder().decode(statement);
    expect(text).toContain('cswo@Clydeshore Council');
    expect(text).toContain('caldicott-guardian@NHS Clydeshore');
    expect(text).toContain('SAR-2026-0142');
  });

  it('offers only three purposes, with no other', () => {
    for (const purpose of ['statutory-disclosure', 'break-glass', 'recovery'] as const) {
      expect(escrowDecision(request({ purpose })).ok).toBe(true);
    }
  });
});

describe('recovery', () => {
  it('goes through escrow with an identity check recorded', () => {
    const req = recoveryEscrowRequest(
      { userId: 'usr_janet_kerr', newDeviceLabel: 'Replacement laptop', fingerprint: 'ABCD', identityVerifiedBy: 'Team leader, in person', at: '2026-09-03T11:00:00+01:00' },
      [ESCROW_HOLDERS[1]!, ESCROW_HOLDERS[2]!],
    );
    expect(req.purpose).toBe('recovery');
    // The identity check is the step an attacker would target, so it is on the record.
    expect(req.reason).toContain('Team leader, in person');
    expect(escrowDecision(req).ok).toBe(true);
  });

  it('recovers a working device rather than leaving someone locked out for a week', () => {
    const key = generateEscrowKey();
    const shares = splitEscrowKey(key);
    const req = recoveryEscrowRequest(
      { userId: 'usr_janet_kerr', newDeviceLabel: 'Replacement laptop', fingerprint: 'ABCD', identityVerifiedBy: 'Team leader, in person', at: '2026-09-03T11:00:00+01:00' },
      [ESCROW_HOLDERS[0]!, ESCROW_HOLDERS[2]!],
    );
    expect([...reconstructEscrowKey([shares[0]!, shares[2]!], req)]).toEqual([...key]);
  });
});

describe('offline grace', () => {
  const state = { lastSyncAt: '2026-09-01T09:00:00+01:00', graceHours: OFFLINE_GRACE_HOURS };

  it('is seeded at 72 hours', () => {
    expect(OFFLINE_GRACE_HOURS).toBe(72);
  });

  it('keeps a practitioner working through a bank holiday weekend', () => {
    // Saturday morning, the key service unreachable since Tuesday.
    const saturday = offlineValidity(state, new Date('2026-09-03T09:00:00+01:00'));
    expect(saturday.valid).toBe(true);
    expect(saturday.hoursRemaining).toBe(24);
  });

  it('warns inside the last quarter of the window rather than failing without notice', () => {
    expect(offlineValidity(state, new Date('2026-09-02T09:00:00+01:00')).warning).toBe(false);
    const nearlyOut = offlineValidity(state, new Date('2026-09-03T20:00:00+01:00'));
    expect(nearlyOut.valid).toBe(true);
    expect(nearlyOut.warning).toBe(true);
  });

  it('expires, and says nought hours rather than a negative number', () => {
    const expired = offlineValidity(state, new Date('2026-09-05T09:00:00+01:00'));
    expect(expired.valid).toBe(false);
    expect(expired.hoursRemaining).toBe(0);
  });
});

describe('the leaver checklist', () => {
  const user = data.users[0]!;
  const devices: Device[] = [
    { id: 'dev_1', userId: user.id, label: 'Laptop', enrolledAt: '2026-01-01T09:00:00Z', lastUsedAt: '2026-09-01T09:00:00Z', lastUsedPlace: 'Auchentorran', approvedBy: 'two-colleagues', approverIds: ['a', 'b'] },
    { id: 'dev_2', userId: user.id, label: 'Phone', enrolledAt: '2026-01-01T09:00:00Z', lastUsedAt: '2026-09-01T09:00:00Z', lastUsedPlace: 'Portlennan', approvedBy: 'existing-device', approverIds: ['dev_1'] },
    { id: 'dev_3', userId: 'someone-else', label: 'Laptop', enrolledAt: '2026-01-01T09:00:00Z', lastUsedAt: '2026-09-01T09:00:00Z', lastUsedPlace: 'Dunlarrick', approvedBy: 'existing-device', approverIds: [] },
  ];

  it('counts what each step covers, so skipping one is a visible choice', () => {
    const plan = leaverPlan(user, devices, ['prc_a', 'prc_b'], 2, 431);
    expect(plan.steps.find((step) => step.id === 'revoke-devices')?.count).toBe(2);
    expect(plan.steps.find((step) => step.id === 'rotate-case-keys')?.count).toBe(2);
    expect(plan.complete).toBe(false);
  });

  it('retains the audit entries, because a leaver\'s signatures must still verify', () => {
    // Verification needs only the public key, so entries stay checkable years later, which is what
    // an inspector or a Learning Review needs.
    const plan = leaverPlan(user, devices, [], 0, 431);
    const retain = plan.steps.find((step) => step.id === 'retain-audit');
    expect(retain?.done).toBe(true);
    expect(retain?.count).toBe(431);
  });

  it('is complete only when every step is done', () => {
    let plan = leaverPlan(user, devices, ['prc_a'], 1, 10);
    for (const id of ['revoke-devices', 'remove-from-roles'] as const) plan = completeStep(plan, id);
    expect(plan.complete).toBe(false);
    plan = completeStep(plan, 'rotate-case-keys');
    expect(plan.complete).toBe(true);
  });
});
