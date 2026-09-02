import { describe, expect, it } from 'vitest';
import type { Process } from '../schemas/process';
import type { User } from '../schemas/user';
import { accessFor, canSee, contextFor } from './access';

function user(over: Partial<User>): User {
  return {
    id: 'usr_x',
    synthetic: true,
    givenName: 'Test',
    familyName: 'User',
    agency: 'social-work',
    roleId: 'social-worker-adults',
    jobTitle: 'Social worker',
    organisationId: 'org_1',
    base: 'Ardvale',
    email: 'test@example.invalid',
    phone: '01000 000000',
    processMemberships: [],
    caseMemberships: [],
    blurb: '',
    ...over,
  };
}

const aspBase = {
  id: 'prc_asp',
  synthetic: true as const,
  type: 'asp' as const,
  reference: 'ASP-0001',
  title: 'ASP',
  subjectIds: ['per_1'],
  leadAgency: 'social-work' as const,
  stage: 'inquiry' as const,
  stageHistory: [],
  status: 'open' as const,
  classification: 'official-sensitive' as const,
  openedAt: '2026-08-01T09:00:00+01:00',
  members: [{ userId: 'usr_member', caseRole: 'council officer', agency: 'social-work' as const, since: '2026-08-01', reason: 'allocated' }],
  clocks: [],
  linkedProcessIds: [],
  viewsRecordIds: [],
  riskAssessmentIds: [],
  flags: { criminalElement: true },
  excludedUserIds: ['usr_excluded'],
  detail: {
    concern: { receivedAt: '2026-08-01T09:00:00+01:00', source: 'Bank via police', sourceAgency: 'police' as const, summary: 'x', harmTypes: ['financial' as const], immediateSafety: 'none', policeInvolved: true },
    threePointTest: { assessedAt: '2026-08-01T10:00:00+01:00', byName: 'A', a: { met: 'yes' as const, reasoning: 'r' }, b: { met: 'yes' as const, reasoning: 'r' }, c: { met: 'yes' as const, reasoning: 'r' }, outcome: 'met' as const },
    ordersConsidered: [],
  },
};
const asp: Process = aspBase;

const mappa: Process = {
  ...aspBase,
  id: 'prc_mappa',
  type: 'mappa',
  reference: 'MAPPA-0001',
  stage: 'managed',
  classification: 'restricted',
  flags: {},
  members: [],
  excludedUserIds: [],
  detail: {
    category: 1,
    level: 2,
    levelHistory: [],
    leadResponsibleAuthority: 'police',
    visorReference: 'V-1',
    notification: { at: '2026-07-01T09:00:00+01:00', source: 'SPS', byName: 'B' },
    sonr: { subject: true, compliant: true },
    custody: {},
    licenceConditions: [],
    riskAssessmentIds: [],
    disclosures: [],
    preMeetingReturns: [],
    reviewSchedule: {},
  },
};

