import { expect, test } from '@playwright/test';
import { capture, expectNoAxeViolations, signInAs, switchUser, waitForData } from './helpers';

const PHASE = 'away';

test.use({ viewport: { width: 1440, height: 900 } });

/**
 * Being told when you are not signed in (D-254), driven. The product sends nothing: no email, no
 * text, no push, and it will not pretend otherwise. What it can do is make being away a fact the
 * product knows. Somebody covering you receives a copy of what you are told, as a notification of
 * their own, so it renders at their level and goes through the same admissibility check. The
 * administrator can see exactly what a deployment with email would have sent, as counts.
 */
test('a delegate receives a copy of what the person they are covering is told, and only while they are away', async ({ page }) => {
  await signInAs(page, 'usr_moira_gilmour');
  await page.goto('/settings');
  await waitForData(page);
  await expect(page.getByText('nothing is emailed')).toBeVisible();
  await page.getByTestId('ooo-from').fill('2026-09-01');
  await page.getByTestId('ooo-to').fill('2026-09-14');
  await page.getByTestId('ooo-delegate').selectOption('usr_graeme_dunlop');
  await expectNoAxeViolations(page);
  await capture(page, { phase: PHASE, screen: 'out-of-office' });
  await page.getByTestId('ooo-save').click();
  await expect(page.getByText('Out of office set').last()).toBeVisible();
  await expect(page.getByText('You are away from 01 Sep 2026 to 14 Sep 2026, covered by Graeme Dunlop.')).toBeVisible();

  // Somebody gives Moira an action while she is away.
  await switchUser(page, 'usr_stuart_blair');
  await page.goto('/processes/prc_asp_whinbrae');
  await waitForData(page);
  await page.getByTestId('add-action').click();
  await page.getByTestId('action-title').fill('Ask the pharmacy for the dispensing record');
  await page.getByTestId('action-owner').selectOption('usr_moira_gilmour');
  await page.getByTestId('action-due').fill('2026-09-11');
  await page.getByTestId('action-submit').click();
  await expect(page.getByText('Action added').last()).toBeVisible();

  // Graeme, covering her, is told as well, in his own words and at his own level.
  await switchUser(page, 'usr_graeme_dunlop');
  await page.goto('/');
  await waitForData(page);
  await page.getByTestId('notifications-bell').click();
  const panel = page.getByTestId('notifications-panel');
  await expect(panel.getByTestId('notification-item').filter({ hasText: 'Ask the pharmacy for the dispensing record' }).first()).toBeVisible();
  await capture(page, { phase: PHASE, screen: 'delegate-copy' });
  await page.keyboard.press('Escape');

  // She comes back, and the copies stop.
  await switchUser(page, 'usr_moira_gilmour');
  await page.goto('/settings');
  await waitForData(page);
  await page.getByTestId('ooo-clear').click();
  await expect(page.getByText('Marked as back').last()).toBeVisible();
  await expect(page.getByText(/You are away from/)).toHaveCount(0);

  await switchUser(page, 'usr_stuart_blair');
  await page.goto('/processes/prc_asp_whinbrae');
  await waitForData(page);
  await page.getByTestId('add-action').click();
  await page.getByTestId('action-title').fill('Chase the bank for the statements');
  await page.getByTestId('action-owner').selectOption('usr_moira_gilmour');
  await page.getByTestId('action-due').fill('2026-09-12');
  await page.getByTestId('action-submit').click();
  await expect(page.getByText('Action added').last()).toBeVisible();

  await switchUser(page, 'usr_graeme_dunlop');
  await page.goto('/');
  await waitForData(page);
  await page.getByTestId('notifications-bell').click();
  await expect(page.getByTestId('notifications-panel').getByTestId('notification-item').filter({ hasText: 'Chase the bank for the statements' })).toHaveCount(0);
});

test('the administrator can see what a deployment with email would have sent, as counts and never content', async ({ page }) => {
  await signInAs(page, 'usr_sam_ogilvie');
  await page.goto('/admin/digest');
  await waitForData(page);
  await expect(page.getByTestId('digest-total')).toContainText('none sent');
  await expect(page.getByTestId('digest-rows').locator('tr').first()).toBeVisible();
  await expect(page.getByText('Counts only, never content')).toBeVisible();
  await expectNoAxeViolations(page);
  await capture(page, { phase: PHASE, screen: 'digest', fullPage: true });
});
