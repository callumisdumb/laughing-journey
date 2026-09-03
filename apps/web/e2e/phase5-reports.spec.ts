import { expect, test } from '@playwright/test';
import { capture, expectNoAxeViolations, setAppearance, signInAs, waitForData } from './helpers';

const PHASE = 'phase-5';

const TO_VERIFY = 'Field set to verify against the current template';

const REPORTS = [
  { kind: 'asp', title: 'ASP biennial report figures', user: 'usr_moira_gilmour', chart: /Referrals by quarter and source agency/, fieldSet: TO_VERIFY },
  { kind: 'cp', title: 'Child Protection Register statistics', user: 'usr_janet_kerr', chart: /Registrations and de-registrations by month/, fieldSet: TO_VERIFY },
  { kind: 'marac', title: 'MARAC SafeLives return', user: 'usr_karen_findlay', chart: /Referrals by agency/, fieldSet: TO_VERIFY },
  { kind: 'mappa', title: 'MAPPA annual report counts', user: 'usr_priya_sharif', chart: /Offenders by level and category/, fieldSet: 'Field set High: Annex 3 Tables 1 to 9' },
  { kind: 'awi', title: 'AWI application timeliness', user: 'usr_graeme_dunlop', chart: /Applications by route and applicant/, fieldSet: TO_VERIFY },
] as const;

test.describe('reports', () => {
  test('index lists the five reports with purpose, audience and period', async ({ page }) => {
    await signInAs(page, 'usr_janet_kerr');
    await page.goto('/reports');
    await waitForData(page);
    await expect(page.getByRole('heading', { name: 'Reports', exact: true })).toBeVisible();
    for (const r of REPORTS) await expect(page.getByRole('link', { name: `Open ${r.title}` })).toBeVisible();
    await expectNoAxeViolations(page);
    await capture(page, { phase: PHASE, screen: 'reports', fullPage: true });
  });

  for (const r of REPORTS) {
    test(`${r.title}: heading, chart, data table and print pack button`, async ({ page }) => {
      await signInAs(page, r.user);
      await page.goto(`/reports/${r.kind}`);
      await waitForData(page);
      await expect(page.getByRole('heading', { name: r.title, exact: true })).toBeVisible();
      await expect(page.getByRole('img', { name: r.chart }).first()).toBeVisible();
      await expect(page.getByRole('region', { name: /^Data for / }).first()).toBeVisible();
      await expect(page.getByRole('button', { name: 'Print pack' })).toBeVisible();
      await expect(page.getByText(r.fieldSet)).toBeVisible();
      await expectNoAxeViolations(page);
      await capture(page, { phase: PHASE, screen: `report-${r.kind}`, fullPage: true });
    });
  }

  test('ASP figures for the biennium in progress, where the demo activity sits', async ({ page }) => {
    await signInAs(page, 'usr_moira_gilmour');
    await page.goto('/reports/asp');
    await waitForData(page);
    await expect(page.getByRole('status').filter({ hasText: 'period in progress' })).toBeVisible();
    await page.getByLabel('Reporting period').selectOption({ index: 0 });
    await expect(page.getByLabel('Reporting period')).toHaveValue(/^b\d{4}$/);
    await expect(page.getByRole('img', { name: /Referrals by quarter and source agency/ })).toBeVisible();
    await expectNoAxeViolations(page);
    await capture(page, { phase: PHASE, screen: 'report-asp-current', fullPage: true });
  });

  test('MAPPA report carries Annex 3 Tables 1 to 9 with no names, Table 8 as data not held, and the review interval caveat', async ({ page }) => {
    await signInAs(page, 'usr_priya_sharif');
    await page.goto('/reports/mappa?period=y2027');
    await waitForData(page);
    await expect(page.getByText('Counts only, never names.')).toBeVisible();
    await expect(page.getByLabel('Reporting period')).toHaveValue('y2027');
    for (const n of [1, 2, 3, 4, 5, 6, 7, 8, 9]) await expect(page.getByRole('heading', { name: new RegExp(`^Table ${n}:`) })).toBeVisible();
    await expect(page.getByRole('img', { name: /Offenders by level and category/ })).toHaveCount(1);
    await expect(page.getByRole('region', { name: /^Table 8:/ }).getByText('Data not held')).toHaveCount(3);
    await expect(page.getByRole('region', { name: /^Table 2:/ }).getByRole('row', { name: /Sexual Harm Prevention Orders \(SHPOs\) in force/ })).toContainText('1');
    await expect(page.getByText(/Review interval to verify against the current MAPPA National Guidance/).first()).toBeVisible();
    await expect(page.getByText('Derek Muir')).toHaveCount(0);
    await expect(page.getByText('Ardvale Sheriff Court')).toHaveCount(0);
    await expectNoAxeViolations(page);
    await capture(page, { phase: PHASE, screen: 'report-mappa-annex3', fullPage: true });
  });

  test('MARAC population changes the rate per 10,000', async ({ page }) => {
    await signInAs(page, 'usr_karen_findlay');
    await page.goto('/reports/marac?pop=20500');
    await waitForData(page);
    await expect(page.getByLabel('Adult female population (fictional)')).toHaveValue('20500');
    await expect(page.getByText(/population 20,500, fictional/)).toBeVisible();
    await setAppearance(page, 'light', 'compact');
    await capture(page, { phase: PHASE, screen: 'report-marac', density: 'compact', fullPage: true });
  });

  test('CP register in dark theme', async ({ page }) => {
    await signInAs(page, 'usr_janet_kerr');
    await page.goto('/reports/cp');
    await waitForData(page);
    await setAppearance(page, 'dark', 'comfortable');
    await expect(page.getByRole('img', { name: /Children on the register at each month end/ })).toBeVisible();
    await capture(page, { phase: PHASE, screen: 'report-cp', theme: 'dark', fullPage: true });
  });

  test('CP print pack carries the classification marking and paginates', async ({ page }) => {
    await signInAs(page, 'usr_janet_kerr');
    await page.goto('/reports/cp?print=1');
    await waitForData(page);
    await expect(page.getByRole('note', { name: /Classification/ })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Child Protection Register statistics', exact: true })).toBeVisible();
    await expect(page.getByText(/Page 1 of/)).toBeVisible();
    await expect(page.getByRole('button', { name: 'Print', exact: true })).toBeVisible();
    await page.emulateMedia({ media: 'print' });
    await capture(page, { phase: PHASE, screen: 'report-cp-print', fullPage: true });
    await page.emulateMedia({ media: 'screen' });
    await page.getByRole('button', { name: 'Back to the report' }).click();
    await expect(page.getByRole('button', { name: 'Print pack' })).toBeVisible();
  });
});
