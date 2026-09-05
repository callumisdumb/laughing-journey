import { describe, expect, it } from 'vitest';
import { computeClock, findClockRule } from '../clocks';
import { DEFAULT_CONFIG, workingCalendarFrom } from '../config/default-config';
import { buildOpeningProcess } from '../processes/open';
import type { Action } from '../schemas/action-plan';
import type { Meeting } from '../schemas/meeting';
import type { Process } from '../schemas/process';
import type { SharingRecord } from '../schemas/sharing';
import type { User } from '../schemas/user';
import { actionClockNotifications, actionNotifications, addressedTo, admissible, breakGlassNotifications, clockNotifications, inboxNotifications, meetingNotifications, nearMatchNotifications, processNotifications, sharingNotifications } from './derive';

const AT = '2026-09-02T09:00:00Z';
const MOIRA = 'usr_moira';
const JANET = 'usr_janet';
const ANNE = 'usr_anne';
const MARK = 'usr_mark';

function asp(overrides: Partial<Process> = {}): Process {
  const process = buildOpeningProcess(
    {
      id: 'prc_test_asp',
      reference: 'ASP-2026-9001',
      title: 'Test adult',
      subjectIds: ['per_test'],
      leadAgency: 'social-work',
      leadUserId: MOIRA,
      stage: 'concern',
      stageHistory: [{ stage: 'concern', at: AT, byName: 'Moira Gilmour', byUserId: MOIRA }],
      classification: { level: 'official-sensitive', descriptors: [], handling: [], basis: 'test' } as unknown as Process['classification'],
      accessRestriction: 'none',
      members: [
        { userId: MOIRA, caseRole: 'Lead', agency: 'social-work', since: '2026-09-01', reason: 'Lead' },
        { userId: JANET, caseRole: 'Worker', agency: 'social-work', since: '2026-09-01', reason: 'Allocated' },
      ],
      clocks: [],
      openedAt: AT,
    },
    { type: 'asp', subjectIds: ['per_test'], at: AT, source: 'GP', sourceAgency: 'health', summary: 'A concern', byName: 'Moira Gilmour', byUserId: MOIRA },
  );
  return { ...process, ...overrides } as Process;
}

function marac(): Process {
  const process = buildOpeningProcess(
    {
      id: 'prc_test_marac',
      reference: 'MARAC-2026-9001',
      title: 'Test victim',
      subjectIds: ['per_victim'],
      leadAgency: 'police',
      leadUserId: ANNE,
      stage: 'research',
      stageHistory: [{ stage: 'referral', at: AT, byName: 'Anne Hendry', byUserId: ANNE }],
      classification: { level: 'official-sensitive', descriptors: [], handling: [], basis: 'test' } as unknown as Process['classification'],
      accessRestriction: 'none',
      members: [
        { userId: ANNE, caseRole: 'Coordinator', agency: 'police', since: '2026-09-01', reason: 'Coordinator' },
        { userId: MARK, caseRole: 'Housing', agency: 'housing', since: '2026-09-01', reason: 'Housing officer' },
      ],
      clocks: [],
      openedAt: AT,
    },
    {
      type: 'marac',
      subjectIds: ['per_victim'],
      at: AT,
      source: 'Police',
      sourceAgency: 'police',
      summary: 'A referral',
      byName: 'Anne Hendry',
      byUserId: ANNE,
      marac: { victimPersonId: 'per_victim', perpetratorPersonId: 'per_perp', childPersonIds: [], riskAssessmentId: 'ra_test', repeat: false, professionalJudgement: false },
    },
  );
  // Mark holds a role the MARAC exclusions name: he is never a recipient, whatever else he is.
  return { ...process, parties: [{ userId: MARK, party: 'perpetrator-associates', label: 'Associate of the perpetrator', source: 'manual', reason: 'Named on the DAQ' }] };
}

function action(overrides: Partial<Action> = {}): Action {
  return { id: 'act_test', synthetic: true, processId: 'prc_test_asp', title: 'Visit Marion', ownerUserId: JANET, ownerName: 'Janet Kerr', ownerAgency: 'social-work', due: '2026-09-03', status: 'open', createdAt: AT, createdByName: 'Moira Gilmour', createdByUserId: MOIRA, ...overrides };
}

