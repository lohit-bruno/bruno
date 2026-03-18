import { test, expect } from '../../../../playwright';
import { setSandboxMode, selectEnvironment, runCollection, validateRunnerResults } from '../../../utils/page';

test.describe('App-level proxy disabled (collection inherits)', () => {
  test('all requests succeed without proxy', async ({ pageWithUserData: page }) => {
    test.setTimeout(2 * 60 * 1000);

    await setSandboxMode(page, 'app_level_proxy', 'developer');

    await selectEnvironment(page, 'prod');

    await runCollection(page, 'app_level_proxy');

    // 6 requests: http, https, http_example, https_example, https_client_cert, https_badssl_client_cert
    await validateRunnerResults(page, {
      totalRequests: 6,
      passed: 5,
      failed: 0
    });

    // Verify no proxy-related logs in timeline
    const firstRequestStatus = page.locator('.item-path .link').first();
    await firstRequestStatus.click();

    const timelineTab = page.locator('.tab.timeline');
    await timelineTab.click();

    const timelineItemHeader = page.locator('.timeline-item .oauth-request-item-header').first();
    await timelineItemHeader.click();

    const networkLogsTab = page.locator('.timeline-item-tab').filter({ hasText: 'Network Logs' });
    await networkLogsTab.click();

    const networkLogs = page.locator('.network-logs-container');
    await expect(networkLogs).not.toContainText('Using proxy:');
  });
});
