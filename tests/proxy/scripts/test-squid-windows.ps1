# Squid server startup script for Windows self-hosted runner.
# Run from the repo root: pwsh tests/proxy/scripts/test-squid-windows.ps1
#
# Generates certificates, configures Squid, and starts all proxy test servers.
# Does not run tests — use the GitHub Actions workflow for full testing.

$ErrorActionPreference = "Stop"

$repoRoot = Get-Location
$certDir = "$repoRoot\tests\proxy\server\certs"
$squidCertDir = "$repoRoot\tests\proxy\squid\certs"
$logDir = "$env:TEMP\squid-test-logs"
$squidConf = "$env:TEMP\squid-test.conf"

function Cleanup {
  Write-Host "`n==> Cleaning up..."
  Get-Job | Stop-Job -ErrorAction SilentlyContinue
  Get-Job | Remove-Job -Force -ErrorAction SilentlyContinue
  # Kill node servers and squid
  Get-Process -Name node, squid -ErrorAction SilentlyContinue | Stop-Process -Force -ErrorAction SilentlyContinue
  # Kill anything still holding test ports (8070-8072, 8090-8091)
  foreach ($port in @(8070, 8071, 8072, 8090, 8091)) {
    $pids = netstat -ano | Select-String ":$port\s.*LISTENING" | ForEach-Object {
      ($_ -split '\s+')[-1]
    } | Sort-Object -Unique
    foreach ($pid in $pids) {
      if ($pid -and $pid -ne "0") {
        Stop-Process -Id $pid -Force -ErrorAction SilentlyContinue
      }
    }
  }
  @("C:\Squid\var\run\squid.pid", "C:\var\run\squid.pid") | ForEach-Object {
    Remove-Item $_ -Force -ErrorAction SilentlyContinue
  }
  Start-Sleep 1
}

# Always clean up on exit
trap { Cleanup }

# =================================================================
# 0. Prerequisites
# =================================================================
Write-Host "==> Checking prerequisites..."

# Add Squid to PATH if installed but not in PATH
if (!(Get-Command squid -ErrorAction SilentlyContinue) -and (Test-Path "C:\Squid\bin\squid.exe")) {
  $env:Path = "C:\Squid\bin;$env:Path"
}

foreach ($cmd in @("node", "openssl", "squid")) {
  $found = Get-Command $cmd -ErrorAction SilentlyContinue
  if ($found) { Write-Host "  OK: $cmd -> $($found.Source)" }
  else { throw "  MISSING: $cmd — install it first" }
}

# Kill leftover squid
Cleanup

# =================================================================
# 1. Generate certificates
# =================================================================
Write-Host "`n==> Generating certificates..."
New-Item -ItemType Directory -Path $certDir, $squidCertDir, $logDir -Force | Out-Null
# Clear old log files so error checks don't pick up stale entries
Remove-Item "$logDir\*" -Force -ErrorAction SilentlyContinue

# Server cert
@"
[req]
distinguished_name = req_dn
x509_extensions = v3_req
prompt = no
[req_dn]
CN = localhost
[v3_req]
subjectAltName = IP:127.0.0.1,DNS:localhost
"@ | Set-Content "$certDir\server-ext.cnf"

openssl req -x509 -newkey rsa:2048 `
  -keyout "$certDir\server.key" -out "$certDir\server.crt" `
  -days 3650 -nodes -config "$certDir\server-ext.cnf" -extensions v3_req 2>$null
if ($LASTEXITCODE -ne 0) { throw "Failed to generate server cert" }
openssl x509 -in "$certDir\server.crt" -out "$certDir\server.pem" -outform PEM
Write-Host "  Server cert OK"

# Squid cert
@"
[req]
distinguished_name = req_dn
x509_extensions = v3_req
prompt = no
[req_dn]
CN = squid-proxy
[v3_req]
subjectAltName = IP:127.0.0.1,DNS:localhost
"@ | Set-Content "$squidCertDir\squid-ext.cnf"

openssl req -x509 -newkey rsa:2048 `
  -keyout "$squidCertDir\squid.key" -out "$squidCertDir\squid.crt" `
  -days 3650 -nodes -config "$squidCertDir\squid-ext.cnf" -extensions v3_req 2>$null
if ($LASTEXITCODE -ne 0) { throw "Failed to generate squid cert" }
Get-Content "$squidCertDir\squid.key", "$squidCertDir\squid.crt" | Set-Content "$squidCertDir\squid.pem"
Write-Host "  Squid cert OK"

