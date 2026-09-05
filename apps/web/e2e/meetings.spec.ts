import { expect, test, type Page } from '@playwright/test';
import { createPerson, selectOptionContaining, startCase, switchPersona, unreadCount } from './driven';
import { capture, expectNoAxeViolations, signInAs, switchUser, waitForData } from './helpers';

const PHASE = 'meetings';

test.use({ viewport: { width: 1440, height: 900 } });

/**
 * Meetings, driven (D-210, D-213): scheduled from the Meetings screen and from the case on cases
 * the tests make, with the invite list proposed by need-to-know and the people left off recorded;
 * moved and cancelled with a reason, each told to the invitees; a pre-meeting request sent and
 * returned across two personas; a meeting the engine has no view of held with its minute
 * distributed and the recipient told; and a meeting type the tables schedule from a later stage
 * refused with the stage named. Every consequence is read off the interface.
 */
/** The MARAC coordinator opens a referral on a new victim and schedules the meeting with Janet invited by hand. */
async function scheduleMarac(page: Page, givenName: string, familyName: string, date: string): Promise<{ reference: string; title: string }> {
  await createPerson(page, givenName, familyName, '1988-11-03');
  const reference = await startCase(page, 'marac', 'Police Scotland, domestic abuse unit', 'Third call-out in two months. DASH scored 14 with a professional judgement referral.');
  await page.goto('/meetings');
  await waitForData(page);
  await page.getByTestId('schedule-meeting').click();
  await selectOptionContaining(page, 'meeting-case', reference);
  await expect(page.getByTestId('meeting-route')).toHaveAttribute('data-state', 'transition');
  await page.getByTestId('meeting-date').fill(date);
  await page.getByTestId('meeting-time').fill('10:00');
  await page.getByTestId('meeting-location').fill('Ardvale Civic Centre, room 3');
  await page.getByTestId('meeting-add-invitee').selectOption('usr_janet_kerr');
  await page.getByTestId('meeting-add-invitee-button').click();
  await expect(page.getByTestId('invitee-usr_janet_kerr')).toBeVisible();
  await page.getByTestId('meeting-submit').click();
  await expect(page.getByText('Meeting scheduled').last()).toBeVisible();
  await expect(page).toHaveURL(/\/meetings\/mtg_/);
  await waitForData(page);
  const title = `MARAC: ${givenName} ${familyName}`;
  await expect(page.getByRole('heading', { name: title, level: 1 })).toBeVisible();
  return { reference, title };
}

