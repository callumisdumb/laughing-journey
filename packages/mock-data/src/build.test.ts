import { datasetSchema } from '@mas/domain';
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
