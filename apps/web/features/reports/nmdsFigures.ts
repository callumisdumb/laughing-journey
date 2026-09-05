/**
 * The ASP National Minimum Dataset figures for one quarter of 2026-27.
 *
 * Counting is kept apart from placing. `nmdsCellMap` in the domain package says which cell a figure
 * goes in; this module says what the figure is. The split is deliberate: a wrong count and a wrong
 * cell are different bugs, and a return where both are wrong at once is the hardest to spot.
 *
 * Every count is over one quarter of the 2026-27 financial year, keyed on the date the workbook says
 * to count from. That is not the same date for every indicator, and the guidance is explicit about
 * it: referrals count from receipt, inquiries from the trigger point of the inquiry, and case
 * conferences from the date they were held. Each counter below names the date it uses.
 */
import {
  aspAgeBandOf,
  ageAt,
  emptyNmdsFigures,
  localDateOf,
  type AspAgeBand,
  type AspGender,
  type AspProcess,
  type Dataset,
  type NmdsFigures,
  type NmdsQuarter,
} from '@mas/domain';
import { parseISO } from 'date-fns';

/** The four quarters of 2026-27, as closed ranges of ISO calendar dates. */
export const NMDS_QUARTER_RANGES: Record<NmdsQuarter, { from: string; to: string; due: string }> = {
  q1: { from: '2026-04-01', to: '2026-06-30', due: '2026-08-14' },
  q2: { from: '2026-07-01', to: '2026-09-30', due: '2026-11-13' },
  q3: { from: '2026-10-01', to: '2026-12-31', due: '2027-02-12' },
  q4: { from: '2027-01-01', to: '2027-03-31', due: '2027-05-14' },
};

function within(isoValue: string | undefined, quarter: NmdsQuarter): boolean {
  if (!isoValue) return false;
  const day = localDateOf(isoValue);
  const range = NMDS_QUARTER_RANGES[quarter];
  return day >= range.from && day <= range.to;
}

/** Add one to a keyed tally, creating the key on first sight. */
function tally<T extends string>(counts: Partial<Record<T, number>>, key: T | undefined): void {
  if (key === undefined) return;
  counts[key] = (counts[key] ?? 0) + 1;
}

/**
 * The trigger point of an inquiry, which is what decides the quarter it is counted in. The stage
 * history is the record of when the inquiry began; where it is missing, the concern's receipt is the
 * best available stand-in and is at worst a quarter early.
 */
function inquiryTriggeredAt(p: AspProcess): string {
  return p.stageHistory.find((s) => s.stage === 'inquiry')?.at ?? p.detail.concern.receivedAt;
}

/** True where the inquiry used any of the section 7 to 10 investigatory powers. */
function usedPowers(p: AspProcess): boolean {
  const investigation = p.detail.investigation;
  if (!investigation) return false;
  return investigation.visits.length > 0 || investigation.interviews.length > 0 || investigation.medicalExamination !== undefined || investigation.recordsRequests.length > 0;
}

/** A whole-number percentage, or undefined where the denominator is nought. */
function percent(part: number, whole: number): number | undefined {
  return whole === 0 ? undefined : Math.round((part / whole) * 100);
}

/**
 * Count a quarter's return from the dataset.
 *
 * Ethnicity is left at nought throughout. The dataset holds no ethnicity by design (brief section 9),
 * and the return has no "not held" row on that sheet, so the export's validation says so in a caveat
 * rather than the figures implying every adult declined to answer.
 */
