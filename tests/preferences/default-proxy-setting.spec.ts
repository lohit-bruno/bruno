import { test, expect } from '../../playwright';

test('default app-level proxy must be set to `System Proxy`', async ({ pageWithUserData: page }) => {
  await page.getByRole('button', { name: 'Open Preferences' }).click();
  await page.getByRole('tab', { name: 'Proxy' }).click();
  await expect(page.getByRole('radio', { name: 'System Proxy' })).toBeChecked();
  await page.locator('[data-test-id="modal-close-button"]').click();
});
