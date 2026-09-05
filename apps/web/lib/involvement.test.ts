import { processSubjectIds } from '@mas/domain';
import { USR } from '@mas/mock-data';
import { beforeAll, describe, expect, it, vi } from 'vitest';
import { primeDeviceKey } from './localStore';
import { useAppStore } from './store';

/**
 * Asking to be involved, driven through the store (D-227): the request reaches the lead, the
 * decision reaches the requester, and an accepted request puts them on the case with the reason.
 */
function state() {
  return useAppStore.getState();
}

vi.setConfig({ testTimeout: 60_000 });

beforeAll(async () => {
  await primeDeviceKey();
  state().init();
});

describe('a request to be involved', () => {
  it('reaches the lead, is decided from the case, and an accepted one joins the requester with the reason on the membership', () => {
    state().signIn(USR.priyaSharif);
    const subject = state().data.people.find((p) => p.lifeStage === 'adult' && !state().data.processes.some((x) => processSubjectIds(x).includes(p.id)))!;
    const opened = state().openProcess({ type: 'mappa', subjectIds: [subject.id], at: state().now().toISOString(), source: 'Police Scotland, sex offender liaison', sourceAgency: 'police', summary: 'Released on licence after a conviction for sexual assault.', byName: 'Priya Sharif', byUserId: USR.priyaSharif, mappa: { category: 1, level: 1, leadResponsibleAuthority: 'police', visorReference: '' } });
    expect(opened.ok, opened.errors.join(', ')).toBe(true);
    const process = opened.process!;

    state().signIn(USR.claireCowan);
    expect(state().requestInvolvement(process.id, 'Too short').errors).toEqual(['involvementReasonRequired']);
    const asked = state().requestInvolvement(process.id, 'He has been seen at the school gate at home time twice this week.');
    expect(asked.ok, asked.errors.join(', ')).toBe(true);
    expect(state().requestInvolvement(process.id, 'Asking again before the lead has decided.').errors).toEqual(['involvementPending']);
    const request = state().data.involvementRequests.find((r) => r.processId === process.id && r.requesterUserId === USR.claireCowan)!;
    expect(request.status).toBe('pending');
    expect(state().data.notifications.some((n) => n.kind === 'involvement-requested' && n.toUserId === USR.priyaSharif && n.sourceId === request.id)).toBe(true);
    // The requester cannot decide their own request, and nobody off the case can.
    expect(state().decideInvolvement(request.id, 'accepted').errors).toEqual(['involvementNotYours']);

    state().signIn(USR.priyaSharif);
    const accepted = state().decideInvolvement(request.id, 'accepted', 'Agreed: the school needs the curfew and the exclusion zone.');
    expect(accepted.ok, accepted.errors.join(', ')).toBe(true);
    const after = state().data.processes.find((p) => p.id === process.id)!;
    const member = after.members.find((m) => m.userId === USR.claireCowan);
    expect(member).toBeDefined();
    expect(member?.reason).toContain('school gate');
    expect(state().data.involvementRequests.find((r) => r.id === request.id)).toMatchObject({ status: 'accepted', decidedByUserId: USR.priyaSharif });
    expect(state().data.notifications.some((n) => n.kind === 'involvement-decided' && n.toUserId === USR.claireCowan && n.key.endsWith(':accepted'))).toBe(true);
    expect(state().decideInvolvement(request.id, 'declined').errors).toEqual(['involvementDecided']);

    // A second person is declined, and told so.
    state().signIn(USR.gavinBrodie);
    const second = state().requestInvolvement(process.id, 'Concern hub triage would like sight of the licence conditions.');
    expect(second.ok, second.errors.join(', ')).toBe(true);
    const secondRequest = state().data.involvementRequests.find((r) => r.processId === process.id && r.requesterUserId === USR.gavinBrodie)!;
    state().signIn(USR.priyaSharif);
    const declined = state().decideInvolvement(secondRequest.id, 'declined', 'Not needed for triage; the hub gets the notification it needs.');
    expect(declined.ok, declined.errors.join(', ')).toBe(true);
    expect(state().data.processes.find((p) => p.id === process.id)!.members.some((m) => m.userId === USR.gavinBrodie)).toBe(false);
    expect(state().data.notifications.some((n) => n.kind === 'involvement-decided' && n.toUserId === USR.gavinBrodie && n.key.endsWith(':declined'))).toBe(true);
  });
});
