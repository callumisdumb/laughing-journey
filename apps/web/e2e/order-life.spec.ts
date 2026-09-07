import { expect, test } from '@playwright/test';
import { openTransition, submitTransition } from './driven';
import { capture, expectNoAxeViolations, signInAs, waitForData } from './helpers';

const PHASE = 'order-life';
const CASE = '/processes/prc_awi_ishbel';

test.use({ viewport: { width: 1440, height: 900 } });

/**
 * The life of a guardianship order after it is granted (D-252), driven. An order used to be a fact
 * with a date and nothing after it, which is wrong: orders are renewed, their powers are varied,
 * they are recalled, and they are appealed. Each is recorded against the order, the record keeps
 * what the powers were before, and the renewal clock counts back from whatever expiry is current.
 */
test('an order is renewed, its powers are varied, an appeal is recorded, and the recall ends it', async ({ page }) => {
  await signInAs(page, 'usr_graeme_dunlop');
  await page.goto(CASE);
  await waitForData(page);

  // Nothing can happen to an order that does not exist. The appeal is the one of the four offered
  // while the application is still with the court, and it is refused with what records an order.
  const appeal = page.getByTestId('next-awi-record-appeal');
  await expect(appeal).toHaveAttribute('data-state', 'refused');
  await expect(appeal).toContainText('This case has no order yet.');
  await capture(page, { phase: PHASE, screen: 'no-order-yet' });

  // The court grants it, which is the existing court event rather than anything new.
  await openTransition(page, 'awi-court-event');
  await page.getByRole('radio', { name: /^Order granted/ }).check();
  await page.getByTestId('transition-date').fill('2026-09-04');
  await page.getByTestId('transition-order-kind').selectOption('welfare-guardianship');
  await page.getByTestId('transition-order-expiry').fill('2029-09-04');
  await page.getByTestId('transition-guardian').fill('Clydeshore Council, Chief Social Work Officer');
  await page.getByTestId('transition-powers').fill('Decide where Ishbel lives\nConsent to care and treatment');
  await submitTransition(page);
  await expect(page.getByTestId('process-header')).toContainText('Order');

  // Renewed: the same order with a new expiry, counted as a renewal rather than a second order.
  await openTransition(page, 'awi-renew-order');
  await expect(page.getByTestId('transition-dialog')).toContainText('The Commission counts renewals apart from new orders');
  await page.getByTestId('transition-at').fill('2029-08-15');
  await page.getByTestId('transition-expires').fill('2032-08-15');
  await page.getByTestId('transition-summary').fill('Renewed for three years on the same powers. Ishbel remains without capacity for the residence and treatment decisions.');
  await expectNoAxeViolations(page);
  await capture(page, { phase: PHASE, screen: 'renew-form' });
  await submitTransition(page);
  await expect(page.getByText('Renewed 15 Aug 2029, now expires 15 Aug 2032').first()).toBeVisible();

  // Varied: the order stands and what it authorises changes, with the old powers kept.
  await openTransition(page, 'awi-vary-order');
  await page.getByTestId('transition-at').fill('2030-02-11');
  await page.getByTestId('transition-powers').fill('Decide where Ishbel lives\nConsent to care and treatment\nManage the tenancy at 4 Craiglarrick Road');
  await page.getByTestId('transition-summary').fill('Tenancy management added so the flat can be sublet rather than given up.');
  await capture(page, { phase: PHASE, screen: 'vary-form' });
  await submitTransition(page);
  await expect(page.getByText('Powers varied 11 Feb 2030').first()).toBeVisible();
  await expect(page.getByText('Manage the tenancy at 4 Craiglarrick Road').first()).toBeVisible();

  // Appealed: a fact about the order whatever becomes of it, and it changes no powers by itself.
  await openTransition(page, 'awi-record-appeal');
  await expect(page.getByTestId('transition-dialog')).toContainText('It does not by itself change the powers');
  await page.getByTestId('transition-at').fill('2030-03-20');
  await page.getByTestId('transition-appellant').fill('Ishbel Grant, through her solicitor');
  await page.getByTestId('transition-appeal-outcome').selectOption('refused');
  await page.getByTestId('transition-summary').fill('Appeal against the tenancy power. Refused: the sheriff held the power proportionate.');
  await capture(page, { phase: PHASE, screen: 'appeal-form' });
  await submitTransition(page);
  await expect(page.getByText('Appeal refused by Ishbel Grant, through her solicitor, 20 Mar 2030').first()).toBeVisible();

  // Recalled: the order ends before its expiry, so its renewal clock stops with it.
  await openTransition(page, 'awi-recall-order');
  await expect(page.getByTestId('transition-dialog')).toContainText('Its expiry clock stops');
  await page.getByTestId('transition-at').fill('2031-01-08');
  await page.getByTestId('transition-summary').fill('Recalled on the adult recovering capacity for the residence and treatment decisions.');
  await submitTransition(page);
  await expect(page.getByText('Recalled 08 Jan 2031').first()).toBeVisible();
  await capture(page, { phase: PHASE, screen: 'order-life' });

  // Nothing can be recalled twice: the only order the case has, has ended.
  await expect(page.getByTestId('next-awi-recall-order')).toHaveAttribute('data-state', 'refused');
});
