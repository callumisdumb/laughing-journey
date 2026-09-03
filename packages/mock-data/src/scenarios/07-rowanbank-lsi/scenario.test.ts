import { datasetSchema } from '@mas/domain';
import { describe, expect, it } from 'vitest';
import { createContext } from '../../generator/context';
import { seedOrganisations } from '../../generator/organisations';
import { seedRowanbankLsi, ROWANBANK } from './index';

describe('scenario 7', () => {
  it('produces a valid dataset slice', () => {
    const ctx = createContext('test', '2026-09-02T09:00:00+01:00');
    seedOrganisations(ctx);
    seedRowanbankLsi(ctx);
    const result = datasetSchema.safeParse(ctx.data);
    if (!result.success) throw new Error(result.error.issues.slice(0, 10).map((i) => `${i.path.join('.')}: ${i.message}`).join('\n'));
    expect(ctx.data.processes.find((p) => p.id === ROWANBANK.process)?.classification).toBe('official-sensitive');
  });

  it('runs one process for six residents with a strand each', () => {
    const ctx = createContext('test', '2026-09-02T09:00:00+01:00');
    seedOrganisations(ctx);
    seedRowanbankLsi(ctx);
    const process = ctx.data.processes.find((p) => p.id === ROWANBANK.process);
    expect(process?.type).toBe('asp');
    expect(process?.stage).toBe('investigation');
    expect(process?.subjectIds.length).toBe(6);
    if (process?.type !== 'asp') throw new Error('expected an ASP process');
    expect(process.detail.lsi?.strands.map((s) => s.subjectId).sort()).toEqual([...process.subjectIds].sort());
    const household = ctx.data.households.find((h) => h.id === ROWANBANK.household);
    expect(household?.memberIds.length).toBe(6);
    expect(household?.addressId).toBe(ROWANBANK.address);
    for (const id of process.subjectIds) {
      const person = ctx.data.people.find((p) => p.id === id);
      expect(person?.addressHistory[0]?.addressId).toBe(ROWANBANK.address);
      expect(person?.gpPractice).toBe('Braeside Health Centre');
    }
    const settingLevel = ctx.data.events.filter((e) => e.linkedProcessIds.includes(ROWANBANK.process) && e.subjectIds.length === 6);
    expect(settingLevel.length).toBeGreaterThanOrEqual(8);
    expect(ctx.data.meetings.filter((m) => m.processId === ROWANBANK.process).length).toBe(2);
    expect(ctx.data.plans.filter((p) => p.processId === ROWANBANK.process).length).toBe(0);
    expect(ctx.data.connectorEvents.filter((c) => c.connectorId === 'emis-web' && c.status === 'pending').length).toBe(2);
    expect(ctx.data.actions.filter((a) => a.processId === ROWANBANK.process && a.status === 'open' && a.due < '2026-09-02').length).toBe(1);
  });
});
