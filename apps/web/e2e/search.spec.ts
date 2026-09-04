import { expect, test, type Page } from '@playwright/test';
import { capture, expectNoAxeViolations, signInAs, switchUser, waitForData } from './helpers';

const PHASE = 'search';

/** Named, because a screen with a select on it has a second combobox and strict mode is right. */
const searchBox = (page: Page) => page.getByRole('combobox', { name: /Search people/ });

test.use({ viewport: { width: 1440, height: 900 } });

/**
 * Search is the first thing anybody tries, usually before the presenter has finished a sentence, so
 * it has to reach past people and case references into the records hanging off them, and it has to
 * stop exactly where the reader's keys stop. The second half is the one worth testing: a search box
 * is the fastest way to undo a need-to-know model, because a leak here does not look like a leak.
 */
test.describe('the typeahead', () => {
  test('suggests records, says what each one is, and opens the one you choose', async ({ page }) => {
    await signInAs(page, 'usr_karen_findlay');
    await page.goto('/worklist');
    await waitForData(page);

    const box = searchBox(page);
    await box.fill('Docherty');
    const list = page.getByRole('listbox');
    await expect(list).toBeVisible();
    // Each suggestion says what kind of record it is, so a flat list still reads as grouped.
    await expect(list.getByRole('option').first()).toContainText(/People|Cases|Chronology|Meetings|Actions|Plans/);
    await capture(page, { phase: PHASE, screen: 'typeahead' });
    await expectNoAxeViolations(page);

    // The keyboard path from the box to a record: down to the first suggestion, Enter to open it.
    await box.press('ArrowDown');
    await box.press('Enter');
    await waitForData(page);
    await expect(page).toHaveURL(/\/(people|processes|meetings|practitioners)\//);
  });

  test('reaches the way out with the keyboard, not only with the mouse', async ({ page }) => {
    await signInAs(page, 'usr_karen_findlay');
    await page.goto('/worklist');
    await waitForData(page);

    const box = searchBox(page);
    await box.fill('Docherty');
    const options = page.getByRole('listbox').getByRole('option');
    const count = await options.count();
    // The last option is "see all results". It used to be a presentation-only line, which made the
    // one route out of a suggestion list that has not found it unreachable from the keyboard.
    await expect(options.nth(count - 1)).toContainText('See all results');
    await box.press('End');
    await expect(options.nth(count - 1)).toHaveAttribute('aria-selected', 'true');
    await box.press('Enter');
    await waitForData(page);
    await expect(page).toHaveURL(/\/search\?q=Docherty/);
  });

  test('is reachable from anywhere with Control and K', async ({ page }) => {
    await signInAs(page, 'usr_karen_findlay');
    await page.goto('/reports/asp');
    await waitForData(page);
    await page.getByRole('heading', { level: 1 }).click();
    await page.keyboard.press('Control+k');
    await expect(searchBox(page)).toBeFocused();
  });
});

test.describe('the results screen', () => {
  test('groups the results by type rather than ranking them into one list', async ({ page }) => {
    await signInAs(page, 'usr_karen_findlay');
    await page.goto('/search?q=Docherty');
    await waitForData(page);

    const groups = page.getByTestId('search-groups');
    await expect(groups.getByRole('heading', { name: 'People' })).toBeVisible();
    // The point of grouping: a meeting never sits between two people.
    const headings = await groups.getByRole('heading', { level: 2 }).allInnerTexts();
    expect(headings.length).toBeGreaterThan(1);
    // Every result says why it is a result.
    await expect(groups.getByText(/Matched on/).first()).toBeVisible();
    await capture(page, { phase: PHASE, screen: 'results', fullPage: true });
    await expectNoAxeViolations(page);
  });

  test('shows a real loading state, because the results lag the query', async ({ page }) => {
    await signInAs(page, 'usr_karen_findlay');
    await page.goto('/search?q=Marion');
    await waitForData(page);
    await expect(page.getByTestId('search-groups')).toBeVisible();

    // Changing the query is a pushState, so the page is not reloaded and the transition can be
    // watched. The skeleton is the debounce showing through rather than a spinner somebody added.
    const box = searchBox(page);
    await box.fill('Docherty');
    // End lands on "see all results", which is the option that changes the query rather than
    // opening a record. Escape is not the way to close the list here: Chromium clears a search
    // input on Escape, so the query would arrive empty and there would be nothing to load.
    await box.press('End');
    const sawLoading = page.waitForFunction(() => document.body.innerText.includes('Searching the records you can open'), null, { polling: 16, timeout: 5000 });
    await box.press('Enter');
    await sawLoading;
    await expect(page.getByTestId('search-groups')).toBeVisible();
  });

  test('has its designed loading state on the demo override', async ({ page }) => {
    await signInAs(page, 'usr_karen_findlay');
    await page.goto('/search?q=Docherty&state=loading');
    await waitForData(page);
    await expect(page.getByTestId('search-groups')).toHaveCount(0);
    await capture(page, { phase: PHASE, screen: 'loading' });
  });

  test('says nothing was found rather than showing an empty screen', async ({ page }) => {
    await signInAs(page, 'usr_karen_findlay');
    await page.goto('/search?q=Zzzznotaname');
    await waitForData(page);
    await expect(page.getByText('No matches')).toBeVisible();
  });
});

test.describe('search stops where the keys stop', () => {
  test('a reader with no key finds neither the case nor anything hanging off it', async ({ page }) => {
    // Graeme Dunlop is a mental health officer with presence only on the Docherty MARAC.
    await signInAs(page, 'usr_graeme_dunlop');
    await page.goto('/search?q=Kayleigh Docherty');
    await waitForData(page);

    // The index says how many cases it could not reach. That is the sentence a real client-side
    // index can write: it knows how many wrap lists it is not on and nothing about what is in them.
    await expect(page.getByText(/could not be searched|were not searched|was not searched/)).toBeVisible();
    const groups = page.getByTestId('search-groups');
    await expect(groups.getByText('MARAC-2026-0093')).toHaveCount(0);
    await capture(page, { phase: PHASE, screen: 'no-key', fullPage: true });
  });

  test('finds that case by its reference, and the case says nothing', async ({ page }) => {
    await signInAs(page, 'usr_graeme_dunlop');
    await page.goto('/search?q=MARAC-2026-0093');
    await waitForData(page);
    const groups = page.getByTestId('search-groups');
    // Refusing visibly beats hiding: the reference finds the case and the row carries no name.
    await expect(groups.getByText('MARAC-2026-0093')).toBeVisible();
    await expect(groups.getByText('Restricted')).toBeVisible();
    await expect(groups.getByText('Kayleigh')).toHaveCount(0);
  });

  test('the coordinator, on the same query, gets the case and its records', async ({ page }) => {
    await signInAs(page, 'usr_karen_findlay');
    await page.goto('/search?q=Kayleigh Docherty');
    await waitForData(page);
    const groups = page.getByTestId('search-groups');
    await expect(groups.getByText('MARAC-2026-0093')).toBeVisible();
    await expect(groups.getByRole('heading', { name: 'Cases' })).toBeVisible();
  });
});

test('a record made a minute ago is found after a reload', async ({ page }) => {
  await signInAs(page, 'usr_moira_gilmour');
  await page.goto('/processes');
  await waitForData(page);
  await page.getByRole('link', { name: 'ASP-2026-0217' }).click();
  await waitForData(page);

  await page.getByTestId('add-plan').click();
  await page.getByTestId('plan-title').fill('Quernbrae protection plan');
  await page.getByTestId('plan-outcome-0').fill('Marion decides who comes into her house');
  await page.getByTestId('plan-review-date').fill('2026-12-01');
  await page.getByTestId('plan-submit').click();
  await expect(page.getByText('Plan recorded')).toBeVisible();

  // A full page load, which is what every navigation in the export is anyway. The index is built
  // from the persisted overlay, so a plan written a minute ago is in it.
  await page.goto('/search?q=Quernbrae');
  await waitForData(page);
  await expect(page.getByTestId('search-groups').getByText('Quernbrae protection plan')).toBeVisible();
});

test('a second persona searching the same word gets a different answer', async ({ page }) => {
  await signInAs(page, 'usr_karen_findlay');
  await page.goto('/search?q=Docherty');
  await waitForData(page);
  // The results lag the query, so read the groups once they are there rather than while the
  // skeleton is still up: comparing two empty lists proves nothing and passes.
  await expect(page.getByTestId('search-groups').getByRole('heading', { level: 2 }).first()).toBeVisible();
  const mine = await page.getByTestId('search-groups').getByRole('heading', { level: 2 }).allInnerTexts();
  expect(mine.length).toBeGreaterThan(1);

  await switchUser(page, 'usr_graeme_dunlop');
  await page.goto('/search?q=Docherty');
  await waitForData(page);
  await expect(page.getByTestId('search-groups').getByRole('heading', { level: 2 }).first()).toBeVisible();
  const theirs = await page.getByTestId('search-groups').getByRole('heading', { level: 2 }).allInnerTexts();
  expect(theirs).not.toEqual(mine);
});
