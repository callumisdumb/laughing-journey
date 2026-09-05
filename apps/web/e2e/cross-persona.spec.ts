import { expect, test, type Page } from '@playwright/test';
import { capture, expectNoAxeViolations, signInAs, switchUser, waitForData } from './helpers';

const PHASE = 'cross-persona';

test.use({ viewport: { width: 1440, height: 900 } });

/**
 * The proof that a thing works: a second persona sees every consequence of the first persona's act.
 *
 * Nothing here touches a seeded case. Moira creates a person through the duplicate search, opens
 * an adult concern on them, assigns Janet an action, and the test follows the assignment across the
 * bell, the panel, Home, the worklist and the case's drawer as Janet, then follows the completion
 * back to Moira, then moves the clock and follows the overdue notice to both. Every step is asserted
 * against the interface, not the store.
 */
async function unreadCount(page: Page): Promise<number> {
  const badge = page.getByTestId('notifications-unread');
  if ((await badge.count()) === 0) return 0;
  const text = (await badge.textContent()) ?? '0';
  return Number.parseInt(text.replace(/\D/g, ''), 10) || 0;
}

async function createAdult(page: Page, givenName: string, familyName: string): Promise<void> {
  await page.goto('/people');
  await waitForData(page);
  await page.getByTestId('add-person').click();
  const dialog = page.getByRole('dialog');
  await dialog.getByLabel('Given name').fill(givenName);
  await dialog.getByLabel('Family name').fill(familyName);
  // The date of birth is part of the search, because it is part of what makes two records the same
  // person; typed after the candidates have been seen it sends the flow back to the start.
  await dialog.getByLabel(/Date of birth/).fill('1949-04-18');
  await page.getByTestId('create-person-search').click();
  await page.getByTestId('create-person-none-match').click();
  await page.getByTestId('create-person-submit').click();
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await waitForData(page);
  await expect(page.getByRole('heading', { name: new RegExp(`${givenName} ${familyName}`) })).toBeVisible();
}

async function openAdultConcern(page: Page): Promise<string> {
  await page.getByTestId('start-process').click();
  await page.getByTestId('process-choice-asp').getByRole('radio').check();
  await page.getByTestId('process-source').fill('Community nurse, Kirkbrae practice');
  await page.getByTestId('process-summary').fill('Unexplained bruising noticed on a routine visit and a reluctance to say how it happened.');
  await page.getByTestId('start-process-submit').click();
  await waitForData(page);
  const header = await page.getByTestId('process-header').textContent();
  const match = /ASP-\d{4}-\d{4}/.exec(header ?? '');
  expect(match, 'the new case shows its reference in the header').not.toBeNull();
  return match![0];
}

async function addAction(page: Page, title: string, ownerId: string, due: string): Promise<void> {
  await page.getByTestId('add-action').click();
  const dialog = page.getByRole('dialog');
  await expect(dialog).toBeVisible();
  await page.getByTestId('action-title').fill(title);
  await page.getByTestId('action-owner').selectOption(ownerId);
  await page.getByTestId('action-due').fill(due);
  await page.getByTestId('action-submit').click();
  await expect(page.getByRole('dialog')).toHaveCount(0);
}

