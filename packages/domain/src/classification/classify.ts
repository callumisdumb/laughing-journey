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
 * Third, RESTRICTED is not a classification and this module does not offer one. It was abolished on
 * 2 April 2014 when the six-tier Government Protective Marking Scheme gave way to the three-level
 * Government Security Classification scheme, and Official absorbed everything up to and including
 * it with no direct mapping between the two. Access restriction is a separate, orthogonal property
 * (`AccessRestriction` in enums.ts): a MAPPA record is Official-Sensitive and access-restricted, an
 * ASP case conference minute can be Official-Sensitive and not restricted, and an aggregate report
 * is Official and not restricted. One scale could not say any of that.
 *
 * Secret and Top Secret are in the type and unreachable in the product. Nothing in public protection
 * casework reaches defence, diplomacy or national security, so `classify` never returns them and a
 * test says so. They are present rather than omitted because a reviewer needs to see that the scheme
 * is the real three-level one and not a two-level invention, and the glossary says the same.
 */
import { t, tKey } from '@mas/messages';

/** The three levels of the Government Security Classification scheme. Annex 2, and nothing else. */
export const CLASSIFICATION_LEVELS = ['official', 'secret', 'top-secret'] as const;
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

/**
 * A classification: a level, whether the Official-Sensitive marking applies, and any handling
 * instructions. Official-Sensitive is a marking on a subset of Official rather than a fourth level,
 * which is why it is a flag here and not a value of `level`.
 */
export interface Classification {
  level: ClassificationLevel;
  /** The Official-Sensitive marking. Meaningful only at Official; Secret and above are always marked. */
  sensitive: boolean;
  /** Appended after the marking. Only meaningful when `sensitive`, or at Secret and above. */
  handling: HandlingInstruction[];
}

export const OFFICIAL: Classification = { level: 'official', sensitive: false, handling: [] };

export function officialSensitive(handling: HandlingInstruction[] = []): Classification {
  return { level: 'official', sensitive: true, handling };
}

/** Equality, so a caller can compare two classifications without reaching into the shape. */
export function sameClassification(a: Classification, b: Classification): boolean {
  return a.level === b.level && a.sensitive === b.sensitive && a.handling.length === b.handling.length && a.handling.every((h, i) => h === b.handling[i]);
}

/**
 * Order, for "no weaker than" comparisons. Only the first two ranks are reachable in this product;
 * the rest are here so the comparison stays correct if they ever are.
 */
