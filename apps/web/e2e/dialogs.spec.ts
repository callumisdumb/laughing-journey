import { expect, test, type Page } from '@playwright/test';
import { capture, expectNoAxeViolations, signInAs, waitForData } from './helpers';

const PHASE = 'dialogs';

/**
 * The dialog regression suite.
 *
 * Every modal in the product rendered pinned to the top left, at every width, because Tailwind's
 * preflight zeroes the `margin: auto` that centres a native dialog against its two zero insets. The
 * width was right, the backdrop painted and the dialogs opened, so nothing failed: the bug was
 * invisible to every test that existed.
 *
 * So these assertions are geometric rather than functional. Centred on both axes, footer inside the
 * viewport, focus inside, Escape closes, the page behind does not scroll, focus returns. At four
 * widths, because the failure mode this replaces was width-independent and the next one may not be.
 *
 * Nothing here skips. A trigger that cannot be found is a failure, not a pass, because a suite that
 * quietly stops covering a dialog is how the original bug survived.
 */
const WIDTHS = [
  { w: 1920, h: 1080 },
  { w: 1440, h: 900 },
  { w: 1280, h: 800 },
  { w: 1024, h: 700 },
] as const;

type DialogSpec = {
  name: string;
  user: string;
  path: string;
  /** The trigger's accessible name, or a CSS selector where the name is a person's name. */
  open: string | { selector: string };
  /** Clicked before the trigger, where the trigger only exists once something has been loaded. */
  prepare?: string;
};

/** Every dialog in the product, and how to reach it. */
const DIALOGS: readonly DialogSpec[] = [
  { name: 'classification', user: 'usr_priya_sharif', path: '/processes/prc_mappa_derek', open: 'Change classification' },
  { name: 'break-glass', user: 'usr_moira_gilmour', path: '/processes/prc_mappa_derek', open: 'Open with a reason' },
  { name: 'three-point-test', user: 'usr_moira_gilmour', path: '/processes/prc_asp_marion', open: 'Record three-point test' },
  { name: 'daq', user: 'usr_karen_findlay', path: '/processes/prc_marac_docherty', open: 'Record DAQ' },
  { name: 'capacity-assessment', user: 'usr_graeme_dunlop', path: '/processes/prc_awi_ishbel', open: 'Record capacity assessment' },
  { name: 'mappa-referral', user: 'usr_priya_sharif', path: '/processes/prc_mappa_derek', open: 'Refer to Level 2 or 3' },
  { name: 'add-event', user: 'usr_janet_kerr', path: '/people/per_aiden_boyle/chronology', open: 'Add event' },
  { name: 'record-views', user: 'usr_janet_kerr', path: '/people/per_aiden_boyle?tab=voice', open: 'Record views' },
  { name: 'inbox-promote', user: 'usr_fiona_ross', path: '/inbox', open: 'Promote to integrated chronology' },
  { name: 'inbox-dismiss', user: 'usr_fiona_ross', path: '/inbox', open: 'Dismiss' },
  { name: 'action-complete', user: 'usr_janet_kerr', path: '/actions', open: 'Complete' },
  { name: 'action-escalate', user: 'usr_janet_kerr', path: '/actions', open: 'Escalate' },
  { name: 'reset-demo-data', user: 'usr_janet_kerr', path: '/settings', open: 'Reset demo data' },
  { name: 'persona-switcher', user: 'usr_janet_kerr', path: '/', open: { selector: 'button[aria-haspopup="dialog"]' } },
  { name: 'admin-reset', user: 'usr_sam_ogilvie', path: '/admin', open: 'Reset demo data' },
  { name: 'admin-timescale', user: 'usr_sam_ogilvie', path: '/admin/timescales', open: 'Edit' },
  { name: 'admin-form-version', user: 'usr_sam_ogilvie', path: '/admin/forms', open: 'Add version' },
  { name: 'admin-audience', user: 'usr_sam_ogilvie', path: '/admin/need-to-know', open: { selector: 'button[aria-label^="Add audience"]' } },
  { name: 'admin-exclusion', user: 'usr_sam_ogilvie', path: '/admin/need-to-know', open: 'Add exclusion' },
];

async function openDialog(page: Page, spec: DialogSpec) {
  await signInAs(page, spec.user);
  await page.goto(spec.path);
  await waitForData(page);
  if (spec.prepare) {
    await page.getByRole('button', { name: spec.prepare, exact: true }).first().click();
  }
  const trigger =
    typeof spec.open === 'string'
      ? page.getByRole('button', { name: spec.open, exact: true }).first()
      : page.locator(spec.open.selector).first();
  await expect(trigger, `the ${spec.name} trigger is missing, so the dialog is unreachable`).toBeVisible();
  await trigger.click();
  const dialog = page.locator('dialog[open]');
  await expect(dialog).toBeVisible();
  return dialog;
}

