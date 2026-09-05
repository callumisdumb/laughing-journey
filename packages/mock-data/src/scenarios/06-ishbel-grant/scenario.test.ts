import { datasetSchema } from '@mas/domain';
import { describe, expect, it } from 'vitest';
import { createContext } from '../../generator/context';
import { seedOrganisations } from '../../generator/organisations';
import { seedIshbelGrant, ISHBEL } from './index';

describe('scenario 6', () => {
  it('produces a valid dataset slice', () => {
    const ctx = createContext('test', '2026-09-02T09:00:00+01:00');
    seedOrganisations(ctx);
    seedIshbelGrant(ctx);
    const result = datasetSchema.safeParse(ctx.data);
    if (!result.success) throw new Error(result.error.issues.slice(0, 10).map((i) => `${i.path.join('.')}: ${i.message}`).join('\n'));
    expect(ctx.data.processes.find((p) => p.id === ISHBEL.process)?.stage).toBe('application');
  });

  it('runs the MHO report clock and records the s13ZA reasoning', () => {
    const ctx = createContext('test', '2026-09-02T09:00:00+01:00');
    seedOrganisations(ctx);
    seedIshbelGrant(ctx);
    const process = ctx.data.processes.find((p) => p.id === ISHBEL.process);
    if (process?.type !== 'awi') throw new Error('expected an AWI process');
    const clock = process.clocks.find((c) => c.ruleId === 'awi.mho.report');
    expect(clock?.triggeredAt).toBe('2026-08-24T10:00:00+01:00');
    expect(clock?.completedAt).toBeUndefined();
    expect(process.detail.routeDecision?.s13za).toEqual(expect.objectContaining({ considered: true, applied: false }));
    expect(process.detail.application?.medicalReports.filter((r) => r.status === 'received').length).toBe(2);
    expect(process.detail.application?.interimOrder?.grantedAt).toBeUndefined();
    expect(ctx.data.actions.find((a) => a.ownerUserId === 'usr_graeme_dunlop')?.due).toBe('2026-09-14');
    expect(ctx.data.connectorEvents.filter((c) => c.subjectId === ISHBEL.ishbel && c.status === 'pending').length).toBe(1);
  });
});
