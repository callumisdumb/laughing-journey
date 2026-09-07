import { expect, test, type Page } from '@playwright/test';
import { capture, expectNoAxeViolations, signInAs, waitForData } from './helpers';

const PHASE = 'simulator';

test.use({ viewport: { width: 1440, height: 900 } });

const toast = (page: Page) => page.getByLabel('Notifications');

/**
 * The source system simulator: the other side of the two-way connector.
 *
 * The assertions are the demo beat, in order. It looks like a different product and says it is
 * simulated. An episode written from the platform is already in its list. An episode created here
 * arrives in the platform's queue and opens a case when somebody accepts it. An episode edited here
 * produces a divergence on the platform's reconciliation screen, computed rather than described.
 */
test.describe('the source system simulator', () => {
  test('is reachable from the connectors screen and says what it is', async ({ page }) => {
    await signInAs(page, 'usr_moira_gilmour');
    await page.goto('/connectors?adapter=eclipse');
    await waitForData(page);

    await page.getByTestId('open-simulator').click();
    await waitForData(page);

    const sim = page.getByTestId('simulator');
    await expect(sim).toBeVisible();
    // It says it is simulated, in a colour and a place the rest of the screen does not use, because
    // a viewer must never mistake it for a real system.
    await expect(sim).toContainText('Simulated system');
    await expect(sim).toContainText('This is not a real product');
    // A neutral name. Putting a vendor's name here would be a claim.
    await expect(page.getByRole('heading', { name: 'Episode list' })).toBeVisible();
    await capture(page, { phase: PHASE, screen: 'simulator', fullPage: true });
    await expectNoAxeViolations(page);
  });

  test('already holds the episode the platform wrote out, with its own reference', async ({ page }) => {
    await signInAs(page, 'usr_moira_gilmour');
    await page.goto('/simulator');
    await waitForData(page);

    const row = page.getByTestId('sim-episode-ASP-2026-0217');
    await expect(row).toContainText('Marion Fraser');
    await expect(row).toContainText('From the platform');
  });

  test('an episode created here arrives in the platform and opens a case when accepted', async ({ page }) => {
    await signInAs(page, 'usr_moira_gilmour');
    await page.goto('/simulator');
    await waitForData(page);

    await page.getByTestId('simulator-new').click();
    await expect(page.getByTestId('simulator-create')).toBeVisible();
    await capture(page, { phase: PHASE, screen: 'simulator-new-episode', fullPage: true });

    await page.getByTestId('sim-create-per_aiden_boyle').click();
    await expect(page.getByText(/created and sent to the platform/)).toBeVisible();

    // Back to the platform, where it is a proposal rather than a case until somebody accepts it.
    await page.getByTestId('simulator-back').click();
    await waitForData(page);
    const inbound = page.getByText('BOYLE, Aiden').first();
    await expect(inbound).toBeVisible();

    const accept = page.getByTestId(/inbound-accept-/).first();
    await accept.click();
    await waitForData(page);
    await expect(toast(page).getByText('Case opened')).toBeVisible();
    await expect(page).toHaveURL(/\/processes\//);
  });

  test('an episode edited here shows as a divergence on the platform', async ({ page }) => {
    await signInAs(page, 'usr_moira_gilmour');
    await page.goto('/simulator');
    await waitForData(page);

    await page.getByTestId('sim-open-ASP-2026-0217').click();
    const record = page.getByTestId('simulator-record');
    await expect(record).toBeVisible();
    await page.getByTestId('sim-field-Episode.AllocatedWorker').fill('Fiona Sneddon, Portlennan');
    await page.getByTestId('simulator-save').click();
    await expect(page.getByText(/reconciliation screen/)).toBeVisible();
    await capture(page, { phase: PHASE, screen: 'simulator-record', fullPage: true });

    // Over on the platform, computed by the same function that would run against a live feed.
    await page.goto('/connectors?adapter=eclipse&tab=reconcile');
    await waitForData(page);
    const panel = page.getByTestId('reconcile-per_marion_fraser');
    await expect(panel).toContainText('Fiona Sneddon, Portlennan');
    await expect(panel).toContainText('Both sides have changed this');
  });

  test('resets to its starting state, which is what a second take needs', async ({ page }) => {
    await signInAs(page, 'usr_moira_gilmour');
    await page.goto('/simulator');
    await waitForData(page);
    await page.getByTestId('sim-open-ASP-2026-0217').click();
    await page.getByTestId('sim-field-Episode.Stage').fill('review');
    await page.getByTestId('simulator-save').click();

    await page.getByTestId('simulator-reset').click();
    await expect(page.getByText('Episode list reset')).toBeVisible();
    await expect(page.getByTestId('sim-episode-ASP-2026-0217')).toContainText('inquiry');
  });
});
