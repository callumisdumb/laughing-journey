import { expect, test, type Page } from '@playwright/test';
import { capture, expectNoAxeViolations, signInAs, waitForData } from './helpers';

const PHASE = 'create';

test.use({ viewport: { width: 1440, height: 900 } });

async function openByReference(page: Page, reference: string) {
  await page.goto('/processes?closed=1');
  await waitForData(page);
  await page.getByRole('link', { name: reference }).click();
  await waitForData(page);
}

/**
 * The create paths that had none: a plan, an alert, a protection order, a disclosure, an AWI visit
 * and investigation, a manual register entry, and the global create action that reaches them all.
 *
 * What is worth asserting is not that a form submits. It is that the consequences the write pipeline
 * promises actually arrive: a granted removal order starts two clocks and shows their dates before
 * the practitioner commits, an alert scoped to named agencies refuses to save with none named, and a
 * register entry changes who may receive information rather than only adding a row.
 */
test.describe('plans', () => {
  test('records a plan as a list of outcomes, with the ASP review date asked in the form', async ({ page }) => {
    await signInAs(page, 'usr_moira_gilmour');
    await openByReference(page, 'ASP-2026-0217');

    await page.getByTestId('add-plan').click();
    const dialog = page.getByRole('dialog');
    await expect(dialog).toBeVisible();
    // The case is ASP, so the plan type it usually produces is already chosen and the review date
    // is labelled as required rather than refused after the fact.
    await expect(page.getByTestId('plan-type')).toHaveValue('adult-protection');
    await expect(dialog.getByText('Review date (required)')).toBeVisible();
    await capture(page, { phase: PHASE, screen: 'add-plan' });
    await expectNoAxeViolations(page);

    await page.getByTestId('plan-title').fill('Keeping Marion safe at home');
    await page.getByTestId('plan-outcome-0').fill('Marion decides who comes into her house');
    await page.getByTestId('plan-add-outcome').click();
    await page.getByTestId('plan-outcome-1').fill('The money going out of her account is checked monthly');
    await page.getByTestId('plan-review-date').fill('2026-12-01');
    await page.getByTestId('plan-submit').click();

    await expect(page.getByText('Plan recorded')).toBeVisible();
    await expect(page.getByText('2 outcomes')).toBeVisible();
  });

  test('refuses a plan with no outcomes, because the outcomes are the plan', async ({ page }) => {
    await signInAs(page, 'usr_moira_gilmour');
    await openByReference(page, 'ASP-2026-0217');
    await page.getByTestId('add-plan').click();
    await page.getByTestId('plan-title').fill('A plan with nothing in it');
    await page.getByTestId('plan-review-date').fill('2026-12-01');
    await page.getByTestId('plan-submit').click();
    await expect(page.getByText('The outcomes are the plan')).toBeVisible();
  });
});

test.describe('alerts', () => {
  test('asks the visibility scope and refuses a named scope with nobody named', async ({ page }) => {
    await signInAs(page, 'usr_janet_kerr');
    await page.goto('/people/per_aiden_boyle');
    await waitForData(page);

    await page.getByTestId('add-alert').click();
    const dialog = page.getByRole('dialog');
    await expect(dialog).toBeVisible();
    await expect(dialog.getByText('Anybody who can see this record')).toBeVisible();
    await capture(page, { phase: PHASE, screen: 'add-alert' });
    await expectNoAxeViolations(page);

    await page.getByTestId('alert-text').fill('Two large dogs loose in the back garden. Telephone before visiting.');
    await page.getByTestId('alert-scope-agencies').check();
    await expect(page.getByTestId('alert-agencies')).toBeVisible();
    await page.getByTestId('alert-submit').click();
    await expect(page.getByText('Name at least one agency')).toBeVisible();
  });

  test('adds an alert that anybody on the record can see', async ({ page }) => {
    await signInAs(page, 'usr_janet_kerr');
    await page.goto('/people/per_aiden_boyle');
    await waitForData(page);
    await page.getByTestId('add-alert').click();
    await page.getByTestId('alert-text').fill('Two large dogs loose in the back garden. Telephone before visiting.');
    await page.getByTestId('alert-submit').click();

    await expect(page.getByText('Alert added')).toBeVisible();
    await expect(page.getByText('Two large dogs loose in the back garden.').first()).toBeVisible();
  });
});

