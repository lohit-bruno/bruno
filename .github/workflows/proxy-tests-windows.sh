#!/usr/bin/env bash
#
# Local equivalent of the GitHub Actions Windows proxy test pipeline.
# Run from the repo root inside Git Bash: bash .github/workflows/proxy-tests-windows.sh
#
# Prerequisites: choco install squid   (run in an elevated PowerShell)
#                Git Bash (ships with Git for Windows)
#                Node.js on PATH
#
set -euo pipefail

# Clear any pre-existing proxy env vars so they don't interfere with our tests.
unset http_proxy https_proxy HTTP_PROXY HTTPS_PROXY no_proxy NO_PROXY 2>/dev/null || true

ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
cd "$ROOT"

# ---------------------------------------------------------------------------
# Helper: kill processes listening on a given TCP port (Windows)
# ---------------------------------------------------------------------------
kill_port() {
  local port="$1"
  # netstat -ano shows PIDs; grep for LISTENING on :port
  local pids
  pids=$(netstat -ano 2>/dev/null | grep -E ":${port}\s" | grep LISTENING | awk '{print $NF}' | sort -u || true)
  for pid in $pids; do
    taskkill //F //PID "$pid" 2>/dev/null || true
  done
}

# Kill any processes still listening on ports used by tests
for port in 8070 8071 8072 8090 8091; do
  kill_port "$port"
done

CERT_DIR="$ROOT/tests/proxy/server/certs"
BRU="$ROOT/packages/bruno-cli/bin/bru.js"
SQUID_WORK_DIR=$(mktemp -d)
PIDS=()

cleanup() {
  echo ""
  echo "==> Cleaning up..."
  for pid in "${PIDS[@]}"; do
    kill "$pid" 2>/dev/null || true
  done
  wait 2>/dev/null || true

  # Kill any remaining processes on the ports used by tests
  for port in 8070 8071 8072 8090 8091; do
    kill_port "$port"
  done

  rm -rf "$SQUID_WORK_DIR"
  echo "Done."
}
trap cleanup EXIT

# ---------------------------------------------------------------------------
# 1. Check dependencies
# ---------------------------------------------------------------------------
echo "==> Checking dependencies..."
if ! command -v squid >/dev/null 2>&1; then
  # Try known choco install path
  SQUID_BIN="/c/Squid/bin"
  if [ -x "$SQUID_BIN/squid.exe" ]; then
    export PATH="$SQUID_BIN:$PATH"
    echo "Added $SQUID_BIN to PATH"
  else
    echo "ERROR: squid not found. Run in an elevated PowerShell: choco install squid"
    exit 1
  fi
fi
command -v openssl >/dev/null || { echo "ERROR: openssl not found"; exit 1; }
command -v node >/dev/null || { echo "ERROR: node not found"; exit 1; }
echo "All dependencies found."

# ---------------------------------------------------------------------------
# 2. Generate certificates
# ---------------------------------------------------------------------------
echo "==> Generating certificates..."
mkdir -p "$CERT_DIR"

openssl req -x509 -newkey rsa:2048 \
  -keyout "$CERT_DIR/server.key" \
  -out "$CERT_DIR/server.crt" \
  -days 3650 -nodes \
  -subj "/CN=localhost" \
  -addext "subjectAltName=IP:127.0.0.1,DNS:localhost" 2>/dev/null

openssl x509 -in "$CERT_DIR/server.crt" -out "$CERT_DIR/server.pem" -outform PEM

openssl req -x509 -newkey rsa:2048 \
  -keyout "$CERT_DIR/squid.key" \
  -out "$CERT_DIR/squid.crt" \
  -days 3650 -nodes \
  -subj "/CN=squid-proxy" \
  -addext "subjectAltName=IP:127.0.0.1,DNS:localhost" 2>/dev/null

cat "$CERT_DIR/squid.key" "$CERT_DIR/squid.crt" > "$CERT_DIR/squid.pem"

# Client certificate CA and client cert (for client-cert-required server on :8072)
openssl req -x509 -newkey rsa:2048 \
  -keyout "$CERT_DIR/client-ca.key" \
  -out "$CERT_DIR/client-ca.crt" \
  -days 3650 -nodes \
  -subj "/CN=Bruno Test Client CA" 2>/dev/null

openssl req -newkey rsa:2048 \
  -keyout "$CERT_DIR/client.key" \
  -out "$CERT_DIR/client.csr" \
  -nodes -subj "/CN=Bruno Test Client" 2>/dev/null

openssl x509 -req \
  -in "$CERT_DIR/client.csr" \
  -CA "$CERT_DIR/client-ca.crt" \
  -CAkey "$CERT_DIR/client-ca.key" \
  -CAcreateserial \
  -out "$CERT_DIR/client.crt" \
  -days 3650 2>/dev/null

