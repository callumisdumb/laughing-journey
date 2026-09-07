/**
 * The ASP data workbook 2026-27 cell map.
 *
 * The workbook is a mandated quarterly return to ASPData@gov.scot. It has fifteen sheets, most of
 * them a block of labelled rows against a column per quarter running from Q1 2023/24 to Q4 2031/32,
 * and it expects a Lead Officer to type figures into it by hand. This module says exactly which cell
 * each figure of ours belongs in, so the export writes a workbook a Lead Officer can check row by
 * row against the one they would have filled themselves.
 *
 * Three things shape it.
 *
 * The map is a pure function of figures, not of the dataset. It takes counts and returns
 * `{ sheet, cell, value }`, so it can be tested against the workbook without a seed, and so the
 * counting and the placing can be wrong independently rather than together.
 *
 * Nothing is written to a cell the workbook computes. Every "Total" row and the "All adults" column
 * on the age sheet carry SUM formulas, and overwriting one with a literal would leave a workbook
 * that looks right and stops adding up the moment anyone edits it. `nmdsCellMap` never emits those
 * cells, and the writer checks the template again before writing (D-060).
 *
 * The column is derived, not hard-coded per sheet. Every data block on every sheet starts its
 * quarters at column C and steps one column per quarter, except sheet 13, which has five columns per
 * quarter because it crosses age with gender.
 *
 * Provenance: docs/templates/ASP-data-workbook-2026-27.xlsx, read on 03 Sep 2026. Every row number
 * below was read from column A of the sheet named. docs/RESEARCH.md 5.14.
 */
import type { AspAgeBand, AspClientGroup, AspEthnicity, AspGender, AspHarmLocation, AspInquiryAction, AspReferralSource, HarmType, LsiServiceType } from '../enums';
import { ASP_AGE_BANDS, ASP_CLIENT_GROUPS, ASP_ETHNICITIES, ASP_GENDERS, ASP_HARM_LOCATIONS, ASP_INQUIRY_ACTIONS, ASP_REFERRAL_SOURCES, HARM_TYPES, LSI_SERVICE_TYPES } from '../enums';

export const NMDS_QUARTERS = ['q1', 'q2', 'q3', 'q4'] as const;
export type NmdsQuarter = (typeof NMDS_QUARTERS)[number];

/** One figure and where it goes. `value` is a number for a count and a string for a code. */
export interface NmdsCell {
  sheet: string;
  cell: string;
  value: number | string;
}

/** The sheet names, exactly as the workbook spells them, tab by tab. */
export const NMDS_SHEETS = {
  referrals: '1 ASP REFERRALS',
  inquiries: '2-3 INQUIRIES',
  conferences: '4 CCs',
  attendees: '5-7 CC ATTENDEES',
  plansAndPowers: '8-9 ASPPs & POWERS',
  actions: '10-11 ACTIONS TAKEN',
  ageAndGender: '13 AGE & GENDER',
  ethnicity: '14 ETHNICITY',
  harm: '15 TYPES OF HARM',
  location: '16 LOCATION OF HARM',
  clientGroup: '17 CLIENT GROUP',
  caring: '18 CARING RESPONSIBILITIES',
  lsis: '19 LSIs',
} as const;

/**
 * Q1 2026/27 is the thirteenth quarter the workbook holds, counting from Q1 2023/24. Every sheet
 * lays its quarters out from column C at one column each, so Q1 2026/27 is column O.
 */
const FIRST_QUARTER_INDEX = 12;
const quarterIndex = (quarter: NmdsQuarter) => FIRST_QUARTER_INDEX + NMDS_QUARTERS.indexOf(quarter);

/** Column number to its letters: 1 to A, 27 to AA, 63 to BK. */
export function columnLetters(column: number): string {
  let n = column;
  let out = '';
  while (n > 0) {
    const rem = (n - 1) % 26;
    out = String.fromCharCode(65 + rem) + out;
    n = Math.floor((n - 1) / 26);
  }
  return out;
}

/**
 * The column a quarter's figures go in, on a sheet with `columnsPerQuarter` columns per quarter.
 * One column everywhere except sheet 13, where each quarter is four gender columns and a total.
 */
export function quarterColumn(quarter: NmdsQuarter, columnsPerQuarter = 1): string {
  return columnLetters(3 + quarterIndex(quarter) * columnsPerQuarter);
}

