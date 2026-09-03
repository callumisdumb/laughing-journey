import { expect, test } from '@playwright/test';
import { capture, expectNoAxeViolations, setAppearance, signInAs, waitForData } from './helpers';

const PHASE = 'phase-2';
const AIDEN = 'per_aiden_boyle';

test.describe('people and search', () => {
  test('people list filters and shows access affordances', async ({ page }) => {
    await signInAs(page, 'usr_janet_kerr');
    await page.goto('/people');
    await waitForData(page);
    await expect(page.getByRole('heading', { name: 'People' })).toBeVisible();
    await page.getByLabel('Process').selectOption('cp');
    await expect(page.getByRole('link', { name: 'Aiden Boyle' })).toBeVisible();
    await expectNoAxeViolations(page);
    await capture(page, { phase: PHASE, screen: 'people' });
  });

  test('typeahead finds Aiden by name and by date of birth', async ({ page }) => {
    await signInAs(page, 'usr_janet_kerr');
    await page.goto('/');
    await waitForData(page);
    const box = page.getByRole('combobox', { name: /Search people/ });
    await box.fill('aiden');
    await expect(page.getByRole('option', { name: /Aiden Boyle/ })).toBeVisible();
    await capture(page, { phase: PHASE, screen: 'search-typeahead' });
    await box.fill('14/03/2019');
    await expect(page.getByRole('option', { name: /Aiden Boyle/ })).toBeVisible();
    await box.press('Enter');
    await expect(page).toHaveURL(/\/people\/per_aiden_boyle/);
  });

  test('search results page marks restricted and not-on-case', async ({ page }) => {
    await signInAs(page, 'usr_mark_hepburn');
    await page.goto('/search?q=boyle');
    await waitForData(page);
    await expect(page.getByText(/you are not on this case/).first()).toBeVisible();
    await expectNoAxeViolations(page);
    await capture(page, { phase: PHASE, screen: 'search-results' });
  });
});

test.describe('person 360', () => {
  test('header, tabs, drawer and views', async ({ page }) => {
    await signInAs(page, 'usr_janet_kerr');
    await page.goto(`/people/${AIDEN}`);
    await waitForData(page);
    await expect(page.getByRole('heading', { name: 'Aiden Boyle' })).toBeVisible();
    await expect(page.getByText('known as Aidy')).toBeVisible();
    await expect(page.getByText(/2 moves/)).toBeVisible();
    await expect(page.getByRole('complementary', { name: 'Context' }).getByText('Who is involved')).toBeVisible();
    await expectNoAxeViolations(page);
    await capture(page, { phase: PHASE, screen: 'person-record', fullPage: true });
    await setAppearance(page, 'dark', 'comfortable');
    await capture(page, { phase: PHASE, screen: 'person-record', theme: 'dark', fullPage: true });
    await setAppearance(page, 'light', 'compact');
    await capture(page, { phase: PHASE, screen: 'person-record', density: 'compact', fullPage: true });
    await setAppearance(page, 'light', 'comfortable');
    await page.getByRole('tab', { name: /Views and voice/ }).click();
    await expect(page.getByText(/I like school and my gran/)).toBeVisible();
    await capture(page, { phase: PHASE, screen: 'person-record-voice', fullPage: true });
    await page.getByRole('tab', { name: /Processes/ }).click();
    await expect(page.getByRole('link', { name: /Child protection: Aiden Boyle/ })).toBeVisible();
    await capture(page, { phase: PHASE, screen: 'person-record-processes' });
    await page.getByRole('tab', { name: /Sharing and audit/ }).click();
    await expect(page.getByText('Shared about this person')).toBeVisible();
    await capture(page, { phase: PHASE, screen: 'person-record-sharing', fullPage: true });
    await page.getByRole('tab', { name: /Chronology/ }).click();
    await expect(page.getByRole('application')).toBeVisible();
    await capture(page, { phase: PHASE, screen: 'person-record-chronology', fullPage: true });
  });

  test('housing officer sees presence only', async ({ page }) => {
    await signInAs(page, 'usr_mark_hepburn');
    await page.goto(`/people/${AIDEN}?tab=processes`);
    await waitForData(page);
    await expect(page.getByText(/presence only/)).toBeVisible();
    await capture(page, { phase: PHASE, screen: 'person-record-presence-only' });
  });

  test('records views', async ({ page }) => {
    await signInAs(page, 'usr_janet_kerr');
    await page.goto(`/people/${AIDEN}?tab=voice`);
    await waitForData(page);
    await page.getByRole('button', { name: 'Record views' }).first().click();
    await page.getByLabel('In their words').fill('I want to keep going to Gran on Fridays.');
    await page.getByRole('dialog').getByRole('button', { name: 'Record views' }).click();
    await expect(page.getByText('I want to keep going to Gran on Fridays.')).toBeVisible();
  });
});

