import { expect, test } from '@playwright/test';
import { createPerson, openTransition, startCase, submitTransition } from './driven';
import { capture, expectNoAxeViolations, signInAs, switchUser, waitForData } from './helpers';
import type { Page } from '@playwright/test';

const PHASE = 'lsi';

/** Choose the first real option on a select, for a list whose contents the seed decides. */
async function selectFirst(page: Page, testId: string): Promise<string> {
  const select = page.getByTestId(testId);
  const options = await select.locator('option').evaluateAll((els) => els.map((el) => ({ value: (el as HTMLOptionElement).value, text: el.textContent ?? '' })));
  const first = options.find((o) => o.value !== '');
  expect(first, `an option on ${testId}`).toBeDefined();
  await select.selectOption(first!.value);
  return first!.text;
}

test.use({ viewport: { width: 1440, height: 900 } });

/**
 * A Large Scale Investigation through the engine (D-253), driven. The seed always had one, at
 * Whinbrae House, but it was written into the data rather than reachable: nobody could open one, and
 * nobody could add an adult to it. Both are transitions now. The chair has to be a senior officer of
 * the council, which is what the national minimum dataset glossary expects, and the record refuses
 * an investigation whose chair is not one.
 */
test('an inquiry into one adult becomes an investigation into the setting, and the adults inside it are added as strands', async ({ page }) => {
  await signInAs(page, 'usr_moira_gilmour');
  await createPerson(page, 'Effie', 'Sinclair', '1938-11-04');
  await startCase(page, 'asp', 'Care Inspectorate, unannounced inspection', 'Two residents at Portlennan Lodge have unexplained bruising and the medication records do not add up.');
  const caseUrl = page.url();
  const header = page.getByTestId('process-header');

  // The three-point test, the screening decision and the inquiry, which is where an investigation
  // into the setting can start from.
  await page.getByRole('button', { name: 'Record three-point test' }).click();
  const test3 = page.getByRole('dialog');
  await test3.getByLabel('Date of assessment').fill('2026-09-03');
  for (let i = 0; i < 3; i += 1) await test3.getByRole('radio', { name: 'Met', exact: true }).nth(i).check();
  await test3.getByLabel('Reasoning for limb (a)').fill('Effie needs help with everything and cannot leave the home unaided.');
  await test3.getByLabel('Reasoning for limb (b)').fill('Bruising to both upper arms and doses signed for that were never given.');
  await test3.getByLabel('Reasoning for limb (c)').fill('Advanced dementia leaves her less able than others to protect herself.');
  await test3.getByLabel('Physical harm').check();
  await test3.getByLabel('Neglect and Acts of Omission').check();
  await test3.getByLabel('Immediate safety').fill('Two staff suspended by the provider pending the investigation.');
  await test3.getByRole('button', { name: 'Record three-point test' }).click();

  await switchUser(page, 'usr_anne_hendry');
  await page.goto(caseUrl);
  await waitForData(page);
  await openTransition(page, 'asp-screening-decision');
  await page.getByTestId('transition-rationale').fill('Three-point test met. Physical harm and neglect in a registered care home; inquiry under section 4.');
  await submitTransition(page);

  await switchUser(page, 'usr_moira_gilmour');
  await page.goto(caseUrl);
  await waitForData(page);
  await openTransition(page, 'asp-open-inquiry');
  await page.getByTestId('transition-agency-health').check();
  await page.getByTestId('transition-agency-regulator').check();
  await page.getByTestId('transition-purpose').fill('What the practice and the Care Inspectorate hold about the home, for the section 4 inquiry.');
  await submitTransition(page);
  await expect(header).toContainText('Inquiry (s4)');

  // The investigation into the setting. The chair must be a senior officer of the council.
  await openTransition(page, 'asp-open-lsi');
  await expect(page.getByTestId('transition-dialog')).toContainText('This turns one adult\'s inquiry into an investigation into a setting');
  await page.getByTestId('transition-setting').fill('Portlennan Lodge');
  await page.getByTestId('transition-provider').fill('Portlennan Lodge Care Limited');
  await page.getByTestId('transition-service-type').selectOption('care-home');
  await page.getByTestId('transition-cs-number').fill('CS2026099828');
  await page.getByTestId('transition-agency-health').check();
  await page.getByTestId('transition-agency-regulator').check();
  await page.getByTestId('transition-ci-notified').check();
  await page.getByTestId('transition-commissioning').check();
  await page.getByTestId('transition-decision').fill('Investigation into the whole home. Health leads on medication, the regulator on the registration, social work on each resident.');
  await selectFirst(page, 'transition-chair');
  await expectNoAxeViolations(page);
  await capture(page, { phase: PHASE, screen: 'open-form' });

  // The seniority question is not decoration: the record refuses a chair who is not one.
  await page.getByTestId('transition-submit').click();
  await expect(page.getByRole('dialog')).toContainText('senior officer of the council');
  await page.getByTestId('transition-chair-senior').check();
  await submitTransition(page);
  // The investigation stage carries the Act's own name for it rather than the word investigation.
  await expect(header).toContainText('Inquiry using investigatory powers');
  await capture(page, { phase: PHASE, screen: 'opened' });

  // The adults inside it, each with their own concern and their own lead.
  await openTransition(page, 'asp-add-lsi-strand');
  await expect(page.getByTestId('transition-dialog')).toContainText('The return counts the investigation once and the adults in it separately');
  await page.getByTestId('transition-concern').fill('Doses signed for and not given on four evenings in August; a fall on 21 Aug.');
  await selectFirst(page, 'transition-subject');
  await capture(page, { phase: PHASE, screen: 'strand-form' });
  await submitTransition(page);
  await expect(page.getByTestId('process-grid')).toContainText('Portlennan Lodge');
});

test('a second investigation cannot be opened on a case that already has one, and a strand needs a named adult', async ({ page }) => {
  await signInAs(page, 'usr_moira_gilmour');
  await page.goto('/processes/prc_asp_whinbrae');
  await waitForData(page);

  // Whinbrae House already has one, so the transition that opens one is refused rather than hidden.
  const open = page.getByTestId('next-asp-open-lsi');
  await expect(open).toHaveAttribute('data-state', 'refused');
  await expect(open).toContainText('A Large Scale Investigation is already open on this case.');
  await capture(page, { phase: PHASE, screen: 'already-open' });

  // Adding an adult to the one that exists is open, and it refuses a strand with no adult named:
  // the return counts adults, so a strand about nobody would be a number with no person behind it.
  await expect(page.getByTestId('next-asp-add-lsi-strand')).toHaveAttribute('data-state', 'open');
  await openTransition(page, 'asp-add-lsi-strand');
  await page.getByTestId('transition-concern').fill('A further concern raised by the family at the review.');
  await page.getByTestId('transition-submit').click();
  await expect(page.getByRole('dialog')).toContainText('Choose the adult this strand is about.');
  await capture(page, { phase: PHASE, screen: 'strand-refused' });
});
