import { expect, test } from '@playwright/test';
import { capture, expectNoAxeViolations, signInAs, waitForData } from './helpers';

const PHASE = 'referral-correction';
const CASE = '/processes/prc_asp_marion';

test.use({ viewport: { width: 1440, height: 900 } });

/**
 * Correcting the referral once the case is open (D-245), driven. The concern on Marion Fraser's
 * adult protection case names the wrong source. The council officer corrects it with a reason: the
 * card reads the new value, the version history keeps the old one, the chronology carries the
 * correction and the ledger holds the reason. What the dialog will not offer is the subject or the
 * perpetrator, and it says why.
 */
test('the referral is corrected with a reason, the old reading is kept, and the parties are not editable here', async ({ page }) => {
  await signInAs(page, 'usr_moira_gilmour');
  await page.goto(CASE);
  await waitForData(page);
  const card = page.locator('[data-card="asp-concern"]');
  await expect(card).toBeVisible();
  const before = (await card.textContent()) ?? '';

  await page.getByTestId('correct-referral').click();
  const dialog = page.getByRole('dialog');
  await expect(dialog).toContainText('The referral is a record of what somebody said');
  await expect(dialog).toContainText('a wrong perpetrator is corrected on the case-role register');
  await expect(page.getByTestId('referral-submit')).toBeDisabled();
  await expectNoAxeViolations(page);
  await capture(page, { phase: PHASE, screen: 'correct-referral-dialog' });

  await page.getByTestId('referral-source').fill('Clydeshore Bank, Ardvale branch manager');
  await expect(page.getByTestId('referral-submit')).toBeEnabled();
  await page.getByTestId('referral-submit').click();
  await expect(dialog).toContainText('Say why in a sentence');
  await page.getByTestId('referral-reason').fill('The referral was taken down as "the bank"; the branch manager is the named source on the police report.');
  await page.getByTestId('referral-submit').click();
  await expect(page.getByText('Referral corrected').last()).toBeVisible();

  await expect(card).toContainText('Clydeshore Bank, Ardvale branch manager');
  expect(before).not.toContain('Ardvale branch manager');
  await capture(page, { phase: PHASE, screen: 'corrected' });

  // The chronology carries the correction with the reason.
  await page.goto('/people/per_marion_fraser/chronology');
  await waitForData(page);
  const row = page.getByRole('row').filter({ hasText: 'Referral record corrected' }).first();
  // The row shows the title; the detail, which carries the reason, is its tooltip and the drawer's version line.
  await expect(row.locator('[title*="taken down as"]')).toHaveCount(1);
  await row.click();
  await expect(page.getByRole('complementary', { name: 'Context' })).toContainText('Referral corrected on ASP-2026-0217: Source');

  // The ledger keeps it as a correction, naming the field.
  await page.goto('/audit');
  await waitForData(page);
  await expect(page.getByRole('row').filter({ hasText: 'Referral corrected on ASP' }).first()).toContainText('Source');
});
