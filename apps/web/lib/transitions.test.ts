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