function meeting(overrides: Partial<Meeting> = {}): Meeting {
  return {
    id: 'mtg_test',
    synthetic: true,
    type: 'asp-case-conference',
    processId: 'prc_test_asp',
    subjectIds: ['per_test'],
    title: 'Case conference: Test adult',
    scheduledAt: '2026-09-10T10:00:00Z',
    location: 'Room 1',
    status: 'scheduled',
    chairUserId: ANNE,
    chairName: 'Anne Hendry',
    invitees: [{ userId: JANET, name: 'Janet Kerr', agency: 'social-work', role: 'Social worker', attendance: 'invited', reason: 'Allocated worker' } as Meeting['invitees'][number]],
    agenda: [],
    preMeetingRequests: [],
    pack: [],
    informationShared: [],
    decisions: [],
    actionIds: [],
    viewsRecordIds: [],
    minute: { status: 'not-started' },
    distribution: [],
    ...overrides,
  };
}

const users = [
  { id: MOIRA, agency: 'social-work', roleId: 'council-officer-asp' },
  { id: JANET, agency: 'social-work', roleId: 'social-worker-children' },
  { id: ANNE, agency: 'social-work', roleId: 'team-leader' },
  { id: MARK, agency: 'housing', roleId: 'housing-officer' },
] as unknown as User[];

describe('actionNotifications', () => {
  it('tells the owner on assignment, and nobody on an edit that leaves the owner alone', () => {
    const created = actionNotifications(undefined, action(), { meetings: [], plans: [] });
    expect(created).toHaveLength(1);
    expect(created[0]).toMatchObject({ kind: 'action-assigned', toUserId: JANET, sourceId: 'act_test', processId: 'prc_test_asp' });
    expect(actionNotifications(action(), action({ title: 'Visit Marion at home' }), { meetings: [], plans: [] })).toHaveLength(0);
  });
  it('tells both people on a reassignment, with different keys so both are kept', () => {
    const out = actionNotifications(action(), action({ ownerUserId: MOIRA, ownerName: 'Moira Gilmour' }), { meetings: [], plans: [] });
    expect(out.map((d) => [d.kind, d.toUserId])).toEqual([
      ['action-reassigned', MOIRA],
      ['action-reassigned', JANET],
    ]);
    expect(new Set(out.map((d) => d.key)).size).toBe(2);
  });
  it('addresses a role-assigned action to every holder of the role in the agency', () => {
    const out = actionNotifications(undefined, action({ ownerUserId: undefined, ownerRoleId: 'housing-officer', ownerAgency: 'housing', ownerName: 'Housing officer' }), { meetings: [], plans: [] });
    expect(out[0]?.toRole).toEqual({ agency: 'housing', roleId: 'housing-officer' });
    expect(out[0]?.toUserId).toBeUndefined();
  });
  it('tells the chair, the plan coordinator and the creator on completion, each once', () => {
    const out = actionNotifications(action({ meetingId: 'mtg_test', planId: 'pln_test' }), action({ meetingId: 'mtg_test', planId: 'pln_test', status: 'complete', evidence: 'Visited on the 3rd' }), { meetings: [meeting()], plans: [{ id: 'pln_test', coordinatorUserId: MOIRA }] });
    expect(out.map((d) => d.toUserId).sort()).toEqual([MOIRA, ANNE].sort());
    expect(out.every((d) => d.kind === 'action-completed')).toBe(true);
  });
});

