import { expect, test } from '@playwright/test';
import { capture, expectNoAxeViolations, signInAs, switchUser, waitForData } from './helpers';

const PHASE = 'transfer';

test.use({ viewport: { width: 1440, height: 900 } });

/**
 * Transferring a case to another authority (D-248), driven. Adult support and protection, child
 * protection and adults with incapacity each gained the transfer that MARAC and MAPPA already had.
 * The case stops here: the stage becomes Transferred, the clocks complete, the record says where it
 * went and to whom, and the case leaves the worklists.
 */
test('an adult protection case leaves for another authority, its clocks stop, and the record says where it went', async ({ page }) => {
  await signInAs(page, 'usr_moira_gilmour');
  await page.goto('/processes/prc_asp_marion');
  await waitForData(page);
  await page.getByTestId('next-asp-transfer-button').click();
  await expect(page.getByTestId('transition-route')).toContainText('Moves the case to Transferred');
  await expect(page.getByTestId('transition-dialog')).toContainText('Everything on this case stops here');
  await expect(page.getByTestId('transition-dialog')).toContainText('Nothing is sent from here');
  await expectNoAxeViolations(page);
  await capture(page, { phase: PHASE, screen: 'transfer-dialog' });

  await page.getByTestId('transition-submit').click();
  await expect(page.getByRole('dialog')).toContainText('Name the receiving area');
  await page.getByTestId('transition-area').fill('Lochbrae Council');
  await page.getByTestId('transition-coordinator').fill('Iain Rae, council officer, adult protection');
  await page.getByTestId('transition-submit').click();
  await expect(page.getByText('Transfer to another authority recorded').last()).toBeVisible();

  await expect(page.locator('[aria-current="step"]')).toContainText('Transferred');
  await expect(page.getByTestId('process-header')).toContainText('Transferred');
  await capture(page, { phase: PHASE, screen: 'transferred' });

  // The chronology says where it went and who has it.
  await page.goto('/people/per_marion_fraser/chronology');
  await waitForData(page);
  await expect(page.getByRole('row').filter({ hasText: 'Transfer to another authority' }).first()).toBeVisible();
  await expect(page.locator('[title*="Lochbrae Council"]').first()).toBeVisible();

  // The ledger keeps it as a stage move naming the receiving authority.
  await page.goto('/audit');
  await waitForData(page);
  await expect(page.getByRole('row').filter({ hasText: 'Lochbrae Council' }).first()).toContainText('Stage moved');
});

test('child protection and adults with incapacity transfer the same way, and a transferred case offers nothing further', async ({ page }) => {
  await signInAs(page, 'usr_janet_kerr');
  await page.goto('/processes/prc_cp_aiden');
  await waitForData(page);
  await page.getByTestId('next-cp-transfer-button').click();
  await page.getByTestId('transition-area').fill('Lochbrae Council');
  await page.getByTestId('transition-coordinator').fill('A Team Leader, children and families');
  await page.getByTestId('transition-submit').click();
  await expect(page.getByText('Transfer to another authority recorded').last()).toBeVisible();
  await expect(page.locator('[aria-current="step"]')).toContainText('Transferred');
  // Nothing else is offered on a case that has left: no further decisions, and no second transfer.
  await expect(page.getByTestId('next-cp-transfer-button')).toHaveCount(0);
  await expect(page.getByTestId('next-cp-deregister-button')).toHaveCount(0);

  await switchUser(page, 'usr_graeme_dunlop');
  await page.goto('/processes/prc_awi_ishbel');
  await waitForData(page);
  await page.getByTestId('next-awi-transfer-button').click();
  await page.getByTestId('transition-area').fill('Lochbrae Council');
  await page.getByTestId('transition-coordinator').fill('A Mental Health Officer');
  await page.getByTestId('transition-submit').click();
  await expect(page.getByText('Transfer to another authority recorded').last()).toBeVisible();
  await expect(page.locator('[aria-current="step"]')).toContainText('Transferred');
});
