/**
 * The classification a share carries, and what the recipient is shown.
 *
 * The invariant that matters here is the one that stops a share quietly downgrading its source. It
 * is asserted over the whole seed in `packages/mock-data`, because a rule that holds for a hand-made
 * pair and not for the dataset is not a rule.
 */
import { describe, expect, it } from 'vitest';
import { DEFAULT_CONFIG } from '../config/default-config';
import { OFFICIAL, officialSensitive } from './classify';
import { effectiveClassification, overrideDecision, overrideDirection } from './fromConfig';
import { classificationOfShare, recipientView, shareIsNoWeakerThanSource } from './sharing';

const routine = { classification: OFFICIAL, accessRestriction: 'none' as const };
const sensitive = { classification: officialSensitive(), accessRestriction: 'none' as const };
const restricted = { classification: officialSensitive(['Distribution list only']), accessRestriction: 'restricted' as const };

describe('what a recipient is shown', () => {
  it('shows routine Official content to everyone, because it needs no marking and no gate', () => {
    for (const role of DEFAULT_CONFIG.officialSensitiveWithheldFrom) {
      expect(recipientView(DEFAULT_CONFIG, routine, role).showContent).toBe(true);
    }
  });

  it('withholds Official-Sensitive content from a role that may not receive it', () => {
    const role = DEFAULT_CONFIG.officialSensitiveWithheldFrom[0]!;
    const view = recipientView(DEFAULT_CONFIG, sensitive, role);
    expect(view.showContent).toBe(false);
    expect(view.withheld).toBe('role-may-not-receive-sensitive');
  });

  it('shows it to a role that may', () => {
    expect(recipientView(DEFAULT_CONFIG, sensitive, 'social-worker-children').showContent).toBe(true);
    expect(recipientView(DEFAULT_CONFIG, restricted, 'mappa-coordinator').showContent).toBe(true);
  });
});

describe('a share is never weaker than its source', () => {
  it('accepts a share that matches its source', () => {
    expect(shareIsNoWeakerThanSource(classificationOfShare(restricted), restricted)).toBe(true);
    expect(shareIsNoWeakerThanSource(sensitive, sensitive)).toBe(true);
  });

  it('accepts a share marked higher than its source, which overstates rather than understates', () => {
    expect(shareIsNoWeakerThanSource(sensitive, routine)).toBe(true);
  });

  it('refuses a share marked lower than its source', () => {
    expect(shareIsNoWeakerThanSource(routine, sensitive)).toBe(false);
  });

  it('refuses a share that drops the access restriction, which is the same downgrade by another route', () => {
    expect(shareIsNoWeakerThanSource(sensitive, restricted)).toBe(false);
  });

  it('copies rather than aliases, so raising the source later does not rewrite the share', () => {
    const source = { classification: officialSensitive(['One']), accessRestriction: 'none' as const };
    const carried = classificationOfShare(source);
    source.classification.handling.push('Two');
    expect(carried.classification.handling).toEqual(['One']);
  });
});

describe('the override guard', () => {
  const record = { classification: officialSensitive(), accessRestriction: 'none' as const };

  it('lets anyone raise', () => {
    const routineRecord = { classification: OFFICIAL, accessRestriction: 'none' as const };
    expect(overrideDecision(DEFAULT_CONFIG, routineRecord, officialSensitive(), 'social-worker-children').ok).toBe(true);
  });

  it('refuses a lower outside the named roles, which is the whole point of deriving the level', () => {
    const decision = overrideDecision(DEFAULT_CONFIG, record, OFFICIAL, 'social-worker-children');
    expect(decision.ok).toBe(false);
    expect(decision.refusal).toBe('not-permitted');
  });

  it('allows a lower in a named role', () => {
    expect(overrideDecision(DEFAULT_CONFIG, record, OFFICIAL, DEFAULT_CONFIG.classificationLowerableBy[0]!).ok).toBe(true);
  });

  it('refuses an override below a linked record, even in a named role', () => {
    // The inheritance rule. A person record linked to a MAPPA case cannot be talked down to Official
    // by anyone, because the link itself is the sensitive fact and that is why presence-only exists.
    const linked = [{ classification: officialSensitive(['MAPPA distribution list only']) }];
    const decision = overrideDecision(DEFAULT_CONFIG, record, OFFICIAL, DEFAULT_CONFIG.classificationLowerableBy[0]!, linked);
    expect(decision.ok).toBe(false);
    expect(decision.refusal).toBe('below-linked');
    expect(decision.floor?.sensitive).toBe(true);
  });

  it('names the direction so the record can say raised or lowered without a reader comparing', () => {
    expect(overrideDirection(officialSensitive(), OFFICIAL)).toBe('lowered');
    expect(overrideDirection(OFFICIAL, officialSensitive())).toBe('raised');
    // An override that changes nothing counts as a raise: it is not a downgrade, and calling it one
    // would put the wrong act in the audit ledger.
    expect(overrideDirection(officialSensitive(), officialSensitive())).toBe('raised');
  });
});

describe('one function decides the marking', () => {
  it('returns the derivation when nothing is overridden', () => {
    const record = { classification: officialSensitive(), accessRestriction: 'none' as const };
    const effective = effectiveClassification(DEFAULT_CONFIG, record);
    expect(effective.override).toBeUndefined();
    expect(effective.classification).toEqual(effective.derived);
  });

  it('returns the override where there is one, and still reports what was derived', () => {
    const record = {
      classification: OFFICIAL,
      accessRestriction: 'none' as const,
      classificationOverride: {
        level: 'official' as const,
        sensitive: true,
        handling: [],
        direction: 'raised' as const,
        reason: 'Names a person on bail conditions',
        byUserId: 'usr_a',
        byName: 'A Practitioner',
        at: '2026-09-03T09:00:00+01:00',
        auditEntryId: 'aud_1',
      },
    };
    const effective = effectiveClassification(DEFAULT_CONFIG, record);
    expect(effective.classification.sensitive).toBe(true);
    expect(effective.derived.sensitive).toBe(false);
    expect(effective.override?.byName).toBe('A Practitioner');
    expect(effective.override?.auditEntryId).toBe('aud_1');
  });
});
