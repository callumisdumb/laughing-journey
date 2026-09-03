import { datasetSchema } from '@mas/domain';
import { describe, expect, it } from 'vitest';
import { createContext } from '../../generator/context';
import { seedOrganisations } from '../../generator/organisations';
import { seedDerekMuir, DEREK } from './index';

describe('scenario 3', () => {
  it('produces a valid dataset slice', () => {
    const ctx = createContext('test', '2026-09-02T09:00:00+01:00');
    seedOrganisations(ctx);
    seedDerekMuir(ctx);
    const result = datasetSchema.safeParse(ctx.data);
    if (!result.success) throw new Error(result.error.issues.slice(0, 10).map((i) => `${i.path.join('.')}: ${i.message}`).join('\n'));
    expect(ctx.data.processes.find((p) => p.id === DEREK.process)?.classification).toBe('restricted');
  });

  it('keeps the MAPPA record restricted and away from the victim and the employer', () => {
    const ctx = createContext('test', '2026-09-02T09:00:00+01:00');
    seedOrganisations(ctx);
    seedDerekMuir(ctx);
    const process = ctx.data.processes.find((p) => p.id === DEREK.process);
    expect(process?.type).toBe('mappa');
    expect(process?.stage).toBe('managed');
    const events = ctx.data.events.filter((e) => e.subjectIds.includes(DEREK.derek));
    expect(events.length).toBeGreaterThanOrEqual(20);
    for (const e of events) {
      expect(e.visibility).toBe('restricted');
      expect(e.linkedProcessIds).toContain(DEREK.process);
    }
    const shares = ctx.data.sharingRecords.filter((s) => s.processId === DEREK.process);
    for (const s of shares) {
      expect(s.recipient.userId).toBeDefined();
      expect(['police', 'social-work', 'health', 'sps', 'housing']).toContain(s.recipient.agency);
    }
    expect(shares.find((s) => s.recipient.agency === 'housing')?.detailLevel).toBe('fields');
    expect(ctx.data.people.filter((p) => p.familyName !== 'Muir').length).toBe(0);
    const clock = process?.clocks.find((c) => c.ruleId === 'mappa.level2.review');
    expect(clock?.completedAt).toBeUndefined();
    expect(ctx.data.meetings.filter((m) => m.processId === DEREK.process).length).toBe(2);
  });
});
