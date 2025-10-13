import { test, expect } from '../../../playwright';

test.describe.serial('should use system proxy', () => {
  test('check if the app-level proxy is set to `System Proxy`', async ({ pageWithUserData: page }) => {
    // check if the app-level proxy is set to `System Proxy`
    await page.getByRole('button', { name: 'Open Preferences' }).click();
    await page.getByRole('tab', { name: 'Proxy' }).click();
    await expect(page.getByRole('radio', { name: 'System Proxy' })).toBeChecked();
    await page.locator('[data-test-id="modal-close-button"]').click();
  });

  test('developer mode', async ({ pageWithUserData: page }) => {
    // init dev mode
    await page.getByText('system-proxy-test').click();
    await page.getByLabel('Developer Mode(use only if').check();
    await page.getByRole('button', { name: 'Save' }).click();

    // close collection settings tab
    await page.getByTestId('collection-settings-tab-close-button').click();

    // check if the collection-level proxy is set to `on`
    await page.getByTitle('system-proxy-test').click();
    await page.getByRole('tab', { name: 'Proxy' }).click();
    await expect(page.getByRole('radio', { name: 'Global' })).toBeChecked();

    await page.getByText('test-request').click();

    // send the request
    await page.locator('#send-request').getByRole('img').nth(2).click();

    // wait for response
    await page.locator('[data-testid="response-status-code"]').waitFor({ state: 'visible', timeout: 2 * 60 * 1000 });

    await page.locator('[data-testid="response-headers-tab"]').click();

    // check the response headers
    await expect(page.getByRole('cell', { name: 'X-Bruno-Proxy-System' })).toBeVisible();
  });

  test('safe mode', async ({ pageWithUserData: page }) => {
    // init safe mode
    await page.getByText('Developer Mode').click();
    await page.getByLabel('Safe Mode').check();
    await page.getByRole('button', { name: 'Save' }).click();

    // close security settings tab
    await page.getByTestId('security-settings-tab-close-button').click();

    // check if the collection-level proxy is set to `on`
    await page.getByTitle('system-proxy-test').click();
    await page.getByRole('tab', { name: 'Proxy' }).click();
    await expect(page.getByRole('radio', { name: 'Global' })).toBeChecked();

    await page.getByText('test-request').nth(1).click();

    // send the request
    await page.locator('#send-request').getByRole('img').nth(2).click();

    // wait for response
    await page.locator('[data-testid="response-status-code"]').waitFor({ state: 'visible', timeout: 2 * 60 * 1000 });

    await page.locator('[data-testid="response-headers-tab"]').click();

    // check the response headers
    await expect(page.getByRole('cell', { name: 'X-Bruno-Proxy-System' })).toBeVisible();
  });
});
