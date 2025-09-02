#!/bin/bash


#  Custom Certificate Authority Generator for Local Development
#  Windows Version (for Git Bash)
 
#  This script creates a custom Certificate Authority (CA) and generates 
#  localhost certificates for secure local development and testing.
#  The generated certificates are suitable for HTTPS connections to localhost
#  and can be used in development environments that require SSL/TLS.
 
#  Generated Files:
#  - ca-cert.pem: Root CA certificate (public, PEM format)
#  - ca-cert.cer: Root CA certificate (public, DER format for Windows)
#  - ca-key.pem: Root CA private key (sensitive)
#  - localhost-cert.pem: Localhost certificate signed by CA (public)
#  - localhost-key.pem: Localhost private key (sensitive)
#  - localhost.p12: Localhost certificate and key bundle (PKCS#12 format for Windows)
 
#  Security Notes:
#  - Private keys are set to 600 permissions (owner read/write only)
#  - Public certificates are set to 644 permissions (world readable)
#  - CA validity: 10 years, localhost certificate validity: 1 year
 
#  Requirements:
#  - Git Bash for Windows must be installed
#  - OpenSSL must be available in Git Bash PATH
#  - Write permissions to current directory
 
#  @example
#  ```bash
#  # Run the script in Git Bash to generate certificates
#  ./generate_certs_windows.sh
 
#  # Use the generated certificates in your application
#  # CA certificate (Windows): ./certs/ca-cert.cer
#  # CA certificate (PEM): ./certs/ca-cert.pem
#  # Server certificate bundle (Windows): ./certs/localhost.p12
#  # Server certificate (PEM): ./certs/localhost-cert.pem
#  # Server private key: ./certs/localhost-key.pem
#  ```

# Exit immediately if a command exits with a non-zero status
set -e

# Configuration constants
readonly CA_KEY_SIZE=4096
readonly SERVER_KEY_SIZE=4096
readonly CA_VALIDITY_DAYS=3650  # 10 years
readonly SERVER_VALIDITY_DAYS=365  # 1 year
readonly CERTS_DIR="./certs"

# Certificate subject information
readonly CA_SUBJECT="//C=US//ST=Dev//L=Local//O=Local Development CA//CN=Local Dev CA"
readonly SERVER_SUBJECT="//C=US//ST=Dev//L=Local//O=Local Development//CN=localhost"

echo "Generating Custom CA for Local Development (Windows)"
echo "=================================================="

# Verify OpenSSL installation and display version information
if ! command -v openssl &> /dev/null; then
    echo "ERROR: OpenSSL is not installed or not available in Git Bash PATH."
    echo "Please ensure you are running this script in Git Bash and OpenSSL is properly installed."
    echo "Installation instructions:"
    echo "1. Install Git for Windows (Git Bash) from https://git-scm.com/download/win"
    echo "2. OpenSSL should be included with Git Bash"
    exit 1
fi

echo "OpenSSL found: $(openssl version)"

# Clean up any existing certificates and create fresh directory
echo "Cleaning up existing certificates..."
rm -rf "${CERTS_DIR}"
mkdir -p "${CERTS_DIR}"
cd "${CERTS_DIR}"

echo "Working directory: $(pwd)"

# Step 1: Generate Certificate Authority (CA) private key
echo "Step 1: Generating CA private key (${CA_KEY_SIZE}-bit RSA)..."
openssl genrsa -out ca-key.pem "${CA_KEY_SIZE}"

# Step 2: Create self-signed CA certificate
echo "Step 2: Creating self-signed CA certificate (valid for ${CA_VALIDITY_DAYS} days)..."
openssl req -new -x509 \
    -key ca-key.pem \
    -out ca-cert.pem \
    -days "${CA_VALIDITY_DAYS}" \
    -subj "${CA_SUBJECT}"

echo "CA Certificate created: ca-cert.pem"
echo "CA Private Key created: ca-key.pem"

# Step 2a: Convert CA certificate to DER format for Windows Certificate Manager
echo "Step 2a: Converting CA certificate to DER format for Windows..."
openssl x509 -outform DER -in ca-cert.pem -out ca-cert.cer

