import { describe, expect, it } from 'vitest';
import type { AspProcess, MaracProcess, Process } from '../schemas/process';
import { applyReferralCorrections, referralFields, referralValue } from './referral';

const asp = { type: 'asp', detail: { concern: { receivedAt: '2026-08-20T09:00:00Z', source: 'Bank', sourceAgency: 'police', summary: 'Withdrawals nobody can account for.', sourceReference: 'REF-1' } } } as unknown as AspProcess;
const marac = { type: 'marac', detail: { referral: { receivedAt: '2026-08-20T09:00:00Z', referrerName: 'DC Sutherland', referringAgency: 'police', summary: 'Third call-out.', victimPersonId: 'per_v', perpetratorPersonId: 'per_p', childPersonIds: [], professionalJudgementReferral: false, repeat: true } } } as unknown as MaracProcess;

describe('referralFields', () => {
  it('offers the opening record of every type and never the subject or the perpetrator', () => {
    for (const type of ['asp', 'cp', 'marac', 'mappa', 'awi'] as const) {
      const ids = referralFields(type).map((f) => f.id);
      expect(ids.length).toBeGreaterThan(2);
      expect(ids.some((id) => /victim|perpetrator|subject|child/i.test(id)), type).toBe(false);
    }
  });
});

describe('referralValue', () => {
  it('reads a field, and an absent one as empty', () => {
    expect(referralValue(asp, 'concern.source')).toBe('Bank');
    expect(referralValue(asp, 'concern.nothing')).toBe('');
  });
});

describe('applyReferralCorrections', () => {
  it('corrects the fields that changed and leaves the rest of the record alone', () => {
    const result = applyReferralCorrections(asp, [
      { field: 'concern.source', value: 'Clydeshore Bank, branch manager' },
      { field: 'concern.summary', value: 'Withdrawals nobody can account for.' },
    ]);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const detail = result.detail as AspProcess['detail'];
    expect(detail.concern.source).toBe('Clydeshore Bank, branch manager');
    expect(detail.concern.summary).toBe('Withdrawals nobody can account for.');
    expect(detail.concern.sourceReference).toBe('REF-1');
    // The original is untouched: the correction is a new record, not an edit in place.
    expect(asp.detail.concern.source).toBe('Bank');
  });

  it('clears an optional field written empty', () => {
    const result = applyReferralCorrections(asp, [{ field: 'concern.sourceReference', value: '' }]);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect((result.detail as AspProcess['detail']).concern.sourceReference).toBeUndefined();
  });

  it('refuses a correction that changes nothing, and a field that is not correctable', () => {
    expect(applyReferralCorrections(asp, [{ field: 'concern.source', value: 'Bank' }])).toEqual({ ok: false, errors: ['referralUnchanged'] });
    expect(applyReferralCorrections(marac, [{ field: 'referral.perpetratorPersonId', value: 'per_other' }])).toEqual({ ok: false, errors: ['referralFieldNotCorrectable'] });
  });

  it('corrects a MARAC referral without touching the parties', () => {
    const result = applyReferralCorrections(marac, [{ field: 'referral.referrerName', value: 'DC E Sutherland' }]);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const detail = result.detail as MaracProcess['detail'];
    expect(detail.referral.referrerName).toBe('DC E Sutherland');
    expect(detail.referral.perpetratorPersonId).toBe('per_p');
    expect(detail.referral.victimPersonId).toBe('per_v');
  });

  it('works on every type the product opens', () => {
    const mappa = { type: 'mappa', detail: { notification: { at: '2026-07-01T09:00:00Z', source: 'SPS', byName: 'A Officer' } } } as unknown as Process;
    const result = applyReferralCorrections(mappa, [{ field: 'notification.source', value: 'HMP Dunlarrick' }]);
    expect(result.ok).toBe(true);
  });
});
