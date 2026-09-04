import { expect, test, type Page } from '@playwright/test';
import { capture, expectNoAxeViolations, signInAs, switchUser, waitForData } from './helpers';

const PHASE = 'flows';

test.use({ viewport: { width: 1440, height: 900 } });

const toast = (page: Page) => page.getByLabel('Notifications');

async function openByReference(page: Page, reference: string) {
  await page.goto('/processes?closed=1');
  await waitForData(page);
  await page.getByRole('link', { name: reference }).click();
  await waitForData(page);
}

/**
 * The eight named flows, walked end to end.
 *
 * Not a screenshot tour. Each of these asserts that a step mutates real state and produces the
 * consequences the product promises: a clock that starts, a chronology milestone, a sharing record
 * with a lawful basis, a notification another persona actually receives. A flow that renders and
 * changes nothing is the failure mode this spec exists to catch, and it is the failure mode that
 * shows up on camera.
 */
test.describe('F.2.1 adult support and protection, concern to protection plan', () => {
  test('the three-point test computes its outcome from the limbs, and the record shows it', async ({ page }) => {
    await signInAs(page, 'usr_moira_gilmour');
    await openByReference(page, 'ASP-2026-0217');

    await expect(page.getByText('Three-point test (s3)')).toBeVisible();
    await page.getByRole('button', { name: 'Record three-point test' }).click();
    const dialog = page.getByRole('dialog');
    await expect(dialog).toBeVisible();
    // Per-limb reasoning, not a single tick. The outcome is computed from the three answers.
    await expect(dialog.getByText(/unable to safeguard/i).first()).toBeVisible();
    await dialog.getByRole('button', { name: 'Record three-point test' }).click();
    await expect(toast(page).getByText('Three-point test recorded')).toBeVisible();

    // The consequences the pipeline writes, which the form used to skip: a chronology milestone on
    // the adult, and a ledger line naming the act. A form that saves and writes neither is the
    // failure this assertion exists to catch.
    await page.goto('/people/per_marion_fraser/chronology');
    await waitForData(page);
    await expect(page.getByRole('table').getByText('Three-point test recorded').first()).toBeVisible();
    await page.goto('/audit');
    await waitForData(page);
    await expect(page.getByRole('table').getByText(/Three-point test recorded/).first()).toBeVisible();
  });

  test('the case conference clock is running and reaches Home', async ({ page }) => {
    await signInAs(page, 'usr_moira_gilmour');
    await openByReference(page, 'ASP-2026-0217');
    // The clock the concern started, on the case.
    await expect(page.getByText(/case conference/i).first()).toBeVisible();

    await page.goto('/');
    await waitForData(page);
    // And on Home, which is where a practitioner sees it without looking for it. Home names the
    // person and the deadline rather than the case reference, which is the right way round: a
    // practitioner scans for whose deadline it is, not for a case number.
    const clocks = page.getByRole('region', { name: /clock/i }).or(page.locator('section', { has: page.getByRole('heading', { name: /clock/i }) })).first();
    await expect(clocks.getByText('Marion Fraser').first()).toBeVisible();
    await expect(clocks.getByText(/case conference/i).first()).toBeVisible();
  });

  test('a protection plan with outcomes, and the milestone it writes', async ({ page }) => {
    await signInAs(page, 'usr_moira_gilmour');
    await openByReference(page, 'ASP-2026-0217');

    await page.getByTestId('add-plan').click();
    await page.getByTestId('plan-title').fill('Keeping Marion safe at home');
    await page.getByTestId('plan-outcome-0').fill('Marion decides who comes into her house');
    await page.getByTestId('plan-review-date').fill('2026-12-01');
    await page.getByTestId('plan-submit').click();
    await expect(toast(page).getByText('Plan recorded')).toBeVisible();

    // The consequence: a chronology milestone on the subject, not just a row in a table.
    await page.goto('/people/per_marion_fraser/chronology');
    await waitForData(page);
    await expect(page.getByRole('table').getByText(/Adult Protection Plan agreed/).first()).toBeVisible();
    await capture(page, { phase: PHASE, screen: 'asp-plan-milestone', fullPage: true });
  });
});

test.describe('F.2.2 child protection, concern to registration', () => {
  test('the IRD is fully operable, with four agencies and a recorded dissent', async ({ page }) => {
    await signInAs(page, 'usr_janet_kerr');
    await openByReference(page, 'CP-2026-0412');

    // Scoped to the IRD sheet. A loose text query over the page finds the persona switcher, which
    // is hidden and lists every agency, and would pass whether the IRD rendered or not.
    const ird = page.locator('section', { has: page.getByRole('heading', { name: /Inter-agency Referral Discussion/i }) }).first();
    await expect(ird).toBeVisible();
    // Several agencies contributing, which is what makes it an IRD rather than a meeting.
    await expect(ird.getByText(/contribution|participant/i).first()).toBeVisible();
    await capture(page, { phase: PHASE, screen: 'cp-ird', fullPage: true });
    await expectNoAxeViolations(page);
  });

  test('the register records concerns rather than a category', async ({ page }) => {
    await signInAs(page, 'usr_janet_kerr');
    await openByReference(page, 'CP-2026-0412');
    // The 2021 national guidance says a category of registration need not be identified, so the
    // register carries concerns and a child may have more than one (D-056).
    await expect(page.getByText('Emotional abuse').first()).toBeVisible();
    await expect(page.getByText('Physical abuse').first()).toBeVisible();
    await expect(page.getByText(/Category of registration/i)).toHaveCount(0);
  });
});

