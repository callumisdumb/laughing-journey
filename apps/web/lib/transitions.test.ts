import { processSubjectIds, type MaracProcess, type Process } from '@mas/domain';
import { USR } from '@mas/mock-data';
import { beforeAll, describe, expect, it } from 'vitest';
import { primeDeviceKey } from './localStore';
import { useAppStore } from './store';

/**
 * The transition executor, driven through the store on a case the test opens (D-210, D-211): the
 * engine's refusals come back as codes, a recorded decision writes the stage entry and the ledger
 * line, the recorder joins the case (D-219), a scheduled meeting is written and told, and holding
 * it through its transition marks it held with the transition it fired (D-213).
 */
function state() {
  return useAppStore.getState();
}

function openMarac(): MaracProcess {
  state().signIn(USR.karenFindlay);
  const victim = state().data.people.find((p) => p.dateOfBirth && p.dateOfBirth < '2000-01-01' && p.dateOfBirth > '1960-01-01' && !state().data.processes.some((x) => processSubjectIds(x).includes(p.id)))!;
  const opened = state().openProcess({ type: 'marac', subjectIds: [victim.id], at: state().now().toISOString(), source: 'Police Scotland, domestic abuse unit', sourceAgency: 'police', summary: 'Third call-out in two months with a professional judgement referral.', byName: 'Karen Findlay', byUserId: USR.karenFindlay, marac: { victimPersonId: victim.id, perpetratorPersonId: victim.id, childPersonIds: [], repeat: false, professionalJudgement: true } });
  expect(opened.ok, opened.errors.join(', ')).toBe(true);
  return opened.process as MaracProcess;
}

const schedule = { scheduledAt: '2026-09-10T10:00:00.000Z', location: 'Room 3', chairUserId: USR.karenFindlay, chairName: 'Karen Findlay', invitees: [{ userId: USR.janetKerr, name: 'Janet Kerr', agency: 'social-work' as const, role: 'Social worker', reason: 'Added by hand' }] };

beforeAll(async () => {
  await primeDeviceKey();
  state().init();
});

