# Quick Squid verification script for Windows self-hosted runner.
# Run from the repo root: pwsh tests/proxy/scripts/test-squid-windows.ps1
#
# Tests: cert generation, Squid config, auth helper, server startup, health checks.
# Skips npm ci / CLI tests — focuses only on the infrastructure.

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
& $ncsa.FullName --help 2>&1 | Out-Null
if ($LASTEXITCODE -ne 0) {
  Write-Host "  basic_ncsa_auth needs cygcrypt-2.dll — installing via Cygwin setup..."
  $cygSetup = "$env:TEMP\cygwin-setup.exe"
  if (!(Test-Path $cygSetup)) {
    Invoke-WebRequest -Uri "https://cygwin.com/setup-x86_64.exe" -OutFile $cygSetup -UseBasicParsing
  }
  & $cygSetup --quiet-mode --no-desktop --no-shortcuts --no-startmenu `
    --root "$env:TEMP\cygwin-tmp" `
    --local-package-dir "$env:TEMP\cygwin-pkg" `
    --site "https://mirrors.kernel.org/sourceware/cygwin/" `
    --packages "libcrypt2" --wait
  $dll = Get-ChildItem "$env:TEMP\cygwin-tmp" -Recurse -Filter "cygcrypt-2.dll" -ErrorAction SilentlyContinue | Select-Object -First 1
  if ($dll) {
    Copy-Item $dll.FullName "C:\Squid\bin\" -Force
    Write-Host "  Installed cygcrypt-2.dll to C:\Squid\bin\"
  } else {
    throw "Failed to install cygcrypt-2.dll"
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

Write-Host "  Auth helper: $nodePath $authHelperPath"
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

# =================================================================
# 4. Health checks
# =================================================================
Write-Host "`n==> Health checks..."

$healthCheckJs = "$env:TEMP\health-check.js"
@"
const https = require('https');
const http = require('http');
const fs = require('fs');
const [proto, host, port, ...caFiles] = process.argv.slice(2);
const opts = { hostname: host, port: Number(port), path: '/', timeout: 3000 };
if (caFiles.length) opts.ca = caFiles.map(f => fs.readFileSync(f));
if (process.env.CLIENT_CERT) { opts.cert = fs.readFileSync(process.env.CLIENT_CERT); opts.key = fs.readFileSync(process.env.CLIENT_KEY); }
const mod = proto === 'https' ? https : http;
const req = mod.get(opts, (res) => { process.exit(res.statusCode === 200 ? 0 : 1); });
req.on('error', (e) => { console.error('HEALTHCHECK ERROR:', e.message); process.exit(1); });
req.on('timeout', () => { console.error('HEALTHCHECK TIMEOUT'); req.destroy(); process.exit(1); });
"@ | Set-Content $healthCheckJs

$results = @{}

$checks = @(
  @{ Name = "HTTP server :8070"; Cmd = { node $healthCheckJs http 127.0.0.1 8070 2>$null } },
  @{ Name = "HTTPS server :8071"; Cmd = { node $healthCheckJs https 127.0.0.1 8071 "$certDir\server.pem" 2>$null } },
  @{ Name = "HTTPS client-cert :8072"; Cmd = {
    $env:CLIENT_CERT = "$certDir\client.crt"; $env:CLIENT_KEY = "$certDir\client.key"
    node $healthCheckJs https 127.0.0.1 8072 "$certDir\server.pem" 2>$null
    Remove-Item Env:\CLIENT_CERT, Env:\CLIENT_KEY -ErrorAction SilentlyContinue
  } },
  @{ Name = "Squid HTTP proxy :8090"; Cmd = { node -e "const h=require('http');const a=Buffer.from('user:password').toString('base64');const r=h.get({hostname:'127.0.0.1',port:8090,path:'http://127.0.0.1:8070/',headers:{'Proxy-Authorization':'Basic '+a},timeout:3000},s=>{process.exit(s.statusCode===200?0:1)});r.on('error',()=>process.exit(1));r.on('timeout',()=>{r.destroy();process.exit(1)})" 2>$null } },
  @{ Name = "Squid HTTPS proxy :8091"; Cmd = { node -e "const t=require('tls'),f=require('fs');const a=Buffer.from('user:password').toString('base64');const s=t.connect({host:'127.0.0.1',port:8091,ca:f.readFileSync('$($squidCertDir -replace '\\','/')'+'/squid.crt')},()=>{s.write('GET http://127.0.0.1:8070/ HTTP/1.1\r\nHost: 127.0.0.1:8070\r\nProxy-Authorization: Basic '+a+'\r\n\r\n');let d='';s.on('data',c=>d+=c);s.on('end',()=>process.exit(d.includes('200')?0:1))});s.on('error',()=>process.exit(1));setTimeout(()=>process.exit(1),3000)" 2>$null } }
)

foreach ($check in $checks) {
  Write-Host -NoNewline "  $($check.Name)..."
  $ok = $false
  for ($i = 1; $i -le 30; $i++) {
    & $check.Cmd | Out-Null
    if ($LASTEXITCODE -eq 0) { $ok = $true; break }
    Start-Sleep 2
  }
  $results[$check.Name] = $ok
  Write-Host $(if ($ok) { " OK" } else { " FAILED" })
}

# =================================================================
# 5. Summary
# =================================================================
Write-Host "`n==> Results:"
$failed = 0
foreach ($kv in $results.GetEnumerator()) {
  $status = if ($kv.Value) { "PASS" } else { "FAIL"; $failed++ }
  Write-Host "  [$status] $($kv.Key)"
}

# Show squid logs on failure
if ($failed -gt 0) {
  Write-Host "`n==> Squid cache.log (last 30 lines):"
  if (Test-Path "$logDir\cache.log") {
    Get-Content "$logDir\cache.log" -Tail 30
  } else {
    Write-Host "  (not found)"
  }
  Write-Host "`n==> Squid access.log (last 10 lines):"
  if (Test-Path "$logDir\access.log") {
    Get-Content "$logDir\access.log" -Tail 10
  } else {
    Write-Host "  (not found)"
  }

  # Dump all job output
  Write-Host "`n==> Job output:"
  foreach ($j in $allJobs) {
    Write-Host "--- $($j.N) (State: $($j.J.State)) ---"
    $out = Receive-Job -Job $j.J -Keep -ErrorAction SilentlyContinue
    if ($out) { Write-Host ($out | Out-String) } else { Write-Host "(no output)" }
  }
}

Cleanup

if ($failed -gt 0) {
  throw "$failed health check(s) failed"
}
Write-Host "`n==> All checks passed!"
