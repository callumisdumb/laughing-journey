import { expect, test } from '@playwright/test';
import { capture, expectNoAxeViolations, signInAs, switchUser, waitForData } from './helpers';

const PHASE = 'minute-correction';
const MEETING = '/meetings/mtg_marion_iad';
const TITLE = 'ASP inter-agency discussion: Marion Fraser';

test.use({ viewport: { width: 1440, height: 900 } });

/**
 * Correcting an approved minute (D-242), driven. The inter-agency discussion on Marion Fraser has a
 * distributed minute with three recipients at two levels. The chair records a correction: what was
 * recorded, what is now recorded, why. The minute is not edited; the addendum sits beneath it in
 * the workspace and the pack; each original recipient is told at their level; and the ledger reads
 * it as a share.
 */
test('the correction is an addendum, goes to the original list at their levels, and sits beneath the minute in the pack', async ({ page }) => {
  await signInAs(page, 'usr_moira_gilmour');
  await page.goto(`${MEETING}?phase=after`);
  await waitForData(page);
  await expect(page.getByTestId('correct-minute')).toBeEnabled();
  await page.getByTestId('correct-minute').click();
  const dialog = page.getByRole('dialog');
  await expect(dialog).toContainText('sent to everybody the minute went to at the level they were given (3 recipients)');
  await expectNoAxeViolations(page);
  await capture(page, { phase: PHASE, screen: 'correction-dialog' });
  await page.getByTestId('correction-submit').click();
  await expect(dialog).toContainText('Say what the minute recorded');
  await page.getByTestId('correction-recorded').fill('Withdrawals of £2,400 between June and August.');
  await page.getByTestId('correction-now').fill('Withdrawals of £1,400 between June and August; the £2,400 figure double-counted the July pension.');
  await page.getByTestId('correction-reason').fill('Bank statements received on 5 September.');
  await page.getByTestId('correction-submit').click();
  await expect(page.getByText('Minute corrected').last()).toBeVisible();
  await expect(page.getByText('The correction went to 3 recipients at their levels.').last()).toBeVisible();

  const corrections = page.getByTestId('minute-corrections');
  await expect(corrections).toContainText('Moira Gilmour');
  await expect(corrections).toContainText('Recorded: "Withdrawals of £2,400');
  await expect(corrections).toContainText('Now recorded: "Withdrawals of £1,400');
  await expect(corrections).toContainText('Sent to 3 recipients');
  await expect(page.getByText('Minute: Distributed')).toBeVisible();
  await capture(page, { phase: PHASE, screen: 'corrected' });

  // The pack shows it beneath the minute.
  await page.goto(`${MEETING}?view=print`);
  await waitForData(page);
  const pack = page.getByTestId('pack-corrections');
  await expect(pack).toContainText('Correction 1');
  await expect(pack).toContainText('Now recorded: Withdrawals of £1,400');
  await expect(pack).toContainText('Sent to 3 recipients of the original distribution, at their levels.');
  await capture(page, { phase: PHASE, screen: 'pack-corrections', fullPage: true });

  // A full-detail recipient and a fields-level recipient are each told at their own level.
  await switchUser(page, 'usr_paul_mackay');
  await page.goto(MEETING);
  await waitForData(page);
  await page.getByTestId('notifications-bell').click();
  await expect(page.getByTestId('notifications-panel').getByTestId('notification-item').filter({ hasText: `The minute of ${TITLE} has been corrected. You have the correction at Full record` }).first()).toBeVisible();
  await page.keyboard.press('Escape');
  await switchUser(page, 'usr_alistair_meek');
  await page.goto('/');
  await waitForData(page);
  await page.getByTestId('notifications-bell').click();
  await expect(page.getByTestId('notifications-panel').getByTestId('notification-item').filter({ hasText: `The minute of ${TITLE} has been corrected. You have the correction at Named fields only` }).first()).toBeVisible();
  await page.keyboard.press('Escape');

  // The ledger reads the correction as a share, with the count; the chair reads her own ledger.
  await switchUser(page, 'usr_moira_gilmour');
  await page.goto('/audit');
  await waitForData(page);
  await expect(page.getByRole('row').filter({ hasText: `Minute of ${TITLE} corrected by addendum, sent to 3 recipients` }).first()).toBeVisible();
});
