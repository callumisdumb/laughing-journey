import { expect, test, type Page } from '@playwright/test';
import { capture, expectNoAxeViolations, signInAs, waitForData } from './helpers';

const PHASE = 'two-way';

test.use({ viewport: { width: 1440, height: 900 } });

const toast = (page: Page) => page.getByLabel('Notifications');

async function openConnector(page: Page, adapter: string, tab: string) {
  await page.goto(`/connectors?adapter=${adapter}&tab=${tab}`);
  await waitForData(page);
}

/**
 * Connectors in both directions: the outbox, the authorisation, the echo defence, reconciliation,
 * and the capability matrix that refuses to claim what is not realistic.
 *
 * The assertions are about the five things that make two-way hard rather than about a form
 * submitting: a failure is visible rather than retried into silence, nothing leaves without a named
 * person and a lawful basis, our own write coming back is recognised as ours, a conflict goes to a
 * person with both values, and the ceilings differ per connector and say why.
 */
test.describe('the capability matrix', () => {
  test('refuses to claim a write where none is realistic, and says why for each', async ({ page }) => {
    await signInAs(page, 'usr_moira_gilmour');
    await openConnector(page, 'eclipse', 'real');

    const matrix = page.getByTestId('write-matrix');
    await expect(matrix).toBeVisible();
    // The three rows a sceptical integration lead reads first.
    await expect(matrix).toContainText('Full two-way');
    await expect(matrix).toContainText('Notify only, not write');
    await expect(matrix).toContainText('Never');
    await expect(matrix).toContainText('not a realistic ask');
    await capture(page, { phase: PHASE, screen: 'write-matrix', fullPage: true });
    await expectNoAxeViolations(page);
  });

  test('marks the ceiling that depends on an accreditation nobody here has obtained', async ({ page }) => {
    await signInAs(page, 'usr_moira_gilmour');
    await openConnector(page, 'emis-web', 'real');
    await expect(page.getByText('Not verified by this project').first()).toBeVisible();
    await expect(page.getByText(/EMIS Partner Programme/).first()).toBeVisible();
  });

  test('writes down who owns which field, rather than resolving by recency', async ({ page }) => {
    await signInAs(page, 'usr_moira_gilmour');
    await openConnector(page, 'eclipse', 'real');
    const authority = page.getByTestId('authority-table');
    await expect(authority).toContainText('Client.DateOfBirth');
    await expect(authority).toContainText('The source system owns this field');
    await expect(authority).toContainText('Episode.Stage');
  });
});

test.describe('the outbox', () => {
  test('shows the state each write is actually in, including the one that failed', async ({ page }) => {
    await signInAs(page, 'usr_moira_gilmour');
    await openConnector(page, 'eclipse', 'outbox');

    await expect(page.getByTestId('outbox-row-out_marion_episode')).toContainText('Acknowledged');
    await expect(page.getByTestId('outbox-row-out_marion_episode')).toContainText('ECLIPSE-RION');
    await expect(page.getByTestId('outbox-row-out_marion_stage')).toContainText('Proposed');
    await capture(page, { phase: PHASE, screen: 'outbox', fullPage: true });
    await expectNoAxeViolations(page);

    // The failure is on the GP connector, and it says nobody there has been told.
    await openConnector(page, 'emis-web', 'outbox');
    const failed = page.getByTestId('outbox-row-out_marion_gp_flag');
    await expect(failed).toContainText('Failed');
    await expect(failed).toContainText('not yet enrolled in the partner programme');
    await expect(failed).toContainText('2 attempts');
  });

  test('shows the payload in the target system\'s own words before anybody authorises it', async ({ page }) => {
    await signInAs(page, 'usr_moira_gilmour');
    await openConnector(page, 'eclipse', 'outbox');
    await page.getByTestId('outbox-authorise-out_marion_stage').click();

    const dialog = page.getByRole('dialog');
    await expect(dialog).toBeVisible();
    const preview = page.getByTestId('authorise-preview');
    await expect(preview).toContainText('Episode.CaseReference');
    await expect(preview).toContainText('ASP-2026-0217');
    // The value beside where it came from, so the mapping can be checked rather than trusted.
    await expect(preview).toContainText('process.reference');
    await capture(page, { phase: PHASE, screen: 'authorise-write' });
    await expectNoAxeViolations(page);
  });

  test('refuses to send without a purpose and a lawful basis, because it is a disclosure', async ({ page }) => {
    await signInAs(page, 'usr_moira_gilmour');
    await openConnector(page, 'eclipse', 'outbox');
    await page.getByTestId('outbox-authorise-out_marion_stage').click();
    await page.getByTestId('authorise-submit').click();
    await expect(page.getByText('Say why this is being written')).toBeVisible();

    await page.getByTestId('authorise-purpose').fill('So the council record shows the case has moved to investigation and the duty team is not asked again.');
    await page.getByTestId('authorise-submit').click();
    await expect(page.getByText('Choose the lawful basis this write rests on')).toBeVisible();
  });

  test('sends it, and records the far side\'s own reference as the acknowledgement', async ({ page }) => {
    await signInAs(page, 'usr_moira_gilmour');
    await openConnector(page, 'eclipse', 'outbox');
    await page.getByTestId('outbox-authorise-out_marion_stage').click();
    await page.getByTestId('authorise-purpose').fill('So the council record shows the case has moved to investigation and the duty team is not asked again.');
    await page.getByTestId('authorise-basis').selectOption({ index: 1 });
    await page.getByTestId('authorise-submit').click();

    await expect(toast(page).getByText('Authorised')).toBeVisible();
    const row = page.getByTestId('outbox-row-out_marion_stage');
    await expect(row).toContainText('Acknowledged');
    await expect(row).toContainText('ECLIPSE-');
    // The platform relayed ciphertext and says how much of it, because that is all it knows.
    await expect(row).toContainText('bytes of ciphertext relayed');
  });

  test('parks a failure as a decision rather than leaving it in the queue', async ({ page }) => {
    await signInAs(page, 'usr_moira_gilmour');
    await openConnector(page, 'emis-web', 'outbox');
    await page.getByTestId('outbox-park-out_marion_gp_flag').click();
    await expect(page.getByTestId('outbox-parked')).toContainText('not yet enrolled');
  });
});

