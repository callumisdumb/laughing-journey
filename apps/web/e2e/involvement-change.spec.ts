import { expect, test } from '@playwright/test';
import { capture, expectNoAxeViolations, signInAs, switchUser, waitForData } from './helpers';

const PHASE = 'involvement-change';
const CASE = '/processes/prc_cp_aiden';

test.use({ viewport: { width: 1440, height: 900 } });

/**
 * Changing or withdrawing a request to be involved (D-246), driven. A housing officer who can see
 * that a child protection case exists asks to be on it, changes the reason before anybody decides,
 * then withdraws it. The lead reads each change, the request leaves their list when it is withdrawn,
 * and the requester may ask again.
 */
test('a pending request is amended and then withdrawn, and the lead reads both', async ({ page }) => {
  await signInAs(page, 'usr_mark_hepburn');
  await page.goto(CASE);
  await waitForData(page);
  await page.getByTestId('ask-to-be-involved').click();
  await page.getByTestId('involve-reason').fill('The family are our tenants and the repairs history matters to the plan.');
  await page.getByTestId('involve-submit').click();
  await expect(page.getByTestId('involve-pending')).toBeVisible();

  const card = page.getByTestId('your-involvement-request');
  await expect(card).toBeVisible();
  await expect(card).toContainText('The family are our tenants');
  await expectNoAxeViolations(page);
  await capture(page, { phase: PHASE, screen: 'your-request' });

  // Amend: the reason the lead will read is replaced, and the card says it was amended.
  await page.getByTestId('involve-amend').click();
  await page.getByTestId('involve-amend-reason').fill('The family are our tenants. There is a live antisocial behaviour case on the upstairs flat that the plan should know about.');
  await page.getByTestId('involve-amend-submit').click();
  await expect(page.getByText('Reason changed').last()).toBeVisible();
  await expect(card).toContainText('antisocial behaviour case on the upstairs flat');
  await expect(card).toContainText('Amended once');
  await capture(page, { phase: PHASE, screen: 'amended' });

  // The lead reads the amended reason, not the original.
  await switchUser(page, 'usr_janet_kerr');
  await page.goto(CASE);
  await waitForData(page);
  const requests = page.getByTestId('involvement-requests');
  await expect(requests).toContainText('antisocial behaviour case on the upstairs flat');
  await expect(requests).toContainText('Pending');
  await page.getByTestId('notifications-bell').click();
  await expect(page.getByTestId('notifications-panel').getByTestId('notification-item').filter({ hasText: 'Mark Hepburn asked to be involved' }).first()).toBeVisible();
  await page.keyboard.press('Escape');

  // Withdraw: it leaves the lead's list as withdrawn, and they are told.
  await switchUser(page, 'usr_mark_hepburn');
  await page.goto(CASE);
  await waitForData(page);
  await page.getByTestId('involve-withdraw').click();
  await page.getByTestId('involve-withdraw-reason').fill('The tenancy has transferred to another team.');
  await page.getByTestId('involve-withdraw-submit').click();
  await expect(page.getByText('Request withdrawn').last()).toBeVisible();
  await expect(page.getByTestId('your-involvement-request')).toHaveCount(0);
  // Having withdrawn it, they may ask again.
  await expect(page.getByTestId('ask-to-be-involved')).toBeVisible();
  await capture(page, { phase: PHASE, screen: 'withdrawn' });

  await switchUser(page, 'usr_janet_kerr');
  await page.goto(CASE);
  await waitForData(page);
  await expect(page.getByTestId('involvement-requests')).toContainText('Withdrawn');
  await expect(page.getByTestId('involvement-requests')).toContainText('The tenancy has transferred');
  await expect(page.getByTestId('involvement-requests').getByRole('button', { name: 'Accept' })).toHaveCount(0);
  await page.getByTestId('notifications-bell').click();
  await expect(page.getByTestId('notifications-panel').getByTestId('notification-item').filter({ hasText: 'Mark Hepburn withdrew their request to be involved' }).first()).toBeVisible();
});
