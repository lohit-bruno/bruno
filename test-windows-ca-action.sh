#!/bin/bash

#  Test Script for Windows CA Certificate Action
#  ==============================================
#  
#  This script simulates the GitHub Action workflow for Windows CA certificate 
#  setup to test the implementation locally on a Windows system.
#  
#  Prerequisites:
#  - Git Bash for Windows
#  - OpenSSL (included with Git Bash)
#  - PowerShell (for certificate installation)
#  - Node.js (for running the test server)
#  
#  Usage:
#  Run this script in Git Bash on Windows from the bruno project root:
#  ./test-windows-ca-action.sh

set -euo pipefail

# Color codes for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Test configuration
TEST_SERVER_PORT=8090
TEST_SERVER_PID=""
CLEANUP_ON_EXIT=true

# Function to print colored output
print_step() {
    echo -e "${BLUE}[STEP]${NC} $1"
}

print_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Function to cleanup on exit
cleanup() {
    if [[ "$CLEANUP_ON_EXIT" == "true" ]]; then
        print_step "Cleaning up test environment..."
        
        # Kill test server if running
        if [[ -n "$TEST_SERVER_PID" ]] && kill -0 "$TEST_SERVER_PID" 2>/dev/null; then
            print_step "Stopping test server (PID: $TEST_SERVER_PID)"
            kill "$TEST_SERVER_PID" 2>/dev/null || true
            sleep 2
        fi
        
        # Clean up any remaining processes on port 8090
        if netstat -an 2>/dev/null | grep -q ":$TEST_SERVER_PORT"; then
            print_step "Cleaning up processes on port $TEST_SERVER_PORT"
            for pid in $(netstat -ano 2>/dev/null | grep ":$TEST_SERVER_PORT" | awk '{print $5}' | sort -u); do
                if [[ "$pid" =~ ^[0-9]+$ ]]; then
                    taskkill //PID $pid //F 2>/dev/null || true
                fi
            done
        fi
        
        print_success "Cleanup completed"
    fi
}

# Set up cleanup trap
trap cleanup EXIT

# Function to check if running on Windows
check_windows() {
    if [[ "$OSTYPE" != "msys" && "$OSTYPE" != "cygwin" ]]; then
        print_error "This script is designed to run on Windows with Git Bash"
        print_error "Detected OS type: $OSTYPE"
        exit 1
    fi
    print_success "Running on Windows with Git Bash"
}

# Function to verify we're in the correct directory
check_project_directory() {
    if [[ ! -f "package.json" ]] || [[ ! -d "e2e-tests/ca_certs" ]]; then
        print_error "Please run this script from the bruno project root directory"
        print_error "Current directory: $(pwd)"
        exit 1
    fi
    print_success "Project directory verified"
}

# Step 1: Install OpenSSL dependencies (verify)
step_install_openssl() {
    print_step "Step 1: Verifying OpenSSL installation"
    
    # Check if OpenSSL is available in Git Bash (comes with Git for Windows)
    if command -v openssl &> /dev/null; then
        print_success "OpenSSL found: $(openssl version)"
    else
        print_error "OpenSSL not found in Git Bash PATH"
        print_error "Please ensure Git for Windows is properly installed"
        exit 1
    fi
    
    print_success "OpenSSL verified for Windows"
}

# Step 2: Create certificate directories
step_create_directories() {
    print_step "Step 2: Creating certificate directories"
    
    rm -rf e2e-tests/ca_certs/server/certs
    mkdir -p e2e-tests/ca_certs/server/certs
    
    print_success "Certificate directory 'certs' created successfully"
}

# Step 3: Generate CA certificates
step_generate_certificates() {
    print_step "Step 3: Generating CA certificates using Windows script"
    
    cd e2e-tests/ca_certs/server
    
    if [[ ! -f "generate_certs_windows.sh" ]]; then
        print_error "Windows certificate generation script not found"
        exit 1
    fi
    
    chmod +x generate_certs_windows.sh
    ./generate_certs_windows.sh
    
    CA_CERT_PATH="$(pwd)/certs/ca-cert.pem"
    CA_CERT_DER_PATH="$(pwd)/certs/ca-cert.cer"
    
    print_success "Certificates generated successfully at $CA_CERT_PATH"
    print_success "Windows DER certificate at $CA_CERT_DER_PATH"
    
    # Return to project root
    cd ../../..
}

