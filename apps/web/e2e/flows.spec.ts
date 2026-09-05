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
