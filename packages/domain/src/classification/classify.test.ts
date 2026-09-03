import { describe, expect, it } from 'vitest';
import {
  CLASSIFICATION_LEVELS,
  OFFICIAL,
  applyOverride,
  canLower,
  classify,
  isMarked,
  marking,
  markingFilePrefix,
  officialSensitive,
  type ClassificationSubject,
} from './classify';

/** The artefacts the Annex 2 rule table says are Official-Sensitive, and why. */
const SENSITIVE: Array<[string, ClassificationSubject]> = [
  ['MAPPA meeting minute', { process: 'mappa', artefact: 'meeting-minute' }],
  ['MAPPA Risk Management Plan', { process: 'mappa', artefact: 'risk-management-plan' }],
  ['MAPPA Environmental Risk Assessment', { process: 'mappa', artefact: 'environmental-risk-assessment' }],
  ['MAPPA disclosure decision', { process: 'mappa', artefact: 'disclosure-decision' }],
  ['MAPPA pre-meeting return', { process: 'mappa', artefact: 'pre-meeting-return' }],
  ['any MAPPA record', { process: 'mappa' }],
  ['MARAC referral', { process: 'marac', artefact: 'referral' }],
  ['MARAC research return', { process: 'marac', artefact: 'research-return' }],
  ['MARAC meeting record', { process: 'marac', artefact: 'meeting-minute' }],
  ['MARAC action plan', { process: 'marac', artefact: 'action-plan' }],
  ['record naming a perpetrator', { namesPerpetrator: true }],
  ['CP IRD record', { process: 'cp', artefact: 'ird-record' }],
  ['CP JII planning record', { process: 'cp', artefact: 'jii-planning-record' }],
  ['CPPM minute', { process: 'cp', artefact: 'cppm-minute' }],
  ['special category data', { specialCategoryData: true }],
  ['criminal offence data', { criminalOffenceData: true }],
  ['ASP protection order application', { process: 'asp', artefact: 'protection-order-application' }],
  ['LSI workspace', { process: 'asp', artefact: 'lsi-workspace' }],
  ['break-glass audit entry', { artefact: 'break-glass-audit' }],
  ['audit export', { artefact: 'audit-export' }],
  ['connector credentials', { artefact: 'connector-credentials' }],
];

/** The artefacts the table says are Official, and therefore carry no marking. */
const OFFICIAL_SUBJECTS: Array<[string, ClassificationSubject]> = [
  ['person record with no open restricted process', { artefact: 'person-record' }],
  ['worklist', { artefact: 'worklist' }],
  ['aggregate report', { artefact: 'aggregate-report' }],
  ['empty state', { artefact: 'empty-state' }],
  ['Admin configuration', { artefact: 'admin-configuration' }],
  ['glossary', { artefact: 'glossary' }],
  ['a CP record that is not an IRD, JII or CPPM artefact', { process: 'cp', artefact: 'person-record' }],
  ['an ASP record that is neither an order application nor an LSI', { process: 'asp', artefact: 'person-record' }],
];

