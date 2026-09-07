/**
 * The SafeLives MARAC data return, Scotland template (New-Marac-data-template-Scotland-2025.xlsx).
 *
 * The return is one row per meeting on a single sheet: 32 columns, A to AF, headers in row 1, no
 * formulas and no validation lists, uploaded to SafeLives' MARAC data platform as a file or entered
 * there by form or grid. Every column after the meeting date is a count. This module says what the
 * columns are, in the template's order, and which referral source a referral belongs to; the cell
 * map beside it says where a row's figures go.
 *
 * The wording is the template's. Every column header lives in the catalogue as a `verbatim` string,
 * so an editor may correct it against a newer edition and may not paraphrase it; the UK template
 * (New-Marac-data-template-2025.xlsx) heads the fourteen source columns differently (IDVA rather
 * than IDAA, Probation rather than Justice social work, and so on) and the context file records the
 * UK wording beside each Scottish header as the alternative for a deployment outside Scotland.
 *
 * Provenance: both templates downloaded from safelives.org.uk on 06 Sep 2026 and read cell by cell;
 * docs/RESEARCH.md 9.2. The test beside this file reads the Scotland template and proves the
 * header row is the one this module expects.
 */
import { tKey } from '@mas/messages';
import { keySegment, SAFELIVES_SOURCES, safeLivesSourceLabel, type Agency, type RoleId, type SafeLivesSource } from '../enums';
import { columnLetters } from '../nmds/cellMap';

export const SAFELIVES_COLUMNS = [
  'maracName',
  'meetingDate',
  'casesDiscussed',
  'repeatCases',
  'childrenInHousehold',
  'casesWithChildren',
  'sourcePolice',
  'sourceIdaa',
  'sourceChildrenAndFamiliesSocialWork',
  'sourcePrimaryCare',
  'sourceSecondaryCare',
  'sourceEducation',
  'sourceHousing',
  'sourceMentalHealth',
  'sourceJusticeSocialWork',
  'sourceVoluntarySector',
  'sourceSubstanceMisuse',
  'sourceAdultSupportAndProtection',
  'sourceMash',
  'sourceOther',
  'minoritisedTotal',
  'lgbtq',
  'disabled',
  'maleVictims',
  'victims16or17',
  'harmingUnder18',
  'victims65Plus',
  'ethnicityAsian',
  'ethnicityBlack',
  'ethnicityMixed',
  'ethnicityOtherWhite',
  'ethnicityOther',
] as const;
export type SafeLivesColumn = (typeof SAFELIVES_COLUMNS)[number];

/** The template's column letter for a column: A for the MARAC name, AF for the last ethnic group. */
export function safeLivesColumnLetter(column: SafeLivesColumn): string {
  return columnLetters(SAFELIVES_COLUMNS.indexOf(column) + 1);
}

/** `police` to `sourcePolice`: the column a referral source is counted in. */
export function safeLivesSourceColumn(source: SafeLivesSource): SafeLivesColumn {
  return `source${source.charAt(0).toUpperCase()}${source.slice(1)}` as SafeLivesColumn;
}

/** The source a source column counts, or undefined for any other column. */
export function safeLivesColumnSource(column: SafeLivesColumn): SafeLivesSource | undefined {
  return SAFELIVES_SOURCES.find((s) => safeLivesSourceColumn(s) === column);
}

/** The header in row 1, exactly as the Scotland template prints it. */
export function safeLivesColumnHeader(column: SafeLivesColumn): string {
  const source = safeLivesColumnSource(column);
  return source ? safeLivesSourceLabel(source) : tKey(`reports.safeLives.columns.${keySegment(column)}`);
}

/**
 * The columns the record store cannot fill. The product holds no ethnicity by design (person.ts),
 * no sexual orientation or gender identity, and no disability flag, so the return leaves these cells
 * empty and the preview says why. It never writes a nought for a value it does not hold: a blank is
 * "not collected" and a zero is "none", and SafeLives reads them differently.
 */
export const SAFELIVES_NOT_HELD: readonly SafeLivesColumn[] = ['minoritisedTotal', 'lgbtq', 'disabled', 'ethnicityAsian', 'ethnicityBlack', 'ethnicityMixed', 'ethnicityOtherWhite', 'ethnicityOther'];

/** The agency a source belongs to, for the chart's colour and legend; MASH and Other belong to none. */
export const SAFELIVES_SOURCE_AGENCY: Record<SafeLivesSource, Agency | undefined> = {
  police: 'police',
  idaa: 'third-sector',
  childrenAndFamiliesSocialWork: 'social-work',
  primaryCare: 'health',
  secondaryCare: 'health',
  education: 'education',
  housing: 'housing',
  mentalHealth: 'health',
  justiceSocialWork: 'social-work',
  voluntarySector: 'third-sector',
  substanceMisuse: 'health',
  adultSupportAndProtection: 'social-work',
  mash: undefined,
  other: undefined,
};

/**
 * The SafeLives source a referral belongs to, from the referring agency and, where the referrer's
 * role is known, the role.
 *
 * The role decides where the agency spans several sources: a social work referral is children and
 * families, justice or adult support and protection by the worker who made it; a health referral is
 * primary care, secondary care or mental health by the service. Where only the agency is known the
 * commonest source for that agency is proposed and the referral form lets the coordinator correct
 * it. Scotland has no MASH, so nothing maps there; a coordinator who receives a referral from one
 * picks it by hand.
 */
export function safeLivesSourceFor(agency: Agency, roleId?: RoleId): SafeLivesSource {
  switch (agency) {
    case 'police':
      return 'police';
    case 'third-sector':
      return roleId === 'idaa' ? 'idaa' : 'voluntarySector';
    case 'education':
      return 'education';
    case 'housing':
      return 'housing';
    case 'health':
      switch (roleId) {
        case 'cmhn':
          return 'mentalHealth';
        case 'midwife':
        case 'discharge-coordinator':
        case 'cp-nurse-adviser':
          return 'secondaryCare';
        default:
          return 'primaryCare';
      }
    case 'social-work':
      switch (roleId) {
        case 'justice-social-worker':
        case 'prison-social-worker':
          return 'justiceSocialWork';
        case 'social-worker-adults':
        case 'council-officer-asp':
        case 'mho':
          return 'adultSupportAndProtection';
        default:
          return 'childrenAndFamiliesSocialWork';
      }
    default:
      return 'other';
  }
}
