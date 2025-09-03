const { execSync } = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');

/**
 * Simple certificate helper functions
 */

function execCommand(command, cwd = process.cwd()) {
  return execSync(command, { 
    cwd, 
    stdio: 'inherit',
    timeout: 30000 
  });
}

function detectPlatform() {
  const platform = os.platform();
  switch (platform) {
    case 'darwin': return 'macos';
    case 'linux': return 'linux';
    case 'win32': return 'windows';
    default: throw new Error(`Unsupported platform: ${platform}`);
  }
}

function installOpenSSL() {
  const platform = detectPlatform();
  
  try {
    switch (platform) {
      case 'macos':
        execCommand('brew install openssl');
        break;
      case 'linux':
        execCommand('sudo apt-get update && sudo apt-get install -y openssl || sudo yum install -y openssl || sudo dnf install -y openssl');
        break;
      case 'windows':
        execCommand('choco install openssl -y || winget install OpenSSL.Light');
        break;
    }
  } catch (error) {
    console.warn('could not install openssl automatically. please install manually.');
  }
}

function createCertsDir(certsDir) {
  if (fs.existsSync(certsDir)) {
    // Clean up existing certificates
    const certFiles = ['ca-cert.pem', 'ca-key.pem', 'localhost-cert.pem', 'localhost-key.pem'];
    certFiles.forEach(file => {
      const filePath = path.join(certsDir, file);
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
      }
    });
  } else {
    fs.mkdirSync(certsDir, { recursive: true });
  }
}

function generateCertificates(certsDir) {
  const CA_SUBJECT = '/C=US/ST=Dev/L=Local/O=Local Development CA/CN=Local Dev CA';
  const SERVER_SUBJECT = '/C=US/ST=Dev/L=Local/O=Local Development/CN=localhost';
  
  // Generate CA private key
  execCommand('openssl genrsa -out ca-key.pem 4096', certsDir);
  
  // Generate CA certificate
  execCommand(`openssl req -new -x509 -key ca-key.pem -out ca-cert.pem -days 3650 -subj "${CA_SUBJECT}"`, certsDir);
  
  // Generate server private key
  execCommand('openssl genrsa -out localhost-key.pem 4096', certsDir);
  
  // Generate server certificate request
  execCommand(`openssl req -new -key localhost-key.pem -out localhost.csr -subj "${SERVER_SUBJECT}"`, certsDir);
  
  // Create extensions file
  const extensionsContent = `[v3_req]
keyUsage = keyEncipherment, dataEncipherment
extendedKeyUsage = serverAuth
subjectAltName = @alt_names

[alt_names]
DNS.1 = localhost
DNS.2 = *.localhost
IP.1 = 127.0.0.1
IP.2 = ::1`;
  
  fs.writeFileSync(path.join(certsDir, 'localhost.ext'), extensionsContent);
  
  // Generate server certificate
  execCommand('openssl x509 -req -in localhost.csr -CA ca-cert.pem -CAkey ca-key.pem -CAcreateserial -out localhost-cert.pem -days 365 -extensions v3_req -extfile localhost.ext', certsDir);
  
  // Set permissions
  const platform = detectPlatform();
  if (platform !== 'windows') {
    execCommand('chmod 600 ca-key.pem localhost-key.pem', certsDir);
    execCommand('chmod 644 ca-cert.pem localhost-cert.pem', certsDir);
  }
  
  // Clean up
  ['localhost.csr', 'localhost.ext', 'ca-cert.srl'].forEach(file => {
    const filePath = path.join(certsDir, file);
    if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
  });
}

function addCAToTruststore(caCertPath) {
  const platform = detectPlatform();
  
  try {
    switch (platform) {
      case 'macos':
        execCommand(`sudo security add-trusted-cert -d -r trustRoot -k /Library/Keychains/System.keychain "${caCertPath}"`);
        break;
      case 'linux':
        execCommand(`sudo cp "${caCertPath}" /usr/local/share/ca-certificates/bruno-ca.crt`);
        execCommand('sudo update-ca-certificates');
        break;
      case 'windows':
        execCommand(`certlm.exe -addstore -f "Root" "${caCertPath}"`);
        break;
    }
  } catch (error) {
    console.warn('could not add ca to system truststore (optional)');
  }
}

function verifyCertificates(certsDir) {
  const requiredFiles = ['ca-cert.pem', 'ca-key.pem', 'localhost-cert.pem', 'localhost-key.pem'];
  
  for (const file of requiredFiles) {
    const filePath = path.join(certsDir, file);
    if (!fs.existsSync(filePath)) {
      throw new Error(`missing certificate file: ${file}`);
    }
  }
}

module.exports = {
  installOpenSSL,
  createCertsDir,
  generateCertificates,
  addCAToTruststore,
  verifyCertificates,
  detectPlatform,
  execCommand
};