# Client CA + cert (mTLS)
@"
[req]
distinguished_name = req_dn
x509_extensions = v3_ca
prompt = no
[req_dn]
CN = Bruno Test Client CA
[v3_ca]
basicConstraints = critical, CA:TRUE
subjectKeyIdentifier = hash
authorityKeyIdentifier = keyid:always, issuer
"@ | Set-Content "$certDir\client-ca-ext.cnf"

openssl req -x509 -newkey rsa:2048 `
  -keyout "$certDir\client-ca.key" -out "$certDir\client-ca.crt" `
  -days 3650 -nodes -config "$certDir\client-ca-ext.cnf" -extensions v3_ca 2>$null
if ($LASTEXITCODE -ne 0) { throw "Failed to generate client CA cert" }

@"
[req]
distinguished_name = req_dn
prompt = no
[req_dn]
CN = Bruno Test Client
"@ | Set-Content "$certDir\client-ext.cnf"

openssl req -newkey rsa:2048 `
  -keyout "$certDir\client.key" -out "$certDir\client.csr" `
  -nodes -config "$certDir\client-ext.cnf" 2>$null
if ($LASTEXITCODE -ne 0) { throw "Failed to generate client CSR" }

openssl x509 -req -in "$certDir\client.csr" `
  -CA "$certDir\client-ca.crt" -CAkey "$certDir\client-ca.key" `
  -CAcreateserial -out "$certDir\client.crt" -days 3650 2>$null
if ($LASTEXITCODE -ne 0) { throw "Failed to sign client cert" }

openssl pkcs12 -export -out "$certDir\client.p12" `
  -inkey "$certDir\client.key" -in "$certDir\client.crt" `
  -certpbe PBE-SHA1-3DES -keypbe PBE-SHA1-3DES -macalg sha1 `
  -passout pass:bruno-test
if ($LASTEXITCODE -ne 0) { throw "Failed to export client PKCS12" }

New-Item -ItemType File -Path "$certDir\empty-ca.pem" -Force | Out-Null
Write-Host "  Client cert OK"

Get-Content "$certDir\server.pem", "$squidCertDir\squid.crt" | Set-Content "$certDir\ca-bundle.pem"
Write-Host "  Certificates: $(( Get-ChildItem $certDir | Measure-Object).Count) files in $certDir"

# =================================================================
# 2. Configure Squid
# =================================================================
Write-Host "`n==> Configuring Squid..."

# Install cygcrypt-2.dll if basic_ncsa_auth needs it
$ncsa = Get-ChildItem -Path "C:\Squid" -Recurse -Filter "basic_ncsa_auth*" -ErrorAction SilentlyContinue | Select-Object -First 1
if (!$ncsa) { throw "basic_ncsa_auth not found under C:\Squid" }
if (!(Test-Path "C:\Squid\bin\cygcrypt-2.dll")) {
  Write-Host "  Installing cygcrypt-2.dll from Cygwin mirror..."
  $pkg = "$env:TEMP\libcrypt2.tar.xz"
  $extractDir = "$env:TEMP\libcrypt2"
  Invoke-WebRequest -Uri "https://mirrors.kernel.org/sourceware/cygwin/x86_64/release/libxcrypt/libcrypt2/libcrypt2-4.4.68-1.tar.xz" -OutFile $pkg -UseBasicParsing
  New-Item -ItemType Directory -Path $extractDir -Force | Out-Null
  tar -xf $pkg -C $extractDir
  $dll = Get-ChildItem $extractDir -Recurse -Filter "cygcrypt-2.dll" | Select-Object -First 1
  if ($dll) {
    Copy-Item $dll.FullName "C:\Squid\bin\" -Force
    Write-Host "  Installed cygcrypt-2.dll to C:\Squid\bin\"
  } else {
    throw "cygcrypt-2.dll not found in downloaded package"
  }
}

# htpasswd for Squid basic auth
$htpasswdDir = "C:\Squid\etc"
if (!(Test-Path $htpasswdDir)) { New-Item -ItemType Directory -Path $htpasswdDir -Force }
$hash = & openssl passwd -apr1 "password"
"user:$hash" | Set-Content "$htpasswdDir\htpasswd"

