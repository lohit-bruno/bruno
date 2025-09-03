#!/usr/bin/env node

const path = require('node:path');
const {
  installOpenSSL,
  createCertsDir,
  generateCertificates,
  addCAToTruststore,
  verifyCertificates
} = require('./cert-helpers');

const {
  killProcessOnPort,
  createServer,
  setupGracefulShutdown,
  waitForServer
} = require('./server-helpers');

/**
 * Simple HTTPS server with automatic CA certificate setup
 */
(async () => {
  try {
    const certsDir = path.join(__dirname, 'certs');
    const port = 8090;

    console.log('starting CA certificates server setup');

    // Setup certificates
    console.log('installing openssl');
    installOpenSSL();

    console.log('creating certificates directory!');
    createCertsDir(certsDir);

    console.log('generating certificates!');
    generateCertificates(certsDir);

    console.log('verifying certificates!');
    verifyCertificates(certsDir);

    console.log('adding certificates to truststore!');
    addCAToTruststore(certsDir);

    // Start server
    killProcessOnPort(port);

    console.log(`starting server`);
    const server = await createServer(certsDir, port);
    
    // Test server
    await waitForServer(port, 5);

    console.log(`server is ready on port ${port}`);

    // Setup graceful shutdown
    setupGracefulShutdown(server, () => {
      console.log('cleaning up...');
    });

    // Keep alive
    process.stdin.resume();

  } catch (error) {
    console.error('\nserver setup failed!');
    console.error('error:', error.message);
    process.exit(1);
  }
})();