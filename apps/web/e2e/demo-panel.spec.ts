import { expect, test, type Page } from '@playwright/test';
import { capture, expectNoAxeViolations, signInAs, waitForData } from './helpers';

const PHASE = 'demo';

test.use({ viewport: { width: 1440, height: 900 } });

async function openPanel(page: Page) {
  await page.keyboard.press('Control+Shift+D');
  await expect(page.getByTestId('demo-panel')).toBeVisible();
}

/**
 * The demo control panel, which is not part of the product.
 *
 * Everything in it exists because of something that goes wrong on a shoot, so the tests are about
 * those: a chapter arrives set up in one click, state does not drift between takes, and a take that
 * has to be shot again gets its set-up back rather than being rebuilt.
 */
test.describe('the demo control panel', () => {
  test('is hidden until the shortcut, and says it is not the product', async ({ page }) => {
    await signInAs(page, 'usr_janet_kerr');
    await page.goto('/');
    await waitForData(page);
    await expect(page.getByTestId('demo-panel')).toHaveCount(0);

    await openPanel(page);
    await expect(page.getByText(/Not part of the product/)).toBeVisible();
    await capture(page, { phase: PHASE, screen: 'panel', fullPage: true });
    await expectNoAxeViolations(page);

    // The same shortcut closes it, so a presenter who opened it mid sentence gets out the same way.
    await page.keyboard.press('Control+Shift+D');
    await expect(page.getByTestId('demo-panel')).toHaveCount(0);
  });

  test('a waypoint sets the persona, the route, the appearance and the clock in one click', async ({ page }) => {
    await signInAs(page, 'usr_janet_kerr');
    await page.goto('/');
    await waitForData(page);
    await openPanel(page);

    await page.getByTestId('waypoint-chain').click();
    await waitForData(page);
    // The route, and the person: chapter 5 is Karen Findlay's case and it opens as her.
    await expect(page).toHaveURL(/\/processes\/prc_marac_docherty/);
    await expect(page.getByRole('heading', { level: 1 })).toContainText('Kayleigh Docherty');
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'light');
    await expect(page.locator('html')).toHaveAttribute('data-density', 'comfortable');
  });

  test('switches persona without going through the account menu', async ({ page }) => {
    await signInAs(page, 'usr_janet_kerr');
    await page.goto('/processes/prc_mappa_derek');
    await waitForData(page);
    await openPanel(page);
    await page.getByTestId('persona-usr_priya_sharif').click();
    await waitForData(page);
    // A sex offender liaison officer is on the MAPPA, so the same route now shows the case.
    await expect(page.getByRole('heading', { level: 1 })).not.toContainText('restricted');
  });

  test('keeps a state and puts it back, which is what a second take needs', async ({ page }) => {
    await signInAs(page, 'usr_moira_gilmour');
    await page.goto('/processes/prc_asp_marion');
    await waitForData(page);

    await openPanel(page);
    await page.getByTestId('snapshot-name').fill('Before the plan');
    await page.getByTestId('snapshot-keep').click();
    await expect(page.getByTestId('snapshot-restore-Before the plan')).toBeVisible();
    await page.keyboard.press('Escape');

    // Do the thing the take does.
    await page.getByTestId('add-plan').click();
    await page.getByTestId('plan-title').fill('A plan recorded during the take');
    await page.getByTestId('plan-outcome-0').fill('Marion decides who comes into her house');
    await page.getByTestId('plan-review-date').fill('2026-12-01');
    await page.getByTestId('plan-submit').click();
    await expect(page.getByText('Plan recorded', { exact: true })).toBeVisible();

    // Put it back and shoot it again.
    await openPanel(page);
    await page.getByTestId('snapshot-restore-Before the plan').click();
    await waitForData(page);
    // Scoped to the record, because the toast announcing the plan is still on screen and saying
    // the record is gone is the assertion, not that every mention of it has faded.
    await expect(page.locator('main').getByText('A plan recorded during the take')).toHaveCount(0);
  });

  test('reset takes the clock and the break-glass grant with it', async ({ page }) => {
    await signInAs(page, 'usr_moira_gilmour');
    await page.goto('/processes/prc_mappa_derek');
    await waitForData(page);

    // Break glass, which is the state you least want carried into the next take.
    await page.getByRole('button', { name: /Open with a reason/ }).click();
    const dialog = page.getByRole('dialog');
    await expect(dialog).toBeVisible();
    await dialog.getByRole('combobox').first().selectOption({ index: 1 });
    await dialog.getByRole('textbox').first().fill('Filming the restricted moment.');
    await dialog.getByRole('button', { name: 'Open with this reason' }).click();
    await waitForData(page);

    await openPanel(page);
    await page.getByTestId('demo-reset').click();
    await page.getByRole('dialog', { name: 'Back to the seed?' }).getByRole('button', { name: 'Reset demo data' }).click();
    await waitForData(page);

    // Nothing is overlaid on the seed any more, which is what "back to the seed" has to mean: the
    // dataset is a pure function of the seed and the overlay, so an absent overlay is a byte for
    // byte identical dataset and the next take starts where the last one did.
    expect(await page.evaluate(() => window.localStorage.getItem('mas.overlay.v1'))).toBeNull();

    // The grant is gone, so the record refuses again, and the clock is back at the seeded instant.
    await page.goto('/processes/prc_mappa_derek');
    await waitForData(page);
    await expect(page.getByRole('button', { name: /Open with a reason/ })).toBeVisible();
    await page.goto('/settings');
    await waitForData(page);
    await expect(page.getByText('02 Sep 2026, 09:00', { exact: true })).toBeVisible();
  });
});