test.describe('arriving from a source system', () => {
  test('offers a case opened elsewhere, and opens it here linked by their reference', async ({ page }) => {
    await signInAs(page, 'usr_moira_gilmour');
    await openConnector(page, 'eclipse', 'inbound');

    const change = page.getByTestId('inbound-inb_eclipse_new');
    await expect(change).toContainText('FRASER, Marion');
    await expect(change).toContainText('ECL-EP-2026-4471');
    await capture(page, { phase: PHASE, screen: 'inbound', fullPage: true });
    await expectNoAxeViolations(page);

    await page.getByTestId('inbound-accept-inb_eclipse_new').click();
    await waitForData(page);
    await expect(toast(page).getByText('Case opened')).toBeVisible();
    // It lands on the case it just opened.
    await expect(page).toHaveURL(/\/processes\//);
  });

  test('recognises our own write coming back rather than opening a second case', async ({ page }) => {
    await signInAs(page, 'usr_moira_gilmour');
    await openConnector(page, 'eclipse', 'inbound');

    const echo = page.getByTestId('inbound-inb_eclipse_echo');
    await expect(echo).toContainText('Our own write');
    await expect(page.getByTestId('inbound-echo-inb_eclipse_echo')).toContainText('key we issued');
    // There is no accept button on an echo, because accepting it would create the duplicate.
    await expect(page.getByTestId('inbound-accept-inb_eclipse_echo')).toHaveCount(0);
  });

  test('declines with a reason that goes back to the sender', async ({ page }) => {
    await signInAs(page, 'usr_moira_gilmour');
    await openConnector(page, 'eclipse', 'inbound');
    await page.getByTestId('inbound-decline-inb_eclipse_new').click();
    await page.getByTestId('inbound-decline-submit').click();
    await expect(page.getByText('Say why in a sentence')).toBeVisible();

    await page.getByTestId('inbound-decline-reason').fill('Already open here as ASP-2026-0217. The duty team has been told to use that reference.');
    await page.getByTestId('inbound-decline-submit').click();
    await expect(toast(page).getByText('Declined')).toBeVisible();
  });
});

test.describe('reconciliation', () => {
  test('shows what each side holds, who owns the field, and what has to be decided', async ({ page }) => {
    await signInAs(page, 'usr_moira_gilmour');
    await openConnector(page, 'eclipse', 'reconcile');

    const panel = page.getByTestId('reconcile-per_marion_fraser');
    await expect(panel).toBeVisible();
    // The stage we have moved and the source has not: ours, so the fix is another write.
    await expect(panel).toContainText('Episode.Stage');
    // The allocated worker both sides changed: a conflict, and somebody has to choose.
    await expect(panel).toContainText('Both sides have changed this');
    await capture(page, { phase: PHASE, screen: 'reconcile', fullPage: true });
    await expectNoAxeViolations(page);

    await page.getByTestId('reconcile-take-Episode.AllocatedWorker').click();
    await expect(toast(page).getByText('Conflict resolved')).toBeVisible();
  });
});

test.describe('the status echo on the case', () => {
  test('says what the other agency has actually been told, and what it has not', async ({ page }) => {
    await signInAs(page, 'usr_moira_gilmour');
    await page.goto('/processes?closed=1');
    await waitForData(page);
    await page.getByRole('link', { name: 'ASP-2026-0217' }).click();
    await waitForData(page);

    const status = page.getByTestId('outbound-status');
    await expect(status).toContainText('acknowledged');
    await expect(status).toContainText('ECLIPSE-RION');
    // The failure says nobody there has been told, which is the sentence that matters.
    await expect(status).toContainText('Nobody there has been told');
    await capture(page, { phase: PHASE, screen: 'status-echo' });
  });
});
