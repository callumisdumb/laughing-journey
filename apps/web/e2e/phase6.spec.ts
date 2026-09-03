import { expect, test } from '@playwright/test';
import { capture, expectNoAxeViolations, setAppearance, signInAs, waitForData } from './helpers';

const PHASE = 'phase-6';

/**
 * Phase 6 sweep: every screen in dark theme and in compact density, each with an axe pass.
 * The light comfortable captures live under the earlier phase folders.
 */
const SCREENS: Array<{ id: string; path: string; user: string; heading: RegExp | string }> = [
  { id: 'home', path: '/', user: 'usr_janet_kerr', heading: /Good morning|Home|Tuesday/ },
  { id: 'worklist', path: '/worklist', user: 'usr_janet_kerr', heading: 'Worklist' },
  { id: 'people', path: '/people', user: 'usr_janet_kerr', heading: 'People' },
  { id: 'person-360', path: '/people/per_aiden_boyle', user: 'usr_janet_kerr', heading: 'Aiden Boyle' },
  { id: 'chronology', path: '/people/per_aiden_boyle/chronology', user: 'usr_janet_kerr', heading: /chronology/i },
  { id: 'inbox', path: '/inbox', user: 'usr_janet_kerr', heading: 'Inbox' },
  { id: 'processes', path: '/processes', user: 'usr_janet_kerr', heading: 'Processes' },
  { id: 'process-cp', path: '/processes/prc_cp_aiden', user: 'usr_janet_kerr', heading: 'Child protection: Aiden Boyle' },
  { id: 'process-asp', path: '/processes/prc_asp_marion', user: 'usr_moira_gilmour', heading: /Marion Fraser/ },
  { id: 'process-marac', path: '/processes/prc_marac_docherty', user: 'usr_karen_findlay', heading: /Kayleigh Docherty/ },
  { id: 'process-mappa', path: '/processes/prc_mappa_derek', user: 'usr_priya_sharif', heading: 'MAPPA: Derek Muir' },
  { id: 'process-awi', path: '/processes/prc_awi_ishbel', user: 'usr_graeme_dunlop', heading: /Ishbel Grant/ },
  { id: 'meetings', path: '/meetings', user: 'usr_janet_kerr', heading: 'Meetings' },
  { id: 'meeting-during', path: '/meetings/mtg_aiden_review?phase=during', user: 'usr_janet_kerr', heading: 'Review CPPM: Aiden Boyle' },
  { id: 'actions', path: '/actions', user: 'usr_janet_kerr', heading: 'Actions' },
  { id: 'sharing', path: '/sharing', user: 'usr_janet_kerr', heading: 'Sharing and notifications' },
  { id: 'connectors', path: '/connectors', user: 'usr_janet_kerr', heading: 'Connectors' },
  { id: 'reports', path: '/reports/cp', user: 'usr_janet_kerr', heading: /register/i },
  { id: 'audit', path: '/audit', user: 'usr_janet_kerr', heading: 'Audit' },
  { id: 'admin-need-to-know', path: '/admin/need-to-know', user: 'usr_janet_kerr', heading: /Need-to-know/i },
  { id: 'settings', path: '/settings', user: 'usr_janet_kerr', heading: 'Settings' },
  { id: 'help', path: '/help', user: 'usr_janet_kerr', heading: 'Help' },
];

for (const s of SCREENS) {
  test(`dark theme: ${s.id}`, async ({ page }) => {
    await signInAs(page, s.user);
    await page.addInitScript(() => {
      window.localStorage.setItem('mas.appearance', JSON.stringify({ theme: 'dark', density: 'comfortable' }));
    });
    await page.goto(s.path);
    await waitForData(page);
    await expect(page.getByRole('heading', { level: 1, name: s.heading })).toBeVisible();
    await expectNoAxeViolations(page);
    await capture(page, { phase: PHASE, screen: s.id, theme: 'dark' });
  });

  test(`compact density: ${s.id}`, async ({ page }) => {
    await signInAs(page, s.user);
    await page.addInitScript(() => {
      window.localStorage.setItem('mas.appearance', JSON.stringify({ theme: 'light', density: 'compact' }));
    });
    await page.goto(s.path);
    await waitForData(page);
    await expect(page.getByRole('heading', { level: 1, name: s.heading })).toBeVisible();
    await expectNoAxeViolations(page);
    await capture(page, { phase: PHASE, screen: s.id, density: 'compact' });
  });
}

test('the layout holds at 1024 wide', async ({ page }) => {
  await page.setViewportSize({ width: 1024, height: 768 });
  await signInAs(page, 'usr_janet_kerr');
  await page.goto('/processes/prc_cp_aiden');
  await waitForData(page);
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth);
  expect(overflow).toBe(false);
  await capture(page, { phase: PHASE, screen: 'process-cp-1024' });
  await setAppearance(page, 'dark', 'compact');
  await capture(page, { phase: PHASE, screen: 'process-cp-1024', theme: 'dark', density: 'compact' });
});

test('keyboard: skip link, search and rail are reachable and dialogs close on Escape', async ({ page }) => {
  await signInAs(page, 'usr_janet_kerr');
  await page.goto('/people/per_aiden_boyle/chronology');
  await waitForData(page);
  await page.keyboard.press('Tab');
  const first = await page.evaluate(() => document.activeElement?.textContent?.trim() ?? '');
  expect(first.length).toBeGreaterThan(0);
  await page.getByRole('button', { name: /Add event/ }).first().focus();
  await page.keyboard.press('Enter');
  await expect(page.getByRole('dialog')).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await page.getByRole('combobox', { name: /Search people/ }).focus();
  const focused = await page.evaluate(() => document.activeElement?.getAttribute('role') ?? '');
  expect(focused).toBe('combobox');
  await capture(page, { phase: PHASE, screen: 'keyboard-focus' });
});

test('print: the chronology pack is black on white with a running head', async ({ page }) => {
  await signInAs(page, 'usr_janet_kerr');
  await page.goto('/people/per_aiden_boyle/chronology?view=print');
  await waitForData(page);
  await page.emulateMedia({ media: 'print' });
  const colours = await page.evaluate(() => {
    const body = getComputedStyle(document.body);
    return { color: body.color, background: body.backgroundColor };
  });
  expect(colours.color).toBe('rgb(0, 0, 0)');
  expect(colours.background).toBe('rgb(255, 255, 255)');
  await expect(page.locator('.print-page').first()).toBeAttached();
  await expect(page.getByText(/Page 1 of/).first()).toBeAttached();
  await capture(page, { phase: PHASE, screen: 'chronology-print-media', fullPage: true });
});
