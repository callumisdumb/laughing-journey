import { expect, test } from '@playwright/test';
import { capture, expectNoAxeViolations, signInAs, waitForData } from './helpers';

const PHASE = 'create';

test.use({ viewport: { width: 1440, height: 900 } });

/**
 * Merging two person records, and taking it back.
 *
 * Both halves are tested because both matter. A merge that does not really move the case is a
 * cosmetic fix for the failure this product exists to prevent, and a merge that cannot be taken back
 * turns one duplicate into two children conflated, which is worse.
 */
test.describe('merge and unmerge', () => {
  test('shows what the merge will do before the button that does it', async ({ page }) => {
    await signInAs(page, 'usr_janet_kerr');
    await page.goto('/people/per_aiden_boyle');
    await waitForData(page);

    await page.getByTestId('merge-open').click();
    const dialog = page.getByRole('dialog');
    await expect(dialog).toBeVisible();

    // Nothing to confirm until a record has been chosen.
    await expect(page.getByTestId('merge-submit')).toBeDisabled();
    await expect(page.getByTestId('merge-consequences')).toHaveCount(0);

    await page.getByTestId('merge-other-query').fill('Maisie');
    await page.getByTestId('merge-other-results').getByRole('button').first().click();

    // The comparison and the consequences, both computed rather than described.
    await expect(page.getByTestId('merge-consequences')).toBeVisible();
    await expect(page.getByTestId('merge-consequences')).toContainText('references move to');
    await expect(page.getByTestId('merge-consequences')).toContainText('Reversible');
    await expect(dialog.getByRole('table')).toBeVisible();
    await capture(page, { phase: PHASE, screen: 'merge' });
    await expectNoAxeViolations(page);
  });

  test('refuses a merge with no reason on it', async ({ page }) => {
    await signInAs(page, 'usr_janet_kerr');
    await page.goto('/people/per_aiden_boyle');
    await waitForData(page);
    await page.getByTestId('merge-open').click();
    await page.getByTestId('merge-other-query').fill('Maisie');
    await page.getByTestId('merge-other-results').getByRole('button').first().click();
    await page.getByTestId('merge-submit').click();

    await expect(page.getByRole('dialog').getByRole('alert')).toContainText('same person');
    await expect(page.getByRole('dialog')).toBeVisible();
  });

  test('merges, moves the case, and puts it all back', async ({ page }) => {
    await signInAs(page, 'usr_janet_kerr');
    await page.goto('/people');
    await waitForData(page);
    const before = await page.getByRole('row').count();

    await page.goto('/people/per_aiden_boyle');
    await waitForData(page);
    await page.getByTestId('merge-open').click();
    await page.getByTestId('merge-other-query').fill('Maisie');
    await page.getByTestId('merge-other-results').getByRole('button').first().click();
    await page.getByTestId('merge-reason').fill('One child recorded twice, confirmed with the health visitor and the school.');
    await page.getByTestId('merge-submit').click();

    await expect(page.getByRole('dialog')).toHaveCount(0);
    await expect(page.getByText('Records merged')).toBeVisible();

    // One record fewer in the list, and the retired name kept as an alias so an old reference lands.
    await page.goto('/people');
    await waitForData(page);
    expect(await page.getByRole('row').count()).toBe(before - 1);

    // The undo is offered on the surviving record, and it is a real path.
    await page.goto('/people/per_aiden_boyle');
    await waitForData(page);
    await expect(page.getByTestId('unmerge-open')).toBeVisible();
    await capture(page, { phase: PHASE, screen: 'merge-standing' });
    await page.getByTestId('unmerge-open').click();
    await expect(page.getByRole('dialog')).toContainText('One child recorded twice');
    await page.getByTestId('unmerge-reason').fill('Wrong child. Maisie is her sister, not the same person.');
    await page.getByTestId('unmerge-submit').click();

    await expect(page.getByText('Merge undone')).toBeVisible();
    await page.goto('/people');
    await waitForData(page);
    expect(await page.getByRole('row').count()).toBe(before);

    // Both are on the ledger under their own act, so "has this record been merged, and was that
    // undone" is answered by the act filter rather than by reading reasons.
    await page.goto('/audit');
    await waitForData(page);
    const rows = page.getByRole('row').filter({ hasText: 'Aiden Boyle' });
    await expect(rows.filter({ hasText: 'Merge undone' }).first()).toBeVisible();
    await expect(rows.filter({ hasText: /^(?!.*undone).*Merge/ }).first()).toBeVisible();
  });

  test('an old reference to the retired record still lands on the survivor', async ({ page }) => {
    await signInAs(page, 'usr_janet_kerr');
    await page.goto('/people/per_aiden_boyle');
    await waitForData(page);
    await page.getByTestId('merge-open').click();
    await page.getByTestId('merge-other-query').fill('Maisie');
    await page.getByTestId('merge-other-results').getByRole('button').first().click();
    await page.getByTestId('merge-reason').fill('One child recorded twice, confirmed with the health visitor and the school.');
    await page.getByTestId('merge-submit').click();
    await expect(page.getByRole('dialog')).toHaveCount(0);

    // A bookmark, a printed pack or a connector event carrying the retired id.
    await page.goto('/people/per_maisie_boyle');
    await waitForData(page);
    await expect(page).toHaveURL(/per_aiden_boyle/);
    await expect(page.getByTestId('followed-merge')).toContainText('merged into this one');
    await expect(page.getByRole('heading', { name: 'Aiden Boyle' })).toBeVisible();
  });

  test('the picker offers the create path rather than a dead end', async ({ page }) => {
    await signInAs(page, 'usr_janet_kerr');
    await page.goto('/people/per_aiden_boyle');
    await waitForData(page);
    await page.getByTestId('merge-open').click();
    await page.getByTestId('merge-other-query').fill('Zzzzz');
    await expect(page.getByRole('dialog').getByText(/Nothing matches/)).toBeVisible();

    // The nested create dialog is the same dialog, with the same mandatory search.
    await page.getByTestId('merge-other-add').click();
    await expect(page.getByTestId('create-person-search')).toBeVisible();
    await expect(page.getByTestId('create-person-submit')).toHaveCount(0);
  });
});
