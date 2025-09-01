import * as tls from 'node:tls';
import * as fs from 'node:fs';

type T_CACertSource = 'bundled' | 'system' | 'extra'

/**
 * retrieves default CA certificates from multiple sources using Node.js TLS API
 * 
 * this function aggregates CA certificates from three sources:
 * - 'bundled': mozilla CA certificates bundled with Node.js (same as tls.rootCertificates)
 * - 'system': CA certificates from the system's trusted certificate store  
 * - 'extra': additional CA certificates loaded from `NODE_EXTRA_CA_CERTS` environment variable
 * 
 * @returns {string[]} Array of PEM-encoded CA certificate strings
 * @see https://nodejs.org/docs/latest-v22.x/api/tls.html#tlsgetcacertificatestype
 */
const getCerts = (sources: T_CACertSource[] = ['bundled', 'system', 'extra']): string[] => {
  let certificates: string[] = [];

  // iterate through different certificate store types to build comprehensive CA list
  (sources).forEach(certType => {
    try {
      // get certificates from specific store type
      const certList = tls.getCACertificates(certType);

      if (certList && Array.isArray(certList)) {
        // filter out empty/invalid certificates to ensure we only include valid data
        const validCertificates = certList.filter(cert => cert && cert.trim());
        certificates.push(...validCertificates);
      }
    } catch (err) {
      console.warn(`Failed to load ${certType} CA certificates:`, (err as Error).message);
    }
  });

  return certificates;
};

const getCACertificates = ({ caCertFilePath, shouldKeepDefaultCerts = true }: { caCertFilePath: string, shouldKeepDefaultCerts: boolean }) => {
  // CA certificate configuration
  try {
    let caCertificates = [];

    // handle user-provided custom CA certificate file with optional default certificates
    if (caCertFilePath) {

      // validate custom CA certificate file
      if (caCertFilePath && fs.existsSync(caCertFilePath)) {
        try {
          const customCert = fs.readFileSync(caCertFilePath, 'utf8');
          if (customCert && customCert.trim()) {
            caCertificates.push(customCert.trim());
          }
        } catch (err) {
          console.error(`Failed to read custom CA certificate from ${caCertFilePath}:`, err.message);
          throw new Error(`Unable to load custom CA certificate: ${err.message}`);
        }
      }

      // optionally augment custom CA with default certificates
      if (shouldKeepDefaultCerts) {
        const defaultCertificates = getCerts(['bundled', 'system', 'extra']);
        if (defaultCertificates?.length > 0) {
          caCertificates.push(...defaultCertificates);
        }
      }
    } else {
      // use default CA certificates when no custom configuration is specified
      const defaultCertificates = getCerts(['bundled', 'system', 'extra']);
      if (defaultCertificates?.length > 0) {
        caCertificates.push(...defaultCertificates);
      }
    }

    return caCertificates;
  } catch (err) {
    console.error('Error configuring CA certificates:', err.message);
    throw err; // Re-throw certificate loading errors as they're critical
  }
}

export {
  getCACertificates
};