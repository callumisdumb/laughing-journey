import { expect, test } from '@playwright/test';
import { capture, expectNoAxeViolations, signInAs, waitForData } from './helpers';

const PHASE = 'classification';

/**
 * Government Security Classification, Annex 2 of the MAPPA National Guidance.
 *
 * Two things are asserted here that a unit test cannot reach: that a marked state passes axe in
 * both themes, and that an Official record shows no marking on a real page. The unit tests in
 * packages/ui cover the artefact-by-artefact rule table.
 */
const THEMES: Array<'light' | 'dark'> = ['light', 'dark'];

for (const theme of THEMES) {
  test(`${theme} theme: a restricted process carries the marking`, async ({ page }) => {
    await signInAs(page, 'usr_priya_sharif');
    await page.addInitScript((t) => {
      window.localStorage.setItem('mas.appearance', JSON.stringify({ theme: t, density: 'comfortable' }));
    }, theme);
    await page.goto('/processes/prc_mappa_derek');
    await waitForData(page);
    await expect(page.getByRole('heading', { level: 1, name: 'MAPPA: Derek Muir' })).toBeVisible();
    await expect(page.getByText('OFFICIAL-SENSITIVE', { exact: false }).first()).toBeVisible();
    await expectNoAxeViolations(page);
    await capture(page, { phase: PHASE, screen: 'process-marked', theme });
  });

  test(`${theme} theme: the classification dialog`, async ({ page }) => {
    await signInAs(page, 'usr_priya_sharif');
    await page.addInitScript((t) => {
      window.localStorage.setItem('mas.appearance', JSON.stringify({ theme: t, density: 'comfortable' }));
    }, theme);
    await page.goto('/processes/prc_mappa_derek');
    await waitForData(page);
    await page.getByRole('button', { name: 'Change classification' }).click();
    await expect(page.getByRole('dialog')).toBeVisible();
    await expectNoAxeViolations(page);
    await capture(page, { phase: PHASE, screen: 'classification-dialog', theme });
  });

  test(`${theme} theme: the Admin rule table`, async ({ page }) => {
    await signInAs(page, 'usr_janet_kerr');
    await page.addInitScript((t) => {
      window.localStorage.setItem('mas.appearance', JSON.stringify({ theme: t, density: 'comfortable' }));
    }, theme);
    await page.goto('/admin/markings');
    await waitForData(page);
    await expect(page.getByRole('heading', { level: 2, name: 'How a classification is derived' })).toBeVisible();
    await expect(page.getByRole('rowheader', { name: /Routine Official information/ })).toBeVisible();
    await expectNoAxeViolations(page);
    await capture(page, { phase: PHASE, screen: 'admin-markings', theme });
  });
}

test('an aggregate report is Official and carries no marking', async ({ page }) => {
  await signInAs(page, 'usr_janet_kerr');
  await page.goto('/reports/cp?print=1');
  await waitForData(page);
  // Annex 2 paragraph 5: there is no requirement to mark routine Official information, and a report
  // of aggregate counts names no one. The running head shows the title, not a marking.
  await expect(page.locator('.print-pack')).toBeVisible();
  await expect(page.getByText('OFFICIAL-SENSITIVE')).toHaveCount(0);
  await capture(page, { phase: PHASE, screen: 'report-unmarked' });
});