/** The figures a return needs, one quarter's worth. Every field is a count unless it says otherwise. */
export interface NmdsFigures {
  /** Indicator 1: referrals received, by the workbook's source. */
  referralsBySource: Partial<Record<AspReferralSource, number>>;
  /** Indicator 2: inquiries concluded without the use of investigatory powers. */
  inquiriesWithoutPowers: number;
  /** Indicator 3: inquiries using investigatory powers. */
  inquiriesWithPowers: number;
  /** Indicator 4a and 4b. */
  initialCaseConferences: number;
  reviewCaseConferences: number;
  /** Indicators 5 and 6: invitations, and uptake as a whole-number percentage of them. */
  adultsInvited: number;
  adultUptakePercent: number | undefined;
  advocatesInvited: number;
  advocateUptakePercent: number | undefined;
  /** Indicator 8a and 8b. */
  managedPlans: number;
  newPlans: number;
  /** Indicator 9a and 9b, by order type. */
  ordersAppliedFor: { assessment: number; removal: number; banning: number };
  ordersGranted: { assessment: number; removal: number; banning: number };
  /** Indicators 10 and 11: action taken, split by whether investigatory powers were used. */
  actionsWithoutPowers: Partial<Record<AspInquiryAction, number>>;
  actionsWithPowers: Partial<Record<AspInquiryAction, number>>;
  /** Indicator 13: age crossed with gender, for all inquiries. */
  ageByGender: Partial<Record<AspAgeBand, Partial<Record<AspGender, number>>>>;
  /** Indicator 14. */
  ethnicity: Partial<Record<AspEthnicity, number>>;
  /** Indicators 15a and 15b. */
  harmWithoutPowers: Partial<Record<HarmType, number>>;
  harmWithPowers: Partial<Record<HarmType, number>>;
  /** Indicators 16a and 16b. */
  locationWithoutPowers: Partial<Record<AspHarmLocation, number>>;
  locationWithPowers: Partial<Record<AspHarmLocation, number>>;
  /** Indicators 17a and 17b. */
  clientGroupWithoutPowers: Partial<Record<AspClientGroup, number>>;
  clientGroupWithPowers: Partial<Record<AspClientGroup, number>>;
  /** Indicator 18a and 18b. */
  adultsWithChildCareResponsibilities: number;
  adultsWithOtherCaringResponsibilities: number;
  childPresentAtIncident: number;
  /** Indicator 19a, and the identifiers 19b and 19c ask for. */
  lsisByServiceType: Partial<Record<LsiServiceType, number>>;
  careHomeCsNumbers: string[];
  supportServiceCsNumbers: string[];
  nhsHospitalCodes: string[];
}

/** The first data row of a block, so a field set's rows are `firstRow + index`. */
const ROWS = {
  referrals: 6,
  inquiriesWithoutPowers: 7,
  inquiriesWithPowers: 11,
  initialConferences: 7,
  reviewConferences: 8,
  adultsInvited: 9,
  adultUptake: 10,
  advocatesInvited: 14,
  advocateUptake: 15,
  managedPlans: 9,
  newPlans: 10,
  ordersAppliedFor: 14,
  ordersGranted: 20,
  actionsWithoutPowers: 7,
  actionsWithPowers: 17,
  ageBands: 7,
  ethnicity: 6,
  harmWithoutPowers: 7,
  harmWithPowers: 23,
  locationWithoutPowers: 7,
  locationWithPowers: 22,
  clientGroupWithoutPowers: 7,
  clientGroupWithPowers: 22,
  childCareResponsibilities: 7,
  otherCaringResponsibilities: 8,
  childPresent: 12,
  lsiServiceTypes: 8,
  careHomeCsNumbers: 29,
  supportServiceCsNumbers: 38,
  nhsHospitalCodes: 47,
} as const;

/** How many rows each free list on sheet 19 has before it runs into the next block. */
export const LSI_LIST_ROWS = 7;

/**
 * The cells the workbook computes for itself in a given quarter's column. Every one is a SUM in the
 * template, and writing a literal over one leaves a workbook that looks right and stops adding up
 * the moment anyone edits it. The map never emits these, and the writer checks the template again
 * before writing, so a change of edition that moves a total is caught rather than overwritten.
 *
 * Sheet 13 is the odd one: its totals are a whole column, not a row, because it crosses age with
 * gender. Both the per-band totals and the grand total sit in the fifth column of the quarter's block.
 */
