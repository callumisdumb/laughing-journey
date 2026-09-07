import { expect, test } from '@playwright/test';
import { capture, expectNoAxeViolations, signInAs, waitForData } from './helpers';

const PHASE = 'action-owners';
const RECEIPT = { name: 'boiler-repair.txt', mimeType: 'text/plain', buffer: Buffer.from('Dunlarrick Heating. Job 4471, boiler serviced and certified, 6 September 2026.\n') };

test.use({ viewport: { width: 1440, height: 900 } });

/**
 * An action given to somebody outside the partnership, an action that repeats, and evidence that is
 * a file rather than a sentence (D-250), driven. Nothing is sent outside, so the case names who here
 * is chasing it. Completing a repeating action creates the next one, counted from the due date.
 */
test('an action goes to a landlord, the case says who is chasing it, and the evidence is a file', async ({ page }) => {
  await signInAs(page, 'usr_moira_gilmour');
  await page.goto('/processes/prc_asp_marion');
  await waitForData(page);
  await page.getByTestId('add-action').click();
  await page.getByTestId('action-title').fill('Service the boiler and certify it');
  await page.getByRole('radio', { name: 'Somebody outside the partnership' }).check();
  await expect(page.getByRole('dialog')).toContainText('Nothing is sent to them');
  await page.getByTestId('action-external-name').fill('Dunlarrick Heating');
  await page.getByTestId('action-external-organisation').fill('Portlennan Housing Association');
  await page.getByTestId('action-external-contact').fill('01700 449 118');
  await page.getByTestId('action-chased-by').selectOption('usr_moira_gilmour');
  await page.getByTestId('action-due').fill('2026-09-14');
  await expectNoAxeViolations(page);
  await capture(page, { phase: PHASE, screen: 'external-owner' });
  await page.getByTestId('action-submit').click();
  await expect(page.getByText('Action added').last()).toBeVisible();

  // The case's table lists it; the owner meta and the completion sit on the Actions screen.
  await page.goto('/actions');
  await waitForData(page);
  const row = page.getByRole('row').filter({ hasText: 'Service the boiler and certify it' });
  await expect(row).toContainText('Dunlarrick Heating, Portlennan Housing Association');
  await expect(row).toContainText('Outside the partnership. Moira Gilmour is chasing it.');
  await expect(row).toContainText('Contact: 01700 449 118');

  // Evidence of a job done outside is a document, not a sentence somebody typed from memory.
  await row.getByRole('button', { name: 'Complete' }).click();
  await page.getByLabel('Evidence of completion').fill('Serviced and certified. Landlord sent the certificate.');
  await page.getByTestId('attach-action').click();
  await page.getByTestId('attach-file').setInputFiles(RECEIPT);
  await page.getByTestId('attach-submit').click();
  await expect(page.getByText('File attached').last()).toBeVisible();
  await expect(page.getByTestId('documents-action')).toContainText('boiler-repair.txt');
  await capture(page, { phase: PHASE, screen: 'evidence-file' });
  await page.getByRole('button', { name: 'Mark complete' }).click();
  await expect(page.getByText('Action complete').last()).toBeVisible();
});

test('a repeating action creates the next one on completion, counted from the due date, and stops at its end date', async ({ page }) => {
  await signInAs(page, 'usr_moira_gilmour');
  await page.goto('/processes/prc_asp_marion');
  await waitForData(page);
  await page.getByTestId('add-action').click();
  await page.getByTestId('action-title').fill('Weekly welfare call to Marion');
  await page.getByTestId('action-owner').selectOption('usr_moira_gilmour');
  await page.getByTestId('action-due').fill('2026-09-09');
  await page.getByTestId('action-repeats').check();
  await page.getByTestId('action-every').fill('1');
  await page.getByTestId('action-unit').selectOption('weeks');
  await page.getByTestId('action-until').fill('2026-09-20');
  await capture(page, { phase: PHASE, screen: 'repeating' });
  await page.getByTestId('action-submit').click();
  await expect(page.getByText('Action added').last()).toBeVisible();

  await page.goto('/actions');
  await waitForData(page);
  const first = page.getByRole('row').filter({ hasText: 'Weekly welfare call to Marion' });
  await expect(first).toContainText('First of a series');
  await expect(first).toContainText('Repeats every week, until 20 Sep 2026');

  // Completing it makes the next one, a week after the one just done rather than a week from today.
  await first.getByRole('button', { name: 'Complete' }).click();
  await page.getByLabel('Evidence of completion').fill('Called. She is eating and the nephew has not been back.');
  await page.getByRole('button', { name: 'Mark complete' }).click();
  await expect(page.getByText('Next one created, due 16 Sep 2026.').last()).toBeVisible();
  const second = page.getByRole('row').filter({ hasText: 'Weekly welfare call to Marion' }).filter({ hasText: 'One of a series' });
  await expect(second).toContainText('16 Sep 2026');
  await capture(page, { phase: PHASE, screen: 'next-occurrence' });

  // The one after that would fall on 23 Sep, past the end date, so the series stops.
  await second.getByRole('button', { name: 'Complete' }).click();
  await page.getByLabel('Evidence of completion').fill('Called. No change, and the support plan review is next week.');
  await page.getByRole('button', { name: 'Mark complete' }).click();
  await expect(page.getByText('That was the last of the series.').last()).toBeVisible();
});
