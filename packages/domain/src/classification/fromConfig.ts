/**
 * The bridge from the stored record classification and the area's configuration to an Annex 2
 * classification. Kept apart from classify.ts so the derivation rules do not depend on the config
 * shape, and so a caller with a Config in hand has one function to reach for.
 */
import type { RecordClassification } from '../enums';
import type { Config } from '../schemas/config';
import { applyOverride, handlingInstructionLabel, recordClassification, type Classification, type ClassificationLevel } from './classify';

/** A recorded override, as the process schema stores it. Applied as stored: see the schema comment. */
export interface StoredClassificationOverride {
  level: ClassificationLevel;
  reason: string;
  byUserId: string;
  byName: string;
  at: string;
}

export function classificationFor(config: Config, stored: RecordClassification, override?: StoredClassificationOverride): Classification {
  const row = config.classificationMarkings.find((m) => m.id === stored);
  const derived = recordClassification(stored, (row?.instructions ?? []).map(handlingInstructionLabel));
  if (!override) return derived;
  // The permission check happened when the override was recorded, so a stored one is applied as it
  // stands. Passing every configured role satisfies applyOverride's guard without weakening it: a
  // lower that never got past the dialog is never on the record to begin with.
  return applyOverride(derived, override, { roleId: config.classificationLowerableBy[0], lowerableBy: config.classificationLowerableBy }).classification;
}

/** The plain-language handling instruction shown on a print pack cover and in the sharing preview. */
export function handlingNote(config: Config, stored: RecordClassification): string {
  return config.classificationMarkings.find((m) => m.id === stored)?.handling ?? '';
}

/**
 * The most sensitive stored classification among a set of records. A lawful basis or a pack that
 * covers several processes takes the highest, because a marking that understates one of them is
 * worse than a marking that overstates the rest.
 */
export function mostSensitiveClassification(records: readonly { classification: RecordClassification }[]): RecordClassification {
  if (records.some((r) => r.classification === 'restricted')) return 'restricted';
  if (records.some((r) => r.classification === 'official-sensitive')) return 'official-sensitive';
  return records.length === 0 ? 'official-sensitive' : 'official';
}
