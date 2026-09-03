import { describe, expect, it } from 'vitest';
import { MAPPA_STAGES, MARAC_STAGES } from '../enums';
import type { Relationship } from '../schemas/person';
import { casePartySchema, processSchema, type MappaProcess, type MaracProcess, type Process } from '../schemas/process';
import { EXCLUSIONS } from './exclusions';
import { ASSOCIATE_RELATIONSHIPS, applicableExclusions, isExcludedParty, partiesFromRoles, partyRegister } from './parties';

const base = {
  synthetic: true as const,
  subjectIds: ['per_victim'],
  leadAgency: 'social-work' as const,
  stageHistory: [],
  status: 'open' as const,
  classification: 'official-sensitive' as const,
  openedAt: '2026-08-24T15:00:00+01:00',
  members: [],
  clocks: [],
  linkedProcessIds: [],
  viewsRecordIds: [],
  riskAssessmentIds: [],
  flags: {},
  parties: [],
};

const marac: MaracProcess = {
  ...base,
  id: 'prc_marac',
  type: 'marac',
  reference: 'MARAC-0001',
  title: 'MARAC',
  stage: 'research',
  detail: {
    referral: {
      receivedAt: '2026-08-24T15:00:00+01:00',
      referringAgency: 'police',
      referrerName: 'DC Test',
      riskAssessmentId: 'ra_1',
      professionalJudgementReferral: false,
      repeat: false,
      victimPersonId: 'per_victim',
      perpetratorPersonId: 'per_perp',
      childPersonIds: ['per_child_listed'],
      summary: 'x',
    },
    researchRequests: [],
    idaa: { name: 'IDAA', organisation: "Women's Aid" },
    idaaFeedback: [],
    flags: [],
    links: { matacConsidered: false, dsdasConsidered: false },
    safeLivesReturn: { referralSource: 'police', repeat: false, childrenCount: 1, outcomeCodes: [] },
  },
};

let relId = 0;
function rel(fromPersonId: string, toPersonId: string, type: Relationship['type']): Relationship {
  relId += 1;
  return { id: `rel_${relId}`, synthetic: true, fromPersonId, toPersonId, type };
}

const relationships: Relationship[] = [
  rel('per_perp', 'per_victim', 'ex-partner-of'),
  rel('per_perp', 'per_child_listed', 'father-of'),
  rel('per_victim', 'per_child_listed', 'mother-of'),
  rel('per_victim', 'per_child_unlisted', 'mother-of'),
  rel('per_perp', 'per_child_unlisted', 'step-parent-of'),
  rel('per_unborn', 'per_victim', 'unborn-child-of'),
  rel('per_perp', 'per_unborn', 'father-of'),
  rel('per_ex', 'per_perp', 'ex-partner-of'),
  rel('per_brother', 'per_perp', 'sibling-of'),
  rel('per_mother', 'per_perp', 'mother-of'),
  rel('per_perp', 'per_other_child', 'father-of'),
  rel('per_perp', 'per_flatmate', 'lives-with'),
  rel('per_perp', 'per_mate', 'associate-of'),
  rel('per_perp', 'per_mate', 'lives-with'),
  rel('per_worker', 'per_perp', 'professional-for'),
  rel('per_landlord', 'per_perp', 'landlord-of'),
  rel('per_stranger_a', 'per_stranger_b', 'sibling-of'),
];

const mappa: MappaProcess = {
  ...base,
  id: 'prc_mappa',
  type: 'mappa',
  reference: 'MAPPA-0001',
  title: 'MAPPA',
  subjectIds: ['per_offender'],
  leadAgency: 'police',
  stage: 'managed',
  classification: 'restricted',
  detail: {
    category: 1,
    level: 2,
    levelHistory: [],
    leadResponsibleAuthority: 'police',
    visorReference: 'V-1',
    victimPersonIds: ['per_mappa_victim'],
    notification: { at: '2026-05-10T14:00:00+01:00', source: 'SPS', byName: 'B' },
    sonr: { subject: true, compliant: true },
    custody: {},
    licenceConditions: [],
    riskAssessmentIds: [],
    disclosures: [],
    preMeetingReturns: [],
    reviewSchedule: {},
  },
};

const asp: Process = {
  ...base,
  id: 'prc_asp',
  type: 'asp',
  reference: 'ASP-0001',
  title: 'ASP',
  subjectIds: ['per_adult'],
  stage: 'case-conference',
  parties: [{ userId: 'usr_alleged', party: 'alleged-perpetrator', label: 'Alleged perpetrator (persona)', source: 'manual', since: '2026-08-01', reason: 'Named in the concern' }],
  detail: {
    concern: { receivedAt: '2026-08-01T09:00:00+01:00', source: 'Bank', sourceAgency: 'police', summary: 'x', harmTypes: ['financial'], immediateSafety: 'none', policeInvolved: true },
    threePointTest: { assessedAt: '2026-08-01T10:00:00+01:00', byName: 'A', a: { met: 'yes', reasoning: 'r' }, b: { met: 'yes', reasoning: 'r' }, c: { met: 'yes', reasoning: 'r' }, outcome: 'met' },
    ordersConsidered: [],
  },
};