test.describe('protection orders', () => {
  test('shows the clocks a granted order starts before it is recorded, from the rules themselves', async ({ page }) => {
    await signInAs(page, 'usr_moira_gilmour');
    await openByReference(page, 'ASP-2026-0217');

    await page.getByTestId('record-order').click();
    const dialog = page.getByRole('dialog');
    await expect(dialog).toBeVisible();
    // Applied, not granted: nothing starts, so nothing is claimed.
    await expect(page.getByTestId('order-clocks')).toHaveCount(0);

    await page.getByTestId('order-kind').selectOption('removal-order-s14');
    await page.getByTestId('order-decision').selectOption('granted');
    // A removal order carries two: the 7 day validity and the 72 hours to execute it.
    const clocks = page.getByTestId('order-clocks');
    await expect(clocks).toBeVisible();
    await expect(clocks.locator('span')).toHaveCount(3);
    await capture(page, { phase: PHASE, screen: 'protection-order' });
    await expectNoAxeViolations(page);

    await page.getByTestId('order-rationale').fill('Marion is at immediate risk in the house and no lesser measure is available.');
    await page.getByTestId('order-submit').click();
    await expect(page.getByText('2 clocks are now running')).toBeVisible();
  });
});

test.describe('MAPPA disclosures', () => {
  test('proposes a disclosure limited to the facts listed, and opens it pending', async ({ page }) => {
    await signInAs(page, 'usr_priya_sharif');
    await openByReference(page, 'MAPPA-2026-0034');

    await page.getByTestId('propose-disclosure').click();
    const dialog = page.getByRole('dialog');
    await expect(dialog).toBeVisible();
    await capture(page, { phase: PHASE, screen: 'propose-disclosure' });
    await expectNoAxeViolations(page);

    await page.getByTestId('disclosure-recipient').fill('Portlennan Joinery');
    await page.getByTestId('disclosure-fact-0').fill('He must not be alone with anyone under 16 on the premises');
    await page.getByTestId('disclosure-rationale').fill('The workshop runs a school placement scheme in term time.');
    await page.getByTestId('disclosure-submit').click();

    await expect(page.getByText('Disclosure proposed')).toBeVisible();
    await expect(page.getByText('It is pending a decision')).toBeVisible();
  });

  test('refuses a disclosure with no facts listed', async ({ page }) => {
    await signInAs(page, 'usr_priya_sharif');
    await openByReference(page, 'MAPPA-2026-0034');
    await page.getByTestId('propose-disclosure').click();
    await page.getByTestId('disclosure-recipient').fill('Portlennan Joinery');
    await page.getByTestId('disclosure-rationale').fill('The workshop runs a school placement scheme in term time.');
    await page.getByTestId('disclosure-submit').click();
    await expect(page.getByText('List at least one fact')).toBeVisible();
  });
});

test.describe('AWI supervision', () => {
  test('records a visit and an investigation under the section that applies', async ({ page }) => {
    await signInAs(page, 'usr_graeme_dunlop');
    await openByReference(page, 'AWI-2026-0102');

    await page.getByTestId('record-visit').click();
    await expect(page.getByRole('dialog')).toBeVisible();
    await capture(page, { phase: PHASE, screen: 'supervision-visit' });
    await expectNoAxeViolations(page);
    await page.getByTestId('visit-summary').fill('Ishbel was in the day room and said she wanted to go home for Christmas.');
    await page.getByTestId('visit-submit').click();
    await expect(page.getByText('Visit recorded')).toBeVisible();

    await page.getByTestId('record-investigation').click();
    await expect(page.getByRole('dialog')).toBeVisible();
    await page.getByTestId('investigation-section').selectOption('s12');
    await page.getByTestId('investigation-summary').fill('The care home reports money going missing from her room.');
    await page.getByTestId('investigation-submit').click();
    await expect(page.getByText('Investigation recorded')).toBeVisible();
  });

  test('refuses a visit dated in the future', async ({ page }) => {
    await signInAs(page, 'usr_graeme_dunlop');
    await openByReference(page, 'AWI-2026-0102');
    await page.getByTestId('record-visit').click();
    await page.getByTestId('visit-date').fill('2030-01-01');
    await page.getByTestId('visit-summary').fill('Ishbel was in the day room and said she wanted to go home.');
    await page.getByTestId('visit-submit').click();
    await expect(page.getByText('A visit cannot be recorded before it has happened')).toBeVisible();
  });
});

