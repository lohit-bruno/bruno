const { execSync, spawn } = require('child_process');
const fs = require('fs');
const path = require('path');
const os = require('os');
const http = require('http');
const https = require('https');

const CERT_DIR = path.join(__dirname, 'certs');
const SQUID_CONF_TEMPLATE = path.join(__dirname, 'squid.conf');
const platform = os.platform();

const log = (msg) => console.log(`[setup] ${msg}`);
const run = (cmd, opts = {}) => execSync(cmd, { stdio: 'pipe', ...opts }).toString().trim();

// =================================================================
// 1. Generate certificates
// =================================================================
function generateCerts() {
  log('Generating certificates...');
  fs.mkdirSync(CERT_DIR, { recursive: true });

  // Server cert
  run(`openssl req -x509 -newkey rsa:2048 -keyout "${path.join(CERT_DIR, 'server.key')}" -out "${path.join(CERT_DIR, 'server.crt')}" -days 3650 -nodes -subj "/CN=localhost" -addext "subjectAltName=IP:127.0.0.1,DNS:localhost,DNS:host.docker.internal"`);
  run(`openssl x509 -in "${path.join(CERT_DIR, 'server.crt')}" -out "${path.join(CERT_DIR, 'server.pem')}" -outform PEM`);
  log('  Server cert OK');

  // Squid cert
  run(`openssl req -x509 -newkey rsa:2048 -keyout "${path.join(CERT_DIR, 'squid.key')}" -out "${path.join(CERT_DIR, 'squid.crt')}" -days 3650 -nodes -subj "/CN=squid-proxy" -addext "subjectAltName=IP:127.0.0.1,DNS:localhost"`);
  const squidKey = fs.readFileSync(path.join(CERT_DIR, 'squid.key'));
  const squidCrt = fs.readFileSync(path.join(CERT_DIR, 'squid.crt'));
  fs.writeFileSync(path.join(CERT_DIR, 'squid.pem'), Buffer.concat([squidKey, squidCrt]));
  log('  Squid cert OK');

  // Client CA + cert (mTLS)
  run(`openssl req -x509 -newkey rsa:2048 -keyout "${path.join(CERT_DIR, 'client-ca.key')}" -out "${path.join(CERT_DIR, 'client-ca.crt')}" -days 3650 -nodes -subj "/CN=Bruno Test Client CA"`);
  run(`openssl req -newkey rsa:2048 -keyout "${path.join(CERT_DIR, 'client.key')}" -out "${path.join(CERT_DIR, 'client.csr')}" -nodes -subj "/CN=Bruno Test Client"`);
  run(`openssl x509 -req -in "${path.join(CERT_DIR, 'client.csr')}" -CA "${path.join(CERT_DIR, 'client-ca.crt')}" -CAkey "${path.join(CERT_DIR, 'client-ca.key')}" -CAcreateserial -out "${path.join(CERT_DIR, 'client.crt')}" -days 3650`);
  run(`openssl pkcs12 -export -out "${path.join(CERT_DIR, 'client.p12')}" -inkey "${path.join(CERT_DIR, 'client.key')}" -in "${path.join(CERT_DIR, 'client.crt')}" -certpbe PBE-SHA1-3DES -keypbe PBE-SHA1-3DES -macalg sha1 -passout pass:bruno-test`);

  // Empty CA cert file (needed by ca=[] regression test)
  fs.writeFileSync(path.join(CERT_DIR, 'empty-ca.pem'), '');

  // CA bundle (server + squid)
  const serverPem = fs.readFileSync(path.join(CERT_DIR, 'server.pem'));
  const squidCrtFile = fs.readFileSync(path.join(CERT_DIR, 'squid.crt'));
  fs.writeFileSync(path.join(CERT_DIR, 'ca-bundle.pem'), Buffer.concat([serverPem, squidCrtFile]));
  log('  Client cert OK');
  log('  CA bundle OK');
}

// =================================================================
// 2. Download badssl client certificate
// =================================================================
function downloadBadsslCert() {
  const p12Path = path.join(CERT_DIR, 'badssl-client.p12');
  if (fs.existsSync(p12Path) && fs.statSync(p12Path).size > 0) {
    log('badssl client cert already exists, skipping download');
    return;
  }
  log('Downloading badssl client certificate...');
  try {
    run(`curl -fsSL -o "${p12Path}" https://badssl.com/certs/badssl.com-client.p12`);
    log('  badssl client cert OK');
  } catch {
    log('  WARNING: Failed to download badssl client certificate');
  }
}