export function classificationRank(c: Classification): number {
  if (c.level === 'top-secret') return 4;
  if (c.level === 'secret') return 3;
  return c.sensitive ? 2 : 1;
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
export const CLASSIFICATION_RULES: readonly { reason: ClassificationReason; level: ClassificationLevel; sensitive: boolean }[] = [
  { reason: 'mappa-record', level: 'official', sensitive: true },
  { reason: 'marac-record', level: 'official', sensitive: true },
  { reason: 'names-perpetrator', level: 'official', sensitive: true },
  { reason: 'cp-record', level: 'official', sensitive: true },
  { reason: 'special-category-data', level: 'official', sensitive: true },
  { reason: 'criminal-offence-data', level: 'official', sensitive: true },
  { reason: 'asp-order-or-lsi', level: 'official', sensitive: true },
  { reason: 'security-information', level: 'official', sensitive: true },
  { reason: 'open-restricted-process', level: 'official', sensitive: true },
  { reason: 'linked-record', level: 'official', sensitive: true },
  { reason: 'routine-official', level: 'official', sensitive: false },
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
  if (subject.linked?.some((c) => c.sensitive)) reasons.push('linked-record');

  if (reasons.length === 0) return { classification: OFFICIAL, reasons: ['routine-official'] };
  const handling = subject.linked?.flatMap((c) => (c.sensitive ? c.handling : [])) ?? [];
  return { classification: officialSensitive([...new Set(handling)]), reasons };
}

/**
 * The marking for an artefact, or undefined where none is required. Annex 2 paragraph 5: routine
 * Official carries no marking at all, which is the whole of D-058 in one line.
 */
export function marking(classification: Classification): string | undefined {
  if (classification.level === 'secret') return t('domain.classifications.secretMarking');
  if (classification.level === 'top-secret') return t('domain.classifications.topSecretMarking');
  if (!classification.sensitive) return undefined;
  const base = t('domain.classifications.officialSensitiveMarking');
  return classification.handling.length === 0 ? base : `${base} ${classification.handling.join(' ')}`;
}

/** A file name prefix so a document leaving the product carries its marking in the name. */
export function markingFilePrefix(classification: Classification): string {
  const text = marking({ ...classification, handling: [] });
  return text === undefined ? '' : `${text.replace(/\s+/g, '-')}-`;
}

/** The level on its own: Official, Secret, Top Secret. Not the marking, which adds Sensitive. */
export function classificationLevelLabel(level: ClassificationLevel): string {
  return tKey(`domain.classifications.${level === 'official' ? 'official' : level === 'secret' ? 'secret' : 'topSecret'}`);
}

/** What a person calls this classification: "Official" or "Official-Sensitive". */
export function classificationLabel(classification: Classification): string {
  if (classification.level !== 'official') return classificationLevelLabel(classification.level);
  return tKey(classification.sensitive ? 'domain.classifications.officialSensitive' : 'domain.classifications.official');
}

export function classificationDefinition(level: ClassificationLevel): string {
  return tKey(`domain.classifications.${level === 'official' ? 'officialDefinition' : level === 'secret' ? 'secretDefinition' : 'topSecretDefinition'}`);
}

/** The definition of the Official-Sensitive marking, which is not a level and so not in the above. */
export function officialSensitiveDefinition(): string {
  return tKey('domain.classifications.officialSensitiveDefinition');
}

export function classificationReasonLabel(reason: ClassificationReason): string {
  return tKey(`domain.classificationReasons.${reason.replace(/-([a-z])/g, (_m, c: string) => c.toUpperCase())}`);
}

/** True where the classification must be shown, on screen and in print. */
export function isMarked(classification: Classification): boolean {
  return classification.level !== 'official' || classification.sensitive;
}

/**
 * A raise is always allowed and always carries a reason. A lower needs one of the configured roles,
 * because the whole point of deriving the level is that it cannot be talked down quietly.
 */
export interface ClassificationOverride {
  level: ClassificationLevel;
  sensitive: boolean;
  handling: HandlingInstruction[];
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
  const wanted: Classification = { level: override.level, sensitive: override.sensitive, handling: override.handling };
  const lowering = classificationRank(wanted) < classificationRank(derived);
  if (!lowering) return { classification: wanted };
  if (!options.roleId || !canLower(options.roleId, options.lowerableBy ?? [])) return { classification: derived, refused: 'not-permitted' };
  return { classification: wanted };
}

/**
 * Which set of local handling instructions applies to a record.
 *
 * This is what the old three-value classification enum was really being used for. An area cannot
 * rename a marking or mark routine Official information, but it can say how a marked record is
 * handled, and it needs to say something different about a record that is also access-restricted.
 * So the configuration is keyed on the profile, and the third profile is named for what it is.
 */
export const MARKING_PROFILES = ['official', 'official-sensitive', 'access-restricted'] as const;
export type MarkingProfileId = (typeof MARKING_PROFILES)[number];

export function markingProfileFor(classification: Classification, restricted: boolean): MarkingProfileId {
  if (restricted) return 'access-restricted';
  return isMarked(classification) ? 'official-sensitive' : 'official';
}

/**
 * The classification a marking profile describes, for the Admin preview. The profile is not itself a
 * classification: `access-restricted` describes an Official-Sensitive record that is also restricted,
 * which is two properties and not a third level.
 */
export function profileClassification(profile: MarkingProfileId, handling: HandlingInstruction[] = []): Classification {
  return profile === 'official' ? OFFICIAL : officialSensitive([...new Set(handling)]);
}

/**
 * The canonical encoding of a classification for cryptographic binding, so a ciphertext cannot be
 * moved onto a record with a different marking or a different access restriction. Three fields, in a
 * fixed order, joined by a character none of them can contain.
 */
export function classificationTag(classification: Classification, restricted: boolean): string {
  return `${classification.level}/${classification.sensitive ? 'sensitive' : 'routine'}/${restricted ? 'restricted' : 'open'}`;
}