$ncsaPath = $ncsa.FullName -replace '\\', '/'
$htpasswdPath = "$htpasswdDir\htpasswd" -replace '\\', '/'
Write-Host "  Auth helper: $ncsaPath $htpasswdPath"

$squidCertPath = ($squidCertDir -replace '\\', '/') + "/squid.pem"
$squidLogDir = $logDir -replace '\\', '/'

(Get-Content tests\proxy\server\squid.conf) `
  -replace '@SQUID_CERT@', $squidCertPath `
  -replace '/usr/lib/squid/basic_ncsa_auth', $ncsaPath `
  -replace '/etc/squid/htpasswd', $htpasswdPath `
  -replace 'access_log stdio:/var/log/squid/access.log bruno', "access_log stdio:$squidLogDir/access.log bruno" `
  -replace 'cache_log /dev/null', "cache_log $squidLogDir/cache.log" |
  Set-Content $squidConf
# Add dns_nameservers since Cygwin Squid can't find /etc/resolv.conf on Windows
Add-Content $squidConf "`ndns_nameservers 8.8.8.8 8.8.4.4"

Write-Host "  Auth helper: $ncsaPath $htpasswdPath"
Write-Host "  Squid config:"
Get-Content $squidConf | ForEach-Object { Write-Host "    $_" }

# =================================================================
# 3. Start servers
# =================================================================
Write-Host "`n==> Starting servers..."
$env:HOST = "0.0.0.0"
$env:CERT_DIR = $certDir

$httpJob = Start-Job -ScriptBlock {
  $env:HOST = $using:env:HOST
  & node "$using:repoRoot\tests\proxy\server\http-server.js" 2>&1
}
$httpsJob = Start-Job -ScriptBlock {
  $env:HOST = $using:env:HOST
  $env:CERT_DIR = $using:certDir
  & node "$using:repoRoot\tests\proxy\server\https-server.js" 2>&1
}
$httpsCertJob = Start-Job -ScriptBlock {
  $env:HOST = $using:env:HOST
  $env:CERT_DIR = $using:certDir
  & node "$using:repoRoot\tests\proxy\server\https-client-cert-server.js" 2>&1
}

$squidBin = (Get-Command squid -ErrorAction SilentlyContinue).Source
if (!$squidBin -and (Test-Path "C:\Squid\bin\squid.exe")) { $squidBin = "C:\Squid\bin\squid.exe" }
if (!$squidBin) { throw "squid not found" }

$squidJob = Start-Job -ScriptBlock {
  & $using:squidBin -N -f $using:squidConf 2>&1
}

Start-Sleep 5

Write-Host "  Jobs: HTTP=$($httpJob.State) HTTPS=$($httpsJob.State) HTTPSCert=$($httpsCertJob.State) Squid=$($squidJob.State)"

# Show all job output
$allJobs = @(@{N="HTTP";J=$httpJob}, @{N="HTTPS";J=$httpsJob}, @{N="HTTPSCert";J=$httpsCertJob}, @{N="Squid";J=$squidJob})
foreach ($j in $allJobs) {
  $out = Receive-Job -Job $j.J -Keep -ErrorAction SilentlyContinue
  if ($out) { Write-Host "  $($j.N): $($out | Select-Object -First 3 | Out-String)" }
  else { Write-Host "  $($j.N): (no output)" }
}

# Show listening ports
Write-Host "`n  Listening ports:"
netstat -ano | Select-String "LISTENING" | Select-String "807|809" | ForEach-Object { Write-Host "    $_" }

# Check squid cache.log for errors
if (Test-Path "$logDir\cache.log") {
  $errors = Get-Content "$logDir\cache.log" | Select-String "FATAL|ERROR|error while loading"
  if ($errors) {
    Write-Host "`n  !!! Squid cache.log errors:"
    $errors | ForEach-Object { Write-Host "    $_" }
  }
}

Write-Host "`n==> All servers started successfully!"
Write-Host "`nServers are running on the following ports:"
Write-Host "  HTTP:           127.0.0.1:8070"
Write-Host "  HTTPS:          127.0.0.1:8071"
Write-Host "  HTTPS+mTLS:     127.0.0.1:8072"
Write-Host "  Squid HTTP:     127.0.0.1:8090 (user:password)"
Write-Host "  Squid HTTPS:    127.0.0.1:8091 (user:password)"
Write-Host "`nCertificates are in: $certDir"
Write-Host "Logs are in: $logDir"
