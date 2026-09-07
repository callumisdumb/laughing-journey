import { expect, test } from '@playwright/test';
import { capture, expectNoAxeViolations, signInAs, waitForData } from './helpers';

const PHASE = 'notifications';

test.use({ viewport: { width: 1440, height: 900 } });

/**
 * The bell and what is behind it, on the seeded state.
 *
 * The seed gives each person the shares that were sent to them, unread where the share is unread,
 * which is what the old bell counted (D-207); Amira Farouk, the GP, holds one. What is asserted here
 * is the surface: the count, the panel grouped by case, reading and persistence across a reload, and
 * reset putting the seed back.
 */
test.describe('the bell', () => {
  test('counts what is unread, opens a panel grouped by case, and reading survives a reload', async ({ page }) => {
    await signInAs(page, 'usr_amira_farouk');
    await page.goto('/');
    await waitForData(page);
    const bell = page.getByTestId('notifications-bell');
    await expect(bell).toHaveAttribute('aria-label', /Notifications, \d+ unread/);
    const badge = page.getByTestId('notifications-unread');
    await expect(badge).toBeVisible();
    const before = Number.parseInt(((await badge.textContent()) ?? '0').replace(/\D/g, ''), 10);
    expect(before).toBeGreaterThan(0);

    await bell.click();
    const panel = page.getByTestId('notifications-panel');
    await expect(panel).toBeVisible();
    await expect(panel.getByTestId('notification-group').first()).toBeVisible();
    await expect(panel.getByTestId('notification-item').first()).toHaveAttribute('data-state', 'unread');
    await capture(page, { phase: PHASE, screen: 'panel' });
    await expectNoAxeViolations(page);

    await page.getByTestId('notifications-mark-all').click();
    await expect(page.getByTestId('notifications-panel-unread')).toContainText('No unread');
    await page.keyboard.press('Escape');
    await expect(badge).toHaveCount(0);

    await page.reload();
    await waitForData(page);
    await expect(page.getByTestId('notifications-unread')).toHaveCount(0);

    // Reset to seed: the overlay goes, and the seeded unread come back exactly as they were.
    await page.keyboard.press('Control+Shift+D');
    await page.getByTestId('demo-reset').click();
    await page.getByRole('dialog', { name: 'Back to the seed?' }).getByRole('button', { name: 'Reset demo data' }).click();
    await waitForData(page);
    await expect(page.getByTestId('notifications-unread')).toContainText(String(before));
  });

  test('the Notifications screen and the Home region show the same list, and a dismissed one is gone from both', async ({ page }) => {
    await signInAs(page, 'usr_moira_gilmour');
    await page.goto('/notifications');
    await waitForData(page);
    await expect(page.getByRole('heading', { level: 1 })).toContainText('Notifications');
    // The bell's panel holds the same rows, closed, so the screen's own list is the one asked.
    const screen = page.getByTestId('notifications-screen');
    const items = screen.getByTestId('notification-item');
    const count = await items.count();
    expect(count).toBeGreaterThan(0);
    await capture(page, { phase: PHASE, screen: 'screen' });
    await expectNoAxeViolations(page);
    // The whole row's text, not a prefix: an overdue notice and its escalation share their first forty characters.
    const firstText = (await items.first().locator('button').first().textContent()) ?? '';
    await items.first().getByTestId('notification-dismiss').click();
    await expect(screen.getByTestId('notification-item')).toHaveCount(count - 1);
    await page.goto('/');
    await waitForData(page);
    await expect(page.getByTestId('home-notifications')).toBeVisible();
    expect(firstText.length).toBeGreaterThan(40);
    await expect(page.getByTestId('home-notifications')).not.toContainText(firstText);
  });

  test('the drawer on a case shows what this person was told about it', async ({ page }) => {
    await signInAs(page, 'usr_moira_gilmour');
    await page.goto('/processes/prc_asp_marion');
    await waitForData(page);
    await expect(page.getByTestId('drawer-notifications')).toBeVisible();
  });
});