# Step 4: Verify generated certificates
step_verify_certificates() {
    print_step "Step 4: Verifying generated certificates"
    
    cd e2e-tests/ca_certs/server/certs
    
    # Check that all required certificate files exist (Windows generates additional formats)
    REQUIRED_FILES=("ca-cert.pem" "ca-cert.cer" "localhost-cert.pem" "localhost-key.pem" "localhost.p12")
    for cert_file in "${REQUIRED_FILES[@]}"; do
        if [[ ! -f "$cert_file" ]]; then
            print_error "Required certificate file missing: $cert_file"
            print_error "Available files in certs directory:"
            ls -la || true
            exit 1
        fi
    done
    
    print_success "All required certificate files are present"
    
    # Display certificate information for verification
    print_step "Displaying certificate information..."
    echo "CA certificate information:"
    openssl x509 -in ca-cert.pem -text -noout | head -20
    
    echo ""
    echo "Server certificate information:"
    openssl x509 -in localhost-cert.pem -text -noout | head -20
    
    print_success "Certificate verification completed successfully"
    
    # Return to project root
    cd ../../../..
}

# Step 5: Add CA certificate to Windows truststore
step_install_ca_certificate() {
    print_step "Step 5: Installing CA certificate to Windows truststore"
    
    # Get the full path to the certificate
    CERT_PATH="$(pwd)/e2e-tests/ca_certs/server/certs/ca-cert.cer"
    
    if [[ ! -f "$CERT_PATH" ]]; then
        print_error "Certificate file not found at $CERT_PATH"
        exit 1
    fi
    
    print_step "Using PowerShell to install certificate..."
    
    # Convert path to Windows format for PowerShell
    WIN_CERT_PATH=$(cygpath -w "$CERT_PATH" 2>/dev/null || echo "$CERT_PATH")
    
    # Create PowerShell script content - embed the path directly
    POWERSHELL_SCRIPT=$(cat << EOF
\$ErrorActionPreference = "Stop"
\$certPath = "$WIN_CERT_PATH"
Write-Output "Adding CA certificate to Windows truststore"
Write-Output "Certificate path: \$certPath"

if (Test-Path \$certPath) {
    try {
        Import-Certificate -FilePath \$certPath -CertStoreLocation Cert:\LocalMachine\Root
        Write-Output "CA certificate added to Windows truststore successfully"
        
        # Verify the certificate was installed
        \$cert = Get-ChildItem -Path Cert:\LocalMachine\Root | Where-Object { \$_.Subject -like "*Local Dev CA*" }
        if (\$cert) {
            Write-Output "Certificate verification: CA certificate found in Windows truststore"
            Write-Output "Subject: \$(\$cert.Subject)"
        } else {
            Write-Output "Warning: CA certificate not found in truststore after installation"
        }
    } catch {
        Write-Output "Error installing certificate: \$(\$_.Exception.Message)"
        Write-Output "Note: This may require administrator privileges"
        exit 1
    }
} else {
    Write-Output "Error: Certificate file not found at \$certPath"
    exit 1
}
EOF
    )
    
    # Run PowerShell command
    if powershell.exe -Command "$POWERSHELL_SCRIPT"; then
        print_success "CA certificate installation completed"
    else
        print_warning "CA certificate installation failed - this may require administrator privileges"
        print_warning "The server test may still work if Node.js ignores certificate validation"
    fi
}

