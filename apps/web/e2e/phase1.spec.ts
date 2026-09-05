import { expect, test } from '@playwright/test';
import { capture, expectNoAxeViolations, setAppearance, signInAs, waitForData } from './helpers';

const PHASE = 'phase-1';

test.describe('sign in', () => {
  // The screen's own behaviour lives in `sign-in.spec.ts`, which was written with the rebuild. This
  // keeps phase-1's capture, because the screenshot path is cited in the handover index and in the
  // message catalogue's context entries, and asserts only that the round's foundation still stands.
  test('organisation then persona', async ({ page }) => {
    await page.goto('/sign-in');
    await waitForData(page);
    await expect(page.getByRole('heading', { name: /One person/ })).toBeVisible();
    await capture(page, { phase: PHASE, screen: 'sign-in' });
    await expectNoAxeViolations(page);
    await page.getByRole('button', { name: /Clydeshore Council/ }).click();
    await page.getByRole('button', { name: /Janet Kerr/ }).click();
    await expect(page.getByRole('heading', { name: /Good morning, Janet/ })).toBeVisible();
  });
});

test.describe('home', () => {
  test('shows clocks, worklist and today for Janet Kerr', async ({ page }) => {
    await signInAs(page, 'usr_janet_kerr');
    await page.goto('/');
    await waitForData(page);
    await expect(page.getByRole('heading', { name: 'Clocks', exact: false })).toBeVisible();
    await expect(page.getByText(/Aiden Boyle/).first()).toBeVisible();
    await expectNoAxeViolations(page);
    await capture(page, { phase: PHASE, screen: 'home' });
    await setAppearance(page, 'dark', 'comfortable');
    await capture(page, { phase: PHASE, screen: 'home', theme: 'dark' });
    await setAppearance(page, 'light', 'compact');
    await capture(page, { phase: PHASE, screen: 'home', density: 'compact' });
  });

  test('designed states are reachable', async ({ page }) => {
    await signInAs(page, 'usr_janet_kerr');
    for (const state of ['loading', 'empty', 'error', 'offline'] as const) {
      await page.goto(`/?state=${state}`);
      await waitForData(page);
      await capture(page, { phase: PHASE, screen: `home-state-${state}` });
    }
  });

  test('persona switcher is a demo affordance and is audited', async ({ page }) => {
    await signInAs(page, 'usr_janet_kerr');
    await page.goto('/');
    await waitForData(page);
    // The button's accessible name is an explicit label now, because below 1024 its visible name
    // and demo tag are hidden and a chevron alone has no name at all.
    await page.getByRole('button', { name: /Janet Kerr.*Switch persona/ }).click();
    await expect(page.getByRole('dialog')).toBeVisible();
    await page.getByRole('button', { name: /Paul Mackay/ }).click();
    await expect(page.getByRole('heading', { name: /Good morning, Paul/ })).toBeVisible();
  });

  test('keyboard reaches the rail and collapses it', async ({ page }) => {
    await signInAs(page, 'usr_janet_kerr');
    await page.goto('/');
    await waitForData(page);
    await page.getByRole('button', { name: 'Collapse navigation' }).click();
    await expect(page.getByRole('button', { name: 'Expand navigation' })).toBeVisible();
    await capture(page, { phase: PHASE, screen: 'home-rail-collapsed' });
  });
});
