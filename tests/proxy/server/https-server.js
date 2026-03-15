const https = require('https');
const fs = require('fs');
const path = require('path');

const ts = () => new Date().toISOString();

const CERT_DIR = process.env.CERT_DIR || '/certs';

const options = {
  key: fs.readFileSync(path.join(CERT_DIR, 'server.key')),
  cert: fs.readFileSync(path.join(CERT_DIR, 'server.crt')),
  keepAlive: true,
  keepAliveInitialDelay: 0
};

let socketCount = 0;
let requestCount = 0;
let newSessions = 0;
let resumedSessions = 0;

const server = https.createServer(options, (req, res) => {
  requestCount++;
  const socket = req.socket;
  socket._reqCount = (socket._reqCount || 0) + 1;

  const reused = socket._reqCount > 1;
  const connHeader = req.headers['connection'] || '-';
  console.log(`${ts()} [REQ  #${requestCount}] ${req.method} ${req.url} | socket #${socket._serverId} req #${socket._reqCount} ${reused ? '(REUSED)' : '(new)   '} | Connection: ${connHeader}`);

  res.writeHead(200, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify({ ok: true, request: requestCount, socket: socket._serverId, socketReq: socket._reqCount, isSessionReused: socket.isSessionReused?.() }));
});

server.on('secureConnection', (socket) => {
  // Guard against duplicate secureConnection events (Node.js fires it for
  // both the underlying TCP socket and the TLS upgrade on keepAlive servers)
  if (socket._serverId !== undefined) return;

  socketCount++;
  socket._serverId = socketCount;

  const tlsReused = socket.isSessionReused();
  if (tlsReused) {
    resumedSessions++;
    console.log(`${ts()} [TLS  #${socketCount}] Session RESUMED  from ${socket.remoteAddress}:${socket.remotePort} | ${socket.getProtocol()} ${socket.getCipher()?.name} | new=${newSessions} resumed=${resumedSessions}`);
  } else {
    newSessions++;
    console.log(`${ts()} [TLS  #${socketCount}] New handshake   from ${socket.remoteAddress}:${socket.remotePort} | ${socket.getProtocol()} ${socket.getCipher()?.name} | new=${newSessions} resumed=${resumedSessions}`);
  }

  socket.on('close', () => {
    console.log(`${ts()} [TLS  #${socket._serverId}] Closed after ${socket._reqCount || 0} request(s)`);
  });
});

const PORT = process.env.PORT || 8071;
server.listen(PORT, '::', () => {
  console.log(`${ts()} HTTPS server listening on [::]:${PORT} (dual-stack)`);
});
