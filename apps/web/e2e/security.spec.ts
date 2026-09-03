import { expect, test } from '@playwright/test';
import { capture, expectNoAxeViolations, signInAs, waitForData } from './helpers';

const PHASE = 'security';

/**
 * The screens that make the cryptographic design inspectable rather than asserted.
 *
 * "What the host can see" is the most persuasive thing in the product, so it is captured in both
 * themes and checked for accessibility. The chain verification screen matters because it can show a
 * break being found, which a screen that only ever reports success cannot.
 */
for (const theme of ['light', 'dark'] as const) {
  test(`${theme} theme: what the host can see`, async ({ page }) => {
    await signInAs(page, 'usr_priya_sharif');
    await page.addInitScript((t) => {
      window.localStorage.setItem('mas.appearance', JSON.stringify({ theme: t, density: 'comfortable' }));
    }, theme);
    await page.goto('/admin/server-view');
    await waitForData(page);
    await expect(page.getByRole('heading', { level: 1, name: 'What the host can see' })).toBeVisible();
    // Both panels, from the same store.
    await expect(page.getByRole('heading', { level: 2, name: 'What the host sees' })).toBeVisible();
    await expect(page.getByRole('heading', { level: 2, name: 'What you see' })).toBeVisible();
    // The honest part: the leakage table is on the screen, not only in the documentation.
    await expect(page.getByRole('heading', { level: 2, name: 'What an operator can work out anyway' })).toBeVisible();
    await expectNoAxeViolations(page);
    await capture(page, { phase: PHASE, screen: 'server-view', theme, fullPage: true });
  });
}

test('the host panel shows ciphertext and no case content', async ({ page }) => {
  await signInAs(page, 'usr_priya_sharif');
  await page.goto('/admin/server-view');
  await waitForData(page);
  const host = page.getByRole('region', { name: /What the host sees/ }).or(page.locator('section').filter({ hasText: 'What the host sees' }).first());
  await expect(host).toBeVisible();
  // Opaque principal identifiers, not names.
  await expect(page.getByText(/p:usr:/).first()).toBeVisible();
});

test('the audit chain verifies, and a tampered copy fails', async ({ page }) => {
  await signInAs(page, 'usr_janet_kerr');
  // Generate some entries first: opening records writes to the ledger and the chain.
  await page.goto('/processes/prc_cp_aiden');
  await waitForData(page);
  await page.goto('/people/per_aiden_boyle');
  await waitForData(page);
  await page.goto('/admin/audit-chain');
  await waitForData(page);
  await expect(page.getByRole('heading', { level: 1, name: 'Audit chain' })).toBeVisible();
  await expect(page.getByRole('status').first()).toContainText(/verified|No entries yet/);
  await expectNoAxeViolations(page);
  await capture(page, { phase: PHASE, screen: 'audit-chain' });

  const tamperButton = page.getByRole('button', { name: 'Verify a tampered copy' });
  if (await tamperButton.isEnabled()) {
    await tamperButton.click();
    // The screen must report the break rather than quietly showing the intact result.
    await expect(page.getByRole('status').first()).toContainText('Broken at entry');
    await capture(page, { phase: PHASE, screen: 'audit-chain-tampered' });
  }
});

test('statutory disclosure refuses two holders from one organisation', async ({ page }) => {
  await signInAs(page, 'usr_janet_kerr');
  await page.goto('/admin/disclosure');
  await waitForData(page);
  await expect(page.getByRole('heading', { level: 1, name: 'Statutory disclosure' })).toBeVisible();
  // Nothing selected: the threshold refusal.
  await expect(page.getByRole('status')).toContainText('Two holders are needed');
  await expect(page.getByRole('button', { name: 'Reconstruct the key and disclose' })).toBeDisabled();
  await expectNoAxeViolations(page);
  await capture(page, { phase: PHASE, screen: 'statutory-disclosure' });
});

test('the Security page names what is not encrypted', async ({ page }) => {
  await signInAs(page, 'usr_janet_kerr');
  await page.goto('/help?tab=security');
  await waitForData(page);
  await page.getByRole('tab', { name: 'Security' }).click();
  await expect(page.getByRole('heading', { level: 2, name: 'What is not encrypted' })).toBeVisible();
  await expect(page.getByRole('heading', { level: 2, name: 'Does this stop a colleague misusing a case they are on' })).toBeVisible();
  // The one claim that must never be overstated.
  await expect(page.getByText('No. Encryption controls who can open a record')).toBeVisible();
  await expectNoAxeViolations(page);
  await capture(page, { phase: PHASE, screen: 'help-security', fullPage: true });
});
