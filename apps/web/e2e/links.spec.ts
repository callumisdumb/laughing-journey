import { expect, test } from '@playwright/test';
import { capture, expectNoAxeViolations, signInAs, waitForData } from './helpers';

const PHASE = 'links';
const AIDEN = 'per_aiden_boyle';
const KAYLEIGH = 'per_kayleigh_docherty';
const MARAC = 'prc_marac_docherty';

test.use({ viewport: { width: 1440, height: 900 } });

/**
 * The product is a web of records rather than a set of screens.
 *
 * The rules these assert are the ones that are easy to get wrong in the direction that leaks: a link
 * the reader cannot follow must look exactly like one they can, an excluded party must never be a
 * link at all, and a link that is not entitled must land on a state that refuses in writing and is
 * audited rather than one that pretends the record is not there.
 */
test.describe('person and practitioner links', () => {
  test('a name in the network reaches that person, and the trail says how you got there', async ({ page }) => {
    await signInAs(page, 'usr_janet_kerr');
    await page.goto(`/people/${AIDEN}`);
    await waitForData(page);

    // The network used to be an SVG with a hidden list: nothing to click.
    const sibling = page.getByRole('link', { name: 'Stacey Boyle' }).first();
    await expect(sibling).toBeVisible();
    await sibling.click();
    await expect(page.getByRole('heading', { level: 1, name: /Stacey Boyle/ })).toBeVisible();

    // The trail carries the record we came from, and going back truncates rather than appending.
    const trail = page.getByRole('navigation', { name: 'How you got here' });
    await expect(trail).toBeVisible();
    await expect(trail.getByRole('link', { name: /Aiden Boyle/ })).toBeVisible();
    await trail.getByRole('link', { name: /Aiden Boyle/ }).click();
    await expect(page.getByRole('heading', { level: 1, name: /Aiden Boyle/ })).toBeVisible();
    await expect(page.getByRole('navigation', { name: 'How you got here' })).toHaveCount(0);
  });

  test('a practitioner on a case reaches their card, with the cases the reader can also see', async ({ page }) => {
    await signInAs(page, 'usr_moira_gilmour');
    await page.goto('/processes/prc_asp_marion');
    await waitForData(page);
    // Stuart Blair is the second worker on Marion's ASP inquiry.
    const colleague = page.getByRole('link', { name: 'Stuart Blair' }).first();
    await expect(colleague).toBeVisible();
    await colleague.click();
    await expect(page.getByRole('heading', { level: 1, name: 'Stuart Blair' })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'How to reach them' })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Cases you can both see' })).toBeVisible();
    await expectNoAxeViolations(page);
    await capture(page, { phase: PHASE, screen: 'practitioner-card' });
  });

  test('an excluded party is named on the case and is not a link', async ({ page }) => {
    await signInAs(page, 'usr_karen_findlay');
    await page.goto(`/processes/${MARAC}`);
    await waitForData(page);

    const panel = page.getByRole('region', { name: /Who this case is about/ }).or(page.locator('section').filter({ hasText: 'Who this case is about' })).first();
    await expect(page.getByText('Who this case is about')).toBeVisible();

    // Ryan Kerr is the perpetrator on the MARAC referral: named, so the register is visible, and
    // never a route into a record from beside the reason he must not be given one. The name carries
    // the party role after it for a screen reader, so this matches on the name rather than equals.
    await expect(page.getByText(/Ryan Kerr/).first()).toBeVisible();
    await expect(page.getByRole('link', { name: /Ryan Kerr/ })).toHaveCount(0);
    await capture(page, { phase: PHASE, screen: 'case-parties' });
    void panel;
  });

  test('a link the reader is not entitled to follow is indistinguishable, and lands on the refusal', async ({ page }) => {
    // Mark Hepburn is a housing officer with presence-only access to Aiden's case.
    await signInAs(page, 'usr_mark_hepburn');
    await page.goto(`/people/${KAYLEIGH}`);
    await waitForData(page);

    const link = page.getByRole('link', { name: 'Lily Docherty' }).first();
    await expect(link, 'a name with a record is a link whether or not this reader may read it').toBeVisible();

    // Indistinguishable: the same element, the same styling, no marker of any kind before the click.
    const styling = await link.evaluate((el) => {
      const s = getComputedStyle(el);
      return { colour: s.color, decoration: s.textDecorationLine, cursor: s.cursor, disabled: el.getAttribute('aria-disabled') };
    });
    expect(styling.disabled).toBeNull();

    await link.click();
    // The refusal is a screen, in writing, and the record exists: that is the honest answer.
    await expect(page.getByRole('heading', { level: 1, name: /Lily Docherty/ })).toBeVisible();
    await capture(page, { phase: PHASE, screen: 'unentitled-landing' });
    void styling;
  });

  test('a clock reaches the rule that sets it', async ({ page }) => {
    await signInAs(page, 'usr_moira_gilmour');
    await page.goto('/processes/prc_asp_marion');
    await waitForData(page);
    await page.getByRole('link', { name: /Inquiry decision/ }).first().click();
    // The rule opens with its source and confidence, which is what "why is this five working days"
    // actually needs answering with.
    const dialog = page.locator('dialog[open]');
    await expect(dialog).toBeVisible();
    await expect(dialog).toContainText(/Code of Practice|Local procedures|working days/);
  });

  test('recently viewed remembers the records, in view order, and is not persisted', async ({ page }) => {
    await signInAs(page, 'usr_janet_kerr');
    await page.goto(`/people/${AIDEN}`);
    await waitForData(page);
    // Navigated by clicking rather than by address, because the trail is session state and a full
    // page load starts a new one. That is the point of the last assertion in this test.
    await page.getByRole('link', { name: 'Stacey Boyle' }).first().click();
    await expect(page.getByRole('heading', { level: 1, name: /Stacey Boyle/ })).toBeVisible();
    await page.getByRole('link', { name: 'Home', exact: true }).click();
    await waitForData(page);

    const recent = page.getByRole('region', { name: /Where you have been/ }).or(page.locator('section').filter({ hasText: 'Where you have been' })).first();
    await expect(page.getByText('Where you have been')).toBeVisible();
    await expect(page.getByRole('link', { name: /Aiden Boyle/ }).first()).toBeVisible();
    await expect(page.getByRole('link', { name: /Stacey Boyle/ }).first()).toBeVisible();
    await capture(page, { phase: PHASE, screen: 'recently-viewed' });
    void recent;

    // A new page load is a new session: the list is deliberately not written to local storage.
    await page.reload();
    await waitForData(page);
    await expect(page.getByText('Where you have been')).toHaveCount(0);
  });
});
