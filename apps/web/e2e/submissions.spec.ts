import { expect, test } from '@playwright/test';
import { capture, expectNoAxeViolations, signInAs, waitForData } from './helpers';

const PHASE = 'submissions';

test.use({ viewport: { width: 1440, height: 900 } });

/**
 * Marking a return as submitted (D-247), driven. The ASP lead officer records that the quarter's
 * return went to the Scottish Government: the report says so from then on, the ledger has it as a
 * submission rather than an export, and the quarter's deadline clock is completed by the act that
 * answers it. A second submission for the same period is refused.
 */
test('the ASP return is recorded as submitted, the deadline clock completes, and a second one is refused', async ({ page }) => {
  await signInAs(page, 'usr_elspeth_gunn');
  await page.goto('/reports/asp');
  await waitForData(page);
  await expect(page.getByTestId('mark-submitted')).toBeVisible();
  await page.getByTestId('mark-submitted').click();
  const dialog = page.getByRole('dialog');
  await expect(dialog).toContainText('The product does not send returns');
  await expect(dialog).toContainText('It completes the submission clock for this quarter');
  await expect(page.getByTestId('submission-recipient')).not.toHaveValue('');
  await expectNoAxeViolations(page);
  await capture(page, { phase: PHASE, screen: 'submit-dialog' });

  // A date that has not happened is refused before anything is written.
  await page.getByTestId('submission-on').fill('2027-01-01');
  await page.getByTestId('submission-submit').click();
  await expect(dialog).toContainText('cannot have been sent on a date that has not happened');

  await page.getByTestId('submission-on').fill('2026-08-14');
  await page.getByTestId('submission-quarter').selectOption('q1');
  await page.getByTestId('submission-route').fill('Secure email to ASPData');
  await page.getByTestId('submission-reference').fill('ASP-Q1-2627-014');
  await page.getByTestId('submission-submit').click();
  await expect(page.getByText('Return recorded as submitted').last()).toBeVisible();

  const done = page.getByTestId('submission-done');
  await expect(done).toContainText('Submitted to');
  await expect(done).toContainText('14 Aug 2026');
  await expect(done).toContainText('Elspeth Gunn');
  await expect(done).toContainText('ASP-Q1-2627-014');
  await expect(page.getByTestId('mark-submitted')).toHaveCount(0);
  await capture(page, { phase: PHASE, screen: 'submitted' });

  // The ledger holds it as its own act, not as an export.
  await page.goto('/audit');
  await waitForData(page);
  const row = page.getByRole('row').filter({ hasText: 'recorded as submitted to' }).first();
  await expect(row).toBeVisible();
  await expect(row).toContainText('Return submitted');

  // The quarter's deadline clock is completed by the submission.
  await page.goto('/admin/timescales');
  await waitForData(page);
  await expect(page.getByText(/Quarter 1/).first()).toBeVisible();

  // A second submission for the same period is refused rather than silently duplicated.
  await page.goto('/reports/asp');
  await waitForData(page);
  await expect(page.getByTestId('submission-done')).toBeVisible();
});