echo "CA Certificate (Windows DER format) created: ca-cert.cer"

# Step 3: Generate server private key for localhost
echo "Step 3: Generating localhost private key (${SERVER_KEY_SIZE}-bit RSA)..."
openssl genrsa -out localhost-key.pem "${SERVER_KEY_SIZE}"

# Step 4: Create Certificate Signing Request (CSR) for localhost
echo "Step 4: Creating certificate signing request for localhost..."
openssl req -new \
    -key localhost-key.pem \
    -out localhost.csr \
    -subj "${SERVER_SUBJECT}"

# Step 5: Create extensions file for Subject Alternative Names (SAN)
echo "Step 5: Creating certificate extensions for multiple localhost variants..."
cat > localhost.ext << EOF
[v3_req]
authorityKeyIdentifier=keyid,issuer
basicConstraints=CA:FALSE
keyUsage = digitalSignature, nonRepudiation, keyEncipherment, dataEncipherment
subjectAltName = @alt_names

[alt_names]
DNS.1 = localhost
DNS.2 = *.localhost
DNS.3 = 127.0.0.1
IP.1 = 127.0.0.1
IP.2 = ::1
EOF

# Step 6: Generate localhost certificate signed by our CA
echo "Step 6: Generating localhost certificate signed by CA (valid for ${SERVER_VALIDITY_DAYS} days)..."
openssl x509 -req \
    -in localhost.csr \
    -CA ca-cert.pem \
    -CAkey ca-key.pem \
    -CAcreateserial \
    -out localhost-cert.pem \
    -days "${SERVER_VALIDITY_DAYS}" \
    -extensions v3_req \
    -extfile localhost.ext

echo "Localhost certificate created: localhost-cert.pem"

# Step 6a: Create PKCS#12 bundle for Windows Certificate Manager
echo "Step 6a: Creating PKCS#12 bundle for easy Windows import..."
openssl pkcs12 -export \
    -out localhost.p12 \
    -inkey localhost-key.pem \
    -in localhost-cert.pem \
    -certfile ca-cert.pem \
    -name "localhost" \
    -passout pass:

echo "PKCS#12 bundle created: localhost.p12 (no password)"

# Step 7: Set appropriate file permissions
# Note: Windows/Git Bash handles permissions differently, but we'll set them anyway
echo "Step 7: Setting file permissions..."
chmod 600 ca-key.pem localhost-key.pem localhost.p12
chmod 644 ca-cert.pem ca-cert.cer localhost-cert.pem

# Clean up temporary files
echo "Cleaning up temporary files..."
rm -f localhost.csr localhost.ext

echo ""
echo "Certificate generation completed successfully!"
echo "============================================="
echo "Generated files in ${CERTS_DIR}:"
echo "  ca-cert.pem        - Root CA certificate (PEM format)"
echo "  ca-cert.cer        - Root CA certificate (DER format for Windows)"
echo "  ca-key.pem         - Root CA private key"
echo "  localhost-cert.pem - Server certificate for localhost (PEM format)"
echo "  localhost-key.pem  - Server private key for localhost"
echo "  localhost.p12      - Server certificate bundle (PKCS#12 for Windows)"
echo ""
echo "RECOMMENDED: Installing certificates in Windows Certificate Manager:"
echo "=================================================================="
echo "1. Install CA Certificate:"
echo "   - Right-click ca-cert.cer and select 'Install Certificate'"
echo "   - Choose 'Local Machine' and click Next"
echo "   - Select 'Place all certificates in the following store'"
echo "   - Browse and select 'Trusted Root Certification Authorities'"
echo "   - Click Next and Finish"
echo ""
echo "2. Install Server Certificate (if needed for client authentication):"
echo "   - Double-click localhost.p12"
echo "   - Follow the Certificate Import Wizard"
echo "   - Leave password field empty (no password set)"
echo "   - Choose 'Personal' certificate store"
echo ""
echo "Alternative: Use PEM files directly in applications that support them."
echo ""