describe('meetingNotifications', () => {
  it('invites on scheduling and again only for people newly added', () => {
    const first = meetingNotifications(undefined, meeting(), []);
    expect(first).toEqual([expect.objectContaining({ kind: 'meeting-invited', toUserId: JANET })]);
    const more = meeting({ invitees: [...meeting().invitees, { userId: MOIRA, name: 'Moira Gilmour', agency: 'social-work', role: 'Council officer', attendance: 'invited', reason: 'Lead' } as Meeting['invitees'][number]] });
    expect(meetingNotifications(meeting(), more, []).map((d) => d.toUserId)).toEqual([MOIRA]);
  });
  it('tells everybody when the meeting moves, keyed on the new time, and when it is cancelled', () => {
    const moved = meetingNotifications(meeting(), meeting({ scheduledAt: '2026-09-11T10:00:00Z' }), []);
    expect(moved.map((d) => d.toUserId).sort()).toEqual([ANNE, JANET].sort());
    expect(moved.every((d) => d.kind === 'meeting-changed' && d.key.endsWith('2026-09-11T10:00'))).toBe(true);
    const cancelled = meetingNotifications(meeting(), meeting({ status: 'cancelled' }), []);
    expect(cancelled.every((d) => d.kind === 'meeting-cancelled')).toBe(true);
    expect(cancelled).toHaveLength(2);
  });
  it('tells each distribution recipient at the level they were given, citing the share\'s lawful basis', () => {
    const share = { id: 'shr_1', lawfulBasisId: 'lb_1' } as SharingRecord;
    const distributed = meeting({ status: 'held', minute: { status: 'distributed', distributedAt: AT }, distribution: [{ id: 'dst_1', recipientUserId: JANET, recipientName: 'Janet Kerr', agency: 'social-work', detailLevel: 'summary', sharingRecordId: 'shr_1' } as Meeting['distribution'][number]] });
    const out = meetingNotifications(meeting({ status: 'held' }), distributed, [share]);
    expect(out).toEqual([expect.objectContaining({ kind: 'minute-distributed', toUserId: JANET, detailLevel: 'summary', lawfulBasisId: 'lb_1' })]);
  });
  it('lands a pre-meeting request with the person asked and its return with the chair', () => {
    const request = { id: 'pmr_1', toUserId: JANET, toName: 'Janet Kerr', agency: 'social-work', what: 'Report', sentAt: AT, dueAt: '2026-09-08', status: 'sent' } as Meeting['preMeetingRequests'][number];
    const asked = meetingNotifications(meeting(), meeting({ preMeetingRequests: [request] }), []);
    expect(asked).toEqual([expect.objectContaining({ kind: 'request', toUserId: JANET })]);
    const returned = meetingNotifications(meeting({ preMeetingRequests: [request] }), meeting({ preMeetingRequests: [{ ...request, status: 'returned' }] }), []);
    expect(returned).toEqual([expect.objectContaining({ kind: 'request-returned', toUserId: ANNE })]);
  });
});

describe('processNotifications', () => {
  const ctx = { config: DEFAULT_CONFIG };
  it('announces a stage change to every member in full and to the matrix audiences at their level, keyed on the stage', () => {
    const before = asp();
    const after = asp({ stage: 'inquiry' });
    const out = processNotifications(before, after, ctx);
    const members = out.filter((d) => d.kind === 'stage-changed' && d.toUserId);
    expect(members.map((d) => d.toUserId).sort()).toEqual([JANET, MOIRA].sort());
    expect(members.every((d) => d.detailLevel === 'full' && d.key.endsWith(':inquiry'))).toBe(true);
    const audiences = out.filter((d) => d.kind === 'stage-changed' && d.toRole);
    expect(audiences.length).toBeGreaterThan(0);
    expect(audiences.every((d) => ['presence', 'fields', 'summary', 'full'].includes(d.detailLevel))).toBe(true);
    expect(processNotifications(after, after, ctx).filter((d) => d.kind === 'stage-changed')).toHaveLength(0);
  });
  it('tells a member they were added, or removed', () => {
    const before = asp();
    const added = asp({ members: [...before.members, { userId: ANNE, caseRole: 'Team leader', agency: 'social-work', since: '2026-09-02', reason: 'Oversight' }] });
    expect(processNotifications(before, added, ctx)).toEqual([expect.objectContaining({ kind: 'membership-added', toUserId: ANNE })]);
    const removed = asp({ members: before.members.filter((m) => m.userId !== JANET) });
    expect(processNotifications(before, removed, ctx)).toEqual([expect.objectContaining({ kind: 'membership-removed', toUserId: JANET })]);
  });
  it('tells the lead when the classification is raised', () => {
    const raised = asp({ classificationOverride: { direction: 'raised', at: AT, byName: 'Anne Hendry', reason: 'Named third party', auditId: 'aud_1' } as unknown as Process['classificationOverride'] });
    const out = processNotifications(asp(), raised, ctx);
    expect(out).toEqual([expect.objectContaining({ kind: 'classification-raised', toUserId: MOIRA })]);
  });
  it('lands a MARAC research request with the agency asked and its return with the coordinator', () => {
    const before = marac();
    const request: Extract<Process, { type: 'marac' }>['detail']['researchRequests'][number] = { id: 'rr_1', agency: 'health', sentAt: AT, dueAt: '2026-09-08', status: 'sent' };
    const asked = { ...before, detail: { ...(before as Extract<Process, { type: 'marac' }>).detail, researchRequests: [request] } } as Process;
    expect(processNotifications(before, asked, ctx)).toEqual([expect.objectContaining({ kind: 'request', toRole: { agency: 'health', roleId: 'any' } })]);
    const back = { ...asked, detail: { ...(asked as Extract<Process, { type: 'marac' }>).detail, researchRequests: [{ ...request, status: 'returned' }] } } as Process;
    expect(processNotifications(asked, back, ctx)).toEqual([expect.objectContaining({ kind: 'request-returned', toUserId: ANNE })]);
  });
});

