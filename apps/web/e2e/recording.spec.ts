import { expect, test, type Page } from '@playwright/test';
import { capture, expectNoAxeViolations, signInAs, waitForData } from './helpers';

const PHASE = 'recording';

/** The preset exists for a recording, and a recording is 1920x1080. */
test.use({ viewport: { width: 1920, height: 1080 } });

/**
 * Every screen under the recording preset, at the size it will be filmed at (brief section G.4).
 *
 * The sweep is the point rather than any single assertion in it. A preset that raises the type
 * scale changes every layout in the product at once, and the way that goes wrong is a heading that
 * now wraps into a control, or a table that now needs a scrollbar it did not need before. An axe
 * pass on each one catches the second kind: a region that has become scrollable and cannot be
 * reached from the keyboard.
 */
const SCREENS: Array<{ id: string; path: string; user: string; heading: RegExp | string }> = [
  { id: 'home', path: '/', user: 'usr_janet_kerr', heading: /Good morning|Home|Tuesday/ },
  { id: 'worklist', path: '/worklist', user: 'usr_janet_kerr', heading: 'Worklist' },
  { id: 'people', path: '/people', user: 'usr_janet_kerr', heading: 'People' },
  { id: 'person-record', path: '/people/per_aiden_boyle', user: 'usr_janet_kerr', heading: 'Aiden Boyle' },
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
  { id: 'search', path: '/search?q=Docherty', user: 'usr_karen_findlay', heading: 'Search' },
  { id: 'admin-need-to-know', path: '/admin/need-to-know', user: 'usr_janet_kerr', heading: /Need-to-know/i },
  { id: 'admin-server-view', path: '/admin/server-view', user: 'usr_janet_kerr', heading: /host/i },
  { id: 'settings', path: '/settings', user: 'usr_janet_kerr', heading: 'Settings' },
  { id: 'help', path: '/help', user: 'usr_janet_kerr', heading: 'Help' },
];

async function withPreset(page: Page) {
  await page.addInitScript(() => {
    window.localStorage.setItem('mas.appearance', JSON.stringify({ theme: 'light', density: 'comfortable', recording: true }));
  });
}

test.describe('the recording preset', () => {
  test('raises the type scale, forces comfortable density and stops the looping animation', async ({ page }) => {
    await signInAs(page, 'usr_janet_kerr');
    await page.goto('/settings');
    await waitForData(page);
    await expect(page.locator('html')).not.toHaveAttribute('data-recording', 'true');
    const before = await page.evaluate(() => getComputedStyle(document.body).fontSize);

    await page.getByTestId('recording-preset').check();
    await expect(page.locator('html')).toHaveAttribute('data-recording', 'true');
    await expect(page.locator('html')).toHaveAttribute('data-density', 'comfortable');
    const after = await page.evaluate(() => getComputedStyle(document.body).fontSize);
    expect(parseFloat(after)).toBeGreaterThan(parseFloat(before));

    // It survives a reload, because a presenter sets it once and then films.
    await page.reload();
    await waitForData(page);
    await expect(page.locator('html')).toHaveAttribute('data-recording', 'true');
    await capture(page, { phase: PHASE, screen: 'settings-preset' });
  });

  test('turning it on from compact takes the density with it', async ({ page }) => {
    await signInAs(page, 'usr_janet_kerr');
    await page.addInitScript(() => {
      window.localStorage.setItem('mas.appearance', JSON.stringify({ theme: 'light', density: 'compact' }));
    });
    await page.goto('/settings');
    await waitForData(page);
    await expect(page.locator('html')).toHaveAttribute('data-density', 'compact');
    await page.getByTestId('recording-preset').check();
    // One setting rather than a reminder to change three.
    await expect(page.locator('html')).toHaveAttribute('data-density', 'comfortable');
  });

  test('stops the skeleton shimmer, which answers nothing and compresses badly', async ({ page }) => {
    await withPreset(page);
    await signInAs(page, 'usr_karen_findlay');
    await page.goto('/search?q=Docherty&state=loading');
    await waitForData(page);
    const animation = await page.evaluate(() => {
      const skeleton = document.querySelector('[class*="skeleton"]');
      return skeleton ? getComputedStyle(skeleton).animationName : 'no skeleton';
    });
    expect(animation).toBe('none');
  });
});

for (const s of SCREENS) {
  test(`recording preset at 1920: ${s.id}`, async ({ page }) => {
    await withPreset(page);
    await signInAs(page, s.user);
    await page.goto(s.path);
    await waitForData(page);
    await expect(page.getByRole('heading', { level: 1, name: s.heading })).toBeVisible();
    // The document never scrolls sideways, whatever the type scale did to the widest thing on it.
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth);
    expect(overflow, `${s.id} scrolls the document sideways`).toBe(false);
    await expectNoAxeViolations(page);
    await capture(page, { phase: PHASE, screen: s.id });
  });
}
