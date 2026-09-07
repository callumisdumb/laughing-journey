import { expect, test } from '@playwright/test';
import { capture, expectNoAxeViolations, signInAs, waitForData } from './helpers';

const PHASE = 'network';

test.use({ viewport: { width: 1440, height: 900 } });

/**
 * Starting a process, and the two gates that decide whether it can be started.
 *
 * Eligibility comes from the person and permission comes from the persona, and both give reasons
 * rather than hiding the option. The cases worth asserting are the ones somebody would get wrong:
 * MAPPA has no age floor, a 16 or 17 year old is eligible for adult and child protection at once,
 * and an existing open case of the same type has to be shown before a second one is allowed.
 */
test.describe('starting a process', () => {
  test('lists every process with its answer, including the ones that are not available', async ({ page }) => {
    await signInAs(page, 'usr_janet_kerr');
    await page.goto('/people/per_aiden_boyle');
    await waitForData(page);

    await page.getByTestId('start-process').click();
    const dialog = page.getByRole('dialog');
    await expect(dialog).toBeVisible();

    // A seven year old: child protection yes, adult support and protection no, and the reason said.
    await expect(page.getByTestId('process-choice-cp')).toContainText('Available');
    await expect(page.getByTestId('process-choice-asp')).toContainText('Not available');
    await expect(page.getByTestId('process-choice-asp')).toContainText('applies from 16');
    await expect(page.getByTestId('process-choice-asp')).toContainText('Open a child protection concern instead');
    await capture(page, { phase: PHASE, screen: 'start-process' });
    await expectNoAxeViolations(page);
  });

  test('refuses on permission separately from eligibility, and says who does open it', async ({ page }) => {
    await signInAs(page, 'usr_janet_kerr');
    await page.goto('/people/per_aiden_boyle');
    await waitForData(page);
    await page.getByTestId('start-process').click();

    // MAPPA has no age floor, so a child is eligible; a children and families social worker is not
    // one of the responsible authorities, so the refusal is about the persona rather than the child.
    const mappa = page.getByTestId('process-choice-mappa');
    await expect(mappa).toContainText('Not your role');
    await expect(mappa).toContainText('responsible authorities');
    await expect(mappa).toContainText('MAPPA coordinator');
    await expect(mappa.getByRole('radio')).toBeDisabled();
  });

  test('shows the open case that already exists rather than letting a second one through', async ({ page }) => {
    await signInAs(page, 'usr_janet_kerr');
    await page.goto('/people/per_aiden_boyle');
    await waitForData(page);
    await page.getByTestId('start-process').click();
    await page.getByTestId('process-choice-cp').getByRole('radio').check();

    const existing = page.getByTestId('process-existing');
    await expect(existing).toBeVisible();
    await expect(existing).toContainText('CP-2026');
    await expect(page.getByTestId('start-process-submit')).toBeDisabled();

    // A second one is possible and takes a reason in a sentence.
    await page.getByTestId('process-source').fill('Ardvale Primary School');
    await page.getByTestId('process-summary').fill('A separate incident at school on 3 September, unrelated to the open case.');
    await expect(page.getByTestId('start-process-submit')).toBeDisabled();
    await page.getByTestId('process-second-reason').fill('The head teacher has raised a distinct concern the open case does not cover.');
    await expect(page.getByTestId('start-process-submit')).toBeEnabled();
  });

  test('opens the case, says what it did, and lands on it with the clocks running', async ({ page }) => {
    await signInAs(page, 'usr_moira_gilmour');
    await page.goto('/people/per_0004');
    await waitForData(page);
    await page.getByTestId('start-process').click();
    await page.getByTestId('process-choice-asp').getByRole('radio').check();

    // The consequences are computed and named before the button.
    const consequences = page.getByTestId('process-consequences');
    await expect(consequences).toBeVisible();
    await expect(consequences).toContainText('ASP-');
    await expect(consequences).toContainText('2 statutory clocks start');

    await page.getByTestId('process-source').fill('Scottish Fire and Rescue Service community safety visit');
    await page.getByTestId('process-summary').fill('A second fire in the flat within a month, and the smoke alarm had been disconnected.');
    await page.getByTestId('start-process-submit').click();

    await expect(page.getByRole('dialog')).toHaveCount(0);
    await expect(page).toHaveURL(/\/processes\//);
    await expect(page.getByText('Case opened')).toBeVisible();
  });

  test('says when no clock starts, and what will start it', async ({ page }) => {
    await signInAs(page, 'usr_karen_findlay');
    await page.goto('/people/per_0005');
    await waitForData(page);
    await page.getByTestId('start-process').click();
    await page.getByTestId('process-choice-marac').getByRole('radio').check();

    const consequences = page.getByTestId('process-consequences');
    await expect(consequences).toContainText('No statutory clock starts here');
    await expect(consequences).toContainText('run from the case being heard at MARAC');
  });

  test('names the 16 or 17 year old as both, rather than choosing for them', async ({ page }) => {
    // A team leader opens both, so both say Available and the choice is genuinely the reader's.
    await signInAs(page, 'usr_anne_hendry');
    await page.goto('/people/per_0044');
    await waitForData(page);
    await page.getByTestId('start-process').click();

    await expect(page.getByTestId('young-adult')).toBeVisible();
    await expect(page.getByTestId('young-adult')).toContainText('both open to them');
    await expect(page.getByTestId('process-choice-asp')).toContainText('Available');
    await expect(page.getByTestId('process-choice-cp')).toContainText('Available');
    await capture(page, { phase: PHASE, screen: 'start-process-young-adult' });
  });

  test('keeps the two gates apart on the same person', async ({ page }) => {
    // The same 16 year old, read by a children and families social worker: eligible for adult
    // support and protection, and not hers to open. Two different answers to two different
    // questions, and a product that collapsed them would say "not available" and teach nothing.
    await signInAs(page, 'usr_janet_kerr');
    await page.goto('/people/per_0044');
    await waitForData(page);
    await page.getByTestId('start-process').click();

    const asp = page.getByTestId('process-choice-asp');
    await expect(asp).toContainText('Not your role');
    await expect(asp).toContainText('an adult for the purposes of the Adult Support and Protection');
    await expect(asp).toContainText("council's adult protection team");
    await expect(page.getByTestId('process-choice-cp')).toContainText('Available');
  });
});
