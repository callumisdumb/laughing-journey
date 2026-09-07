import { DEFAULT_CONFIG, demoNow } from '@mas/domain';
import { AIDEN, USR, buildDataset } from '@mas/mock-data';
import { describe, expect, it } from 'vitest';
import { setQuery } from './router';
import { accessForUser, clocksForUser, currentAddress, inboxForUser, personById, processesInvolving, userById, clocksForProcess } from './selectors';

const data = buildDataset();
const now = demoNow();

describe('selectors', () => {
  it('finds Aiden and his address with move count', () => {
    const aiden = personById(data, AIDEN.aiden)!;
    const addr = currentAddress(data, aiden);
    expect(addr.line).toContain('Brae Wynd');
    expect(addr.moves).toBe(2);
  });
  it('computes clocks for Janet Kerr: the 6 month review, the notice clock counting back from the meeting, and the completed escalation', () => {
    const janet = userById(data, USR.janetKerr)!;
    const clocks = clocksForUser(data, DEFAULT_CONFIG, janet, now);
    const review = clocks.find((c) => c.ruleId === 'cp.cppm.review.first');
    expect(review?.dueAt).toBe('2026-12-12');
    expect(review?.daysRemaining).toBe(101);
    expect(review?.overridden).toBe(false);
    const notice = clocks.find((c) => c.ruleId === 'cp.cppm.notice' && c.triggerId === 'clk_aiden_notice');
    expect(notice?.dueAt).toBe('2026-09-09');
    expect(notice?.daysRemaining).toBe(7);
    const aiden = data.processes.find((p) => p.id === AIDEN.process)!;
    const escalation = clocksForProcess(data, DEFAULT_CONFIG, aiden, now).find((c) => c.ruleId === 'cp.coregroup.escalate');
    expect(escalation?.status).toBe('complete');
  });
  it('gives the head teacher summary access and housing presence only', () => {
    const process = data.processes.find((p) => p.id === AIDEN.process)!;
    const head = userById(data, USR.claireCowan)!;
    expect(accessForUser(data, DEFAULT_CONFIG, head, process, [], now).level).toBe('full');
    const housing = userById(data, USR.markHepburn)!;
    expect(accessForUser(data, DEFAULT_CONFIG, housing, process, [], now).level).toBe('presence');
  });
  it('routes inbox events by agency', () => {
    const head = userById(data, USR.claireCowan)!;
    expect(inboxForUser(data, head).every((c) => c.agency === 'education')).toBe(true);
    expect(inboxForUser(data, head).length).toBeGreaterThan(0);
  });
  it('finds processes a person is involved in without being the subject', () => {
    expect(processesInvolving(data, AIDEN.aiden).length).toBe(1);
  });
  it('builds query strings', () => {
    expect(setQuery(new URLSearchParams('a=1'), { b: '2', a: null })).toBe('?b=2');
    expect(setQuery(new URLSearchParams(''), { a: '' })).toBe('');
  });
});
