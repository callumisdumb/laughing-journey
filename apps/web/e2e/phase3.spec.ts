import { expect, test, type Page } from '@playwright/test';
import { capture, expectNoAxeViolations, setAppearance, signInAs, waitForData } from './helpers';

const PHASE = 'phase-3';

async function openByReference(page: Page, reference: string) {
  await page.goto('/processes?closed=1');
  await waitForData(page);
  await page.getByRole('link', { name: reference }).click();
  await waitForData(page);
}

test.describe('process list', () => {
  test('lists processes by urgency with access pills', async ({ page }) => {
    await signInAs(page, 'usr_janet_kerr');
    await page.goto('/processes');
    await waitForData(page);
    await expect(page.getByRole('heading', { name: 'Processes' })).toBeVisible();
    await expect(page.getByRole('link', { name: 'CP-2026-0412' })).toBeVisible();
    await expectNoAxeViolations(page);
    await capture(page, { phase: PHASE, screen: 'processes' });
  });
});

test.describe('scenario dashboards', () => {
  test('CP dashboard for Aiden Boyle', async ({ page }) => {
    await signInAs(page, 'usr_janet_kerr');
    await openByReference(page, 'CP-2026-0412');
    await expect(page.getByRole('heading', { name: 'Child protection: Aiden Boyle' })).toBeVisible();
    await expect(page.getByText('Inter-agency Referral Discussion')).toBeVisible();
    await expect(page.getByText(/Dissent recorded/).first()).toBeVisible();
    await expectNoAxeViolations(page);
    await capture(page, { phase: PHASE, screen: 'process-cp', fullPage: true });
    await setAppearance(page, 'dark', 'comfortable');
    await capture(page, { phase: PHASE, screen: 'process-cp', theme: 'dark', fullPage: true });
  });

  test('ASP dashboard for Marion Fraser with the three-point test form', async ({ page }) => {
    await signInAs(page, 'usr_moira_gilmour');
    await openByReference(page, 'ASP-2026-0217');
    await expect(page.getByText('Three-point test (s3)')).toBeVisible();
    await expectNoAxeViolations(page);
    await capture(page, { phase: PHASE, screen: 'process-asp', fullPage: true });
    await page.getByRole('button', { name: 'Record three-point test' }).click();
    await expect(page.getByRole('dialog')).toBeVisible();
    await capture(page, { phase: PHASE, screen: 'process-asp-three-point-form' });
    await page.getByRole('dialog').getByRole('button', { name: 'Record three-point test' }).click();
    await expect(page.getByText('Three-point test recorded')).toBeVisible();
  });

  test('ASP support-only response for Tomasz Nowak', async ({ page }) => {
    await signInAs(page, 'usr_moira_gilmour');
    await openByReference(page, 'ASP-2026-0141');
    await expect(page.getByText(/Polish/).first()).toBeVisible();
    await capture(page, { phase: PHASE, screen: 'process-asp-support-only', fullPage: true });
  });

  test('LSI workspace for Whinbrae House', async ({ page }) => {
    await signInAs(page, 'usr_moira_gilmour');
    await openByReference(page, 'ASP-2026-0203');
    await expect(page.getByText(/Large Scale Investigation: Whinbrae House/).first()).toBeVisible();
    await expectNoAxeViolations(page);
    await capture(page, { phase: PHASE, screen: 'process-asp-lsi', fullPage: true });
  });

  test('MARAC dashboard with DAQ breakdown and perpetrator exclusion', async ({ page }) => {
    await signInAs(page, 'usr_karen_findlay');
    await openByReference(page, 'MARAC-2026-0093');
    await expect(page.getByText(/Must not receive anything about this process/)).toBeVisible();
    await expect(page.getByText(/yes answers of 27/)).toBeVisible();
    await expect(page.getByText(/Repeat: last heard/)).toBeVisible();
    await expectNoAxeViolations(page);
    await capture(page, { phase: PHASE, screen: 'process-marac', fullPage: true });
    await page.getByRole('button', { name: 'Record DAQ' }).click();
    await expect(page.getByRole('dialog')).toBeVisible();
    await capture(page, { phase: PHASE, screen: 'process-marac-daq-form' });
  });

  // Both themes: this is the sixty seconds of the demo that sells the need-to-know model, and the
  // restricted state has to hold in dark as well as light for a room that has the lights down.
  for (const theme of ['light', 'dark'] as const) {
    test(`${theme} theme: MAPPA presence-only for someone not on the record`, async ({ page }) => {
      await signInAs(page, 'usr_gavin_brodie');
      await page.addInitScript((t) => {
        window.localStorage.setItem('mas.appearance', JSON.stringify({ theme: t, density: 'comfortable' }));
      }, theme);
      await openByReference(page, 'MAPPA-2026-0034');
      await expect(page.getByText(/restricted record/i).first()).toBeVisible();
      // Access restriction, not a classification: the record is Official-Sensitive and restricted,
      // and the two are now separate properties saying separate things.
      await expectNoAxeViolations(page);
      await capture(page, { phase: PHASE, screen: 'process-mappa-restricted', theme });
    });
  }

  test('MAPPA is restricted to the distribution list with break-glass', async ({ page }) => {
    await signInAs(page, 'usr_gavin_brodie');
    await openByReference(page, 'MAPPA-2026-0034');
    await expect(page.getByText(/restricted record/i).first()).toBeVisible();
    await page.getByRole('button', { name: 'Open with a reason' }).click();
    await page.getByLabel(/^Why you need it/).selectOption('Immediate risk to a child');
    await page.getByLabel(/^Reason/).fill('Immediate safety concern for a child seen with the subject at 09:40 today');
    await page.getByRole('button', { name: 'Open with this reason' }).click();
    await expect(page.getByText('Break-glass access granted')).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Sex Offender Notification Requirements' })).toBeVisible();
  });

  test('MAPPA dashboard for the lead RA', async ({ page }) => {
    await signInAs(page, 'usr_priya_sharif');
    await openByReference(page, 'MAPPA-2026-0034');
    await expect(page.getByRole('heading', { name: 'Environmental Risk Assessment' })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Disclosure decisions register' })).toBeVisible();
    await expectNoAxeViolations(page);
    await capture(page, { phase: PHASE, screen: 'process-mappa', fullPage: true });
    await page.getByRole('button', { name: 'Approve' }).first().click();
    await expect(page.getByText('Disclosure approved')).toBeVisible();
  });

  test('education lead sees CP summary only for MAPPA presence', async ({ page }) => {
    await signInAs(page, 'usr_claire_cowan');
    await page.goto('/processes');
    await waitForData(page);
    await expect(page.getByText('Restricted').first()).toBeVisible();
  });

  test('AWI dashboard for Ishbel Grant with the MHO clock', async ({ page }) => {
    await signInAs(page, 'usr_graeme_dunlop');
    await openByReference(page, 'AWI-2026-0102');
    await expect(page.getByText('Guardianship application tracker')).toBeVisible();
    await expect(page.getByText(/Section 13ZA/).first()).toBeVisible();
    await expectNoAxeViolations(page);
    await capture(page, { phase: PHASE, screen: 'process-awi', fullPage: true });
    await page.getByRole('button', { name: 'Record capacity assessment' }).last().click();
    await expect(page.getByRole('dialog')).toBeVisible();
    await capture(page, { phase: PHASE, screen: 'process-awi-capacity-form' });
  });

  test('pre-birth CP for Chloe Reid shows the 28 week cap', async ({ page }) => {
    await signInAs(page, 'usr_janet_kerr');
    await openByReference(page, 'CP-2026-0447');
    await expect(page.getByText(/28 weeks/).first()).toBeVisible();
    await expect(page.getByText(/By 28 weeks gestation/).first()).toBeVisible();
    await capture(page, { phase: PHASE, screen: 'process-cp-prebirth', fullPage: true });
  });

  test('home clocks include the MHO report and the CPPM for the right personas', async ({ page }) => {
    await signInAs(page, 'usr_graeme_dunlop');
    await page.goto('/');
    await waitForData(page);
    await expect(page.getByText(/MHO report/).first()).toBeVisible();
    await capture(page, { phase: PHASE, screen: 'home-mho' });
  });
});