test.describe('scheduling', () => {
  test('from the Meetings screen: the matrix proposes the list, the left-off are recorded, and the invitee is told', async ({ page }) => {
    await signInAs(page, 'usr_karen_findlay');
    await createPerson(page, 'Fiona', 'Rattray', '1988-11-03');
    const reference = await startCase(page, 'marac', 'Police Scotland, domestic abuse unit', 'Third call-out in two months. DASH scored 14 with a professional judgement referral.');

    await page.goto('/meetings');
    await waitForData(page);
    await page.getByTestId('schedule-meeting').click();
    await selectOptionContaining(page, 'meeting-case', reference);
    // The type the engine schedules from a referral is offered first, and the dialog says it is
    // recorded on the case as that decision.
    await expect(page.getByTestId('meeting-type')).toHaveValue('marac');
    await expect(page.getByTestId('meeting-route')).toHaveAttribute('data-state', 'transition');
    await expect(page.getByTestId('meeting-route')).toContainText('Recorded on the case as Schedule MARAC');
    // The IDAA is seated by the referral row of the matrix; the coordinator chairs and is not listed twice.
    const idaa = page.getByTestId('invitee-usr_sadia_qureshi');
    await expect(idaa).toBeChecked();
    await expect(page.getByTestId('invitee-usr_karen_findlay')).toHaveCount(0);
    await page.getByTestId('meeting-date').fill('2026-09-08');
    await page.getByTestId('meeting-time').fill('10:00');
    await page.getByTestId('meeting-location').fill('Ardvale Civic Centre, room 3');
    await page.getByTestId('meeting-add-invitee').selectOption('usr_janet_kerr');
    await page.getByTestId('meeting-add-invitee-button').click();
    await expect(page.getByTestId('invitee-usr_janet_kerr')).toBeChecked();
    // Unticking somebody the matrix seated moves them to the left-off list with the reason.
    await idaa.uncheck();
    await expect(page.getByTestId('meeting-left-off')).toContainText('Sadia Qureshi');
    await expect(page.getByTestId('meeting-left-off')).toContainText('Unticked by the person scheduling the meeting');
    await expectNoAxeViolations(page);
    await capture(page, { phase: PHASE, screen: 'schedule-dialog', fullPage: true });
    await page.getByTestId('meeting-submit').click();
    await expect(page.getByText('Meeting scheduled').last()).toBeVisible();
    await expect(page).toHaveURL(/\/meetings\/mtg_/);
    await waitForData(page);
    await expect(page.getByRole('heading', { name: 'MARAC: Fiona Rattray', level: 1 })).toBeVisible();
    await expect(page.getByText('Janet Kerr, Social worker').first()).toBeVisible();
    // The header lists everybody left off: the register's excluded parties and the name unticked by hand.
    await expect(page.getByTestId('meeting-history')).toContainText('left off the invite list');
    await expect(page.getByTestId('meeting-history')).toContainText('Perpetrator (The perpetrator is never told about MARAC)');
    await expect(page.getByTestId('meeting-history')).toContainText('Sadia Qureshi (Unticked by the person scheduling the meeting)');
    await capture(page, { phase: PHASE, screen: 'scheduled', fullPage: true });

    // The case's own meetings sheet lists it, and the case's stage did not move: scheduling a MARAC
    // is a decision on the referral, not a stage.
    await page.getByRole('link', { name: reference }).first().click();
    await waitForData(page);
    await expect(page.getByRole('link', { name: /MARAC: Fiona Rattray/ }).first()).toBeVisible();

    // Janet is told, and the invitation opens the workspace for her.
    await switchPersona(page, 'usr_janet_kerr');
    expect(await unreadCount(page)).toBeGreaterThan(0);
    await page.getByTestId('notifications-bell').click();
    const invitation = page.getByTestId('notifications-panel').getByTestId('notification-item').filter({ hasText: 'You are invited to MARAC: Fiona Rattray on 08 Sep 2026, 10:00.' });
    await expect(invitation).toBeVisible();
    await invitation.getByRole('button').first().click();
    await waitForData(page);
    await expect(page.getByRole('heading', { name: 'MARAC: Fiona Rattray', level: 1 })).toBeVisible();
    await page.goto('/');
    await waitForData(page);
    await expect(page.getByText('Prepare for MARAC: Fiona Rattray')).toBeVisible();
  });

  test('from the case, a type the tables schedule from a later stage is refused with the stage named', async ({ page }) => {
    await signInAs(page, 'usr_moira_gilmour');
    await createPerson(page, 'Hamish', 'Craik', '1946-06-30');
    await startCase(page, 'asp', 'District nurse, Kirkbrae practice', 'Money going missing from the house and a nephew who will not leave.');
    await page.getByTestId('schedule-meeting').click();
    await page.getByTestId('meeting-type').selectOption('asp-case-conference');
    const route = page.getByTestId('meeting-route');
    await expect(route).toHaveAttribute('data-state', 'refused');
    await expect(route).toContainText('ASP case conference is scheduled from Inquiry using investigatory powers. This case is at Adult concern.');
    await expect(page.getByTestId('meeting-submit')).toBeDisabled();
    await capture(page, { phase: PHASE, screen: 'schedule-refused' });
    // The discussion the engine has no view of is scheduled without moving anything.
    await page.getByTestId('meeting-type').selectOption('asp-inter-agency-discussion');
    await expect(route).toHaveAttribute('data-state', 'plain');
    await expect(page.getByTestId('meeting-submit')).toBeEnabled();
  });
});

