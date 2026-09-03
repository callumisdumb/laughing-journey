/**
 * Government Security Classification, as Annex 2 of the MAPPA National Guidance (31 March 2022)
 * sets it out. See docs/RESEARCH.md 5.13 for the verbatim wording.
 *
 * The scheme has three levels: Official, Secret and Top Secret. Official is the lowest and covers
 * the majority of information the public sector creates, and the guidance is explicit that there is
 * **no requirement to explicitly mark routine Official information**. Official-Sensitive is a
 * limited subset that could have more damaging consequences and **must be clearly marked**, with
 * special handling instructions added where the sensitivity justifies strict restrictions.
 *
 * Two consequences shape this module.
 *
 * First, the product must not stamp OFFICIAL on everything. Marking every screen and every page
 * trains people to ignore markings, which is the opposite of the intent (D-058). `marking()`
 * returns undefined for Official, and the print packs render nothing.
 *
 * Second, classification is derived from the record, not chosen by whoever is printing. `classify()`
 * is pure and total: give it what an artefact is about and it returns the level, mapping onto the
 * four examples Annex 2 gives. A human may then raise it with a recorded reason, and may lower it
 * only in a named role, both audited exactly as break-glass is.
 *
 * Secret and Top Secret are deliberately absent. Nothing in this product's scope reaches defence,
 * diplomacy or national security, so the type does not offer levels the product can never justify;
 * the glossary says so.
 */
import { t, tKey } from '@mas/messages';

export const CLASSIFICATION_LEVELS = ['official', 'official-sensitive'] as const;
export type ClassificationLevel = (typeof CLASSIFICATION_LEVELS)[number];

/** A short string appended after the marking. Local configuration: practice varies by organisation. */
export type HandlingInstruction = string;

/**
 * The special handling instructions an area may append after an Official-Sensitive marking. Annex 2
 * allows them "where the sensitivity of the information justifies strict restrictions on sharing";
 * it does not enumerate them, so the list is ours and configurable per classification in Admin.
 */
export const HANDLING_INSTRUCTIONS = ['distribution-list-only', 'chair-approval-required', 'do-not-forward', 'not-for-subject-access', 'police-use-only'] as const;
export type HandlingInstructionId = (typeof HANDLING_INSTRUCTIONS)[number];

export function handlingInstructionLabel(id: HandlingInstructionId): string {
  return tKey(`domain.handling.${id.replace(/-([a-z])/g, (_m, c: string) => c.toUpperCase())}`);
}

export type Classification = { level: 'official' } | { level: 'official-sensitive'; handling: HandlingInstruction[] };

export const OFFICIAL: Classification = { level: 'official' };

export function officialSensitive(handling: HandlingInstruction[] = []): Classification {
  return { level: 'official-sensitive', handling };
}

/**
 * What an artefact is about, in the terms the Annex 2 examples use. Every field is optional: an
 * artefact says what it knows and `classify` decides. Nothing here is a free-text override.
 */
export interface ClassificationSubject {
  /** The process the artefact belongs to, where it belongs to one. */
  process?: 'asp' | 'cp' | 'marac' | 'mappa' | 'awi';
  /** What the artefact is. */
  artefact?:
    | 'meeting-minute'
    | 'risk-management-plan'
    | 'environmental-risk-assessment'
    | 'disclosure-decision'
    | 'pre-meeting-return'
    | 'referral'
    | 'research-return'
    | 'action-plan'
    | 'ird-record'
    | 'jii-planning-record'
    | 'cppm-minute'
    | 'protection-order-application'
    | 'lsi-workspace'
    | 'break-glass-audit'
    | 'audit-export'
    | 'connector-credentials'
    | 'person-record'
    | 'worklist'
    | 'aggregate-report'
    | 'empty-state'
    | 'admin-configuration'
    | 'glossary';
  /** The artefact names a perpetrator, an alleged perpetrator, or someone on bail or licence conditions. */
  namesPerpetrator?: boolean;
  /** Special category personal data under UK GDPR Article 9. */
  specialCategoryData?: boolean;
  /** Criminal offence data under UK GDPR Article 10. */
  criminalOffenceData?: boolean;
  /** A linked record's classification. A derived level is never lower than one it links to. */
  linked?: Classification[];
  /** A person record with at least one open restricted process, where the view would reveal the link. */
  hasOpenRestrictedProcess?: boolean;
}

