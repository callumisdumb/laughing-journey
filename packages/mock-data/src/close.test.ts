import {
  CLOSING_STAGE,
  DEATH_CLOSURE_REASON,
  applyDeath,
  closeProcess,
  closeRefusals,
  closureReasonsFor,
  deathConsequences,
  deathRefusals,
  reopenProcess,
  reopenRefusals,
  runningClocks,
  stageBeforeClosure,
} from '@mas/domain';
import { partyRegister, processSubjectIds } from '@mas/domain';
import { describe, expect, it } from 'vitest';
import { buildDataset } from './generator/build';
import { AIDEN } from './scenarios/04-aiden-boyle';
import { MARION } from './scenarios/01-marion-fraser';

const WHO = { at: '2026-09-04T10:00:00+01:00', byUserId: 'usr_moira_gilmour', byName: 'Moira Gilmour' };

/**
 * Closing and reopening, against the seed rather than a fixture.
 *
 * The interesting behaviour is all in the interaction with records the seed already holds: clocks
 * that are running, a child protection register that exists, a stage history with several entries in
 * it. A hand-made process would have to reproduce all of that to prove anything, and the version I
 * would write is the version that agrees with my code.
 */
describe('closure reason lists', () => {
  it('offers the national list for the processes that have one, and says which are local', () => {
    expect(closureReasonsFor('cp').every((r) => r.statutory)).toBe(true);
    expect(closureReasonsFor('cp').map((r) => r.id)).toContain('child-died');
    expect(closureReasonsFor('asp').map((r) => r.id)).toContain('criteria-no-opportunity');
    expect(closureReasonsFor('mappa').map((r) => r.id)).toEqual(['level-down', 'deregistration', 'transfer']);
    // MARAC and AWI have no national closure list this project has found, so theirs says so.
    expect(closureReasonsFor('marac').every((r) => r.statutory)).toBe(false);
    expect(closureReasonsFor('awi').every((r) => r.statutory)).toBe(false);
  });

  it("refuses a reason that is not on the process type's own list", () => {
    const data = buildDataset();
    const asp = data.processes.find((p) => p.type === 'asp' && p.status === 'open')!;
    expect(closeRefusals(asp, { ...WHO, reasonId: 'child-died', note: 'A reason long enough to pass.' })).toContain('closureReasonRequired');
    expect(closeRefusals(asp, { ...WHO, reasonId: 'criteria-ongoing', note: 'A reason long enough to pass.' })).toEqual([]);
  });

  it('refuses a note too short to be a reason, and refuses to close a closed case twice', () => {
    const data = buildDataset();
    const asp = data.processes.find((p) => p.type === 'asp' && p.status === 'open')!;
    expect(closeRefusals(asp, { ...WHO, reasonId: 'criteria-ongoing', note: 'done' })).toContain('closureNoteRequired');
    const closed = closeProcess(asp, { ...WHO, reasonId: 'criteria-ongoing', note: 'Support in place and agreed with the adult.' }).process;
    expect(closeRefusals(closed, { ...WHO, reasonId: 'criteria-ongoing', note: 'Support in place and agreed with the adult.' })).toContain('processAlreadyClosed');
  });
});

describe('closing a process', () => {
  it('stops every running clock and marks why it stopped', () => {
    const data = buildDataset();
    const cp = data.processes.find((p) => p.id === AIDEN.process)!;
    const before = runningClocks(cp);
    expect(before.length).toBeGreaterThan(0);

    const { process, stopped } = closeProcess(cp, { ...WHO, reasonId: 'improved-home-situation', note: 'Risks reduced and the plan is complete.' });
    expect(stopped).toHaveLength(before.length);
    expect(runningClocks(process)).toEqual([]);
    // A clock stopped by the closure is a different fact from a deadline that was met.
    expect(process.clocks.filter((c) => c.stoppedByClosure)).toHaveLength(before.length);
  });

  it('writes the coded reason where the national return reads it, not only as prose', () => {
    const data = buildDataset();
    const cp = data.processes.find((p) => p.id === AIDEN.process)!;
    const { process } = closeProcess(cp, { ...WHO, reasonId: 'improved-home-situation', note: 'Risks reduced and the plan is complete.' });
    expect(process.type).toBe('cp');
    if (process.type !== 'cp') throw new Error('expected a cp process');
    expect(process.detail.register?.deregistrationReason).toBe('improved-home-situation');
    expect(process.detail.register?.deregisteredAt).toBe('2026-09-04');
    expect(process.closureReason).toContain('improved-home-situation');
  });

  it('moves to the closing stage and writes the history entry, and MAPPA exits rather than closing', () => {
    const data = buildDataset();
    const cp = data.processes.find((p) => p.id === AIDEN.process)!;
    const { process } = closeProcess(cp, { ...WHO, reasonId: 'improved-home-situation', note: 'Risks reduced and the plan is complete.' });
    expect(process.stage).toBe('closed');
    expect(process.stageHistory.at(-1)).toMatchObject({ stage: 'closed', byName: 'Moira Gilmour' });

    const mappa = data.processes.find((p) => p.type === 'mappa')!;
    const exited = closeProcess(mappa, { ...WHO, reasonId: 'deregistration', note: 'Notification requirements have ended.' }).process;
    expect(exited.stage).toBe(CLOSING_STAGE.mappa);
    expect(exited.stage).toBe('exit');
  });
});

