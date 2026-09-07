/**
 * Shared Playwright helpers: axe scan, screenshot naming, theme and density switching.
 */
import AxeBuilder from '@axe-core/playwright';
import { expect, type Page } from '@playwright/test';
import { resolve } from 'node:path';

/** Screenshots always land in the repository's docs/SCREENSHOTS, whatever the Playwright cwd. */
const REPO_ROOT = resolve(import.meta.dirname, '..', '..');

export type Theme = 'light' | 'dark';
export type Density = 'comfortable' | 'compact';

export interface ShotOptions {
  phase: string;
  screen: string;
  theme?: Theme;
  density?: Density;
  fullPage?: boolean;
}

export function shotPath({ phase, screen, theme = 'light', density = 'comfortable' }: ShotOptions): string {
  return resolve(REPO_ROOT, 'docs', 'SCREENSHOTS', phase, `${screen}-${theme}-${density}.png`);
}

export async function setAppearance(page: Page, theme: Theme, density: Density): Promise<void> {
  await page.evaluate(
    ([t, d]) => {
      window.localStorage.setItem('mas.appearance', JSON.stringify({ theme: t, density: d }));
      document.documentElement.dataset.theme = t as string;
      document.documentElement.dataset.density = d as string;
    },
    [theme, density],
  );
}

/**
 * Sign in as a persona without going through the picker.
 *
 * Seeds the session only when there is not one already. The init script runs on every navigation, so
 * writing unconditionally overwrote everything the application had put in the session since: a
 * persona switched mid-test came back on the next `goto`, and the demo clock returned to the seeded
 * instant the moment a test navigated after moving it. Seeding once is also what actually happens:
 * a person signs in and the session is theirs until they change it.
 */
export async function signInAs(page: Page, userId: string): Promise<void> {
  await page.addInitScript((id) => {
    if (!window.localStorage.getItem('mas.session')) {
      window.localStorage.setItem('mas.session', JSON.stringify({ userId: id }));
    }
  }, userId);
}

/**
 * Change who is signed in part-way through a test.
 *
 * `signInAs` deliberately seeds the session only when there is not one already, so calling it a
 * second time does nothing and the page keeps the first persona. A test that walks one case past
 * three readers needs the switch to happen, and needs it to look like the demo: same browser, same
 * stored data, different person. The session is written as plaintext because the store accepts a
 * plaintext session once and re-seals it (apps/web/lib/store.ts), which is the same door `signInAs`
 * already uses.
 *
 * Break-glass grants are not carried over. That is the point of a persona switch: the next reader
 * gets what their own role gives them and nothing the last one talked their way into.
 */
export async function switchUser(page: Page, userId: string): Promise<void> {
  await page.evaluate((id) => {
    window.localStorage.setItem('mas.session', JSON.stringify({ userId: id }));
  }, userId);
  await page.reload();
}

export async function expectNoAxeViolations(page: Page): Promise<void> {
  const results = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa']).analyze();
  const serious = results.violations.filter((v) => v.impact === 'serious' || v.impact === 'critical' || v.impact === 'moderate' || v.impact === 'minor');
  if (serious.length > 0) {
    const summary = serious.map((v) => `${v.id} (${v.impact}): ${v.help} at ${v.nodes.slice(0, 3).map((n) => n.target.join(' ')).join('; ')}`).join('\n');
    expect(serious, `axe violations:\n${summary}`).toEqual([]);
  }
}

export async function waitForData(page: Page): Promise<void> {
  await page.waitForSelector('[data-app-ready="true"]', { timeout: 20000 });
}

export async function capture(page: Page, opts: ShotOptions): Promise<void> {
  await page.screenshot({ path: shotPath(opts), fullPage: opts.fullPage ?? false, animations: 'disabled' });
}
