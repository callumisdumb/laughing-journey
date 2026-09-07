import { expect, test } from '@playwright/test';
import { capture, expectNoAxeViolations, signInAs, waitForData } from './helpers';

const PHASE = 'external-request';

test.use({ viewport: { width: 1440, height: 900 } });

/**
 * Asking an agency nobody here holds a role in, and recording what came back (D-249), driven.
 * Until now a pre-meeting request could only be addressed to a persona in the seed, which left the
 * private provider, the out-of-area team and the advocacy service unaskable. The request now names
 * a person and an organisation instead, the product sends nothing, and whoever chased it records
 * the return on their behalf with how it reached them.
 */
test('a request goes to a private provider, and the chair records the return on their behalf', async ({ page }) => {
  await signInAs(page, 'usr_david_laird');
  await page.goto('/meetings/mtg_aiden_review');
  await waitForData(page);

  // The recipient list ends with somebody outside the partnership, and choosing it asks for a name.
  await page.getByTestId('request-to').selectOption('external');
  await expect(page.getByTestId('request-external')).toContainText('An agency nobody here holds an account for');
  await page.getByTestId('request-external-name').fill('Rhoda Buchan');
  await page.getByTestId('request-external-organisation').fill('Craiglarrick Family Support (independent)');
  await page.getByTestId('request-external-contact').fill('01700 496 021, weekdays');
  await page.getByLabel('Due (dd Mon yyyy)').fill('2026-09-18');
  await expectNoAxeViolations(page);
  await capture(page, { phase: PHASE, screen: 'external-request-form' });
  await page.getByTestId('request-send').click();

  const row = page.getByTestId('pre-meeting-request').filter({ hasText: 'Rhoda Buchan' });
  await expect(row).toContainText('outside the partnership');
  await expect(row).toContainText('Craiglarrick Family Support (independent)');

  // Nobody outside the partnership can log in, so the person who chased it records what came back.
  await row.getByTestId('record-return').click();
  await page.getByTestId('return-summary').fill('Attends the group weekly with her mother. No concerns raised since June.');
  await page.getByTestId('return-how').selectOption('telephone');
  await capture(page, { phase: PHASE, screen: 'return-dialog' });
  await page.getByRole('button', { name: 'Record return and add to pack' }).click();
  await expect(page.getByText('Return recorded and added to the pack').last()).toBeVisible();

  // The row says who recorded it and how it arrived, so the pack never reads as the provider's own entry.
  await expect(row).toContainText('Recorded by David Laird on their behalf, received by Telephone.');
  await capture(page, { phase: PHASE, screen: 'returned-on-behalf' });
});

test('a return from somebody with an account is not marked as recorded on their behalf', async ({ page }) => {
  await signInAs(page, 'usr_amira_farouk');
  await page.goto('/meetings/mtg_aiden_review');
  await waitForData(page);
  const own = page.getByTestId('pre-meeting-request').filter({ hasText: 'Dr Amira Farouk' });
  await own.getByTestId('record-return').click();
  await page.getByTestId('return-summary').fill('Nothing further to add since the last core group.');
  await page.getByRole('button', { name: 'Record return and add to pack' }).click();
  await expect(page.getByText('Return recorded and added to the pack').last()).toBeVisible();
  await expect(own).not.toContainText('on their behalf');
});