describe('reopening a process', () => {
  it('resumes only the clocks the closure stopped, against their original trigger', () => {
    const data = buildDataset();
    const cp = data.processes.find((p) => p.id === AIDEN.process)!;
    const met = cp.clocks.find((c) => c.completedAt);
    const closed = closeProcess(cp, { ...WHO, reasonId: 'improved-home-situation', note: 'Risks reduced and the plan is complete.' }).process;

    const { process, resumed } = reopenProcess(closed, { ...WHO, reason: 'New concern from the school in the same term.' });
    expect(resumed.length).toBeGreaterThan(0);
    expect(process.status).toBe('open');
    expect(process.closedAt).toBeUndefined();
    // The deadline did not move because the case was shut: the trigger instant is untouched.
    for (const clock of resumed) {
      const now = process.clocks.find((c) => c.id === clock.id)!;
      expect(now.triggeredAt).toBe(clock.triggeredAt);
      expect(now.completedAt).toBeUndefined();
    }
    // A deadline that was genuinely met before the closure stays met.
    if (met) expect(process.clocks.find((c) => c.id === met.id)!.completedAt).toBe(met.completedAt);
  });

  it('returns to the stage the case was actually at, not to the first one', () => {
    const data = buildDataset();
    const cp = data.processes.find((p) => p.id === AIDEN.process)!;
    const was = cp.stage;
    const closed = closeProcess(cp, { ...WHO, reasonId: 'improved-home-situation', note: 'Risks reduced and the plan is complete.' }).process;
    expect(stageBeforeClosure(closed)).toBe(was);
    expect(reopenProcess(closed, { ...WHO, reason: 'New concern from the school in the same term.' }).process.stage).toBe(was);
  });

  it('refuses to reopen a case that is not closed, and refuses a reason too short to be one', () => {
    const data = buildDataset();
    const cp = data.processes.find((p) => p.id === AIDEN.process)!;
    expect(reopenRefusals(cp, { ...WHO, reason: 'New concern from the school in the same term.' })).toContain('processNotClosed');
    const closed = closeProcess(cp, { ...WHO, reasonId: 'improved-home-situation', note: 'Risks reduced and the plan is complete.' }).process;
    expect(reopenRefusals(closed, { ...WHO, reason: 'why' })).toContain('reopenReasonRequired');
  });
});

describe('recording a death', () => {
  it("closes the cases the person is a subject of, each with its own list's reason", () => {
    const data = buildDataset();
    const consequences = deathConsequences(data, MARION.marion);
    const asp = consequences.find((c) => c.type === 'asp');
    expect(asp?.effect).toBe('close');
    expect(asp?.reasonId).toBe(DEATH_CLOSURE_REASON.asp);
    expect(asp?.reasonLabel).toContain('no opportunity');
  });

  it('does not close a case the person is only a party to, because that is for somebody to read', () => {
    const data = buildDataset();
    // Somebody on a case-role register who is not one of the case's subjects. A parent dying does
    // not close their child's child protection case; it changes it, and a person has to look at it.
    const party = data.processes
      .filter((p) => p.status === 'open')
      .flatMap((p) => partyRegister(p, data.relationships).filter((e) => e.personId && !processSubjectIds(p).includes(e.personId)).map((e) => ({ process: p, personId: e.personId! })))
      .at(0);
    expect(party).toBeDefined();

    const consequence = deathConsequences(data, party!.personId).find((c) => c.processId === party!.process.id)!;
    expect(consequence.effect).toBe('review');
    expect(consequence.because).toBe('party');
    expect(consequence.reasonId).toBeUndefined();
  });

  it('marks the person and closes each case as its own write', () => {
    const data = buildDataset();
    const input = { personId: MARION.marion, at: '2026-09-02', recordedAt: WHO.at, byUserId: WHO.byUserId, byName: WHO.byName, note: 'Marion died at home. Confirmed by the GP.' };
    const result = applyDeath(data, input);
    expect(result.person.deceased).toBe(true);
    expect(result.person.death?.at).toBe('2026-09-02');
    expect(result.processes.length).toBe(result.consequences.filter((c) => c.effect === 'close').length);
    for (const process of result.processes) expect(process.status).toBe('closed');
  });

  it('refuses a death in the future, one before the birth, and a second one', () => {
    const data = buildDataset();
    const marion = data.people.find((p) => p.id === MARION.marion)!;
    const base = { personId: MARION.marion, recordedAt: WHO.at, byName: WHO.byName, note: 'Marion died at home. Confirmed by the GP.' };
    expect(deathRefusals(marion, { ...base, at: '2027-01-01' }, '2026-09-04')).toContain('deathInFuture');
    expect(deathRefusals(marion, { ...base, at: '1900-01-01' }, '2026-09-04')).toContain('deathBeforeBirth');
    expect(deathRefusals(marion, { ...base, at: '2026-09-02', note: 'died' }, '2026-09-04')).toContain('deathNoteRequired');
    const dead = { ...marion, death: { at: '2026-09-02', recordedAt: WHO.at, byName: WHO.byName } };
    expect(deathRefusals(dead, { ...base, at: '2026-09-02' }, '2026-09-04')).toContain('deathAlreadyRecorded');
  });
});
