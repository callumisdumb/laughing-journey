import { expect, test } from '@playwright/test';
import { capture, expectNoAxeViolations, setAppearance, signInAs, waitForData } from './helpers';

const PHASE = 'phase-5';
const ADMIN = 'usr_sam_ogilvie';

test.describe('admin', () => {
  test('overview: area details, section cards and reset', async ({ page }) => {
    await signInAs(page, ADMIN);
    await page.goto('/admin');
    await waitForData(page);
    await expect(page.getByRole('heading', { name: 'Admin', level: 1 })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Area details' })).toBeVisible();
    await expect(page.getByRole('navigation', { name: 'Admin sections' }).getByRole('link', { name: 'Overview' })).toHaveAttribute('aria-current', 'page');
    await expect(page.getByText(/clock rules, \d+ to verify/)).toBeVisible();
    await expectNoAxeViolations(page);
    await capture(page, { phase: PHASE, screen: 'admin', fullPage: true });
    await page.getByRole('button', { name: 'Reset demo data' }).first().click();
    await expect(page.getByRole('dialog')).toBeVisible();
    await page.getByRole('dialog').getByRole('button', { name: 'Cancel' }).click();
  });

  test('timescales grouped by process with confidence and an edit dialog', async ({ page }) => {
    await signInAs(page, ADMIN);
    await page.goto('/admin/timescales');
    await waitForData(page);
    await expect(page.getByRole('heading', { name: 'Timescales', level: 1 })).toBeVisible();
    await expect(page.getByText('to verify').first()).toBeVisible();
    await expectNoAxeViolations(page);
    await capture(page, { phase: PHASE, screen: 'admin-timescales', fullPage: true });
    await page.getByRole('button', { name: 'Edit' }).first().click();
    await expect(page.getByRole('dialog')).toBeVisible();
    await expect(page.getByRole('dialog').getByLabel('Amount')).toBeVisible();
    await page.getByRole('dialog').getByRole('button', { name: 'Cancel' }).click();
  });

  test('need-to-know matrix for child protection with an edit dialog', async ({ page }) => {
    await signInAs(page, ADMIN);
    await page.goto('/admin/need-to-know?process=cp');
    await waitForData(page);
    await expect(page.getByRole('heading', { name: 'Need-to-know', level: 1 })).toBeVisible();
    await expect(page.getByRole('tab', { name: /^CP/ })).toHaveAttribute('aria-selected', 'true');
    await expect(page.getByRole('rowheader', { name: 'IRD' })).toBeVisible();
    await expectNoAxeViolations(page);
    await capture(page, { phase: PHASE, screen: 'admin-need-to-know', fullPage: true });
    await setAppearance(page, 'light', 'compact');
    await capture(page, { phase: PHASE, screen: 'admin-need-to-know', density: 'compact' });
    await setAppearance(page, 'light', 'comfortable');
    await page.getByRole('button', { name: /Social work senior/ }).first().click();
    await expect(page.getByRole('dialog')).toBeVisible();
    await expect(page.getByRole('dialog').getByLabel('Audience label')).toHaveValue('Social work senior');
    await expectNoAxeViolations(page);
    await capture(page, { phase: PHASE, screen: 'admin-need-to-know-edit' });
    await page.getByRole('dialog').getByLabel('Audience label').fill('Social work senior (duty)');
    await page.getByRole('dialog').getByRole('button', { name: 'Save audience' }).click();
    await expect(page.getByText(/1 unsaved change/)).toBeVisible();
    await page.getByRole('button', { name: 'Discard changes' }).click();
    await expect(page.getByText('No unsaved changes.')).toBeVisible();
  });

  test('need-to-know for MARAC shows hard exclusions that cannot be removed', async ({ page }) => {
    await signInAs(page, ADMIN);
    await page.goto('/admin/need-to-know?process=marac');
    await waitForData(page);
    await expect(page.getByRole('tab', { name: /^MARAC/ })).toHaveAttribute('aria-selected', 'true');
    const remove = page.getByRole('button', { name: 'Remove exclusion: Perpetrator', exact: true });
    await expect(remove).toBeDisabled();
    await expect(remove).toHaveAttribute('title', /cannot be lifted in the UI/);
    await expect(page.getByRole('button', { name: /Remove exclusion: Perpetrator's family/ })).toBeDisabled();
    await expectNoAxeViolations(page);
    await capture(page, { phase: PHASE, screen: 'admin-need-to-know-marac', fullPage: true });
  });

  test('users: personas with a filter and sign in as', async ({ page }) => {
    await signInAs(page, ADMIN);
    await page.goto('/admin/users');
    await waitForData(page);
    await expect(page.getByRole('heading', { name: 'Users', level: 1 })).toBeVisible();
    await expect(page.getByText('You', { exact: true })).toBeVisible();
    await expectNoAxeViolations(page);
    await capture(page, { phase: PHASE, screen: 'admin-users', fullPage: true });
    await page.getByLabel('Filter personas').fill('Kerr');
    await expect(page.getByText(/1 of \d+ personas/)).toBeVisible();
    await page.getByRole('button', { name: 'Sign in as Janet Kerr' }).click();
    await expect(page.getByRole('heading', { name: /Good morning, Janet/ })).toBeVisible();
  });

  test('defaults: theme, density, break-glass window and eligibility', async ({ page }) => {
    await signInAs(page, ADMIN);
    await page.goto('/admin/defaults');
    await waitForData(page);
    await expect(page.getByRole('heading', { name: 'Defaults', level: 1 })).toBeVisible();
    // The holiday lists moved to their own Calendar section, which has its own spec.
    await expect(page.getByText(/bank holidays/i)).toHaveCount(0);
    await expect(page.getByLabel('Hours')).toHaveValue('4');
    await expectNoAxeViolations(page);
    await capture(page, { phase: PHASE, screen: 'admin-defaults', fullPage: true });
    await setAppearance(page, 'dark', 'comfortable');
    await capture(page, { phase: PHASE, screen: 'admin-defaults', theme: 'dark' });
  });

  test('copy and labels: search, edit with preview, persist across reload, reset', async ({ page }) => {
    await signInAs(page, ADMIN);
    await page.goto('/admin/labels');
    await waitForData(page);
    await expect(page.getByRole('heading', { name: 'Copy and labels', level: 1 })).toBeVisible();
    await page.getByLabel('Search copy').fill('admin.copy.title');
    const row = page.getByRole('row', { name: /admin\.copy\.title/ });
    await expect(row).toBeVisible();
    await row.getByRole('button', { name: 'Edit' }).click();
    const field = page.getByLabel('New text for admin.copy.title');
    await field.fill('Copy and labels {');
    await page.getByRole('button', { name: 'Save' }).click();
    await expect(page.getByText(/^ICU syntax:/)).toBeVisible();
    await field.fill('Copy and labels (Clydeshore)');
    await expect(page.getByText('Copy and labels (Clydeshore)').first()).toBeVisible();
    await page.getByRole('button', { name: 'Save' }).click();
    await expect(page.getByRole('heading', { name: 'Copy and labels (Clydeshore)', level: 1 })).toBeVisible();
    await expect(row.getByText('changed')).toBeVisible();
    await expectNoAxeViolations(page);
    await capture(page, { phase: PHASE, screen: 'admin-copy' });
    await page.reload();
    await waitForData(page);
    await expect(page.getByRole('heading', { name: 'Copy and labels (Clydeshore)', level: 1 })).toBeVisible();
    await page.getByLabel('Search copy').fill('admin.copy.title');
    await page.getByRole('row', { name: /admin\.copy\.title/ }).getByRole('button', { name: 'Reset' }).click();
    await expect(page.getByRole('heading', { name: 'Copy and labels', level: 1 })).toBeVisible();
    await page.goto('/audit');
    await waitForData(page);
    await expect(page.getByText('Copy admin.copy.title set to "Copy and labels (Clydeshore)"')).toBeVisible();
  });

  test('a practitioner sees admin read-only', async ({ page }) => {
    await signInAs(page, 'usr_janet_kerr');
    await page.goto('/admin/labels');
    await waitForData(page);
    await expect(page.getByRole('heading', { name: 'Copy and labels', level: 1 })).toBeVisible();
    await expect(page.getByText('Read-only: ask a system administrator')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Edit' }).first()).toBeDisabled();
    await expectNoAxeViolations(page);
  });
});
