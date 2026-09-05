import { datasetSchema, isExcludedParty } from '@mas/domain';
import { describe, expect, it } from 'vitest';
import { createContext } from '../../generator/context';
import { seedOrganisations } from '../../generator/organisations';
import { KAYLEIGH, seedKayleighDocherty } from './index';

describe('scenario 2', () => {
  it('produces a valid dataset slice', () => {
    const ctx = createContext('test', '2026-09-02T09:00:00+01:00');
    seedOrganisations(ctx);
    seedKayleighDocherty(ctx);
    const result = datasetSchema.safeParse(ctx.data);
    if (!result.success) throw new Error(result.error.issues.slice(0, 10).map((i) => `${i.path.join('.')}: ${i.message}`).join('\n'));
    expect(ctx.data.processes.find((p) => p.id === KAYLEIGH.marac)?.stage).toBe('research');
  });

  it('never makes the perpetrator a recipient and links the two processes both ways', () => {
    const ctx = createContext('test', '2026-09-02T09:00:00+01:00');
    seedOrganisations(ctx);
    seedKayleighDocherty(ctx);
    const marac = ctx.data.processes.find((p) => p.id === KAYLEIGH.marac);
    const cp = ctx.data.processes.find((p) => p.id === KAYLEIGH.cp);
    expect(marac?.linkedProcessIds).toContain(KAYLEIGH.cp);
    expect(cp?.linkedProcessIds).toContain(KAYLEIGH.marac);
    expect(cp?.stage).toBe('investigation');
    for (const s of ctx.data.sharingRecords) expect(s.recipient.name).not.toContain('Ryan Kerr');
    for (const m of ctx.data.meetings) {
      for (const i of m.invitees) expect(i.name).not.toContain('Ryan Kerr');
      for (const d of m.distribution) expect(d.recipientName).not.toContain('Ryan Kerr');
    }
    const daq = ctx.data.riskAssessments.find((r) => r.id === KAYLEIGH.daq);
    expect(daq?.items).toHaveLength(27);
    expect(daq?.items?.filter((i) => i.answer === 'yes')).toHaveLength(17);
    expect(marac?.type === 'marac' && marac.detail.researchRequests.length).toBe(8);
  });

  it('keys the MARAC exclusions on case role: perpetrator and his brother out, Kayleigh and the children never', () => {
    const ctx = createContext('test', '2026-09-02T09:00:00+01:00');
    seedOrganisations(ctx);
    seedKayleighDocherty(ctx);
    const marac = ctx.data.processes.find((p) => p.id === KAYLEIGH.marac);
    if (!marac) throw new Error('no MARAC process');
    expect(marac.parties.find((p) => p.personId === KAYLEIGH.ryan)?.party).toBe('perpetrator');
    expect(marac.parties.find((p) => p.personId === KAYLEIGH.craig)).toMatchObject({ party: 'perpetrator-associates', source: 'relationship' });
    expect(isExcludedParty(marac, { personId: KAYLEIGH.ryan })?.exclusion.id).toBe('marac.all.perpetrator');
    expect(isExcludedParty(marac, { personId: KAYLEIGH.craig })?.exclusion.id).toBe('marac.all.associates');
    for (const safe of [KAYLEIGH.kayleigh, KAYLEIGH.lily, KAYLEIGH.mason]) {
      expect(marac.parties.some((p) => p.personId === safe)).toBe(false);
      expect(isExcludedParty(marac, { personId: safe }, undefined, undefined, ctx.data.relationships)).toBeNull();
    }
    for (const m of marac.members) expect(isExcludedParty(marac, { userId: m.userId })).toBeNull();
  });
});
