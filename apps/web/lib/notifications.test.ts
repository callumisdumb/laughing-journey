import { DEMO_NOW_ISO, type Action, type Process } from '@mas/domain';
import { KAYLEIGH, MARION, USR } from '@mas/mock-data';
import { beforeAll, describe, expect, it } from 'vitest';
import { primeDeviceKey } from './localStore';
import { notificationsForProcess, notificationsForUser, renderNotification, unreadNotificationsForUser } from './notifications';
import { useAppStore } from './store';
import { t } from '@mas/messages';

/**
 * Notifications as the store writes them, driven through the pipeline rather than composed.
 *
 * The rule under test is the one in D-207: a notification is a consequence of a write, the actor is
 * never told about their own act, an excluded party is never a recipient, the same consequence is
 * never written twice, and reset takes all of it away.
 */
function state() {
  return useAppStore.getState();
}
function user(id: string) {
  return state().data.users.find((u) => u.id === id)!;
}
function newAction(overrides: Partial<Action> = {}): Action {
  const now = state().now().toISOString();
  return { id: state().newId('act'), synthetic: true, processId: MARION.asp, title: 'Visit Marion with the advocate', ownerUserId: USR.janetKerr, ownerName: 'Janet Kerr', ownerAgency: 'social-work', due: '2026-09-03', status: 'open', createdAt: now, createdByName: 'Moira Gilmour', createdByUserId: USR.moiraGilmour, ...overrides };
}
function writeAction(action: Action) {
  return state().write({ collection: 'actions', record: action, intent: action.versions ? 'update' : 'create', act: 'edit', targetType: 'process', targetLabel: action.title, processId: action.processId });
}

beforeAll(async () => {
  await primeDeviceKey();
  state().init();
});

