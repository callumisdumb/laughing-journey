import { expect, test } from '@playwright/test';
import { capture, expectNoAxeViolations, signInAs, waitForData } from './helpers';

const PHASE = 'network';

test.use({ viewport: { width: 1440, height: 900 } });

/**
 * Household and network, which are two different things, and the consequences of changing either.
 *
 * The household is people at an address with dates; the network is everyone else who matters. The
 * distinction is the whole point of Marion Fraser's case, where the nephew is network and not
 * household, and of Kayleigh Docherty's, where her children are both.
 *
 * The consequences are where this earns its place. Recording a relationship to a MARAC perpetrator
 * excludes somebody from that case without anybody typing the word exclusion, and ending one that an
 * exclusion rests on must never lift it silently.
 */
test.describe('household and network', () => {
  test('shows the household and the wider network as separate things', async ({ page }) => {
    await signInAs(page, 'usr_janet_kerr');
    await page.goto('/people/per_kayleigh_docherty');
    await waitForData(page);

    const household = page.getByTestId('household-members');
    const network = page.getByTestId('network-ties');
    await expect(household).toBeVisible();
    await expect(network).toBeVisible();

    // Her children are in the household; her mother is not.
    await expect(household).toContainText('Lily Docherty');
    await expect(household).toContainText('Mason Docherty');
    await expect(household).not.toContainText('Senga');
    await capture(page, { phase: PHASE, screen: 'household-and-network' });
    await expectNoAxeViolations(page);
  });

  test('the nephew is network and not household, which is the point of the case', async ({ page }) => {
    await signInAs(page, 'usr_moira_gilmour');
    await page.goto('/people/per_marion_fraser');
    await waitForData(page);

    await expect(page.getByTestId('network-ties')).toContainText('Callum');
    await expect(page.getByTestId('household-members')).not.toContainText('Callum');
  });

  test('recording a relationship to the perpetrator says who it excludes, before the save button', async ({ page }) => {
    await signInAs(page, 'usr_karen_findlay');
    await page.goto('/people/per_ryan_kerr');
    await waitForData(page);

    await page.getByTestId('network-add').click();
    const dialog = page.getByRole('dialog');
    await expect(dialog).toBeVisible();
    await expect(page.getByTestId('network-consequences')).toHaveCount(0);

    await page.getByTestId('network-other-query').fill('Marion');
    await page.getByTestId('network-other-results').getByRole('button').first().click();
    await dialog.getByLabel('What is the relationship?').selectOption('sibling-of');

    const consequences = page.getByTestId('network-consequences');
    await expect(consequences).toBeVisible();
    await expect(consequences).toContainText('will not receive information');
    await capture(page, { phase: PHASE, screen: 'relationship-consequences' });
    await expectNoAxeViolations(page);
  });

  test('a household change names the open cases it touches and offers to tell them', async ({ page }) => {
    await signInAs(page, 'usr_janet_kerr');
    await page.goto('/people/per_kayleigh_docherty');
    await waitForData(page);

    await page.getByTestId('household-add').click();
    await page.getByTestId('household-person-query').fill('Tomasz');
    await page.getByTestId('household-person-results').getByRole('button').first().click();

    const affected = page.getByTestId('household-affected');
    await expect(affected).toBeVisible();
    await expect(affected).toContainText('open case');
    await expect(page.getByTestId('household-notify')).toBeChecked();
    await capture(page, { phase: PHASE, screen: 'household-change' });

    await page.getByTestId('household-add-submit').click();
    await expect(page.getByRole('dialog')).toHaveCount(0);
    await expect(page.getByText('Household updated')).toBeVisible();
    await expect(page.getByTestId('household-members')).toContainText('Tomasz');
  });

  test('removing somebody sets a date and keeps them in the history', async ({ page }) => {
    await signInAs(page, 'usr_janet_kerr');
    await page.goto('/people/per_kayleigh_docherty');
    await waitForData(page);

    await page.getByTestId('household-end-per_lily_docherty').click();
    await page.getByTestId('household-end-reason').fill('Moved to her grandmother for the school term');
    await page.getByTestId('household-end-submit').click();

    await expect(page.getByRole('dialog')).toHaveCount(0);
    await expect(page.getByTestId('household-members')).not.toContainText('Lily Docherty');

    // Not deleted: who lived where and when is exactly what a chronology needs.
    await page.getByText('Previously in the household').click();
    await expect(page.getByText(/Lily Docherty/).first()).toBeVisible();
    await expect(page.getByText('Moved to her grandmother for the school term')).toBeVisible();
  });

  test('ending a relationship never lifts an exclusion silently', async ({ page }) => {
    await signInAs(page, 'usr_karen_findlay');
    await page.goto('/people/per_craig_kerr');
    await waitForData(page);

    await page.getByTestId('network-end-per_ryan_kerr').click();
    const dialog = page.getByRole('dialog');
    await expect(dialog).toBeVisible();
    await page.getByTestId('network-end-reason').fill('Brothers estranged since the sentencing in March.');
    await page.getByTestId('network-end-submit').click();

    // The exclusion is written on the register rather than derived, so nothing rests on it and the
    // ending goes through. The relationship is ended, not deleted.
    await expect(page.getByRole('dialog')).toHaveCount(0);
    await page.getByText('Ended relationships').click();
    await expect(page.getByTestId('network-ties')).not.toContainText('Ryan Kerr');
    await expect(page.getByText(/ended 0\d [A-Z]/).first()).toBeVisible();
  });
});
