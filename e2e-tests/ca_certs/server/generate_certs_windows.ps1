<#
.SYNOPSIS
    Custom Certificate Authority Generator for Local Development - PowerShell Version

.DESCRIPTION
    This script creates a custom Certificate Authority (CA) and generates 
    localhost certificates for secure local development and testing.
    The generated certificates are suitable for HTTPS connections to localhost
    and can be used in development environments that require SSL/TLS.

.NOTES
    Generated Files:
    - ca-cert.pem: Root CA certificate (public, PEM format)
    - ca-cert.cer: Root CA certificate (public, DER format for Windows)
    - ca-key.pem: Root CA private key (sensitive)
    - localhost-cert.pem: Localhost certificate signed by CA (public)
    - localhost-key.pem: Localhost private key (sensitive)
    - localhost.p12: Localhost certificate and key bundle (PKCS#12 format for Windows)

    Security Notes:
    - Private keys are set to restricted permissions
    - Public certificates are set to readable permissions
    - CA validity: 10 years, localhost certificate validity: 1 year

    Requirements:
    - PowerShell 5.1 or later (Windows PowerShell or PowerShell Core)
    - OpenSSL must be available in PATH
    - Write permissions to current directory

.EXAMPLE
    .\generate_certs_windows.ps1
    
    Generates all certificate files in the ./certs directory
#>

[CmdletBinding()]
param()

# Configuration constants
$CA_KEY_SIZE = 4096
$SERVER_KEY_SIZE = 4096
$CA_VALIDITY_DAYS = 3650  # 10 years
$SERVER_VALIDITY_DAYS = 365  # 1 year
$CERTS_DIR = "./certs"

# Certificate subject information
$CA_SUBJECT = "/C=US/ST=Dev/L=Local/O=Local Development CA/CN=Local Dev CA"
$SERVER_SUBJECT = "/C=US/ST=Dev/L=Local/O=Local Development/CN=localhost"

Write-Host "Generating Custom CA for Local Development (PowerShell Core)" -ForegroundColor Green
Write-Host "================================================================"

# Set error handling
$ErrorActionPreference = "Stop"

# Verify OpenSSL installation and display version information
try {
    $opensslVersion = & openssl version 2>&1
    if ($LASTEXITCODE -ne 0) {
        throw "OpenSSL command failed"
    }
    Write-Host "OpenSSL found: $opensslVersion"
} catch {
    Write-Host "ERROR: OpenSSL is not installed or not available in PATH." -ForegroundColor Red
    Write-Host "Please ensure OpenSSL is properly installed and available in PATH." -ForegroundColor Red
    Write-Host "Installation options:" -ForegroundColor Yellow
    Write-Host "1. Install using Chocolatey: choco install openssl" -ForegroundColor Yellow
    Write-Host "2. Install Git for Windows (includes OpenSSL)" -ForegroundColor Yellow
    Write-Host "3. Download from https://slproweb.com/products/Win32OpenSSL.html" -ForegroundColor Yellow
    exit 1
}

# Clean up any existing certificates and create fresh directory
Write-Host "Cleaning up existing certificates..."
if (Test-Path $CERTS_DIR) {
    Remove-Item -Recurse -Force $CERTS_DIR
}
New-Item -ItemType Directory -Path $CERTS_DIR | Out-Null
Set-Location $CERTS_DIR

Write-Host "Working directory: $(Get-Location)"

# Step 1: Generate Certificate Authority (CA) private key
Write-Host "Step 1: Generating CA private key ($CA_KEY_SIZE-bit RSA)..."
& openssl genrsa -out ca-key.pem $CA_KEY_SIZE
if ($LASTEXITCODE -ne 0) {
    throw "Failed to generate CA private key"
}

# Step 2: Create self-signed CA certificate
Write-Host "Step 2: Creating self-signed CA certificate (valid for $CA_VALIDITY_DAYS days)..."
& openssl req -new -x509 -key ca-key.pem -out ca-cert.pem -days $CA_VALIDITY_DAYS -subj $CA_SUBJECT
if ($LASTEXITCODE -ne 0) {
    throw "Failed to create CA certificate"
}

Write-Host "CA Certificate created: ca-cert.pem"
Write-Host "CA Private Key created: ca-key.pem"

# Step 2a: Convert CA certificate to DER format for Windows Certificate Manager
Write-Host "Step 2a: Converting CA certificate to DER format for Windows..."
& openssl x509 -outform DER -in ca-cert.pem -out ca-cert.cer
if ($LASTEXITCODE -ne 0) {
    throw "Failed to convert CA certificate to DER format"
}

Write-Host "CA Certificate (Windows DER format) created: ca-cert.cer"

# Step 3: Generate server private key for localhost
Write-Host "Step 3: Generating localhost private key ($SERVER_KEY_SIZE-bit RSA)..."
& openssl genrsa -out localhost-key.pem $SERVER_KEY_SIZE
if ($LASTEXITCODE -ne 0) {
    throw "Failed to generate localhost private key"
}

# Step 4: Create Certificate Signing Request (CSR) for localhost
Write-Host "Step 4: Creating certificate signing request for localhost..."
& openssl req -new -key localhost-key.pem -out localhost.csr -subj $SERVER_SUBJECT
if ($LASTEXITCODE -ne 0) {
    throw "Failed to create certificate signing request"
}

# Step 5: Create extensions file for Subject Alternative Names (SAN)
Write-Host "Step 5: Creating certificate extensions for multiple localhost variants..."
$extensionsContent = @"
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
"@

$extensionsContent | Out-File -FilePath "localhost.ext" -Encoding ascii

# Step 6: Generate localhost certificate signed by our CA
Write-Host "Step 6: Generating localhost certificate signed by CA (valid for $SERVER_VALIDITY_DAYS days)..."
& openssl x509 -req -in localhost.csr -CA ca-cert.pem -CAkey ca-key.pem -CAcreateserial -out localhost-cert.pem -days $SERVER_VALIDITY_DAYS -extensions v3_req -extfile localhost.ext
if ($LASTEXITCODE -ne 0) {
    throw "Failed to generate localhost certificate"
}

Write-Host "Localhost certificate created: localhost-cert.pem"

# Step 6a: Create PKCS#12 bundle for Windows Certificate Manager
Write-Host "Step 6a: Creating PKCS#12 bundle for easy Windows import..."
& openssl pkcs12 -export -out localhost.p12 -inkey localhost-key.pem -in localhost-cert.pem -certfile ca-cert.pem -name "localhost" -passout pass:
if ($LASTEXITCODE -ne 0) {
    throw "Failed to create PKCS#12 bundle"
}

Write-Host "PKCS#12 bundle created: localhost.p12 (no password)"

# Step 7: Set appropriate file permissions (Windows equivalent)
Write-Host "Step 7: Setting file permissions..."
try {
    # Set restricted permissions on private keys and PKCS#12 bundle
    $privateFiles = @("ca-key.pem", "localhost-key.pem", "localhost.p12")
    foreach ($file in $privateFiles) {
        if (Test-Path $file) {
            $acl = Get-Acl $file
            $acl.SetAccessRuleProtection($true, $false)  # Disable inheritance
            $accessRule = New-Object System.Security.AccessControl.FileSystemAccessRule(
                [System.Security.Principal.WindowsIdentity]::GetCurrent().Name,
                "FullControl",
                "Allow"
            )
            $acl.SetAccessRule($accessRule)
            Set-Acl -Path $file -AclObject $acl
        }
    }
    
    # Ensure public certificates are readable
    $publicFiles = @("ca-cert.pem", "ca-cert.cer", "localhost-cert.pem")
    foreach ($file in $publicFiles) {
        if (Test-Path $file) {
            $acl = Get-Acl $file
            $accessRule = New-Object System.Security.AccessControl.FileSystemAccessRule(
                "Users",
                "ReadAndExecute",
                "Allow"
            )
            $acl.SetAccessRule($accessRule)
            Set-Acl -Path $file -AclObject $acl
        }
    }
} catch {
    Write-Warning "Could not set file permissions: $_"
    Write-Host "File permissions may need to be set manually for security"
}

# Clean up temporary files
Write-Host "Cleaning up temporary files..."
$tempFiles = @("localhost.csr", "localhost.ext")
foreach ($file in $tempFiles) {
    if (Test-Path $file) {
        Remove-Item $file -Force
    }
}

Write-Host ""
Write-Host "Certificate generation completed successfully!" -ForegroundColor Green
Write-Host "============================================="
Write-Host "Generated files in $CERTS_DIR:" -ForegroundColor Cyan
Write-Host "  ca-cert.pem        - Root CA certificate (PEM format)" -ForegroundColor White
Write-Host "  ca-cert.cer        - Root CA certificate (DER format for Windows)" -ForegroundColor White
Write-Host "  ca-key.pem         - Root CA private key" -ForegroundColor White
Write-Host "  localhost-cert.pem - Server certificate for localhost (PEM format)" -ForegroundColor White
Write-Host "  localhost-key.pem  - Server private key for localhost" -ForegroundColor White
Write-Host "  localhost.p12      - Server certificate bundle (PKCS#12 for Windows)" -ForegroundColor White
Write-Host ""
Write-Host "RECOMMENDED: Installing certificates in Windows Certificate Manager:" -ForegroundColor Yellow
Write-Host "=================================================================="
Write-Host "1. Install CA Certificate:" -ForegroundColor Yellow
Write-Host "   - Right-click ca-cert.cer and select 'Install Certificate'" -ForegroundColor Gray
Write-Host "   - Choose 'Local Machine' and click Next" -ForegroundColor Gray
Write-Host "   - Select 'Place all certificates in the following store'" -ForegroundColor Gray
Write-Host "   - Browse and select 'Trusted Root Certification Authorities'" -ForegroundColor Gray
Write-Host "   - Click Next and Finish" -ForegroundColor Gray
Write-Host ""
Write-Host "2. Install Server Certificate (if needed for client authentication):" -ForegroundColor Yellow
Write-Host "   - Double-click localhost.p12" -ForegroundColor Gray
Write-Host "   - Follow the Certificate Import Wizard" -ForegroundColor Gray
Write-Host "   - Leave password field empty (no password set)" -ForegroundColor Gray
Write-Host "   - Choose 'Personal' certificate store" -ForegroundColor Gray
Write-Host ""
Write-Host "Alternative: Use PEM files directly in applications that support them." -ForegroundColor Cyan
Write-Host ""

# Return to original directory
Set-Location ..
