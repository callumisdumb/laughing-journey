import { expect, test, type Page } from '@playwright/test';
import { capture, signInAs, waitForData } from './helpers';

const PHASE = 'script';

/** The script is shot at 1920x1080 with the recording preset on, so that is what is walked. */
test.use({ viewport: { width: 1920, height: 1080 } });

async function preset(page: Page) {
  await page.addInitScript(() => {
    window.localStorage.setItem('mas.appearance', JSON.stringify({ theme: 'light', density: 'comfortable', recording: true }));
  });
}

async function chapter(page: Page, id: string) {
  await page.keyboard.press('Control+Shift+D');
  await expect(page.getByTestId('demo-panel')).toBeVisible();
  await page.getByTestId(`waypoint-${id}`).click();
  await waitForData(page);
}

/**
 * The dry run (brief section G.5).
 *
 * A shooting script that has not been walked against the built product is a wish list, and the way
 * it goes wrong is small: a waypoint that lands somewhere else, a control the script names that has
 * been renamed, a number the narration says out loud that the seed no longer produces. Each chapter
 * here opens from its own waypoint and asserts the thing the "Look at" column tells a viewer to
 * look at, so the script and the product cannot drift without this failing.
 *
 * `pnpm demo:check` does the other half: the narration still fits the slot it is given.
 */
