import { expect, test } from '@playwright/test';
import { capture, expectNoAxeViolations, waitForData } from './helpers';

const PHASE = 'sign-in';

/**
 * The sign-in screen, rebuilt. `docs/NOTES.md` carries the critique of the one it replaces.
 *
 * These assert the things the rebuild was for: the honest statement is near the top rather than a
 * footnote in the corner, both questions are answerable without scrolling, the fastest route in is
 * the keyboard, the persona used last time is offered before either question is asked, and there is
 * still no credential field, because a password box that accepts anything is a lie told in the first
 * five seconds of a demonstration about honesty in information sharing.
 */
test.describe('sign-in', () => {
  test.use({ viewport: { width: 1440, height: 900 } });

  test('says what it is, and asks nothing it cannot check', async ({ page }) => {
    await page.goto('/sign-in');
    await waitForData(page);

    await expect(page.getByText(/This is a demonstration/)).toBeVisible();
    await expect(page.getByText(/There is no sign-in to do/)).toBeVisible();

    // No credential field of any kind. The only text input on the screen is the filter.
    const inputs = page.locator('input');
    await expect(inputs).toHaveCount(1);
    await expect(inputs.first()).toHaveAttribute('type', 'search');
    await expect(page.locator('input[type="password"]')).toHaveCount(0);

    await expectNoAxeViolations(page);
    await capture(page, { phase: PHASE, screen: 'sign-in' });
  });

  test('both questions are on screen at once, without scrolling', async ({ page }) => {
    await page.goto('/sign-in');
    await waitForData(page);
    // The old screen pushed the persona list below the fold the moment an organisation was chosen.
    const both = await page.evaluate(() => {
      const heads = [...document.querySelectorAll('h2')].map((h) => h.getBoundingClientRect().bottom);
      const firstPersona = document.querySelector('button[class*="__persona"]')?.getBoundingClientRect().top;
      return { heads, firstPersona, view: window.innerHeight };
    });
    expect(both.heads.length).toBeGreaterThanOrEqual(2);
    expect(both.firstPersona!, 'the first persona is below the fold').toBeLessThan(both.view);
  });

  test('typing a name reaches the person, without touching the organisation list', async ({ page }) => {
    await page.goto('/sign-in');
    await waitForData(page);

    // Focused on arrival: the fastest way in is to type, and this screen has one job.
    expect(await page.evaluate(() => document.activeElement?.getAttribute('type'))).toBe('search');

    await page.keyboard.type('moira');
    const personas = page.locator('button[class*="__persona"]');
    await expect(personas).toHaveCount(1);
    await expect(personas.first()).toContainText('Moira Gilmour');
    await personas.first().click();
    await expect(page.getByRole('heading', { level: 1, name: /Moira/ })).toBeVisible();
  });

  test('the persona used last time is offered before either question is asked', async ({ page }) => {
    await page.addInitScript(() => window.localStorage.setItem('mas.lastPersona', 'usr_janet_kerr'));
    await page.goto('/sign-in');
    await waitForData(page);

    const resume = page.getByText('Carry on as before');
    await expect(resume).toBeVisible();
    await expect(page.getByText(/Janet Kerr, Social worker/)).toBeVisible();
    await capture(page, { phase: PHASE, screen: 'sign-in-remembered' });
    await page.getByRole('button', { name: 'Continue' }).click();
    await expect(page.getByRole('heading', { level: 1, name: /Janet/ })).toBeVisible();
  });

  test('the arrow keys walk the organisation list and the people beside it follow', async ({ page }) => {
    await page.goto('/sign-in');
    await waitForData(page);
    await page.locator('button[class*="__org"]').first().focus();
    const before = await page.locator('button[class*="__persona"]').first().textContent();
    await page.keyboard.press('ArrowDown');
    await expect(page.locator('button[class*="__persona"]').first()).not.toHaveText(before ?? '');
  });

  test('dark theme', async ({ page }) => {
    await page.addInitScript(() => window.localStorage.setItem('mas.appearance', JSON.stringify({ theme: 'dark', density: 'comfortable' })));
    await page.goto('/sign-in');
    await waitForData(page);
    await expectNoAxeViolations(page);
    await capture(page, { phase: PHASE, screen: 'sign-in', theme: 'dark' });
  });
});
