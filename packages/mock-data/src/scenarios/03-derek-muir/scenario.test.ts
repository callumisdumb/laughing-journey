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
    // Official-Sensitive **and** access restricted. Two properties, because RESTRICTED has not been
    // a classification since 2014 and a MAPPA record needs both said about it.
    const process = ctx.data.processes.find((p) => p.id === DEREK.process);
    expect(process?.classification).toEqual({ level: 'official', sensitive: true, handling: [] });
    expect(process?.accessRestriction).toBe('restricted');
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

  it('holds one active Sexual Harm Prevention Order on the civil order register for the annual report', () => {
    const ctx = createContext('test', '2026-09-02T09:00:00+01:00');
    seedOrganisations(ctx);
    seedDerekMuir(ctx);
    const process = ctx.data.processes.find((p) => p.id === DEREK.process);
    if (process?.type !== 'mappa') throw new Error('expected a MAPPA process');
    expect(process.detail.orders).toHaveLength(1);
    expect(process.detail.orders[0]).toMatchObject({ kind: 'shpo', status: 'active', madeAt: '2026-07-20', court: 'Ardvale Sheriff Court' });
    expect(process.detail.orders[0]?.expiresAt).toBe('2031-07-19');
  });
});