const cp: Process = {
  ...base,
  id: 'prc_cp',
  type: 'cp',
  reference: 'CP-0001',
  title: 'CP',
  subjectIds: ['per_child_listed'],
  stage: 'ird',
  detail: { concern: { receivedAt: '2026-08-01T09:00:00+01:00', source: 'School', sourceAgency: 'education', summary: 'x' } },
};

const awi: Process = {
  ...base,
  id: 'prc_awi',
  type: 'awi',
  reference: 'AWI-0001',
  title: 'AWI',
  subjectIds: ['per_adult'],
  stage: 'application',
  detail: { concern: { raisedAt: '2026-08-01T09:00:00+01:00', source: 'Ward', sourceAgency: 'health', decisionInQuestion: 'x', summary: 'x' }, capacityAssessments: [], orders: [], supervisionVisits: [], investigations: [] },
};

describe('casePartySchema', () => {
  it('needs a person or a user', () => {
    expect(casePartySchema.safeParse({ party: 'perpetrator', label: 'x', source: 'manual' }).success).toBe(false);
    expect(casePartySchema.safeParse({ personId: 'per_1', party: 'perpetrator', label: 'x', source: 'referral' }).success).toBe(true);
    expect(casePartySchema.safeParse({ userId: 'usr_1', party: 'victim', label: 'x', source: 'manual', since: '2026-01-01', reason: 'r' }).success).toBe(true);
  });
  it('defaults the register and MAPPA victims to empty', () => {
    const { parties: _p, ...withoutParties } = marac;
    const parsed = processSchema.parse(withoutParties);
    expect(parsed.parties).toEqual([]);
    const { victimPersonIds: _v, ...detail } = mappa.detail;
    const parsedMappa = processSchema.parse({ ...mappa, detail });
    expect(parsedMappa.type === 'mappa' && parsedMappa.detail.victimPersonIds).toEqual([]);
  });
});

describe('applicableExclusions', () => {
  it('keeps wildcard rows and the stage row only', () => {
    const meeting = applicableExclusions('mappa', 'meeting');
    expect(meeting.map((e) => e.id)).toContain('mappa.meeting.not-on-distribution');
    expect(meeting.map((e) => e.id)).toContain('mappa.all.victims');
    expect(meeting.map((e) => e.id)).not.toContain('mappa.managed.not-on-distribution');
    expect(applicableExclusions('awi', 'application')).toEqual([]);
    expect(applicableExclusions('marac', 'meeting', [])).toEqual([]);
  });
});

describe('partiesFromRoles', () => {
  it('derives the MARAC perpetrator from the referral', () => {
    const parties = partiesFromRoles(marac);
    expect(parties).toEqual([
      expect.objectContaining({ personId: 'per_perp', party: 'perpetrator', source: 'referral', since: '2026-08-24' }),
    ]);
  });
  it('derives family and associates from relationships in either direction, with a description', () => {
    const parties = partiesFromRoles(marac, relationships);
    const associates = parties.filter((p) => p.party === 'perpetrator-associates');
    const label = (personId: string) => associates.find((p) => p.personId === personId)?.label;
    expect(associates.map((p) => p.personId).sort()).toEqual(['per_brother', 'per_ex', 'per_flatmate', 'per_mate', 'per_mother', 'per_other_child']);
    expect(label('per_ex')).toBe("Perpetrator's former partner (relationship record)");
    expect(label('per_brother')).toBe("Perpetrator's sibling (relationship record)");
    expect(label('per_mother')).toBe("Perpetrator's mother (relationship record)");
    expect(label('per_other_child')).toBe("Perpetrator's child (relationship record)");
    expect(label('per_flatmate')).toBe("Perpetrator's household member (relationship record)");
    for (const a of associates) expect(a.source).toBe('relationship');
    // One entry per person even when several relationships link them.
    expect(associates.filter((p) => p.personId === 'per_mate')).toHaveLength(1);
  });
  it('never derives the victim or her children as associates', () => {
    const ids = partiesFromRoles(marac, relationships).map((p) => p.personId);
    for (const safe of ['per_victim', 'per_child_listed', 'per_child_unlisted', 'per_unborn']) expect(ids).not.toContain(safe);
  });
  it('ignores professional and landlord relationships and those not touching the perpetrator', () => {
    const ids = partiesFromRoles(marac, relationships).map((p) => p.personId);
    for (const other of ['per_worker', 'per_landlord', 'per_stranger_a', 'per_stranger_b']) expect(ids).not.toContain(other);
    expect(ASSOCIATE_RELATIONSHIPS).not.toContain('professional-for');
    expect(ASSOCIATE_RELATIONSHIPS).toContain('ex-partner-of');
  });
  it('derives MAPPA victims from the case', () => {
    expect(partiesFromRoles(mappa)).toEqual([expect.objectContaining({ personId: 'per_mappa_victim', party: 'victim', source: 'referral', since: '2026-05-10' })]);
    expect(partiesFromRoles({ ...mappa, detail: { ...mappa.detail, victimPersonIds: [] } })).toEqual([]);
  });
  it('derives nothing for ASP, CP and AWI', () => {
    expect(partiesFromRoles(asp, relationships)).toEqual([]);
    expect(partiesFromRoles(cp, relationships)).toEqual([]);
    expect(partiesFromRoles(awi, relationships)).toEqual([]);
  });
});

