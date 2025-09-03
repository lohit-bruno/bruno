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

function execCommandSilent(command, cwd = process.cwd()) {
  return execSync(command, { 
    cwd, 
    stdio: 'pipe',
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
  
  // Check if OpenSSL is already available
  try {
    execCommand('openssl version');
    return; // OpenSSL is already installed, no need to install
  } catch (error) {
    // OpenSSL not found, proceed with installation
  }
  
  try {
    switch (platform) {
      case 'macos':
        execCommand('brew install openssl');
        break;
      case 'linux':
        execCommand('sudo apt-get update && sudo apt-get install -y openssl || sudo yum install -y openssl || sudo dnf install -y openssl');
        break;
      case 'windows':
        try {
          // Try chocolatey first (silent to avoid error output)
          execCommandSilent('choco install openssl -y');
        } catch (error1) {
          try {
            // Try winget as fallback
            execCommandSilent('winget install ShiningLight.OpenSSL');
          } catch (error2) {
            throw new Error('openssl installation failed: neither chocolatey nor winget found. please install openssl manually and try again.');
          }
        }
        break;
    }
  } catch (error) {
    throw new Error('failed to install openssl. please install manually and try again.');
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
keyUsage = critical, keyEncipherment, dataEncipherment, digitalSignature
extendedKeyUsage = serverAuth
subjectAltName = @alt_names
basicConstraints = critical, CA:FALSE
authorityKeyIdentifier = keyid,issuer:always

[alt_names]
DNS.1 = localhost
DNS.2 = *.localhost  
DNS.3 = localhost.localdomain
IP.1 = 127.0.0.1
IP.2 = ::1`;
  
  fs.writeFileSync(path.join(certsDir, 'localhost.ext'), extensionsContent);
  
  // Generate server certificate
  execCommand('openssl x509 -req -in localhost.csr -CA ca-cert.pem -CAkey ca-key.pem -CAcreateserial -out localhost-cert.pem -days 365 -extensions v3_req -extfile localhost.ext', certsDir);
  
  // Generate Windows-specific formats
  const platform = detectPlatform();
  if (platform === 'windows') {
    // Convert CA certificate to DER format for Windows truststore
    execCommand('openssl x509 -in ca-cert.pem -outform DER -out ca-cert.der', certsDir);
    
    // Create P12 bundle for server certificate (includes both cert and key)
    execCommand('openssl pkcs12 -export -out localhost.p12 -inkey localhost-key.pem -in localhost-cert.pem -certfile ca-cert.pem -password pass:', certsDir);
    
    // Convert server cert to DER as well
    execCommand('openssl x509 -in localhost-cert.pem -outform DER -out localhost-cert.der', certsDir);
  }
  
  // Set permissions
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

function addCAToTruststore(certsDir) {
  const platform = detectPlatform();
  
  switch (platform) {
    case 'macos':
      const macCertPath = path.join(certsDir, 'ca-cert.pem');
      execCommand(`sudo security add-trusted-cert -d -r trustRoot -k /Library/Keychains/System.keychain "${macCertPath}"`);
      break;
    case 'linux':
      const linuxCertPath = path.join(certsDir, 'ca-cert.pem');
      execCommand(`sudo cp "${linuxCertPath}" /usr/local/share/ca-certificates/bruno-ca.crt`);
      execCommand('sudo update-ca-certificates');
      break;
    case 'windows':
      // Use DER format for Windows
      const winCertPath = path.join(certsDir, 'ca-cert.der');
      try {
        // Try current user store first (no admin required)
        execCommand(`powershell -Command "Import-Certificate -FilePath '${winCertPath}' -CertStoreLocation Cert:\\CurrentUser\\Root"`);
      } catch (error) {
        try {
          // Fallback: try certutil for current user
          execCommand(`certutil -user -addstore -f "Root" "${winCertPath}"`);
        } catch (error2) {
          // Last resort: try system-wide (requires admin) - will throw if fails
          execCommand(`certutil -addstore -f "Root" "${winCertPath}"`);
        }
      }
      break;
  }
}

function verifyCertificates(certsDir) {
  const platform = detectPlatform();
  const requiredFiles = ['ca-cert.pem', 'ca-key.pem', 'localhost-cert.pem', 'localhost-key.pem'];
  
  // Add Windows-specific files
  if (platform === 'windows') {
    requiredFiles.push('ca-cert.der', 'localhost.p12', 'localhost-cert.der');
  }
  
  for (const file of requiredFiles) {
    const filePath = path.join(certsDir, file);
    if (!fs.existsSync(filePath)) {
      throw new Error(`missing certificate file: ${file}`);
    }
  }
}

function getServerCertificateOptions(certsDir) {
  const platform = detectPlatform();
  
  if (platform === 'windows') {
    // Use P12 format for Windows (contains both cert and key)
    const p12Path = path.join(certsDir, 'localhost.p12');
    const p12Content = fs.readFileSync(p12Path);
    
    return {
      pfx: p12Content,
      passphrase: '' // empty password as set during creation
    };
  } else {
    // Use PEM format for macOS and Linux
    return {
      key: fs.readFileSync(path.join(certsDir, 'localhost-key.pem')),
      cert: fs.readFileSync(path.join(certsDir, 'localhost-cert.pem'))
    };
  }
}

module.exports = {
  installOpenSSL,
  createCertsDir,
  generateCertificates,
  addCAToTruststore,
  verifyCertificates,
  getServerCertificateOptions,
  detectPlatform,
  execCommand,
  execCommandSilent
};

