import { expect, test } from '@playwright/test';
import { capture, expectNoAxeViolations, signInAs, waitForData } from './helpers';

const PHASE = 'compare';

/** The view exists to be filmed at 1920x1080, so that is the width it is tested at. */
test.use({ viewport: { width: 1920, height: 1080 } });

/**
 * Two people, one record, one window.
 *
 * Everything else this product says about need-to-know is an assertion the audience takes on trust.
 * The assertions worth making here are the ones a viewer would make from the still: the same case,
 * two panels, one open and one refusing, and the difference computed rather than staged.
 */
test.describe('the two-persona view', () => {
  test('shows the same case answering two people differently', async ({ page }) => {
    await signInAs(page, 'usr_janet_kerr');
    await page.goto('/compare?process=prc_marac_docherty&left=usr_karen_findlay&right=usr_graeme_dunlop');
    await waitForData(page);

    const left = page.getByTestId('compare-left-panel');
    const right = page.getByTestId('compare-right-panel');

    // The coordinator, who has the case.
    await expect(left.getByRole('heading', { level: 1 })).toContainText('Kayleigh Docherty');
    // A mental health officer who is not on it. The header refuses without naming the case (D-170).
    await expect(right.getByRole('heading', { level: 1 })).toContainText('restricted');
    await expect(right.getByText('Kayleigh')).toHaveCount(0);

    await capture(page, { phase: PHASE, screen: 'two-personas', fullPage: true });
    await expectNoAxeViolations(page);
  });

  test('the panel is the real screen, so it refuses in the record rather than in a summary', async ({ page }) => {
    await signInAs(page, 'usr_janet_kerr');
    await page.goto('/compare?process=prc_mappa_derek&left=usr_priya_sharif&right=usr_claire_cowan');
    await waitForData(page);
    // A head teacher is outside the Responsible Authorities, so there is no way in at all.
    await expect(page.getByTestId('compare-right-panel').getByText(/Open with a reason/)).toHaveCount(0);
    // The liaison officer's panel is the working record, with the risk management plan on it.
    await expect(page.getByTestId('compare-left-panel').getByRole('heading', { level: 1 })).toContainText('Derek Muir');
  });

  test('adds the hosting provider as a third panel', async ({ page }) => {
    await signInAs(page, 'usr_janet_kerr');
    await page.goto('/compare?process=prc_marac_docherty&left=usr_karen_findlay&right=usr_graeme_dunlop&host=1');
    await waitForData(page);
    const host = page.getByTestId('compare-host');
    await expect(host).toBeVisible();
    // Practitioner, partner agency and hosting provider in one frame: ciphertext and a key count.
    await expect(host.getByText(/bytes of ciphertext/)).toBeVisible();
    await expect(host.getByText('Kayleigh')).toHaveCount(0);
    await capture(page, { phase: PHASE, screen: 'three-panels', fullPage: true });
  });

  test('a break-glass grant the presenter took does not open the panels', async ({ page }) => {
    // Moira breaks glass on the MAPPA as herself.
    await signInAs(page, 'usr_moira_gilmour');
    await page.goto('/processes/prc_mappa_derek');
    await waitForData(page);
    await page.getByRole('button', { name: /Open with a reason/ }).click();
    const dialog = page.getByRole('dialog');
    await dialog.getByRole('combobox').first().selectOption({ index: 1 });
    await dialog.getByRole('textbox').first().fill('Filming the restricted moment.');
    await dialog.getByRole('button', { name: 'Open with this reason' }).click();
    await waitForData(page);
    await expect(page.getByRole('heading', { level: 1 })).toContainText('Derek Muir');

    // A grant is recorded against a process and a moment, not against a person. If the panels read
    // the session's grants, every persona set into one would inherit it and the view would be
    // demonstrating the opposite of its claim.
    await page.goto('/compare?process=prc_mappa_derek&left=usr_janet_kerr&right=usr_claire_cowan');
    await waitForData(page);
    await expect(page.getByTestId('compare-left-panel').getByRole('heading', { level: 1 })).toContainText('restricted');
    await expect(page.getByTestId('compare-right-panel').getByRole('heading', { level: 1 })).toContainText('restricted');
  });
});
