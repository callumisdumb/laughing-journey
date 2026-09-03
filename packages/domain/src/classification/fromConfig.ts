/**
 * The bridge from the stored record classification and the area's configuration to an Annex 2
 * classification. Kept apart from classify.ts so the derivation rules do not depend on the config
 * shape, and so a caller with a Config in hand has one function to reach for.
 */
import type { RecordClassification } from '../enums';
import type { Config } from '../schemas/config';
import { handlingInstructionLabel, recordClassification, type Classification } from './classify';

export function classificationFor(config: Config, stored: RecordClassification): Classification {
  const row = config.classificationMarkings.find((m) => m.id === stored);
  return recordClassification(stored, (row?.instructions ?? []).map(handlingInstructionLabel));
}

/** The plain-language handling instruction shown on a print pack cover and in the sharing preview. */
export function handlingNote(config: Config, stored: RecordClassification): string {
  return config.classificationMarkings.find((m) => m.id === stored)?.handling ?? '';
}