test.describe('integrated chronology', () => {
  test('lanes, list, lenses, filters and drawer', async ({ page }) => {
    await signInAs(page, 'usr_janet_kerr');
    await page.goto(`/people/${AIDEN}/chronology`);
    await waitForData(page);
    await expect(page.getByRole('heading', { name: /integrated chronology/ })).toBeVisible();
    await expect(page.getByRole('table', { name: 'Chronology events' })).toBeVisible();
    await expectNoAxeViolations(page);
    await capture(page, { phase: PHASE, screen: 'chronology', fullPage: true });
    await page.getByRole('button', { name: 'Escalation of police incidents' }).click();
    await expect(page.getByRole('status').getByText(/police reports/)).toBeVisible();
    await page.getByRole('button', { name: 'Clusters of missed contacts' }).click();
    await capture(page, { phase: PHASE, screen: 'chronology-lenses', fullPage: true });
    await page.getByRole('row', { name: /Disclosure to class teacher/ }).first().click();
    await expect(page.getByRole('complementary', { name: 'Context' }).getByText('Lawful basis for inclusion')).toBeVisible();
    await capture(page, { phase: PHASE, screen: 'chronology-event-selected' });
    await page.getByRole('button', { name: '12 months' }).click();
    await expect(page.getByText(/Window: 02 Sep 2025/)).toBeVisible();
    await page.getByRole('button', { name: 'Single agency' }).click();
    await expect(page.getByRole('heading', { name: /Social work chronology/ })).toBeVisible();
    await setAppearance(page, 'dark', 'comfortable');
    await page.getByRole('button', { name: 'Integrated' }).click();
    await capture(page, { phase: PHASE, screen: 'chronology', theme: 'dark', fullPage: true });
    await setAppearance(page, 'light', 'compact');
    await capture(page, { phase: PHASE, screen: 'chronology', density: 'compact', fullPage: true });
  });

  test('keyboard walks events in the lanes', async ({ page }) => {
    await signInAs(page, 'usr_janet_kerr');
    await page.goto(`/people/${AIDEN}/chronology`);
    await waitForData(page);
    const first = page.getByRole('application').getByRole('button', { name: /significance$/ }).first();
    await first.focus();
    await page.keyboard.press('ArrowRight');
    await page.keyboard.press('Enter');
    await expect(page.getByRole('complementary', { name: 'Context' }).getByRole('heading', { name: 'Event' })).toBeVisible();
  });

  test('add event enforces the fact and analysis separation', async ({ page }) => {
    await signInAs(page, 'usr_janet_kerr');
    await page.goto(`/people/${AIDEN}/chronology`);
    await waitForData(page);
    await page.getByRole('button', { name: 'Add event' }).click();
    await page.getByLabel('Title (one line, plain language)').fill('Home visit: I think Stacey seems low');
    await page.getByLabel('Detail (short and factual)').fill('Visited at 10:00. Stacey said she had not slept.');
    await page.getByRole('dialog').getByRole('button', { name: 'Record event' }).click();
    // Twice over: once in the summary at the top of the dialog body, which takes focus, and once
    // against the field. The summary says what is wrong and the field says where.
    await expect(page.getByRole('dialog').getByRole('alert').first()).toContainText(/reads as opinion/);
    await expect(page.getByText(/reads as opinion/)).toHaveCount(2);
    await capture(page, { phase: PHASE, screen: 'chronology-add-event-validation' });
    await page.getByLabel('Title (one line, plain language)').fill('Home visit: Stacey reports poor sleep');
    await page.getByRole('dialog').getByRole('button', { name: 'Record event' }).click();
    await expect(page.getByText('Event recorded')).toBeVisible();
    await page.getByRole('button', { name: 'Add event' }).click();
    await page.getByRole('radio', { name: /An analysis note/ }).check();
    await page.getByRole('dialog').getByLabel(/^Title/).fill('Sleep and anxiety since May');
    await page.getByLabel('Your judgement and what it rests on').fill('Three reports of poor sleep since the disclosure suggest the plan should include mental health support for Stacey.');
    await page.getByRole('dialog').getByRole('button', { name: 'Record analysis note' }).click();
    // In the summary and against the field group, for the same reason as above.
    await expect(page.getByText('Link at least one event')).toHaveCount(2);
    await page.getByRole('dialog').getByRole('checkbox').first().check();
    await page.getByRole('dialog').getByRole('button', { name: 'Record analysis note' }).click();
    await expect(page.getByText('Analysis note recorded')).toBeVisible();
  });

  test('print pack carries the classification marking', async ({ page }) => {
    await signInAs(page, 'usr_janet_kerr');
    await page.goto(`/people/${AIDEN}/chronology?view=print`);
    await waitForData(page);
    await expect(page.getByRole('note', { name: /Classification/ })).toBeVisible();
    await expect(page.getByText(/Page 1 of/)).toBeVisible();
    await capture(page, { phase: PHASE, screen: 'chronology-print-pack', fullPage: true });
  });

  test('designed states', async ({ page }) => {
    await signInAs(page, 'usr_janet_kerr');
    for (const state of ['empty', 'stale', 'restricted'] as const) {
      await page.goto(`/people/${AIDEN}/chronology?state=${state}`);
      await waitForData(page);
      await capture(page, { phase: PHASE, screen: `chronology-state-${state}` });
    }
  });
});

