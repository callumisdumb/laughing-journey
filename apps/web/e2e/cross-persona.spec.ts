import { expect, test, type Page } from '@playwright/test';
import { createPerson, startCase } from './driven';
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


/**
 * Switch persona the way the demonstration does, through the demo panel, which keeps the demo clock
 * where it was. Rewriting the session in storage would put the clock back to the seed.
 */
async function switchPersona(page: Page, userId: string): Promise<void> {
  await page.keyboard.press('Control+Shift+D');
  await expect(page.getByTestId('demo-panel')).toBeVisible();
  await page.getByTestId(`persona-${userId}`).click();
  await waitForData(page);
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

async function openAdultConcern(page: Page): Promise<{ reference: string; marking: string | null }> {
  await page.getByTestId('start-process').click();
  await page.getByTestId('process-choice-asp').getByRole('radio').check();
  await page.getByTestId('process-source').fill('Community nurse, Kirkbrae practice');
  await page.getByTestId('process-summary').fill('Unexplained bruising noticed on a routine visit and a reluctance to say how it happened.');
  await page.getByTestId('start-process-submit').click();
  await waitForData(page);
  const header = await page.getByTestId('process-header').textContent();
  const match = /ASP-\d{4}-\d{4}/.exec(header ?? '');
  expect(match, 'the new case shows its reference in the header').not.toBeNull();
  // The marking the case carries, if any: routine Official carries none by design (D-058), so the
  // panel is held to whatever the record header shows rather than to a marking assumed.
  const marking = /OFFICIAL-SENSITIVE/.exec(header ?? '')?.[0] ?? null;
  return { reference: match![0], marking };
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
  await switchPersona(page, 'usr_moira_gilmour');
  await createAdult(page, 'Ailsa', 'Muir');
  const { reference, marking } = await openAdultConcern(page);
  const caseUrl = page.url();
  await addAction(page, 'Arrange an advocate for Ailsa', 'usr_janet_kerr', '2026-09-03');
  await addAction(page, 'Request the GP summary', 'usr_janet_kerr', '2026-09-03');
  await expect(page.getByText('Arrange an advocate for Ailsa')).toBeVisible();
  const moiraBefore = await unreadCount(page);

  // Janet: the bell, the panel, Home, the worklist and the drawer all carry the assignment.
  await switchPersona(page, 'usr_janet_kerr');
  expect(await unreadCount(page)).toBe(janetBefore + 2);
  await page.getByTestId('notifications-bell').click();
  const panel = page.getByTestId('notifications-panel');
  await expect(panel).toBeVisible();
  const group = panel.getByTestId('notification-group').filter({ hasText: reference });
  await expect(group).toBeVisible();
  await expect(group).toContainText('Moira Gilmour assigned you an action');
  await expect(group).toContainText('Arrange an advocate for Ailsa');
  if (marking) await expect(group).toContainText(marking);
  await expect(group.getByText(reference, { exact: true }).first()).toBeVisible();
  await capture(page, { phase: PHASE, screen: 'janet-panel' });
  await expectNoAxeViolations(page);
  await page.keyboard.press('Escape');

  await page.goto('/');
  await waitForData(page);
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
  await switchPersona(page, 'usr_moira_gilmour');
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

  await switchPersona(page, 'usr_janet_kerr');
  await page.getByTestId('notifications-bell').click();
  await expect(page.getByTestId('notifications-panel')).toContainText('is overdue: Request the GP summary');
  await page.keyboard.press('Escape');
  await page.goto('/worklist');
  await waitForData(page);
  // Overdue items move to the front: the new twin is overdue, and nothing before it is on time.
  const gpRow = page.getByRole('row').filter({ hasText: 'Request the GP summary' });
  await expect(gpRow).toContainText('overdue');
  const rows = await page.getByRole('row').allTextContents();
  const index = rows.findIndex((text) => text.includes('Request the GP summary'));
  expect(index).toBeGreaterThan(0);
  for (const earlier of rows.slice(1, index)) expect(earlier).toContain('overdue');
  await capture(page, { phase: PHASE, screen: 'janet-worklist-overdue' });
});

