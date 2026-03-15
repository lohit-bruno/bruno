import { getCertsAndProxyConfig } from './http-https-agents';
import { getCACertificates } from './ca-cert';

jest.mock('./ca-cert');
const mockedGetCACertificates = getCACertificates as jest.MockedFunction<typeof getCACertificates>;

describe('getCertsAndProxyConfig', () => {
  beforeEach(() => {
    jest.resetAllMocks();
  });

  it('should not set ca to truthy empty array when caCertificates is empty string', () => {
    // When getCACertificates returns an empty string (no certs found),
    // ca must not become [] (truthy empty array). An empty array triggers
    // applySecureContext() in agent-cache, which — when a PFX client cert
    // is also present — creates a secureContext with an empty CA store
    // (no OpenSSL defaults), breaking server certificate verification.
    mockedGetCACertificates.mockReturnValue({
      caCertificates: '',
      caCertificatesCount: { system: 0, root: 0, custom: 0, extra: 0 }
    });

    const { certsConfig } = getCertsAndProxyConfig({
      collectionPath: '/tmp',
      options: {
        noproxy: false,
        shouldVerifyTls: true,
        shouldUseCustomCaCertificate: false,
        shouldKeepDefaultCaCertificates: true
      }
    });

    // Before fix: certsConfig.ca === [] (truthy), triggers applySecureContext
    // After fix:  certsConfig.ca === undefined (falsy), applySecureContext skipped
    expect(certsConfig.ca).toBeFalsy();
  });

  it('should set ca when caCertificates contains actual certificates', () => {
    const fakeCert = '-----BEGIN CERTIFICATE-----\ntest\n-----END CERTIFICATE-----';
    mockedGetCACertificates.mockReturnValue({
      caCertificates: fakeCert,
      caCertificatesCount: { system: 1, root: 0, custom: 0, extra: 0 }
    });

    const { certsConfig } = getCertsAndProxyConfig({
      collectionPath: '/tmp',
      options: {
        noproxy: false,
        shouldVerifyTls: true,
        shouldUseCustomCaCertificate: false,
        shouldKeepDefaultCaCertificates: true
      }
    });

    expect(certsConfig.ca).toBe(fakeCert);
  });

  it('should not set ca when SSL verification is disabled', () => {
    const { certsConfig } = getCertsAndProxyConfig({
      collectionPath: '/tmp',
      options: {
        noproxy: false,
        shouldVerifyTls: false,
        shouldUseCustomCaCertificate: false,
        shouldKeepDefaultCaCertificates: true
      }
    });

    // ca should never be set when TLS verification is off
    expect(certsConfig.ca).toBeUndefined();
    // getCACertificates should not even be called
    expect(mockedGetCACertificates).not.toHaveBeenCalled();
  });
});