test.describe('the shooting script, walked', () => {
  test('chapter 1: five systems, one child', async ({ page }) => {
    await preset(page);
    await signInAs(page, 'usr_janet_kerr');
    await page.goto('/');
    await waitForData(page);
    await chapter(page, 'problem');
    await expect(page).toHaveURL(/\/inbox/);
    // The narration says five systems. The queue has to show more than one.
    const systems = await page.locator('main').getByText(/eclipse|carefirst|seemis|emis|ivpd/i).count();
    expect(systems).toBeGreaterThan(1);
    await capture(page, { phase: PHASE, screen: 'chapter-1-problem', fullPage: true });
  });

  test('chapter 2: the lanes, the analysis lane and a pattern lens', async ({ page }) => {
    await preset(page);
    await signInAs(page, 'usr_janet_kerr');
    await page.goto('/');
    await waitForData(page);
    await chapter(page, 'chronology');
    await expect(page).toHaveURL(/\/people\/per_aiden_boyle\/chronology/);
    await expect(page.getByRole('heading', { level: 1 })).toContainText(/chronology/i);
    // The narration names the analysis lane and the escalation lens by name. Scoped to the record,
    // because the create menu's hidden hint also has the word analysis in it.
    const record = page.locator('main');
    await expect(record.getByText('Analysis', { exact: true }).first()).toBeVisible();
    await expect(record.getByText(/Escalation of police incidents/i).first()).toBeVisible();
    await capture(page, { phase: PHASE, screen: 'chapter-2-chronology', fullPage: true });
  });

  test('chapter 3: two practitioners and the host, in one frame', async ({ page }) => {
    await preset(page);
    await signInAs(page, 'usr_janet_kerr');
    await page.goto('/');
    await waitForData(page);
    await chapter(page, 'needToKnow');
    await expect(page).toHaveURL(/\/compare/);
    await expect(page.getByTestId('compare-left-panel').getByRole('heading', { level: 1 })).toContainText('Kayleigh Docherty');
    await expect(page.getByTestId('compare-right-panel').getByRole('heading', { level: 1 })).toContainText('restricted');
    await expect(page.getByTestId('compare-host')).toBeVisible();
    await capture(page, { phase: PHASE, screen: 'chapter-3-need-to-know', fullPage: true });
  });

  test('chapter 4: the capability matrix, and the other side of it', async ({ page }) => {
    await preset(page);
    await signInAs(page, 'usr_janet_kerr');
    await page.goto('/');
    await waitForData(page);
    await chapter(page, 'noDoubleEntry');
    await expect(page).toHaveURL(/\/connectors/);
    // The narration says ViSOR is never and EMIS Web is unverified. Both are on screen.
    await expect(page.getByText(/ViSOR/).first()).toBeVisible();
    await capture(page, { phase: PHASE, screen: 'chapter-4-connectors', fullPage: true });

    await chapter(page, 'simulator');
    await expect(page).toHaveURL(/\/simulator/);
    await expect(page.getByText(/simulated/i).first()).toBeVisible();
    await capture(page, { phase: PHASE, screen: 'chapter-4a-simulator', fullPage: true });
  });

  test('chapter 5: the chain, clicked from one case to the other', async ({ page }) => {
    await preset(page);
    await signInAs(page, 'usr_janet_kerr');
    await page.goto('/');
    await waitForData(page);
    await chapter(page, 'chain');
    await expect(page).toHaveURL(/\/processes\/prc_marac_docherty/);
    // The narration says seventeen of twenty-seven out loud, so the seed has to still say it. The
    // count and the sentence are separate elements, which is why both are asserted rather than one
    // regex over a string the screen never renders as one string.
    const marac = page.locator('main');
    await expect(marac.getByText('yes answers of 27.', { exact: false }).first()).toBeVisible();
    await expect(marac.getByText('17', { exact: true }).first()).toBeVisible();
    await expect(page.getByTestId('linked-CP-2026-0431')).toBeVisible();
    await capture(page, { phase: PHASE, screen: 'chapter-5-chain', fullPage: true });

    // The dry run corrected the script here. The coordinator holds presence on the children's case
    // and cannot open it, which is a stronger beat than the one first written: the model working
    // along the chain rather than the chain simply being clickable.
    await page.getByRole('link', { name: 'CP-2026-0431' }).click();
    await waitForData(page);
    await expect(page.getByRole('heading', { level: 1 })).toContainText('restricted');
    await capture(page, { phase: PHASE, screen: 'chapter-5-refused', fullPage: true });

    // And for the social worker who is on it, the same reference opens.
    await page.keyboard.press('Control+Shift+D');
    await expect(page.getByTestId('demo-panel')).toBeVisible();
    await page.getByTestId('persona-usr_janet_kerr').click();
    await waitForData(page);
    await expect(page.getByRole('heading', { level: 1 })).toContainText('Docherty');
  });

  test('chapter 6: the clock moves and the worklist reorders', async ({ page }) => {
    await preset(page);
    await signInAs(page, 'usr_janet_kerr');
    await page.goto('/');
    await waitForData(page);
    await chapter(page, 'clocks');
    await expect(page).toHaveURL(/\/worklist/);
    const before = await page.locator('main').getByRole('row').allInnerTexts();

    await page.keyboard.press('Control+Shift+D');
    await expect(page.getByTestId('demo-panel')).toBeVisible();
    // Three weeks is three presses of the week jump, which is what the script says to do.
    for (let i = 0; i < 3; i += 1) await page.getByRole('button', { name: /\+ 1 week|Forward one week|week/i }).last().click();
    await page.keyboard.press('Escape');
    await waitForData(page);
    const after = await page.locator('main').getByRole('row').allInnerTexts();
    expect(after.join('|')).not.toBe(before.join('|'));
    await capture(page, { phase: PHASE, screen: 'chapter-6-clocks', fullPage: true });
  });

  test('chapter 7: the invite list, the views and the minutes pack', async ({ page }) => {
    await preset(page);
    await signInAs(page, 'usr_janet_kerr');
    await page.goto('/');
    await waitForData(page);
    await chapter(page, 'meeting');
    await expect(page).toHaveURL(/\/meetings\/mtg_aiden_review/);
    await expect(page.getByRole('heading', { level: 1 })).toContainText('Review CPPM: Aiden Boyle');
    await capture(page, { phase: PHASE, screen: 'chapter-7-meeting', fullPage: true });
  });

  test('chapter 8: the store as the host sees it, beside the record', async ({ page }) => {
    await preset(page);
    await signInAs(page, 'usr_janet_kerr');
    await page.goto('/');
    await waitForData(page);
    await chapter(page, 'host');
    await expect(page).toHaveURL(/\/admin\/server-view/);
    await expect(page.getByRole('heading', { level: 1 })).toContainText(/host/i);
    await capture(page, { phase: PHASE, screen: 'chapter-8-host', fullPage: true });
  });

  test('chapter 9: the workbook return, cell by cell', async ({ page }) => {
    await preset(page);
    await signInAs(page, 'usr_janet_kerr');
    await page.goto('/');
    await waitForData(page);
    await chapter(page, 'workbook');
    await expect(page).toHaveURL(/\/reports\/asp/);
    await expect(page.getByRole('table').first()).toBeVisible();
    await capture(page, { phase: PHASE, screen: 'chapter-9-workbook', fullPage: true });
  });

  test('chapter 10: home, on the seeded clock', async ({ page }) => {
    await preset(page);
    await signInAs(page, 'usr_karen_findlay');
    await page.goto('/settings');
    await waitForData(page);
    await chapter(page, 'close');
    await expect(page).toHaveURL(/localhost:\d+\/$/);
    // The waypoint carries the seeded instant, so the close is shot on the same clock as the open.
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
    await capture(page, { phase: PHASE, screen: 'chapter-10-close', fullPage: true });
  });
});
