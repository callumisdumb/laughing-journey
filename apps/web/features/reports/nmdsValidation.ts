/**
 * The consistency checks and caveats the ASP data workbook asks a Lead Officer to make before
 * submitting a return.
 *
 * The workbook carries its own "check" rows on several sheets: age and gender must match the number
 * of inquiries, ethnicity must match, type of harm must match, location and client group must match.
 * A return that fails one of them is not rejected by the spreadsheet; it goes to Scottish Ministers
 * looking complete and disagreeing with itself. So the export runs every one of them before the file
 * is written, and shows them.
 *
 * It also writes the caveat lines, because the "REFLECTIONS AND CAVEATS" box on each sheet is the
 * only place a return can say what it could not count. The product knows exactly what it cannot
 * count, so it says so in words rather than leaving a Lead Officer to remember: leaving the box
 * blank is what makes a nought look like a measurement.
 */
import { ASP_ETHNICITIES, type NmdsFigures, type NmdsQuarter } from '@mas/domain';
import { t } from '@mas/messages';
import { NMDS_QUARTER_RANGES } from './nmdsFigures';

export type CheckState = 'pass' | 'fail' | 'not-applicable';

export interface NmdsCheck {
  id: string;
  label: string;
  state: CheckState;
  /** What the two sides came to, so a failure names the gap rather than only reporting one. */
  detail: string;
}

function sum(counts: Partial<Record<string, number>>): number {
  return Object.values(counts).reduce<number>((total, value) => total + (value ?? 0), 0);
}

function check(id: string, label: string, counted: number, expected: number): NmdsCheck {
  return {
    id,
    label,
    state: counted === expected ? 'pass' : 'fail',
    detail: t('reports.nmds.checks.detail', { counted, expected }),
  };
}

/**
 * Every consistency check the workbook prints, in sheet order. Each compares a breakdown against the
 * inquiry count it is meant to break down.
 */
export function nmdsChecks(figures: NmdsFigures): NmdsCheck[] {
  const withoutPowers = figures.inquiriesWithoutPowers;
  const withPowers = figures.inquiriesWithPowers;
  const allInquiries = withoutPowers + withPowers;
  const ethnicityTotal = sum(figures.ethnicity);
  const ageTotal = Object.values(figures.ageByGender).reduce<number>((total, row) => total + sum(row ?? {}), 0);

  return [
    check('actions-without', t('reports.nmds.checks.actionsWithout'), sum(figures.actionsWithoutPowers), withoutPowers),
    check('actions-with', t('reports.nmds.checks.actionsWith'), sum(figures.actionsWithPowers), withPowers),
    check('age-gender', t('reports.nmds.checks.ageGender'), ageTotal, allInquiries),
    // Ethnicity is not held at all, so the check is reported as not applicable rather than failed:
    // a failure implies a counting error, and this is a deliberate gap the caveat explains.
    {
      id: 'ethnicity',
      label: t('reports.nmds.checks.ethnicity'),
      state: ethnicityTotal === 0 ? 'not-applicable' : ethnicityTotal === allInquiries ? 'pass' : 'fail',
      detail: ethnicityTotal === 0 ? t('reports.nmds.checks.ethnicityNotHeld') : t('reports.nmds.checks.detail', { counted: ethnicityTotal, expected: allInquiries }),
    },
    check('harm-without', t('reports.nmds.checks.harmWithout'), sum(figures.harmWithoutPowers), withoutPowers),
    check('harm-with', t('reports.nmds.checks.harmWith'), sum(figures.harmWithPowers), withPowers),
    check('location-without', t('reports.nmds.checks.locationWithout'), sum(figures.locationWithoutPowers), withoutPowers),
    check('location-with', t('reports.nmds.checks.locationWith'), sum(figures.locationWithPowers), withPowers),
    check('client-group-without', t('reports.nmds.checks.clientGroupWithout'), sum(figures.clientGroupWithoutPowers), withoutPowers),
    check('client-group-with', t('reports.nmds.checks.clientGroupWith'), sum(figures.clientGroupWithPowers), withPowers),
  ];
}

/**
 * The caveat lines for the return's "REFLECTIONS AND CAVEATS" boxes, generated from what the product
 * knows it cannot count. Each names a sheet, so a Lead Officer can paste it where it belongs.
 */
export function nmdsCaveats(figures: NmdsFigures, quarter: NmdsQuarter): Array<{ sheet: string; text: string }> {
  const lines: Array<{ sheet: string; text: string }> = [];
  const range = NMDS_QUARTER_RANGES[quarter];

  lines.push({ sheet: t('reports.nmds.sheets.all'), text: t('reports.nmds.caveats.synthetic', { from: range.from, to: range.to }) });

  if (sum(figures.ethnicity) === 0) {
    lines.push({ sheet: t('reports.nmds.sheets.ethnicity'), text: t('reports.nmds.caveats.ethnicity', { count: ASP_ETHNICITIES.length }) });
  }

  const genderGaps = Object.values(figures.ageByGender).some((row) => (row?.['trans-or-non-binary'] ?? 0) > 0 || (row?.['prefer-not-to-say'] ?? 0) > 0);
  if (!genderGaps) {
    lines.push({ sheet: t('reports.nmds.sheets.ageAndGender'), text: t('reports.nmds.caveats.gender') });
  }

  if (figures.adultsWithChildCareResponsibilities === 0 && figures.adultsWithOtherCaringResponsibilities === 0 && figures.childPresentAtIncident === 0) {
    lines.push({ sheet: t('reports.nmds.sheets.caring'), text: t('reports.nmds.caveats.caring') });
  }

  const anyOrders = Object.values(figures.ordersAppliedFor).some((n) => n > 0) || Object.values(figures.ordersGranted).some((n) => n > 0);
  if (anyOrders) {
    lines.push({ sheet: t('reports.nmds.sheets.plansAndPowers'), text: t('reports.nmds.caveats.orderDates') });
  }

  if (figures.adultUptakePercent === undefined || figures.advocateUptakePercent === undefined) {
    lines.push({ sheet: t('reports.nmds.sheets.attendees'), text: t('reports.nmds.caveats.uptake') });
  }

  return lines;
}