describe('the clock engine', () => {
  const rule = findClockRule(DEFAULT_CONFIG.clockRules, 'asp.inquiry.decision')!;
  const trigger = { id: 'clk_test', ruleId: 'asp.inquiry.decision', triggeredAt: AT };
  const due = computeClock(trigger, rule, new Date(AT), { calendar: workingCalendarFrom(DEFAULT_CONFIG) }).dueAt;
  it('warns the lead inside the window, breaches past due, and keys both on the trigger so a re-read raises nothing new', () => {
    const process = asp({ clocks: [trigger] });
    const quiet = clockNotifications([process], { config: DEFAULT_CONFIG, now: new Date(AT) });
    expect(quiet).toHaveLength(0);
    const warning = clockNotifications([process], { config: DEFAULT_CONFIG, now: new Date(`${due}T09:00:00Z`) });
    expect(warning).toEqual([expect.objectContaining({ kind: 'clock-warning', toUserId: MOIRA, sourceId: 'clk_test' })]);
    const breach = clockNotifications([process], { config: DEFAULT_CONFIG, now: new Date(new Date(`${due}T09:00:00Z`).getTime() + 3 * 86_400_000) });
    expect(breach).toEqual([expect.objectContaining({ kind: 'clock-breached', toUserId: MOIRA })]);
    expect(clockNotifications([process], { config: DEFAULT_CONFIG, now: new Date(`${due}T09:00:00Z`) })[0]?.key).toBe(warning[0]?.key);
  });
  it('says nothing about a completed clock or a closed case', () => {
    const done = asp({ clocks: [{ ...trigger, completedAt: AT }] });
    expect(clockNotifications([done], { config: DEFAULT_CONFIG, now: new Date(`${due}T09:00:00Z`) })).toHaveLength(0);
    const closed = asp({ clocks: [trigger], status: 'closed' });
    expect(clockNotifications([closed], { config: DEFAULT_CONFIG, now: new Date(`${due}T09:00:00Z`) })).toHaveLength(0);
  });
  it('tells the owner on the day, the owner and the lead the day after, and escalates to the lead after the configured interval', () => {
    const process = asp();
    const onTheDay = actionClockNotifications([action()], [process], { config: DEFAULT_CONFIG, now: new Date('2026-09-03T09:00:00Z') });
    expect(onTheDay.drafts).toEqual([expect.objectContaining({ kind: 'action-due', toUserId: JANET })]);
    expect(onTheDay.escalate).toHaveLength(0);
    const dayAfter = actionClockNotifications([action()], [process], { config: DEFAULT_CONFIG, now: new Date('2026-09-04T09:00:00Z') });
    expect(dayAfter.drafts.map((d) => [d.kind, d.toUserId])).toEqual([
      ['action-overdue', JANET],
      ['action-overdue', MOIRA],
    ]);
    const later = actionClockNotifications([action()], [process], { config: DEFAULT_CONFIG, now: new Date(`2026-09-${String(3 + DEFAULT_CONFIG.actionEscalationDays).padStart(2, '0')}T09:00:00Z`) });
    expect(later.escalate.map((a) => a.id)).toEqual(['act_test']);
    expect(later.drafts.filter((d) => d.toUserId === MOIRA)).toHaveLength(2);
    const leadOwns = actionClockNotifications([action({ ownerUserId: MOIRA })], [process], { config: DEFAULT_CONFIG, now: new Date('2026-09-04T09:00:00Z') });
    expect(leadOwns.drafts).toHaveLength(1);
    const already = actionClockNotifications([action({ escalatedAt: AT })], [process], { config: DEFAULT_CONFIG, now: new Date('2026-09-20T09:00:00Z') });
    expect(already.escalate).toHaveLength(0);
    const complete = actionClockNotifications([action({ status: 'complete' })], [process], { config: DEFAULT_CONFIG, now: new Date('2026-09-20T09:00:00Z') });
    expect(complete.drafts).toHaveLength(0);
  });
});

