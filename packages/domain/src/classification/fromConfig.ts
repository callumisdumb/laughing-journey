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

/** A recorded override, as the process schema stores it. Applied as stored: see the schema comment. */
export interface StoredClassificationOverride {
  level: ClassificationLevel;
  sensitive: boolean;
  handling: HandlingInstruction[];
  reason: string;
  byUserId: string;
  byName: string;
  at: string;
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

/**
 * The classification to show for a record: what it carries, plus the area's handling instructions for
 * its profile, with any recorded override applied.
 */
export function classificationFor(config: Config, record: ClassifiedRecord): Classification {
  const handling = [...new Set([...record.classification.handling, ...configuredHandling(config, record)])];
  const derived: Classification = { ...record.classification, handling };
  if (!record.classificationOverride) return derived;
  // The permission check happened when the override was recorded, so a stored one is applied as it
  // stands. Passing every configured role satisfies applyOverride's guard without weakening it: a
  // lower that never got past the dialog is never on the record to begin with.
  return applyOverride(derived, record.classificationOverride, { roleId: config.classificationLowerableBy[0], lowerableBy: config.classificationLowerableBy }).classification;
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