// =================================================================
// 3. Configure Squid (OS-specific)
// =================================================================
function configureSquid() {
  log(`Configuring Squid for ${platform}...`);

  let ncsaAuthPath, htpasswdPath, squidLogDir, squidConf;
  const squidCertPath = path.join(CERT_DIR, 'squid.pem').replace(/\\/g, '/');

  if (platform === 'darwin') {
    // macOS: Squid installed via brew
    const searchPaths = ['/opt/homebrew', '/usr/local'];
    let ncsaAuth;
    for (const p of searchPaths) {
      try {
        ncsaAuth = run(`find ${p} -name "basic_ncsa_auth" -type f 2>/dev/null | head -1`);
        if (ncsaAuth) break;
      } catch { /* ignore */ }
    }
    if (!ncsaAuth) throw new Error('basic_ncsa_auth not found');
    ncsaAuthPath = ncsaAuth;

    const workDir = '/tmp/squid-bruno-work';
    fs.mkdirSync(`${workDir}/log`, { recursive: true });

    htpasswdPath = `${workDir}/htpasswd`;
    const hash = run('openssl passwd -apr1 password');
    fs.writeFileSync(htpasswdPath, `user:${hash}\n`);

    squidLogDir = `${workDir}/log`;
    squidConf = `${workDir}/squid.conf`;

    // Detect squid version for https_port syntax
    let squidMajor = '5';
    try { squidMajor = run('squid -v 2>&1 | grep -oE \'Version [0-9]+\' | grep -oE \'[0-9]+\' | head -1'); } catch { /* default */ }

    let template = fs.readFileSync(SQUID_CONF_TEMPLATE, 'utf8');
    if (parseInt(squidMajor) >= 6) {
      const httpsPortLine = `https_port 8091 tls-cert=${path.join(CERT_DIR, 'squid.crt').replace(/\\/g, '/')} tls-key=${path.join(CERT_DIR, 'squid.key').replace(/\\/g, '/')}`;
      template = template.replace(/https_port 8091 cert=@SQUID_CERT@/, httpsPortLine);
    } else {
      template = template.replace(/@SQUID_CERT@/g, squidCertPath);
    }
    template = template
      .replace('/usr/lib/squid/basic_ncsa_auth', ncsaAuthPath)
      .replace('/etc/squid/htpasswd', htpasswdPath)
      .replace('access_log stdio:/var/log/squid/access.log bruno', `access_log stdio:${squidLogDir}/access.log bruno`)
      .replace('cache_log /dev/null', `cache_log ${squidLogDir}/cache.log`);
    template += `\npid_filename ${workDir}/squid.pid\ncoredump_dir ${workDir}\nvisible_hostname localhost\nhosts_file /etc/hosts\n`;

    fs.writeFileSync(squidConf, template);
  } else if (platform === 'linux') {
    // Linux: Squid installed via apt
    let ncsaAuth;
    try { ncsaAuth = run('find /usr -name "basic_ncsa_auth" -type f 2>/dev/null | head -1'); } catch { /* */ }
    if (!ncsaAuth) throw new Error('basic_ncsa_auth not found');
    ncsaAuthPath = ncsaAuth;

    try { run('sudo mkdir -p /etc/squid'); } catch { /* */ }
    try { run('sudo htpasswd -bc /etc/squid/htpasswd user password'); } catch {
      const hash = run('openssl passwd -apr1 password');
      fs.writeFileSync('/tmp/htpasswd', `user:${hash}\n`);
      run('sudo cp /tmp/htpasswd /etc/squid/htpasswd');
    }
    htpasswdPath = '/etc/squid/htpasswd';
    squidLogDir = '/var/log/squid';
    squidConf = '/tmp/squid-bruno.conf';

    let squidMajor = '5';
    try { squidMajor = run('squid -v 2>&1 | grep -oP \'Version \\K[0-9]+\' | head -1'); } catch { /* default */ }

    let template = fs.readFileSync(SQUID_CONF_TEMPLATE, 'utf8');
    if (parseInt(squidMajor) >= 6) {
      const httpsPortLine = `https_port 8091 tls-cert=${path.join(CERT_DIR, 'squid.crt').replace(/\\/g, '/')} tls-key=${path.join(CERT_DIR, 'squid.key').replace(/\\/g, '/')}`;
      template = template.replace(/https_port 8091 cert=@SQUID_CERT@/, httpsPortLine);
    } else {
      template = template.replace(/@SQUID_CERT@/g, squidCertPath);
    }
    template = template.replace('/usr/lib/squid/basic_ncsa_auth', ncsaAuthPath);
    template += '\nhosts_file /etc/hosts\n';

    fs.writeFileSync(squidConf, template);
  } else if (platform === 'win32') {
    // Windows: Squid installed via choco to C:\Squid
    const squidRoot = 'C:\\Squid';
    let ncsaAuth;
    try {
      const files = run(`dir /s /b "${squidRoot}\\*basic_ncsa_auth*" 2>nul`, { shell: 'cmd.exe' });
      ncsaAuth = files.split('\n')[0].trim();
    } catch { /* */ }
    if (!ncsaAuth) throw new Error('basic_ncsa_auth not found under C:\\Squid');
    ncsaAuthPath = ncsaAuth.replace(/\\/g, '/');

    const htpasswdDir = `${squidRoot}\\etc`;
    fs.mkdirSync(htpasswdDir, { recursive: true });
    const hash = run('openssl passwd -apr1 password');
    fs.writeFileSync(path.join(htpasswdDir, 'htpasswd'), `user:${hash}\n`);
    htpasswdPath = path.join(htpasswdDir, 'htpasswd').replace(/\\/g, '/');

    squidLogDir = path.join(os.tmpdir(), 'squid-logs').replace(/\\/g, '/');
    fs.mkdirSync(squidLogDir.replace(/\//g, path.sep), { recursive: true });
    squidConf = path.join(os.tmpdir(), 'squid-bruno.conf');

    let template = fs.readFileSync(SQUID_CONF_TEMPLATE, 'utf8');
    template = template
      .replace(/@SQUID_CERT@/g, squidCertPath)
      .replace('/usr/lib/squid/basic_ncsa_auth', ncsaAuthPath)
      .replace('/etc/squid/htpasswd', htpasswdPath)
      .replace('access_log stdio:/var/log/squid/access.log bruno', `access_log stdio:${squidLogDir}/access.log bruno`)
      .replace('cache_log /dev/null', `cache_log ${squidLogDir}/cache.log`);
    template += '\ndns_nameservers 8.8.8.8 8.8.4.4\n';

    fs.writeFileSync(squidConf, template);
  } else {
    throw new Error(`Unsupported platform: ${platform}`);
  }

  log(`  Squid config written to ${squidConf}`);
  return squidConf;
}

// =================================================================
// 4. Start all servers
// =================================================================
function startServers(squidConf) {
  log('Starting servers...');
  const procs = [];

  // Set env for node servers
  const env = { ...process.env, CERT_DIR };

  // HTTP server
  const httpProc = spawn('node', [path.join(__dirname, 'http-server.js')], { env, stdio: 'inherit' });
  procs.push({ name: 'http', proc: httpProc });

  // HTTPS server
  const httpsProc = spawn('node', [path.join(__dirname, 'https-server.js')], { env, stdio: 'inherit' });
  procs.push({ name: 'https', proc: httpsProc });

  // HTTPS client-cert server
  const httpsCertProc = spawn('node', [path.join(__dirname, 'https-client-cert-server.js')], { env, stdio: 'inherit' });
  procs.push({ name: 'https-client-cert', proc: httpsCertProc });

  // Squid proxy
  let squidCmd, squidArgs;
  if (platform === 'darwin') {
    // macOS: Squid 7 needs FD limit cap and short service name
    try { process.setrlimit?.('nofile', { soft: 4096, hard: 4096 }); } catch { /* ignore */ }
    squidCmd = 'squid';
    squidArgs = ['-N', '-n', 'sq', '-f', squidConf];
  } else if (platform === 'linux') {
    squidCmd = 'sudo';
    squidArgs = ['squid', '-N', '-f', squidConf];
  } else if (platform === 'win32') {
    const squidBin = fs.existsSync('C:\\Squid\\bin\\squid.exe') ? 'C:\\Squid\\bin\\squid.exe' : 'squid';
    squidCmd = squidBin;
    squidArgs = ['-N', '-f', squidConf];
  }

  const squidProc = spawn(squidCmd, squidArgs, { stdio: 'inherit' });
  procs.push({ name: 'squid', proc: squidProc });

  return procs;
}

// =================================================================
// 5. Health checks
// =================================================================
function waitForServer(name, checkFn, maxRetries = 30, intervalMs = 2000) {
  return new Promise((resolve, reject) => {
    let attempt = 0;
    const check = () => {
      attempt++;
      checkFn()
        .then(() => {
          log(`  ${name} ready`);
          resolve();
        })
        .catch(() => {
          if (attempt >= maxRetries) {
            reject(new Error(`${name} did not become ready after ${maxRetries} attempts`));
          } else {
            setTimeout(check, intervalMs);
          }
        });
    };
    check();
  });
}

function httpGet(url, options = {}) {
  return new Promise((resolve, reject) => {
    const mod = url.startsWith('https') ? https : http;
    const reqOpts = { ...options, timeout: 3000, rejectUnauthorized: false };
    const req = mod.get(url, reqOpts, (res) => {
      res.resume();
      if (res.statusCode === 200) resolve();
      else reject(new Error(`HTTP ${res.statusCode}`));
    });
    req.on('error', reject);
    req.on('timeout', () => {
      req.destroy(); reject(new Error('timeout'));
    });
  });
}

async function healthChecks() {
  log('Running health checks...');

  await waitForServer('HTTP :8070', () => httpGet('http://127.0.0.1:8070/'));
  await waitForServer('HTTPS :8071', () => httpGet('https://127.0.0.1:8071/', {
    ca: fs.readFileSync(path.join(CERT_DIR, 'server.pem'))
  }));
  await waitForServer('HTTPS client-cert :8072', () => httpGet('https://127.0.0.1:8072/', {
    ca: fs.readFileSync(path.join(CERT_DIR, 'server.pem')),
    cert: fs.readFileSync(path.join(CERT_DIR, 'client.crt')),
    key: fs.readFileSync(path.join(CERT_DIR, 'client.key'))
  }));
  await waitForServer('Squid HTTP :8090', () => {
    return new Promise((resolve, reject) => {
      const auth = Buffer.from('user:password').toString('base64');
      const req = http.get({
        hostname: '127.0.0.1', port: 8090,
        path: 'http://127.0.0.1:8070/',
        headers: { 'Proxy-Authorization': `Basic ${auth}` },
        timeout: 3000
      }, (res) => {
        res.resume();
        if (res.statusCode === 200) resolve();
        else reject(new Error(`HTTP ${res.statusCode}`));
      });
      req.on('error', reject);
      req.on('timeout', () => {
        req.destroy(); reject(new Error('timeout'));
      });
    });
  });

  log('All servers ready!');
  log('');
  log('  HTTP:           http://127.0.0.1:8070');
  log('  HTTPS:          https://127.0.0.1:8071');
  log('  HTTPS+mTLS:     https://127.0.0.1:8072');
  log('  Squid HTTP:     http://127.0.0.1:8090 (user:password)');
  log('  Squid HTTPS:    https://127.0.0.1:8091 (user:password)');
  log('  Certificates:   ' + CERT_DIR);
}

// =================================================================
// 6. Main
// =================================================================
async function main() {
  generateCerts();
  downloadBadsslCert();
  const squidConf = configureSquid();
  const procs = startServers(squidConf);

  // Cleanup on exit
  const cleanup = () => {
    log('Shutting down...');
    for (const { name, proc } of procs) {
      try { proc.kill(); } catch { /* ignore */ }
    }
    // Kill squid processes
    try {
      if (platform === 'win32') {
        run('taskkill /F /IM squid.exe 2>nul', { shell: 'cmd.exe' });
      } else {
        run('killall squid 2>/dev/null || true');
      }
    } catch { /* ignore */ }
    process.exit(0);
  };

  process.on('SIGINT', cleanup);
  process.on('SIGTERM', cleanup);

  // Wait a moment for servers to start binding
  await new Promise((r) => setTimeout(r, 3000));

  await healthChecks();

  log('');
  log('Press Ctrl+C to stop all servers.');
}

main().catch((err) => {
  console.error(`[setup] FATAL: ${err.message}`);
  process.exit(1);
});
