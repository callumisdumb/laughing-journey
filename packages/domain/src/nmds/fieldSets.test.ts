import { t } from '@mas/messages';
import { describe, expect, it } from 'vitest';
import {
  ASP_AGE_BANDS,
  ASP_CLIENT_GROUPS,
  ASP_ETHNICITIES,
  ASP_GENDERS,
  ASP_HARM_LOCATIONS,
  ASP_INQUIRY_ACTIONS,
  ASP_REFERRAL_SOURCES,
  HARM_TYPES,
  LSI_SERVICE_TYPES,
  aspAgeBandLabel,
  aspAgeBandOf,
  aspClientGroupLabel,
  aspEthnicityLabel,
  aspGenderLabel,
  aspHarmLocationLabel,
  aspInquiryActionLabel,
  aspReferralSourceLabel,
  harmTypeLabel,
  lsiServiceTypeLabel,
} from '../enums';
import WORKBOOK from './workbook-2026-27.fields.json';

/**
 * The ASP data workbook 2026-27 field sets, pinned to the workbook itself.
 *
 * These are the rows of a mandated national return. A field set that drifts from the template makes
 * the submission disagree with the workbook it is filling, and nothing else in the product would
 * notice. So each set is asserted against `workbook-2026-27.fields.json`, a mechanical transcription
 * of column A of each indicator's sheet in docs/templates/ASP-data-workbook-2026-27.xlsx. The
 * transcription is the fixture, not this file, so the expected strings are data rather than code:
 * the copy checkers leave the workbook's own em dashes alone there, and a diff of the fixture on the
 * next edition of the workbook shows exactly what changed. docs/RESEARCH.md 5.14 records provenance.
 *
 * Where the product's label differs from the workbook row, the difference is asserted here by name,
 * so an adjustment is a visible decision rather than a drift.
 */

/** The workbook row for one member of a field set. */
function row(set: keyof typeof WORKBOOK, id: string): string {
  const found = WORKBOOK[set].find((r) => r.id === id);
  if (!found) throw new Error(`no workbook row for ${set}.${id}`);
  return found.workbookRow;
}

/** Ids and labels of a field set, in order, as the product holds them. */
function productLabels<T extends string>(ids: readonly T[], label: (id: T) => string): Array<[T, string]> {
  return ids.map((id) => [id, label(id)]);
}

/**
 * The labels the product deliberately does not reproduce character for character, and why. Each is
 * annotated in en-GB.context.json too; this list is what keeps the two honest about each other.
 */
const ADJUSTED: Record<string, string> = {
  'harmTypes.other': 'workbook instruction "(please specify below)" dropped',
  'harmTypes.hoarding': 'trailing space in the workbook cell trimmed',
  'aspClientGroups.other': 'workbook instruction dropped',
  'aspHarmLocations.other': 'workbook instruction dropped',
  'lsiServiceTypes.other': 'workbook instruction dropped',
  'aspReferralSources.other': 'workbook instruction dropped',
  'aspReferralSources.other-member-of-the-public': 'workbook row numbers dropped, they do not survive outside the workbook',
};

/** Assert a field set matches the workbook, allowing only the adjustments named above. */
function expectMatchesWorkbook<T extends string>(set: keyof typeof WORKBOOK, ids: readonly T[], label: (id: T) => string) {
  expect(ids).toHaveLength(WORKBOOK[set].length);
  expect(ids).toEqual(WORKBOOK[set].map((r) => r.id));
  for (const [id, text] of productLabels(ids, label)) {
    const workbookRow = row(set, id);
    if (ADJUSTED[`${set}.${id}`]) {
      expect(text).not.toBe(workbookRow);
      expect(workbookRow.startsWith(text) || workbookRow.trim() === text).toBe(true);
    } else {
      expect(text).toBe(workbookRow);
    }
  }
}

