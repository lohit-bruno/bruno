import { test, expect } from '../../../../playwright';
import { setSandboxMode, selectEnvironment, runCollection, validateRunnerResults } from '../../../utils/page';

test.describe('Collection-level HTTP proxy', () => {
  test('all requests pass through HTTP proxy', async ({ pageWithUserData: page }) => {
    test.setTimeout(2 * 60 * 1000);

    await setSandboxMode(page, 'collection_with_http_proxy', 'developer');

    await selectEnvironment(page, 'prod');

    await runCollection(page, 'collection_with_http_proxy');

    // 5 requests: http, https, http_example, https_example, https_badssl_client_cert
    await validateRunnerResults(page, {
      totalRequests: 5,
      passed: 5,
      failed: 0
    });

    // Verify proxy-related timeline logs for a proxied request
    // Click on first request's status code to open response pane
    const firstRequestStatus = page.locator('.item-path .link').first();
    await firstRequestStatus.click();

    // Switch to Timeline tab in the runner response pane
    const timelineTab = page.locator('.tab.timeline');
    await timelineTab.click();

    // Expand the timeline item to see its details
    const timelineItemHeader = page.locator('.timeline-item .oauth-request-item-header').first();
    await timelineItemHeader.click();

    // Click the "Network Logs" tab within the timeline item
    const networkLogsTab = page.locator('.timeline-item-tab').filter({ hasText: 'Network Logs' });
    await networkLogsTab.click();

    // Verify "Using proxy:" appears in the network logs
    const networkLogs = page.locator('.network-logs-container');
    await expect(networkLogs).toContainText('Using proxy:');
    await expect(networkLogs).toContainText('http://');
  });
});
