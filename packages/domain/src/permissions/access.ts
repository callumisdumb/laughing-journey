import type { Agency, DetailLevel } from '../enums';
import { ROLE_DEFINITIONS } from '../enums';
import type { Process } from '../schemas/process';
import type { User } from '../schemas/user';
import { matchAudience, type ResolveContext } from '../need-to-know/resolve';
import type { NeedToKnowRow } from '../schemas/config';

export type AccessLevel = 'none' | DetailLevel;

export interface AccessResult {
  level: AccessLevel;
  /** Plain-language reason shown in the drawer and on restricted states. */
  reason: string;
  /** Named fields when level is 'fields' (or in addition to a summary). */
  fields: string[];
  rowIds: string[];
  lawfulBasisHints: string[];
  restricted: boolean;
  breakGlass: 'not-needed' | 'available' | 'unavailable' | 'active';
  /** Inspector view: full record with names redacted. */
  redacted: boolean;
  /** True when the user is on the case. */
  member: boolean;
}

export interface AccessOptions {
  rows?: NeedToKnowRow[];
  /** Active break-glass grants: process ids the user has opened with a reason, still within the window. */
  activeBreakGlass?: string[];
}

/** Agencies that may break glass on a restricted record (the MAPPA Responsible Authorities). */
export const BREAK_GLASS_AGENCIES: Agency[] = ['police', 'social-work', 'health', 'sps'];

function referrerAgencyOf(process: Process): Agency | undefined {
  switch (process.type) {
    case 'asp':
      return process.detail.concern.sourceAgency;
    case 'cp':
      return process.detail.concern.sourceAgency;
    case 'marac':
      return process.detail.referral.referringAgency;
    case 'awi':
      return process.detail.concern.sourceAgency;
    case 'mappa':
      return undefined;
  }
}

export function contextFor(process: Process): ResolveContext {
  return { process: process.type, stage: process.stage, flags: process.flags, referrerAgency: referrerAgencyOf(process) };
}

/**
 * Access is the intersection of what the agency may see for this process type and stage,
 * what the role can do, and whether the user is on the case. Default is deny.
 */
export function accessFor(user: User, process: Process, options: AccessOptions = {}): AccessResult {
  const restricted = process.classification === 'restricted';
  const base: Omit<AccessResult, 'level' | 'reason'> = {
    fields: [],
    rowIds: [],
    lawfulBasisHints: [],
    restricted,
    breakGlass: 'not-needed',
    redacted: false,
    member: false,
  };

  if (process.excludedUserIds.includes(user.id)) {
    return { ...base, level: 'none', reason: 'You must not receive information about this process.', breakGlass: 'unavailable' };
  }

  const membership = process.members.find((m) => m.userId === user.id);
  if (membership) {
    return { ...base, level: 'full', reason: `You are on this case as ${membership.caseRole}.`, member: true };
  }

  const role = ROLE_DEFINITIONS[user.roleId];
  if (role.oversight === 'redacted') {
    return { ...base, level: 'full', reason: 'Inspector view: the record is shown with names redacted.', redacted: true };
  }
  if (role.oversight === 'sign-off' || role.oversight === 'read-only') {
    return { ...base, level: 'summary', reason: `${role.label}: oversight summary across cases.` };
  }
  if (role.oversight === 'audit') {
    return { ...base, level: 'none', reason: 'Caldicott guardian: audit view only, no case content.', breakGlass: 'unavailable' };
  }
  if (role.oversight === 'admin') {
    return { ...base, level: 'none', reason: 'System administrator: configuration only, no case content.', breakGlass: 'unavailable' };
  }

  if (options.activeBreakGlass?.includes(process.id)) {
    return { ...base, level: 'full', reason: 'Break-glass access is active. Every read is audited.', breakGlass: 'active' };
  }

  const match = matchAudience(user.agency, user.roleId, contextFor(process), options.rows);
  if (match) {
    return {
      ...base,
      level: match.detailLevel,
      reason: match.reasons.join(' '),
      fields: match.fields,
      rowIds: match.rowIds,
      lawfulBasisHints: match.lawfulBasisHints,
    };
  }

  if (restricted) {
    const canBreak = BREAK_GLASS_AGENCIES.includes(user.agency);
    return {
      ...base,
      level: 'none',
      reason: 'This is a restricted record and you are not on the distribution list.',
      breakGlass: canBreak ? 'available' : 'unavailable',
    };
  }

  return { ...base, level: 'presence', reason: 'You are not on this case. You can see that a process exists and ask to be involved.' };
}

export function canSee(level: AccessLevel, needed: DetailLevel): boolean {
  const rank: Record<AccessLevel, number> = { none: 0, presence: 1, fields: 2, summary: 3, full: 4 };
  return rank[level] >= rank[needed];
}
