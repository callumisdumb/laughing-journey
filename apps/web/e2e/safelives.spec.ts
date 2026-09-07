import { resolve } from 'node:path';
import { expect, test } from '@playwright/test';
import ExcelJS from 'exceljs';
import { capture, expectNoAxeViolations, signInAs, waitForData } from './helpers';

const PHASE = 'safelives';
const SCOTLAND = resolve(import.meta.dirname, '../../../docs/templates/New-Marac-data-template-Scotland-2025.xlsx');
const UK = resolve(import.meta.dirname, '../../../docs/templates/New-Marac-data-template-2025.xlsx');

/**
 * The SafeLives MARAC data return, end to end.
 *
 * The unit tests prove the column map matches the Scotland template and the figures add up. What they
 * cannot prove is that a coordinator who holds a meeting, opens the return and picks the template
 * from disk gets a file with that meeting on row 2, the date as a date, and the columns the product
 * does not hold left empty. So this spec holds Kayleigh Docherty's MARAC, fills the template through
 * the file chooser, and reads the download back with the library the platform will open it with.
 */
test('an empty quarter says so, and the UK template is refused by its headers', async ({ page }) => {
  await signInAs(page, 'usr_karen_findlay');
  await page.goto('/reports/marac?safelives=1');
  await waitForData(page);
  await expect(page.getByRole('heading', { level: 1, name: 'MARAC data template return' })).toBeVisible();
  await expect(page.getByTestId('safelives-meta')).toContainText('Clydeshore MARAC. 01 Jul 2026 to 30 Sep 2026: no MARAC meetings held.');
  await expect(page.getByText('No MARAC meetings were held in this quarter')).toBeVisible();
  await expect(page.getByTestId('safelives-choose')).toBeDisabled();
  // The eight columns the product leaves blank are named, with the reason, before any file exists.
  await expect(page.getByTestId('safelives-blank').getByRole('listitem')).toHaveCount(8);
  await expect(page.getByTestId('safelives-blank')).toContainText('V: LGBTQ+ community cases');
  await expectNoAxeViolations(page);
  await capture(page, { phase: PHASE, screen: 'safelives-empty' });
});

test('holds the MARAC, previews the row, refuses the UK template and fills the Scotland one', async ({ page }) => {
  await signInAs(page, 'usr_karen_findlay');

  // Karen hears Kayleigh's case from the meeting workspace, as the flows spec does.
  await page.goto('/meetings/mtg_docherty_marac');
  await waitForData(page);
  await page.getByTestId('hold-meeting').click();
  await expect(page.getByTestId('hold-route')).toContainText('Heard at MARAC');
  await page.getByTestId('outcome-shared-add').click();
  await page.getByTestId('outcome-shared-agency-0').selectOption('police');
  await page.getByTestId('outcome-shared-summary-0').fill('Second referral in the year; bail conditions in place since 24 August.');
  await page.getByTestId('outcome-risk-discussion').fill('High risk: repeat within the window, two children in the household, one present at the incident.');
  await page.getByTestId('hold-submit').click();
  await expect(page.getByText('Meeting closed').last()).toBeVisible();

  await page.goto('/reports/marac?safelives=1');
  await waitForData(page);
  await expect(page.getByTestId('safelives-meta')).toContainText('1 MARAC meeting held');
  const row = page.getByTestId('safelives-row-2');
  await expect(row.getByRole('heading', { level: 2 })).toContainText('Row 2:');
  await expect(row.getByRole('row').filter({ hasText: 'Cases discussed' })).toContainText('C2');
  await expect(row.getByRole('row').filter({ hasText: 'Number of repeat cases' })).toContainText('1');
  await expect(row.getByRole('row').filter({ hasText: 'Number of children in the household' })).toContainText('2');
  await expect(row.getByRole('row').filter({ hasText: 'Police case referrals' })).toContainText('1');
  await expect(row.getByRole('row').filter({ hasText: 'LGBTQ+ community cases' })).toContainText('Left blank');
  await expect(page.getByTestId('safelives-checks').getByRole('listitem')).toHaveCount(3);
  await expect(page.getByTestId('safelives-checks')).not.toContainText('Fails');
  await expectNoAxeViolations(page);
  await capture(page, { phase: PHASE, screen: 'safelives-return' });

  // The UK template is the wrong file, and the refusal names every header that differs.
  await page.setInputFiles('input[type="file"]', UK);
  await expect(page.getByText('14 headers did not match the Scotland template, so nothing was written.')).toBeVisible();
  await expect(page.getByText('H1: expected "IDAA case referrals", found "IDVA"')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Save the filled return' })).toBeDisabled();
  await capture(page, { phase: PHASE, screen: 'safelives-refused' });

  await page.setInputFiles('input[type="file"]', SCOTLAND);
  await expect(page.getByText('Return filled')).toBeVisible({ timeout: 30_000 });
  await expect(page.getByRole('button', { name: 'Save the filled return' })).toBeEnabled();
  const download = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Save the filled return' }).click();
  const file = await download;
  // Aggregate counts that name nobody: Official, so no marking in the file name.
  expect(file.suggestedFilename()).toBe('MARAC-SafeLives-return-Q2-2026-27-Clydeshore-MARAC.xlsx');

  // Read the file back: the meeting on row 2, the date a real date, the blanks blank.
  const book = new ExcelJS.Workbook();
  await book.xlsx.readFile(await file.path());
  const sheet = book.worksheets[0]!;
  expect(sheet.getCell('A1').text).toBe('MARAC Name');
  expect(sheet.getCell('AF1').text).toBe('Victims from any other ethnic group');
  expect(sheet.getCell('A2').value).toBe('Clydeshore MARAC');
  expect(sheet.getCell('B2').value).toBeInstanceOf(Date);
  expect(sheet.getCell('B2').numFmt).toBe('dd/mm/yyyy');
  expect(sheet.getCell('C2').value).toBe(1);
  expect(sheet.getCell('D2').value).toBe(1);
  expect(sheet.getCell('E2').value).toBe(2);
  expect(sheet.getCell('F2').value).toBe(1);
  expect(sheet.getCell('G2').value).toBe(1);
  expect(sheet.getCell('X2').value).toBe(0);
  expect(sheet.getCell('AA2').value).toBe(0);
  for (const blank of ['U2', 'V2', 'W2', 'AB2', 'AC2', 'AD2', 'AE2', 'AF2']) expect(sheet.getCell(blank).value ?? null).toBeNull();
  expect(sheet.getCell('A3').value ?? null).toBeNull();
});
