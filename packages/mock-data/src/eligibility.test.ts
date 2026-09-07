import { MARAC_REPEAT_MONTHS, canOpenProcess, eligibilityFor, maracRepeatCheck, openProcessesOfType, processSubjectIds } from '@mas/domain';
import { describe, expect, it } from 'vitest';
import { buildDataset } from './generator/build';
import { AIDEN } from './scenarios/04-aiden-boyle';
import { KAYLEIGH } from './scenarios/02-kayleigh-docherty';
import { MARION } from './scenarios/01-marion-fraser';

const NOW = new Date('2026-09-04T10:00:00+01:00');

describe('the duplicate process check against the seed', () => {
  const data = buildDataset();

  it('finds the open child protection process Aiden is already on', () => {
    const open = openProcessesOfType(data, AIDEN.aiden, 'cp');
    expect(open).toHaveLength(1);
    expect(open[0]!.status).toBe('open');
  });

  it('finds none of a type the person is not on', () => {
    expect(openProcessesOfType(data, AIDEN.aiden, 'mappa')).toEqual([]);
  });

  it('finds a MARAC by the referral rather than only by subjectIds, which is where the victim lives', () => {
    const open = openProcessesOfType(data, KAYLEIGH.kayleigh, 'marac');
    expect(open.length).toBeGreaterThan(0);
    expect(processSubjectIds(open[0]!)).toContain(KAYLEIGH.kayleigh);
  });

  it('names the perpetrator and the children among the MARAC subjects', () => {
    const marac = data.processes.find((p) => p.type === 'marac')!;
    const ids = processSubjectIds(marac);
    expect(ids).toContain(KAYLEIGH.ryan);
    expect(ids).toContain(KAYLEIGH.lily);
  });
});

describe('the MARAC repeat check', () => {
  const data = buildDataset();

  it('counts a referral within twelve months as a repeat, and names the one that made it so', () => {
    const check = maracRepeatCheck(data, KAYLEIGH.kayleigh, NOW);
    expect(check.repeat).toBe(true);
    expect(check.previous?.type).toBe('marac');
    expect(check.previousAt).toBeDefined();
  });

  it('does not count one for somebody with no MARAC history', () => {
    expect(maracRepeatCheck(data, MARION.marion, NOW).repeat).toBe(false);
  });

  it('stops counting once the window has passed', () => {
    const later = new Date(NOW.getTime());
    later.setMonth(later.getMonth() + MARAC_REPEAT_MONTHS + 1);
    expect(maracRepeatCheck(data, KAYLEIGH.kayleigh, later).repeat).toBe(false);
  });
});

describe('the two gates against the seeded personas', () => {
  const data = buildDataset();
  const user = (id: string) => data.users.find((u) => u.id === id)!;
  const person = (id: string) => data.people.find((p) => p.id === id)!;

  it('lets Janet Kerr open a child protection concern for Aiden', () => {
    expect(eligibilityFor('cp', person(AIDEN.aiden), NOW).eligible).toBe(true);
    expect(canOpenProcess(user('usr_janet_kerr').roleId, 'cp')).toEqual({ allowed: true });
  });

  it('refuses her a MAPPA case, on permission rather than on eligibility', () => {
    expect(eligibilityFor('mappa', person(AIDEN.aiden), NOW).eligible).toBe(true);
    expect(canOpenProcess(user('usr_janet_kerr').roleId, 'mappa').allowed).toBe(false);
  });

  it('lets Moira Gilmour open an ASP inquiry for Marion but not for a child', () => {
    expect(canOpenProcess(user('usr_moira_gilmour').roleId, 'asp')).toEqual({ allowed: true });
    expect(eligibilityFor('asp', person(MARION.marion), NOW).eligible).toBe(true);
    expect(eligibilityFor('asp', person(AIDEN.aiden), NOW).eligible).toBe(false);
  });
});
