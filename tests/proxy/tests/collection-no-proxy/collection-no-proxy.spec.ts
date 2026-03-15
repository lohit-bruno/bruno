import { test, expect } from '../../../../playwright';
import { setSandboxMode, selectEnvironment, runCollection, validateRunnerResults } from '../../../utils/page';

test.describe('Collection-level proxy disabled', () => {
  test('all requests succeed without proxy', async ({ pageWithUserData: page }) => {
    test.setTimeout(2 * 60 * 1000);

    await setSandboxMode(page, 'collection_no_proxy', 'developer');

    await selectEnvironment(page, 'prod');

    await runCollection(page, 'collection_no_proxy');

    // 5 requests: http, https, http_example, https_example, https_badssl_client_cert
    await validateRunnerResults(page, {
      totalRequests: 5,
      passed: 5,
      failed: 0
    });

    // Verify no proxy-related logs in timeline for an HTTPS request
    // Click on the second request (https) status code
    const httpsRequestStatus = page.locator('.item-path .link').nth(1);
    await httpsRequestStatus.click();

    const timelineTab = page.locator('.tab.timeline');
    await timelineTab.click();

    const timelineItemHeader = page.locator('.timeline-item .oauth-request-item-header').first();
    await timelineItemHeader.click();

    const networkLogsTab = page.locator('.timeline-item-tab').filter({ hasText: 'Network Logs' });
    await networkLogsTab.click();

    // Verify "Using proxy:" does NOT appear in the network logs
    const networkLogs = page.locator('.network-logs-container');
    await expect(networkLogs).not.toContainText('Using proxy:');
  });
});
