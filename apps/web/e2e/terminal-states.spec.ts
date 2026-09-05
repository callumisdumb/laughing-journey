import { expect, test, type Page } from '@playwright/test';
import { capture, expectNoAxeViolations, signInAs, waitForData } from './helpers';

const PHASE = 'terminal';

test.use({ viewport: { width: 1440, height: 900 } });

/** The toast region. Scoped, because a confirmation and a history entry often share their wording. */
const toast = (page: Page) => page.getByLabel('Notifications');

async function openByReference(page: Page, reference: string) {
  await page.goto('/processes?closed=1');
  await waitForData(page);
  await page.getByRole('link', { name: reference }).click();
  await waitForData(page);
}

/**
 * Editing, correcting, closing, reopening, retiring and recording a death.
 *
 * Nothing here deletes, and that is what the assertions are about: a closed case still exists and
 * can be reopened with its deadlines intact, a retired chronology entry is off the working list and
 * still in the record, and a corrected date of birth leaves the value it used to hold on screen.
 */
test.describe('closing a case', () => {
  test('offers the national list, stops the clocks, and says who will be told', async ({ page }) => {
    await signInAs(page, 'usr_janet_kerr');
    await openByReference(page, 'CP-2026-0412');

    await page.getByTestId('close-process').click();
    const dialog = page.getByRole('dialog');
    await expect(dialog).toBeVisible();
    // Child protection closes on the de-registration list from the national statistics publication.
    await expect(dialog.getByText('These are the reasons the national return uses')).toBeVisible();
    await expect(page.getByTestId('close-clocks')).toContainText('Closing stops these clocks');
    await expect(page.getByTestId('close-telling')).toContainText('Agencies told that the case has closed');
    await capture(page, { phase: PHASE, screen: 'close-process' });
    await expectNoAxeViolations(page);

    await page.getByTestId('close-reason').selectOption('improved-home-situation');
    await page.getByTestId('close-note').fill('Risks reduced, the plan is complete and the core group agreed at review.');
    await page.getByTestId('close-submit').click();

    await expect(page.getByText('Case closed')).toBeVisible();
    await expect(page.getByTestId('reopen-process')).toBeVisible();
  });

  test('refuses a closure with no reason chosen and no note written', async ({ page }) => {
    await signInAs(page, 'usr_janet_kerr');
    await openByReference(page, 'CP-2026-0412');
    await page.getByTestId('close-process').click();
    await page.getByTestId('close-submit').click();
    await expect(page.getByText('Choose a closure reason from the list')).toBeVisible();
  });

  test('a MARAC closure says its list is local rather than national', async ({ page }) => {
    await signInAs(page, 'usr_karen_findlay');
    await openByReference(page, 'MARAC-2026-0093');
    await page.getByTestId('close-process').click();
    await expect(page.getByText(/no national closure list/)).toBeVisible();
  });
});

test.describe('reopening a case', () => {
  test('resumes the clocks the closure stopped, against the date they started', async ({ page }) => {
    await signInAs(page, 'usr_janet_kerr');
    await openByReference(page, 'CP-2026-0412');
    await page.getByTestId('close-process').click();
    await page.getByTestId('close-reason').selectOption('improved-home-situation');
    await page.getByTestId('close-note').fill('Risks reduced, the plan is complete and the core group agreed at review.');
    await page.getByTestId('close-submit').click();
    await expect(page.getByText('Case closed')).toBeVisible();

    await page.getByTestId('reopen-process').click();
    const clocks = page.getByTestId('reopen-clocks');
    await expect(clocks).toContainText('Reopening resumes these clocks');
    await expect(clocks).toContainText('resume against the date they started, not today');
    await capture(page, { phase: PHASE, screen: 'reopen-process' });
    await expectNoAxeViolations(page);

    await page.getByTestId('reopen-reason').fill('New concern from the school in the same term, referred back by the head teacher.');
    await page.getByTestId('reopen-submit').click();
    await expect(page.getByText('Case reopened')).toBeVisible();
    await expect(page.getByTestId('close-process')).toBeVisible();
  });
});

test.describe('editing a person record', () => {
  test('asks for a reason on an identity field and not on a telephone number', async ({ page }) => {
    await signInAs(page, 'usr_janet_kerr');
    await page.goto('/people/per_aiden_boyle');
    await waitForData(page);

    await page.getByTestId('edit-person').click();
    const dialog = page.getByRole('dialog');
    await expect(dialog).toBeVisible();
    // A telephone number changes because it changed. No reason is asked for.
    await page.getByRole('textbox', { name: 'Telephone' }).fill('01555 900900');
    await expect(page.getByTestId('edit-identity-warning')).toHaveCount(0);

    // A date of birth changes because it was wrong, and that is a different kind of change.
    await page.getByTestId('edit-date-of-birth').fill('2019-04-14');
    await expect(page.getByTestId('edit-identity-warning')).toBeVisible();
    await capture(page, { phase: PHASE, screen: 'edit-person' });
    await expectNoAxeViolations(page);

    await page.getByTestId('edit-person-submit').click();
    await expect(page.getByText('Other agencies match on these')).toBeVisible();

    await page.getByTestId('edit-reason').fill('The date on the referral was wrong. Confirmed against the CHI record.');
    await page.getByTestId('edit-person-submit').click();
    await expect(page.getByText('Record updated')).toBeVisible();
  });

  test('keeps the value the record used to hold, on the record', async ({ page }) => {
    await signInAs(page, 'usr_janet_kerr');
    await page.goto('/people/per_aiden_boyle');
    await waitForData(page);
    await page.getByTestId('edit-person').click();
    await page.getByTestId('edit-date-of-birth').fill('2019-04-14');
    await page.getByTestId('edit-reason').fill('The date on the referral was wrong. Confirmed against the CHI record.');
    await page.getByTestId('edit-person-submit').click();
    await expect(page.getByText('Record updated')).toBeVisible();

    const history = page.getByTestId('record-history');
    await expect(history).toContainText('dateOfBirth');
    await expect(history).toContainText('Was:');
    await expect(history).toContainText('2019-03-14');
    await expect(history).toContainText('Confirmed against the CHI record');
    await capture(page, { phase: PHASE, screen: 'record-history' });
  });
});

