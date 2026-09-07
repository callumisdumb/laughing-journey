import { expect, test } from '@playwright/test';
import { capture, expectNoAxeViolations, signInAs, switchUser, waitForData } from './helpers';

const PHASE = 'invitations';
const MEETING = '/meetings/mtg_docherty_marac';
const TITLE = 'MARAC: Kayleigh Docherty (repeat)';

test.use({ viewport: { width: 1440, height: 900 } });

/**
 * Answering an invitation (D-239), driven. Dr Amira Farouk is invited to the Docherty MARAC and has
 * not answered. She accepts, the chair is told, and the attendance list starts from her answer; she
 * declines and is asked why; she sends a colleague, who is seated through the same check as anybody
 * else and told, while the chair reads who is coming instead. Every consequence is read off the
 * interface, by the person it reaches.
 */
test('accept: the answer reaches the chair and pre-populates the attendance', async ({ page }) => {
  await signInAs(page, 'usr_amira_farouk');
  await page.goto(MEETING);
  await waitForData(page);
  const card = page.getByTestId('your-invitation');
  await expect(card).toBeVisible();
  await expect(card).toContainText('Not answered yet');
  await expect(card).toContainText('You are invited as GP link');
  await expectNoAxeViolations(page);
  await capture(page, { phase: PHASE, screen: 'your-invitation' });

  await page.getByTestId('invitation-submit').click();
  await expect(page.getByText('Invitation accepted').last()).toBeVisible();
  await expect(page.getByTestId('invitation-answer')).toContainText('You accepted on');
  await expect(card).toContainText('Accepted');
  // The invitee list reads the answer beside the reason for the seat.
  await expect(page.locator('[class*="invitee"]').filter({ hasText: 'Dr Amira Farouk' }).first()).toContainText('Accepted');

  // The chair is told, in his own bell, who answered and what they said.
  await switchUser(page, 'usr_paul_mackay');
  await page.goto(MEETING);
  await waitForData(page);
  await page.getByTestId('notifications-bell').click();
  const panel = page.getByTestId('notifications-panel');
  await expect(panel.getByTestId('notification-item').filter({ hasText: `Amira Farouk accepted the invitation to ${TITLE}` }).first()).toBeVisible();
  await capture(page, { phase: PHASE, screen: 'chair-told' });
  await page.keyboard.press('Escape');

  // The chair's attendance list starts from the answers.
  await page.getByRole('button', { name: 'During' }).click();
  const row = page.locator('[class*="invitee"]').filter({ hasText: 'Dr Amira Farouk' }).first();
  await expect(row.locator('select')).toHaveValue('accepted');
});

test('decline: a reason is required, and the chair reads it', async ({ page }) => {
  await signInAs(page, 'usr_amira_farouk');
  await page.goto(MEETING);
  await waitForData(page);
  await page.getByRole('radio', { name: 'Decline' }).check();
  await page.getByTestId('invitation-submit').click();
  await expect(page.getByTestId('invitation-errors')).toContainText('Say why you cannot attend');
  await page.getByTestId('invitation-reason').fill('Surgery all morning on the 9th; nothing to add beyond the return already sent.');
  await page.getByTestId('invitation-submit').click();
  await expect(page.getByText('Invitation declined').last()).toBeVisible();
  await expect(page.getByTestId('invitation-answer')).toContainText('You declined on');
  await expect(page.getByTestId('invitation-answer')).toContainText('Surgery all morning');
  await expect(page.locator('[class*="invitee"]').filter({ hasText: 'Dr Amira Farouk' }).first()).toContainText('Declined: Surgery all morning');

  await switchUser(page, 'usr_paul_mackay');
  await page.goto(MEETING);
  await waitForData(page);
  await page.getByTestId('notifications-bell').click();
  await expect(page.getByTestId('notifications-panel').getByTestId('notification-item').filter({ hasText: `Amira Farouk declined the invitation to ${TITLE}` }).first()).toBeVisible();
});

test('substitute: a colleague from the same agency is seated, told, and the chair reads who is coming', async ({ page }) => {
  await signInAs(page, 'usr_amira_farouk');
  await page.goto(MEETING);
  await waitForData(page);
  await page.getByRole('radio', { name: 'Send somebody instead' }).check();
  await page.getByTestId('invitation-submit').click();
  await expect(page.getByTestId('invitation-errors')).toContainText('Choose who will attend in your place');
  // Only health colleagues who may be seated are offered; the invited health visitor is not, being on the list already.
  const options = await page.getByTestId('invitation-substitute').locator('option').allTextContents();
  expect(options.some((o) => o.includes('Louise Kennedy'))).toBe(true);
  expect(options.some((o) => o.includes('Sunita Rao'))).toBe(false);
  expect(options.some((o) => o.includes('Janet Kerr'))).toBe(false);
  await page.getByTestId('invitation-substitute').selectOption('usr_louise_kennedy');
  await page.getByTestId('invitation-substitute-note').fill('Louise holds the mental health picture for the family.');
  await page.getByTestId('invitation-submit').click();
  await expect(page.getByText('Substitute nominated').last()).toBeVisible();
  await expect(page.getByTestId('invitation-answer')).toContainText('Louise Kennedy will attend in your place');
  const list = page.locator('[class*="invitee"]');
  await expect(list.filter({ hasText: 'Louise Kennedy' }).first()).toContainText('Attending in place of Amira Farouk');
  await expect(list.filter({ hasText: 'Dr Amira Farouk' }).first()).toContainText('Sending Louise Kennedy');
  await capture(page, { phase: PHASE, screen: 'substitute-seated' });

  // The substitute is told like any invitee, and can see the meeting.
  await switchUser(page, 'usr_louise_kennedy');
  await page.goto(MEETING);
  await waitForData(page);
  await expect(page.getByRole('heading', { name: TITLE, level: 1 })).toBeVisible();
  await page.getByTestId('notifications-bell').click();
  await expect(page.getByTestId('notifications-panel').getByTestId('notification-item').filter({ hasText: `You are invited to ${TITLE}` }).first()).toBeVisible();
  await page.keyboard.press('Escape');
  // And has an invitation of her own to answer.
  await expect(page.getByTestId('your-invitation')).toContainText('Not answered yet');

  await switchUser(page, 'usr_paul_mackay');
  await page.goto(MEETING);
  await waitForData(page);
  await page.getByTestId('notifications-bell').click();
  await expect(page.getByTestId('notifications-panel').getByTestId('notification-item').filter({ hasText: `Amira Farouk has nominated a substitute for ${TITLE}` }).first()).toBeVisible();
});