export function formulaCells(quarter: NmdsQuarter): NmdsCell['cell'][] {
  const c = quarterColumn(quarter);
  const ageTotals = columnLetters(3 + quarterIndex(quarter) * 5 + 4);
  return [
    `${NMDS_SHEETS.referrals}!${c}39`,
    `${NMDS_SHEETS.conferences}!${c}9`,
    `${NMDS_SHEETS.actions}!${c}13`,
    `${NMDS_SHEETS.actions}!${c}23`,
    `${NMDS_SHEETS.ethnicity}!${c}14`,
    `${NMDS_SHEETS.harm}!${c}19`,
    `${NMDS_SHEETS.harm}!${c}35`,
    `${NMDS_SHEETS.location}!${c}18`,
    `${NMDS_SHEETS.location}!${c}33`,
    `${NMDS_SHEETS.clientGroup}!${c}18`,
    `${NMDS_SHEETS.clientGroup}!${c}33`,
    `${NMDS_SHEETS.lsis}!${c}15`,
    ...Array.from({ length: 13 }, (_, i) => `${NMDS_SHEETS.ageAndGender}!${ageTotals}${7 + i}`),
  ];
}

function block<T extends string>(sheet: string, column: string, firstRow: number, ids: readonly T[], counts: Partial<Record<T, number>>): NmdsCell[] {
  return ids.map((id, i) => ({ sheet, cell: `${column}${firstRow + i}`, value: counts[id] ?? 0 }));
}

function list(sheet: string, column: string, firstRow: number, values: readonly string[]): NmdsCell[] {
  return values.slice(0, LSI_LIST_ROWS).map((value, i) => ({ sheet, cell: `${column}${firstRow + i}`, value }));
}

/**
 * Every cell one quarter's return fills, in sheet order. A figure of nought is written as nought, not
 * left blank: a blank cell in a national return means "not provided" and nought means "none", and
 * the two are read differently.
 */
