import { datasetSchema } from '@mas/domain';
import { describe, expect, it } from 'vitest';
import { createContext } from '../../generator/context';
import { seedOrganisations } from '../../generator/organisations';
import { seedMarionFraser, MARION } from './index';

describe('scenario 1', () => {
  it('produces a valid dataset slice', () => {
    const ctx = createContext('test', '2026-09-02T09:00:00+01:00');
    seedOrganisations(ctx);
    seedMarionFraser(ctx);
    const result = datasetSchema.safeParse(ctx.data);
    if (!result.success) throw new Error(result.error.issues.slice(0, 10).map((i) => `${i.path.join('.')}: ${i.message}`).join('\n'));
    expect(ctx.data.processes.find((p) => p.id === MARION.asp)?.stage).toBe('investigation');
    expect(ctx.data.processes.find((p) => p.id === MARION.awi)?.stage).toBe('capacity-concern');
  });

  it('links the ASP and AWI processes both ways', () => {
    const ctx = createContext('test', '2026-09-02T09:00:00+01:00');
    seedOrganisations(ctx);
    seedMarionFraser(ctx);
    const asp = ctx.data.processes.find((p) => p.id === MARION.asp);
    const awi = ctx.data.processes.find((p) => p.id === MARION.awi);
    expect(asp?.linkedProcessIds).toContain(MARION.awi);
    expect(awi?.linkedProcessIds).toContain(MARION.asp);
    if (asp?.type !== 'asp') throw new Error('expected an ASP process');
    expect(asp.detail.investigation?.capacity.linkedAwiProcessId).toBe(MARION.awi);
    expect(ctx.data.meetings.filter((m) => m.processId === MARION.asp).length).toBe(2);
    expect(ctx.data.connectorEvents.filter((c) => c.subjectId === MARION.marion && c.status === 'pending').length).toBe(1);
    expect(ctx.data.actions.filter((a) => a.processId === MARION.asp && a.status !== 'complete' && a.due < '2026-09-02').length).toBe(1);
  });
});
