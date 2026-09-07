/**
 * The bridge from a stored record classification and the area's configuration to the classification
 * a screen or a print pack should show. Kept apart from classify.ts so the derivation rules do not
 * depend on the config shape, and so a caller with a Config in hand has one function to reach for.
 */
import type { AccessRestriction } from '../enums';
import type { Config } from '../schemas/config';
import {
  OFFICIAL,
  applyOverride,
  classificationRank,
  handlingInstructionLabel,
  markingProfileFor,
  officialSensitive,
  type Classification,
  type ClassificationLevel,
  type HandlingInstruction,
} from './classify';

/**
 * A recorded override, as the process schema stores it.
 *
 * The audit entry is the record of the act; this field is the current state. Both, not one: an audit
 * ledger can say a classification was raised on Tuesday, and only a field on the record can answer
 * "what is it now" without replaying the ledger. `auditEntryId` joins them, so a reader looking at a
 * raised marking can reach the entry that recorded it.
 */
export interface StoredClassificationOverride {
  level: ClassificationLevel;
  sensitive: boolean;
  handling: HandlingInstruction[];
  /** Which way it went, so the record can say "raised by" rather than making a reader compare. */
  direction: 'raised' | 'lowered';
  reason: string;
  byUserId: string;
  byName: string;
  at: string;
  /** The audit entry that recorded the act. */
  auditEntryId: string;
}

/** What a classifiable record carries. Any entity with these two fields can be asked for its marking. */
export interface ClassifiedRecord {
  classification: Classification;
  accessRestriction: AccessRestriction;
  classificationOverride?: StoredClassificationOverride;
}

/** The handling instructions the area has configured for a record's marking profile. */
function configuredHandling(config: Config, record: { classification: Classification; accessRestriction: AccessRestriction }): HandlingInstruction[] {
  const profile = markingProfileFor(record.classification, record.accessRestriction === 'restricted');
  const row = config.classificationMarkings.find((m) => m.id === profile);
  return (row?.instructions ?? []).map(handlingInstructionLabel);
}

/** The derived classification of a record: what it carries plus the area's handling instructions. */
function derivedClassification(config: Config, record: ClassifiedRecord): Classification {
  const handling = [...new Set([...record.classification.handling, ...configuredHandling(config, record)])];
  return { ...record.classification, handling };
}

/** What a screen shows, and whether a person put it there. */
export interface EffectiveClassification {
  /** The classification to show. Every screen reads this and none computes its own. */
  classification: Classification;
  /** What the record itself gives, before any override. */
  derived: Classification;
  /** Present where a person raised or lowered it, so the record can say who and why. */
  override?: StoredClassificationOverride;
}

/**
 * The one function that decides what classification a record has.
 *
 * The effective classification is the override where there is one and the derived level otherwise.
 * Every screen, print pack and export reads this, so no two can disagree about the same record, which
 * is the failure a derived-plus-override model invites: one screen showing the marking a person set
 * and another showing the one the rules give.
 */
export function effectiveClassification(config: Config, record: ClassifiedRecord): EffectiveClassification {
  const derived = derivedClassification(config, record);
  const override = record.classificationOverride;
  if (!override) return { classification: derived, derived };
  // The permission check happened when the override was recorded, so a stored one is applied as it
  // stands. Passing every configured role satisfies applyOverride's guard without weakening it: a
  // lower that never got past the dialog is never on the record to begin with.
  const applied = applyOverride(derived, override, { roleId: config.classificationLowerableBy[0], lowerableBy: config.classificationLowerableBy });
  return { classification: applied.classification, derived, override };
}

/** The classification to show for a record. The common case; `effectiveClassification` has the rest. */
export function classificationFor(config: Config, record: ClassifiedRecord): Classification {
  return effectiveClassification(config, record).classification;
}

/** Why an override was refused. Both are refusals, not warnings: neither is applied. */
export type OverrideRefusal = 'not-permitted' | 'below-linked';

export interface OverrideDecision {
  ok: boolean;
  refusal?: OverrideRefusal;
  /** The linked record that sets the floor, when that is what refused it. */
  floor?: Classification;
}

/**
 * Whether a proposed override may be recorded.
 *
 * Two rules, both enforced here rather than in the dialog, because the dialog is not what runs when
 * somebody scripts a change:
 *
 * 1. A lower needs one of the configured roles. Raising is always allowed and always carries a reason.
 * 2. An override may never be weaker than the strongest classification of any record it links to.
 *    That is the inheritance rule that stops a person record being lowered while it is linked to a
 *    MAPPA case, and it is the reason the presence-only state exists at all.
 */
export function overrideDecision(
  config: Config,
  record: ClassifiedRecord,
  proposed: Classification,
  roleId: string,
  linked: readonly { classification: Classification }[] = [],
): OverrideDecision {
  const derived = derivedClassification(config, record);
  const floor = linked.reduce<Classification>((highest, l) => (classificationRank(l.classification) > classificationRank(highest) ? l.classification : highest), OFFICIAL);
  if (classificationRank(proposed) < classificationRank(floor)) return { ok: false, refusal: 'below-linked', floor };
  const lowering = classificationRank(proposed) < classificationRank(derived);
  if (lowering && !config.classificationLowerableBy.includes(roleId as never)) return { ok: false, refusal: 'not-permitted' };
  return { ok: true };
}

/** Which way an override goes, for the record and the audit act. */
export function overrideDirection(derived: Classification, proposed: Classification): 'raised' | 'lowered' {
  return classificationRank(proposed) < classificationRank(derived) ? 'lowered' : 'raised';
}

/** The plain-language handling instruction shown on a print pack cover and in the sharing preview. */
export function handlingNote(config: Config, record: { classification: Classification; accessRestriction: AccessRestriction }): string {
  const profile = markingProfileFor(record.classification, record.accessRestriction === 'restricted');
  return config.classificationMarkings.find((m) => m.id === profile)?.handling ?? '';
}

/**
 * The most sensitive classification among a set of records. A lawful basis or a pack that covers
 * several processes takes the highest, because a marking that understates one of them is worse than
 * a marking that overstates the rest. An empty set is treated as Official-Sensitive for the same
 * reason: nothing to compare is not a reason to mark nothing.
 */
export function mostSensitiveClassification(records: readonly { classification: Classification }[]): Classification {
  if (records.length === 0) return officialSensitive();
  let highest: Classification = OFFICIAL;
  for (const record of records) {
    if (classificationRank(record.classification) > classificationRank(highest)) highest = record.classification;
  }
  return { ...highest, handling: [...highest.handling] };
}

/** The strictest access restriction among a set of records. */
export function mostRestrictedAccess(records: readonly { accessRestriction: AccessRestriction }[]): AccessRestriction {
  return records.some((r) => r.accessRestriction === 'restricted') ? 'restricted' : 'none';
}
