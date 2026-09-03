import { expect, test, type Page } from '@playwright/test';
import { capture, expectNoAxeViolations, signInAs, waitForData } from './helpers';

const PHASE = 'layout';

/**
 * The layout suite.
 *
 * The layout broke below 1440 for one reason: the grid's column widths came from media queries in
 * the stylesheet and the components' own states came from the appearance store, so the two could
 * disagree, and did. At 1100px the rail's track was 72px while the rail still rendered its expanded
 * contents, which want 125px: a clipped rail, not a collapsed one. The drawer had the mirror of it,
 * holding 360px at an 800px viewport and leaving the record 368px.
 *
 * So these assertions are about agreement, not appearance. The mode the width picks, the track that
 * mode gives each column, and whether the component in that track actually fits inside it.
 */
const MODES = [
  { w: 1920, h: 1080, mode: 'wide', rail: 'column', drawer: 'column' },
  { w: 1600, h: 1000, mode: 'wide', rail: 'column', drawer: 'column' },
  { w: 1440, h: 900, mode: 'standard', rail: 'column', drawer: 'column' },
  { w: 1280, h: 800, mode: 'standard', rail: 'column', drawer: 'column' },
  { w: 1100, h: 800, mode: 'compact', rail: 'column', drawer: 'overlay' },
  { w: 1024, h: 700, mode: 'compact', rail: 'column', drawer: 'overlay' },
  { w: 900, h: 700, mode: 'narrow', rail: 'overlay', drawer: 'overlay' },
  { w: 640, h: 700, mode: 'narrow', rail: 'overlay', drawer: 'overlay' },
] as const;

/** The screens with the most to fit: three-column, wide tables, a nine-stage stepper, a nine-column list. */
const SCREENS = [
  { name: 'person', user: 'usr_janet_kerr', path: '/people/per_aiden_boyle' },
  { name: 'process', user: 'usr_moira_gilmour', path: '/processes/prc_asp_marion' },
  { name: 'chronology', user: 'usr_janet_kerr', path: '/people/per_aiden_boyle/chronology' },
  { name: 'worklist', user: 'usr_janet_kerr', path: '/worklist' },
  { name: 'timescales', user: 'usr_sam_ogilvie', path: '/admin/timescales' },
] as const;

async function open(page: Page, screen: (typeof SCREENS)[number]) {
  await signInAs(page, screen.user);
  await page.goto(screen.path);
  await waitForData(page);
}

for (const { w, h, mode, rail, drawer } of MODES) {
  test.describe(`layout at ${w}x${h}`, () => {
    test.use({ viewport: { width: w, height: h } });

    test(`is ${mode}, with the rail as a ${rail} and the drawer as a ${drawer}`, async ({ page }) => {
      await open(page, SCREENS[0]);

      expect(await page.evaluate(() => document.documentElement.dataset.layout)).toBe(mode);

      // The rail: a column in the modes that dock it, a panel reached from the top bar otherwise.
      const railCount = await page.locator('.app-shell > nav').count();
      expect(railCount).toBe(rail === 'column' ? 1 : 0);
      expect(await page.getByRole('button', { name: 'Open navigation' }).count()).toBe(rail === 'overlay' ? 1 : 0);

      // The drawer, the same way.
      const drawerCount = await page.locator('.app-shell > aside').count();
      expect(drawerCount).toBe(drawer === 'column' ? 1 : 0);
      expect(await page.getByRole('button', { name: 'Open the context panel' }).count()).toBe(drawer === 'overlay' ? 1 : 0);

      // The bug this replaces: a side column whose contents are wider than the track it was given.
      if (rail === 'column') {
        const fits = await page.locator('.app-shell > nav').evaluate((el) => el.scrollWidth <= el.clientWidth);
        expect(fits, 'the rail is clipped rather than collapsed: its contents are wider than its track').toBe(true);
      }
      if (drawer === 'column') {
        const fits = await page.locator('.app-shell > aside').evaluate((el) => el.scrollWidth <= el.clientWidth);
        expect(fits, 'the drawer is clipped: its contents are wider than its track').toBe(true);
      }
    });

    for (const screen of SCREENS) {
      test(`${screen.name} does not scroll the page sideways`, async ({ page }) => {
        await open(page, screen);
        // WCAG 2.2 1.4.10 in the form that matters here: the page never needs two-dimensional
        // scrolling. Wide content is allowed, but it scrolls inside its own box.
        const overflow = await page.evaluate(() => ({
          doc: document.documentElement.scrollWidth,
          view: window.innerWidth,
          main: (() => {
            const m = document.querySelector('.app-content');
            return m ? { scroll: m.scrollWidth, client: m.clientWidth } : null;
          })(),
        }));
        expect(overflow.doc, 'the document scrolls sideways').toBeLessThanOrEqual(overflow.view);
        expect(overflow.main!.scroll, 'the record region scrolls sideways, which is 1.4.10 in disguise').toBeLessThanOrEqual(overflow.main!.client);
      });
    }
  });
}

