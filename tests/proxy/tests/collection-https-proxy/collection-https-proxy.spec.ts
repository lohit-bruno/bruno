import { test, expect } from '../../../../playwright';
import { setSandboxMode, selectEnvironment, runCollection, validateRunnerResults } from '../../../utils/page';

test.describe('Collection-level HTTPS proxy', () => {
  test('all requests pass through HTTPS proxy', async ({ pageWithUserData: page }) => {
    test.setTimeout(2 * 60 * 1000);

    await setSandboxMode(page, 'collection_with_https_proxy', 'developer');

    await selectEnvironment(page, 'prod');

    await runCollection(page, 'collection_with_https_proxy');

    // 6 requests: http, https, http_example, https_example, https_client_cert, https_badssl_client_cert
    await validateRunnerResults(page, {
      totalRequests: 6,
      passed: 5,
      failed: 0
    });

    // Verify proxy-related timeline logs for a proxied request
    const firstRequestStatus = page.locator('.item-path .link').first();
    await firstRequestStatus.click();

    const timelineTab = page.locator('.tab.timeline');
    await timelineTab.click();

    const timelineItemHeader = page.locator('.timeline-item .oauth-request-item-header').first();
    await timelineItemHeader.click();

    const networkLogsTab = page.locator('.timeline-item-tab').filter({ hasText: 'Network Logs' });
    await networkLogsTab.click();

    // Verify "Using proxy:" with https protocol appears in the network logs
    const networkLogs = page.locator('.network-logs-container');
    await expect(networkLogs).toContainText('Using proxy:');
    await expect(networkLogs).toContainText('https://');
  });
});
