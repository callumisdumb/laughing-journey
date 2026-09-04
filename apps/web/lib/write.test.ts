import { DEFAULT_CONFIG, demoNow, type Person, type Process } from '@mas/domain';
import { KAYLEIGH, buildDataset } from '@mas/mock-data';
import { describe, expect, it } from 'vitest';
import { REASON_REQUIRED, classificationRefusal, excludedRecipients, reasonRefusal, startedClocks, validateRecord, versionFor } from './write';

const data = buildDataset();
const config = DEFAULT_CONFIG;
const now = demoNow();

const marac = data.processes.find((p) => p.id === KAYLEIGH.marac)!;
const kayleigh = data.people.find((p) => p.id === KAYLEIGH.kayleigh)!;
const ryan = data.people.find((p) => p.id === KAYLEIGH.ryan)!;

describe('the write pipeline, step by step', () => {
  describe('1. the schema, which is the source of truth', () => {
    it('passes a record the schema accepts', () => {
      expect(validateRecord('people', kayleigh)).toEqual([]);
    });

    it('refuses a record the schema does not, and says which field', () => {
      const broken = { ...kayleigh, givenName: 42 } as unknown as Person;
      const errors = validateRecord('people', broken);
      expect(errors.length).toBeGreaterThan(0);
      expect(errors.join(' ')).toContain('givenName');
    });

    it('refuses a record missing a required field rather than writing a half one', () => {
      const { id: _id, ...rest } = kayleigh;
      expect(validateRecord('people', rest).length).toBeGreaterThan(0);
    });

    it('says nothing about a collection with no element schema, rather than refusing everything', () => {
      expect(validateRecord('audit', data.audit[0]!)).toEqual([]);
    });
  });

  describe('3. a classification may be raised and never quietly lowered', () => {
    it('allows a write that does not change the classification', () => {
      expect(classificationRefusal(config, marac, marac)).toBeNull();
    });

    it('allows a raise', () => {
      const raised: Process = { ...marac, accessRestriction: 'restricted' };
      expect(classificationRefusal(config, marac, raised)).toBeNull();
    });

    it('refuses a lower, which is what overrideDecision exists for', () => {
      const strong: Process = { ...marac, classification: { level: 'official', sensitive: true, handling: [] }, accessRestriction: 'restricted' };
      const weak: Process = { ...strong, classification: { level: 'official', sensitive: false, handling: [] }, accessRestriction: 'none', classificationOverride: undefined };
      expect(classificationRefusal(config, strong, weak)).toBe('classificationDowngrade');
    });

    it('has nothing to compare against on a create, so it does not refuse one', () => {
      expect(classificationRefusal(config, undefined, marac)).toBeNull();
    });
  });

  describe('5. the exclusion register, checked before a recipient is added', () => {
    it('refuses the perpetrator named on the MARAC referral', () => {
      const check = excludedRecipients(marac, [{ personId: ryan.id }], config, data.relationships);
      expect(check.refused).toHaveLength(1);
    });

    it('lets through somebody the register does not name', () => {
      const check = excludedRecipients(marac, [{ personId: kayleigh.id }], config, data.relationships);
      expect(check.refused).toEqual([]);
    });

    it('warns rather than refuses on a name resembling a hand-recorded register entry', () => {
      // The near-match layer only has something to compare against where the register holds a name
      // somebody typed. "Ryan James Kerr" is not "Ryan Kerr" to an exact match, which is the gap
      // D-084 describes, and the answer is a confirmation quoting the entry rather than a silent
      // fuzzy exclusion of possibly the wrong person.
      const handwritten: Process = { ...marac, parties: [{ name: 'Ryan Kerr', party: 'perpetrator', label: 'Perpetrator (named on the referral form)', since: '2026-08-24', source: 'referral', reason: 'Named in the police MARAC referral' }] };
      const check = excludedRecipients(handwritten, [{ name: 'Ryan James Kerr' }], config, []);
      expect(check.refused).toEqual([]);
      expect(check.nearMatches).toEqual(['Ryan Kerr']);
    });

    it('has nothing to near-match against where the register names a person by record', () => {
      // The seeded MARAC register holds Ryan by `personId`, not by a typed name, so there is no
      // written-down string to compare with and the exact check is the only one that fires. Worth
      // pinning down: it is the difference between the two halves of D-084 and it looks like a gap
      // until you know the register entry has no name in it.
      const check = excludedRecipients(marac, [{ name: 'Ryan James Kerr' }], config, data.relationships);
      expect(check.refused).toEqual([]);
      expect(check.nearMatches).toEqual([]);
      expect(excludedRecipients(marac, [{ personId: ryan.id }], config, data.relationships).refused).toHaveLength(1);
    });
  });

  describe('6. clocks start against the demo instant', () => {
    it('computes a due date for a trigger whose rule exists', () => {
      const effects = startedClocks(config, [{ id: 'clk_test', ruleId: 'asp.inquiry.decision', triggeredAt: now.toISOString() }], now);
      expect(effects).toHaveLength(1);
      expect(effects[0]!.kind).toBe('clock');
      expect(effects[0]!.detail).toMatch(/\d{4}-\d{2}-\d{2}/);
    });

    it('skips a trigger whose rule has been removed from the configuration rather than throwing', () => {
      expect(startedClocks(config, [{ id: 'clk_test', ruleId: 'no.such.rule', triggeredAt: now.toISOString() }], now)).toEqual([]);
    });
  });

  describe('the reason a change after the fact has to carry', () => {
    it('requires one for a correction, a closure and a recorded-in-error', () => {
      for (const intent of REASON_REQUIRED) {
        expect(reasonRefusal(intent, undefined)).toBe('reasonRequired');
        expect(reasonRefusal(intent, '   ')).toBe('reasonRequired');
        expect(reasonRefusal(intent, 'typo')).toBe('reasonRequired');
        expect(reasonRefusal(intent, 'Wrong date of birth, corrected from the referral')).toBeNull();
      }
    });

    it('does not require one for a create or an ordinary update', () => {
      expect(reasonRefusal('create', undefined)).toBeNull();
      expect(reasonRefusal('update', undefined)).toBeNull();
      expect(reasonRefusal('reopen', undefined)).toBeNull();
    });
  });
});