const MAPPA_ARTEFACTS = new Set(['meeting-minute', 'risk-management-plan', 'environmental-risk-assessment', 'disclosure-decision', 'pre-meeting-return']);
const MARAC_ARTEFACTS = new Set(['referral', 'research-return', 'meeting-minute', 'action-plan']);
const CP_ARTEFACTS = new Set(['ird-record', 'jii-planning-record', 'cppm-minute']);
const ASP_ARTEFACTS = new Set(['protection-order-application', 'lsi-workspace']);
const SECURITY_ARTEFACTS = new Set(['break-glass-audit', 'audit-export', 'connector-credentials']);

/** Which Annex 2 example a decision rests on, so the Admin rule table and the audit entry can cite it. */
export type ClassificationReason =
  | 'mappa-record'
  | 'marac-record'
  | 'names-perpetrator'
  | 'cp-record'
  | 'special-category-data'
  | 'criminal-offence-data'
  | 'asp-order-or-lsi'
  | 'security-information'
  | 'linked-record'
  | 'open-restricted-process'
  | 'routine-official';

/**
 * The derivation rules in the order `classify` checks them, so the Admin rule table and the tests
 * read the same list the function does. A rule table that drifts from the function is worse than
 * none, because it tells people the product does something it does not.
 */
export const CLASSIFICATION_RULES: readonly { reason: ClassificationReason; level: ClassificationLevel }[] = [
  { reason: 'mappa-record', level: 'official-sensitive' },
  { reason: 'marac-record', level: 'official-sensitive' },
  { reason: 'names-perpetrator', level: 'official-sensitive' },
  { reason: 'cp-record', level: 'official-sensitive' },
  { reason: 'special-category-data', level: 'official-sensitive' },
  { reason: 'criminal-offence-data', level: 'official-sensitive' },
  { reason: 'asp-order-or-lsi', level: 'official-sensitive' },
  { reason: 'security-information', level: 'official-sensitive' },
  { reason: 'open-restricted-process', level: 'official-sensitive' },
  { reason: 'linked-record', level: 'official-sensitive' },
  { reason: 'routine-official', level: 'official' },
];

export interface ClassificationResult {
  classification: Classification;
  /** Why, in the order the rules were checked. Empty only for routine Official. */
  reasons: ClassificationReason[];
}

/**
 * Derive a classification. Pure, total, and never lower than a linked record's: a person record
 * linked to a MAPPA case inherits Official-Sensitive for any view that would reveal the link, which
 * is why the presence-only state exists.
 */
export function classify(subject: ClassificationSubject): ClassificationResult {
  const reasons: ClassificationReason[] = [];
  const { process, artefact } = subject;

  if (process === 'mappa' && (artefact === undefined || MAPPA_ARTEFACTS.has(artefact) || artefact === 'referral')) reasons.push('mappa-record');
  if (process === 'marac' && (artefact === undefined || MARAC_ARTEFACTS.has(artefact))) reasons.push('marac-record');
  if (subject.namesPerpetrator) reasons.push('names-perpetrator');
  if (process === 'cp' && artefact !== undefined && CP_ARTEFACTS.has(artefact)) reasons.push('cp-record');
  if (subject.specialCategoryData) reasons.push('special-category-data');
  if (subject.criminalOffenceData) reasons.push('criminal-offence-data');
  if (process === 'asp' && artefact !== undefined && ASP_ARTEFACTS.has(artefact)) reasons.push('asp-order-or-lsi');
  if (artefact !== undefined && SECURITY_ARTEFACTS.has(artefact)) reasons.push('security-information');
  if (subject.hasOpenRestrictedProcess) reasons.push('open-restricted-process');
  if (subject.linked?.some((c) => c.level === 'official-sensitive')) reasons.push('linked-record');

  if (reasons.length === 0) return { classification: OFFICIAL, reasons: ['routine-official'] };
  const handling = subject.linked?.flatMap((c) => (c.level === 'official-sensitive' ? c.handling : [])) ?? [];
  return { classification: officialSensitive([...new Set(handling)]), reasons };
}

