import { describe, expect, it } from 'vitest';
import { PROCESS_TYPES, ROLE_DEFINITIONS, type RoleId } from '../enums';
import type { Person } from '../schemas/person';
import { ADULT_AGE, CHILD_AGE, canOpenProcess, eligibilityFor, eligibilityForAll, isYoungAdult } from './eligibility';

const NOW = new Date('2026-09-04T10:00:00+01:00');

function person(over: Partial<Person> = {}): Person {
  return {
    id: 'per_1',
    synthetic: true,
    givenName: 'Alex',
    familyName: 'Munro',
    aliases: [],
    lifeStage: 'adult',
    sex: 'not-recorded',
    addressHistory: [],
    communicationNeeds: { needs: [] },
    alerts: [],
    contact: {},
    createdAt: '2026-01-05T09:00:00Z',
    ...over,
  };
}

/** Somebody who turns `age` before the demo instant, so the comparison is not on a boundary by luck. */
const aged = (age: number) => person({ dateOfBirth: `${2026 - age}-01-15`, lifeStage: age < 18 ? 'child' : 'adult' });

describe('eligibilityFor: the adult processes', () => {
  it('accepts an adult for ASP and AWI', () => {
    for (const type of ['asp', 'awi'] as const) {
      const decision = eligibilityFor(type, aged(40), NOW);
      expect(decision.eligible).toBe(true);
      expect(decision.reason).toContain('16');
    }
  });

  it('refuses a 15 year old and says where to go instead', () => {
    for (const type of ['asp', 'awi'] as const) {
      const decision = eligibilityFor(type, aged(15), NOW);
      expect(decision.eligible).toBe(false);
      expect(decision.route).toContain('child protection');
    }
  });

  it('takes 16 as the floor rather than 18, because the Act does', () => {
    expect(eligibilityFor('asp', aged(ADULT_AGE), NOW).eligible).toBe(true);
    expect(eligibilityFor('asp', aged(ADULT_AGE - 1), NOW).eligible).toBe(false);
  });

  it('refuses an unborn baby', () => {
    const unborn = person({ lifeStage: 'unborn', expectedDeliveryDate: '2026-11-12', dateOfBirth: undefined });
    expect(eligibilityFor('asp', unborn, NOW).eligible).toBe(false);
    expect(eligibilityFor('awi', unborn, NOW).eligible).toBe(false);
  });
});

describe('eligibilityFor: child protection', () => {
  it('accepts a child', () => {
    expect(eligibilityFor('cp', aged(7), NOW).eligible).toBe(true);
  });

  it('accepts an unborn baby, because a pre-birth planning meeting is the route', () => {
    const unborn = person({ lifeStage: 'unborn', expectedDeliveryDate: '2026-11-12', dateOfBirth: undefined });
    const decision = eligibilityFor('cp', unborn, NOW);
    expect(decision.eligible).toBe(true);
    expect(decision.reason).toContain('pre-birth');
  });

  it('refuses an adult and points at adult protection', () => {
    const decision = eligibilityFor('cp', aged(30), NOW);
    expect(decision.eligible).toBe(false);
    expect(decision.route).toContain('adult support and protection');
  });

  it('takes 18 as the ceiling', () => {
    expect(eligibilityFor('cp', aged(CHILD_AGE - 1), NOW).eligible).toBe(true);
    expect(eligibilityFor('cp', aged(CHILD_AGE), NOW).eligible).toBe(false);
  });
});

describe('the 16 and 17 year old, who is both', () => {
  it('is eligible for adult protection and for child protection at once', () => {
    for (const age of [16, 17]) {
      expect(eligibilityFor('asp', aged(age), NOW).eligible).toBe(true);
      expect(eligibilityFor('cp', aged(age), NOW).eligible).toBe(true);
    }
  });

  it('says so on both, rather than picking one quietly', () => {
    const young = aged(16);
    expect(eligibilityFor('asp', young, NOW).warning).toContain('both open to them');
    expect(eligibilityFor('cp', young, NOW).warning).toContain('both open to them');
  });

  it('is not flagged for anybody else', () => {
    expect(isYoungAdult(aged(16), NOW)).toBe(true);
    expect(isYoungAdult(aged(17), NOW)).toBe(true);
    expect(isYoungAdult(aged(15), NOW)).toBe(false);
    expect(isYoungAdult(aged(18), NOW)).toBe(false);
  });
});

