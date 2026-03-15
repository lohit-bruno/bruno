import { test, expect } from '../../../../playwright';
import { setSandboxMode, selectEnvironment, runCollection, validateRunnerResults } from '../../../utils/page';

test.describe('App-level HTTPS proxy (collection inherits)', () => {
  test('all requests pass through inherited HTTPS proxy', async ({ pageWithUserData: page }) => {
    test.setTimeout(2 * 60 * 1000);

    await setSandboxMode(page, 'app_level_proxy', 'developer');

    await selectEnvironment(page, 'local');

    await runCollection(page, 'app_level_proxy');

    // 5 requests: http, https, http_example, https_example, https_badssl_client_cert
    await validateRunnerResults(page, {
      totalRequests: 5,
      passed: 5,
      failed: 0
    });

    // Verify proxy-related timeline logs — app-level HTTPS proxy should be inherited
    const firstRequestStatus = page.locator('.item-path .link').first();
    await firstRequestStatus.click();

    const timelineTab = page.locator('.tab.timeline');
    await timelineTab.click();

    const timelineItemHeader = page.locator('.timeline-item .oauth-request-item-header').first();
    await timelineItemHeader.click();

    const networkLogsTab = page.locator('.timeline-item-tab').filter({ hasText: 'Network Logs' });
    await networkLogsTab.click();

    const networkLogs = page.locator('.network-logs-container');
    await expect(networkLogs).toContainText('Using proxy:');
    await expect(networkLogs).toContainText('https://');
  });
});