/** The marking for an artefact, or undefined where none is required. Annex 2 paragraph 5. */
export function marking(classification: Classification): string | undefined {
  if (classification.level === 'official') return undefined;
  const base = t('domain.classifications.officialSensitiveMarking');
  return classification.handling.length === 0 ? base : `${base} ${classification.handling.join(' ')}`;
}

/** A file name prefix so a document leaving the product carries its marking in the name. */
export function markingFilePrefix(classification: Classification): string {
  return classification.level === 'official' ? '' : `${t('domain.classifications.officialSensitiveMarking').replace(/\s+/g, '-')}-`;
}

export function classificationLevelLabel(level: ClassificationLevel): string {
  return tKey(`domain.classifications.${level === 'official' ? 'official' : 'officialSensitive'}`);
}

export function classificationDefinition(level: ClassificationLevel): string {
  return tKey(`domain.classifications.${level === 'official' ? 'officialDefinition' : 'officialSensitiveDefinition'}`);
}

export function classificationReasonLabel(reason: ClassificationReason): string {
  return tKey(`domain.classificationReasons.${reason.replace(/-([a-z])/g, (_m, c: string) => c.toUpperCase())}`);
}

/** True where the classification must be shown, on screen and in print. */
export function isMarked(classification: Classification): boolean {
  return classification.level === 'official-sensitive';
}

/**
 * A raise is always allowed and always carries a reason. A lower needs one of the configured roles,
 * because the whole point of deriving the level is that it cannot be talked down quietly.
 */
export interface ClassificationOverride {
  level: ClassificationLevel;
  reason: string;
  byUserId: string;
  at: string;
}

export function canLower(roleId: string, lowerableBy: readonly string[]): boolean {
  return lowerableBy.includes(roleId);
}

/** Apply an override to a derived classification. A lower with no permission is refused, not silent. */
export function applyOverride(
  derived: Classification,
  override: ClassificationOverride | undefined,
  options: { roleId?: string; lowerableBy?: readonly string[] } = {},
): { classification: Classification; refused?: 'not-permitted' } {
  if (!override) return { classification: derived };
  const raising = override.level === 'official-sensitive' && derived.level === 'official';
  if (raising) return { classification: officialSensitive(derived.level === 'official' ? [] : []) };
  const lowering = override.level === 'official' && derived.level === 'official-sensitive';
  if (!lowering) return { classification: derived };
  if (!options.roleId || !canLower(options.roleId, options.lowerableBy ?? [])) return { classification: derived, refused: 'not-permitted' };
  return { classification: OFFICIAL };
}

/**
 * The Annex 2 classification of a stored record classification. `restricted` is the MAPPA
 * distribution-list concept, which in Annex 2 terms is Official-Sensitive with a handling
 * instruction: chapter 11 says the Minute and Risk Management Plan are always Official and may be
 * Official-Sensitive, and that an agency cannot share them widely with its personnel unless the
 * chair of the MAPPA meeting has agreed.
 */
export function recordClassification(stored: 'official' | 'official-sensitive' | 'restricted', handling: HandlingInstruction[] = []): Classification {
  if (stored === 'official') return OFFICIAL;
  // The distribution list is what makes a restricted record restricted, so it holds whatever an area
  // has configured. De-duplicated, because the area may have configured it explicitly as well.
  if (stored === 'restricted') return officialSensitive([...new Set([t('domain.handling.distributionListOnly'), ...handling])]);
  return officialSensitive([...new Set(handling)]);
}