test.describe('moving and cancelling', () => {
  test('a reschedule and a cancellation each carry a reason and reach the invitee', async ({ page }) => {
    await signInAs(page, 'usr_karen_findlay');
    const { title } = await scheduleMarac(page, 'Morag', 'Lennie', '2026-09-08');

    await page.getByTestId('reschedule-meeting').click();
    await page.getByTestId('reschedule-date').fill('2026-09-10');
    await page.getByTestId('reschedule-reason').fill('The chair is at a hearing on the 8th.');
    await page.getByTestId('reschedule-submit').click();
    await expect(page.getByText('Meeting moved').last()).toBeVisible();
    await expect(page.getByTestId('meeting-history')).toContainText('Moved from 08 Sep 2026, 10:00');
    await expect(page.getByTestId('meeting-history')).toContainText('The chair is at a hearing on the 8th.');

    await switchPersona(page, 'usr_janet_kerr');
    await page.getByTestId('notifications-bell').click();
    await expect(page.getByTestId('notifications-panel').getByTestId('notification-item').filter({ hasText: `${title} has moved to 10 Sep 2026, 10:00.` })).toBeVisible();
    await page.keyboard.press('Escape');

    await switchPersona(page, 'usr_karen_findlay');
    await page.getByTestId('cancel-meeting').click();
    await page.getByTestId('cancel-meeting-reason').fill('The victim has moved out of the area. Transferring to the receiving MARAC.');
    await page.getByTestId('cancel-meeting-submit').click();
    await expect(page.getByText('Meeting cancelled').last()).toBeVisible();
    await expect(page.getByTestId('meeting-status')).toHaveText('Cancelled');
    await expect(page.getByTestId('meeting-history')).toContainText('Cancelled 02 Sep 2026: The victim has moved out of the area.');
    await expect(page.getByTestId('hold-meeting')).toHaveCount(0);
    await capture(page, { phase: PHASE, screen: 'cancelled', fullPage: true });

    // The audit ledger carries both, with their reasons.
    await page.goto('/audit');
    await waitForData(page);
    await expect(page.getByRole('table').getByText(`${title} moved to 10 Sep 2026: The chair is at a hearing on the 8th.`).first()).toBeVisible();
    await expect(page.getByRole('table').getByText(`${title} cancelled: The victim has moved out of the area. Transferring to the receiving MARAC.`).first()).toBeVisible();

    await switchPersona(page, 'usr_janet_kerr');
    await page.getByTestId('notifications-bell').click();
    await expect(page.getByTestId('notifications-panel').getByTestId('notification-item').filter({ hasText: `${title} has been cancelled.` })).toBeVisible();
    await page.keyboard.press('Escape');
    // Off her Home screen, and on the list with its status rather than gone.
    await page.goto('/');
    await waitForData(page);
    await expect(page.getByText(`Prepare for ${title}`)).toHaveCount(0);
    await page.goto('/meetings');
    await waitForData(page);
    await expect(page.getByRole('row').filter({ hasText: title })).toContainText('Cancelled');
  });
});

test.describe('holding a meeting the engine has no view of', () => {
  test('a pre-meeting request goes out and comes back, the meeting is held, and the distributed minute reaches its recipient', async ({ page }) => {
    await signInAs(page, 'usr_moira_gilmour');
    await createPerson(page, 'Peigi', 'Buchan', '1941-01-22');
    const reference = await startCase(page, 'asp', 'Care at home provider, Whinbrae Care', 'Carers report the house is unheated and the adult is refusing meals and visits.');
    await page.getByTestId('schedule-meeting').click();
    await page.getByTestId('meeting-type').selectOption('asp-inter-agency-discussion');
    await page.getByTestId('meeting-date').fill('2026-09-04');
    await page.getByTestId('meeting-time').fill('14:00');
    await page.getByTestId('meeting-location').fill('Portlennan Resource Centre');
    await page.getByTestId('meeting-add-invitee').selectOption('usr_amira_farouk');
    await page.getByTestId('meeting-add-invitee-button').click();
    await page.getByTestId('meeting-submit').click();
    await expect(page.getByText('Meeting scheduled').last()).toBeVisible();
    await expect(page).toHaveURL(/\/meetings\/mtg_/);
    await waitForData(page);
    const title = 'ASP inter-agency discussion: Peigi Buchan';
    await expect(page.getByRole('heading', { name: title, level: 1 })).toBeVisible();

    // A report is asked of the GP before the meeting.
    await page.getByLabel('Agency', { exact: true }).selectOption('health');
    await page.getByLabel('To', { exact: true }).selectOption('usr_amira_farouk');
    await page.getByLabel(/^Due/).fill('2026-09-03');
    await page.getByRole('button', { name: 'Send request' }).click();
    await expect(page.getByText('Information request sent').last()).toBeVisible();

    // The GP finds it on her worklist, opens the meeting she was asked for, and returns it. She is
    // not one of the demonstration's personas, so the session is switched directly; nothing in this
    // test depends on the demo clock, which that resets.
    await switchUser(page, 'usr_amira_farouk');
    await page.goto('/worklist');
    await waitForData(page);
    await page.getByRole('link', { name: `Report for ${title}` }).first().click();
    await waitForData(page);
    await expect(page.getByRole('heading', { name: title, level: 1 })).toBeVisible();
    await page.getByRole('button', { name: 'Record return' }).click();
    await page.getByRole('dialog').getByLabel(/Summary/).fill('Seen in surgery in August. Weight down four kilos since spring; declined a home visit.');
    await page.getByRole('dialog').getByRole('button', { name: /Record/ }).click();
    await expect(page.getByText('Return recorded and added to the pack').last()).toBeVisible();

    // The chair hears the return came back, holds the meeting, and sends the minute.
    await switchUser(page, 'usr_moira_gilmour');
    await waitForData(page);
    await page.getByTestId('notifications-bell').click();
    await expect(page.getByTestId('notifications-panel').getByTestId('notification-item').filter({ hasText: `returned the information you asked for on ${reference}` })).toBeVisible();
    await page.keyboard.press('Escape');
    await page.getByTestId('hold-meeting').click();
    await expect(page.getByTestId('hold-route')).toHaveAttribute('data-state', 'plain');
    await page.getByTestId('hold-note').fill('Agreed to open an inquiry and ask the GP for a home visit.');
    await expectNoAxeViolations(page);
    await capture(page, { phase: PHASE, screen: 'hold-plain' });
    await page.getByTestId('hold-submit').click();
    await expect(page.getByText('Meeting closed').last()).toBeVisible();
    await expect(page.getByTestId('meeting-status')).toHaveText('Held');
    await page.getByRole('button', { name: 'Generate from need-to-know' }).click();
    await expect(page.getByText(/recipients added/).last()).toBeVisible();
    await page.getByRole('button', { name: 'Chair approves' }).click();
    await page.getByRole('button', { name: /^Distribute to \d+ recipients$/ }).click();
    await expect(page.getByText('Minute: distributed')).toBeVisible();

    await switchUser(page, 'usr_amira_farouk');
    await page.getByTestId('notifications-bell').click();
    await expect(page.getByTestId('notifications-panel').getByTestId('notification-item').filter({ hasText: `The minute of ${title} has been distributed to you at Full record.` })).toBeVisible();
    await capture(page, { phase: PHASE, screen: 'minute-distributed-bell' });
  });
});