describe('classify', () => {
  it.each(SENSITIVE)('marks %s Official-Sensitive', (_name, subject) => {
    const { classification, reasons } = classify(subject);
    expect(classification.sensitive).toBe(true);
    expect(classification.level).toBe('official');
    expect(reasons).not.toContain('routine-official');
    expect(reasons.length).toBeGreaterThan(0);
    expect(isMarked(classification)).toBe(true);
    expect(marking(classification)).toBe('OFFICIAL-SENSITIVE');
  });

  it.each(OFFICIAL_SUBJECTS)('leaves %s Official and unmarked', (_name, subject) => {
    const { classification, reasons } = classify(subject);
    expect(classification).toEqual(OFFICIAL);
    expect(reasons).toEqual(['routine-official']);
    // Annex 2 paragraph 5: there is no requirement to explicitly mark routine Official information.
    expect(isMarked(classification)).toBe(false);
    expect(marking(classification)).toBeUndefined();
    expect(markingFilePrefix(classification)).toBe('');
  });

  it('cites the rule each decision rests on', () => {
    expect(classify({ process: 'mappa', artefact: 'meeting-minute' }).reasons).toContain('mappa-record');
    expect(classify({ process: 'marac', artefact: 'referral' }).reasons).toContain('marac-record');
    expect(classify({ namesPerpetrator: true }).reasons).toContain('names-perpetrator');
    expect(classify({ process: 'cp', artefact: 'cppm-minute' }).reasons).toContain('cp-record');
    expect(classify({ specialCategoryData: true }).reasons).toContain('special-category-data');
    expect(classify({ criminalOffenceData: true }).reasons).toContain('criminal-offence-data');
    expect(classify({ process: 'asp', artefact: 'lsi-workspace' }).reasons).toContain('asp-order-or-lsi');
    expect(classify({ artefact: 'audit-export' }).reasons).toContain('security-information');
  });

  it('never derives lower than a linked record, which is why presence-only exists', () => {
    const person = classify({ artefact: 'person-record' });
    expect(person.classification.sensitive).toBe(false);
    const linkedToMappa = classify({ artefact: 'person-record', linked: [officialSensitive(['MAPPA distribution list only'])] });
    expect(linkedToMappa.classification.sensitive).toBe(true);
    expect(linkedToMappa.reasons).toContain('linked-record');
    // A view that would reveal the link inherits the handling instruction too.
    expect(marking(linkedToMappa.classification)).toBe('OFFICIAL-SENSITIVE MAPPA distribution list only');
    const openRestricted = classify({ artefact: 'person-record', hasOpenRestrictedProcess: true });
    expect(openRestricted.classification.sensitive).toBe(true);
    expect(openRestricted.reasons).toContain('open-restricted-process');
  });

  it('names the three real levels of the scheme and no invented fourth', () => {
    // RESTRICTED was abolished on 2 April 2014 with the rest of the Government Protective Marking
    // Scheme. Official absorbed everything up to and including it. It is not a level here.
    expect(CLASSIFICATION_LEVELS).toEqual(['official', 'secret', 'top-secret']);
    expect(CLASSIFICATION_LEVELS).not.toContain('restricted');
    expect(CLASSIFICATION_LEVELS).not.toContain('official-sensitive');
  });

  it('never derives Secret or Top Secret, whatever it is asked', () => {
    // The levels are in the type so a reviewer can see the scheme is the real one. Nothing in public
    // protection casework reaches defence, diplomacy or national security, so nothing produces them.
    const subjects: ClassificationSubject[] = [
      {},
      { process: 'mappa' },
      { process: 'marac', artefact: 'referral' },
      { process: 'cp', artefact: 'cppm-minute' },
      { process: 'asp', artefact: 'lsi-workspace' },
      { artefact: 'connector-credentials' },
      { namesPerpetrator: true, specialCategoryData: true, criminalOffenceData: true },
      { artefact: 'person-record', hasOpenRestrictedProcess: true },
      { artefact: 'person-record', linked: [officialSensitive(['Anything'])] },
    ];
    for (const subject of subjects) {
      expect(classify(subject).classification.level).toBe('official');
    }
  });

  it('renders no marking at all for unmarked Official, which is the whole of Annex 2 paragraph 5', () => {
    expect(marking(classify({ artefact: 'aggregate-report' }).classification)).toBeUndefined();
    expect(marking(OFFICIAL)).toBeUndefined();
    expect(isMarked(OFFICIAL)).toBe(false);
    expect(markingFilePrefix(OFFICIAL)).toBe('');
  });

  it('appends handling instructions after the marking, de-duplicated', () => {
    expect(marking(officialSensitive([]))).toBe('OFFICIAL-SENSITIVE');
    expect(marking(officialSensitive(['Distribution list only']))).toBe('OFFICIAL-SENSITIVE Distribution list only');
    const twice = classify({ artefact: 'person-record', linked: [officialSensitive(['Chair approval required']), officialSensitive(['Chair approval required'])] });
    expect(twice.classification.handling).toEqual(['Chair approval required']);
  });

  it('prefixes a download name with the marking', () => {
    expect(markingFilePrefix(officialSensitive())).toBe('OFFICIAL-SENSITIVE-');
    expect(markingFilePrefix(OFFICIAL)).toBe('');
  });
});

describe('overrides', () => {
  const raise = { level: 'official' as const, sensitive: true, handling: [], reason: 'Names a person on bail conditions', byUserId: 'usr_a', at: '2026-09-03T09:00:00+01:00' };
  const lower = { level: 'official' as const, sensitive: false, handling: [], reason: 'Aggregate counts only, no case detail', byUserId: 'usr_b', at: '2026-09-03T09:00:00+01:00' };

  it('lets anyone raise', () => {
    expect(applyOverride(OFFICIAL, raise).classification.sensitive).toBe(true);
  });

  it('refuses a lower without a named role, rather than lowering quietly', () => {
    const result = applyOverride(officialSensitive(), lower, { roleId: 'social-worker-adults', lowerableBy: ['caldicott-guardian', 'mappa-coordinator'] });
    expect(result.classification.sensitive).toBe(true);
    expect(result.refused).toBe('not-permitted');
  });

  it('allows a lower in a named role', () => {
    const result = applyOverride(officialSensitive(), lower, { roleId: 'mappa-coordinator', lowerableBy: ['caldicott-guardian', 'mappa-coordinator'] });
    expect(result.classification).toEqual(OFFICIAL);
    expect(result.refused).toBeUndefined();
  });

  it('reads the permitted roles from configuration', () => {
    expect(canLower('caldicott-guardian', ['caldicott-guardian'])).toBe(true);
    expect(canLower('social-worker-adults', ['caldicott-guardian'])).toBe(false);
    expect(canLower('caldicott-guardian', [])).toBe(false);
  });

  it('leaves the derived level alone when the override matches it', () => {
    expect(applyOverride(officialSensitive(['Keep']), raise).classification.sensitive).toBe(true);
    expect(applyOverride(OFFICIAL, lower).classification).toEqual(OFFICIAL);
  });
});
