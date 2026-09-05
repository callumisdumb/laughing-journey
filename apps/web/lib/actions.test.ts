import { USR, buildDataset } from '@mas/mock-data';
import type { Action } from '@mas/domain';
import { describe, expect, it } from 'vitest';
import { actionsForUser, userById } from './selectors';

/**
 * An action assigned to a role sits on every holder's list until one of them takes it, and on
 * nobody else's; once taken it is the taker's alone.
 */
describe('role-assigned actions on the worklist', () => {
  const data = buildDataset();
  const roleAction: Action = { id: 'act_role', synthetic: true, processId: 'prc_marac_docherty', title: 'Check the housing file', ownerRoleId: 'housing-officer', ownerName: 'Housing officer, housing', ownerAgency: 'housing', due: '2026-09-12', status: 'open', createdAt: '2026-09-02T09:00:00Z', createdByName: 'Karen Findlay' };
  const withRole = { ...data, actions: [roleAction, ...data.actions] };
  it('appears for every holder of the role in the agency and for nobody else', () => {
    const mark = userById(data, USR.markHepburn)!;
    expect(actionsForUser(withRole, mark).some((a) => a.id === 'act_role')).toBe(true);
    const janet = userById(data, USR.janetKerr)!;
    expect(actionsForUser(withRole, janet).some((a) => a.id === 'act_role')).toBe(false);
  });
  it('leaves the role once somebody has taken it', () => {
    const taken = { ...withRole, actions: withRole.actions.map((a) => (a.id === 'act_role' ? { ...a, ownerUserId: USR.markHepburn, ownerRoleId: undefined, ownerName: 'Mark Hepburn' } : a)) };
    const mark = userById(data, USR.markHepburn)!;
    expect(actionsForUser(taken, mark).some((a) => a.id === 'act_role')).toBe(true);
    const otherHousing = data.users.find((u) => u.agency === 'housing' && u.roleId === 'housing-officer' && u.id !== USR.markHepburn);
    if (otherHousing) expect(actionsForUser(taken, otherHousing).some((a) => a.id === 'act_role')).toBe(false);
  });
});
