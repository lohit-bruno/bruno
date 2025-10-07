import { test, expect } from '../../playwright';

test('default ssl/tls verification option must be disabled', async ({ pageWithUserData: page }) => {
  await page.getByRole('button', { name: 'Open Preferences' }).click();
  await page.getByRole('tab', { name: 'General' }).click();
  await expect(page.getByRole('checkbox', { name: 'SSL/TLS Certificate' })).not.toBeChecked();
  await page.locator('[data-test-id="modal-close-button"]').click();
});