test.describe('reflow at 400 percent zoom', () => {
  // WCAG 2.2 1.4.10 asks that content reflows at 400 percent on a 1280 by 1024 viewport. Zooming a
  // 1280px window to 400 percent leaves 320 CSS pixels across, which is what this is.
  test.use({ viewport: { width: 320, height: 256 } });

  for (const screen of SCREENS) {
    test(`${screen.name} reflows to one column with no sideways scrolling`, async ({ page }) => {
      await open(page, screen);
      expect(await page.evaluate(() => document.documentElement.dataset.layout)).toBe('narrow');

      const result = await page.evaluate(() => {
        const view = window.innerWidth;
        const orphans: string[] = [];
        for (const el of document.querySelectorAll('*')) {
          const r = el.getBoundingClientRect();
          if (r.width === 0 || r.right <= view + 1) continue;
          // Only the outermost cause: a parent that overflows drags its children with it.
          const pr = el.parentElement?.getBoundingClientRect();
          if (pr && pr.right > view + 1) continue;
          // Wide content is allowed to scroll inside a box of its own. What is not allowed is
          // content wider than the window with nothing between it and the window but the record
          // region, because then the whole record scrolls sideways.
          let ancestor = el.parentElement;
          let owned = false;
          while (ancestor && ancestor !== document.body) {
            if (ancestor.classList.contains('app-content')) break;
            const ox = getComputedStyle(ancestor).overflowX;
            if (ox === 'auto' || ox === 'scroll') {
              owned = true;
              break;
            }
            ancestor = ancestor.parentElement;
          }
          if (!owned) orphans.push(`${el.tagName}.${String(el.className).split(' ')[0]}`);
        }
        return { doc: document.documentElement.scrollWidth, view, orphans: [...new Set(orphans)] };
      });

      expect(result.doc).toBeLessThanOrEqual(result.view);
      expect(result.orphans, 'content wider than the window with no scrolling box of its own').toEqual([]);
    });
  }
});

/**
 * The truncation policy, asserted rather than described.
 *
 * Two ways text is allowed to not fit. It wraps, which is the default and what anything carrying a
 * sentence must do. Or it truncates with a visible ellipsis and carries the whole string in a
 * `title` or an accessible name, which is for identifiers in tight rows: a name in a table cell, a
 * reference in the rail. What is not allowed is the third thing, text sliced off with no ellipsis
 * and no way to read the rest, because that looks like the text ended there.
 */
test.describe('truncation', () => {
  test.use({ viewport: { width: 1024, height: 700 } });

  for (const screen of SCREENS) {
    test(`${screen.name} never slices text without saying so`, async ({ page }) => {
      await open(page, screen);
      const sliced = await page.evaluate(() => {
        const bad: string[] = [];
        for (const el of document.querySelectorAll('*')) {
          // Leaf text only: a container's scrollWidth says nothing about whether text is readable.
          if (el.children.length > 0) continue;
          const text = (el.textContent ?? '').trim();
          if (text.length === 0) continue;
          if (el.scrollWidth <= el.clientWidth + 1) continue;
          const box = el.getBoundingClientRect();
          // Visually hidden text is not truncated text. The idiom clips a 1px box, which trivially
          // satisfies scrollWidth > clientWidth and says nothing about whether anyone can read it.
          if (box.width <= 2 || box.height <= 2) continue;
          const style = getComputedStyle(el);
          if (style.textOverflow === 'ellipsis') continue;
          // An element allowed to scroll is not truncated, it is scrolled.
          if (style.overflowX === 'auto' || style.overflowX === 'scroll') continue;
          const labelled = el.getAttribute('title') ?? el.getAttribute('aria-label');
          if (labelled && labelled.includes(text.slice(0, 12))) continue;
          bad.push(`${el.tagName}.${String(el.className).split(' ')[0]}: ${text.slice(0, 50)}`);
        }
        return [...new Set(bad)];
      });
      expect(sliced, 'text cut off with no ellipsis and no full string to read').toEqual([]);
    });
  }
});

test.describe('the chrome as panels', () => {
  test.use({ viewport: { width: 900, height: 700 } });

  test('the rail opens as a panel, navigates, and closes itself', async ({ page }) => {
    await open(page, SCREENS[0]);
    await page.getByRole('button', { name: 'Open navigation' }).click();
    const panel = page.locator('dialog[open]');
    await expect(panel).toBeVisible();
    // The full labels are back: a panel is not the icon rail with more room, it is the expanded one.
    await expect(panel.getByRole('link', { name: 'Meetings' })).toBeVisible();
    await panel.getByRole('link', { name: 'Meetings' }).click();
    await expect(page.locator('dialog[open]')).toHaveCount(0);
    await expect(page).toHaveURL(/\/meetings/);
  });

  test('the context panel shows the same need-to-know answer as the docked column', async ({ page }) => {
    await open(page, SCREENS[0]);
    await page.getByRole('button', { name: 'Open the context panel' }).click();
    const panel = page.locator('dialog[open]');
    await expect(panel).toBeVisible();
    await expect(panel.getByRole('heading', { name: 'Who is involved' })).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(page.locator('dialog[open]')).toHaveCount(0);
  });
});

test.describe('layout appearance', () => {
  for (const { w, h, mode } of [MODES[2], MODES[5], MODES[6]] as const) {
    test(`${mode} at ${w}x${h}`, async ({ page }) => {
      await page.setViewportSize({ width: w, height: h });
      await open(page, SCREENS[0]);
      await expectNoAxeViolations(page);
      await capture(page, { phase: PHASE, screen: `person-${mode}-${w}`, theme: 'light' });
    });
  }
});
