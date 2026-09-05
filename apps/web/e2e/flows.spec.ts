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

test.describe('F.2.2 child protection, driven from a concern to de-registration', () => {
  test.setTimeout(300_000);

  /** The IRD's seven decisions, each with a rationale the engine accepts. */
  async function decideIrd(page: Page, investigate: boolean) {
    const answers: Array<[string, string]> = [
      ['significantHarm', 'Bruising to the upper arm not consistent with the account, and a disclosure to the class teacher.'],
      ['investigationNeeded', investigate ? 'A joint investigation is needed to establish how the injury happened.' : 'The account is consistent and the injury explained; health will follow up.'],
      ['jii', 'Rowan can give an account and should be interviewed jointly.'],
      ['medical', 'A forensic examination of the injury is needed.'],
      ['emergencyMeasures', 'Rowan is safe with the grandmother tonight and no order is needed.'],
      ['reporterReferral', 'Compulsory measures may be needed if the parents do not engage.'],
      ['parentsInformed', 'The parents are told today; nothing in the account points at either of them.'],
    ];
    for (const [key, rationale] of answers) {
      const block = page.getByTestId(`ird-${key}`);
      if (key === 'investigationNeeded' && !investigate) await block.getByRole('radio', { name: 'No' }).check();
      await page.getByTestId(`ird-${key}-rationale`).fill(rationale);
    }
    await page.getByTestId('ird-child-views').fill('Spoken to at school with the teacher present. Rowan says he wants to stay with Gran for now.');
    await page.getByTestId('ird-contribution-add').click();
    await page.getByTestId('ird-contribution-name-0').fill('DS Paul Mackay');
    await page.getByTestId('ird-contribution-summary-0').fill('Two prior domestic calls to the address, no charges.');
  }

  /**
   * Nothing seeded. Janet records the concern and convenes the IRD, whose decisions she records
   * from the meeting; the JII and the medical are hers; the planning meeting is scheduled with the
   * parents invited, David chairs it and registers the child with two concerns, a core group and a
   * plan whose action reaches its owner; the first core group meeting completes its clock; the
   * review continues the plan; and Anne de-registers, which closes the case with the national
   * return's reason.
   */
  test('the case is walked from a child concern to de-registration by the people whose decisions they are', async ({ page }) => {
    await signInAs(page, 'usr_janet_kerr');
    await createPerson(page, 'Rowan', 'Baxter', '2019-03-04');
    await startCase(page, 'cp', 'Class teacher, Ardvale Primary', 'Bruising to the upper arm and a disclosure to the class teacher that Dad grabbed him.');
    const caseUrl = page.url();
    const header = page.getByTestId('process-header');

    // The IRD is convened as a meeting, tripartite by the engine's own rule.
    await openTransition(page, 'cp-convene-ird');
    await expect(page.getByTestId('meeting-type')).toHaveValue('ird');
    await page.getByTestId('meeting-date').fill('2026-09-02');
    await page.getByTestId('meeting-time').fill('14:00');
    await page.getByTestId('meeting-location').fill('Ardvale Civic Centre, by telephone');
    await page.getByTestId('meeting-add-invitee').selectOption('usr_fiona_ross');
    await page.getByTestId('meeting-add-invitee-button').click();
    await page.getByTestId('meeting-submit').click();
    await expect(page.getByText('Meeting scheduled').last()).toBeVisible();
    await expect(page).toHaveURL(/\/meetings\/mtg_/);
    await waitForData(page);
    const irdUrl = page.url();
    await page.goto(caseUrl);
    await waitForData(page);
    await expect(header).toContainText('IRD');
    await expect(page.getByTestId('next-held-cp-ird-decisions')).toContainText('Record IRD decisions is recorded when the Inter-agency Referral Discussion is held');

    // Its decisions are recorded from the meeting. Refusing to investigate needs a route; investigating opens the investigation.
    await page.goto(irdUrl);
    await waitForData(page);
    await page.getByTestId('hold-meeting').click();
    await expect(page.getByTestId('hold-route')).toContainText('Record IRD decisions, which moves the case to Investigation');
    await decideIrd(page, true);
    await expectNoAxeViolations(page);
    await capture(page, { phase: PHASE, screen: 'cp-ird-form', fullPage: true });
    await page.getByTestId('hold-submit').click();
    await expect(page.getByText('Meeting closed').last()).toBeVisible();
    await page.goto(caseUrl);
    await waitForData(page);
    await expect(header).toContainText('Investigation');
    await expect(page.getByText('Two prior domestic calls to the address').first()).toBeVisible();
    // The planning meeting clock started when the investigation opened.
    await expect(page.getByText(/planning meeting/i).first()).toBeVisible();

    // The interview and the medical, from the case.
    await openTransition(page, 'cp-record-jii');
    await page.getByTestId('transition-date').fill('2026-09-03');
    await page.getByTestId('transition-summary').fill('Rowan described being grabbed and pushed against the door. Consistent with the bruising.');
    await submitTransition(page);
    await openTransition(page, 'cp-record-medical');
    await page.getByTestId('transition-date').fill('2026-09-03');
    await page.getByTestId('transition-summary').fill('Grip-pattern bruising to the left upper arm, two to four days old. No other injuries.');
    await submitTransition(page);
    await expect(page.getByText('Grip-pattern bruising').first()).toBeVisible();

    // The planning meeting, parents invited, David chairing, Lesley minuting.
    await openTransition(page, 'cp-schedule-cppm');
    await expect(page.getByTestId('meeting-type')).toHaveValue('cppm');
    await page.getByTestId('meeting-date').fill('2026-09-14');
    await page.getByTestId('meeting-location').fill('Ardvale Civic Centre, room 2.4');
    await page.getByTestId('meeting-chair').selectOption('usr_david_laird');
    await page.getByTestId('meeting-minute-taker').selectOption('usr_lesley_morton');
    // The matrix seats the health adviser at the investigation stage, so she is already on the list.
    await expect(page.getByTestId('invitee-usr_fiona_ross')).toBeChecked();
    await page.getByTestId('meeting-submit').click();
    await expect(page.getByText('Meeting scheduled').last()).toBeVisible();
    await expect(page).toHaveURL(/\/meetings\/mtg_/);
    await waitForData(page);
    const cppmUrl = page.url();
    await expect(page.getByTestId('meeting-attendance-note')).toHaveText('Parents invited. Child invited.');

    // David registers: two concerns, a core group, a lead professional, a plan with an action for the health adviser.
    // The owner has to be somebody the case permits at the stage the plan is recorded from (D-212):
    // the health visitor is seated by the matrix only once the child is on the register.
    await switchUser(page, 'usr_david_laird');
    await page.goto(cppmUrl);
    await waitForData(page);
    await page.getByTestId('hold-meeting').click();
    await expect(page.getByTestId('hold-route')).toContainText('Planning meeting held');
    await page.getByTestId('cppm-concern-physical-abuse').check();
    await page.getByTestId('cppm-concern-neglect').check();
    await page.getByTestId('cppm-member-usr_janet_kerr').check();
    await page.getByTestId('cppm-member-usr_fiona_ross').check();
    await page.getByTestId('cppm-lead').selectOption('usr_janet_kerr');
    await page.getByTestId('plan-title').fill("Rowan's plan");
    await page.getByTestId('plan-outcome-0').fill('Rowan is safe from physical harm at home');
    await page.getByTestId('plan-add-action').click();
    await page.getByTestId('plan-action-title-0').fill('Weekly health contact with the family');
    await page.getByTestId('plan-action-owner-0').selectOption('usr_fiona_ross');
    await page.getByTestId('plan-action-due-0').fill('2026-09-21');
    await page.getByTestId('outcome-rationale').fill('Physical injury by a parent, a pattern of neglect at home, and a family that has not engaged with earlier support.');
    await expectNoAxeViolations(page);
    await capture(page, { phase: PHASE, screen: 'cp-cppm-form', fullPage: true });
    await page.getByTestId('hold-submit').click();
    await expect(page.getByText('Meeting closed').last()).toBeVisible();
    await page.goto(caseUrl);
    await waitForData(page);
    await expect(header).toContainText("Child's plan");
    await expect(page.getByText('Physical abuse').first()).toBeVisible();
    await expect(page.getByText('Neglect').first()).toBeVisible();
    await expect(page.getByText(/Category of registration/i)).toHaveCount(0);
    await expect(page.getByRole('row').filter({ hasText: 'Weekly health contact' })).toContainText('Fiona Ross');
    await capture(page, { phase: PHASE, screen: 'cp-registered', fullPage: true });

    // The lead professional's Home carries the core group clock; the health adviser has her action.
    await switchUser(page, 'usr_janet_kerr');
    await page.goto('/');
    await waitForData(page);
    const clocks = page.locator('section[aria-labelledby="home-clocks"]');
    await expect(clocks.getByText('Rowan Baxter').first()).toBeVisible();
    await expect(clocks.getByText('First core group meeting').first()).toBeVisible();
    await switchUser(page, 'usr_fiona_ross');
    await page.goto('/');
    await waitForData(page);
    await page.getByTestId('notifications-bell').click();
    await expect(page.getByTestId('notifications-panel').getByTestId('notification-item').filter({ hasText: 'Weekly health contact with the family' })).toBeVisible();
    await page.keyboard.press('Escape');

    // The first core group meeting: scheduled as a plain meeting, held with attendance and progress, which completes its clock.
    await switchUser(page, 'usr_janet_kerr');
    await page.goto(caseUrl);
    await waitForData(page);
    await page.getByTestId('schedule-meeting').click();
    await page.getByTestId('meeting-type').selectOption('core-group');
    await expect(page.getByTestId('meeting-route')).toHaveAttribute('data-state', 'plain');
    await page.getByTestId('meeting-date').fill('2026-09-28');
    await page.getByTestId('meeting-location').fill('Ardvale Primary, family room');
    await page.getByTestId('meeting-add-invitee').selectOption('usr_fiona_ross');
    await page.getByTestId('meeting-add-invitee-button').click();
    await page.getByTestId('meeting-submit').click();
    await expect(page.getByText('Meeting scheduled').last()).toBeVisible();
    await expect(page).toHaveURL(/\/meetings\/mtg_/);
    await waitForData(page);
    await page.getByTestId('hold-meeting').click();
    await expect(page.getByTestId('hold-route')).toContainText('Record core group meeting');
    await page.getByTestId('outcome-present-usr_fiona_ross').check();
    await page.getByTestId('outcome-progress').fill('Weekly contact in place. The father has moved out and Gran is staying. Nursery attendance is full.');
    await page.getByTestId('hold-submit').click();
    await expect(page.getByText('Meeting closed').last()).toBeVisible();
    await page.goto(caseUrl);
    await waitForData(page);
    await expect(page.getByText('First core group meeting').first()).toBeVisible();

    // The review planning meeting continues the plan; then the chair de-registers, which closes the case.
    // Anne could too, by role, but she has recorded nothing on this case and is not on it (D-219).
    await openTransition(page, 'cp-schedule-review-cppm');
    await page.getByTestId('meeting-date').fill('2027-02-22');
    await page.getByTestId('meeting-location').fill('Ardvale Civic Centre, room 2.4');
    await page.getByTestId('meeting-chair').selectOption('usr_david_laird');
    await page.getByTestId('meeting-add-invitee').selectOption('usr_fiona_ross');
    await page.getByTestId('meeting-add-invitee-button').click();
    await page.getByTestId('meeting-submit').click();
    await expect(page.getByText('Meeting scheduled').last()).toBeVisible();
    await expect(page).toHaveURL(/\/meetings\/mtg_/);
    await waitForData(page);
    const reviewUrl = page.url();
    await switchUser(page, 'usr_david_laird');
    await page.goto(reviewUrl);
    await waitForData(page);
    await page.getByTestId('hold-meeting').click();
    await page.getByTestId('outcome-rationale').fill('The plan is working: no further injury, the father is out of the house and the family is engaging.');
    await page.getByTestId('hold-submit').click();
    await expect(page.getByText('Meeting closed').last()).toBeVisible();
    await page.goto(caseUrl);
    await waitForData(page);
    await expect(header).toContainText('Review');
    await openTransition(page, 'cp-deregister');
    await page.getByTestId('transition-reason').selectOption('improved-home-situation');
    await page.getByTestId('transition-note').fill('Six months without injury, the father has left, and Gran is a protective factor.');
    await submitTransition(page);
    await expect(header).toContainText('Closed');
    await expect(page.getByRole('region', { name: 'Process stages' })).toContainText('De-registered');
    await expect(page.getByText('Improved home situation').first()).toBeVisible();
    await capture(page, { phase: PHASE, screen: 'cp-deregistered', fullPage: true });
  });

  /**
   * The same engine on an unborn child: the pre-birth planning meeting registers the baby, and the
   * birth, recorded from the case, converts the subject and hands the pre-birth clocks to the
   * child protection ones.
   */
  test('a pre-birth case is registered before the birth, and the birth swaps its clocks', async ({ page }) => {
    await signInAs(page, 'usr_janet_kerr');
    await page.goto('/people');
    await waitForData(page);
    await page.getByTestId('add-person').click();
    const dialog = page.getByRole('dialog');
    await dialog.getByLabel('Given name').fill('Baby');
    await dialog.getByLabel('Family name').fill('Wishart');
    await page.getByTestId('create-person-search').click();
    await page.getByTestId('create-person-none-match').click();
    await dialog.getByLabel('Life stage').selectOption('unborn');
    await dialog.getByLabel('Expected delivery date').fill('2026-11-20');
    await page.getByTestId('create-person-submit').click();
    await expect(page.getByRole('dialog')).toHaveCount(0);
    await waitForData(page);
    const reference = await startCase(page, 'cp', 'Midwife, Ardvale maternity', 'Mother using heroin through the pregnancy and the partner has a conviction for assaulting a previous partner.');
    const caseUrl = page.url();
    const header = page.getByTestId('process-header');
    await expect(page.getByText(/pre-birth/i).first()).toBeVisible();

    await openTransition(page, 'cp-convene-ird');
    await page.getByTestId('meeting-date').fill('2026-09-03');
    await page.getByTestId('meeting-location').fill('Ardvale maternity, by telephone');
    await page.getByTestId('meeting-add-invitee').selectOption('usr_kasia_nowicka');
    await page.getByTestId('meeting-add-invitee-button').click();
    await page.getByTestId('meeting-submit').click();
    await expect(page.getByText('Meeting scheduled').last()).toBeVisible();
    await expect(page).toHaveURL(/\/meetings\/mtg_/);
    await waitForData(page);
    await page.getByTestId('hold-meeting').click();
    await decideIrd(page, true);
    await page.getByTestId('hold-submit').click();
    await expect(page.getByText('Meeting closed').last()).toBeVisible();

    await page.goto(caseUrl);
    await waitForData(page);
    await openTransition(page, 'cp-schedule-cppm');
    // A pre-birth case schedules a pre-birth planning meeting, and only that.
    await expect(page.getByTestId('meeting-type')).toHaveValue('pre-birth-cppm');
    await page.getByTestId('meeting-date').fill('2026-09-24');
    await page.getByTestId('meeting-location').fill('Ardvale Civic Centre, room 2.4');
    await page.getByTestId('meeting-chair').selectOption('usr_david_laird');
    await page.getByTestId('meeting-add-invitee').selectOption('usr_kasia_nowicka');
    await page.getByTestId('meeting-add-invitee-button').click();
    await page.getByTestId('meeting-submit').click();
    await expect(page.getByText('Meeting scheduled').last()).toBeVisible();
    await expect(page).toHaveURL(/\/meetings\/mtg_/);
    await waitForData(page);
    const cppmUrl = page.url();
    await switchUser(page, 'usr_david_laird');
    await page.goto(cppmUrl);
    await waitForData(page);
    await page.getByTestId('hold-meeting').click();
    await page.getByTestId('cppm-concern-parental-substance-use').check();
    await page.getByTestId('cppm-concern-domestic-abuse').check();
    await page.getByTestId('cppm-member-usr_janet_kerr').check();
    await page.getByTestId('cppm-member-usr_kasia_nowicka').check();
    await page.getByTestId('cppm-lead').selectOption('usr_janet_kerr');
    await page.getByTestId('plan-title').fill('Pre-birth plan');
    await page.getByTestId('plan-outcome-0').fill('The baby goes home to a safe, drug-free household or to kinship care');
    await page.getByTestId('outcome-rationale').fill('Substance use through the pregnancy and a violent partner in the household: the baby will be at risk of significant harm from birth.');
    await page.getByTestId('hold-submit').click();
    await expect(page.getByText('Meeting closed').last()).toBeVisible();

    // Registered before the birth, with the pre-birth review clock running.
    await switchUser(page, 'usr_janet_kerr');
    await page.goto(caseUrl);
    await waitForData(page);
    await expect(header).toContainText("Child's plan");
    await expect(page.getByText('Parental substance use').first()).toBeVisible();
    await expect(page.getByText('Review of the pre-birth plan').first()).toBeVisible();

    // The birth, from the case: the subject becomes a child and the review clock is the child protection one.
    await openTransition(page, 'cp-birth');
    await page.getByTestId('transition-date').fill('2026-11-18');
    await submitTransition(page);
    await expect(page.getByText('First review CPPM').first()).toBeVisible();
    await expect(page.getByRole('heading', { name: /Pre-birth/ })).toHaveCount(0);
    await expect(header).toContainText('born 18 Nov 2026');
    await capture(page, { phase: PHASE, screen: 'cp-pre-birth-born', fullPage: true });
    expect(reference).toMatch(/^CP-/);
  });
});

