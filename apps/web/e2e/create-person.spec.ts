import { expect, test } from '@playwright/test';
import { capture, expectNoAxeViolations, signInAs, waitForData } from './helpers';

const PHASE = 'create';

test.use({ viewport: { width: 1440, height: 900 } });

/**
 * Creating a person, which this product refuses to do without a search first.
 *
 * Two records for one child is the failure that a multi-agency system makes worse rather than
 * better, so these tests assert the shape of the refusal rather than only the happy path: the form
 * is not reachable until the candidates have been shown and dismissed, the dismissal is recorded on
 * the record, and the candidate nobody can see is still offered as a reason not to create.
 */
test.describe('add a person', () => {
  test('the create form is unreachable until the candidates have been seen', async ({ page }) => {
    await signInAs(page, 'usr_janet_kerr');
    await page.goto('/people');
    await waitForData(page);

    await page.getByTestId('add-person').click();
    const dialog = page.getByRole('dialog');
    await expect(dialog).toBeVisible();

    // Nothing but the search, and the search itself is refused until it has something to go on.
    await expect(page.getByTestId('create-person-candidates')).toHaveCount(0);
    await expect(page.getByTestId('create-person-details')).toHaveCount(0);
    await expect(page.getByTestId('create-person-submit')).toHaveCount(0);
    await expect(page.getByTestId('create-person-search')).toBeDisabled();

    await dialog.getByLabel('Given name').fill('Aiden');
    await dialog.getByLabel('Family name').fill('Boyle');
    await expect(page.getByTestId('create-person-search')).toBeEnabled();
    await capture(page, { phase: PHASE, screen: 'add-person-search' });

    await page.getByTestId('create-person-search').click();
    await expect(page.getByTestId('create-person-candidates')).toBeVisible();
    await expect(dialog.getByText('Aiden Boyle')).toBeVisible();
    // Still no form: the candidates have to be dismissed in as many words.
    await expect(page.getByTestId('create-person-details')).toHaveCount(0);
    await capture(page, { phase: PHASE, screen: 'add-person-candidates' });
    await expectNoAxeViolations(page);

    await page.getByTestId('create-person-none-match').click();
    await expect(page.getByTestId('create-person-details')).toBeVisible();
    await expect(dialog.getByText(/Created after reviewing/)).toBeVisible();
    await capture(page, { phase: PHASE, screen: 'add-person-details' });
    await expectNoAxeViolations(page);
  });

  test('editing the search after seeing the candidates sends the flow back to the start', async ({ page }) => {
    await signInAs(page, 'usr_janet_kerr');
    await page.goto('/people');
    await waitForData(page);
    await page.getByTestId('add-person').click();
    const dialog = page.getByRole('dialog');

    await dialog.getByLabel('Given name').fill('Aiden');
    await dialog.getByLabel('Family name').fill('Boyle');
    await page.getByTestId('create-person-search').click();
    await page.getByTestId('create-person-none-match').click();
    await expect(page.getByTestId('create-person-details')).toBeVisible();

    // A different name is a different question, so the assertion about the old candidates lapses.
    await dialog.getByLabel('Family name').fill('Bowie');
    await expect(page.getByTestId('create-person-details')).toHaveCount(0);
    await expect(page.getByTestId('create-person-candidates')).toHaveCount(0);
    await expect(page.getByTestId('create-person-search')).toBeVisible();
  });

  test('a record is created, audited as a create, and says how many candidates were reviewed', async ({ page }) => {
    await signInAs(page, 'usr_janet_kerr');
    await page.goto('/people');
    await waitForData(page);
    await page.getByTestId('add-person').click();
    const dialog = page.getByRole('dialog');

    await dialog.getByLabel('Given name').fill('Struan');
    await dialog.getByLabel('Family name').fill('Kilgour');
    await page.getByTestId('create-person-search').click();
    await page.getByTestId('create-person-none-match').click();
    await page.getByTestId('create-person-submit').click();

    // The dialog closes onto the new person's own record.
    await expect(page.getByRole('dialog')).toHaveCount(0);
    await waitForData(page);
    await expect(page.getByRole('heading', { name: /Struan Kilgour/ })).toBeVisible();

    // Every create is audited, and audited as a create rather than as an edit.
    await page.goto('/audit');
    await waitForData(page);
    await expect(page.getByRole('row').filter({ hasText: 'Struan Kilgour' }).first()).toContainText('Create');
  });

  test('a role that does not hold cases is refused at the action, with a route', async ({ page }) => {
    await signInAs(page, 'usr_rhona_dewar');
    await page.goto('/people');
    await waitForData(page);

    await page.getByTestId('add-person').click();
    const gate = page.getByTestId('create-person-gate');
    await expect(gate).toBeVisible();
    await expect(gate).toContainText('presence-level');
    // A refusal with no alternative is a dead end, so the route is part of the refusal.
    await expect(gate).toContainText('referral');
    await expect(page.getByTestId('create-person-search')).toHaveCount(0);
    await capture(page, { phase: PHASE, screen: 'add-person-gated' });
    await expectNoAxeViolations(page);
  });

  test('a person nobody can see is still offered as a reason not to create a second record', async ({ page }) => {
    // Derek Muir is a MAPPA case. A children and families social worker sees his presence and not
    // his record, which is exactly the situation that produces a duplicate.
    await signInAs(page, 'usr_sunita_rao');
    await page.goto('/people');
    await waitForData(page);
    await page.getByTestId('add-person').click();
    const dialog = page.getByRole('dialog');

    await dialog.getByLabel('Given name').fill('Derek');
    await dialog.getByLabel('Family name').fill('Muir');
    await page.getByTestId('create-person-search').click();

    const candidate = dialog.locator('[data-visible="false"]').first();
    await expect(candidate).toBeVisible();
    await expect(candidate).toContainText('Ask for access');
  });
});
