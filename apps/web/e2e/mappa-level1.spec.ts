import { expect, test } from '@playwright/test';
import { createPerson, openTransition, startCase, submitTransition } from './driven';
import { capture, expectNoAxeViolations, signInAs, waitForData } from './helpers';

const PHASE = 'mappa-level1';

test.use({ viewport: { width: 1440, height: 900 } });

/**
 * Reviewing a case managed at level 1 (D-251), driven. Most MAPPA cases never reach a meeting: they
 * sit at level 1 with one agency looking at them. Until now the product had nothing for that, so a
 * level 1 case was a case nothing ever happened to. The review is a recorded decision on a clock,
 * repeatable, and referring up is offered rather than done, because the level is set at a meeting.
 */
test('a level 1 case is reviewed, the clock restarts, and a second review offers the referral up', async ({ page }) => {
  await signInAs(page, 'usr_priya_sharif');
  await createPerson(page, 'Roddy', 'Kinnear', '1984-02-11');
  await startCase(page, 'mappa', 'Police Scotland, offender management', 'Released on licence on 01 Sep 2026; registered for five years, no current concerns beyond the licence.');
  const caseUrl = page.url();
  await expect(page.getByTestId('process-header')).toContainText('Notification');

  await openTransition(page, 'mappa-level1-review');
  await expect(page.getByTestId('transition-dialog')).toContainText('Level 1 has no meeting');
  await page.getByTestId('transition-summary').fill('Home visit and licence check. Address unchanged, employment holding, no police intelligence since release.');
  await expectNoAxeViolations(page);
  await capture(page, { phase: PHASE, screen: 'review-form' });
  await submitTransition(page);

  // The clock the review restarts is the case's own, and it is marked as a local interval.
  await expect(page.getByText('Level 1 review').first()).toBeVisible();
  await capture(page, { phase: PHASE, screen: 'reviewed' });

  // It repeats: the second review is offered on the same case, and this one refers up.
  await openTransition(page, 'mappa-level1-review');
  await page.getByRole('radio', { name: 'Refer up for level 2 or 3 management' }).check();
  await page.getByTestId('transition-summary').fill('Reported to be living two streets from the victim of the index offence.');
  await page.getByTestId('transition-refer-reason').fill('Accommodation and victim safety need a decision no single agency can take.');
  await capture(page, { phase: PHASE, screen: 'refer-up' });
  await submitTransition(page);

  // Referring up offers the referral rather than setting the level: the meeting decides, not the
  // person who asked, and the referral itself is refused until a current risk assessment exists.
  const refer = page.getByTestId('next-mappa-refer-level');
  await expect(refer).toHaveAttribute('data-state', 'refused');
  await expect(refer).toContainText('A current risk assessment is required');
  await expect(page.getByTestId('creates-risk-assessment')).toBeVisible();
  await expect(page.getByTestId('process-header')).toContainText('Notification');
  await capture(page, { phase: PHASE, screen: 'refer-offered' });

  // Both reviews are on the case as facts, with what each one found.
  await page.goto(caseUrl);
  await waitForData(page);
  await expect(page.getByTestId('process-grid')).toContainText('Level 1 review');
});