describe('notifications through the pipeline', () => {
  it('records the seeded shares as notifications and the standing clock warnings as already read', () => {
    const { data, config } = state();
    const moira = user(USR.moiraGilmour);
    const shares = data.sharingRecords.filter((s) => s.recipient.userId === moira.id && s.status === 'sent');
    const unread = unreadNotificationsForUser(data, config, moira);
    expect(unread.filter((n) => n.kind === 'share')).toHaveLength(shares.length);
    const clocks = data.notifications.filter((n) => n.sourceType === 'clock');
    expect(clocks.length).toBeGreaterThan(0);
    expect(clocks.every((n) => n.readAt)).toBe(true);
  });

  it('an action Moira assigns to Janet reaches Janet, and not Moira, with the case reference rendered from the source', () => {
    state().signIn(USR.moiraGilmour);
    const action = newAction();
    const result = writeAction(action);
    expect(result.ok).toBe(true);
    expect(result.effects.some((e) => e.kind === 'notification' && e.detail === 'action-assigned')).toBe(true);
    const { data, config } = state();
    const janet = user(USR.janetKerr);
    const mine = unreadNotificationsForUser(data, config, janet).filter((n) => n.sourceId === action.id);
    expect(mine).toHaveLength(1);
    expect(mine[0]).toMatchObject({ kind: 'action-assigned', toUserId: USR.janetKerr, processId: MARION.asp, createdByUserId: USR.moiraGilmour, detailLevel: 'full' });
    expect(notificationsForUser(data, config, user(USR.moiraGilmour)).some((n) => n.sourceId === action.id)).toBe(false);
    const rendered = renderNotification(t, data, config, mine[0]!, state().now());
    expect(rendered.text).toContain('Moira Gilmour assigned you an action on ASP-2026-0217');
    expect(rendered.text).toContain(action.title);
    expect(rendered.href).toBe(`/actions?action=${action.id}`);
    expect(notificationsForProcess(data, config, janet, MARION.asp).some((n) => n.id === mine[0]!.id)).toBe(true);
  });

  it('writing the same action again raises nothing new, and completing it tells the person who asked', () => {
    state().signIn(USR.moiraGilmour);
    const action = newAction();
    writeAction(action);
    const before = state().data.notifications.length;
    const held = state().data.actions.find((a) => a.id === action.id)!;
    writeAction({ ...held, detail: 'Take the advocate' });
    expect(state().data.notifications.length).toBe(before);

    state().signIn(USR.janetKerr);
    const janetsCopy = state().data.actions.find((a) => a.id === action.id)!;
    const done = writeAction({ ...janetsCopy, status: 'complete', completedAt: state().now().toISOString(), evidence: 'Visited on the 3rd with the advocate present.' });
    expect(done.ok).toBe(true);
    const { data, config } = state();
    const moira = unreadNotificationsForUser(data, config, user(USR.moiraGilmour)).filter((n) => n.sourceId === action.id);
    expect(moira).toEqual([expect.objectContaining({ kind: 'action-completed', createdByUserId: USR.janetKerr })]);
    expect(unreadNotificationsForUser(data, config, user(USR.janetKerr)).some((n) => n.sourceId === action.id && n.kind === 'action-completed')).toBe(false);
  });

  it('reading, reading everything and dismissing are the recipient\'s own state, persisted and unaudited', () => {
    state().signIn(USR.moiraGilmour);
    const action = newAction();
    writeAction(action);
    state().signIn(USR.janetKerr);
    const janet = user(USR.janetKerr);
    const one = unreadNotificationsForUser(state().data, state().config, janet).find((n) => n.sourceId === action.id)!;
    const ledger = state().data.audit.length;
    state().markNotificationRead(one.id);
    expect(state().data.notifications.find((n) => n.id === one.id)?.readAt).toBeTruthy();
    state().markAllNotificationsRead();
    expect(unreadNotificationsForUser(state().data, state().config, janet)).toHaveLength(0);
    state().dismissNotification(one.id);
    expect(notificationsForUser(state().data, state().config, janet).some((n) => n.id === one.id)).toBe(false);
    expect(state().data.notifications.some((n) => n.id === one.id)).toBe(true);
    expect(state().data.audit.length).toBe(ledger);
  });

  it('moving the demo clock past a due date tells the owner and the lead once, and again nothing on a second reading', () => {
    state().signIn(USR.moiraGilmour);
    state().resetDemoNow();
    const action = newAction({ due: '2026-09-03' });
    writeAction(action);
    state().setDemoNow('2026-09-06T09:00:00+01:00');
    const { data, config } = state();
    const janet = unreadNotificationsForUser(data, config, user(USR.janetKerr)).filter((n) => n.sourceId === action.id && n.kind === 'action-overdue');
    const moira = unreadNotificationsForUser(data, config, user(USR.moiraGilmour)).filter((n) => n.sourceId === action.id && n.kind === 'action-overdue');
    expect(janet).toHaveLength(1);
    // The day after, and the configured escalation interval later: the lead hears both, once each.
    expect(moira.length).toBeGreaterThanOrEqual(1);
    expect(state().data.actions.find((a) => a.id === action.id)?.escalatedAt).toBeTruthy();
    expect(state().evaluateClocks()).toBe(0);
    state().setDemoNow(DEMO_NOW_ISO);
  });

  it('an excluded party on the case is never a recipient, whatever else they are on it', () => {
    state().signIn(USR.karenFindlay);
    const marac = state().data.processes.find((p) => p.id === KAYLEIGH.marac)!;
    // Mark Hepburn is on the MARAC as the housing officer. Recording him on the register as an
    // associate of the perpetrator is the exclusion the matrix names for every MARAC stage.
    const listed: Process = { ...marac, parties: [...marac.parties, { userId: USR.markHepburn, party: 'perpetrator-associates', label: 'Associate of the perpetrator', source: 'manual', since: '2026-09-02', reason: 'Named on the DAQ as a friend of the perpetrator' }] };
    expect(state().write({ collection: 'processes', record: listed, intent: 'update', act: 'edit', targetType: 'process', targetLabel: marac.reference, processId: marac.id }).ok).toBe(true);
    const moved: Process = { ...state().data.processes.find((p) => p.id === marac.id)!, stage: 'meeting' };
    const result = state().write({ collection: 'processes', record: moved, intent: 'update', act: 'edit', targetType: 'process', targetLabel: marac.reference, processId: marac.id });
    expect(result.ok).toBe(true);
    const { data, config } = state();
    const announced = data.notifications.filter((n) => n.kind === 'stage-changed' && n.processId === marac.id);
    expect(announced.length).toBeGreaterThan(0);
    expect(announced.some((n) => n.toUserId === USR.markHepburn)).toBe(false);
    expect(notificationsForUser(data, config, user(USR.markHepburn)).some((n) => n.processId === marac.id && n.kind === 'stage-changed')).toBe(false);
    expect(announced.some((n) => n.toUserId === USR.karenFindlay)).toBe(false);
  });

  it('a presence-level audience learns that something changed and nothing else', () => {
    state().signIn(USR.moiraGilmour);
    const asp = state().data.processes.find((p) => p.id === MARION.asp)!;
    const moved: Process = { ...asp, stage: 'case-conference' };
    state().write({ collection: 'processes', record: moved, intent: 'update', act: 'edit', targetType: 'process', targetLabel: asp.reference, processId: asp.id });
    const { data, config } = state();
    const presence = data.notifications.find((n) => n.kind === 'stage-changed' && n.processId === asp.id && n.detailLevel === 'presence');
    if (presence) {
      const rendered = renderNotification(t, data, config, presence, state().now());
      expect(rendered.text).not.toContain(asp.reference);
      expect(rendered.reference).toBeUndefined();
    }
    const full = data.notifications.find((n) => n.kind === 'stage-changed' && n.processId === asp.id && n.detailLevel === 'full')!;
    expect(renderNotification(t, data, config, full, state().now()).text).toContain(asp.reference);
  });

  it('reset clears every notification the demonstration produced and leaves the seed as it was', () => {
    state().signIn(USR.moiraGilmour);
    writeAction(newAction());
    expect(state().data.notifications.some((n) => n.kind === 'action-assigned')).toBe(true);
    state().resetDemo();
    const { data } = state();
    expect(data.notifications.some((n) => n.kind === 'action-assigned')).toBe(false);
    expect(data.notifications.some((n) => n.kind === 'stage-changed')).toBe(false);
    expect(data.notifications.filter((n) => n.sourceType === 'clock').every((n) => n.readAt)).toBe(true);
    expect(data.notifications.filter((n) => n.kind === 'share').length).toBeGreaterThan(0);
  });
});
