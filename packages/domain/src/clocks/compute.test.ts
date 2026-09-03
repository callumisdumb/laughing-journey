import { describe, expect, it } from 'vitest';
import { parseISO } from 'date-fns';
import { addWorkingDays, bandFor, computeClock, dueDateFor, sortByUrgency } from './compute';
import { CLOCK_RULES, findClockRule } from './rules';
import type { ClockRule } from '../schemas/config';
import { clockRuleSchema } from '../schemas/config';

const now = parseISO('2026-09-02T09:00:00+01:00');
const holidays = ['2026-09-07'];

function rule(id: string): ClockRule {
  const r = findClockRule(CLOCK_RULES, id);
  if (!r) throw new Error(`missing rule ${id}`);
  return r;
}

describe('clock rules', () => {
  it('are all valid against the schema', () => {
    for (const r of CLOCK_RULES) expect(() => clockRuleSchema.parse(r)).not.toThrow();
  });
  it('carry the researched values', () => {
    expect(rule('cp.cppm.initial')).toMatchObject({ unit: 'calendar-days', amount: 28, confidence: 'high' });
    expect(rule('cp.coregroup.first')).toMatchObject({ unit: 'working-days', amount: 15 });
    expect(rule('cp.cppm.review.first')).toMatchObject({ unit: 'months', amount: 6 });
    expect(rule('mappa.level2.review')).toMatchObject({ unit: 'weeks', amount: 12 });
    expect(rule('mappa.level3.review')).toMatchObject({ unit: 'weeks', amount: 6 });
    expect(rule('awi.mho.report')).toMatchObject({ unit: 'calendar-days', amount: 21 });
    expect(rule('awi.interim.maximum')).toMatchObject({ unit: 'months', amount: 6 });
  });
  it('mark local and unverified rules', () => {
    expect(rule('asp.inquiry.decision').todoVerify).toBe(true);
    expect(rule('marac.flag.expiry').todoVerify).toBeUndefined();
  });
  it('returns undefined for an unknown rule', () => {
    expect(findClockRule(CLOCK_RULES, 'nope')).toBeUndefined();
  });
});

describe('dueDateFor', () => {
  it('adds calendar days', () => {
    const due = dueDateFor(rule('cp.cppm.initial'), '2026-08-14T15:30:00+01:00');
    expect(due.getDate()).toBe(11);
    expect(due.getMonth()).toBe(8);
  });
  it('adds working days skipping weekends and bank holidays', () => {
    const due = dueDateFor(rule('asp.inquiry.decision'), '2026-09-04T10:00:00+01:00', { bankHolidays: holidays });
    expect(due.getDate()).toBe(14);
  });
  it('adds weeks and months', () => {
    expect(dueDateFor(rule('mappa.level2.review'), '2026-07-22T10:00:00+01:00').getMonth()).toBe(9);
    expect(dueDateFor(rule('cp.cppm.review.first'), '2026-03-31T10:00:00+01:00').getMonth()).toBe(8);
  });
  it('adds zero working days', () => {
    const d = addWorkingDays(parseISO('2026-09-02T00:00:00'), 0, new Set());
    expect(d.getDate()).toBe(2);
  });
});

describe('bandFor', () => {
  it('maps days to bands', () => {
    expect(bandFor(-1, 7, false)).toBe('critical');
    expect(bandFor(0, 7, false)).toBe('high');
    expect(bandFor(2, 7, false)).toBe('high');
    expect(bandFor(5, 7, false)).toBe('medium');
    expect(bandFor(8, 7, false)).toBe('low');
    expect(bandFor(-30, 7, true)).toBe('low');
  });
});