test.describe('recorded in error', () => {
  test('takes a chronology entry off the working list without taking it off the record', async ({ page }) => {
    await signInAs(page, 'usr_janet_kerr');
    await page.goto('/people/per_aiden_boyle/chronology');
    await waitForData(page);

    const rows = page.getByRole('row');
    // The list is virtualised, so its row count is what is drawn rather than what exists. What can
    // be asserted is that this particular entry leaves it, and that the count of retired ones rises.
    const retiring = (await rows.nth(1).innerText()).split('\n').filter((s) => s.trim().length > 12)[0]!.trim();
    await rows.nth(1).click();
    await page.getByTestId('retire-event').click();

    const dialog = page.getByRole('dialog');
    await expect(dialog).toBeVisible();
    // The dialog's whole argument is what this does not do.
    await expect(dialog.getByText(/It is not a deletion/)).toBeVisible();
    await expect(dialog.getByText(/stays in any pack that has already gone out/)).toBeVisible();
    await capture(page, { phase: PHASE, screen: 'recorded-in-error' });
    await expectNoAxeViolations(page);

    await page.getByTestId('in-error-reason').fill('Recorded against the wrong child. It belongs on his sister\'s record.');
    await page.getByTestId('in-error-submit').click();

    await expect(toast(page).getByText('Recorded in error')).toBeVisible();
    const note = page.getByTestId('chronology-retired');
    await expect(note).toContainText('1 entry has been recorded in error');
    await expect(note).toContainText('still in the audit trail');
    await expect(page.getByRole('table').getByText(retiring)).toHaveCount(0);
  });

  test('marks the person record itself, and says who decided and why', async ({ page }) => {
    await signInAs(page, 'usr_janet_kerr');
    await page.goto('/people/per_aiden_boyle');
    await waitForData(page);

    await page.getByTestId('retire-record').click();
    await page.getByTestId('in-error-reason').fill('A duplicate created in error during the transfer from the old system.');
    await page.getByTestId('in-error-submit').click();

    const badge = page.getByTestId('retired-badge');
    await expect(badge).toBeVisible();
    await expect(badge).toContainText('Janet Kerr');
    await expect(badge).toContainText('duplicate created in error');
    // The record is still on screen, which is the point.
    await expect(page.getByRole('heading', { name: 'Aiden Boyle' })).toBeVisible();
  });
});

test.describe('recording a death', () => {
  test('shows what it will do to every case before it does it', async ({ page }) => {
    await signInAs(page, 'usr_moira_gilmour');
    await page.goto('/people/per_marion_fraser');
    await waitForData(page);

    await page.getByTestId('record-death').click();
    const dialog = page.getByRole('dialog');
    await expect(dialog).toBeVisible();
    const consequences = page.getByTestId('death-consequences');
    await expect(consequences).toContainText('Recording this will');
    // The ASP case closes on the workbook's own row for a death during the process.
    await expect(consequences).toContainText('no opportunity for further ASP intervention');
    await capture(page, { phase: PHASE, screen: 'record-death' });
    await expectNoAxeViolations(page);

    await page.getByTestId('death-source').fill('Notified by the GP practice');
    await page.getByTestId('death-note').fill('Marion died at home on the second. Confirmed by her GP this morning.');
    await page.getByTestId('death-submit').click();

    await expect(toast(page).getByText('Death recorded')).toBeVisible();
    await expect(page.getByTestId('died')).toContainText('Died');
    await expect(page.getByTestId('died')).toContainText('Moira Gilmour');
    // The action is gone, because a death is recorded once.
    await expect(page.getByTestId('record-death')).toHaveCount(0);
  });

  test('refuses a date in the future', async ({ page }) => {
    await signInAs(page, 'usr_moira_gilmour');
    await page.goto('/people/per_marion_fraser');
    await waitForData(page);
    await page.getByTestId('record-death').click();
    await page.getByTestId('death-date').fill('2030-01-01');
    await page.getByTestId('death-note').fill('Marion died at home. Confirmed by her GP this morning.');
    await page.getByTestId('death-submit').click();
    await expect(page.getByText('A date of death cannot be in the future')).toBeVisible();
  });
});
