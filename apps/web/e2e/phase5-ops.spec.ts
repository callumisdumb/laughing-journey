import { expect, test } from '@playwright/test';
import { capture, expectNoAxeViolations, setAppearance, signInAs, waitForData } from './helpers';

const PHASE = 'phase-5';

test.describe('connectors', () => {
  test('health cards, sync history and mapping preview', async ({ page }) => {
    await signInAs(page, 'usr_janet_kerr');
    await page.goto('/connectors');
    await waitForData(page);
    await expect(page.getByRole('heading', { name: 'Connectors' })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'EMIS Web (GP)' })).toBeVisible();
    await expect(page.getByText('Connected').first()).toBeVisible({ timeout: 15_000 });
    await expect(page.getByRole('tab', { name: 'Mapping preview' })).toBeVisible();
    await expectNoAxeViolations(page);
    await capture(page, { phase: PHASE, screen: 'connectors', fullPage: true });
    await page.getByRole('tab', { name: 'Mapping preview' }).click();
    await expect(page.getByRole('columnheader', { name: 'Platform event type' })).toBeVisible();
    await setAppearance(page, 'dark', 'comfortable');
    await capture(page, { phase: PHASE, screen: 'connectors', theme: 'dark', fullPage: true });
  });

  test('simulated outage is visible in words and a failed sync is recorded', async ({ page }) => {
    await signInAs(page, 'usr_janet_kerr');
    await page.goto('/connectors?adapter=emis-web');
    await waitForData(page);
    await expect(page.getByRole('heading', { name: 'EMIS Web (GP)' })).toBeVisible();
    await page.getByRole('switch', { name: 'Simulate outage' }).check();
    await expect(page.getByText('EMIS Web (GP) is not responding (simulated outage).')).toBeVisible({ timeout: 15_000 });
    await page.getByRole('button', { name: 'Sync now' }).click();
    await expect(page.getByRole('row').filter({ hasText: 'Failed' }).first()).toBeVisible({ timeout: 15_000 });
    await expectNoAxeViolations(page);
    await capture(page, { phase: PHASE, screen: 'connectors-outage', fullPage: true });
  });
});

test.describe('audit', () => {
  test('oversight role sees every entry, filtered to break-glass and restricted reads', async ({ page }) => {
    await signInAs(page, 'usr_andrew_muirhead');
    await page.goto('/audit?quick=1');
    await waitForData(page);
    await expect(page.getByRole('heading', { name: 'Audit' })).toBeVisible();
    await expect(page.getByText(/Showing every entry/)).toBeVisible();
    await expect(page.getByRole('switch', { name: 'Break-glass and restricted reads only' })).toBeChecked();
    await expect(page.getByRole('row').filter({ hasText: 'Restricted read' }).first()).toBeVisible();
    await expectNoAxeViolations(page);
    await capture(page, { phase: PHASE, screen: 'audit' });
  });

  test('a practitioner sees only their own entries and can export them', async ({ page }) => {
    await signInAs(page, 'usr_janet_kerr');
    await page.goto('/audit');
    await waitForData(page);
    await expect(page.getByText(/Showing your own entries/)).toBeVisible();
    const download = page.waitForEvent('download');
    await page.getByRole('button', { name: 'Export audit log as CSV' }).click();
    expect((await download).suggestedFilename()).toMatch(/^audit-export-.+\.csv$/);
    await expect(page.getByText('Audit log exported')).toBeVisible();
    await expect(page.getByRole('row').filter({ hasText: 'Audit log export' }).first()).toBeVisible();
  });
});

test.describe('settings', () => {
  test('appearance, notifications, demo clock and reset', async ({ page }) => {
    await signInAs(page, 'usr_janet_kerr');
    await page.goto('/settings');
    await waitForData(page);
    await expect(page.getByRole('heading', { name: 'Settings' })).toBeVisible();
    await expect(page.getByRole('radio', { name: 'Light' })).toBeVisible();
    await expect(page.getByRole('switch', { name: 'Live clock' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Reset demo data' })).toBeVisible();
    await expectNoAxeViolations(page);
    await capture(page, { phase: PHASE, screen: 'settings', fullPage: true });
  });
});

test.describe('help', () => {
  test('glossary filters by term', async ({ page }) => {
    await signInAs(page, 'usr_janet_kerr');
    await page.goto('/help');
    await waitForData(page);
    await expect(page.getByRole('heading', { name: 'Help' })).toBeVisible();
    await expect(page.getByText('Multi-Agency Public Protection Arrangements')).toBeVisible();
    await expectNoAxeViolations(page);
    await capture(page, { phase: PHASE, screen: 'help-glossary', fullPage: true });
    await page.getByLabel('Find a term').fill('MARAC');
    await expect(page.getByText('Multi-Agency Risk Assessment Conference')).toBeVisible();
    await expect(page.getByText('Multi-Agency Public Protection Arrangements')).toHaveCount(0);
  });

  test('about names the build and the synthetic data notice', async ({ page }) => {
    await signInAs(page, 'usr_janet_kerr');
    await page.goto('/help?tab=about');
    await waitForData(page);
    await expect(page.getByText('mockup-0.1.0')).toBeVisible();
    await expect(page.getByText(/Every person, address and record is fictional/)).toBeVisible();
    await expect(page.getByText('Human Rights Act 1998')).toBeVisible();
    await expectNoAxeViolations(page);
    await capture(page, { phase: PHASE, screen: 'help-about', fullPage: true });
  });
});
