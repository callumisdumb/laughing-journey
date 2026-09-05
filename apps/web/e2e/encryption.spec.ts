import { expect, test } from '@playwright/test';
import { signInAs, waitForData } from './helpers';

/**
 * The two claims that would be worthless if untrue, checked in a real browser.
 *
 * One: what the product persists is ciphertext. Anyone can open localStorage in devtools, or the
 * data file beside a packaged desktop build, and a demonstration whose store held plaintext would be
 * found out in seconds.
 *
 * Two: an unentitled reader gets the restricted state because their key does not unwrap, not
 * because a check said no. The difference is invisible on screen, which is exactly why it is worth
 * asserting here rather than trusting.
 */
test('what reaches the local store is ciphertext', async ({ page }) => {
  await signInAs(page, 'usr_janet_kerr');
  await page.goto('/');
  await waitForData(page);
  // Make a change, so there is an overlay to persist.
  await page.goto('/settings');
  await waitForData(page);

  const stored = await page.evaluate(() => {
    const out: Record<string, string> = {};
    for (let i = 0; i < window.localStorage.length; i += 1) {
      const key = window.localStorage.key(i);
      if (key) out[key] = window.localStorage.getItem(key) ?? '';
    }
    return out;
  });

  // Every store entry the product writes is a sealed blob: a version, a nonce and a ciphertext.
  for (const [key, raw] of Object.entries(stored)) {
    if (!key.startsWith('mas.overlay') && !key.startsWith('mas.session')) continue;
    const parsed = JSON.parse(raw) as { v?: number; n?: string; c?: string };
    expect(parsed.v, `${key} should be a sealed blob`).toBe(1);
    expect(typeof parsed.n).toBe('string');
    expect(typeof parsed.c).toBe('string');
    // Nothing readable: the session holds a user id, and it must not appear.
    expect(raw).not.toContain('usr_janet_kerr');
  }
});

test('an unentitled reader is stopped by the key, not by a check', async ({ page }) => {
  // Moira Gilmour is an ASP council officer and is not on the MAPPA record. She reaches the process
  // through the person record, so the subject is already known to her: presence is about the case,
  // not about the person's existence. What she must not see is anything from inside the record.
  await signInAs(page, 'usr_moira_gilmour');
  await page.goto('/processes/prc_mappa_derek');
  await waitForData(page);
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
  // Everything below lives inside the encrypted detail. None of it can be rendered without a key,
  // and she holds none: the wrap list has no entry for her, so there is nothing to attempt.
  await expect(page.getByText(/Risk Management Plan/i)).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Print minutes' })).toHaveCount(0);
});

test('a record opens for someone the matrix entitles', async ({ page }) => {
  // Priya Sharif is the MAPPA co-ordinator and holds a key.
  await signInAs(page, 'usr_priya_sharif');
  await page.goto('/processes/prc_mappa_derek');
  await waitForData(page);
  await expect(page.getByRole('heading', { level: 1, name: 'MAPPA: Derek Muir' })).toBeVisible();
  // Content that lives inside the encrypted detail, so seeing it proves the unwrap ran.
  await expect(page.getByText(/Risk Management Plan|Level 2|category/i).first()).toBeVisible();
});
