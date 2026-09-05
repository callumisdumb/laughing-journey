import { describe, expect, it } from 'vitest';
import { DEFAULT_CONFIG } from '../config/default-config';
import { OPENING_STAGE, buildOpeningProcess, openingClassification } from '../processes/open';
import type { Process } from '../schemas/process';
import type { User } from '../schemas/user';
import { assignableRoles, assignableUsers, assignmentRefusals, holdsRoleAction, ownsAction } from './assign';

const AT = '2026-09-02T09:00:00Z';
const users = [
  { id: 'usr_lead', agency: 'social-work', roleId: 'council-officer-asp' },
  { id: 'usr_janet', agency: 'social-work', roleId: 'social-worker-children' },
  { id: 'usr_gp', agency: 'health', roleId: 'gp' },
  { id: 'usr_mark', agency: 'housing', roleId: 'housing-officer' },
  { id: 'usr_admin', agency: 'social-work', roleId: 'system-administrator' },
  { id: 'usr_inspector', agency: 'regulator', roleId: 'inspector' },
] as unknown as User[];

function marac(): Process {
  const p = buildOpeningProcess(
    { id: 'prc_m', reference: 'MARAC-2026-9001', title: 'Victim', subjectIds: ['per_v'], leadAgency: 'police', leadUserId: 'usr_lead', stage: OPENING_STAGE.marac, stageHistory: [{ stage: 'referral', at: AT, byName: 'Opener' }], classification: openingClassification('marac').classification, accessRestriction: 'none', members: [{ userId: 'usr_lead', caseRole: 'Lead', agency: 'social-work', since: '2026-09-01', reason: 'Lead' }], clocks: [], openedAt: AT },
    { type: 'marac', subjectIds: ['per_v'], at: AT, source: 'Police', sourceAgency: 'police', summary: 'A referral in enough words.', byName: 'Opener', marac: { victimPersonId: 'per_v', perpetratorPersonId: 'per_p', childPersonIds: [], riskAssessmentId: 'ra', repeat: false, professionalJudgement: false } },
  );
  return { ...p, stage: 'research', parties: [{ userId: 'usr_mark', party: 'perpetrator-associates', label: 'Associate', source: 'manual', reason: 'Named on the DAQ' }] };
}

const ctx = { users, exclusions: DEFAULT_CONFIG.exclusions, relationships: [], rows: DEFAULT_CONFIG.needToKnow };

describe('who an action may be given to', () => {
  it('allows a member, refuses an excluded party by the same check that refuses them a share, and refuses somebody who cannot open the case', () => {
    const process = marac();
    expect(assignmentRefusals(process, { userId: 'usr_lead' }, ctx)).toEqual([]);
    expect(assignmentRefusals(process, { userId: 'usr_mark' }, ctx)).toEqual(['assigneeExcluded']);
    expect(assignmentRefusals(process, { userId: 'usr_inspector' }, ctx)).toEqual(['assigneeOversight']);
    expect(assignmentRefusals(process, { userId: 'usr_admin' }, ctx)).toEqual(['assigneeOversight']);
    expect(assignmentRefusals(process, { userId: 'usr_nobody' }, ctx)).toEqual(['assigneeMissing']);
  });
  it('allows a role when at least one holder is permitted, and refuses an empty one', () => {
    const process = marac();
    expect(assignmentRefusals(process, { agency: 'housing', roleId: 'housing-officer' }, ctx)).toEqual(['assigneeNoAccess']);
    expect(assignmentRefusals(process, { agency: 'social-work', roleId: 'council-officer-asp' }, ctx)).toEqual([]);
    expect(assignmentRefusals(process, { agency: 'education', roleId: 'education-cp-lead' }, ctx)).toEqual(['assigneeRoleEmpty']);
  });
  it('lists the permitted people members first, and the roles with a permitted holder', () => {
    const process = marac();
    const people = assignableUsers(process, ctx).map((u) => u.id);
    expect(people[0]).toBe('usr_lead');
    expect(people).not.toContain('usr_mark');
    expect(people).not.toContain('usr_admin');
    const roles = assignableRoles(process, ctx);
    expect(roles.some((r) => r.roleId === 'housing-officer')).toBe(false);
    expect(roles.find((r) => r.roleId === 'council-officer-asp')?.holders).toBe(1);
  });
  it('a role-assigned action sits on every holder\'s list until one of them takes it', () => {
    const action = { ownerRoleId: 'housing-officer' as const, ownerAgency: 'housing' as const };
    const mark = { id: 'usr_mark', agency: 'housing' as const, roleId: 'housing-officer' as const };
    expect(holdsRoleAction(action, mark)).toBe(true);
    expect(ownsAction(action, mark)).toBe(true);
    expect(ownsAction({ ...action, ownerUserId: 'usr_other' }, mark)).toBe(false);
    expect(ownsAction({ ownerUserId: 'usr_mark', ownerAgency: 'housing' }, mark)).toBe(true);
    expect(ownsAction(action, { id: 'usr_gp', agency: 'health', roleId: 'gp' })).toBe(false);
  });
});
