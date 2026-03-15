const https = require('https');
const fs = require('fs');
const path = require('path');

const ts = () => new Date().toISOString();

const CERT_DIR = process.env.CERT_DIR || path.join(__dirname, 'certs');

const options = {
  key: fs.readFileSync(path.join(CERT_DIR, 'server.key')),
  cert: fs.readFileSync(path.join(CERT_DIR, 'server.crt')),
  ca: fs.readFileSync(path.join(CERT_DIR, 'client-ca.crt')),
  requestCert: true,
  rejectUnauthorized: true,
  keepAlive: true,
  keepAliveInitialDelay: 0
};

let socketCount = 0;
let requestCount = 0;

const server = https.createServer(options, (req, res) => {
  requestCount++;
  const socket = req.socket;
  socket._reqCount = (socket._reqCount || 0) + 1;

  const cert = socket.getPeerCertificate();
  const subject = cert && cert.subject ? cert.subject.CN : 'none';

  console.log(`${ts()} [REQ  #${requestCount}] ${req.method} ${req.url} | socket #${socket._serverId} req #${socket._reqCount} | client CN=${subject}`);

  res.writeHead(200, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify({ ok: true, clientCN: subject, request: requestCount }));
});

server.on('secureConnection', (socket) => {
  if (socket._serverId !== undefined) return;
  socketCount++;
  socket._serverId = socketCount;

  console.log(`${ts()} [TLS  #${socketCount}] Client cert connection from ${socket.remoteAddress}:${socket.remotePort}`);

  socket.on('close', () => {
    console.log(`${ts()} [TLS  #${socket._serverId}] Closed after ${socket._reqCount || 0} request(s)`);
  });
});

const PORT = process.env.PORT || 8072;
server.listen(PORT, '::', () => {
  console.log(`${ts()} HTTPS client-cert server listening on [::]:${PORT} (dual-stack)`);
});