describe('computeClock', () => {
  it('computes a running clock', () => {
    const r = computeClock({ id: 'clk_1', ruleId: 'awi.mho.report', triggeredAt: '2026-08-24T09:00:00+01:00' }, rule('awi.mho.report'), now);
    expect(r.dueAt).toBe('2026-09-14');
    expect(r.daysRemaining).toBe(12);
    expect(r.band).toBe('low');
    expect(r.status).toBe('running');
    expect(r.overridden).toBe(false);
    expect(r.todoVerify).toBe(false);
    expect(r.sourceRef).toContain('21 days');
  });
  it('computes an overdue clock', () => {
    const r = computeClock({ id: 'clk_2', ruleId: 'cp.cppm.initial', triggeredAt: '2026-07-01T09:00:00+01:00' }, rule('cp.cppm.initial'), now);
    expect(r.status).toBe('overdue');
    expect(r.band).toBe('critical');
    expect(r.daysRemaining).toBeLessThan(0);
  });
  it('honours a completed trigger', () => {
    const r = computeClock({ id: 'clk_3', ruleId: 'cp.cppm.initial', triggeredAt: '2026-07-01T09:00:00+01:00', completedAt: '2026-07-20T09:00:00+01:00' }, rule('cp.cppm.initial'), now);
    expect(r.status).toBe('complete');
    expect(r.band).toBe('low');
  });
  it('honours a due override with reason', () => {
    const r = computeClock({ id: 'clk_4', ruleId: 'cp.prebirth.cppm', triggeredAt: '2026-08-20T09:00:00+01:00', dueOverride: '2026-09-05', overrideReason: 'By 28 weeks gestation' }, rule('cp.prebirth.cppm'), now);
    expect(r.dueAt).toBe('2026-09-05');
    expect(r.overridden).toBe(true);
    expect(r.overrideReason).toBe('By 28 weeks gestation');
    expect(r.band).toBe('medium');
  });
  it('falls back to source when sourceRef is missing and marks todoVerify', () => {
    const r: ClockRule = { ...rule('asp.plan.review'), sourceRef: undefined };
    const out = computeClock({ id: 'clk_5', ruleId: r.id, triggeredAt: '2026-08-01T09:00:00+01:00' }, r, now);
    expect(out.sourceRef).toBe(r.source);
    expect(out.todoVerify).toBe(true);
  });
});

describe('sortByUrgency', () => {
  it('puts overdue first and complete last', () => {
    const a = computeClock({ id: 'a', ruleId: 'cp.cppm.initial', triggeredAt: '2026-07-01T09:00:00+01:00' }, rule('cp.cppm.initial'), now);
    const b = computeClock({ id: 'b', ruleId: 'awi.mho.report', triggeredAt: '2026-08-24T09:00:00+01:00' }, rule('awi.mho.report'), now);
    const c = computeClock({ id: 'c', ruleId: 'awi.mho.report', triggeredAt: '2026-08-24T09:00:00+01:00', completedAt: '2026-08-30T09:00:00+01:00' }, rule('awi.mho.report'), now);
    expect(sortByUrgency([c, b, a]).map((x) => x.triggerId)).toEqual(['a', 'b', 'c']);
    expect(sortByUrgency([b, c]).map((x) => x.triggerId)).toEqual(['b', 'c']);
    expect(sortByUrgency([c, a]).map((x) => x.triggerId)).toEqual(['a', 'c']);
  });
});

describe('notice and holiday handling', () => {
  it('counts a before rule back from its anchor', () => {
    const notice = rule('cp.cppm.notice');
    const due = dueDateFor(notice, '2026-09-14T10:00:00+01:00');
    expect(due.toISOString().slice(0, 10)).toBe('2026-09-09');
  });
  it('skips council holidays as well as bank holidays for working-day rules', () => {
    const r = rule('asp.inquiry.decision');
    const plain = dueDateFor(r, '2026-09-18T10:00:00+01:00');
    const withCouncil = dueDateFor(r, '2026-09-18T10:00:00+01:00', { councilHolidays: ['2026-09-21'] });
    expect(withCouncil.getTime()).toBeGreaterThan(plain.getTime());
  });
});
