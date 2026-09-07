/**
 * The four ways a name gets written differently, all taken from the review that asked for this.
 *
 * The point of the test is the failure direction. Exact matching on the register fails silently and
 * fails towards inclusion, so each of these cases has to produce a warning; and unrelated names have
 * to produce none, or the warning becomes something people click through.
 */
import { describe, expect, it } from 'vitest';
import { EXCLUSIONS } from './exclusions';
import { nameSimilarity, nearMatchesOnList, nearMatchesOnRegister, normaliseForComparison, SIMILARITY_THRESHOLD } from './similarity';
import { processSchema, type Process } from '../schemas/process';

const REGISTERED = 'Ryan Kerr';

describe('names the exact match misses', () => {
  it.each([
    ['a middle name', 'Ryan James Kerr', 'extra-names'],
    ['an initial', 'R Kerr', 'initials'],
    ['surname first', 'Kerr, Ryan', 'same-after-normalising'],
    ['a non-breaking space', 'ryan kerr ', 'same-after-normalising'],
    ['a transposed letter', 'Ryan Kerrr', 'spelling'],
  ])('warns on %s', (_label, typed, kind) => {
    const similarity = nameSimilarity(typed, REGISTERED);
    expect(similarity).not.toBeNull();
    expect(similarity!.kind).toBe(kind);
    expect(similarity!.score).toBeGreaterThanOrEqual(SIMILARITY_THRESHOLD);
  });

  it('leaves unrelated names alone, so the warning stays worth reading', () => {
    for (const other of ['Janet Kerr', 'Ryan Docherty', 'Moira Gilmour', 'Priya Sharif', 'Derek Muir']) {
      expect(nameSimilarity(other, REGISTERED)).toBeNull();
    }
  });

  it('normalises order, case, accents and unicode spaces without deciding anything', () => {
    expect(normaliseForComparison('  Kerr,  Ryan ')).toBe('ryan kerr');
    expect(normaliseForComparison('Ryan Kerr')).toBe('ryan kerr');
    expect(normaliseForComparison("O'Neill, Seán")).toBe('sean o neill');
  });

  it('does not treat a shared surname alone as a match', () => {
    // "Kerr" against "Ryan Kerr" is a single token and could be anybody in the family.
    expect(nameSimilarity('Kerr', REGISTERED)).toBeNull();
  });
});

/**
 * A MARAC process with one hand-recorded name entry, which is the shape the register really takes.
 * Parsed through the schema rather than cast, so a fixture that has drifted fails here rather than
 * quietly testing something the product cannot hold.
 */
function processWithRegisterEntry(name: string): Process {
  return processSchema.parse({
    id: 'prc_test',
    synthetic: true,
    type: 'marac',
    reference: 'MARAC-2026-0001',
    title: 'Test',
    subjectIds: ['per_a'],
    leadAgency: 'police',
    stage: 'research',
    stageHistory: [],
    status: 'open',
    classification: { level: 'official', sensitive: true, handling: [] },
    accessRestriction: 'none',
    openedAt: '2026-01-01T09:00:00+00:00',
    members: [],
    clocks: [],
    linkedProcessIds: [],
    viewsRecordIds: [],
    riskAssessmentIds: [],
    flags: {},
    parties: [{ name, party: 'perpetrator-associates', label: "Perpetrator's brother", since: '2026-01-01', source: 'manual', reason: 'Named on the DAQ as someone who must not receive information' }],
    detail: {
      referral: {
        receivedAt: '2026-01-01T09:00:00+00:00',
        referringAgency: 'police',
        referrerName: 'Test',
        riskAssessmentId: 'ra_1',
        professionalJudgementReferral: false,
        victimPersonId: 'per_a',
        perpetratorPersonId: 'per_b',
        childPersonIds: [],
        repeat: false,
        summary: 'Test',
      },
      researchRequests: [],
      idaa: { name: 'Test IDAA', organisation: 'Clydeshore Women\'s Aid' },
      idaaFeedback: [],
      flags: [],
      links: { matacConsidered: false, dsdasConsidered: false },
      safeLivesReturn: { referralSource: 'police', repeat: false, childrenCount: 0, outcomeCodes: [] },
    },
  });
}

describe('warning on the register', () => {
  it('finds the entry a typed name resembles, and names it so the confirmation can quote it', () => {
    const process = processWithRegisterEntry(REGISTERED);
    const matches = nearMatchesOnRegister(process, 'Ryan James Kerr', { exclusions: EXCLUSIONS });
    expect(matches).toHaveLength(1);
    expect(matches[0]!.entryName).toBe(REGISTERED);
    expect(matches[0]!.exclusion.party).toBe('perpetrator-associates');
    expect(matches[0]!.similarity.kind).toBe('extra-names');
  });

  it('says nothing about a name that resembles nobody on the register', () => {
    const process = processWithRegisterEntry(REGISTERED);
    expect(nearMatchesOnRegister(process, 'Claire Cowan', { exclusions: EXCLUSIONS })).toEqual([]);
  });

  it('checks the other way too, because an exclusion often arrives after the sharing started', () => {
    const onTheList = ['Claire Cowan', 'R Kerr', 'Janet Kerr'];
    const matches = nearMatchesOnList(REGISTERED, onTheList);
    expect(matches.map((m) => m.name)).toEqual(['R Kerr']);
  });
});
