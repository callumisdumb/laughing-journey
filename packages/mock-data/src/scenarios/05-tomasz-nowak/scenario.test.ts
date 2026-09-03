import { datasetSchema } from '@mas/domain';
import { describe, expect, it } from 'vitest';
import { createContext } from '../../generator/context';
import { seedOrganisations } from '../../generator/organisations';
import { seedTomaszNowak, TOMASZ } from './index';

describe('scenario 5', () => {
  it('produces a valid dataset slice', () => {
    const ctx = createContext('test', '2026-09-02T09:00:00+01:00');
    seedOrganisations(ctx);
    seedTomaszNowak(ctx);
    const result = datasetSchema.safeParse(ctx.data);
    if (!result.success) throw new Error(result.error.issues.slice(0, 10).map((i) => `${i.path.join('.')}: ${i.message}`).join('\n'));
    expect(ctx.data.processes.find((p) => p.id === TOMASZ.process)?.stage).toBe('support-plan');
  });

  it('records a support plan, not a protection plan, with his consent', () => {
    const ctx = createContext('test', '2026-09-02T09:00:00+01:00');
    seedOrganisations(ctx);
    seedTomaszNowak(ctx);
    const process = ctx.data.processes.find((p) => p.id === TOMASZ.process);
    if (process?.type !== 'asp') throw new Error('expected an ASP process');
    expect(process.detail.investigation?.unduePressure).toEqual(expect.objectContaining({ considered: true, found: false }));
    expect(process.detail.ordersConsidered.every((o) => o.decision === 'not-required')).toBe(true);
    const plan = ctx.data.plans.find((p) => p.id === TOMASZ.plan);
    expect(plan?.type).toBe('adult-support');
    expect(plan?.consentNote).toBeTruthy();
    const person = ctx.data.people.find((p) => p.id === TOMASZ.tomasz);
    expect(person?.communicationNeeds.interpreterLanguage).toBe('Polish');
    expect(ctx.data.meetings.filter((m) => m.processId === TOMASZ.process).length).toBe(3);
  });
});
