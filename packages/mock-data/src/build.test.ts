import { ageAt, classificationOfShare, datasetSchema, eligibilityFor, shareIsNoWeakerThanSource } from '@mas/domain';
import { describe, expect, it } from 'vitest';
import { buildDataset } from './generator/build';
import { AIDEN } from './scenarios/04-aiden-boyle';

describe('buildDataset', () => {
  const data = buildDataset();

  it('validates against the dataset schema', () => {
    const result = datasetSchema.safeParse(data);
    if (!result.success) {
      const issues = result.error.issues.slice(0, 10).map((i) => `${i.path.join('.')}: ${i.message}`).join('\n');
      throw new Error(`dataset invalid:\n${issues}`);
    }
    expect(result.success).toBe(true);
  });

  it('is deterministic for the same seed', () => {
    const again = buildDataset();
    expect(again.people.map((p) => p.id + p.givenName)).toEqual(data.people.map((p) => p.id + p.givenName));
    expect(again.events.length).toBe(data.events.length);
  });

  it('changes with the seed', () => {
    const other = buildDataset({ seed: 'other' });
    expect(other.people.map((p) => p.givenName).join()).not.toEqual(data.people.map((p) => p.givenName).join());
  });

  it('tags every record synthetic and uses safe postcodes', () => {
    for (const p of data.people) expect(p.synthetic).toBe(true);
    for (const a of data.addresses) expect(a.postcode).toMatch(/^[QVX]/);
  });

  it('reaches the volumes the brief asks for', () => {
    expect(data.people.length).toBeGreaterThan(150);
    expect(data.households.length).toBeGreaterThan(50);
    expect(data.events.length).toBeGreaterThan(600);
    expect(data.users.length).toBeGreaterThan(30);
  });

  it('has the Aiden Boyle scenario wired', () => {
    const p = data.processes.find((x) => x.id === AIDEN.process);
    expect(p?.type).toBe('cp');
    expect(p?.stage).toBe('childs-plan');
    const events = data.events.filter((e) => e.subjectIds.includes(AIDEN.aiden));
    expect(events.length).toBeGreaterThan(35);
    expect(data.meetings.filter((m) => m.processId === AIDEN.process).length).toBe(6);
    expect(data.actions.filter((a) => a.processId === AIDEN.process).length).toBe(9);
    expect(data.connectorEvents.filter((c) => c.subjectId === AIDEN.aiden).length).toBe(3);
    const janet = data.users.find((u) => u.id === 'usr_janet_kerr');
    expect(janet?.caseMemberships).toContain(AIDEN.process);
  });

  it('never lets a share carry a weaker classification than the record it came from', () => {
    // The invariant the captured classification exists for. A share that went out marked lower than
    // its source is a quiet downgrade, and by the time anyone notices it has already been read.
    const byId = new Map(data.processes.map((p) => [p.id, p]));
    const weaker = data.sharingRecords.filter((share) => {
      const source = byId.get(share.processId);
      return source !== undefined && !shareIsNoWeakerThanSource(share, source);
    });
    expect(weaker.map((s) => `${s.id} on ${s.processId}`)).toEqual([]);
    expect(data.sharingRecords.length).toBeGreaterThan(0);
  });

  it('carries the access restriction onto every share from a restricted record', () => {
    const restricted = new Set(data.processes.filter((p) => p.accessRestriction === 'restricted').map((p) => p.id));
    for (const share of data.sharingRecords) {
      if (restricted.has(share.processId)) expect(share.accessRestriction).toBe('restricted');
    }
  });

  it('copies the classification onto a share rather than pointing at the source', () => {
    const share = data.sharingRecords[0]!;
    const source = data.processes.find((p) => p.id === share.processId)!;
    expect(share.classification).toEqual(classificationOfShare(source).classification);
    expect(share.classification).not.toBe(source.classification);
  });

  it('holds no ethnicity, anywhere, which three documents and two returns depend on', () => {
    // The ASP national return reports every ethnicity row as not collected, MAPPA Annex 3 Table 8
    // reads Data not held, and the DPIA says the dataset does not carry it. Those statements are only
    // worth anything if something checks them, and the field is exactly the kind that gets added back
    // by somebody who does not know why it was empty. See D-079.
    for (const person of data.people) {
      expect(Object.keys(person)).not.toContain('ethnicity');
    }
    const dump = JSON.stringify(data.people);
    expect(dump).not.toContain('ethnicity');
  });

  it('keeps ages and schools consistent', () => {
    for (const p of data.people) {
      if (p.lifeStage === 'child' && p.dateOfBirth) {
        const age = new Date(data.meta.now).getFullYear() - Number(p.dateOfBirth.slice(0, 4));
        expect(age).toBeLessThanOrEqual(18);
        if (age < 4) expect(p.school).toBeUndefined();
      }
    }
  });
});

describe('the eligibility cases the demonstration has to be able to show', () => {
  const data = buildDataset();
  const now = new Date(data.meta.now);

  it('holds at least one 16 or 17 year old, who is eligible for adult and child protection at once', () => {
    const young = data.people.filter((p) => p.dateOfBirth && [16, 17].includes(ageAt(p.dateOfBirth, now)));
    expect(young.length).toBeGreaterThan(0);
    for (const person of young.slice(0, 3)) {
      expect(eligibilityFor('asp', person, now).eligible).toBe(true);
      expect(eligibilityFor('cp', person, now).eligible).toBe(true);
    }
  });

  it('holds an unborn baby, who is within child protection and not within adult protection', () => {
    const unborn = data.people.find((p) => p.lifeStage === 'unborn');
    expect(unborn).toBeDefined();
    expect(eligibilityFor('cp', unborn!, now).eligible).toBe(true);
    expect(eligibilityFor('asp', unborn!, now).eligible).toBe(false);
  });
});
