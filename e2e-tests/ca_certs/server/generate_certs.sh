#!/bin/bash


#  Custom Certificate Authority Generator for Local Development
 
#  This script creates a custom Certificate Authority (CA) and generates 
#  localhost certificates for secure local development and testing.
#  The generated certificates are suitable for HTTPS connections to localhost
#  and can be used in development environments that require SSL/TLS.
 
#  Generated Files:
#  - ca-cert.pem: Root CA certificate (public)
#  - ca-key.pem: Root CA private key (sensitive)
#  - localhost-cert.pem: Localhost certificate signed by CA (public)
#  - localhost-key.pem: Localhost private key (sensitive)
 
#  Security Notes:
#  - Private keys are set to 600 permissions (owner read/write only)
#  - Public certificates are set to 644 permissions (world readable)
#  - CA validity: 10 years, localhost certificate validity: 1 year
 
#  Requirements:
#  - OpenSSL must be installed and available in PATH
#  - Write permissions to current directory
 
#  @example
#  ```bash
#  # Run the script to generate certificates
#  ./generate_certs.sh
 
#  # Use the generated certificates in your application
#  # CA certificate: ./certs/ca-cert.pem
#  # Server certificate: ./certs/localhost-cert.pem
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
readonly CA_SUBJECT="/C=US/ST=Dev/L=Local/O=Local Development CA/CN=Local Dev CA"
readonly SERVER_SUBJECT="/C=US/ST=Dev/L=Local/O=Local Development/CN=localhost"

echo "Generating Custom CA for Local Development"
echo "=========================================="

# Verify OpenSSL installation and display version information
if ! command -v openssl &> /dev/null; then
    echo "ERROR: OpenSSL is not installed. Please install OpenSSL to continue."
    echo "Installation instructions:"
    echo "  macOS: brew install openssl"
    echo "  Ubuntu/Debian: sudo apt-get install openssl"
    echo "  CentOS/RHEL: sudo yum install openssl"
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
# This key will be used to sign other certificates
echo "Step 1: Generating CA private key (${CA_KEY_SIZE}-bit RSA)..."
openssl genrsa -out ca-key.pem "${CA_KEY_SIZE}"

# Step 2: Create self-signed CA certificate
# This certificate will act as the root of trust for our local development
echo "Step 2: Creating self-signed CA certificate (valid for ${CA_VALIDITY_DAYS} days)..."
openssl req -new -x509 \
    -key ca-key.pem \
    -out ca-cert.pem \
    -days "${CA_VALIDITY_DAYS}" \
    -subj "${CA_SUBJECT}"

echo "CA Certificate created: ca-cert.pem"
echo "CA Private Key created: ca-key.pem"

# Step 3: Generate server private key for localhost
# This key will be used by the local development server
echo "Step 3: Generating localhost private key (${SERVER_KEY_SIZE}-bit RSA)..."
openssl genrsa -out localhost-key.pem "${SERVER_KEY_SIZE}"

# Step 4: Create Certificate Signing Request (CSR) for localhost
# The CSR contains the public key and identifying information
echo "Step 4: Creating certificate signing request for localhost..."
openssl req -new \
    -key localhost-key.pem \
    -out localhost.csr \
    -subj "${SERVER_SUBJECT}"

# Step 5: Create extensions file for Subject Alternative Names (SAN)
# SAN allows the certificate to be valid for multiple hostnames and IP addresses
echo "Step 5: Creating certificate extensions for multiple localhost variants..."
cat > localhost.ext << EOF
# X.509 v3 Certificate Extensions for Localhost Development
# These extensions ensure the certificate works with various localhost configurations

[v3_req]
# Authority key identifier links this cert to the signing CA
authorityKeyIdentifier=keyid,issuer

# This is not a CA certificate, it's an end-entity certificate
basicConstraints=CA:FALSE

# Define the purposes this certificate can be used for
keyUsage = digitalSignature, nonRepudiation, keyEncipherment, dataEncipherment

# Subject Alternative Names - critical for modern browsers
subjectAltName = @alt_names

[alt_names]
# DNS names this certificate is valid for
DNS.1 = localhost
DNS.2 = *.localhost
DNS.3 = 127.0.0.1

# IP addresses this certificate is valid for
IP.1 = 127.0.0.1    # IPv4 localhost
IP.2 = ::1           # IPv6 localhost
EOF

# Step 6: Generate localhost certificate signed by our CA
# This creates a certificate that browsers will trust if they trust our CA
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

# Step 7: Set appropriate file permissions for security
# Private keys should only be readable by the owner
# Public certificates can be world-readable
echo "Step 7: Setting secure file permissions..."
chmod 600 ca-key.pem localhost-key.pem      # Private keys: owner read/write only
chmod 644 ca-cert.pem localhost-cert.pem    # Public certs: world readable

# Clean up temporary files that are no longer needed
echo "Cleaning up temporary files..."
rm localhost.csr localhost.ext

echo ""
echo "Certificate generation completed successfully!"
echo "============================================="
echo "Generated files in ${CERTS_DIR}:"
echo "  ca-cert.pem      - Root CA certificate (install in browser/system trust store)"
echo "  ca-key.pem       - Root CA private key"
echo "  localhost-cert.pem - Server certificate for localhost"
echo "  localhost-key.pem  - Server private key for localhost"
echo ""