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

/** Sign in as a persona without going through the picker. */
export async function signInAs(page: Page, userId: string): Promise<void> {
  await page.addInitScript((id) => {
    window.localStorage.setItem('mas.session', JSON.stringify({ userId: id }));
  }, userId);
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
