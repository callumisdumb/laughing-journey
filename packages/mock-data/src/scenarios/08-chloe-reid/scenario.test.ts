import { datasetSchema } from '@mas/domain';
import { describe, expect, it } from 'vitest';
import { createContext } from '../../generator/context';
import { seedOrganisations } from '../../generator/organisations';
import { CHLOE, seedChloeReid } from './index';

describe('scenario 8', () => {
  it('produces a valid dataset slice', () => {
    const ctx = createContext('test', '2026-09-02T09:00:00+01:00');
    seedOrganisations(ctx);
    seedChloeReid(ctx);
    const result = datasetSchema.safeParse(ctx.data);
    if (!result.success) throw new Error(result.error.issues.slice(0, 10).map((i) => `${i.path.join('.')}: ${i.message}`).join('\n'));
    expect(ctx.data.processes.find((p) => p.id === CHLOE.cp)?.stage).toBe('investigation');
    expect(ctx.data.processes.find((p) => p.id === CHLOE.marac)?.stage).toBe('referral');
    expect(ctx.data.processes.find((p) => p.id === CHLOE.cp2019)?.status).toBe('closed');
  });

  it('handles the unborn baby and the pre-birth clock, and never makes the perpetrator a recipient', () => {
    const ctx = createContext('test', '2026-09-02T09:00:00+01:00');
    seedOrganisations(ctx);
    seedChloeReid(ctx);
    const baby = ctx.data.people.find((p) => p.id === CHLOE.unborn);
    expect(baby?.lifeStage).toBe('unborn');
    expect(baby?.dateOfBirth).toBeUndefined();
    expect(baby?.expectedDeliveryDate).toBe('2026-11-27');
    expect(ctx.data.relationships.some((r) => r.fromPersonId === CHLOE.unborn && r.toPersonId === CHLOE.chloe && r.type === 'unborn-child-of')).toBe(true);
    const cp = ctx.data.processes.find((p) => p.id === CHLOE.cp);
    expect(cp?.clocks[0]?.ruleId).toBe('cp.prebirth.cppm');
    expect(cp?.clocks[0]?.dueOverride).toBe('2026-09-04');
    expect(cp?.linkedProcessIds).toEqual(expect.arrayContaining([CHLOE.marac, CHLOE.cp2019]));
    const dash = ctx.data.riskAssessments.find((r) => r.id === CHLOE.dash);
    expect(dash?.items).toHaveLength(24);
    expect(dash?.items?.filter((i) => i.answer === 'yes')).toHaveLength(15);
    for (const s of ctx.data.sharingRecords) expect(s.recipient.name).not.toContain('Jordan Blake');
    for (const m of ctx.data.meetings) {
      for (const i of m.invitees) expect(i.name).not.toContain('Jordan Blake');
      for (const d of m.distribution) expect(d.recipientName).not.toContain('Jordan Blake');
    }
  });
});
