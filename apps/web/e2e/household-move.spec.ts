import { expect, test } from '@playwright/test';
import { capture, expectNoAxeViolations, signInAs, waitForData } from './helpers';

const PHASE = 'household-move';

test.use({ viewport: { width: 1440, height: 900 } });

/**
 * Moving the household (D-244), driven. Kayleigh Docherty lives with Lily and Mason. Janet moves the
 * household to a new address, leaving Lily behind with no new address known. Kayleigh and Mason move
 * with one event each on their own chronologies; Lily leaves the household with her own event and
 * no address; everybody's address history is kept.
 */
test('everybody moves on one date to one address, a named person stays behind, and each record carries its own event', async ({ page }) => {
  await signInAs(page, 'usr_janet_kerr');
  await page.goto('/people/per_kayleigh_docherty');
  await waitForData(page);
  const card = page.getByTestId('household-members');
  await expect(card).toContainText('Lily Docherty');
  await expect(card).toContainText('Mason Docherty');
  await page.getByTestId('household-move-all').click();
  const dialog = page.getByRole('dialog');
  await expect(dialog).toContainText('3 people live here');
  await expect(page.getByTestId('move-household-submit')).toBeDisabled();
  await page.getByTestId('move-household-to').selectOption({ index: 1 });
  const chosen = await page.getByTestId('move-household-to').locator('option:checked').textContent();
  await expect(page.getByTestId('move-household-submit')).toContainText('Move 3 people');
  await page.getByTestId('move-member-per_lily_docherty-moves').uncheck();
  await expect(page.getByTestId('move-member-per_lily_docherty')).toContainText('Lily Docherty stays behind');
  await expect(page.getByTestId('move-member-per_lily_docherty-address')).toBeVisible();
  await expect(page.getByTestId('move-household-submit')).toContainText('Move 2 people');
  await page.getByTestId('move-household-note').fill('Moved under the housing transfer agreed at MARAC.');
  await expectNoAxeViolations(page);
  await capture(page, { phase: PHASE, screen: 'move-household-dialog' });
  await page.getByTestId('move-household-submit').click();
  await expect(page.getByText('Household moved').last()).toBeVisible();
  await expect(page.getByText(/2 people moved to .* 1 stayed behind\./).last()).toBeVisible();

  // The household is at the new address with two members; Lily is a past member.
  await expect(page.getByTestId('household-members')).toContainText('Mason Docherty');
  await expect(page.getByTestId('household-members')).not.toContainText('Lily Docherty');
  await expect(page.getByText(chosen!.trim()).first()).toBeVisible();
  await capture(page, { phase: PHASE, screen: 'moved' });

  // One event per person who moved, on their own chronology, naming the address.
  for (const id of ['per_kayleigh_docherty', 'per_mason_docherty']) {
    await page.goto(`/people/${id}/chronology`);
    await waitForData(page);
    await expect(page.getByRole('row').filter({ hasText: 'moved to' }).first()).toContainText(chosen!.trim());
  }
  // Lily left the household, with no new address, and the record says so rather than inventing one.
  await page.goto('/people/per_lily_docherty/chronology');
  await waitForData(page);
  await expect(page.getByRole('row').filter({ hasText: 'left the household' }).first()).toBeVisible();
  await page.goto('/people/per_lily_docherty');
  await waitForData(page);
  await expect(page.getByText('No address recorded').first()).toBeVisible();
});
