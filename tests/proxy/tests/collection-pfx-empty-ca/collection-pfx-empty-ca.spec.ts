import { test } from '../../../../playwright';
import { setSandboxMode, selectEnvironment, runCollection, validateRunnerResults } from '../../../utils/page';

test.describe('PFX client cert with empty CA and no default certs', () => {
  test('HTTPS requests with PFX succeed when ca resolves to empty', async ({ pageWithUserData: page }) => {
    // Expected: 4 pass, 2 fail
    //   - http, http_example: pass (no TLS)
    //   - https (local:8071): fails (self-signed cert not in Node root CAs — expected)
    //   - https_example: passes (public CA in Node root CAs, PFX not loaded for this domain)
    //   - https_client_cert (local:8072): fails (self-signed server cert not in Node root CAs)
    //   - https_badssl_client_cert (badssl.com): passes (valid public certificate)
    test.setTimeout(2 * 60 * 1000);

    await setSandboxMode(page, 'collection_with_http_proxy', 'developer');

    await selectEnvironment(page, 'prod');

    await runCollection(page, 'collection_with_http_proxy');

    await validateRunnerResults(page, {
      totalRequests: 6,
      passed: 4,
      failed: 2
    });
  });
});