test.describe('holding a meeting that records a decision', () => {
  /**
   * The seeded review CPPM, until step 6 drives a child protection case from nothing: an inquorate
   * review decides nothing, starts the reconvene clock, and is reconvened from its own header with
   * the same list and a new date.
   */
  test('an inquorate review is reconvened from the meeting header', async ({ page }) => {
    await signInAs(page, 'usr_david_laird');
    await page.goto('/meetings/mtg_aiden_review');
    await waitForData(page);
    await page.getByTestId('hold-meeting').click();
    await expect(page.getByTestId('hold-route')).toContainText('Review planning meeting held');
    await page.getByTestId('outcome-quorate').uncheck();
    await expect(page.getByText('An inquorate meeting decides nothing.')).toBeVisible();
    await page.getByTestId('hold-submit').click();
    await expect(page.getByText('Meeting inquorate').last()).toBeVisible();
    await expect(page.getByTestId('meeting-inquorate')).toBeVisible();
    await expect(page.getByTestId('meeting-history')).toContainText('Inquorate on 02 Sep 2026');
    await capture(page, { phase: PHASE, screen: 'inquorate', fullPage: true });

    await page.getByTestId('reconvene-meeting').click();
    await expect(page.getByTestId('meeting-type')).toHaveValue('cppm-review');
    await expect(page.getByTestId('meeting-type')).toBeDisabled();
    await expect(page.getByTestId('invitee-usr_janet_kerr')).toBeChecked();
    await page.getByTestId('meeting-date').fill('2026-09-21');
    await page.getByTestId('meeting-location').fill('Ardvale Civic Centre, room 2.4');
    await page.getByTestId('meeting-submit').click();
    await expect(page.getByText('Meeting scheduled').last()).toBeVisible();
    await expect(page).toHaveURL(/\/meetings\/mtg_/);
    await waitForData(page);
    await expect(page.getByRole('heading', { name: 'Review CPPM: Aiden Boyle', level: 1 })).toBeVisible();
    await expect(page.getByText('21 Sep 2026 10:00')).toBeVisible();
    // The old meeting says it was reconvened, and the reconvene clock is on the case.
    await page.goto('/meetings/mtg_aiden_review');
    await waitForData(page);
    await expect(page.getByTestId('meeting-history')).toContainText('Reconvened as a new meeting.');
    await expect(page.getByTestId('reconvene-meeting')).toHaveCount(0);
    await page.goto('/processes/prc_cp_aiden');
    await waitForData(page);
    await expect(page.getByText(/reconven/i).first()).toBeVisible();
  });
});
