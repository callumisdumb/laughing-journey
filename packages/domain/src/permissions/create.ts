/**
 * Who may create what, decided before the form is offered.
 *
 * A user who cannot create a thing should not be shown a form they cannot submit: gate at the
 * action, say why, and offer the route that does exist. A disabled Save button at the bottom of a
 * completed form is the version of this that wastes somebody's afternoon, and a form that submits
 * and then fails is worse.
 *
 * The rule is shaped on oversight rather than on a list of role names, because a list of role names
 * is wrong the first time a role is added and nobody extends it. A regulator, an inspector, the
 * Mental Welfare Commission and the Procurator Fiscal read this product and do not hold cases in it;
 * everybody who does hold cases can create the records their work produces.
 */
import { ROLE_DEFINITIONS, type RoleId } from '../enums';
import { tKey } from '@mas/messages';

export const CREATABLE = ['person', 'process', 'event', 'meeting', 'action', 'relationship'] as const;
export type CreatableEntity = (typeof CREATABLE)[number];

export type CreateDecision =
  | { allowed: true }
  | {
      allowed: false;
      /** Why, in the words the screen shows. */
      reason: string;
      /** What to do instead, because a refusal with no alternative is a dead end. */
      route: string;
    };

/** Oversight roles that read across cases and do not hold them. */
const READ_ONLY_OVERSIGHT: ReadonlyArray<NonNullable<(typeof ROLE_DEFINITIONS)[RoleId]['oversight']>> = ['read-only', 'audit', 'redacted'];

export function canCreate(roleId: RoleId, entity: CreatableEntity): CreateDecision {
  const role = ROLE_DEFINITIONS[roleId];
  if (!role) return { allowed: false, reason: tKey('permissions.create.unknownRole'), route: tKey('permissions.create.routeAskAdmin') };

  if (role.oversight && READ_ONLY_OVERSIGHT.includes(role.oversight)) {
    return { allowed: false, reason: tKey(`permissions.create.oversight.${role.oversight}`), route: tKey('permissions.create.routeReferral') };
  }

  // The system administrator configures the product and holds no case content (D-070). Letting the
  // account that edits the need-to-know matrix also create the records it governs is the separation
  // this product exists to demonstrate, given away for the sake of one convenience.
  if (roleId === 'system-administrator' && entity !== 'event') {
    return { allowed: false, reason: tKey('permissions.create.administrator'), route: tKey('permissions.create.routeAskPractitioner') };
  }

  return { allowed: true };
}