test.describe('inbox and worklist', () => {
  test('promotes a connector event with a lawful basis', async ({ page }) => {
    await signInAs(page, 'usr_claire_cowan');
    await page.goto('/inbox');
    await waitForData(page);
    await expect(page.getByText(/seemis event/).first()).toBeVisible();
    await expectNoAxeViolations(page);
    await capture(page, { phase: PHASE, screen: 'inbox', fullPage: true });
    await page.getByRole('button', { name: 'Promote to integrated chronology' }).first().click();
    await page.getByLabel('Purpose').fill('Child protection planning for Aiden Boyle');
    await page.getByLabel('Necessity and proportionality').fill('Attendance is a plan outcome and the core group needs the pattern to review the plan on 14 September.');
    await capture(page, { phase: PHASE, screen: 'inbox-promote' });
    await page.getByRole('button', { name: 'Record lawful basis and promote' }).click();
    await expect(page.getByText('Promoted to the integrated chronology')).toBeVisible();
  });

  test('pulls from a connector with visible latency', async ({ page }) => {
    await signInAs(page, 'usr_paul_mackay');
    await page.goto('/inbox');
    await waitForData(page);
    await page.getByRole('button', { name: /Pull from iVPD/ }).click();
    await expect(page.getByText(/iVPD.*new event|already in the inbox/).first()).toBeVisible({ timeout: 10000 });
  });

  test('worklist views and bulk complete', async ({ page }) => {
    await signInAs(page, 'usr_janet_kerr');
    await page.goto('/worklist');
    await waitForData(page);
    await expect(page.getByRole('heading', { name: 'Worklist' })).toBeVisible();
    await expectNoAxeViolations(page);
    await capture(page, { phase: PHASE, screen: 'worklist' });
    await page.getByRole('button', { name: 'Overdue' }).click();
    await expect(page.getByRole('link', { name: /Recovery Service/ })).toBeVisible();
    await page.getByRole('button', { name: 'By process' }).click();
    await expect(page.getByRole('heading', { name: /CP-2026-0412/ })).toBeVisible();
    await page.getByRole('button', { name: 'Clocks' }).click();
    await capture(page, { phase: PHASE, screen: 'worklist-clocks' });
    await page.getByRole('button', { name: 'Mine' }).click();
    await page.getByRole('checkbox').first().check();
    await page.getByRole('button', { name: 'Mark complete' }).click();
    await expect(page.getByText(/marked complete/)).toBeVisible();
  });
});
