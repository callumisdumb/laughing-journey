import { describe, expect, it } from 'vitest';
import { exclusionSchema, needToKnowRowSchema } from '../schemas/config';
import { EXCLUSIONS } from './exclusions';
import { DETAIL_RANK, NEED_TO_KNOW_ROWS, matchAudience, resolveNeedToKnow, rowApplies, rowsForProcess } from './resolve';

describe('need-to-know data', () => {
  it('every row and exclusion is valid', () => {
    for (const r of NEED_TO_KNOW_ROWS) expect(() => needToKnowRowSchema.parse(r)).not.toThrow();
    for (const e of EXCLUSIONS) expect(() => exclusionSchema.parse(e)).not.toThrow();
  });
  it('row ids are unique', () => {
    const ids = NEED_TO_KNOW_ROWS.map((r) => r.id);
    expect(new Set(ids).size).toBe(ids.length);
  });
  it('covers all five processes', () => {
    for (const t of ['asp', 'cp', 'marac', 'mappa', 'awi'] as const) expect(rowsForProcess(t).length).toBeGreaterThan(5);
  });
  it('ranks detail levels', () => {
    expect(DETAIL_RANK.full).toBeGreaterThan(DETAIL_RANK.summary);
    expect(DETAIL_RANK.summary).toBeGreaterThan(DETAIL_RANK.fields);
    expect(DETAIL_RANK.fields).toBeGreaterThan(DETAIL_RANK.presence);
  });
});

describe('resolveNeedToKnow', () => {
  it('applies conditions from flags', () => {
    const without = resolveNeedToKnow({ process: 'asp', stage: 'inquiry', flags: {} });
    const withPolice = resolveNeedToKnow({ process: 'asp', stage: 'inquiry', flags: { criminalElement: true } });
    expect(without.recipients.some((r) => r.agency === 'police')).toBe(false);
    expect(withPolice.recipients.some((r) => r.agency === 'police')).toBe(true);
    const police = withPolice.recipients.find((r) => r.agency === 'police');
    expect(police?.reason).toContain('criminal element');
  });
  it('resolves the referrer audience when known and drops it when unknown', () => {
    const unknown = resolveNeedToKnow({ process: 'asp', stage: 'concern', flags: {} });
    expect(unknown.recipients.some((r) => r.rowId === 'asp.concern.referrer')).toBe(false);
    const known = resolveNeedToKnow({ process: 'asp', stage: 'concern', flags: {}, referrerAgency: 'police' });
    const ref = known.recipients.find((r) => r.rowId === 'asp.concern.referrer');
    expect(ref?.agency).toBe('police');
    expect(ref?.detailLevel).toBe('summary');
    expect(ref?.reason).toBe('Adult concern recorded.');
  });
  it('returns MARAC exclusions at every stage', () => {
    const res = resolveNeedToKnow({ process: 'marac', stage: 'research', flags: {} });
    expect(res.exclusions.map((e) => e.party)).toEqual(expect.arrayContaining(['perpetrator', 'perpetrator-associates']));
  });
  it('returns stage-specific exclusions only at that stage', () => {
    const ird = resolveNeedToKnow({ process: 'cp', stage: 'ird', flags: {} });
    const cppm = resolveNeedToKnow({ process: 'cp', stage: 'cppm', flags: {} });
    expect(ird.exclusions.some((e) => e.party === 'parents-if-risk')).toBe(true);
    expect(cppm.exclusions.some((e) => e.party === 'parents-if-risk')).toBe(false);
  });
  it('MARAC research gives names and dates of birth only', () => {
    const res = resolveNeedToKnow({ process: 'marac', stage: 'research', flags: { children: true } });
    for (const r of res.recipients) {
      expect(r.detailLevel).toBe('fields');
      expect(r.fields).toContain('victim name and date of birth');
    }
  });
  it('rowApplies rejects other processes and stages', () => {
    const row = NEED_TO_KNOW_ROWS[0]!;
    expect(rowApplies(row, { process: 'mappa', stage: row.stage, flags: {} })).toBe(false);
    expect(rowApplies(row, { process: row.process, stage: 'exit', flags: {} })).toBe(false);
  });
});

describe('matchAudience', () => {
  it('returns null when nothing applies', () => {
    expect(matchAudience('education', 'education-cp-lead', { process: 'mappa', stage: 'notification', flags: {} })).toBeNull();
  });
  it('takes the highest level and unions fields', () => {
    const m = matchAudience('education', 'education-cp-lead', { process: 'cp', stage: 'investigation', flags: { schoolAge: true } });
    expect(m?.detailLevel).toBe('summary');
    expect(m?.fields).toContain('interim safety plan actions relevant to school');
    expect(m?.rowIds.length).toBe(2);
    expect(m?.lawfulBasisHints.length).toBeGreaterThan(0);
  });
  it('matches any-role rows', () => {
    const m = matchAudience('police', 'concern-hub-officer', { process: 'asp', stage: 'inquiry', flags: { criminalElement: true } });
    expect(m?.detailLevel).toBe('full');
  });
  it('does not match a role-specific row for a different role', () => {
    const m = matchAudience('health', 'midwife', { process: 'awi', stage: 'capacity-concern', flags: {} });
    expect(m).toBeNull();
  });
});