describe('eligibilityFor: MAPPA has no age floor', () => {
  it('does not refuse a 15 year old, because Annex 3 Table 6 has an Under 18 band', () => {
    const decision = eligibilityFor('mappa', aged(15), NOW);
    expect(decision.eligible).toBe(true);
  });

  it('warns instead, citing the Children (Care and Justice) (Scotland) Act 2024', () => {
    expect(eligibilityFor('mappa', aged(15), NOW).warning).toContain('Children (Care and Justice) (Scotland) Act 2024');
  });

  it('does not warn about an adult', () => {
    expect(eligibilityFor('mappa', aged(40), NOW).warning).toBeUndefined();
  });

  it('is still open where no date of birth is recorded, and says what that costs', () => {
    const decision = eligibilityFor('mappa', person({ dateOfBirth: undefined }), NOW);
    expect(decision.eligible).toBe(true);
    expect(decision.warning).toContain('age band');
  });
});

describe('a person with no date of birth', () => {
  it('is refused for the age-gated processes rather than treated as an infant', () => {
    const unknown = person({ dateOfBirth: undefined });
    for (const type of ['asp', 'cp', 'marac', 'awi'] as const) {
      const decision = eligibilityFor(type, unknown, NOW);
      expect(decision.eligible).toBe(false);
      expect(decision.route).toContain('date of birth');
    }
  });
});

describe('eligibilityForAll', () => {
  it('answers for every process rather than only the eligible ones', () => {
    const answers = eligibilityForAll(aged(7), NOW);
    expect(answers).toHaveLength(PROCESS_TYPES.length);
    expect(answers.every((a) => a.eligibility.reason.length > 10)).toBe(true);
  });
});

describe('canOpenProcess', () => {
  const ROLES = Object.keys(ROLE_DEFINITIONS) as RoleId[];

  it('lets the council officer open an ASP inquiry and not a MAPPA case', () => {
    expect(canOpenProcess('council-officer-asp', 'asp')).toEqual({ allowed: true });
    expect(canOpenProcess('council-officer-asp', 'mappa').allowed).toBe(false);
  });

  it('lets any protocol agency refer to MARAC', () => {
    for (const roleId of ['housing-officer', 'health-visitor', 'idaa', 'gp'] as const) {
      expect(canOpenProcess(roleId, 'marac')).toEqual({ allowed: true });
    }
  });

  it('refuses a housing officer a MAPPA case and tells them where to send it', () => {
    const decision = canOpenProcess('housing-officer', 'mappa');
    expect(decision.allowed).toBe(false);
    if (!decision.allowed) expect(decision.route).toContain('MAPPA coordinator');
  });

  it('refuses every oversight role that holds no cases', () => {
    for (const roleId of ['inspector', 'system-administrator'] as const) {
      for (const type of PROCESS_TYPES) expect(canOpenProcess(roleId, type).allowed).toBe(false);
    }
  });

  it('does not refuse the Chief Social Work Officer, who signs off and holds cases', () => {
    for (const type of ['asp', 'cp', 'mappa', 'awi'] as const) expect(canOpenProcess('cswo', type)).toEqual({ allowed: true });
  });

  it('never refuses without a route', () => {
    for (const roleId of ROLES) {
      for (const type of PROCESS_TYPES) {
        const decision = canOpenProcess(roleId, type);
        if (!decision.allowed) {
          expect(decision.reason.length).toBeGreaterThan(10);
          expect(decision.route.length).toBeGreaterThan(10);
        }
      }
    }
  });
});