describe('ASP data workbook 2026-27 field sets', () => {
  it('indicator 1 has thirty-three referral sources', () => {
    expect(ASP_REFERRAL_SOURCES).toHaveLength(33);
    expect(aspReferralSourceLabel('mwc')).toBe('Mental Welfare Commission for Scotland');
    expect(aspReferralSourceLabel('self')).toBe('Self (adult at risk)');
    expectMatchesWorkbook('aspReferralSources', ASP_REFERRAL_SOURCES, aspReferralSourceLabel);
    // Five NHS rows map to the one health agency, which is why the source is its own field.
    const nhs = ASP_REFERRAL_SOURCES.filter((s) => s.startsWith('nhs-'));
    expect(nhs).toEqual(['nhs-24', 'nhs-primary-care', 'nhs-acute', 'nhs-drug-and-alcohol', 'nhs-community-health']);
    // Three sources map to no agency at all, so the field cannot be derived from sourceAgency.
    expect(ASP_REFERRAL_SOURCES).toContain('self');
    expect(ASP_REFERRAL_SOURCES).toContain('unpaid-carer');
    expect(ASP_REFERRAL_SOURCES).toContain('anonymous');
  });

  it('indicators 10 and 11 carry the workbook labels character for character', () => {
    expect(ASP_INQUIRY_ACTIONS).toHaveLength(6);
    // Five labels use an em dash and the second uses a hyphen. The inconsistency is the workbook's,
    // and none of the six is adjusted, so all six must match it character for character.
    expectMatchesWorkbook('aspInquiryActions', ASP_INQUIRY_ACTIONS, aspInquiryActionLabel);
    expect(aspInquiryActionLabel('pending-unknown')).toBe('Pending/Unknown');
  });

  it('indicator 13 has twelve age bands that partition every adult age', () => {
    expectMatchesWorkbook('aspAgeBands', ASP_AGE_BANDS, aspAgeBandLabel);
    // Every age from 16 upwards lands in exactly one band, and nothing lands in Not known.
    for (let age = 16; age <= 120; age += 1) {
      expect(aspAgeBandOf(age)).not.toBe('notKnown');
    }
    expect(aspAgeBandOf(16)).toBe('age16to17');
    expect(aspAgeBandOf(17)).toBe('age16to17');
    expect(aspAgeBandOf(64)).toBe('age55to64');
    expect(aspAgeBandOf(65)).toBe('age65to69');
    expect(aspAgeBandOf(85)).toBe('age85plus');
    expect(aspAgeBandOf(103)).toBe('age85plus');
    // A missing date of birth is Not known, never dropped and never counted as young.
    expect(aspAgeBandOf(undefined)).toBe('notKnown');
    expect(aspAgeBandOf(Number.NaN)).toBe('notKnown');
  });

  it('indicator 13 has four gender categories in the workbook wording', () => {
    expectMatchesWorkbook('aspGenders', ASP_GENDERS, aspGenderLabel);
  });

  it('indicator 14 has eight ethnicity categories mirroring the 2022 census', () => {
    expectMatchesWorkbook('aspEthnicities', ASP_ETHNICITIES, aspEthnicityLabel);
    expect(aspEthnicityLabel('asian')).toBe('Asian, Scottish Asian or British Asian');
  });

  it('indicator 15 has twelve harm types with hoarding separated from self-neglect', () => {
    expectMatchesWorkbook('harmTypes', HARM_TYPES, harmTypeLabel);
    expect(harmTypeLabel('hoarding')).toBe('Hoarding behaviour');
    expect(harmTypeLabel('self-neglect')).toBe('Self-neglect (excluding hoarding behaviour)');
  });

  it('indicator 16 has eleven locations of harm', () => {
    expectMatchesWorkbook('aspHarmLocations', ASP_HARM_LOCATIONS, aspHarmLocationLabel);
  });

  it('indicator 17 has eleven client groups including infirmity or frailty due to age', () => {
    expectMatchesWorkbook('aspClientGroups', ASP_CLIENT_GROUPS, aspClientGroupLabel);
    expect(ASP_CLIENT_GROUPS).toContain('infirmity-frailty');
    expect(aspClientGroupLabel('infirmity-frailty')).toBe('Infirmity/frailty due to age');
    expect(aspClientGroupLabel('mental-health')).toBe('Mental Health (excl. dementia)');
    expect(aspClientGroupLabel('autism')).toBe('Autism / Autism spectrum');
    // The workbook's order, which the report table and the export both read.
    expect(ASP_CLIENT_GROUPS[0]).toBe('dementia');
    expect(ASP_CLIENT_GROUPS.at(-1)).toBe('other');
  });

  it('indicator 19a has seven LSI service types', () => {
    expectMatchesWorkbook('lsiServiceTypes', LSI_SERVICE_TYPES, lsiServiceTypeLabel);
    expect(lsiServiceTypeLabel('nhs-primary-care')).toBe('NHS Primary Care (excl. Hospital) eg GP staff, dentists etc.');
  });

  it('never leaves a field set label blank', () => {
    const every = [
      ...HARM_TYPES.map(harmTypeLabel),
      ...ASP_CLIENT_GROUPS.map(aspClientGroupLabel),
      ...ASP_INQUIRY_ACTIONS.map(aspInquiryActionLabel),
      ...ASP_AGE_BANDS.map(aspAgeBandLabel),
      ...ASP_GENDERS.map(aspGenderLabel),
      ...ASP_ETHNICITIES.map(aspEthnicityLabel),
      ...ASP_HARM_LOCATIONS.map(aspHarmLocationLabel),
      ...LSI_SERVICE_TYPES.map(lsiServiceTypeLabel),
      ...ASP_REFERRAL_SOURCES.map(aspReferralSourceLabel),
    ];
    for (const label of every) {
      expect(label.trim()).toBe(label);
      expect(label.length).toBeGreaterThan(0);
      // A missing catalogue entry surfaces as the key, which would ship a key into a national return.
      expect(label).not.toMatch(/^domain\./);
    }
    expect(t('domain.harmTypes.hoarding')).toBe('Hoarding behaviour');
  });
});