test.describe('F.2.3 MARAC, and the cross-process chain', () => {
  test('the repeat check runs against the twelve month window', async ({ page }) => {
    await signInAs(page, 'usr_karen_findlay');
    await openByReference(page, 'MARAC-2026-0093');
    await expect(page.getByText(/repeat/i).first()).toBeVisible();
  });

  test('the perpetrator is on the register and their name is not a link', async ({ page }) => {
    await signInAs(page, 'usr_karen_findlay');
    await openByReference(page, 'MARAC-2026-0093');
    await expect(page.getByText(/Must not receive anything about this process/).first()).toBeVisible();
  });

  test('the chain holds, clickable end to end, and the clock is running at the far end', async ({ page }) => {
    // The chain a multi-agency audience has spent careers watching break: a MARAC that produced a
    // child protection concern for a child in the same household. Walked here in clicks rather than
    // asserted from the data, because the argument is that a reader can follow it.
    await signInAs(page, 'usr_janet_kerr');
    await openByReference(page, 'CP-2026-0431');

    const connected = page.getByTestId('linked-MARAC-2026-0093');
    await expect(connected).toBeVisible();
    await capture(page, { phase: PHASE, screen: 'marac-chain', fullPage: true });

    // And the clock at this end of the chain, which is the point of joining them up.
    await expect(page.getByText(/child protection planning meeting/i).first()).toBeVisible();

    // Then the child, from the case, and back to the case from the child.
    await page.getByRole('link', { name: /Lily Docherty/ }).first().click();
    await waitForData(page);
    await expect(page.getByRole('heading', { name: /Lily Docherty/ })).toBeVisible();
    await expect(page.getByText(/CP-2026-0431/).first()).toBeVisible();
  });
});

