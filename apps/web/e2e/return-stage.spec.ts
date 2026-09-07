import { expect, test } from '@playwright/test';
import { capture, expectNoAxeViolations, signInAs, waitForData } from './helpers';

const PHASE = 'return-stage';

test.use({ viewport: { width: 1440, height: 900 } });

/**
 * Returning a case a stage (D-241), driven. Marion Fraser's adult protection case is at
 * investigation. The council officer returns it to the inquiry with a reason: the stepper moves
 * back, the reason is on the stage entry and the chronology, no clock starts, and the inquiry
 * outcome is offered again. The CP and MARAC returns are the same transition shape and are held to
 * the tables by the domain suite.
 */
test('an ASP investigation returns to the inquiry with the reason on the record, and the outcome is offered again', async ({ page }) => {
  await signInAs(page, 'usr_moira_gilmour');
  await page.goto('/processes/prc_asp_marion');
  await waitForData(page);
  // The ASP vocabulary: the investigation stage is "Inquiry using investigatory powers".
  await expect(page.locator('[aria-current="step"]')).toContainText('Inquiry using investigatory powers');
  await expect(page.getByTestId('next-asp-return-to-inquiry-button')).toBeEnabled();
  await page.getByTestId('next-asp-return-to-inquiry-button').click();
  await expect(page.getByTestId('transition-route')).toContainText('Moves the case to Inquiry');
  await expect(page.getByTestId('transition-dialog')).toContainText('The inquiry outcome is then recorded again');
  await expectNoAxeViolations(page);
  await capture(page, { phase: PHASE, screen: 'return-dialog' });
  await page.getByTestId('transition-submit').click();
  await expect(page.getByRole('dialog')).toContainText('Give your reasoning');
  await page.getByTestId('transition-reason').fill('The bank statements show the withdrawals were Marion\'s own; the investigation was opened on a misreading. Back to the inquiry to record the outcome properly.');
  await page.getByTestId('transition-submit').click();
  await expect(page.getByText('Return to inquiry recorded').last()).toBeVisible();

  await expect(page.locator('[aria-current="step"]')).not.toContainText('investigatory');
  await expect(page.locator('[aria-current="step"]')).toContainText('Inquiry');
  await expect(page.locator('[aria-current="step"]')).toContainText('Moira Gilmour');
  await expect(page.getByTestId('next-asp-inquiry-outcome-button')).toBeVisible();
  await expect(page.getByTestId('next-asp-return-to-inquiry-button')).toHaveCount(0);
  await capture(page, { phase: PHASE, screen: 'returned' });

  // The stage history and the chronology carry the reason; the ledger reads it as a stage move.
  await page.goto('/people/per_marion_fraser/chronology');
  await waitForData(page);
  await expect(page.getByRole('row').filter({ hasText: 'Return to inquiry' }).first()).toBeVisible();
  await page.goto('/audit');
  await waitForData(page);
  const entry = page.getByRole('row').filter({ hasText: 'Returned to Inquiry' }).first();
  await expect(entry).toContainText('Stage moved');
  await expect(entry).toContainText('misreading');
});
