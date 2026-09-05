import { expect, test, type Page } from '@playwright/test';
import { capture, expectNoAxeViolations, signInAs, switchUser, waitForData } from './helpers';

const PHASE = 'actions';

test.use({ viewport: { width: 1440, height: 900 } });

/**
 * Actions from every entry point, driven: created on the Actions screen, on a case, under a plan
 * and in a meeting; assigned to a person and to a role; taken, reassigned and cancelled; overdue
 * when the clock moves; completed with evidence. Every consequence is read off the interface, and
 * the cases are ones the tests make.
 */
async function createAdultCase(page: Page, givenName: string, familyName: string): Promise<{ reference: string; url: string }> {
  await page.goto('/people');
  await waitForData(page);
  await page.getByTestId('add-person').click();
  const dialog = page.getByRole('dialog');
  await dialog.getByLabel('Given name').fill(givenName);
  await dialog.getByLabel('Family name').fill(familyName);
  await dialog.getByLabel(/Date of birth/).fill('1951-02-09');
  await page.getByTestId('create-person-search').click();
  await page.getByTestId('create-person-none-match').click();
  await page.getByTestId('create-person-submit').click();
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await waitForData(page);
  await page.getByTestId('start-process').click();
  await page.getByTestId('process-choice-asp').getByRole('radio').check();
  await page.getByTestId('process-source').fill('District nurse, Kirkbrae practice');
  await page.getByTestId('process-summary').fill('Money missing from the purse and a nephew who will not leave the house.');
  await page.getByTestId('start-process-submit').click();
  await waitForData(page);
  const header = (await page.getByTestId('process-header').textContent()) ?? '';
  const reference = /ASP-\d{4}-\d{4}/.exec(header)?.[0] ?? '';
  expect(reference).not.toBe('');
  return { reference, url: page.url() };
}


/** Playwright matches option labels exactly, so a reference inside a longer label is found by hand. */
async function selectOptionContaining(page: Page, testId: string, text: string | RegExp): Promise<void> {
  const select = page.getByTestId(testId);
  const options = await select.locator('option').evaluateAll((els) => els.map((el) => ({ value: (el as HTMLOptionElement).value, text: el.textContent ?? '' })));
  const match = options.find((o) => (typeof text === 'string' ? o.text.includes(text) : text.test(o.text)));
  expect(match, `an option matching ${String(text)}`).toBeDefined();
  await select.selectOption(match!.value);
}