describe('classificationRefusal on records that carry no classification', () => {
  /*
   * A household, a relationship and a person record have no marking: the classification lives on the
   * process and on the records it links to. The check used to assume every collection carried one,
   * read `undefined.handling` on the first household edit, and took the screen down rather than
   * refusing anything. Three dialogs stayed open with no error on them, which is the worst way for a
   * write to fail: it looks like nothing happened.
   */
  const unclassified = { id: 'hh_1', members: [] } as unknown as Parameters<typeof classificationRefusal>[2];

  it('passes an unclassified record either side', () => {
    expect(classificationRefusal(DEFAULT_CONFIG, unclassified, unclassified)).toBeNull();
  });

  it('passes when only one side carries a marking', () => {
    const classified = { classification: { level: 'official', sensitive: true, handling: [] }, accessRestriction: 'none' } as unknown as Parameters<typeof classificationRefusal>[2];
    expect(classificationRefusal(DEFAULT_CONFIG, unclassified, classified)).toBeNull();
    expect(classificationRefusal(DEFAULT_CONFIG, classified, unclassified)).toBeNull();
  });

  it('still refuses a real downgrade between two classified records', () => {
    const high = { classification: { level: 'official', sensitive: true, handling: [] }, accessRestriction: 'restricted' } as unknown as Parameters<typeof classificationRefusal>[2];
    const low = { classification: { level: 'official', sensitive: false, handling: [] }, accessRestriction: 'none' } as unknown as Parameters<typeof classificationRefusal>[2];
    expect(classificationRefusal(DEFAULT_CONFIG, high, low)).toBe('classificationDowngrade');
  });
});

describe('2b. the record\'s own version history', () => {
  const WHO = { at: '2026-09-04T10:00:00+01:00', byUserId: 'usr_janet_kerr', byName: 'Janet Kerr', intent: 'update' as const };

  it('names the fields that moved and keeps what they held', () => {
    const before = { id: 'per_1', givenName: 'Aiden', familyName: 'Boyle', dateOfBirth: '2019-03-14' };
    const after = { ...before, dateOfBirth: '2019-04-14' };
    const entry = versionFor('people', before, after, { ...WHO, reason: 'The referral had the month wrong.' });
    expect(entry?.change).toBe('dateOfBirth');
    expect(entry?.before).toEqual({ dateOfBirth: '2019-03-14' });
    expect(entry?.reason).toBe('The referral had the month wrong.');
    expect(entry?.byName).toBe('Janet Kerr');
  });

  it('prefers the caller\'s phrase, because "Case closed" reads better than a list of fields', () => {
    const before = { id: 'prc_1', status: 'open', closedAt: undefined };
    const after = { id: 'prc_1', status: 'closed', closedAt: '2026-09-04T10:00:00+01:00' };
    expect(versionFor('processes', before, after, { ...WHO, change: 'Case closed: Child died' })?.change).toBe('Case closed: Child died');
  });

  it('names a nested field as changed without printing it', () => {
    const before = { id: 'per_1', contact: { phone: '01555 111111' } };
    const after = { id: 'per_1', contact: { phone: '01555 222222' } };
    const entry = versionFor('people', before, after, WHO);
    expect(entry?.change).toBe('contact');
    // The old value of an object is not a readable "what it was", so it is left to the audit trail.
    expect(entry?.before).toBeUndefined();
  });

  it('writes nothing for a create, for an unchanged record, or for a collection with no history', () => {
    const record = { id: 'per_1', givenName: 'Aiden' };
    expect(versionFor('people', undefined, record, { ...WHO, intent: 'create' })).toBeNull();
    expect(versionFor('people', record, record, WHO)).toBeNull();
    // The audit ledger is append-only. A version entry on an audit entry would be a contradiction.
    expect(versionFor('audit', record, { ...record, givenName: 'Aidy' }, WHO)).toBeNull();
  });

  it('ignores the version list itself, so an entry cannot beget another', () => {
    const before = { id: 'per_1', givenName: 'Aiden', versions: [] };
    const after = { id: 'per_1', givenName: 'Aiden', versions: [{ at: WHO.at, byName: 'Janet Kerr', change: 'something' }] };
    expect(versionFor('people', before, after, WHO)).toBeNull();
  });

  it('always writes one for a correction, because the reason is the point', () => {
    const record = { id: 'per_1', givenName: 'Aiden' };
    expect(versionFor('people', record, record, { ...WHO, intent: 'correct', reason: 'Recorded against the wrong child.' })).not.toBeNull();
  });
});