test('an action assigned by Moira is seen, completed and reported back by Janet, and its overdue twin reaches both when the clock moves', async ({ page }) => {
  // Janet's bell before anything happens, so every later count is relative to what the seed gave her.
  await signInAs(page, 'usr_janet_kerr');
  await page.goto('/');
  await waitForData(page);
  const janetBefore = await unreadCount(page);

  // Moira: a new person, a new adult concern, and an action for Janet due tomorrow.
  await switchUser(page, 'usr_moira_gilmour');
  await waitForData(page);
  await createAdult(page, 'Ailsa', 'Muir');
  const reference = await openAdultConcern(page);
  const caseUrl = page.url();
  await addAction(page, 'Arrange an advocate for Ailsa', 'usr_janet_kerr', '2026-09-03');
  await addAction(page, 'Request the GP summary', 'usr_janet_kerr', '2026-09-03');
  await expect(page.getByText('Arrange an advocate for Ailsa')).toBeVisible();
  const moiraBefore = await unreadCount(page);

  // Janet: the bell, the panel, Home, the worklist and the drawer all carry the assignment.
  await switchUser(page, 'usr_janet_kerr');
  await waitForData(page);
  expect(await unreadCount(page)).toBe(janetBefore + 2);
  await page.getByTestId('notifications-bell').click();
  const panel = page.getByTestId('notifications-panel');
  await expect(panel).toBeVisible();
  const group = panel.getByTestId('notification-group').filter({ hasText: reference });
  await expect(group).toBeVisible();
  await expect(group).toContainText('Moira Gilmour assigned you an action');
  await expect(group).toContainText('Arrange an advocate for Ailsa');
  await expect(group).toContainText('OFFICIAL-SENSITIVE');
  await capture(page, { phase: PHASE, screen: 'janet-panel' });
  await expectNoAxeViolations(page);
  await page.keyboard.press('Escape');

  await expect(page.getByTestId('home-notifications')).toContainText('Arrange an advocate for Ailsa');
  await page.goto('/worklist');
  await waitForData(page);
  const row = page.getByRole('row').filter({ hasText: 'Arrange an advocate for Ailsa' });
  await expect(row).toBeVisible();
  await expect(row).toContainText('03 Sep 2026');
  await page.goto(caseUrl);
  await waitForData(page);
  await expect(page.getByTestId('drawer-notifications')).toContainText('Arrange an advocate for Ailsa');

  // Janet opens it from the bell, which marks it read, and completes it with evidence.
  await page.getByTestId('notifications-bell').click();
  await page.getByTestId('notifications-panel').getByRole('button', { name: /Arrange an advocate for Ailsa/ }).first().click();
  await waitForData(page);
  expect(await unreadCount(page)).toBe(janetBefore + 1);
  const actionRow = page.locator('[id^="action-"]').filter({ hasText: 'Arrange an advocate for Ailsa' }).first();
  await actionRow.getByRole('button', { name: 'Complete' }).click();
  await page.getByLabel('Evidence of completion').fill('Independent advocacy referral made on 3 September; first visit booked for the 8th.');
  await page.getByRole('button', { name: 'Mark complete' }).click();
  await expect(page.getByText('Action complete')).toBeVisible();

  // Moira: one unread completion, and the action shows Janet's evidence and the time.
  await switchUser(page, 'usr_moira_gilmour');
  await waitForData(page);
  expect(await unreadCount(page)).toBe(moiraBefore + 1);
  await page.getByTestId('notifications-bell').click();
  await expect(page.getByTestId('notifications-panel')).toContainText('Janet Kerr completed an action');
  await page.keyboard.press('Escape');
  await page.goto('/actions?status=complete&view=all');
  await waitForData(page);
  const done = page.locator('[id^="action-"]').filter({ hasText: 'Arrange an advocate for Ailsa' }).first();
  await expect(done).toContainText('Complete');
  await expect(done).toContainText('Independent advocacy referral made on 3 September');
  await expect(done).toContainText('02 Sep 2026');

  // The clock moves a week: the uncompleted twin is overdue to Janet as owner and to Moira as lead,
  // and the worklist puts it first.
  await page.keyboard.press('Control+Shift+D');
  await expect(page.getByTestId('demo-panel')).toBeVisible();
  await page.getByRole('button', { name: 'On a week' }).click();
  await page.keyboard.press('Escape');
  await page.getByTestId('notifications-bell').click();
  await expect(page.getByTestId('notifications-panel')).toContainText('An action on');
  await expect(page.getByTestId('notifications-panel')).toContainText('is overdue: Request the GP summary');
  await page.keyboard.press('Escape');

  await switchUser(page, 'usr_janet_kerr');
  await waitForData(page);
  await page.getByTestId('notifications-bell').click();
  await expect(page.getByTestId('notifications-panel')).toContainText('is overdue: Request the GP summary');
  await page.keyboard.press('Escape');
  await page.goto('/worklist');
  await waitForData(page);
  const first = page.getByRole('row').nth(1);
  await expect(first).toContainText('Request the GP summary');
  await capture(page, { phase: PHASE, screen: 'janet-worklist-overdue' });
});
