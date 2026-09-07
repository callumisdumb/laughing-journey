import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { expect, test } from '@playwright/test';
import { capture, expectNoAxeViolations, signInAs, waitForData } from './helpers';

const PHASE = 'nmds';
const TEMPLATE = resolve(import.meta.dirname, '../../../docs/templates/ASP-data-workbook-2026-27.xlsx');

/**
 * The ASP data workbook return, end to end.
 *
 * The unit tests prove the cell map matches the template and the figures add up. What they cannot
 * prove is that the writer, running in a browser against the real published file, produces a workbook
 * with the figures in it and the formulas untouched. So this spec picks the template with the file
 * chooser, fills it, and reads the result back.
 */
test('previews the return, fills the published workbook and leaves the formulas alone', async ({ page }) => {
  await signInAs(page, 'usr_moira_gilmour');
  await page.goto('/reports/asp?nmds=1');
  await waitForData(page);
  await expect(page.getByRole('heading', { level: 1, name: 'ASP data workbook return' })).toBeVisible();

  // The preview names the sheet and cell for every figure, before any file exists.
  await expect(page.getByRole('heading', { level: 2, name: /Indicator 1: ASP referrals by source/ })).toBeVisible();
  await expect(page.getByRole('rowheader', { name: 'Police Scotland' })).toBeVisible();
  await expect(page.getByRole('heading', { level: 2, name: 'Consistency checks' })).toBeVisible();
  // Ethnicity is not held, so the check reads as not applicable rather than as a failure.
  await expect(page.getByRole('listitem').filter({ hasText: 'Ethnicity matches all inquiries' })).toContainText('Not applicable');
  await expectNoAxeViolations(page);
  await capture(page, { phase: PHASE, screen: 'nmds-return' });

  await page.setInputFiles('input[type="file"]', TEMPLATE);
  await expect(page.getByText('Workbook filled')).toBeVisible({ timeout: 30_000 });

  // Nothing may be refused: the map is written against this template, so a refusal here means the
  // two have drifted apart.
  await expect(page.getByText(/cells? (was|were) left alone/)).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Save the filled workbook' })).toBeEnabled();
  await capture(page, { phase: PHASE, screen: 'nmds-filled' });

  // Read the produced workbook back out of the page, so what is asserted is what a Lead Officer gets.
  const download = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Save the filled workbook' }).click();
  const file = await download;
  // Q1 2026-27 has no LSI, so the return names no service and is routine Official: no marking in
  // the file name. A quarter carrying a CS number would be prefixed OFFICIAL-SENSITIVE.
  expect(file.suggestedFilename()).toMatch(/^ASP-NMDS-2026-27-Q1-.*\.xlsx$/);
  const saved = await file.path();
  expect(readFileSync(saved).byteLength).toBeGreaterThan(100_000);
});

test('marks a return Official-Sensitive when it names a service under investigation', async ({ page }) => {
  await signInAs(page, 'usr_moira_gilmour');
  await page.goto('/reports/asp?nmds=1');
  await waitForData(page);
  // Q2 2026/27 carries the Whinbrae House Large Scale Investigation, so the return holds that
  // service's Care Inspectorate CS number. A return that names a provider under investigation is
  // Official-Sensitive under Annex 2, and the file name has to say so before anyone opens it.
  await page.getByLabel('Quarter').selectOption('q2');
  await expect(page.getByRole('cell', { name: 'CS2026099471' })).toBeVisible();

  await page.setInputFiles('input[type="file"]', TEMPLATE);
  await expect(page.getByText('Workbook filled')).toBeVisible({ timeout: 30_000 });
  const download = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Save the filled workbook' }).click();
  const file = await download;
  expect(file.suggestedFilename()).toMatch(/^OFFICIAL-SENSITIVE-ASP-NMDS-2026-27-Q2-/);
});
