import { DEFAULT_CONFIG, demoNow, withMustNotReceive, type Person, type Process } from '@mas/domain';
import { readFileSync, readdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { KAYLEIGH, buildDataset } from '@mas/mock-data';
import { describe, expect, it } from 'vitest';
import { REASON_REQUIRED, applyClockTransition, classificationRefusal, excludedRecipients, lawfulBasisFor, reasonRefusal, registerChanges, reverseNearMatches, sharingRecordFor, startedClocks, validateRecord, versionFor, validateTriggers } from './write';

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

    it('refuses a clock trigger that is not an instant, on the write that carries it', () => {
      expect(validateTriggers([{ id: 'clk_1', ruleId: 'awi.interim.warning', triggeredAt: '2026-09-25T00:00:00.000Z' }])).toEqual([]);
      const errors = validateTriggers([{ id: 'clk_1', ruleId: 'awi.interim.warning', triggeredAt: '2026-09-25' }]);
      expect(errors.length).toBeGreaterThan(0);
      expect(errors.join(' ')).toContain('clocks.0.triggeredAt');
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

describe('8. the lawful basis and the shares, built by the pipeline', () => {
  const author = data.users.find((u) => u.agency === 'social-work')!;
  const officer = data.users.find((u) => u.agency === 'police')!;
  const cp = data.processes.find((p) => p.type === 'cp')!;

  it('derives the gateway, the classification and article 10 from the processes it covers', () => {
    const basis = lawfulBasisFor({ id: 'lb_test', purpose: 'Distribution of the minute', necessity: 'Each recipient is on the list', processes: [cp] }, author, now.toISOString());
    expect(basis.id).toBe('lb_test');
    expect(basis.statutoryGateway).toEqual(['National Guidance for Child Protection in Scotland 2021']);
    expect(basis.article10Criminal).toBe('not applicable');
    expect(basis.authorisedByUserId).toBe(author.id);
    expect(basis.classification).toEqual(cp.classification);
  });

  it('engages article 10 for police information and for a MARAC or MAPPA case, whoever recorded it', () => {
    const police = lawfulBasisFor({ id: 'lb_a', purpose: 'p', necessity: 'n', processes: [cp] }, officer, now.toISOString());
    expect(police.article10Criminal).toBe('DPA 2018 s10 and Sch 1');
    const domestic = lawfulBasisFor({ id: 'lb_b', purpose: 'p', necessity: 'n', processes: [marac] }, author, now.toISOString());
    expect(domestic.article10Criminal).toBe('DPA 2018 s10 and Sch 1');
  });

  it('falls back to the event-entry gateway where no case is named', () => {
    const basis = lawfulBasisFor({ id: 'lb_c', purpose: 'p', necessity: 'n', processes: [] }, author, now.toISOString());
    expect(basis.statutoryGateway).toEqual(['Recorded at event entry']);
  });

  it('captures the classification the case has at the moment of the share, as a copy', () => {
    const share = sharingRecordFor({ recipient: { name: 'Somebody', agency: 'health', role: 'Nurse' }, detailLevel: 'summary', reason: 'On the list', summary: 'Minute' }, marac, 'lb_test', author, now.toISOString(), 'shr_test');
    expect(share.lawfulBasisId).toBe('lb_test');
    expect(share.processId).toBe(marac.id);
    expect(share.stage).toBe(marac.stage);
    expect(share.status).toBe('sent');
    expect(share.sentAt).toBe(now.toISOString());
    expect(share.classification).toEqual(marac.classification);
    expect(share.classification.handling).not.toBe(marac.classification.handling);
    expect(share.createdByName).toBe(`${author.givenName} ${author.familyName}`);
  });

  it('queues a share that is not sent at once, with no sent time', () => {
    const share = sharingRecordFor({ recipient: { name: 'Somebody', agency: 'health', role: 'Nurse' }, detailLevel: 'full', reason: 'r', summary: 's', status: 'queued' }, marac, 'lb', author, now.toISOString(), 'shr');
    expect(share.status).toBe('queued');
    expect(share.sentAt).toBeUndefined();
  });
});

describe('6. a write can complete clocks as well as start them', () => {
  let counter = 0;
  const newId = (prefix: string) => `${prefix}_${(counter += 1)}`;

  it('completes and starts the rules a transition names, at the instant it names', () => {
    const clocks = [{ id: 'clk_1', ruleId: 'cp.cppm.initial', triggeredAt: '2026-08-01T09:00:00Z' }];
    const result = applyClockTransition(clocks, { completes: ['cp.cppm.initial'], starts: ['cp.coregroup.first', 'cp.cppm.review.first', 'cp.cppm.record.distribute'], at: '2026-08-20T10:00:00Z', note: 'CPPM held' }, now.toISOString(), newId);
    expect(result.completed).toEqual(['cp.cppm.initial']);
    expect(result.started).toEqual(['cp.coregroup.first', 'cp.cppm.review.first', 'cp.cppm.record.distribute']);
    expect(result.clocks.find((c) => c.id === 'clk_1')?.completedAt).toBe('2026-08-20T10:00:00Z');
    expect(result.clocks.filter((c) => !c.completedAt)).toHaveLength(3);
  });

  it('completes the rules named directly, with the caller\'s note, and leaves the rest alone', () => {
    const clocks = [
      { id: 'clk_1', ruleId: 'cp.cppm.record.distribute', triggeredAt: '2026-08-20T10:00:00Z' },
      { id: 'clk_2', ruleId: 'cp.coregroup.first', triggeredAt: '2026-08-20T10:00:00Z' },
    ];
    const result = applyClockTransition(clocks, { completes: ['cp.cppm.record.distribute'], note: 'the distribution' }, '2026-08-25T10:00:00Z', newId);
    expect(result.completed).toEqual(['cp.cppm.record.distribute']);
    expect(result.started).toEqual([]);
    expect(result.clocks[0]?.completedAt).toBe('2026-08-25T10:00:00Z');
    expect(result.clocks[0]?.note).toContain('the distribution');
    expect(result.clocks[1]?.completedAt).toBeUndefined();
  });

  it('does not start a clock that is already running', () => {
    const clocks = [{ id: 'clk_1', ruleId: 'cp.coregroup.first', triggeredAt: '2026-08-01T09:00:00Z' }];
    const result = applyClockTransition(clocks, { starts: ['cp.coregroup.first'] }, now.toISOString(), newId);
    expect(result.started).toEqual([]);
    expect(result.clocks).toHaveLength(1);
  });
});

describe('5, in reverse: a register entry added by a write', () => {
  it('counts the hand-recorded entries a write adds or changes, and nothing derived', () => {
    const before = marac.parties;
    const after = withMustNotReceive(before, [{ name: 'Tommy Boyle', party: 'perpetrator-associates', reason: 'Named on the DAQ' }], '2026-09-01', 'the DAQ').parties;
    const changes = registerChanges(before, after);
    expect(changes.added).toBe(1);
    expect(changes.updated).toBe(0);
    expect(changes.entries.map((e) => e.name)).toEqual(['Tommy Boyle']);
    expect(registerChanges(after, after)).toEqual({ added: 0, updated: 0, entries: [] });
  });

  it('finds the names already on a list that an entry resembles, and passes over the rest', () => {
    const entries = withMustNotReceive([], [{ name: 'Alison Reid', party: 'perpetrator-associates', reason: 'r' }], '2026-09-01', 'the DAQ').parties;
    expect(reverseNearMatches(entries, ['Alison Reid', 'Someone Else'])).toEqual([{ entry: entries[0], names: ['Alison Reid'] }]);
    expect(reverseNearMatches(entries, ['Nobody Similar'])).toEqual([]);
  });
});

describe('the direct path is gone', () => {
  it('has no screen writing to the store except through the pipeline', () => {
    // The raw upsert was public, and eighteen screens called it while the handover said every write
    // went through the pipeline. It is private to store.ts now, and this is what stops a nineteenth:
    // TypeScript would refuse the call, and this refuses the source before TypeScript is asked.
    const root = resolve(import.meta.dirname, '../../..');
    const files: string[] = [];
    const walk = (dir: string) => {
      for (const entry of readdirSync(dir, { withFileTypes: true })) {
        const full = resolve(dir, entry.name);
        if (entry.isDirectory()) {
          if (entry.name === 'node_modules' || entry.name === '.next' || entry.name === 'out' || entry.name === '.git') continue;
          walk(full);
        } else if (/\.(ts|tsx)$/.test(entry.name)) {
          files.push(full);
        }
      }
    };
    walk(resolve(root, 'apps/web'));
    const offenders = files.filter((file) => {
      if (file.endsWith('/lib/store.ts') || file.endsWith('.test.ts')) return false;
      const code = readFileSync(file, 'utf8').replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');
      return /\b(?:s|getState\(\))\.(?:upsert|remove)\b/.test(code) || /\buseAppStore\.getState\(\)\.(?:upsert|remove)\b/.test(code);
    });
    expect(offenders).toEqual([]);
  });
});