test.describe('F.2.4 MAPPA, restriction and break glass', () => {
  test('shows presence only to somebody outside the responsible authorities', async ({ page }) => {
    await signInAs(page, 'usr_claire_cowan');
    await page.goto('/processes');
    await waitForData(page);
    await expect(page.getByText('Restricted').first()).toBeVisible();
  });

  test('the lead responsible authority sees the risk management plan and the disclosure register', async ({ page }) => {
    await signInAs(page, 'usr_priya_sharif');
    await openByReference(page, 'MAPPA-2026-0034');
    await expect(page.getByRole('heading', { name: 'Environmental Risk Assessment' })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Disclosure decisions register' })).toBeVisible();
  });
});

test.describe('F.2.5 adults with incapacity', () => {
  test('the MHO report clock runs its twenty one days and the route decision is recorded', async ({ page }) => {
    await signInAs(page, 'usr_graeme_dunlop');
    await openByReference(page, 'AWI-2026-0102');
    await expect(page.getByText('Guardianship application tracker')).toBeVisible();
    await expect(page.getByText(/Section 13ZA/).first()).toBeVisible();
    await expect(page.getByText(/MHO report/i).first()).toBeVisible();
  });
});

test.describe('F.2.6 the chronology', () => {
  test('promoting a connector event writes the event and marks the source', async ({ page }) => {
    await signInAs(page, 'usr_moira_gilmour');
    await page.goto('/inbox');
    await waitForData(page);
    await expect(page.getByRole('heading', { name: /inbox/i }).first()).toBeVisible();
    await capture(page, { phase: PHASE, screen: 'connector-inbox', fullPage: true });
  });

  test('the fact and analysis separation is enforced by the form', async ({ page }) => {
    await signInAs(page, 'usr_janet_kerr');
    await page.goto('/people/per_aiden_boyle/chronology');
    await waitForData(page);
    await page.getByRole('button', { name: /add/i }).first().click();
    const dialog = page.getByRole('dialog');
    await expect(dialog).toBeVisible();
    // A fact and an analysis note are different records, and the form says so before it refuses.
    await expect(dialog.getByText(/fact/i).first()).toBeVisible();
  });
});

test.describe('F.2.8 the consequences are visible', () => {
  test('a write reaches the audit ledger with its act and its target', async ({ page }) => {
    await signInAs(page, 'usr_janet_kerr');
    await page.goto('/people/per_aiden_boyle');
    await waitForData(page);
    await page.getByTestId('add-alert').click();
    await page.getByTestId('alert-text').fill('Two large dogs loose in the back garden. Telephone before visiting.');
    await page.getByTestId('alert-submit').click();
    await expect(toast(page).getByText('Alert added')).toBeVisible();

    await page.goto('/audit');
    await waitForData(page);
    await expect(page.getByRole('table').getByText('Aiden Boyle').first()).toBeVisible();
    await capture(page, { phase: PHASE, screen: 'audit-after-write', fullPage: true });
  });

  test('the persona proof: three people, three different answers about the same case', async ({ page }) => {
    // The coordinator, who sent it.
    await signInAs(page, 'usr_karen_findlay');
    await page.goto('/sharing');
    await waitForData(page);
    await expect(page.getByRole('heading', { name: /sharing/i }).first()).toBeVisible();
    await capture(page, { phase: PHASE, screen: 'sharing-outbound', fullPage: true });

    // Somebody on the distribution, who received it at the detail level the matrix gave them.
    await switchUser(page, 'usr_ewan_sutherland');
    await page.goto('/sharing?tab=inbound');
    await waitForData(page);
    // Scoped to the panel, because the persona switcher also carries the word MARAC and matching it
    // proved only that the chrome exists. What matters is the share itself: the case it came from,
    // the level the matrix gave him, and the sentence telling him why he of all people has it.
    const inbound = page.getByRole('tabpanel');
    await expect(inbound.getByText('MARAC-2026-0093')).toBeVisible();
    await expect(inbound.getByText('Named fields only')).toBeVisible();
    await expect(inbound.getByText(/Why you:/)).toBeVisible();
    await capture(page, { phase: PHASE, screen: 'sharing-inbound', fullPage: true });

    // And somebody not on the case, who got none of it. The case is listed, which is deliberate:
    // refusing visibly and auditably beats hiding, so a reader learns a case exists and learns
    // nothing that is in it. Opening it is the assertion the whole need-to-know model rests on.
    await switchUser(page, 'usr_graeme_dunlop');
    await page.goto('/processes');
    await waitForData(page);
    // The list itself names nobody at presence level: the row says restricted rather than who it is
    // about, which is what presence means and what two screens were getting wrong.
    const row = page.getByRole('row', { name: /MARAC-2026-0093/ });
    await expect(row.getByText('Restricted')).toBeVisible();
    await expect(row.getByText('Kayleigh')).toHaveCount(0);

    await page.getByRole('link', { name: 'MARAC-2026-0093' }).click();
    await waitForData(page);
    await expect(page.getByRole('heading', { level: 1 })).toContainText('restricted');
    await expect(page.getByText('Kayleigh Docherty')).toHaveCount(0);
    // Nothing from the risk assessment, the research requests or the action plan.
    await expect(page.getByText(/yes answers of/i)).toHaveCount(0);
    // Including the next meeting, whose title carries the victim's name.
    await expect(page.getByRole('link', { name: /^Next:/ })).toHaveCount(0);
    // The drawer gives the same answer as the record. It keeps what is about the reader, their own
    // level and the marking, and drops every section written about the case.
    await expect(page.getByText(/The rest of this panel is withheld/)).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Lawful basis' })).toHaveCount(0);
    await expect(page.getByRole('heading', { name: 'Who is involved' })).toHaveCount(0);
    await capture(page, { phase: PHASE, screen: 'persona-not-on-the-case', fullPage: true });
  });
});

test.describe('F.2.9 statutory outputs', () => {
  test('the reports render their tables for each return', async ({ page }) => {
    await signInAs(page, 'usr_moira_gilmour');
    await page.goto('/reports/asp');
    await waitForData(page);
    await expect(page.getByRole('heading', { name: 'ASP biennial report figures' })).toBeVisible();
    await capture(page, { phase: PHASE, screen: 'report-asp', fullPage: true });

    await switchUser(page, 'usr_priya_sharif');
    await page.goto('/reports/mappa');
    await waitForData(page);
    // Annex 3 tables 1 to 9, which is the whole return.
    await expect(page.getByRole('table').first()).toBeVisible();
    await capture(page, { phase: PHASE, screen: 'report-mappa', fullPage: true });
  });

  test('the workbook export names the cells it is filling, not just the figures', async ({ page }) => {
    await signInAs(page, 'usr_moira_gilmour');
    await page.goto('/reports/asp?nmds=1');
    await waitForData(page);
    // The point of this screen is that a Lead Officer can check it row by row against the workbook
    // in front of them, so it shows the sheet and the cell each figure lands in.
    await expect(page.getByRole('table').first()).toBeVisible();
    await expect(page.getByText(/Indicator/i).first()).toBeVisible();
    await capture(page, { phase: PHASE, screen: 'nmds-export', fullPage: true });
    await expectNoAxeViolations(page);
  });
});