test('a request to be involved reaches the lead, the decision reaches the requester, and an accepted one opens the case to them', async ({ page }) => {
  test.setTimeout(180_000);
  // Priya notifies a MAPPA case, which is restricted: a head teacher can see that it exists and
  // no more. Her request carries a reason; Priya reads it on the case and accepts; the next time
  // the head teacher opens the case she is on it, with her own reason on the membership. A second
  // request is declined with a note, and the decline reaches its requester too.
  await signInAs(page, 'usr_priya_sharif');
  await createPerson(page, 'Kyle', 'Rennie', '1981-03-09');
  const reference = await startCase(page, 'mappa', 'Police Scotland, sex offender liaison', 'Released on licence on 21 Aug 2026; registered sex offender; living two streets from a primary school.');
  const caseUrl = page.url();

  await switchUser(page, 'usr_claire_cowan');
  await page.goto(caseUrl);
  await waitForData(page);
  await expect(page.getByText(/restricted record/i).first()).toBeVisible();
  await page.getByTestId('ask-to-be-involved').click();
  await page.getByTestId('involve-reason').fill('He has been seen at the school gate at home time twice this week, and the school needs to know what the licence allows.');
  await expectNoAxeViolations(page);
  await capture(page, { phase: PHASE, screen: 'ask-to-be-involved' });
  await page.getByTestId('involve-submit').click();
  await expect(page.getByTestId('involve-pending')).toContainText('Waiting on Priya Sharif');
  await expect(page.getByTestId('ask-to-be-involved')).toHaveCount(0);

  // Priya is told, reads the reason on the case, and accepts.
  await switchUser(page, 'usr_priya_sharif');
  await page.goto('/');
  await waitForData(page);
  await page.getByTestId('notifications-bell').click();
  await page.getByTestId('notifications-panel').getByTestId('notification-item').filter({ hasText: `Claire Cowan asked to be involved in ${reference}` }).getByRole('button').first().click();
  await waitForData(page);
  await expect(page).toHaveURL(caseUrl);
  const requests = page.getByTestId('involvement-requests');
  await expect(requests).toContainText('school gate at home time');
  await expect(requests).toContainText('1 pending');
  await capture(page, { phase: PHASE, screen: 'involvement-requests', fullPage: true });
  await requests.getByRole('button', { name: 'Accept' }).click();
  await expect(page.getByText('Request accepted').first()).toBeVisible();
  await expect(requests).toContainText('none pending');
  await expect(page.getByText('Asked to be involved: He has been seen at the school gate').first()).toBeVisible();

  // Claire is told, and the case opens to her, with her reason on her membership.
  await switchUser(page, 'usr_claire_cowan');
  await page.goto('/');
  await waitForData(page);
  await page.getByTestId('notifications-bell').click();
  await expect(page.getByTestId('notifications-panel').getByTestId('notification-item').filter({ hasText: `Your request to be involved in ${reference} was accepted` })).toBeVisible();
  await page.keyboard.press('Escape');
  await page.goto(caseUrl);
  await waitForData(page);
  await expect(page.getByText(/not on the distribution list/i)).toHaveCount(0);
  await expect(page.getByTestId('process-header')).toContainText('Kyle Rennie');
  await expect(page.getByText('Asked to be involved: He has been seen at the school gate').first()).toBeVisible();
  await capture(page, { phase: PHASE, screen: 'involvement-accepted', fullPage: true });

  // A second request is declined with a note, and the requester is told that too.
  await switchUser(page, 'usr_gavin_brodie');
  await page.goto(caseUrl);
  await waitForData(page);
  await page.getByTestId('ask-to-be-involved').click();
  await page.getByTestId('involve-reason').fill('Concern hub triage would like sight of the licence conditions.');
  await page.getByTestId('involve-submit').click();
  await expect(page.getByTestId('involve-pending')).toBeVisible();

  await switchUser(page, 'usr_priya_sharif');
  await page.goto(caseUrl);
  await waitForData(page);
  const pending = page.getByTestId('involvement-requests').locator('[data-state="pending"]');
  await pending.getByTestId(/^involve-note-/).fill('Not needed for triage; the hub gets the notification it needs.');
  await pending.getByRole('button', { name: 'Decline' }).click();
  await expect(page.getByText('Request declined').first()).toBeVisible();

  await switchUser(page, 'usr_gavin_brodie');
  await page.goto('/');
  await waitForData(page);
  await page.getByTestId('notifications-bell').click();
  await expect(page.getByTestId('notifications-panel').getByTestId('notification-item').filter({ hasText: `Your request to be involved in ${reference} was declined` })).toBeVisible();
  await page.keyboard.press('Escape');
  await page.goto(caseUrl);
  await waitForData(page);
  await expect(page.getByText(/restricted record/i).first()).toBeVisible();
  await expect(page.getByTestId('ask-to-be-involved')).toBeVisible();
});