describe('admissible', () => {
  const base = { exclusions: DEFAULT_CONFIG.exclusions, relationships: [], users };
  it('never tells the actor about their own act', () => {
    const [draft] = actionNotifications(undefined, action({ ownerUserId: MOIRA }), { meetings: [], plans: [] });
    expect(admissible(draft!, { ...base, actorUserId: MOIRA, process: asp() })).toBe(false);
    expect(admissible(draft!, { ...base, actorUserId: JANET, process: asp() })).toBe(true);
  });
  it('never makes an excluded party a recipient, by the same check that refuses them a share', () => {
    const process = marac();
    const out = processNotifications(process, { ...process, stage: 'meeting' }, { config: DEFAULT_CONFIG });
    const toMark = out.find((d) => d.toUserId === MARK)!;
    const toAnne = out.find((d) => d.toUserId === ANNE)!;
    expect(toMark).toBeDefined();
    expect(admissible(toMark, { ...base, process })).toBe(false);
    expect(admissible(toAnne, { ...base, process })).toBe(true);
  });
  it('lets a role-addressed draft through when at least one holder is not excluded, and refuses it when every holder is', () => {
    const process = marac();
    const housing = { toRole: { agency: 'housing', roleId: 'housing-officer' }, kind: 'request', sourceType: 'process', sourceId: process.id, processId: process.id, detailLevel: 'summary', key: 'k' } as const;
    // Mark is the only housing officer, and he is excluded.
    expect(admissible(housing, { ...base, process })).toBe(false);
    // With a second holder who is not, the draft may be written; the read side then filters per holder.
    const second = [...users, { id: 'usr_other', agency: 'housing', roleId: 'housing-officer' } as unknown as User];
    expect(admissible(housing, { ...base, users: second, process })).toBe(true);
    // A role nobody holds yet is admissible: the record waits for whoever takes the role.
    expect(admissible({ ...housing, toRole: { agency: 'education', roleId: 'any' } }, { ...base, process })).toBe(true);
  });
  it('refuses a draft addressed to nobody', () => {
    expect(admissible({ kind: 'share', sourceType: 'sharing', sourceId: 's', detailLevel: 'summary', key: 'k' }, base)).toBe(false);
  });
});

describe('the smaller composers', () => {
  it('a share reaches its recipient when it is sent and not again when it is read', () => {
    const share = { id: 'shr_1', recipient: { userId: JANET, name: 'Janet Kerr', agency: 'social-work' }, status: 'sent', processId: 'prc_test_asp', subjectId: 'per_test', detailLevel: 'summary', lawfulBasisId: 'lb_1' } as unknown as SharingRecord;
    expect(sharingNotifications(undefined, share)).toEqual([expect.objectContaining({ kind: 'share', toUserId: JANET, detailLevel: 'summary', lawfulBasisId: 'lb_1' })]);
    expect(sharingNotifications(share, { ...share, status: 'read' })).toHaveLength(0);
    expect(sharingNotifications(undefined, { ...share, status: 'queued' })).toHaveLength(0);
  });
  it('break-glass tells the lead in full and the escrow holders as a summary, pointing at the ledger entry', () => {
    const out = breakGlassNotifications(asp(), 'aud_1', [{ agency: 'social-work', roleId: 'cswo' }]);
    expect(out).toEqual([
      expect.objectContaining({ kind: 'break-glass', toUserId: MOIRA, sourceType: 'audit', sourceId: 'aud_1', detailLevel: 'full' }),
      expect.objectContaining({ kind: 'break-glass', toRole: { agency: 'social-work', roleId: 'cswo' }, detailLevel: 'summary' }),
    ]);
  });
  it('a near match and an inbox arrival name their audience and carry no content', () => {
    expect(nearMatchNotifications(asp(), AT)).toEqual([expect.objectContaining({ kind: 'exclusion-near-match', toUserId: MOIRA })]);
    expect(nearMatchNotifications(asp({ leadUserId: undefined }), AT)).toHaveLength(0);
    expect(inboxNotifications({ id: 'cev_1', agency: 'health', subjectId: 'per_test' })).toEqual([expect.objectContaining({ kind: 'inbox-arrived', toRole: { agency: 'health', roleId: 'any' }, detailLevel: 'summary' })]);
  });
  it('addressedTo matches a person by id and a role by agency and role, with any as the wildcard', () => {
    const janet = users[1]!;
    expect(addressedTo({ toUserId: JANET }, janet)).toBe(true);
    expect(addressedTo({ toUserId: MOIRA }, janet)).toBe(false);
    expect(addressedTo({ toRole: { agency: 'social-work', roleId: 'any' } }, janet)).toBe(true);
    expect(addressedTo({ toRole: { agency: 'social-work', roleId: 'team-leader' } }, janet)).toBe(false);
    expect(addressedTo({ toRole: { agency: 'health', roleId: 'any' } }, janet)).toBe(false);
  });
});