describe('recordTransition', () => {
  it('refuses with the engine\'s own codes, and writes nothing', () => {
    const process = openMarac();
    const before = state().data.audit.length;
    const refused = state().recordTransition(process.id, 'marac-heard', { meetingId: 'mtg_none', informationShared: [], riskDiscussion: '' });
    expect(refused.ok).toBe(false);
    expect(refused.errors).toEqual(['transitionNotFromThisStage']);
    expect(state().data.audit.length).toBe(before);
  });

  it('schedules the meeting through the engine, tells the invitee, and puts the recorder and the chair on the case', () => {
    const process = openMarac();
    const result = state().scheduleMeeting(process.id, 'marac', schedule);
    expect(result.ok, result.errors.join(', ')).toBe(true);
    const meeting = state().data.meetings.find((m) => m.id === result.created?.meetingId)!;
    expect(meeting).toMatchObject({ type: 'marac', status: 'scheduled', chairUserId: USR.karenFindlay });
    expect(meeting.title).toMatch(/^MARAC: /);
    expect(state().data.notifications.some((n) => n.kind === 'meeting-invited' && n.toUserId === USR.janetKerr && n.sourceId === meeting.id)).toBe(true);
    const after = state().data.processes.find((p) => p.id === process.id) as Process;
    expect(after.stage).toBe('referral');
    expect(after.members.some((m) => m.userId === USR.karenFindlay)).toBe(true);
    expect((after as MaracProcess).detail.meetingId).toBe(meeting.id);
  });

  it('holds a meeting by the transition it fires, marking it held with the transition and opening its minute', () => {
    const process = openMarac();
    const scheduled = state().scheduleMeeting(process.id, 'marac', schedule);
    const meetingId = scheduled.created!.meetingId!;
    const sent = state().recordTransition(process.id, 'marac-send-research-requests', { agencies: ['police', 'health'], wording: 'Please search your records for the named people and return anything relevant, necessary and proportionate.', dueAt: '2026-09-08' });
    expect(sent.ok, sent.errors.join(', ')).toBe(true);
    expect(sent.created?.requestIds).toHaveLength(2);
    expect(state().data.processes.find((p) => p.id === process.id)!.stage).toBe('research');
    const heard = state().recordTransition(process.id, 'marac-heard', { meetingId, informationShared: [{ agency: 'police', summary: 'Three call-outs, one charge pending.' }], riskDiscussion: 'High risk of further serious harm; the perpetrator has breached bail twice.' });
    expect(heard.ok, heard.errors.join(', ')).toBe(true);
    const meeting = state().data.meetings.find((m) => m.id === meetingId)!;
    expect(meeting).toMatchObject({ status: 'held', transitionId: 'marac-heard', minute: { status: 'draft' } });
    expect(meeting.heldAt).toBeDefined();
    const after = state().data.processes.find((p) => p.id === process.id)!;
    expect(after.stage).toBe('meeting');
    expect(after.stageHistory.at(-1)).toMatchObject({ stage: 'meeting', byUserId: USR.karenFindlay });
    expect(after.clocks.some((c) => c.ruleId === 'marac.repeat.window' && !c.completedAt)).toBe(true);
  });

  it('a plain meeting the engine has no view of is held with a note and moves nothing', () => {
    state().signIn(USR.moiraGilmour);
    const adult = state().data.people.find((p) => p.dateOfBirth && p.dateOfBirth < '1960-01-01' && !state().data.processes.some((x) => processSubjectIds(x).includes(p.id)))!;
    const opened = state().openProcess({ type: 'asp', subjectIds: [adult.id], at: state().now().toISOString(), source: 'District nurse', sourceAgency: 'health', summary: 'Money missing from the purse and a nephew who will not leave.', byName: 'Moira Gilmour', byUserId: USR.moiraGilmour });
    expect(opened.ok, opened.errors.join(', ')).toBe(true);
    const process = opened.process!;
    const refused = state().scheduleMeeting(process.id, 'asp-case-conference', { ...schedule, chairUserId: USR.davidLaird, chairName: 'David Laird' });
    expect(refused.errors).toEqual(['meetingWrongStage']);
    const plain = state().scheduleMeeting(process.id, 'asp-inter-agency-discussion', { ...schedule, chairUserId: USR.moiraGilmour, chairName: 'Moira Gilmour' });
    expect(plain.ok, plain.errors.join(', ')).toBe(true);
    const held = state().holdMeeting(plain.created!.meetingId!, 'Agreed to open an inquiry.');
    expect(held.ok).toBe(true);
    expect(state().data.meetings.find((m) => m.id === plain.created!.meetingId)).toMatchObject({ status: 'held', minute: { status: 'draft' } });
    expect(state().data.processes.find((p) => p.id === process.id)!.stage).toBe('concern');
  });
});