describe('accessFor', () => {
  it('denies excluded users outright', () => {
    const r = accessFor(user({ id: 'usr_excluded' }), asp);
    expect(r.level).toBe('none');
    expect(r.breakGlass).toBe('unavailable');
  });
  it('gives members full access', () => {
    const r = accessFor(user({ id: 'usr_member' }), asp);
    expect(r.level).toBe('full');
    expect(r.member).toBe(true);
    expect(r.reason).toContain('council officer');
  });
  it('gives inspectors a redacted full view', () => {
    const r = accessFor(user({ roleId: 'inspector', agency: 'regulator' }), asp);
    expect(r.level).toBe('full');
    expect(r.redacted).toBe(true);
  });
  it('gives oversight roles a summary', () => {
    expect(accessFor(user({ roleId: 'cswo' }), asp).level).toBe('summary');
    expect(accessFor(user({ roleId: 'apc-lead-officer' }), asp).level).toBe('summary');
  });
  it('gives audit and admin roles nothing', () => {
    expect(accessFor(user({ roleId: 'caldicott-guardian', agency: 'health' }), asp).level).toBe('none');
    expect(accessFor(user({ roleId: 'system-administrator' }), asp).level).toBe('none');
  });
  it('resolves need-to-know rows for the stage', () => {
    const r = accessFor(user({ agency: 'police', roleId: 'concern-hub-officer' }), asp);
    expect(r.level).toBe('full');
    expect(r.rowIds).toContain('asp.inquiry.police');
    expect(r.lawfulBasisHints.length).toBeGreaterThan(0);
  });
  it('resolves the referrer audience from the process', () => {
    const concern: Process = { ...asp, stage: 'concern', flags: {} };
    const r = accessFor(user({ agency: 'police', roleId: 'concern-hub-officer' }), concern);
    expect(r.level).toBe('summary');
    expect(r.rowIds).toContain('asp.concern.referrer');
  });
  it('gives presence when not on an ordinary case', () => {
    const r = accessFor(user({ agency: 'education', roleId: 'education-cp-lead' }), asp);
    expect(r.level).toBe('presence');
    expect(r.breakGlass).toBe('not-needed');
  });
  it('denies restricted records with break-glass for Responsible Authorities only', () => {
    const police = accessFor(user({ agency: 'police', roleId: 'concern-hub-officer' }), mappa);
    expect(police.level).toBe('none');
    expect(police.breakGlass).toBe('available');
    const education = accessFor(user({ agency: 'education', roleId: 'education-cp-lead' }), mappa);
    expect(education.level).toBe('none');
    expect(education.breakGlass).toBe('unavailable');
  });
  it('honours an active break-glass grant', () => {
    const r = accessFor(user({ agency: 'police', roleId: 'concern-hub-officer' }), mappa, { activeBreakGlass: ['prc_mappa'] });
    expect(r.level).toBe('full');
    expect(r.breakGlass).toBe('active');
  });
  it('gives the MAPPA lead RA full access from the rows', () => {
    const r = accessFor(user({ agency: 'police', roleId: 'offender-management' }), { ...mappa, stage: 'notification' });
    expect(r.level).toBe('full');
  });
  it('builds context for every process type', () => {
    expect(contextFor(asp).referrerAgency).toBe('police');
    expect(contextFor(mappa).referrerAgency).toBeUndefined();
    const cp: Process = { ...aspBase, type: 'cp', stage: 'ird', detail: { concern: { receivedAt: '2026-08-01T09:00:00+01:00', source: 'School', sourceAgency: 'education', summary: 'x' } } };
    expect(contextFor(cp).referrerAgency).toBe('education');
    const awi: Process = { ...aspBase, type: 'awi', stage: 'application', detail: { concern: { raisedAt: '2026-08-01T09:00:00+01:00', source: 'Ward', sourceAgency: 'health', decisionInQuestion: 'x', summary: 'x' }, capacityAssessments: [], orders: [], supervisionVisits: [], investigations: [] } };
    expect(contextFor(awi).referrerAgency).toBe('health');
    const marac: Process = { ...aspBase, type: 'marac', stage: 'referral', detail: { referral: { receivedAt: '2026-08-01T09:00:00+01:00', referringAgency: 'police', referrerName: 'x', riskAssessmentId: 'ra_1', professionalJudgementReferral: false, repeat: false, victimPersonId: 'per_v', perpetratorPersonId: 'per_p', childPersonIds: [], summary: 'x' }, researchRequests: [], idaa: { name: 'x', organisation: 'y' }, idaaFeedback: [], flags: [], links: { matacConsidered: false, dsdasConsidered: false }, safeLivesReturn: { referralSource: 'police', repeat: false, childrenCount: 0, outcomeCodes: [] } } };
    expect(contextFor(marac).referrerAgency).toBe('police');
  });
});

describe('canSee', () => {
  it('compares levels', () => {
    expect(canSee('full', 'summary')).toBe(true);
    expect(canSee('presence', 'summary')).toBe(false);
    expect(canSee('none', 'presence')).toBe(false);
  });
});
