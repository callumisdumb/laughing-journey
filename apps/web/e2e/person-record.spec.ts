import { test } from '@playwright/test';
import { createPerson } from './driven';
import { capture, expectNoAxeViolations, setAppearance, signInAs, waitForData } from './helpers';

const PHASE = 'person-record';

/**
 * The empty record as a designed state, photographed beside a populated one.
 *
 * Ailsa Muir is created here from nothing, through the same search-first flow a practitioner uses,
 * so that what is photographed is the state every person is in for the first minute of their
 * existence in the product: an identity, an address, no case, no relationships, no history. That is
 * a demo beat (create the person, look at the record, start the process) and it is designed as one.
 * The `before-*` captures in this round were taken once, from the export that preceded the
 * composition round, and are kept as the record of what it replaced (docs/NOTES.md).
 */
test.describe('the person record, new and populated', () => {
  test('a new record reads as designed', async ({ page }) => {
    await page.setViewportSize({ width: 1920, height: 1080 });
    await signInAs(page, 'usr_janet_kerr');
    await createPerson(page, 'Ailsa', 'Muir', '12 Mar 1988', { address: true });
    for (const theme of ['light', 'dark'] as const) {
      await setAppearance(page, theme, 'comfortable');
      await page.waitForTimeout(120);
      await capture(page, { phase: PHASE, screen: 'person-record-new', theme, fullPage: true });
    }
    await expectNoAxeViolations(page);
  });

  test('a populated record, for the contrast', async ({ page }) => {
    await page.setViewportSize({ width: 1920, height: 1080 });
    await signInAs(page, 'usr_janet_kerr');
    await page.goto('/people/per_kayleigh_docherty');
    await waitForData(page);
    for (const theme of ['light', 'dark'] as const) {
      await setAppearance(page, theme, 'comfortable');
      await page.waitForTimeout(120);
      await capture(page, { phase: PHASE, screen: 'person-record-populated', theme, fullPage: true });
    }
    await expectNoAxeViolations(page);
  });
});