test.describe('F.2.3 MARAC, driven from a referral to feedback, with the child concern opened from the action list', () => {
  test.setTimeout(300_000);
  /**
   * Nothing seeded. Karen makes the three people and the referral, which names the perpetrator;
   * the research cannot go out until the meeting is in the diary, because the return counts back
   * from it; housing and the GP answer from the Sharing screen and the answers land on the case as
   * returns, the last one completing the clock; Karen hears the case from the meeting workspace and
   * records the plan with a flag and the MATAC and DSDAS questions; the child concern opens from
   * her own action in one click and becomes a child protection case Janet can see, linked both
   * ways; Sadia records the feedback; and the transfer completes every running clock. A second
   * referral for the same victim then says it is a repeat.
   */
  test('the case is walked by the coordinator, two research agencies and the IDAA, and the child concern opens a linked child protection case', async ({ page }) => {
    await signInAs(page, 'usr_karen_findlay');
    await createPerson(page, 'Craig', 'Lennox', '1988-02-11');
    await createPerson(page, 'Ellie', 'Lennox', '2019-03-04');
    await createPerson(page, 'Nicola', 'Lennox', '1990-05-23');
    const reference = await startCase(page, 'marac', 'DC Sutherland, domestic abuse investigation unit', 'Third call-out in four months. Strangulation disclosed at the DAQ. He still has a key to the flat and Ellie was in the room.', { perpetrator: 'Craig Lennox' });
    const caseUrl = page.url();
    const header = page.getByTestId('process-header');

    // The referral names him, says he must not receive anything, and his name is not a link.
    const referral = page.getByTestId('marac-referral');
    await expect(referral).toContainText('Craig Lennox');
    await expect(referral).toContainText('Must not receive anything about this process');
    await expect(referral.getByRole('link', { name: 'Craig Lennox' })).toHaveCount(0);
    await expect(referral.getByRole('link', { name: 'Nicola Lennox' })).toBeVisible();

    // The research cannot go out before the meeting is in the diary, and the refusal opens the diary.
    const research = page.getByTestId('next-marac-send-research-requests');
    await expect(research).toHaveAttribute('data-state', 'refused');
    await expect(research).toContainText('No MARAC is scheduled');
    await capture(page, { phase: PHASE, screen: 'marac-next-refused', fullPage: true });
    await page.getByTestId('creates-marac-schedule-meeting').click();
    await expect(page.getByTestId('meeting-type')).toHaveValue('marac');
    await expect(page.getByTestId('meeting-route')).toHaveAttribute('data-state', 'transition');
    // The matrix seats the IDAA at the referral, and the perpetrator is left off by his case role.
    await expect(page.getByTestId('meeting-invitees')).toContainText('Sadia Qureshi');
    await expect(page.getByTestId('meeting-left-off')).toContainText('Perpetrator: The perpetrator is never told about MARAC');
    await page.getByTestId('meeting-date').fill('2026-09-17');
    await page.getByTestId('meeting-time').fill('09:30');
    await page.getByTestId('meeting-location').fill('Ardvale Police Station, conference room');
    await page.getByTestId('meeting-chair').selectOption('usr_karen_findlay');
    await page.getByTestId('meeting-submit').click();
    await expect(page.getByText('Meeting scheduled').last()).toBeVisible();
    await expect(page).toHaveURL(/\/meetings\/mtg_/);
    await waitForData(page);
    const meetingUrl = page.url();

    // The research goes out to two agencies, the stage moves, and the return clock starts.
    await page.goto(caseUrl);
    await waitForData(page);
    await expect(research).toHaveAttribute('data-state', 'open');
    await openTransition(page, 'marac-send-research-requests');
    await page.getByTestId('transition-agency-housing').check();
    await page.getByTestId('transition-agency-health').check();
    await page.getByTestId('transition-wording').fill('Nicola Lennox, 23 May 1990; Craig Lennox, 11 Feb 1988; Ellie Lennox, 4 Mar 2019. Anything relevant to the risk of serious harm, for the MARAC on 17 September.');
    await page.getByTestId('transition-due').fill('2026-09-14');
    await expectNoAxeViolations(page);
    await capture(page, { phase: PHASE, screen: 'marac-research-form' });
    await submitTransition(page);
    await expect(header).toContainText('Research');
    const researchTable = page.getByTestId('marac-research');
    await expect(researchTable.getByRole('row').filter({ hasText: 'Housing' })).toContainText('Sent');
    await expect(researchTable.getByRole('row').filter({ hasText: 'Health' })).toContainText('Sent');
    await expect(page.getByText(/research return/i).first()).toBeVisible();

    // Housing is told, and answers from the Sharing screen: nothing known, which is still a return.
    await switchUser(page, 'usr_mark_hepburn');
    await page.goto('/');
    await waitForData(page);
    await page.getByTestId('notifications-bell').click();
    await expect(page.getByTestId('notifications-panel').getByTestId('notification-item').filter({ hasText: `Karen Findlay asked your agency for information on ${reference}` })).toBeVisible();
    await page.keyboard.press('Escape');
    await page.goto('/sharing?tab=inbound');
    await waitForData(page);
    const housingRequest = page.locator('section').filter({ hasText: `MARAC ${reference}` }).filter({ has: page.getByRole('button', { name: 'Respond' }) }).first();
    await housingRequest.getByRole('button', { name: 'Respond' }).click();
    await expect(page.getByRole('dialog')).toContainText(`Karen Findlay asked your agency for MARAC research on ${reference}`);
    await page.getByTestId('respond-nothing-known').check();
    // The protocol's confirmation is the engine's rule, and it refuses without it.
    await page.getByTestId('respond-submit').click();
    await expect(toast(page).getByText('Confirm the return is relevant, necessary and proportionate')).toBeVisible();
    await page.getByTestId('respond-proportionate').check();
    await page.getByTestId('respond-submit').click();
    await expect(toast(page).getByText(`Recorded on ${reference}: Research returned by housing (nothing known)`)).toBeVisible();

    // The GP answers with what the practice holds.
    await switchUser(page, 'usr_amira_farouk');
    await page.goto('/sharing?tab=inbound');
    await waitForData(page);
    const healthRequest = page.locator('section').filter({ hasText: `MARAC ${reference}` }).filter({ has: page.getByRole('button', { name: 'Respond' }) }).first();
    await healthRequest.getByRole('button', { name: 'Respond' }).click();
    await page.getByTestId('respond-text').fill('Seen twice since June with injuries she said were from a fall; the second time a fractured wrist. Ellie is not registered with the practice.');
    await page.getByTestId('respond-proportionate').check();
    await expectNoAxeViolations(page);
    await capture(page, { phase: PHASE, screen: 'marac-research-return' });
    await page.getByTestId('respond-submit').click();
    await expect(toast(page).getByText(`Recorded on ${reference}: Research returned by health`)).toBeVisible();

    // Both returns are on the case; the last one completed the clock; Karen was told twice.
    await switchUser(page, 'usr_karen_findlay');
    await page.goto('/');
    await waitForData(page);
    await page.getByTestId('notifications-bell').click();
    const panel = page.getByTestId('notifications-panel');
    await expect(panel.getByTestId('notification-item').filter({ hasText: `Mark Hepburn returned the information you asked for on ${reference}` })).toBeVisible();
    await expect(panel.getByTestId('notification-item').filter({ hasText: `Amira Farouk returned the information you asked for on ${reference}` })).toBeVisible();
    await page.keyboard.press('Escape');
    await page.goto(caseUrl);
    await waitForData(page);
    await expect(researchTable.getByRole('row').filter({ hasText: 'Housing' })).toContainText('Nothing known');
    await expect(researchTable.getByRole('row').filter({ hasText: 'Health' })).toContainText('fractured wrist');
    await expect(page.getByTestId('next-held-marac-heard')).toContainText('Heard at MARAC is recorded when the MARAC is held');
    await capture(page, { phase: PHASE, screen: 'marac-research-back', fullPage: true });

    // Karen hears the case from the meeting: what each agency shared and the risk discussion.
    await page.goto(meetingUrl);
    await waitForData(page);
    await page.getByTestId('hold-meeting').click();
    await expect(page.getByTestId('hold-route')).toContainText('Heard at MARAC, which moves the case to Meeting');
    await page.getByTestId('outcome-shared-add').click();
    await page.getByTestId('outcome-shared-agency-0').selectOption('police');
    await page.getByTestId('outcome-shared-summary-0').fill('Three call-outs in four months, the last with a strangulation disclosure. Bail conditions in place.');
    await page.getByTestId('outcome-shared-add').click();
    await page.getByTestId('outcome-shared-agency-1').selectOption('health');
    await page.getByTestId('outcome-shared-summary-1').fill('Two presentations with injuries since June, one fracture.');
    await page.getByTestId('outcome-risk-discussion').fill('High risk: escalation, strangulation and access to the flat. Ellie present at the last incident.');
    await page.getByTestId('hold-submit').click();
    await expect(page.getByText('Meeting closed').last()).toBeVisible();
    await expect(page.getByTestId('meeting-history')).toContainText('Recorded on the case as Heard at MARAC');

    // The action plan: an action for Karen, one for housing, a housing flag, MATAC and DSDAS considered.
    await page.goto(caseUrl);
    await waitForData(page);
    await expect(header).toContainText('Meeting');
    await openTransition(page, 'marac-record-action-plan');
    await page.getByTestId('plan-title').fill('Keeping Nicola and Ellie safe in the flat');
    await page.getByTestId('plan-outcome-0').fill('Craig cannot get into the flat and Nicola knows who to call');
    await page.getByTestId('plan-add-action').click();
    await page.getByTestId('plan-action-title-0').fill('Consider an IRD for Ellie with children and families');
    await page.getByTestId('plan-action-owner-0').selectOption('usr_karen_findlay');
    await page.getByTestId('plan-action-due-0').fill('2026-09-24');
    await page.getByTestId('plan-add-action').click();
    await page.getByTestId('plan-action-title-1').fill('Change the locks and fit a sanctuary door');
    await page.getByTestId('plan-action-owner-1').selectOption('usr_mark_hepburn');
    await page.getByTestId('plan-action-due-1').fill('2026-09-30');
    await page.getByTestId('transition-add-flag').click();
    await page.getByTestId('flag-agency-0').selectOption('housing');
    await page.getByTestId('flag-system-0').fill('Northgate housing');
    await page.getByTestId('flag-receipt-0').fill('HSG-4471');
    await page.getByTestId('transition-matac').check();
    await page.getByTestId('transition-dsdas').check();
    await page.getByTestId('transition-dsdas-note').fill('No new partner known; to be revisited at feedback.');
    await expectNoAxeViolations(page);
    await capture(page, { phase: PHASE, screen: 'marac-plan-form', fullPage: true });
    await submitTransition(page);
    await expect(header).toContainText('Action plan');
    await expect(page.getByTestId('marac-flags')).toContainText('HSG-4471');
    await expect(page.getByTestId('marac-links')).toContainText('MATAC considered');
    await expect(page.getByTestId('marac-links')).toContainText('DSDAS considered');
    await expect(page.getByText(/flag expiry/i).first()).toBeVisible();
    await capture(page, { phase: PHASE, screen: 'marac-plan-recorded', fullPage: true });

    // The child concern opens from Karen's own action in one click, names Ellie, and becomes a
    // child protection case linked both ways.
    await page.goto('/actions');
    await waitForData(page);
    const irdAction = page.getByRole('row').filter({ hasText: 'Consider an IRD for Ellie' });
    await irdAction.getByTestId(/^cp-concern-/).click();
    await expect(page.getByTestId('transition-route')).toContainText('Records a step');
    await expect(page.getByTestId('transition-summary')).toHaveValue(`From the MARAC action on ${reference}: Consider an IRD for Ellie with children and families.`);
    await page.getByTestId('transition-child-query').fill('Ellie Lennox');
    await page.getByTestId('transition-child-results').getByRole('button', { name: /Ellie Lennox/ }).first().click();
    await expect(page.getByRole('checkbox', { name: /Ellie Lennox/ })).toBeChecked();
    await page.getByTestId('transition-summary').fill(`From the MARAC action on ${reference}: Ellie was in the room at the last incident and the perpetrator still has a key. An IRD is needed.`);
    await expectNoAxeViolations(page);
    await capture(page, { phase: PHASE, screen: 'marac-child-concern-form' });
    await submitTransition(page);
    await expect(page).toHaveURL(/\/processes\//);
    await expect(header).toContainText('Ellie Lennox');
    const cpReference = /CP-\d{4}-\d{4}/.exec((await header.textContent()) ?? '')?.[0] ?? '';
    expect(cpReference).not.toBe('');
    await expect(page.getByTestId(`linked-${reference}`)).toBeVisible();
    await capture(page, { phase: PHASE, screen: 'marac-chain-driven', fullPage: true });
    await page.goto(caseUrl);
    await waitForData(page);
    await expect(page.getByTestId('marac-links')).toContainText('Child protection process');
    await expect(page.getByTestId('marac-referral')).toContainText('Ellie Lennox');

    // Janet, who holds the children's social work role, finds the concern in her list.
    await switchUser(page, 'usr_janet_kerr');
    await page.goto('/processes');
    await waitForData(page);
    await expect(page.getByRole('link', { name: cpReference })).toBeVisible();
    await page.getByRole('link', { name: cpReference }).click();
    await waitForData(page);
    await expect(page.getByTestId(`linked-${reference}`)).toBeVisible();

    // Mark has his action.
    await switchUser(page, 'usr_mark_hepburn');
    await page.goto('/');
    await waitForData(page);
    await page.getByTestId('notifications-bell').click();
    await expect(page.getByTestId('notifications-panel').getByTestId('notification-item').filter({ hasText: 'Change the locks and fit a sanctuary door' })).toBeVisible();
    await page.keyboard.press('Escape');

    // Sadia records the feedback, which moves the case; Karen transfers it, which completes the clocks.
    await switchUser(page, 'usr_sadia_qureshi');
    await page.goto(caseUrl);
    await waitForData(page);
    await openTransition(page, 'marac-idaa-feedback');
    await page.getByTestId('transition-summary').fill('Nicola was told the outcome the same afternoon. She has the new locks and knows the door is coming.');
    await page.getByTestId('transition-victim-response').fill('Relieved. Worried about what happens when the bail ends.');
    await submitTransition(page);
    await expect(header).toContainText('Feedback');
    await expect(page.getByTestId('marac-feedback')).toContainText('Relieved');

    await switchUser(page, 'usr_karen_findlay');
    await page.goto(caseUrl);
    await waitForData(page);
    await openTransition(page, 'marac-transfer');
    await page.getByTestId('transition-area').fill('Lanarkshire');
    await page.getByTestId('transition-coordinator').fill('J Smith');
    await submitTransition(page);
    await expect(header).toContainText('Transferred');
    await expect(page.getByTestId('marac-links')).toContainText('Transferred to Lanarkshire');
    await capture(page, { phase: PHASE, screen: 'marac-transferred', fullPage: true });

    // A second referral for the same victim within twelve months is a repeat, and the dialog says so.
    await page.getByTestId('marac-referral').getByRole('link', { name: 'Nicola Lennox' }).click();
    await waitForData(page);
    await page.getByTestId('start-process').click();
    await page.getByTestId('process-choice-marac').getByRole('radio').check();
    await expect(page.getByTestId('marac-repeat')).toContainText('This is a repeat referral');
  });

  test('the seeded chain holds, clickable end to end, and the clock is running at the far end', async ({ page }) => {
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

test.describe('F.2.4 MAPPA, driven from a notification to an exit, with the restriction read from outside', () => {
  test.setTimeout(300_000);
  /**
   * Nothing seeded. Priya notifies the case; the referral up is refused until a risk assessment
   * is on the record and the refusal records one; the referral names the level sought and moves
   * the case; Ross asks two single points of contact for returns and both answer from their own
   * inboxes; the level 2 meeting is scheduled from the panel and held from the workspace, which
   * sets the level, records the risk management plan and starts the review clock; a disclosure is
   * proposed and approved on the register; somebody outside the responsible authorities reads
   * presence and nothing else; and the exit completes the clock.
   */
  test('the case is walked by the lead responsible authority, the coordinator and two duty-to-cooperate agencies, and a reader outside them sees presence only', async ({ page }) => {
    await signInAs(page, 'usr_priya_sharif');
    await createPerson(page, 'Lee', 'Cargill', '1979-06-30');
    const reference = await startCase(page, 'mappa', 'Police Scotland, sex offender liaison', 'Released on licence on 28 Aug 2026 after a conviction for sexual assault; registered sex offender for ten years.');
    const caseUrl = page.url();
    const header = page.getByTestId('process-header');
    await expect(header).toContainText('Notification');

    // The referral up needs a current risk assessment, and the refusal records one.
    const refer = page.getByTestId('next-mappa-refer-level');
    await expect(refer).toHaveAttribute('data-state', 'refused');
    await expect(refer).toContainText('A current risk assessment is required');
    await page.getByTestId('creates-risk-assessment').click();
    await page.getByTestId('risk-tool').selectOption('rm2000');
    await page.getByTestId('risk-band').selectOption('high');
    await page.getByTestId('risk-date').fill('2026-09-01');
    await page.getByTestId('risk-summary').fill('Risk Matrix 2000 high on the sexual scale; two previous convictions and a stranger victim.');
    await expectNoAxeViolations(page);
    await capture(page, { phase: PHASE, screen: 'mappa-risk-form' });
    await page.getByTestId('risk-submit').click();
    await expect(toast(page).getByText('Risk assessment recorded')).toBeVisible();
    await expect(page.getByTestId('mappa-risk')).toContainText('Risk Matrix 2000');
    await expect(refer).toHaveAttribute('data-state', 'open');

    // The referral: level 2 sought, the assessment cited, a name that must not receive anything.
    await openTransition(page, 'mappa-refer-level');
    const referral = page.getByRole('dialog');
    await referral.getByRole('radio', { name: 'Level 2: active multi-agency management' }).check();
    await referral.getByRole('checkbox', { name: /Risk Matrix 2000/ }).check();
    await referral.getByTestId('referral-reason').fill('Released to a tenancy two streets from the victim of the index offence. Licence conditions need multi-agency oversight.');
    await referral.getByTestId('referral-victim').fill('The victim has been offered the Victim Notification Scheme and knows the release date.');
    await referral.getByTestId('referral-visor').fill('V-2026-0417');
    await expectNoAxeViolations(page);
    await capture(page, { phase: PHASE, screen: 'mappa-referral-form' });
    await referral.getByTestId('referral-submit').click();
    await expect(toast(page).getByText('Referred to Level 2').first()).toBeVisible();
    await expect(header).toContainText('Referral');
    // The level is the meeting's decision, so the case is still managed at level 1.
    await expect(page.getByTestId('mappa-level')).toContainText('1');
    await expect(page.getByText('V-2026-0417').first()).toBeVisible();

    // Ross asks housing and health for pre-meeting returns.
    await switchUser(page, 'usr_ross_mowat');
    await page.goto(caseUrl);
    await waitForData(page);
    await openTransition(page, 'mappa-request-returns');
    await page.getByTestId('transition-add-return').click();
    await page.getByTestId('return-agency-0').selectOption('housing');
    await page.getByTestId('return-contact-0').fill('M Hepburn');
    await page.getByTestId('transition-add-return').click();
    await page.getByTestId('return-agency-1').selectOption('health');
    await page.getByTestId('return-contact-1').fill('L Kennedy');
    await page.getByTestId('transition-due').fill('2026-09-12');
    await submitTransition(page);
    await expect(header).toContainText('Pre-meeting sharing');
    await expect(page.getByTestId('mappa-returns')).toContainText('M Hepburn');

    // Housing answers from the Sharing screen; health answers with what it holds.
    await switchUser(page, 'usr_mark_hepburn');
    await page.goto('/sharing?tab=inbound');
    await waitForData(page);
    const housingRequest = page.locator('section').filter({ hasText: `MAPPA ${reference}` }).filter({ has: page.getByRole('button', { name: 'Respond' }) }).first();
    await housingRequest.getByRole('button', { name: 'Respond' }).click();
    await expect(page.getByRole('dialog')).toContainText(`Ross Mowat asked your agency for a pre-meeting return on ${reference}`);
    await page.getByTestId('respond-nothing-known').check();
    await page.getByTestId('respond-submit').click();
    await expect(toast(page).getByText(`Recorded on ${reference}: Pre-meeting return from housing (nothing known)`)).toBeVisible();

    await switchUser(page, 'usr_louise_kennedy');
    await page.goto('/sharing?tab=inbound');
    await waitForData(page);
    const healthRequest = page.locator('section').filter({ hasText: `MAPPA ${reference}` }).filter({ has: page.getByRole('button', { name: 'Respond' }) }).first();
    await healthRequest.getByRole('button', { name: 'Respond' }).click();
    await page.getByTestId('respond-text').fill('Known to the community mental health team; engaging with treatment; no concerns about compliance since release.');
    await page.getByTestId('respond-submit').click();
    await expect(toast(page).getByText(`Recorded on ${reference}: Pre-meeting return from health`)).toBeVisible();

    // Both returns are on the case, and the meeting is scheduled from the panel, Ross chairing.
    await switchUser(page, 'usr_ross_mowat');
    await page.goto(caseUrl);
    await waitForData(page);
    await expect(page.getByTestId('mappa-returns')).toContainText('Nothing known');
    await expect(page.getByTestId('mappa-returns')).toContainText('community mental health team');
    await openTransition(page, 'mappa-schedule-meeting');
    await expect(page.getByTestId('meeting-type')).toHaveValue('mappa-level2');
    await expect(page.getByTestId('meeting-route')).toHaveAttribute('data-state', 'transition');
    await page.getByTestId('meeting-date').fill('2026-09-18');
    await page.getByTestId('meeting-time').fill('10:00');
    await page.getByTestId('meeting-location').fill('Ardvale Civic Centre, room 3.2');
    await page.getByTestId('meeting-chair').selectOption('usr_ross_mowat');
    await page.getByTestId('meeting-submit').click();
    await expect(page.getByText('Meeting scheduled').last()).toBeVisible();
    await expect(page).toHaveURL(/\/meetings\/mtg_/);
    await waitForData(page);
    await page.goto(caseUrl);
    await waitForData(page);
    await expect(header).toContainText('Meeting');
    await expect(page.getByTestId('next-held-mappa-meeting-held')).toContainText('MAPPA meeting held is recorded when the');
    await page.getByTestId('next-held-mappa-meeting-held').getByRole('link').click();
    await waitForData(page);

    // Held: level 2 confirmed, the risk management plan with an action for housing, the review date.
    await page.getByTestId('hold-meeting').click();
    await expect(page.getByTestId('hold-route')).toContainText('MAPPA meeting held, which moves the case to Managed');
    await page.getByRole('radio', { name: 'Level 2' }).check();
    await page.getByTestId('outcome-level-reason').fill('Active multi-agency management is proportionate to the risk to the index victim.');
    await page.getByTestId('plan-title').fill('Risk management plan for Lee Cargill');
    await page.getByTestId('plan-outcome-0').fill('No contact with the victim and no unsupervised contact with children');
    await page.getByTestId('plan-add-action').click();
    await page.getByTestId('plan-action-title-0').fill('Move the tenancy away from the victim\'s street');
    await page.getByTestId('plan-action-owner-0').selectOption('usr_mark_hepburn');
    await page.getByTestId('plan-action-due-0').fill('2026-10-16');
    await page.getByTestId('outcome-triggers').fill('Alcohol use\nContact with the victim\'s family');
    await page.getByTestId('outcome-contingencies').fill('Recall to custody on breach');
    await page.getByTestId('outcome-controls').fill('Curfew 19:00 to 07:00\nExclusion zone around the victim\'s address');
    await page.getByTestId('outcome-victim-safety').fill('Victim aware of the plan through the Victim Notification Scheme.');
    await page.getByTestId('outcome-accommodation').fill('Council tenancy, to be moved');
    await page.getByTestId('outcome-employment').fill('None');
    await page.getByTestId('outcome-associates').fill('Brother, monitored');
    await page.getByTestId('outcome-victim-considerations').fill('The victim is told the outcome by the police single point of contact.');
    await page.getByTestId('outcome-review-date').fill('2026-12-11');
    await expectNoAxeViolations(page);
    await capture(page, { phase: PHASE, screen: 'mappa-held-form', fullPage: true });
    await page.getByTestId('hold-submit').click();
    await expect(page.getByText('Meeting closed').last()).toBeVisible();
    await expect(page.getByTestId('meeting-history')).toContainText('Recorded on the case as MAPPA meeting held');

    await page.goto(caseUrl);
    await waitForData(page);
    await expect(header).toContainText('Managed');
    await expect(page.getByTestId('mappa-level')).toContainText('Level 2 from');
    await expect(page.getByTestId('mappa-rmp')).toContainText('Recall to custody on breach');
    await expect(page.getByText(/level 2 review/i).first()).toBeVisible();
    await capture(page, { phase: PHASE, screen: 'mappa-managed', fullPage: true });

    // A disclosure to the landlord, proposed and approved on the register.
    await page.getByTestId('propose-disclosure').click();
    await page.getByTestId('disclosure-recipient').fill('Clydeshore Housing Association');
    await page.getByTestId('disclosure-recipient-kind').selectOption('landlord');
    await page.getByTestId('disclosure-fact-0').fill('Subject of licence conditions including a curfew and an exclusion zone');
    await page.getByTestId('disclosure-rationale').fill('The landlord manages the block and needs to know the curfew to report a breach.');
    await page.getByTestId('disclosure-submit').click();
    await expect(toast(page).getByText('Disclosure proposed')).toBeVisible();
    await page.getByTestId('mappa-disclosures').getByRole('button', { name: 'Approve' }).first().click();
    await expect(toast(page).getByText('Disclosure approved')).toBeVisible();
    await expect(page.getByTestId('mappa-disclosures')).toContainText('Clydeshore Housing Association');

    // Housing has its action; a head teacher outside the responsible authorities reads presence only.
    await switchUser(page, 'usr_mark_hepburn');
    await page.goto('/');
    await waitForData(page);
    await page.getByTestId('notifications-bell').click();
    await expect(page.getByTestId('notifications-panel').getByTestId('notification-item').filter({ hasText: 'Move the tenancy away from the victim' })).toBeVisible();
    await page.keyboard.press('Escape');

    await switchUser(page, 'usr_claire_cowan');
    await page.goto('/processes');
    await waitForData(page);
    const row = page.getByRole('row').filter({ hasText: reference });
    await expect(row).toContainText('Restricted');
    await expect(row).not.toContainText('Lee Cargill');
    await page.goto(caseUrl);
    await waitForData(page);
    await expect(page.getByText(/restricted record/i).first()).toBeVisible();
    await expect(page.getByText('Lee Cargill')).toHaveCount(0);
    await capture(page, { phase: PHASE, screen: 'mappa-presence-driven', fullPage: true });

    // The exit: level down, which completes the review clock and closes the case.
    await switchUser(page, 'usr_ross_mowat');
    await page.goto(caseUrl);
    await waitForData(page);
    await openTransition(page, 'mappa-exit');
    await page.getByRole('radio', { name: 'Level down' }).check();
    await page.getByTestId('transition-note').fill('Risk reduced after the tenancy moved and three months of compliance. Level 1 management by the police.');
    await submitTransition(page);
    await expect(header).toContainText('Exit');
    await expect(page.getByTestId('mappa-exit')).toContainText('Level down');
  });

  test('the seeded restricted case shows presence only to somebody outside the responsible authorities', async ({ page }) => {
    await signInAs(page, 'usr_claire_cowan');
    await page.goto('/processes');
    await waitForData(page);
    await expect(page.getByText('Restricted').first()).toBeVisible();
  });

  test('the seeded lead responsible authority sees the risk management plan and the disclosure register', async ({ page }) => {
    await signInAs(page, 'usr_priya_sharif');
    await openByReference(page, 'MAPPA-2026-0034');
    await expect(page.getByRole('heading', { name: 'Environmental Risk Assessment' })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Disclosure decisions register' })).toBeVisible();
  });
});

test.describe('F.2.5 adults with incapacity, driven from a capacity concern to supervision', () => {
  test.setTimeout(300_000);
  /**
   * Nothing seeded. Stuart raises the concern from the ward; the GP records the capacity
   * assessment; Stuart checks the register of existing powers and records the route with the
   * adult's will and preferences beside it; the application names Graeme as its MHO, which puts
   * him on the case and starts his report clock on his own Home; the medical and MHO reports come
   * in and the report completes the clock; the court events run to an order, which completes the
   * interim clocks; supervision begins and a visit is recorded; and the case is closed with the
   * reason the return counts.
   */
  test('the case is walked by the worker, the GP and the MHO, and each clock starts and stops on the decision that owns it', async ({ page }) => {
    await signInAs(page, 'usr_stuart_blair');
    await createPerson(page, 'Agnes', 'Petrie', '1938-02-14');
    await startCase(page, 'awi', 'Ward 12, Clydeshore Royal Infirmary', 'Ready for discharge but cannot weigh up a move to residential care; no attorney known. Daughter asking what happens next.');
    const caseUrl = page.url();
    const header = page.getByTestId('process-header');
    await expect(header).toContainText('Capacity concern');

    // The route decision is a stage away and needs two things; the panel offers what this stage carries.
    await expect(page.getByTestId('next-awi-check-existing-powers')).toHaveAttribute('data-state', 'open');
    await expect(page.getByTestId('next-awi-record-capacity-assessment')).toHaveAttribute('data-state', 'open');
    await capture(page, { phase: PHASE, screen: 'awi-next', fullPage: true });

    // The GP records the capacity assessment, decision by decision, through the dialog the case had.
    await switchUser(page, 'usr_amira_farouk');
    await page.goto(caseUrl);
    await waitForData(page);
    await page.getByTestId('next-awi-record-capacity-assessment-button').click();
    const capacity = page.getByRole('dialog');
    await capacity.getByLabel('The specific decision').fill('Whether to move from the ward to Whinbrae House rather than home with a care package');
    await capacity.getByLabel(/^Date\b/).fill('2026-09-02');
    for (let i = 0; i < 5; i += 1) await capacity.getByRole('radio', { name: 'No', exact: true }).nth(i).check();
    await capacity.getByLabel('Evidence for the conclusion').fill('Agnes could not say where she was or why, and repeated the same question about her cat six times in ten minutes. She agreed to whatever was last said.');
    await capacity.getByRole('radio', { name: 'Lacks capacity' }).check();
    await capacity.getByLabel('Past and present wishes considered').fill('Has always said she would never go into a home. Now says she wants to be where her cat is.');
    await capacity.getByRole('button', { name: 'Record assessment' }).click();
    await expect(toast(page).getByText('Capacity assessment recorded')).toBeVisible();
    await expect(page.getByText('Lacks capacity').first()).toBeVisible();

    // Stuart checks the register: nothing there.
    await switchUser(page, 'usr_stuart_blair');
    await page.goto(caseUrl);
    await waitForData(page);
    await openTransition(page, 'awi-check-existing-powers');
    await page.getByTestId('transition-reference').fill('OPG-2026-4471');
    await submitTransition(page);
    await expect(header).toContainText('Existing powers');
    await expect(page.getByText('OPG-2026-4471').first()).toBeVisible();

    // Stuart records the route, with the will and preferences beside the decision. The MHO is not
    // yet on the case: the matrix seats him at the concern and again at the application, and the
    // application is what names him.
    await openTransition(page, 'awi-route-decision');
    await page.getByTestId('transition-awi-route').selectOption('guardianship-welfare');
    await page.getByTestId('transition-rationale').fill('No attorney, a decision about where to live that the family cannot take, and a daughter who does not want to apply. The council should apply for welfare guardianship.');
    await page.getByTestId('transition-past-wishes').fill('Never wanted to go into a home.');
    await page.getByTestId('transition-present-wishes').fill('Wants to be where her cat is, which is at her daughter\'s.');
    await page.getByTestId('transition-communication').fill('Speech, mornings, with her daughter present');
    await page.getByTestId('transition-add-consulted').click();
    await page.getByTestId('consulted-name-0').fill('Morag Petrie');
    await page.getByTestId('consulted-relationship-0').fill('daughter');
    await page.getByTestId('consulted-view-0').fill('Cannot manage her at home and will not apply herself.');
    await expectNoAxeViolations(page);
    await capture(page, { phase: PHASE, screen: 'awi-route-form', fullPage: true });
    await submitTransition(page);
    await expect(header).toContainText('Route decision');
    await expect(page.getByText('Welfare guardianship').last()).toBeVisible();
    await expect(page.getByText('Morag Petrie').first()).toBeVisible();

    // Stuart opens the application naming Graeme, whose clock starts that moment.
    await openTransition(page, 'awi-open-application');
    await page.getByTestId('transition-applicant-name').fill('Clydeshore Council, Chief Social Work Officer');
    await page.getByTestId('transition-powers').fill('Decide where Agnes lives\nConsent to care and treatment');
    await page.getByTestId('transition-mho').selectOption('usr_graeme_dunlop');
    await page.getByTestId('transition-court').fill('Dunlarrick Sheriff Court');
    await submitTransition(page);
    await expect(header).toContainText('Application');
    await expect(page.getByText('MHO report (s57(4))').first()).toBeVisible();

    await switchUser(page, 'usr_graeme_dunlop');
    await page.goto('/');
    await waitForData(page);
    const clocks = page.locator('section[aria-labelledby="home-clocks"]');
    await expect(clocks.getByText('Agnes Petrie').first()).toBeVisible();
    await expect(clocks.getByText(/MHO report/i).first()).toBeVisible();

    // The medical report from the GP and the MHO report from Graeme, which completes his clock.
    await switchUser(page, 'usr_amira_farouk');
    await page.goto(caseUrl);
    await waitForData(page);
    await openTransition(page, 'awi-record-report');
    await page.getByRole('radio', { name: 'Medical report' }).check();
    await page.getByTestId('transition-practitioner').fill('Dr Amira Farouk');
    await page.getByTestId('transition-date').fill('2026-09-09');
    await submitTransition(page);
    await expect(page.getByText('Dr Amira Farouk').first()).toBeVisible();

    await switchUser(page, 'usr_graeme_dunlop');
    await page.goto(caseUrl);
    await waitForData(page);
    await openTransition(page, 'awi-record-report');
    await page.getByRole('radio', { name: 'MHO report' }).check();
    await page.getByTestId('transition-date').fill('2026-09-16');
    await submitTransition(page);
    await expect(page.getByText(/Report submitted/i).first()).toBeVisible();

    // The court events, as they happen: lodged, an interim order that starts its two clocks, a
    // hearing, and the order, which moves the case and completes them.
    await switchUser(page, 'usr_stuart_blair');
    await page.goto(caseUrl);
    await waitForData(page);
    await openTransition(page, 'awi-court-event');
    await page.getByRole('radio', { name: 'Application lodged' }).check();
    await page.getByTestId('transition-date').fill('2026-09-18');
    await submitTransition(page);
    await openTransition(page, 'awi-court-event');
    await page.getByRole('radio', { name: 'Interim order granted' }).check();
    await page.getByTestId('transition-date').fill('2026-09-25');
    await page.getByTestId('transition-expiry').fill('2026-12-24');
    await submitTransition(page);
    await expect(page.getByText(/interim/i).first()).toBeVisible();
    await openTransition(page, 'awi-court-event');
    await page.getByRole('radio', { name: 'Hearing fixed' }).check();
    await page.getByTestId('transition-date').fill('2026-11-06');
    await submitTransition(page);
    await openTransition(page, 'awi-court-event');
    await page.getByRole('radio', { name: /^Order granted/ }).check();
    await page.getByTestId('transition-date').fill('2026-11-06');
    await page.getByTestId('transition-order-kind').selectOption('welfare-guardianship');
    await page.getByTestId('transition-order-expiry').fill('2029-11-06');
    await page.getByTestId('transition-guardian').fill('Clydeshore Council, Chief Social Work Officer');
    await page.getByTestId('transition-powers').fill('Decide where Agnes lives\nConsent to care and treatment');
    await expectNoAxeViolations(page);
    await capture(page, { phase: PHASE, screen: 'awi-order-form' });
    await submitTransition(page);
    await expect(header).toContainText('Order');
    await expect(page.getByText('Clydeshore Council, Chief Social Work Officer').first()).toBeVisible();

    // Supervision begins with Stuart, a visit is recorded, and the case closes when the order runs out.
    await openTransition(page, 'awi-begin-supervision');
    await expect(page.getByTestId('transition-officer')).toHaveValue('usr_stuart_blair');
    await page.getByTestId('transition-date').fill('2026-11-20');
    await submitTransition(page);
    await expect(header).toContainText('Supervision');
    await page.getByTestId('record-visit').click();
    await page.getByTestId('visit-date').fill('2026-09-02');
    await page.getByTestId('visit-summary').fill('Agnes settled at Whinbrae House. Her cat visits on Sundays with Morag.');
    await page.getByTestId('visit-submit').click();
    await expect(page.getByText('Her cat visits on Sundays').first()).toBeVisible();
    await capture(page, { phase: PHASE, screen: 'awi-supervision', fullPage: true });

    await page.getByTestId('next-awi-close-button').click();
    await page.getByTestId('close-reason').selectOption('order-expired');
    await page.getByTestId('close-note').fill('The order ran to its end date. Agnes remains at Whinbrae House under the section 13ZA arrangement.');
    await page.getByTestId('close-submit').click();
    await expect(header).toContainText('Closed');
  });

  test('the seeded application tracker shows the MHO report clock and the section 13ZA decision', async ({ page }) => {
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
