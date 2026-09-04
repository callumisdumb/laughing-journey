import { expect, test } from '@playwright/test';
import { capture, expectNoAxeViolations, signInAs, waitForData } from './helpers';

const PHASE = 'calendar';

test.use({ viewport: { width: 1440, height: 900 } });

/**
 * The Admin calendar, which is the screen a sceptical practitioner uses to test whether the product
 * agrees with them about a deadline they already know the answer to.
 *
 * The assertions are the ones a room would make: does it hold the Scottish list rather than the
 * English one, does it keep the council's own days apart from the national ones, does it say where
 * the list came from and that the product never fetches it, and does the calculator show its work.
 */
test.describe('the working calendar', () => {
  test('says where the list came from and that the product never fetches it', async ({ page }) => {
    await signInAs(page, 'usr_sam_ogilvie');
    await page.goto('/admin/calendar');
    await waitForData(page);
    const provenance = page.getByTestId('calendar-provenance');
    await expect(provenance).toContainText('https://www.gov.uk/bank-holidays.json');
    await expect(provenance).toContainText('scotland');
    await expect(provenance).toContainText(/never fetches this/i);
    await capture(page, { phase: PHASE, screen: 'calendar', fullPage: true });
    await expectNoAxeViolations(page);
  });

  test('holds the Scottish list, which is not the English one', async ({ page }) => {
    await signInAs(page, 'usr_sam_ogilvie');
    await page.goto('/admin/calendar');
    await waitForData(page);
    await page.getByTestId('calendar-year').selectOption('2026');
    const list = page.getByRole('list', { name: /National bank holidays for 2026/ });
    // Scotland has these and England and Wales does not.
    await expect(list.getByText('2nd January')).toBeVisible();
    await expect(list.getByText(/St Andrew.s Day/)).toBeVisible();
    await expect(list.getByText('World Cup bank holiday')).toBeVisible();
    // The summer holiday is the first Monday in August, not the last.
    await expect(list.getByText('03 Aug 2026')).toBeVisible();
    await expect(list.getByText('31 Aug 2026')).toHaveCount(0);
    // And the substitute-day note is on screen rather than buried.
    await expect(list.getByText('Substitute day').first()).toBeVisible();
  });

  test('keeps the council’s own days apart from the national list', async ({ page }) => {
    await signInAs(page, 'usr_sam_ogilvie');
    await page.goto('/admin/calendar');
    await waitForData(page);
    const local = page.getByRole('list', { name: 'Council local holidays' });
    await expect(local.getByText('Clydeshore spring holiday').first()).toBeVisible();
    // The national list is a different list, and the council's days are not in it.
    await expect(page.getByRole('list', { name: /National bank holidays/ }).getByText('Clydeshore')).toHaveCount(0);
  });

  test('the calculator shows which days it skipped and why', async ({ page }) => {
    await signInAs(page, 'usr_sam_ogilvie');
    await page.goto('/admin/calendar');
    await waitForData(page);

    // Friday 12 June 2026, one working day. Monday 15 June is the one-off World Cup holiday.
    await page.getByTestId('calculator-from').fill('12/06/2026');
    await page.getByTestId('calculator-amount').fill('1');
    await expect(page.getByTestId('calculator-answer')).toContainText('16 Jun 2026');
    const skipped = page.getByTestId('calculator-skipped');
    await expect(skipped.getByText(/World Cup bank holiday/)).toBeVisible();
    await expect(skipped.getByText(/Weekend/).first()).toBeVisible();
    await capture(page, { phase: PHASE, screen: 'calculator' });
  });

  test('the calculator counts backwards, which is where the off-by-one lives', async ({ page }) => {
    await signInAs(page, 'usr_sam_ogilvie');
    await page.goto('/admin/calendar');
    await waitForData(page);
    // Five working days back from Monday 5 January 2026, over two holidays and a weekend.
    await page.getByTestId('calculator-from').fill('05/01/2026');
    await page.getByTestId('calculator-amount').fill('5');
    await page.getByTestId('calculator-direction').selectOption('back');
    await expect(page.getByTestId('calculator-answer')).toContainText('23 Dec 2025');
  });

  test('refuses to answer past the end of the committed calendar', async ({ page }) => {
    await signInAs(page, 'usr_sam_ogilvie');
    await page.goto('/admin/calendar');
    await waitForData(page);
    await page.getByTestId('calculator-from').fill('20/12/2028');
    await page.getByTestId('calculator-amount').fill('20');
    // A weekends-only answer looks exactly like a correct one, so there is no answer at all.
    await expect(page.getByText(/runs past the calendar/)).toBeVisible();
    await expect(page.getByTestId('calculator-answer')).toHaveCount(0);
  });

  test('a national holiday the organisation stops observing becomes a working day', async ({ page }) => {
    await signInAs(page, 'usr_sam_ogilvie');
    await page.goto('/admin/calendar');
    await waitForData(page);
    await page.getByTestId('calculator-from').fill('27/11/2026');
    await page.getByTestId('calculator-amount').fill('1');
    // Monday 30 November is St Andrew's Day, so one working day on is Tuesday 1 December.
    await expect(page.getByTestId('calculator-answer')).toContainText('01 Dec 2026');

    await page.getByTestId('calendar-year').selectOption('2026');
    // Scoped to the national list: the twelve month view names the same holiday.
    const row = page.getByRole('list', { name: /National bank holidays for 2026/ }).getByRole('listitem').filter({ hasText: /St Andrew.s Day/ });
    await row.getByRole('switch').uncheck();
    // With it unobserved, the same count lands on the Monday.
    await expect(page.getByTestId('calculator-answer')).toContainText('30 Nov 2026');
  });
});