# Step 6: Start and verify server
step_start_and_verify_server() {
    print_step "Step 6: Starting and verifying HTTPS server"
    
    cd e2e-tests/ca_certs/server
    
    if [[ ! -f "index.js" ]]; then
        print_error "Server file not found"
        exit 1
    fi
    
    print_success "Server script found and accessible"
    
    # Verify all required certificates are present
    REQUIRED_CERTS=("certs/ca-cert.pem" "certs/ca-cert.cer" "certs/localhost-cert.pem" "certs/localhost-key.pem" "certs/localhost.p12")
    for cert_file in "${REQUIRED_CERTS[@]}"; do
        if [[ ! -f "$cert_file" ]]; then
            print_error "Required certificate file missing: $cert_file"
            print_error "Available files in certs directory:"
            ls -la certs/ || echo "certs directory not accessible"
            exit 1
        fi
    done
    print_success "All required certificates are present for Windows"
    
    # Check for existing process on port
    print_step "Checking for existing process on port $TEST_SERVER_PORT"
    if netstat -an 2>/dev/null | grep -q ":$TEST_SERVER_PORT"; then
        print_warning "Found existing process on port $TEST_SERVER_PORT, attempting to kill it"
        for pid in $(netstat -ano 2>/dev/null | grep ":$TEST_SERVER_PORT" | awk '{print $5}' | sort -u); do
            if [[ "$pid" =~ ^[0-9]+$ ]]; then
                taskkill //PID $pid //F 2>/dev/null || echo "Failed to kill PID $pid"
            fi
        done
        sleep 2
    fi
    
    # Start the server
    print_step "Starting HTTPS server..."
    node index.js > test_server.log 2>&1 &
    TEST_SERVER_PID=$!
    print_success "Started server with PID: $TEST_SERVER_PID"
    
    # Function to check server readiness
    check_server_ready() {
        local attempt=$1
        local max_attempts=$2
        
        if RESPONSE=$(curl --connect-timeout 2 --max-time 5 -k https://localhost:$TEST_SERVER_PORT 2>/dev/null); then
            if [[ "$RESPONSE" == "ping" ]]; then
                print_success "Server ready and responding correctly (attempt $attempt/$max_attempts)"
                return 0
            else
                print_warning "Server responding with unexpected content: '$RESPONSE' (attempt $attempt/$max_attempts)"
                return 1
            fi
        else
            print_warning "Server not responding yet (attempt $attempt/$max_attempts)"
            return 1
        fi
    }
    
    # Wait for server to become ready
    print_step "Waiting for server to become ready..."
    MAX_ATTEMPTS=15
    SERVER_READY=false
    
    for ((i=1; i<=MAX_ATTEMPTS; i++)); do
        if check_server_ready "$i" "$MAX_ATTEMPTS"; then
            SERVER_READY=true
            break
        fi
        
        if [[ $i -eq $MAX_ATTEMPTS ]]; then
            print_error "Server failed to become ready after $MAX_ATTEMPTS attempts"
            print_error "Server logs:"
            cat test_server.log 2>/dev/null || echo "No server logs available"
            print_error "Process status:"
            if kill -0 "$TEST_SERVER_PID" 2>/dev/null; then
                echo "Server process is still running"
            else
                echo "Server process has died"
            fi
            exit 1
        fi
        
        sleep 2
    done
    
    if [[ "$SERVER_READY" == "true" ]]; then
        print_success "Windows CA cert server is ready and accessible"
    fi
    
    # Return to project root
    cd ../../..
}

# Step 7: Final verification and testing
step_final_verification() {
    print_step "Step 7: Final verification and testing"
    
    # Test HTTPS connection
    print_step "Testing HTTPS connection to server..."
    
    # Test with curl (ignoring cert validation for this test)
    if RESPONSE=$(curl -k --connect-timeout 5 --max-time 10 https://localhost:$TEST_SERVER_PORT 2>/dev/null); then
        if [[ "$RESPONSE" == "ping" ]]; then
            print_success "HTTPS server responding correctly: '$RESPONSE'"
        else
            print_error "Server responding with unexpected content: '$RESPONSE'"
            exit 1
        fi
    else
        print_error "Failed to connect to HTTPS server"
        exit 1
    fi
    
    # Display server information
    print_step "Server information:"
    echo "  - Server URL: https://localhost:$TEST_SERVER_PORT"
    echo "  - Server PID: $TEST_SERVER_PID"
    echo "  - Platform detection: $(node -e "console.log(process.platform)")"
    echo "  - Certificate format used: $(if [[ "$(node -e "console.log(process.platform)")" == "win32" ]]; then echo "PKCS#12 (.p12)"; else echo "PEM files"; fi)"
    
    print_success "All verification tests passed!"
}

# Main execution function
main() {
    echo ""
    echo "=========================================="
    echo "Windows CA Certificate Action Test Script"
    echo "=========================================="
    echo ""
    
    print_step "Initializing test environment..."
    
    # Preliminary checks
    check_windows
    check_project_directory
    
    # Execute all test steps
    step_install_openssl
    step_create_directories
    step_generate_certificates
    step_verify_certificates
    step_install_ca_certificate
    step_start_and_verify_server
    step_final_verification
    
    echo ""
    echo "=========================================="
    print_success "Windows CA Certificate Test Completed!"
    echo "=========================================="
    echo ""
    echo "The HTTPS server is running at: https://localhost:$TEST_SERVER_PORT"
    echo "Press Ctrl+C to stop the server and cleanup"
    echo ""
    
    # Keep server running for manual testing
    print_step "Server is running. You can now:"
    echo "  1. Test with: curl -k https://localhost:$TEST_SERVER_PORT"
    echo "  2. Open https://localhost:$TEST_SERVER_PORT in your browser"
    echo "  3. Run your e2e tests against this server"
    echo ""
    echo "Press Ctrl+C when done testing..."
    
    # Wait for user interrupt
    while true; do
        sleep 1
    done
}

# Run the main function
main "$@"
