import { expect, type Page } from '@playwright/test';
import { waitForData } from './helpers';

/**
 * The helpers a driven spec uses to make its own case (D-210): a person through the duplicate
 * search, a case on them through the eligibility and permission gates, a persona switch that
 * keeps the demo clock, and a select that finds an option by part of its label.
 */
export async function createPerson(page: Page, givenName: string, familyName: string, dateOfBirth: string): Promise<void> {
  await page.goto('/people');
  await waitForData(page);
  await page.getByTestId('add-person').click();
  const dialog = page.getByRole('dialog');
  await dialog.getByLabel('Given name').fill(givenName);
  await dialog.getByLabel('Family name').fill(familyName);
  // The date of birth is part of the search, because it is part of what makes two records the same
  // person; typed after the candidates have been seen it sends the flow back to the start.
  await dialog.getByLabel(/Date of birth/).fill(dateOfBirth);
  await page.getByTestId('create-person-search').click();
  await page.getByTestId('create-person-none-match').click();
  await page.getByTestId('create-person-submit').click();
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await waitForData(page);
  await expect(page.getByRole('heading', { name: new RegExp(`${givenName} ${familyName}`) })).toBeVisible();
}

export async function startCase(page: Page, type: 'asp' | 'cp' | 'marac' | 'mappa' | 'awi', source: string, summary: string): Promise<string> {
  await page.getByTestId('start-process').click();
  await page.getByTestId(`process-choice-${type}`).getByRole('radio').check();
  await page.getByTestId('process-source').fill(source);
  await page.getByTestId('process-summary').fill(summary);
  await page.getByTestId('start-process-submit').click();
  await waitForData(page);
  const header = (await page.getByTestId('process-header').textContent()) ?? '';
  const reference = new RegExp(`${type.toUpperCase()}-\\d{4}-\\d{4}`).exec(header)?.[0] ?? '';
  expect(reference, 'the new case shows its reference in the header').not.toBe('');
  return reference;
}

/**
 * Switch persona the way the demonstration does, through the demo panel, which keeps the demo
 * clock where it was. Rewriting the session in storage would put the clock back to the seed.
 * Only the demonstration's personas are on the panel; for anybody else use `switchUser`.
 */
export async function switchPersona(page: Page, userId: string): Promise<void> {
  await page.keyboard.press('Control+Shift+D');
  await expect(page.getByTestId('demo-panel')).toBeVisible();
  await page.getByTestId(`persona-${userId}`).click();
  await waitForData(page);
}

/** Playwright matches option labels exactly, so a reference inside a longer label is found by hand. */
export async function selectOptionContaining(page: Page, testId: string, text: string | RegExp): Promise<void> {
  const select = page.getByTestId(testId);
  const options = await select.locator('option').evaluateAll((els) => els.map((el) => ({ value: (el as HTMLOptionElement).value, text: el.textContent ?? '' })));
  const match = options.find((o) => (typeof text === 'string' ? o.text.includes(text) : text.test(o.text)));
  expect(match, `an option matching ${String(text)}`).toBeDefined();
  await select.selectOption(match!.value);
}

export async function unreadCount(page: Page): Promise<number> {
  const badge = page.getByTestId('notifications-unread');
  if ((await badge.count()) === 0) return 0;
  return Number.parseInt(((await badge.textContent()) ?? '0').replace(/\D/g, ''), 10) || 0;
}

/** Open a transition from the what-happens-next panel on the case screen. */
export async function openTransition(page: Page, transitionId: string): Promise<void> {
  await page.getByTestId(`next-${transitionId}-button`).click();
}

/** Record the transition whose form is open and wait for the toast that says it was. */
export async function submitTransition(page: Page): Promise<void> {
  await page.getByTestId('transition-submit').click();
  await expect(page.getByText(/ recorded$/).last()).toBeVisible();
  await waitForData(page);
}
