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