export function nmdsCellMap(figures: NmdsFigures, quarter: NmdsQuarter): NmdsCell[] {
  const c = quarterColumn(quarter);
  const cells: NmdsCell[] = [];
  const put = (sheet: string, row: number, value: number | string) => cells.push({ sheet, cell: `${c}${row}`, value });

  cells.push(...block(NMDS_SHEETS.referrals, c, ROWS.referrals, ASP_REFERRAL_SOURCES, figures.referralsBySource));

  put(NMDS_SHEETS.inquiries, ROWS.inquiriesWithoutPowers, figures.inquiriesWithoutPowers);
  put(NMDS_SHEETS.inquiries, ROWS.inquiriesWithPowers, figures.inquiriesWithPowers);

  put(NMDS_SHEETS.conferences, ROWS.initialConferences, figures.initialCaseConferences);
  put(NMDS_SHEETS.conferences, ROWS.reviewConferences, figures.reviewCaseConferences);

  // The workbook inserts the per cent sign itself, so the uptake goes in as a bare number. Where
  // nothing was invited there is no percentage to report, and the cell is left out rather than
  // written as nought: nought per cent of nothing would read as a total failure to invite anyone.
  put(NMDS_SHEETS.attendees, ROWS.adultsInvited, figures.adultsInvited);
  if (figures.adultUptakePercent !== undefined) put(NMDS_SHEETS.attendees, ROWS.adultUptake, figures.adultUptakePercent);
  put(NMDS_SHEETS.attendees, ROWS.advocatesInvited, figures.advocatesInvited);
  if (figures.advocateUptakePercent !== undefined) put(NMDS_SHEETS.attendees, ROWS.advocateUptake, figures.advocateUptakePercent);

  put(NMDS_SHEETS.plansAndPowers, ROWS.managedPlans, figures.managedPlans);
  put(NMDS_SHEETS.plansAndPowers, ROWS.newPlans, figures.newPlans);
  const orderOrder = ['assessment', 'removal', 'banning'] as const;
  orderOrder.forEach((order, i) => put(NMDS_SHEETS.plansAndPowers, ROWS.ordersAppliedFor + i, figures.ordersAppliedFor[order]));
  orderOrder.forEach((order, i) => put(NMDS_SHEETS.plansAndPowers, ROWS.ordersGranted + i, figures.ordersGranted[order]));

  cells.push(...block(NMDS_SHEETS.actions, c, ROWS.actionsWithoutPowers, ASP_INQUIRY_ACTIONS, figures.actionsWithoutPowers));
  cells.push(...block(NMDS_SHEETS.actions, c, ROWS.actionsWithPowers, ASP_INQUIRY_ACTIONS, figures.actionsWithPowers));

  // Sheet 13 crosses twelve age bands with four genders. Five columns per quarter, the fifth being
  // the workbook's own "All adults" total, which is never written.
  const ageColumnStart = 3 + quarterIndex(quarter) * 5;
  ASP_AGE_BANDS.forEach((band, rowOffset) => {
    ASP_GENDERS.forEach((gender, columnOffset) => {
      cells.push({
        sheet: NMDS_SHEETS.ageAndGender,
        cell: `${columnLetters(ageColumnStart + columnOffset)}${ROWS.ageBands + rowOffset}`,
        value: figures.ageByGender[band]?.[gender] ?? 0,
      });
    });
  });

  cells.push(...block(NMDS_SHEETS.ethnicity, c, ROWS.ethnicity, ASP_ETHNICITIES, figures.ethnicity));
  cells.push(...block(NMDS_SHEETS.harm, c, ROWS.harmWithoutPowers, HARM_TYPES, figures.harmWithoutPowers));
  cells.push(...block(NMDS_SHEETS.harm, c, ROWS.harmWithPowers, HARM_TYPES, figures.harmWithPowers));
  cells.push(...block(NMDS_SHEETS.location, c, ROWS.locationWithoutPowers, ASP_HARM_LOCATIONS, figures.locationWithoutPowers));
  cells.push(...block(NMDS_SHEETS.location, c, ROWS.locationWithPowers, ASP_HARM_LOCATIONS, figures.locationWithPowers));
  cells.push(...block(NMDS_SHEETS.clientGroup, c, ROWS.clientGroupWithoutPowers, ASP_CLIENT_GROUPS, figures.clientGroupWithoutPowers));
  cells.push(...block(NMDS_SHEETS.clientGroup, c, ROWS.clientGroupWithPowers, ASP_CLIENT_GROUPS, figures.clientGroupWithPowers));

  put(NMDS_SHEETS.caring, ROWS.childCareResponsibilities, figures.adultsWithChildCareResponsibilities);
  put(NMDS_SHEETS.caring, ROWS.otherCaringResponsibilities, figures.adultsWithOtherCaringResponsibilities);
  put(NMDS_SHEETS.caring, ROWS.childPresent, figures.childPresentAtIncident);

  cells.push(...block(NMDS_SHEETS.lsis, c, ROWS.lsiServiceTypes, LSI_SERVICE_TYPES, figures.lsisByServiceType));
  cells.push(...list(NMDS_SHEETS.lsis, c, ROWS.careHomeCsNumbers, figures.careHomeCsNumbers));
  cells.push(...list(NMDS_SHEETS.lsis, c, ROWS.supportServiceCsNumbers, figures.supportServiceCsNumbers));
  cells.push(...list(NMDS_SHEETS.lsis, c, ROWS.nhsHospitalCodes, figures.nhsHospitalCodes));

  return cells;
}

/** An empty figure set, so a caller fills in what it has rather than assembling the shape by hand. */
export function emptyNmdsFigures(): NmdsFigures {
  return {
    referralsBySource: {},
    inquiriesWithoutPowers: 0,
    inquiriesWithPowers: 0,
    initialCaseConferences: 0,
    reviewCaseConferences: 0,
    adultsInvited: 0,
    adultUptakePercent: undefined,
    advocatesInvited: 0,
    advocateUptakePercent: undefined,
    managedPlans: 0,
    newPlans: 0,
    ordersAppliedFor: { assessment: 0, removal: 0, banning: 0 },
    ordersGranted: { assessment: 0, removal: 0, banning: 0 },
    actionsWithoutPowers: {},
    actionsWithPowers: {},
    ageByGender: {},
    ethnicity: {},
    harmWithoutPowers: {},
    harmWithPowers: {},
    locationWithoutPowers: {},
    locationWithPowers: {},
    clientGroupWithoutPowers: {},
    clientGroupWithPowers: {},
    adultsWithChildCareResponsibilities: 0,
    adultsWithOtherCaringResponsibilities: 0,
    childPresentAtIncident: 0,
    lsisByServiceType: {},
    careHomeCsNumbers: [],
    supportServiceCsNumbers: [],
    nhsHospitalCodes: [],
  };
}
