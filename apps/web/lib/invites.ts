import { contextFor, detailLevelLabel, exclusionPartyLabel, isExcludedParty, nearMatchesOnRegister, resolveNeedToKnow, roleLabel, type Config, type Dataset, type Invitee, type Process, type User } from '@mas/domain';
import type { t as translate } from '@mas/messages';
import { userName } from '@/lib/selectors';

type Translate = typeof translate;

export interface InviteProposal {
  /** The people the need-to-know answer seats at the meeting, each carrying the row that seats them. */
  additions: Invitee[];
  /** Everybody the answer left off, each with the reason, so the omission is a decision and not an oversight. */
  leftOff: Array<{ name: string; reason: string }>;
  /** Held back for a confirmation because their name resembles a hand-recorded register entry. */
  heldBack: User[];
}

/**
 * The invite list the need-to-know matrix proposes for a meeting on this case, at its stage.
 *
 * One answer for the schedule dialog and the workspace's generate button, so the two cannot drift:
 * a row that gives an audience full detail seats them; a row that gives less is listed as left off
 * with the level it does give; a person holding an excluded party role on the case-role register
 * is left off whatever their agency's row says; and a person whose name only resembles a register
 * entry is held back for the confirmation the near-match dialog asks for.
 */
export function proposeInvitees(t: Translate, data: Dataset, config: Config, process: Process, existing: readonly Invitee[], skipUserIds: readonly string[] = []): InviteProposal {
  const res = resolveNeedToKnow(contextFor(process), config.needToKnow, config.exclusions);
  const additions: Invitee[] = [];
  const leftOff: InviteProposal['leftOff'] = [];
  const heldBack: User[] = [];
  const listed = (userId: string) => existing.some((i) => i.userId === userId) || additions.some((i) => i.userId === userId) || skipUserIds.includes(userId);
  for (const r of res.recipients) {
    if (r.detailLevel !== 'full') {
      leftOff.push({ name: r.label, reason: t('meetings.schedule.leftOff.level', { level: detailLevelLabel(r.detailLevel) }) });
      continue;
    }
    const candidates = data.users.filter((u) => u.roleId !== 'system-administrator' && u.agency === r.agency && (r.role === 'any' ? true : u.roleId === r.role) && (u.caseMemberships.includes(process.id) || r.role !== 'any'));
    let seated = 0;
    for (const u of candidates) {
      if (seated >= (r.role === 'any' ? 1 : 2)) break;
      if (listed(u.id)) continue;
      const hit = isExcludedParty(process, { userId: u.id }, config.exclusions, process.stage, data.relationships);
      if (hit) {
        if (!leftOff.some((x) => x.name === userName(u))) leftOff.push({ name: userName(u), reason: t('meetings.schedule.leftOff.excluded', { party: exclusionPartyLabel(hit.party.party) }) });
        continue;
      }
      if (nearMatchesOnRegister(process, userName(u), { exclusions: config.exclusions, stage: process.stage, relationships: data.relationships }).length > 0) {
        heldBack.push(u);
        leftOff.push({ name: userName(u), reason: t('meetings.schedule.leftOff.nearMatch') });
        continue;
      }
      additions.push({ userId: u.id, name: userName(u), agency: u.agency, role: roleLabel(u.roleId), required: true, attendance: 'invited', reason: `${r.label}: ${r.reason}`, needToKnowRowId: r.rowId });
      seated += 1;
    }
  }
  for (const e of res.exclusions) if (!leftOff.some((x) => x.name === e.label)) leftOff.push({ name: e.label, reason: e.reason });
  return { additions, leftOff, heldBack };
}

/**
 * Whether a person may be put on a list for this case at all: not an excluded party, and not an
 * account with no seat at any meeting. The pipeline refuses the same people at write time; asking
 * here keeps them out of the picker rather than out of the record after a refusal.
 */
export function mayBeInvited(data: Dataset, config: Config, process: Process, user: User): boolean {
  if (user.roleId === 'system-administrator') return false;
  return isExcludedParty(process, { userId: user.id }, config.exclusions, process.stage, data.relationships) === null;
}