describe('MARAC research through the store (step 7)', () => {
  it('tells each research agency once, lands each return on the case, and the last return completes the clock', () => {
    const process = openMarac();
    state().scheduleMeeting(process.id, 'marac', schedule);
    const sent = state().recordTransition(process.id, 'marac-send-research-requests', { agencies: ['housing', 'health'], wording: 'Please search your records for the named people and return anything relevant, necessary and proportionate.', dueAt: '2026-09-08' });
    expect(sent.ok, sent.errors.join(', ')).toBe(true);
    const mark = state().data.users.find((u) => u.id === USR.markHepburn)!;
    const toMark = state().data.notifications.filter((n) => n.kind === 'request' && n.processId === process.id && (n.toUserId === mark.id || (n.toRole && n.toRole.agency === mark.agency)));
    expect(toMark.map((n) => n.key)).toHaveLength(1);
    const requests = state().data.informationRequests.filter((r) => r.processId === process.id);
    expect(requests.map((r) => r.toAgency).sort()).toEqual(['health', 'housing']);

    state().signIn(USR.markHepburn);
    const housing = requests.find((r) => r.toAgency === 'housing')!;
    const nil = state().recordTransition(process.id, 'marac-record-research-return', { requestId: housing.id, summary: '', nothingKnown: true, relevantNecessaryProportionate: true });
    expect(nil.ok, nil.errors.join(', ')).toBe(true);
    expect(state().data.informationRequests.find((r) => r.id === housing.id)?.status).toBe('responded');
    let after = state().data.processes.find((p) => p.id === process.id) as MaracProcess;
    expect(after.clocks.find((c) => c.ruleId === 'marac.research.return')?.completedAt).toBeUndefined();
    expect(after.members.some((m) => m.userId === USR.markHepburn)).toBe(true);

    state().signIn(USR.amiraFarouk);
    const health = requests.find((r) => r.toAgency === 'health')!;
    const returned = state().recordTransition(process.id, 'marac-record-research-return', { requestId: health.id, summary: 'Seen twice since June with injuries.', nothingKnown: false, relevantNecessaryProportionate: true });
    expect(returned.ok, returned.errors.join(', ')).toBe(true);
    after = state().data.processes.find((p) => p.id === process.id) as MaracProcess;
    expect(after.clocks.find((c) => c.ruleId === 'marac.research.return')?.completedAt).toBeDefined();
    expect(state().data.notifications.filter((n) => n.kind === 'request-returned' && n.toUserId === USR.karenFindlay && n.processId === process.id)).toHaveLength(2);
  }, 30_000);
});

describe('the child concern from a MARAC (step 7)', () => {
  it('opens a linked child protection case on the coordinator\'s authority, adds the child to the referral, and links a second concern to the case that exists', () => {
    const process = openMarac();
    state().scheduleMeeting(process.id, 'marac', schedule);
    const meetingId = (state().data.processes.find((p) => p.id === process.id) as MaracProcess).detail.meetingId!;
    state().recordTransition(process.id, 'marac-send-research-requests', { agencies: ['police'], wording: 'Please search your records for the named people and return anything relevant, necessary and proportionate.', dueAt: '2026-09-08' });
    const heard = state().recordTransition(process.id, 'marac-heard', { meetingId, informationShared: [{ agency: 'police', summary: 'Three call-outs.' }], riskDiscussion: 'High risk with a child in the household.' });
    expect(heard.ok, heard.errors.join(', ')).toBe(true);
    const child = state().data.people.find((p) => p.lifeStage === 'child' && !state().data.processes.some((x) => processSubjectIds(x).includes(p.id)))!;
    const linked = state().recordTransition(process.id, 'marac-link-cp-concern', { childPersonIds: [child.id], summary: 'The child was in the room at the last incident and the perpetrator still has a key.' });
    expect(linked.ok, linked.errors.join(', ')).toBe(true);
    const cp = state().data.processes.find((p) => p.id === linked.created?.processId)!;
    expect(cp).toMatchObject({ type: 'cp', stage: 'concern', subjectIds: [child.id] });
    expect(cp.linkedProcessIds).toContain(process.id);
    const marac = state().data.processes.find((p) => p.id === process.id) as MaracProcess;
    expect(marac.linkedProcessIds).toContain(cp.id);
    expect(marac.detail.links.cpProcessId).toBe(cp.id);
    expect(marac.detail.referral.childPersonIds).toContain(child.id);
    const again = state().recordTransition(process.id, 'marac-link-cp-concern', { childPersonIds: [child.id], summary: 'A further concern for the same child, after the plan.' });
    expect(again.ok, again.errors.join(', ')).toBe(true);
    expect(again.created?.processId).toBe(cp.id);
    expect(state().data.processes.filter((p) => p.type === 'cp' && p.subjectIds.includes(child.id) && p.status === 'open')).toHaveLength(1);
  }, 30_000);
});