describe('partyRegister', () => {
  it('lets explicit entries win over derived ones and keeps the rest', () => {
    const explicit: MaracProcess = {
      ...marac,
      parties: [
        { personId: 'per_perp', party: 'perpetrator', label: 'Perpetrator (named in the police referral of 24 Aug)', source: 'referral', since: '2026-08-24' },
        { userId: 'usr_cousin', party: 'perpetrator-associates', label: "Perpetrator's cousin (persona)", source: 'manual', reason: 'Works in the housing office' },
      ],
    };
    const register = partyRegister(explicit, relationships);
    expect(register.filter((p) => p.personId === 'per_perp')).toHaveLength(1);
    expect(register[0]?.label).toBe('Perpetrator (named in the police referral of 24 Aug)');
    expect(register.some((p) => p.userId === 'usr_cousin')).toBe(true);
    expect(register.some((p) => p.personId === 'per_brother')).toBe(true);
  });
});

describe('isExcludedParty', () => {
  it('excludes the perpetrator at every MARAC stage', () => {
    for (const stage of MARAC_STAGES) {
      const hit = isExcludedParty({ ...marac, stage }, { personId: 'per_perp' });
      expect(hit?.exclusion.id).toBe('marac.all.perpetrator');
      expect(hit?.party.party).toBe('perpetrator');
    }
  });
  it('excludes an ex-partner of the perpetrator as an associate', () => {
    const hit = isExcludedParty(marac, { personId: 'per_ex' }, EXCLUSIONS, undefined, relationships);
    expect(hit?.exclusion.id).toBe('marac.all.associates');
    expect(hit?.party.label).toBe("Perpetrator's former partner (relationship record)");
  });
  it('never excludes the victim or her children', () => {
    for (const stage of MARAC_STAGES) {
      for (const safe of ['per_victim', 'per_child_listed', 'per_child_unlisted', 'per_unborn']) {
        expect(isExcludedParty({ ...marac, stage }, { personId: safe }, EXCLUSIONS, stage, relationships)).toBeNull();
      }
    }
  });
  it('excludes a MAPPA victim at every stage', () => {
    for (const stage of MAPPA_STAGES) {
      const hit = isExcludedParty({ ...mappa, stage }, { personId: 'per_mappa_victim' });
      expect(hit?.exclusion.id).toBe('mappa.all.victims');
    }
  });
  it('excludes a user with a manual party entry', () => {
    const withUser: MaracProcess = { ...marac, parties: [{ userId: 'usr_assoc', party: 'perpetrator-associates', label: "Perpetrator's cousin (persona)", source: 'manual', since: '2026-08-25', reason: 'Recorded by the coordinator' }] };
    const hit = isExcludedParty(withUser, { userId: 'usr_assoc' });
    expect(hit?.exclusion.id).toBe('marac.all.associates');
    expect(hit?.party.source).toBe('manual');
    expect(isExcludedParty(asp, { userId: 'usr_alleged' })?.exclusion.id).toBe('asp.conference.alleged-perpetrator');
  });
  it('does not exclude a user with no party entry', () => {
    expect(isExcludedParty(marac, { userId: 'usr_coordinator' }, EXCLUSIONS, 'meeting', relationships)).toBeNull();
    expect(isExcludedParty(mappa, { userId: 'usr_police' })).toBeNull();
    expect(isExcludedParty(marac, {})).toBeNull();
  });
  it('applies only the exclusions for the stage and the rules passed in', () => {
    expect(isExcludedParty({ ...asp, stage: 'inquiry' }, { userId: 'usr_alleged' })).toBeNull();
    expect(isExcludedParty(asp, { userId: 'usr_alleged' }, [])).toBeNull();
    expect(isExcludedParty(marac, { personId: 'per_perp' }, EXCLUSIONS.filter((e) => e.process !== 'marac'))).toBeNull();
    const conference = isExcludedParty({ ...asp, stage: 'inquiry' }, { userId: 'usr_alleged' }, EXCLUSIONS, 'case-conference');
    expect(conference?.exclusion.id).toBe('asp.conference.alleged-perpetrator');
  });
  it('ignores a party whose role has no exclusion for this process', () => {
    const odd: MaracProcess = { ...marac, parties: [{ userId: 'usr_boss', party: 'employer', label: 'Employer (persona)', source: 'manual' }] };
    expect(isExcludedParty(odd, { userId: 'usr_boss' })).toBeNull();
  });
});
