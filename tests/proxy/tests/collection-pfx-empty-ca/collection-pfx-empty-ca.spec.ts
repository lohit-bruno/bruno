import { test } from '../../../../playwright';
import { setSandboxMode, selectEnvironment, runCollection, validateRunnerResults } from '../../../utils/page';

test.describe('PFX client cert with empty CA and no default certs', () => {
  test('HTTPS requests with PFX succeed when ca resolves to empty', async ({ pageWithUserData: page }) => {
    // This test verifies the fix for the ca=[] bug in cert-utils.js / http-https-agents.ts.
    //
    // Setup: sslVerification=true, customCaCert=empty file, keepDefaultCerts=false
    // This makes getCACertificates return caCertificates='' (empty string).
    //
    // Before fix: ca = '' || [] → [] (truthy empty array).
    //   With PFX present, applySecureContext calls tls.createSecureContext({ pfx })
    //   which starts with an EMPTY CA store (no OpenSSL defaults), then iterates
    //   the empty ca array adding nothing. rejectUnauthorized=true → server cert
    //   verification fails because no CAs are trusted.
    //
    // After fix: ca = '' || undefined → undefined (falsy).
    //   applySecureContext is skipped entirely. The agent receives the raw pfx option
    //   and Node.js uses its default tls.rootCertificates for server verification.
    //
    // Uses collection_with_http_proxy which has 5 requests:
    //   http, https (local), http_example, https_example, https_badssl_client_cert (local)
    //
    // Expected: 3 pass, 2 fail
    //   - http, http_example: pass (no TLS)
    //   - https (local:8071): fails (self-signed cert not in Node root CAs — expected)
    //   - https_example: passes (public CA in Node root CAs, PFX not loaded for this domain)
    //   - https_badssl_client_cert (local:8072): fails (self-signed server cert not in Node root CAs)
    test.setTimeout(2 * 60 * 1000);

    await setSandboxMode(page, 'collection_with_http_proxy', 'developer');

    await selectEnvironment(page, 'local');

    await runCollection(page, 'collection_with_http_proxy');

    await validateRunnerResults(page, {
      totalRequests: 5,
      passed: 3,
      failed: 2
    });
  });
});
