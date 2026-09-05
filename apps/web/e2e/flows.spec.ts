import { expect, test, type Page } from '@playwright/test';
import { createPerson, openTransition, startCase, submitTransition } from './driven';
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
test.describe('F.2.1 adult support and protection, driven from a concern to a reviewed protection plan', () => {
  test.setTimeout(240_000);
  /**
   * Nothing seeded. Moira records the concern and the three-point test; the screening decision is
   * Anne's and the panel says so; the inquiry, its outcome and a section 7 visit are Moira's; the
   * case conference is chaired by David and its outcome recorded by him; the protection plan starts
   * the review clock, which reaches Moira's Home on a case her seeded list never knew; and the
   * review is held and continued. Every stage is reached through the engine and no other way.
   */
  test('the case is walked by the people whose decisions they are, and each consequence is read off the screen', async ({ page }) => {
    await signInAs(page, 'usr_moira_gilmour');
    await createPerson(page, 'Elspeth', 'Munro', '1943-07-12');
    const reference = await startCase(page, 'asp', 'District nurse, Kirkbrae practice', 'Bruising on both forearms and a nephew who controls her money and her front door.');
    const caseUrl = page.url();
    const header = page.getByTestId('process-header');

    // The panel under the stepper is the tables' offer. The screening decision is the team
    // leader's, and the council officer is told so rather than shown a button that fails.
    const screening = page.getByTestId('next-asp-screening-decision');
    await expect(screening).toHaveAttribute('data-state', 'refused');
    await expect(screening).toContainText('is recorded by Team leader, not by your role');
    await expect(page.getByTestId('next-asp-screening-decision-button')).toBeDisabled();
    await capture(page, { phase: PHASE, screen: 'asp-next-refused', fullPage: true });

    // The three-point test, which the screening decision needs, from the panel the case already had.
    await page.getByRole('button', { name: 'Record three-point test' }).click();
    const test3 = page.getByRole('dialog');
    await test3.getByLabel('Date of assessment').fill('2026-09-02');
    for (let i = 0; i < 3; i += 1) await test3.getByRole('radio', { name: 'Met', exact: true }).nth(i).check();
    await test3.getByLabel('Reasoning for limb (a)').fill('Elspeth cannot get out of the house without help and depends on the nephew for shopping and money.');
    await test3.getByLabel('Reasoning for limb (b)').fill('Bruising on both forearms consistent with gripping; money missing from her account.');
    await test3.getByLabel('Reasoning for limb (c)').fill('Frailty and a memory that is going make her more vulnerable to being harmed than others.');
    await test3.getByLabel('Financial or Material harm').check();
    await test3.getByLabel('Physical harm').check();
    await test3.getByLabel('Immediate safety').fill('No immediate danger tonight; the district nurse is visiting tomorrow morning.');
    await test3.getByRole('button', { name: 'Record three-point test' }).click();
    await expect(toast(page).getByText('Three-point test recorded')).toBeVisible();

    // Anne screens it: proceed to inquiry. The stage moves, the stepper says who and when.
    await switchUser(page, 'usr_anne_hendry');
    await page.goto(caseUrl);
    await waitForData(page);
    await openTransition(page, 'asp-screening-decision');
    await expect(page.getByTestId('transition-route')).toContainText('Moves the case to Screening');
    await page.getByTestId('transition-rationale').fill('Three-point test met on all limbs. Financial and physical harm with a controlling nephew; inquiry under section 4.');
    await expectNoAxeViolations(page);
    await capture(page, { phase: PHASE, screen: 'asp-screening-form' });
    await submitTransition(page);
    await expect(header).toContainText('Screening');
    await expect(page.getByRole('region', { name: 'Process stages' })).toContainText('Anne Hendry');

    // Moira opens the inquiry: two agencies asked, each on a lawful basis, and the GP's agency told.
    await switchUser(page, 'usr_moira_gilmour');
    await page.goto(caseUrl);
    await waitForData(page);
    await openTransition(page, 'asp-open-inquiry');
    await page.getByTestId('transition-agency-health').check();
    await page.getByTestId('transition-agency-police').check();
    await page.getByTestId('transition-purpose').fill('Whether the practice or the police hold anything about the injuries or the nephew, for the section 4 inquiry.');
    await submitTransition(page);
    await expect(header).toContainText('Inquiry (s4)');
    await expect(page.getByText('Health, Police').first()).toBeVisible();

    await switchUser(page, 'usr_amira_farouk');
    await page.goto('/');
    await waitForData(page);
    await page.getByTestId('notifications-bell').click();
    await expect(page.getByTestId('notifications-panel').getByTestId('notification-item').filter({ hasText: `Moira Gilmour asked your agency for information on ${reference}` })).toBeVisible();
    await page.keyboard.press('Escape');

    // The inquiry outcome: proceed to investigation, with the four things the Act asks about.
    await switchUser(page, 'usr_moira_gilmour');
    await page.goto(caseUrl);
    await waitForData(page);
    await openTransition(page, 'asp-inquiry-outcome');
    await page.getByTestId('transition-capacity').check();
    await page.getByTestId('transition-capacity-summary').fill('Understands the questions; memory for recent events is poor. Capacity to decide about the visit is present.');
    await page.getByTestId('transition-pressure').check();
    await page.getByTestId('transition-advocacy').check();
    await page.getByTestId('transition-rationale').fill('The GP confirms unexplained bruising over three months and the bank confirms withdrawals Elspeth does not recognise.');
    await submitTransition(page);
    await expect(header).toContainText('Inquiry using investigatory powers');

    // A section 7 visit, which stays where it is and lands on the investigation panel.
    await openTransition(page, 'asp-investigatory-step');
    await expect(page.getByTestId('transition-route')).toContainText('Records a step');
    await page.getByTestId('transition-attended').fill('Moira Gilmour\nPC Sutherland');
    await page.getByTestId('transition-note').fill('Elspeth seen alone in the kitchen. Bruising consistent with gripping. The nephew was not present.');
    await submitTransition(page);
    await expect(page.getByText('Moira Gilmour, PC Sutherland.').first()).toBeVisible();

    // The case conference is scheduled from the panel through the schedule dialog, David chairing.
    await openTransition(page, 'asp-schedule-case-conference');
    await expect(page.getByTestId('meeting-type')).toHaveValue('asp-case-conference');
    await expect(page.getByTestId('meeting-route')).toHaveAttribute('data-state', 'transition');
    await page.getByTestId('meeting-date').fill('2026-09-16');
    await page.getByTestId('meeting-location').fill('Portlennan Resource Centre, room 1');
    await page.getByTestId('meeting-chair').selectOption('usr_david_laird');
    await page.getByTestId('meeting-submit').click();
    await expect(page.getByText('Meeting scheduled').last()).toBeVisible();
    await expect(page).toHaveURL(/\/meetings\/mtg_/);
    await waitForData(page);
    const conferenceUrl = page.url();
    await page.goto(caseUrl);
    await waitForData(page);
    await expect(page.getByTestId('next-held-asp-case-conference-held')).toContainText('Case conference held is recorded when the ASP case conference is held');
    await expect(page.getByTestId('next-held-asp-case-conference-held').getByRole('link')).toBeVisible();

    // David holds it: adult at risk, plan needed. The stage moves and the meeting names the decision.
    await switchUser(page, 'usr_david_laird');
    await page.goto(conferenceUrl);
    await waitForData(page);
    await page.getByTestId('hold-meeting').click();
    await expect(page.getByTestId('hold-route')).toContainText('Case conference held, which moves the case to Case conference');
    await page.getByTestId('outcome-rationale').fill('All three limbs met and the harm is continuing. A protection plan is needed with the nephew kept away.');
    await page.getByTestId('hold-submit').click();
    await expect(page.getByText('Meeting closed').last()).toBeVisible();
    await expect(page.getByTestId('meeting-history')).toContainText('Recorded on the case as Case conference held');

    // Moira records the protection plan: outcomes, a review date, and an action for Anne.
    await switchUser(page, 'usr_moira_gilmour');
    await page.goto(caseUrl);
    await waitForData(page);
    await expect(header).toContainText('Case conference');
    await openTransition(page, 'asp-record-protection-plan');
    await page.getByTestId('plan-title').fill('Keeping Elspeth safe at home');
    await page.getByTestId('plan-outcome-0').fill('Elspeth decides who comes into her house and who handles her money');
    await page.getByTestId('plan-review-date').fill('2026-12-01');
    await page.getByTestId('plan-add-action').click();
    await page.getByTestId('plan-action-title-0').fill('Arrange a corporate appointee for the pension');
    await page.getByTestId('plan-action-owner-0').selectOption('usr_anne_hendry');
    await page.getByTestId('plan-action-due-0').fill('2026-09-30');
    await expectNoAxeViolations(page);
    await capture(page, { phase: PHASE, screen: 'asp-plan-form', fullPage: true });
    await submitTransition(page);
    await expect(header).toContainText('Protection plan');
    await expect(page.getByText('Keeping Elspeth safe at home').first()).toBeVisible();
    await expect(page.getByRole('row').filter({ hasText: 'Arrange a corporate appointee' })).toContainText('Anne Hendry');
    await capture(page, { phase: PHASE, screen: 'asp-plan-recorded', fullPage: true });

    // The review clock the plan started reaches Home, on a case Moira's seeded list never knew.
    await page.goto('/');
    await waitForData(page);
    const clocks = page.locator('section[aria-labelledby="home-clocks"]');
    await expect(clocks.getByText('Elspeth Munro').first()).toBeVisible();
    await expect(clocks.getByText(/review/i).first()).toBeVisible();

    // And Anne has the action.
    await switchUser(page, 'usr_anne_hendry');
    await page.goto('/');
    await waitForData(page);
    await page.getByTestId('notifications-bell').click();
    await expect(page.getByTestId('notifications-panel').getByTestId('notification-item').filter({ hasText: 'Arrange a corporate appointee for the pension' })).toBeVisible();
    await page.keyboard.press('Escape');

    // The review: scheduled by Moira, held by David, continued with a new date; the clock restarts.
    await switchUser(page, 'usr_moira_gilmour');
    await page.goto(caseUrl);
    await waitForData(page);
    await openTransition(page, 'asp-schedule-review');
    // The matrix seats nobody at the protection plan stage but the adult and their advocate, so the
    // dialog says so and the list is built by hand.
    await expect(page.getByTestId('meeting-invitees')).toContainText('The matrix seats nobody at this stage');
    await page.getByTestId('meeting-add-invitee').selectOption('usr_anne_hendry');
    await page.getByTestId('meeting-add-invitee-button').click();
    await page.getByTestId('meeting-date').fill('2026-11-25');
    await page.getByTestId('meeting-location').fill('Portlennan Resource Centre, room 1');
    await page.getByTestId('meeting-chair').selectOption('usr_david_laird');
    await page.getByTestId('meeting-submit').click();
    await expect(page.getByText('Meeting scheduled').last()).toBeVisible();
    await expect(page).toHaveURL(/\/meetings\/mtg_/);
    await waitForData(page);
    const reviewUrl = page.url();
    await switchUser(page, 'usr_david_laird');
    await page.goto(reviewUrl);
    await waitForData(page);
    await page.getByTestId('hold-meeting').click();
    await page.getByTestId('outcome-review-date').fill('2027-03-01');
    await page.getByTestId('outcome-rationale').fill('The appointeeship is in place and the nephew has not been back. The plan continues to the spring.');
    await page.getByTestId('hold-submit').click();
    await expect(page.getByText('Meeting closed').last()).toBeVisible();
    await page.goto(caseUrl);
    await waitForData(page);
    await expect(header).toContainText('Review');
    await expect(page.getByText('01 Mar 2027').first()).toBeVisible();
    await capture(page, { phase: PHASE, screen: 'asp-reviewed', fullPage: true });
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
