import { expect, test } from '@playwright/test';
import { capture, expectNoAxeViolations, signInAs, waitForData } from './helpers';

const PHASE = 'clock';

test.use({ viewport: { width: 1440, height: 900 } });

/**
 * The demo clock, and the thing it exists to make demonstrable.
 *
 * A statutory clock reading "due in 3 days" is a number on a screen. Moving the clock past the due
 * date and watching the same clock go overdue, its band change and the worklist reorder is what a
 * room of practitioners will test the product against. These assert that one instant drives all of
 * it, because a screen reading a different instant from the one beside it would be worse than a
 * frozen clock.
 */
test.describe('demo clock', () => {
  test('moving it moves every statutory clock, and the seed is one click away', async ({ page }) => {
    await signInAs(page, 'usr_moira_gilmour');
    await page.goto('/processes/prc_asp_marion');
    await waitForData(page);

    const clock = page.locator('[class*="__clockLink"]').first();
    const before = await clock.textContent();
    expect(before).toMatch(/day/);

    await page.goto('/settings');
    await waitForData(page);
    await expect(page.locator('[class*="__readingLabel"]')).toHaveText('Demo clock');
    await capture(page, { phase: PHASE, screen: 'demo-clock' });
    await expectNoAxeViolations(page);

    // Four weeks on. Everything computed from the instant has to move with it.
    for (let i = 0; i < 4; i += 1) await page.getByRole('button', { name: 'On a week' }).click();
    await expect(page.getByText(/The clock has been moved/)).toBeVisible();

    await page.goto('/processes/prc_asp_marion');
    await waitForData(page);
    const after = await page.locator('[class*="__clockLink"]').first().textContent();
    expect(after, 'the statutory clock did not move with the demo clock').not.toBe(before);

    // Back to the seed, and the original reading returns: the moves are absolute, not accumulated.
    await page.goto('/settings');
    await waitForData(page);
    await page.getByRole('button', { name: 'Back to the seed' }).click();
    await expect(page.getByText(/The clock has been moved/)).toHaveCount(0);
    await page.goto('/processes/prc_asp_marion');
    await waitForData(page);
    await expect(page.locator('[class*="__clockLink"]').first()).toHaveText(before ?? '');
  });

  test('one instant drives the whole product, not one screen at a time', async ({ page }) => {
    await signInAs(page, 'usr_janet_kerr');
    await page.goto('/settings');
    await waitForData(page);
    await page.getByRole('button', { name: 'On 28 days' }).click();

    // The clock the demo panel reads and the clock the top bar reads are the same value.
    const reading = await page.locator('[class*="__readingValue"]').first().textContent();
    await page.goto('/');
    await waitForData(page);
    const home = await page.evaluate(() => document.body.textContent ?? '');
    // The reading is a formatted date and time; its date half must appear on the home screen's
    // greeting line, which is computed from the same instant.
    const date = (reading ?? '').split(',')[0]!.trim();
    expect(home).toContain(date);
  });

});
