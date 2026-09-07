import { expect, test } from '@playwright/test';
import { capture, expectNoAxeViolations, signInAs, waitForData } from './helpers';

const PHASE = 'attachments';
const LETTER = { name: 'gp-letter.txt', mimeType: 'text/plain', buffer: Buffer.from('Portlennan Medical Practice. Letter of 4 September 2026 about Marion Fraser.\n') };
const TOO_BIG = { name: 'scan.bin', mimeType: 'application/octet-stream', buffer: Buffer.alloc(1_200_000, 1) };

test.use({ viewport: { width: 1440, height: 900 } });

/**
 * Attaching a file (D-243), driven. A letter goes on Marion Fraser's record, on her adult protection
 * case, on the meeting and on a chronology event. Each is listed where it was attached and on the
 * person's Documents tab, leaves with its marking in the file name, and is in the ledger as an
 * attach. A file over the cap is refused with the cap named, and the dialog says nothing scans it.
 */
test('a file attaches to a person, a case, a meeting and an event, is listed, marked on download, capped and audited', async ({ page }) => {
  await signInAs(page, 'usr_moira_gilmour');
  await page.goto('/people/per_marion_fraser');
  await waitForData(page);
  await page.getByRole('tab', { name: 'Documents' }).click();
  await expect(page.getByTestId('documents-person')).toContainText('Nothing attached.');
  await page.getByTestId('attach-person').click();
  const dialog = page.getByRole('dialog');
  await expect(dialog).toContainText('Nothing here scans the file for malware');
  await expect(dialog).toContainText('Up to 1000 kB per file and 4000 kB per record');
  await expect(page.getByTestId('attach-submit')).toBeDisabled();
  await page.getByTestId('attach-file').setInputFiles(TOO_BIG);
  await expect(page.getByTestId('attach-chosen')).toContainText('scan.bin, 1200 kB');
  await page.getByTestId('attach-submit').click();
  await expect(dialog).toContainText('The file is too large. One file can be up to 1 MB.');
  await page.getByTestId('attach-file').setInputFiles(LETTER);
  await expect(page.getByTestId('attach-chosen')).toContainText('gp-letter.txt, 1 kB');
  await page.getByTestId('attach-note').fill('GP letter about the memory clinic referral.');
  await expectNoAxeViolations(page);
  await capture(page, { phase: PHASE, screen: 'attach-dialog' });
  await page.getByTestId('attach-submit').click();
  await expect(page.getByText('File attached').last()).toBeVisible();
  const own = page.getByTestId('documents-person');
  await expect(own.getByTestId('document-item')).toHaveCount(1);
  await expect(own).toContainText('gp-letter.txt');
  await expect(own).toContainText('GP letter about the memory clinic referral.');
  await expect(own).toContainText('Added');
  await expect(own).toContainText('Moira Gilmour');
  // The file leaves with the record's marking in its name; a plain Official record leaves it as it came.
  const download = own.getByTestId('document-download');
  await expect(download).toHaveAttribute('download', /gp-letter\.txt$/);
  await expect(download).toHaveAttribute('href', /^data:text\/plain;base64,/);
  await capture(page, { phase: PHASE, screen: 'person-documents' });

  // On the case.
  await page.goto('/processes/prc_asp_marion');
  await waitForData(page);
  const caseDocs = page.locator('[data-card="documents"]');
  await expect(caseDocs).toContainText('Nothing attached.');
  await page.getByTestId('attach-process').click();
  await page.getByTestId('attach-file').setInputFiles({ ...LETTER, name: 'bank-statements.txt' });
  await page.getByTestId('attach-submit').click();
  await expect(page.getByText('File attached').last()).toBeVisible();
  await expect(caseDocs.getByTestId('document-item')).toHaveCount(1);
  await expect(caseDocs).toContainText('bank-statements.txt');
  await expect(caseDocs).toContainText('1 file, 1 kB');

  // On the meeting's pack.
  await page.goto('/meetings/mtg_marion_iad?phase=before');
  await waitForData(page);
  await page.getByTestId('attach-meeting').click();
  await page.getByTestId('attach-file').setInputFiles({ ...LETTER, name: 'council-officer-report.txt' });
  await page.getByTestId('attach-submit').click();
  await expect(page.getByText('File attached').last()).toBeVisible();
  await expect(page.getByTestId('documents-meeting')).toContainText('council-officer-report.txt');

  // On a chronology event, from the drawer.
  await page.goto('/people/per_marion_fraser/chronology');
  await waitForData(page);
  await page.getByRole('row').filter({ hasText: /Memory clinic|memory clinic/ }).first().click();
  const drawer = page.getByRole('complementary', { name: 'Context' });
  await expect(drawer.getByText('Attachments')).toBeVisible();
  await drawer.getByTestId('attach-event').click();
  await page.getByTestId('attach-file').setInputFiles({ ...LETTER, name: 'clinic-letter.txt' });
  await page.getByTestId('attach-submit').click();
  await expect(page.getByText('File attached').last()).toBeVisible();
  await expect(drawer.getByTestId('documents-event')).toContainText('clinic-letter.txt');
  await capture(page, { phase: PHASE, screen: 'event-attachment' });

  // The person's Documents tab lists all four: her own, and the three attached to records about her.
  await page.goto('/people/per_marion_fraser');
  await waitForData(page);
  await page.getByRole('tab', { name: 'Documents' }).click();
  await expect(page.getByTestId('documents-person')).toContainText('gp-letter.txt');
  const table = page.getByRole('table');
  await expect(table.getByRole('row').filter({ hasText: 'bank-statements.txt' })).toContainText(/Attached to ASP-\d{4}-\d{4}/);
  await expect(table.getByRole('row').filter({ hasText: 'council-officer-report.txt' })).toContainText('Attached to ASP inter-agency discussion');
  await expect(table.getByRole('row').filter({ hasText: 'clinic-letter.txt' })).toContainText('Attached to the event');

  // Every attach is in the ledger.
  await page.goto('/audit');
  await waitForData(page);
  await expect(page.getByRole('row').filter({ hasText: 'Attached gp-letter.txt' }).first()).toContainText('Attach');
  await expect(page.getByRole('row').filter({ hasText: 'Attached clinic-letter.txt' }).first()).toBeVisible();
});
