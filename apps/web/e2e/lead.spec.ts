import { expect, test } from '@playwright/test';
import { capture, expectNoAxeViolations, signInAs, switchUser, waitForData } from './helpers';

const PHASE = 'lead';
const CASE = '/processes/prc_asp_marion';

test.use({ viewport: { width: 1440, height: 900 } });

/**
 * Reallocating the lead (D-240), driven. Stuart Blair, the second worker on Marion Fraser's adult
 * protection case and a role that may hold its lead, moves the lead from Moira Gilmour to Graeme
 * Dunlop with a reason. The header, the participants card and the drawer say so at once; the former
 * lead and the new one are each told in their own bells (the actor is never told about their own
 * act); the ledger carries the reason; and the source system is asked to record the new allocated
 * worker.
 */
test('the lead moves to somebody in the lead agency who may hold it, both are told, and the record follows', async ({ page }) => {
  await signInAs(page, 'usr_stuart_blair');
  await page.goto(CASE);
  await waitForData(page);
  await expect(page.getByTestId('process-lead')).toContainText('Lead worker Moira Gilmour');
  await page.getByTestId('reallocate-lead').click();
  const dialog = page.getByRole('dialog');
  await expect(dialog).toContainText('The lead is Moira Gilmour, in Social work');
  // Only the lead agency's lead-capable roles are offered: a children and families worker is not, nor the inspector, nor the GP, nor the lead herself.
  const options = await page.getByTestId('reallocate-to').locator('option').allTextContents();
  expect(options.some((o) => o.includes('Graeme Dunlop'))).toBe(true);
  expect(options.some((o) => o.includes('Anne Hendry'))).toBe(true);
  expect(options.some((o) => o.includes('Moira Gilmour'))).toBe(false);
  expect(options.some((o) => o.includes('Janet Kerr'))).toBe(false);
  expect(options.some((o) => o.includes('Rhona Dewar'))).toBe(false);
  expect(options.some((o) => o.includes('Amira Farouk'))).toBe(false);
  await page.getByTestId('reallocate-to').selectOption('usr_graeme_dunlop');
  await expectNoAxeViolations(page);
  await capture(page, { phase: PHASE, screen: 'reallocate-dialog' });
  await page.getByTestId('reallocate-submit').click();
  await expect(dialog).toContainText('Say why the lead is changing');
  await page.getByTestId('reallocate-reason').fill('Moira is on leave from the 8th; Graeme is already doing the capacity work with Marion.');
  await page.getByTestId('reallocate-submit').click();
  await expect(page.getByText('Lead reallocated').last()).toBeVisible();

  await expect(page.getByTestId('process-lead')).toContainText('Lead worker Graeme Dunlop');
  await expect(page.locator('[data-card="participants"]')).toContainText('Graeme Dunlop');
  await expect(page.locator('[data-card="participants"]').locator('[class*="member"]').filter({ hasText: 'Graeme Dunlop' }).first()).toContainText('Lead worker');
  // The former lead keeps her seat under her own role.
  await expect(page.locator('[data-card="participants"]').locator('[class*="member"]').filter({ hasText: 'Moira Gilmour' }).first()).toContainText('council officer');
  // The drawer's "Who is involved" says the same.
  const drawer = page.getByRole('complementary', { name: 'Context' });
  await expect(drawer.locator('[class*="member"]').filter({ hasText: 'Graeme Dunlop' }).first()).toContainText('Lead worker');
  await capture(page, { phase: PHASE, screen: 'reallocated' });
  // The outbox proposes the new allocated worker to the council system, waiting for authorisation like any write.
  await expect(page.getByTestId('outbound-status')).toContainText('Not yet written to Civica ECLIPSE');

  // The former lead hears it from her own bell.
  await switchUser(page, 'usr_moira_gilmour');
  await page.goto(CASE);
  await waitForData(page);
  await page.getByTestId('notifications-bell').click();
  await expect(page.getByTestId('notifications-panel').getByTestId('notification-item').filter({ hasText: /Stuart Blair reallocated ASP-\d{4}-\d{4} from you to Graeme Dunlop/ }).first()).toBeVisible();
  await page.keyboard.press('Escape');

  // The new lead hears it in his, and the case is his to work.
  await switchUser(page, 'usr_graeme_dunlop');
  await page.goto(CASE);
  await waitForData(page);
  await page.getByTestId('notifications-bell').click();
  await expect(page.getByTestId('notifications-panel').getByTestId('notification-item').filter({ hasText: /Stuart Blair made you the lead worker on ASP-\d{4}-\d{4}/ }).first()).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(page.getByTestId('reallocate-lead')).toBeVisible();

  await page.goto('/connectors?adapter=eclipse&tab=outbox');
  await waitForData(page);
  // Two proposals now wait on Marion's case: the seeded stage write and the allocated worker. The
  // outbox row names the intent and the person; the payload, with the new worker, is in the
  // authorisation preview.
  const proposed = page.getByRole('row').filter({ hasText: 'Proposed' }).filter({ hasText: 'Marion Fraser' });
  await expect(proposed).toHaveCount(2);
  let found = false;
  for (let i = 0; i < 2 && !found; i += 1) {
    await proposed.nth(i).getByRole('button', { name: 'Authorise' }).click();
    const preview = page.getByTestId('authorise-preview');
    await expect(preview).toBeVisible();
    found = ((await preview.textContent()) ?? '').includes('Graeme Dunlop');
    await page.keyboard.press('Escape');
    await expect(page.getByRole('dialog')).toHaveCount(0);
  }
  expect(found, 'a proposal carrying the new allocated worker').toBe(true);

  // The ledger carries the change with its reason, read by the person who made it.
  await switchUser(page, 'usr_stuart_blair');
  await page.goto('/audit');
  await waitForData(page);
  await expect(page.getByRole('row').filter({ hasText: 'Lead worker reallocated from Moira Gilmour to Graeme Dunlop' }).first()).toBeVisible();
});