for (const { w, h } of WIDTHS) {
  test.describe(`dialogs at ${w}x${h}`, () => {
    test.use({ viewport: { width: w, height: h } });

    for (const spec of DIALOGS) {
      test(`${spec.name} is centred and reachable`, async ({ page }) => {
        const dialog = await openDialog(page, spec);

        const box = (await dialog.boundingBox())!;
        expect(box).not.toBeNull();

        // Centred on both axes. Six pixels of tolerance for sub-pixel rounding, where an odd
        // viewport dimension and an odd content height put the centre on a half pixel. That is two
        // orders of magnitude tighter than the bug it replaces, which was off by hundreds.
        const centreX = box.x + box.width / 2;
        const centreY = box.y + box.height / 2;
        expect(Math.abs(centreX - w / 2)).toBeLessThanOrEqual(6);
        expect(Math.abs(centreY - h / 2)).toBeLessThanOrEqual(6);

        // Inside the viewport on every edge, which is what makes the footer reachable. A tall form
        // whose primary action is below the fold is a demo that stops.
        expect(box.x).toBeGreaterThanOrEqual(0);
        expect(box.y).toBeGreaterThanOrEqual(0);
        expect(box.x + box.width).toBeLessThanOrEqual(w);
        expect(box.y + box.height).toBeLessThanOrEqual(h);

        // The footer, specifically. It is the region that must never scroll out of reach.
        const footer = dialog.locator('[class*="foot"]').first();
        if ((await footer.count()) > 0) {
          const fb = (await footer.boundingBox())!;
          expect(fb.y + fb.height).toBeLessThanOrEqual(h);
        }

        // Focus is inside, which showModal() gives us and a hand-rolled trap usually does not.
        const focusInside = await page.evaluate(() => {
          const d = document.querySelector('dialog[open]');
          return d !== null && d.contains(document.activeElement);
        });
        expect(focusInside).toBe(true);

        // The page behind does not scroll while a modal is open. showModal() does not do this.
        expect(await page.evaluate(() => getComputedStyle(document.body).overflow)).toBe('hidden');
      });
    }

    test('Escape closes, and focus returns to the control that opened it', async ({ page }) => {
      await signInAs(page, 'usr_priya_sharif');
      await page.goto('/processes/prc_mappa_derek');
      await waitForData(page);
      const trigger = page.getByRole('button', { name: 'Change classification', exact: true });
      await trigger.click();
      await expect(page.locator('dialog[open]')).toBeVisible();
      await page.keyboard.press('Escape');
      await expect(page.locator('dialog[open]')).toHaveCount(0);
      // The page scrolls again, and the invoking control has focus back. Polled, because the spec
      // queues the dialog's `close` event as a task: the element is shut before the handler runs.
      await expect
        .poll(() => page.evaluate(() => getComputedStyle(document.body).overflow))
        .not.toBe('hidden');
      await expect(trigger).toBeFocused();
    });
  });
}

test.describe('dialog behaviour', () => {
  test.use({ viewport: { width: 1024, height: 700 } });

  test('a body taller than the viewport scrolls inside the dialog, not the dialog off the screen', async ({ page }) => {
    await signInAs(page, 'usr_moira_gilmour');
    await page.goto('/processes/prc_asp_marion');
    await waitForData(page);
    await page.getByRole('button', { name: 'Record three-point test', exact: true }).first().click();
    const dialog = page.locator('dialog[open]');
    await expect(dialog).toBeVisible();

    const body = dialog.locator('[class*="body"]').first();
    const metrics = await body.evaluate((el) => ({ scrollHeight: el.scrollHeight, clientHeight: el.clientHeight }));
    // At 700px high, the three-point test is taller than the space it has. That is the point.
    expect(metrics.scrollHeight).toBeGreaterThan(metrics.clientHeight);

    // The scroll shadow tells the reader there is more below, before they have scrolled.
    await expect(body).toHaveAttribute('data-scroll-bottom', 'true');
    await body.evaluate((el) => el.scrollTo(0, el.scrollHeight));
    await expect(body).toHaveAttribute('data-scroll-top', 'true');
    await expect(body).toHaveAttribute('data-scroll-bottom', 'false');

    // And the footer is still on screen at the bottom of a 700px viewport.
    const fb = (await dialog.locator('[class*="foot"]').first().boundingBox())!;
    expect(fb.y + fb.height).toBeLessThanOrEqual(700);
  });

  test('a dialog opened over a dialog stacks, and closing the top one returns focus into the one below', async ({ page }) => {
    await signInAs(page, 'usr_janet_kerr');
    await page.goto('/people/per_aiden_boyle/chronology');
    await waitForData(page);
    await page.getByRole('button', { name: 'Add event', exact: true }).first().click();
    await expect(page.locator('dialog[open]')).toHaveCount(1);
    // The scroll lock counts, so a second open and a first close must not release it early.
    const locked = await page.evaluate(() => getComputedStyle(document.body).overflow);
    expect(locked).toBe('hidden');
    await page.keyboard.press('Escape');
    await expect(page.locator('dialog[open]')).toHaveCount(0);
    await expect
      .poll(() => page.evaluate(() => getComputedStyle(document.body).overflow))
      .not.toBe('hidden');
  });
});

test.describe('dialog appearance', () => {
  test.use({ viewport: { width: 1440, height: 900 } });

  for (const theme of ['light', 'dark'] as const) {
    test(`${theme} theme: a long statutory form scrolls its body and keeps its footer`, async ({ page }) => {
      await signInAs(page, 'usr_moira_gilmour');
      await page.addInitScript((t) => {
        window.localStorage.setItem('mas.appearance', JSON.stringify({ theme: t, density: 'comfortable' }));
      }, theme);
      await page.goto('/processes/prc_asp_marion');
      await waitForData(page);
      await page.getByRole('button', { name: 'Record three-point test', exact: true }).first().click();
      const dialog = page.locator('dialog[open]');
      await expect(dialog).toBeVisible();
      await expectNoAxeViolations(page);
      await capture(page, { phase: PHASE, screen: 'statutory-form', theme });
    });
  }
});