openssl pkcs12 -export \
  -out "$CERT_DIR/client.p12" \
  -inkey "$CERT_DIR/client.key" \
  -in "$CERT_DIR/client.crt" \
  -certpbe PBE-SHA1-3DES -keypbe PBE-SHA1-3DES -macalg sha1 \
  -passout pass:bruno-test

# CA bundle: server cert + squid cert (used by tests to trust both)
cat "$CERT_DIR/server.pem" > "$CERT_DIR/ca-bundle.pem"
cat "$CERT_DIR/squid.crt" >> "$CERT_DIR/ca-bundle.pem"

# Create empty CA cert file (needed by ca=[] regression test)
touch "$CERT_DIR/empty-ca.pem"

echo "Certificates written to $CERT_DIR"

# ---------------------------------------------------------------------------
# 3. Start HTTP and HTTPS servers
# ---------------------------------------------------------------------------
echo "==> Starting HTTP server on :8070..."
node tests/proxy/server/http-server.js &
PIDS+=($!)

echo "==> Starting HTTPS server on :8071..."
CERT_DIR="$CERT_DIR" node tests/proxy/server/https-server.js &
PIDS+=($!)

echo "==> Starting HTTPS client-cert server on :8072..."
CERT_DIR="$CERT_DIR" node tests/proxy/server/https-client-cert-server.js &
PIDS+=($!)

# ---------------------------------------------------------------------------
# 4. Configure and start Squid proxy
# ---------------------------------------------------------------------------
echo "==> Configuring Squid..."

# htpasswd — generate with openssl (htpasswd may not be on Windows PATH)
HTPASSWD_FILE="$SQUID_WORK_DIR/htpasswd"
if command -v htpasswd &>/dev/null; then
  htpasswd -bc "$HTPASSWD_FILE" user password 2>/dev/null
else
  HASH=$(openssl passwd -apr1 password)
  echo "user:$HASH" > "$HTPASSWD_FILE"
fi

# Find the basic_ncsa_auth helper (choco installs squid to C:\Squid)
NCSA_AUTH=""
for search_dir in "/c/Squid" "/c/ProgramData/chocolatey"; do
  if [ -d "$search_dir" ]; then
    NCSA_AUTH=$(find "$search_dir" -name "basic_ncsa_auth*" -type f 2>/dev/null | head -1 || true)
    [ -n "$NCSA_AUTH" ] && break
  fi
done
if [ -z "$NCSA_AUTH" ]; then
  echo "ERROR: basic_ncsa_auth not found (is squid installed?)" && exit 1
fi
echo "Found basic_ncsa_auth at: $NCSA_AUTH"

# Convert POSIX paths to Windows-style (forward slashes) for squid config
WIN_CERT_DIR=$(cygpath -m "$CERT_DIR")
WIN_HTPASSWD_FILE=$(cygpath -m "$HTPASSWD_FILE")
WIN_NCSA_AUTH=$(cygpath -m "$NCSA_AUTH")
WIN_SQUID_WORK_DIR=$(cygpath -m "$SQUID_WORK_DIR")

# Log dir
SQUID_LOG_DIR="$SQUID_WORK_DIR/log"
mkdir -p "$SQUID_LOG_DIR"
WIN_SQUID_LOG_DIR=$(cygpath -m "$SQUID_LOG_DIR")

# Generate squid config with all paths resolved (using Windows paths)
SQUID_CONF="$SQUID_WORK_DIR/squid.conf"
sed -e "s|@SQUID_CERT@|$WIN_CERT_DIR/squid.pem|g" \
    -e "s|/usr/lib/squid/basic_ncsa_auth|$WIN_NCSA_AUTH|g" \
    -e "s|/etc/squid/htpasswd|$WIN_HTPASSWD_FILE|g" \
    -e "s|/var/log/squid|$WIN_SQUID_LOG_DIR|g" \
    -e "s|cache_log /dev/null|cache_log $WIN_SQUID_LOG_DIR/cache.log|g" \
  tests/proxy/server/squid.conf > "$SQUID_CONF"

# Append runtime overrides
cat >> "$SQUID_CONF" <<EOF
pid_filename $WIN_SQUID_WORK_DIR/squid.pid
coredump_dir $WIN_SQUID_WORK_DIR
visible_hostname localhost
EOF

echo "==> Starting Squid proxy (HTTP :8090, HTTPS :8091)..."
WIN_SQUID_CONF=$(cygpath -m "$SQUID_CONF")
squid -N -f "$WIN_SQUID_CONF" &
SQUID_PID=$!
PIDS+=($SQUID_PID)