test.describe('the case-role register', () => {
  test('adds somebody the record does not link to the case, with the reason on it', async ({ page }) => {
    await signInAs(page, 'usr_karen_findlay');
    await openByReference(page, 'MARAC-2026-0093');

    await page.getByTestId('add-register-entry').click();
    const dialog = page.getByRole('dialog');
    await expect(dialog).toBeVisible();
    await expect(dialog.getByText(/must not receive/i).first()).toBeVisible();
    await capture(page, { phase: PHASE, screen: 'register-entry' });
    await expectNoAxeViolations(page);

    await page.getByTestId('register-name').fill('Iain Docherty');
    await page.getByTestId('register-relationship').fill("the perpetrator's brother");
    await page.getByTestId('register-reason').fill('Works in the housing office and would tell him.');
    await page.getByTestId('register-submit').click();

    await expect(page.getByText('Added to the register')).toBeVisible();
    await expect(page.getByText('Iain Docherty').first()).toBeVisible();
  });
});

test.describe('the global create action', () => {
  test('lists what can be made, in groups, and says which are made elsewhere', async ({ page }) => {
    await signInAs(page, 'usr_janet_kerr');
    await page.goto('/');
    await waitForData(page);

    await page.getByTestId('global-create').click();
    const dialog = page.getByRole('dialog');
    await expect(dialog).toBeVisible();
    await expect(dialog.getByRole('heading', { name: 'About a person' })).toBeVisible();
    await expect(dialog.getByRole('heading', { name: 'On a case' })).toBeVisible();
    await expect(dialog.getByRole('heading', { name: 'Made on their own screen' })).toBeVisible();
    await capture(page, { phase: PHASE, screen: 'global-create' });
    await expectNoAxeViolations(page);
  });

  test('asks the one thing the create needs, then opens the same dialog the record would', async ({ page }) => {
    await signInAs(page, 'usr_janet_kerr');
    await page.goto('/');
    await waitForData(page);

    await page.getByTestId('global-create').click();
    await page.getByTestId('create-alert').click();
    await expect(page.getByText('Who is this about?')).toBeVisible();

    await page.getByTestId('create-person-query').fill('Aiden Boyle');
    await page.getByTestId('create-person-results').getByRole('button', { name: /Aiden Boyle/ }).first().click();
    await expect(page.getByTestId('create-person-chosen')).toContainText('Aiden Boyle');
    await page.getByTestId('create-continue').click();

    // The alert dialog itself, reached from the top bar rather than from the person record.
    await expect(page.getByTestId('alert-text')).toBeVisible();
    await page.getByTestId('alert-text').fill('Two large dogs loose in the back garden. Telephone before visiting.');
    await page.getByTestId('alert-submit').click();
    await expect(page.getByText('Alert added')).toBeVisible();
  });

  test('takes a create that lives on a screen to that screen rather than faking a dialog', async ({ page }) => {
    await signInAs(page, 'usr_janet_kerr');
    await page.goto('/');
    await waitForData(page);
    await page.getByTestId('global-create').click();
    await page.getByTestId('create-meeting').click();
    await waitForData(page);
    await expect(page).toHaveURL(/\/meetings/);
  });
});
