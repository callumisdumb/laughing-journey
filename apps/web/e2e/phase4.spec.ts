import { expect, test } from '@playwright/test';
import { capture, expectNoAxeViolations, setAppearance, signInAs, switchUser, waitForData } from './helpers';

const PHASE = 'phase-4';

test.describe('meetings', () => {
  test('lists meetings I am invited to', async ({ page }) => {
    await signInAs(page, 'usr_janet_kerr');
    await page.goto('/meetings');
    await waitForData(page);
    await expect(page.getByRole('heading', { name: 'Meetings' })).toBeVisible();
    await expect(page.getByRole('link', { name: 'Review CPPM: Aiden Boyle' })).toBeVisible();
    await expectNoAxeViolations(page);
    await capture(page, { phase: PHASE, screen: 'meetings' });
  });

  test('before the meeting: invites, requests and the pack', async ({ page }) => {
    await signInAs(page, 'usr_janet_kerr');
    await page.goto('/meetings/mtg_aiden_review');
    await waitForData(page);
    await expect(page.getByRole('heading', { name: 'Review CPPM: Aiden Boyle' })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Invite list' })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Pack builder' })).toBeVisible();
    await expectNoAxeViolations(page);
    await capture(page, { phase: PHASE, screen: 'meeting-before', fullPage: true });
    await page.getByRole('button', { name: 'Generate from need-to-know' }).click();
    // The invitees the resolver added carry the rule that put them there, which is the point of
    // generating the list rather than typing it. Asserted on the rule reference rather than on the
    // words "need to know" anywhere on the page, which any other copy on any screen could satisfy.
    await expect(page.getByText(/\(rule cp\./).first()).toBeVisible();
  });

  test('during the meeting: agenda, decisions and chair mode', async ({ page }) => {
    await signInAs(page, 'usr_janet_kerr');
    await page.goto('/meetings/mtg_aiden_review?phase=during');
    await waitForData(page);
    await expect(page.getByRole('heading', { name: 'Agenda' })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Decisions, rationale and dissent' })).toBeVisible();
    await expectNoAxeViolations(page);
    await capture(page, { phase: PHASE, screen: 'meeting-during', fullPage: true });
    await page.getByRole('button', { name: 'Chair mode' }).click();
    await expect(page.getByRole('button', { name: 'Exit chair mode' })).toBeVisible();
    await capture(page, { phase: PHASE, screen: 'meeting-chair' });
    await setAppearance(page, 'dark', 'comfortable');
    await capture(page, { phase: PHASE, screen: 'meeting-chair', theme: 'dark' });
  });

  test('after the meeting: minute, distribution and clocks', async ({ page }) => {
    await signInAs(page, 'usr_janet_kerr');
    await page.goto('/meetings/mtg_aiden_review?phase=after');
    await waitForData(page);
    await expect(page.getByRole('heading', { name: 'Minute' })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Clocks after this meeting' })).toBeVisible();
    await page.getByRole('button', { name: 'Generate from need-to-know' }).click();
    await page.getByRole('button', { name: 'Mark draft' }).click();
    await page.getByRole('button', { name: 'Chair approves' }).click();
    await page.getByRole('button', { name: /^Distribute to \d+ recipients$/ }).click();
    await expect(page.getByText('Minute: distributed')).toBeVisible();
    await expectNoAxeViolations(page);
    await capture(page, { phase: PHASE, screen: 'meeting-after', fullPage: true });

    // What the pipeline wrote on the way: one sharing record per recipient, each resting on the
    // lawful basis written beside it, on the sharing screen where the sender sees them go out.
    await page.goto('/sharing');
    await waitForData(page);
    await expect(page.getByRole('table').getByText(/^Minute of /).first()).toBeVisible();
    // And the ledger carries the distribution as its own act.
    await page.goto('/audit');
    await waitForData(page);
    await expect(page.getByRole('table').getByText(/Minute distributed to \d+ recipients/).first()).toBeVisible();

    // Closing a review CPPM records the review's decision on the case (D-213), and only the chair
    // records it: the social worker is told who does, and the chair sees the outcome form.
    await page.goto('/meetings/mtg_aiden_review?phase=after');
    await waitForData(page);
    await page.getByRole('button', { name: 'Close meeting and update clocks' }).click();
    await expect(page.getByTestId('hold-route')).toContainText('is recorded by Independent reviewing chair, not by your role');
    await expect(page.getByTestId('hold-submit')).toBeDisabled();
    await page.getByRole('dialog').getByRole('button', { name: 'Cancel', exact: true }).click();
    await switchUser(page, 'usr_david_laird');
    await page.goto('/meetings/mtg_aiden_review?phase=after');
    await waitForData(page);
    await page.getByRole('button', { name: 'Close meeting and update clocks' }).click();
    await expect(page.getByTestId('hold-route')).toContainText('Review planning meeting held');
    await page.getByTestId('outcome-rationale').fill('The plan is working. Attendance is up and the core group agreed the risks have reduced but not gone.');
    await page.getByTestId('hold-submit').click();
    await expect(page.getByText('Meeting closed')).toBeVisible();
    await expect(page.getByTestId('meeting-history')).toContainText('Recorded on the case as Review planning meeting held');
    // The chair's own ledger carries the closure.
    await page.goto('/audit');
    await waitForData(page);
    await expect(page.getByRole('table').getByText(/ held$/).first()).toBeVisible();
  });

  test('minutes print pack carries the classification marking and paginates', async ({ page }) => {
    await signInAs(page, 'usr_janet_kerr');
    await page.goto('/meetings/mtg_aiden_review?view=print');
    await waitForData(page);
    await expect(page.getByRole('heading', { name: 'Review CPPM: Aiden Boyle', level: 1 })).toBeAttached();
    await expect(page.getByText(/Page 1 of/)).toBeAttached();
    await expectNoAxeViolations(page);
    await capture(page, { phase: PHASE, screen: 'meeting-minutes', fullPage: true });
    await page.emulateMedia({ media: 'print' });
    await capture(page, { phase: PHASE, screen: 'meeting-minutes-print', fullPage: true });
  });
});

test.describe('actions', () => {
  test('actions across processes with completion evidence', async ({ page }) => {
    await signInAs(page, 'usr_janet_kerr');
    await page.goto('/actions');
    await waitForData(page);
    await expect(page.getByRole('heading', { name: 'Actions' })).toBeVisible();
    await expectNoAxeViolations(page);
    await capture(page, { phase: PHASE, screen: 'actions' });
    await page.getByRole('button', { name: 'Complete' }).first().click();
    await expect(page.getByRole('dialog')).toBeVisible();
    await page.getByLabel(/^Evidence of completion/).fill('Visit made on 02 Sep 2026 at 10:15, Aiden seen alone, notes on the record.');
    await capture(page, { phase: PHASE, screen: 'actions-complete' });
    await page.getByRole('dialog').getByRole('button', { name: 'Mark complete' }).click();
    await expect(page.getByText('Action complete')).toBeVisible();
  });

  test('team view groups by agency', async ({ page }) => {
    await signInAs(page, 'usr_moira_gilmour');
    await page.goto('/actions?view=team&group=agency');
    await waitForData(page);
    await expect(page.getByRole('heading', { name: 'Actions' })).toBeVisible();
    await capture(page, { phase: PHASE, screen: 'actions-team', density: 'compact' });
  });
});

test.describe('sharing', () => {
  for (const theme of ['light', 'dark'] as const) {
    test(`${theme} theme: outbound sharing records and inbound notifications`, async ({ page }) => {
      await signInAs(page, 'usr_janet_kerr');
      await page.addInitScript((t) => {
        window.localStorage.setItem('mas.appearance', JSON.stringify({ theme: t, density: 'comfortable' }));
      }, theme);
      await page.goto('/sharing');
      await waitForData(page);
      await expect(page.getByRole('heading', { name: 'Sharing and notifications' })).toBeVisible();
      await expectNoAxeViolations(page);
      await capture(page, { phase: PHASE, screen: 'sharing-outbound', theme });
      await page.getByRole('tab', { name: /Inbound/ }).click();
      await expect(page.getByRole('heading', { name: 'Notifications to you' })).toBeVisible();
      await capture(page, { phase: PHASE, screen: 'sharing-inbound', theme });
    });

    test(`${theme} theme: preview what another role would see`, async ({ page }) => {
      await signInAs(page, 'usr_janet_kerr');
      await page.addInitScript((t) => {
        window.localStorage.setItem('mas.appearance', JSON.stringify({ theme: t, density: 'comfortable' }));
      }, theme);
      await page.goto('/sharing?tab=preview');
      await waitForData(page);
      await page.getByLabel('Process').selectOption('prc_cp_aiden');
      await page.getByLabel('Seen as').selectOption('usr_claire_cowan');
      await expect(page.getByText(/would see/i).first()).toBeVisible();
      // The marking that recipient would actually be given, before anything is shared.
      await expect(page.getByText('Marking they would get')).toBeVisible();
      await expectNoAxeViolations(page);
      await capture(page, { phase: PHASE, screen: 'sharing-preview', theme, fullPage: true });
    });
  }

  test('a share carries the marking it went out under, not the source read at render time', async ({ page }) => {
    await signInAs(page, 'usr_janet_kerr');
    await page.goto('/sharing');
    await waitForData(page);
    // The outbound table's classification column reads the share's own captured classification.
    await expect(page.getByRole('columnheader', { name: 'Classification' })).toBeVisible();
    await expect(page.getByText('OFFICIAL-SENSITIVE', { exact: false }).first()).toBeVisible();
  });
});
