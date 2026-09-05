import type { Agency, RoleId } from '../enums';
import { ROLE_DEFINITIONS } from '../enums';
import { accessFor, type AccessOptions } from '../permissions/access';
import { isExcludedParty } from '../need-to-know/parties';
import type { Action } from '../schemas/action-plan';
import type { Exclusion } from '../schemas/config';
import type { Relationship } from '../schemas/person';
import type { Process } from '../schemas/process';
import type { User } from '../schemas/user';

/**
 * Who an action may be given to (task section 3).
 *
 * An owner is a named person or every holder of a role in an agency. Either way the case has to
 * permit them: an excluded party is never an owner, by the same check that refuses them as a share
 * recipient, and a person who could not open the case cannot be asked to work on it. Membership is
 * not required: the resolver already says which agencies and roles may know about the case at its
 * stage, and an action is one of the ways they come to be involved.
 */
export interface AssignmentContext {
  users: readonly User[];
  exclusions: Exclusion[];
  relationships: Relationship[];
  rows: AccessOptions['rows'];
}

export type Assignee = { userId: string } | { agency: Agency; roleId: RoleId };

/** The refusal codes an assignment can raise, empty where it is allowed. */
export function assignmentRefusals(process: Process, assignee: Assignee, ctx: AssignmentContext): string[] {
  if ('userId' in assignee) {
    const user = ctx.users.find((u) => u.id === assignee.userId);
    if (!user) return ['assigneeMissing'];
    if (isExcludedParty(process, { userId: user.id }, ctx.exclusions, process.stage, ctx.relationships)) return ['assigneeExcluded'];
    // Oversight roles read across cases and do not hold them, so they do not hold the work either;
    // the chief social work officer signs off and may be asked to.
    const oversight = ROLE_DEFINITIONS[user.roleId]?.oversight;
    if (oversight && oversight !== 'sign-off') return ['assigneeOversight'];
    const access = accessFor(user, process, { rows: ctx.rows, exclusions: ctx.exclusions });
    if (access.level === 'none' || access.level === 'presence') return ['assigneeNoAccess'];
    return [];
  }
  if (!ROLE_DEFINITIONS[assignee.roleId]) return ['assigneeMissing'];
  const holders = ctx.users.filter((u) => u.agency === assignee.agency && u.roleId === assignee.roleId);
  if (holders.length === 0) return ['assigneeRoleEmpty'];
  const anyAllowed = holders.some((u) => assignmentRefusals(process, { userId: u.id }, ctx).length === 0);
  return anyAllowed ? [] : ['assigneeNoAccess'];
}

/** The people an action on this case may be given to, members first, then everybody else the case permits. */
export function assignableUsers(process: Process, ctx: AssignmentContext): User[] {
  const memberIds = new Set(process.members.map((m) => m.userId));
  const allowed = ctx.users.filter((u) => assignmentRefusals(process, { userId: u.id }, ctx).length === 0);
  return [...allowed.filter((u) => memberIds.has(u.id)), ...allowed.filter((u) => !memberIds.has(u.id))];
}

/** The role and agency pairs an action on this case may be given to: each pair with at least one permitted holder. */
export function assignableRoles(process: Process, ctx: AssignmentContext): Array<{ agency: Agency; roleId: RoleId; holders: number }> {
  const out = new Map<string, { agency: Agency; roleId: RoleId; holders: number }>();
  for (const user of assignableUsers(process, ctx)) {
    const key = `${user.agency}:${user.roleId}`;
    const entry = out.get(key) ?? { agency: user.agency, roleId: user.roleId, holders: 0 };
    entry.holders += 1;
    out.set(key, entry);
  }
  return [...out.values()];
}

/** Whether this person holds an action assigned to a role and not yet taken by anyone. */
export function holdsRoleAction(action: Pick<Action, 'ownerUserId' | 'ownerRoleId' | 'ownerAgency'>, user: Pick<User, 'agency' | 'roleId'>): boolean {
  return !action.ownerUserId && action.ownerRoleId !== undefined && action.ownerRoleId === user.roleId && action.ownerAgency === user.agency;
}

/** Whether an action sits on this person's list: owned by name, or assigned to a role they hold and untaken. */
export function ownsAction(action: Pick<Action, 'ownerUserId' | 'ownerRoleId' | 'ownerAgency'>, user: Pick<User, 'id' | 'agency' | 'roleId'>): boolean {
  return action.ownerUserId === user.id || holdsRoleAction(action, user);
}