export function nmdsFigures(data: Dataset, quarter: NmdsQuarter, now: Date): NmdsFigures {
  const figures = emptyNmdsFigures();
  const asp = data.processes.filter((p): p is AspProcess => p.type === 'asp');

  // Indicator 1: referrals, counted from the date the concern was received.
  for (const p of asp) {
    if (within(p.detail.concern.receivedAt, quarter)) tally(figures.referralsBySource, p.detail.concern.referralSource);
  }

  // Indicators 2 and 3, and with them 10, 11, 15, 16 and 17, which are all split the same way.
  const inquiries = asp.filter((p) => p.detail.inquiry !== undefined && within(inquiryTriggeredAt(p), quarter));
  for (const p of inquiries) {
    const powers = usedPowers(p);
    if (powers) figures.inquiriesWithPowers += 1;
    else figures.inquiriesWithoutPowers += 1;
    tally(powers ? figures.actionsWithPowers : figures.actionsWithoutPowers, p.detail.inquiry?.action ?? 'pending-unknown');
    tally(powers ? figures.harmWithPowers : figures.harmWithoutPowers, p.detail.concern.primaryHarmType ?? p.detail.concern.harmTypes[0]);
    tally(powers ? figures.locationWithPowers : figures.locationWithoutPowers, p.detail.concern.locationOfHarm);
    tally(powers ? figures.clientGroupWithPowers : figures.clientGroupWithoutPowers, p.detail.concern.primaryClientGroup);
  }

  // Indicator 13: age crossed with gender, for all inquiries. The record holds sex, so only the two
  // sexes it holds are counted; trans or non-binary and prefer not to say stay at nought and the
  // caveat says the question is not asked. Reporting a nought there would claim it was.
  for (const p of inquiries) {
    const person = data.people.find((x) => x.id === p.subjectIds[0]);
    const band: AspAgeBand = aspAgeBandOf(person?.dateOfBirth ? ageAt(person.dateOfBirth, now) : undefined);
    const gender: AspGender | undefined = person?.sex === 'male' ? 'male' : person?.sex === 'female' ? 'female' : undefined;
    if (!gender) continue;
    const row = (figures.ageByGender[band] ??= {});
    row[gender] = (row[gender] ?? 0) + 1;
  }

  // Indicator 4: case conferences held in the quarter.
  const conferences = data.meetings.filter((m) => (m.type === 'asp-case-conference' || m.type === 'asp-review-conference') && m.status === 'held' && within(m.scheduledAt, quarter));
  figures.initialCaseConferences = conferences.filter((m) => m.type === 'asp-case-conference').length;
  figures.reviewCaseConferences = conferences.filter((m) => m.type === 'asp-review-conference').length;

  // Indicators 5 and 6: invitations and their uptake.
  figures.adultsInvited = conferences.filter((m) => m.aspAttendance?.adultInvited).length;
  figures.adultUptakePercent = percent(conferences.filter((m) => m.aspAttendance?.adultAttended).length, figures.adultsInvited);
  figures.advocatesInvited = conferences.filter((m) => m.aspAttendance?.advocateInvited).length;
  figures.advocateUptakePercent = percent(conferences.filter((m) => m.aspAttendance?.advocateAttended).length, figures.advocatesInvited);

  // Indicator 8: plans open at the end of the quarter, and plans that began within it. A plan
  // revised at a review conference is not a new plan, which is why the second reads the start date.
  // A plan is dated by the day it was agreed, and "managed" means still open at the quarter's end,
  // which the workbook defines as no longer having ASP oversight of support actions.
  const aspProcessIds = new Set(asp.map((p) => p.id));
  const plans = data.plans.filter((plan) => aspProcessIds.has(plan.processId) && plan.type === 'adult-protection');
  const quarterEnd = NMDS_QUARTER_RANGES[quarter].to;
  figures.managedPlans = plans.filter((plan) => plan.agreedAt <= quarterEnd && plan.status !== 'ended').length;
  figures.newPlans = plans.filter((plan) => within(plan.agreedAt, quarter)).length;

  // Indicator 9: protection orders applied for and granted in the quarter.
  // The order record carries no date of its own, so an order is counted in the quarter its inquiry
  // was triggered in. The workbook wants the quarter the application was made in; where a case runs
  // across a quarter boundary this can be a quarter early, which the caveat says.
  const orders = asp.filter((p) => within(inquiryTriggeredAt(p), quarter)).flatMap((p) => p.detail.ordersConsidered);
  const byType = (order: string) => orders.filter((o) => o.order === order);
  figures.ordersAppliedFor = {
    assessment: byType('assessment-order-s11').filter((o) => o.decision === 'applied' || o.decision === 'granted' || o.decision === 'refused').length,
    removal: byType('removal-order-s14').filter((o) => o.decision === 'applied' || o.decision === 'granted' || o.decision === 'refused').length,
    banning: byType('banning-order-s19').filter((o) => o.decision === 'applied' || o.decision === 'granted' || o.decision === 'refused').length,
  };
  figures.ordersGranted = {
    assessment: byType('assessment-order-s11').filter((o) => o.decision === 'granted').length,
    removal: byType('removal-order-s14').filter((o) => o.decision === 'granted').length,
    banning: byType('banning-order-s19').filter((o) => o.decision === 'granted').length,
  };

  // Indicator 18: caring responsibilities and children present. The record carries neither as a
  // field, so these stay at nought and the caveat names them: see nmdsValidation.
  figures.adultsWithChildCareResponsibilities = 0;
  figures.adultsWithOtherCaringResponsibilities = 0;
  figures.childPresentAtIncident = 0;

  // Indicator 19: LSIs commenced in the quarter, and the identifiers for each.
  const lsis = asp.filter((p) => p.detail.lsi && within(inquiryTriggeredAt(p), quarter));
  for (const p of lsis) {
    tally(figures.lsisByServiceType, p.detail.lsi?.serviceType);
    const lsi = p.detail.lsi;
    if (!lsi?.careInspectorateCsNumber) continue;
    if (lsi.serviceType === 'care-home') figures.careHomeCsNumbers.push(lsi.careInspectorateCsNumber);
    else if (lsi.serviceType === 'support-services') figures.supportServiceCsNumbers.push(lsi.careInspectorateCsNumber);
  }
  for (const p of lsis) {
    const code = p.detail.lsi?.nhsHospitalLocationCode;
    if (code) figures.nhsHospitalCodes.push(code);
  }

  return figures;
}

/** The quarter a date falls in, or undefined where it is outside 2026-27. */
export function nmdsQuarterOf(isoValue: string): NmdsQuarter | undefined {
  const day = localDateOf(isoValue);
  for (const [key, range] of Object.entries(NMDS_QUARTER_RANGES)) {
    if (day >= range.from && day <= range.to) return key as NmdsQuarter;
  }
  return undefined;
}

/** How many days remain before a quarter's submission deadline, negative once it has passed. */
export function daysToDeadline(quarter: NmdsQuarter, now: Date): number {
  const due = parseISO(NMDS_QUARTER_RANGES[quarter].due);
  return Math.round((due.getTime() - parseISO(localDateOf(now.toISOString())).getTime()) / 86_400_000);
}
