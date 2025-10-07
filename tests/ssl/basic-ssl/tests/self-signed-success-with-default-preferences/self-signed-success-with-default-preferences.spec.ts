import { test, expect } from '../../../../../playwright';

test.describe.serial('self signed success with validation disabled', () => {
  test('developer mode', async ({ pageWithUserData: page }) => {
    // init dev mode
    await page.getByText('self-signed-badssl').click();
    await page.getByLabel('Developer Mode(use only if').check();
    await page.getByRole('button', { name: 'Save' }).click();

    // close collection settings tab
    await page.getByTestId('collection-settings-tab-close-button').click();

    await page.getByText('request', { exact: true }).click();

    // send the request
    await page.locator('#send-request').getByRole('img').nth(2).click();

    // wait for response
    await page.locator('[data-testid="response-status-code"]').waitFor({ state: 'visible', timeout: 2 * 60 * 1000 });
    await expect(page.locator('[data-testid="response-status-code"]')).toContainText('200');
  });

  test('safe mode', async ({ pageWithUserData: page }) => {
    // init safe mode
    await page.getByText('Developer Mode').click();
    await page.getByLabel('Safe Mode').check();
    await page.getByRole('button', { name: 'Save' }).click();

    // close security settings tab
    await page.getByTestId('security-settings-tab-close-button').click();

    await page.getByText('request', { exact: true }).nth(1).click();

    // send the request
    await page.locator('#send-request').getByRole('img').nth(2).click();

    // wait for response
    await page.locator('[data-testid="response-status-code"]').waitFor({ state: 'visible', timeout: 2 * 60 * 1000 });
    await expect(page.locator('[data-testid="response-status-code"]')).toContainText('200');
  });
});
