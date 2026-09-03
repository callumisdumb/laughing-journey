import { describe, expect, it } from 'vitest';
import { MEETING_TYPES } from '../enums';
import { CLOCK_RULES } from './rules';
import { MEETING_TRANSITIONS, applyMeetingTransition } from './transitions';

let n = 0;
const newId = (p: string) => `${p}_${++n}`;

describe('meeting transitions', () => {
  it('references only known rules and covers every meeting type', () => {
    const ids = new Set(CLOCK_RULES.map((r) => r.id));
    for (const t of MEETING_TYPES) {
      const tr = MEETING_TRANSITIONS[t];
      for (const id of [...tr.completes, ...tr.starts]) expect(ids.has(id)).toBe(true);
    }
  });
  it('a CPPM completes the initial clock and starts core group and review clocks', () => {
    const r = applyMeetingTransition([{ id: 'c1', ruleId: 'cp.cppm.initial', triggeredAt: '2026-05-20T11:30:00+01:00' }], 'cppm', '2026-06-12T10:00:00+01:00', newId);
    expect(r.completed).toEqual(['cp.cppm.initial']);
    expect(r.started.sort()).toEqual(['cp.coregroup.first', 'cp.cppm.review.first']);
    expect(r.clocks.find((c) => c.ruleId === 'cp.cppm.initial')?.completedAt).toBe('2026-06-12T10:00:00+01:00');
    expect(r.clocks.length).toBe(3);
  });
  it('does not start a clock that is already running, and leaves completed ones alone', () => {
    const r = applyMeetingTransition([{ id: 'c1', ruleId: 'mappa.level2.review', triggeredAt: '2026-07-14T10:00:00+01:00', completedAt: '2026-08-01T10:00:00+01:00' }, { id: 'c2', ruleId: 'mappa.level2.review', triggeredAt: '2026-08-01T10:00:00+01:00' }], 'mappa-level2', '2026-10-06T10:00:00+01:00', newId);
    expect(r.completed).toEqual(['mappa.level2.review']);
    expect(r.started).toEqual(['mappa.level2.review']);
    expect(r.clocks.filter((c) => !c.completedAt).length).toBe(1);
  });
  it('a meeting with no transitions changes nothing', () => {
    const r = applyMeetingTransition([{ id: 'c1', ruleId: 'awi.mho.report', triggeredAt: '2026-08-24T10:00:00+01:00' }], 'awi-mdt', '2026-09-10T10:00:00+01:00', newId);
    expect(r.completed).toEqual([]);
    expect(r.started).toEqual([]);
    expect(r.clocks.length).toBe(1);
  });
});