# Give squid a moment to start or fail
sleep 3
if ! kill -0 "$SQUID_PID" 2>/dev/null; then
  echo "ERROR: Squid failed to start. Cache log:"
  cat "$SQUID_LOG_DIR/cache.log" 2>/dev/null
  exit 1
fi

# ---------------------------------------------------------------------------
# 5. Health checks (30 attempts x 2s = 60s max)
# ---------------------------------------------------------------------------
wait_for() {
  local name="$1"; shift
  echo -n "Waiting for $name..."
  for i in $(seq 1 30); do
    if "$@" > /dev/null 2>&1; then
      echo " ready"
      return 0
    fi
    sleep 2
  done
  echo " FAILED"
  # Show squid log on failure for debugging
  if [ -f "$SQUID_LOG_DIR/access.log" ]; then
    echo "--- Squid access log ---"
    tail -20 "$SQUID_LOG_DIR/access.log"
  fi
  if [ -f "$SQUID_LOG_DIR/cache.log" ]; then
    echo "--- Squid cache log ---"
    tail -20 "$SQUID_LOG_DIR/cache.log"
  fi
  exit 1
}

wait_for "HTTP server :8070" \
  curl -sf http://localhost:8070/

wait_for "HTTPS server :8071" \
  curl -sf --cacert "$CERT_DIR/server.pem" https://localhost:8071/

wait_for "HTTPS client-cert server :8072" \
  curl -sf --cacert "$CERT_DIR/server.pem" \
    --cert "$CERT_DIR/client.crt" --key "$CERT_DIR/client.key" \
    https://localhost:8072/

wait_for "Squid HTTP proxy :8090" \
  curl -sf --proxy http://user:password@127.0.0.1:8090 http://localhost:8070/

wait_for "Squid HTTPS proxy :8091" \
  curl -sf --proxy https://user:password@127.0.0.1:8091 --proxy-cacert "$CERT_DIR/squid.pem" http://localhost:8070/

echo ""
echo "==> All servers ready."

# ---------------------------------------------------------------------------
# 6. CLI tests
# ---------------------------------------------------------------------------
CLI_FAILURES=0

echo ""
echo "==> Running CLI tests..."

for SANDBOX in safe developer; do
  echo ""
  echo "========================================"
  echo "==> Sandbox mode: $SANDBOX"
  echo "========================================"

  echo "--- No proxy: run all requests (direct connection) ---"
  (cd tests/proxy/fixtures/collection-no-proxy && \
    node "$BRU" run ./ --env prod --output junit1-${SANDBOX}.xml --insecure --sandbox "$SANDBOX" --format junit) || ((CLI_FAILURES++))

  echo "--- No proxy: HTTPS with custom CA cert ---"
  (cd tests/proxy/fixtures/collection-no-proxy && \
    node "$BRU" run ./https.yml --env prod --output junit2-${SANDBOX}.xml --cacert "$CERT_DIR/server.pem" --ignore-truststore --sandbox "$SANDBOX" --format junit) || ((CLI_FAILURES++))

  echo "--- HTTP proxy: run all requests ---"
  (cd tests/proxy/fixtures/collection-http-proxy && \
    node "$BRU" run ./ --env prod --output junit-${SANDBOX}.xml --cacert "$CERT_DIR/ca-bundle.pem" --sandbox "$SANDBOX" --format junit) || ((CLI_FAILURES++))

  echo "--- HTTPS proxy: run all requests ---"
  (cd tests/proxy/fixtures/collection-https-proxy && \
    node "$BRU" run ./ --env prod --output junit-${SANDBOX}.xml --cacert "$CERT_DIR/ca-bundle.pem" --sandbox "$SANDBOX" --format junit) || ((CLI_FAILURES++))

  echo "--- Squid access log ---"
  cat "$SQUID_LOG_DIR/access.log" 2>/dev/null | tail -10

  echo "--- --noproxy: bypass collection proxy ---"
  (cd tests/proxy/fixtures/collection-http-proxy && \
    node "$BRU" run ./ --env prod --output junit3-${SANDBOX}.xml --noproxy --insecure --sandbox "$SANDBOX" --format junit) || ((CLI_FAILURES++))
done

echo ""
if [ "$CLI_FAILURES" -gt 0 ]; then
  echo "==> CLI tests: $CLI_FAILURES group(s) had errors."
else
  echo "==> CLI tests passed."
fi

# ---------------------------------------------------------------------------
# 7. E2E tests (Playwright)
# ---------------------------------------------------------------------------
# echo ""
# echo "==> Running E2E proxy tests..."
# npm run test:e2e:proxy || ((CLI_FAILURES++))

# echo ""
# if [ "$CLI_FAILURES" -gt 0 ]; then
#   echo "==> Finished with $CLI_FAILURES failure(s)."
#   exit 1
# else
#   echo "==> All proxy tests passed."
# fi