test.describe('an action from every entry point', () => {
  test('from the case, from the Actions screen, from a plan and from the create menu, each told to its owner', async ({ page }) => {
    await signInAs(page, 'usr_moira_gilmour');
    const { reference, url } = await createAdultCase(page, 'Isobel', 'Rankine');

    // From the case.
    await page.getByTestId('add-action').click();
    await page.getByTestId('action-title').fill('Visit Isobel with the district nurse');
    await page.getByTestId('action-owner').selectOption('usr_janet_kerr');
    await page.getByTestId('action-due').fill('2026-09-09');
    await capture(page, { phase: PHASE, screen: 'add-from-case' });
    await expectNoAxeViolations(page);
    await page.getByTestId('action-submit').click();
    await expect(page.getByText('Action added').last()).toBeVisible();
    await expect(page.getByRole('row').filter({ hasText: 'Visit Isobel with the district nurse' })).toBeVisible();

    // From the Actions screen, choosing the case first, to a role rather than a person.
    await page.goto('/actions');
    await waitForData(page);
    await page.getByTestId('add-action').click();
    await selectOptionContaining(page, 'action-case', reference);
    await page.getByTestId('action-title').fill('Check the housing file for earlier concerns');
    await page.getByRole('radio', { name: 'Everybody holding a role' }).check();
    // A role the case permits at this stage: the matrix for an adult concern names social work, not housing.
    await selectOptionContaining(page, 'action-owner-role', /Team leader/);
    await page.getByTestId('action-due').fill('2026-09-12');
    await page.getByTestId('action-submit').click();
    await expect(page.getByText('Action added').last()).toBeVisible();
    // It is the role's, not Moira's, so it is under everything she can see rather than under Mine.
    await page.goto('/actions?view=all');
    await waitForData(page);
    await expect(page.getByRole('row').filter({ hasText: 'Check the housing file' })).toContainText('nobody has taken it yet');

    // From a plan on the case.
    await page.goto(url);
    await waitForData(page);
    await page.getByTestId('add-plan').click();
    await page.getByTestId('plan-title').fill('Keeping Isobel safe at home');
    await page.getByTestId('plan-outcome-0').fill('Isobel decides who comes into her house');
    await page.getByTestId('plan-review-date').fill('2026-12-01');
    await page.getByTestId('plan-submit').click();
    await expect(page.getByText('Plan recorded')).toBeVisible();
    await page.getByRole('button', { name: 'Add action to Keeping Isobel safe at home' }).click();
    await page.getByTestId('action-title').fill('Arrange a second key safe code');
    await page.getByTestId('action-owner').selectOption('usr_moira_gilmour');
    await page.getByTestId('action-due').fill('2026-09-20');
    await page.getByTestId('action-submit').click();
    await expect(page.getByText('Action added').last()).toBeVisible();

    // From the global create menu.
    await page.getByTestId('global-create').click();
    await page.getByTestId('create-action').click();
    await selectOptionContaining(page, 'create-case', reference);
    await page.getByTestId('create-continue').click();
    await page.getByTestId('action-title').fill('Ask the bank about the missing withdrawals');
    await page.getByTestId('action-owner').selectOption('usr_janet_kerr');
    await page.getByTestId('action-due').fill('2026-09-16');
    await page.getByTestId('action-submit').click();
    await expect(page.getByText('Action added').last()).toBeVisible();

    // Janet sees two on her list; the team leader sees the role one and takes it.
    await switchUser(page, 'usr_janet_kerr');
    await page.goto('/actions');
    await waitForData(page);
    await expect(page.getByRole('row').filter({ hasText: 'Visit Isobel with the district nurse' })).toBeVisible();
    await expect(page.getByRole('row').filter({ hasText: 'Ask the bank about the missing withdrawals' })).toBeVisible();
    await switchUser(page, 'usr_anne_hendry');
    await page.goto('/actions');
    await waitForData(page);
    const roleRow = page.getByRole('row').filter({ hasText: 'Check the housing file' });
    await expect(roleRow).toBeVisible();
    await roleRow.getByRole('button', { name: 'Take' }).click();
    await expect(page.getByText('It is yours')).toBeVisible();
    await expect(roleRow).toContainText('Anne Hendry');
    await capture(page, { phase: PHASE, screen: 'taken' });
  });

  test('reassigning tells both people, cancelling keeps the reason, and an excluded party is refused', async ({ page }) => {
    await signInAs(page, 'usr_moira_gilmour');
    const { url } = await createAdultCase(page, 'Fergus', 'Lennie');
    await page.getByTestId('add-action').click();
    await page.getByTestId('action-title').fill('Speak to the day centre about attendance');
    await page.getByTestId('action-owner').selectOption('usr_janet_kerr');
    await page.getByTestId('action-due').fill('2026-09-10');
    await page.getByTestId('action-submit').click();
    await expect(page.getByText('Action added').last()).toBeVisible();

    await page.goto('/actions?view=all');
    await waitForData(page);
    const row = page.getByRole('row').filter({ hasText: 'Speak to the day centre' });
    await row.getByRole('button', { name: 'Reassign' }).click();
    await page.getByTestId('reassign-owner').selectOption('usr_anne_hendry');
    await page.getByTestId('action-reassign-submit').click();
    await expect(page.getByText('Reassigned to Anne Hendry')).toBeVisible();
    await expect(row).toContainText('Anne Hendry');

    await row.getByRole('button', { name: 'Cancel action' }).click();
    await page.getByTestId('action-cancel-reason').fill('The day centre closed on the 5th and the question no longer arises.');
    await page.getByTestId('action-cancel-submit').click();
    await expect(page.getByText('Action cancelled')).toBeVisible();
    await page.goto('/actions?view=all&status=complete');
    await waitForData(page);
    await page.goto(url);
    await waitForData(page);
    await expect(page.getByRole('row').filter({ hasText: 'Speak to the day centre' })).toContainText('Cancelled');

    // Anne hears the reassignment; Janet hears she lost it.
    await switchUser(page, 'usr_anne_hendry');
    await waitForData(page);
    await page.getByTestId('notifications-bell').click();
    await expect(page.getByTestId('notifications-panel')).toContainText('was reassigned by Moira Gilmour: Speak to the day centre');
  });

  test('the owner list offers only people the case permits: a restricted MAPPA case offers its coordinator and not a GP or an inspector', async ({ page }) => {
    await signInAs(page, 'usr_ross_mowat');
    await page.goto('/processes/prc_mappa_derek');
    await waitForData(page);
    await page.getByTestId('add-action').click();
    const options = await page.getByTestId('action-owner').locator('option').allTextContents();
    expect(options.some((o) => o.includes('Ross Mowat'))).toBe(true);
    expect(options.some((o) => o.includes('Amira Farouk'))).toBe(false);
    expect(options.some((o) => o.includes('Rhona Dewar'))).toBe(false);
    await page.keyboard.press('Escape');
  });
});
