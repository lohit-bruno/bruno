#!/bin/bash

# Custom CA Generator for Local Development
# This script creates a custom Certificate Authority and generates localhost certificates

set -e

echo "🔐 Generating Custom CA for Local Development"
echo "=============================================="

# Ensure we have OpenSSL available
if ! command -v openssl &> /dev/null; then
    echo "❌ OpenSSL is not installed. Please install OpenSSL to continue."
    exit 1
fi

echo "✅ OpenSSL found: $(openssl version)"

# Create directory for certificates if it doesn't exist
mkdir -p ./certs
cd ./certs

echo "📁 Working directory: $(pwd)"

# 1. Generate CA private key
echo "🔑 Generating CA private key..."
openssl genrsa -out ca-key.pem 4096

# 2. Create CA certificate
echo "📜 Creating CA certificate..."
openssl req -new -x509 -key ca-key.pem -out ca-cert.pem -days 3650 \
    -subj "/C=US/ST=Dev/L=Local/O=Local Development CA/CN=Local Dev CA"

echo "✅ CA Certificate created: ca-cert.pem"
echo "🔐 CA Private Key created: ca-key.pem"

# 3. Generate server private key for localhost
echo "🔑 Generating localhost private key..."
openssl genrsa -out localhost-key.pem 4096

# 4. Create certificate signing request for localhost
echo "📝 Creating certificate signing request..."
openssl req -new -key localhost-key.pem -out localhost.csr \
    -subj "/C=US/ST=Dev/L=Local/O=Local Development/CN=localhost"

# 5. Create extensions file for Subject Alternative Names
echo "📋 Creating certificate extensions..."
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

# 6. Generate localhost certificate signed by our CA
echo "🏠 Generating localhost certificate..."
openssl x509 -req -in localhost.csr -CA ca-cert.pem -CAkey ca-key.pem \
    -CAcreateserial -out localhost-cert.pem -days 365 \
    -extensions v3_req -extfile localhost.ext

# 7. Set proper permissions
chmod 600 ca-key.pem localhost-key.pem
chmod 644 ca-cert.pem localhost-cert.pem

# Clean up temporary files
rm localhost.csr localhost.ext