const http = require('http');

const ts = () => new Date().toISOString();

let socketCount = 0;
let requestCount = 0;

const server = http.createServer({ keepAlive: true, keepAliveInitialDelay: 0 }, (req, res) => {
  requestCount++;
  const socket = req.socket;
  socket._reqCount = (socket._reqCount || 0) + 1;

  const reused = socket._reqCount > 1;
  const connHeader = req.headers['connection'] || '-';
  console.log(`${ts()} [REQ  #${requestCount}] ${req.method} ${req.url} | socket #${socket._serverId} req #${socket._reqCount} ${reused ? '(REUSED)' : '(new)   '} | Connection: ${connHeader}`);

  res.writeHead(200, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify({ ok: true, request: requestCount, socket: socket._serverId, socketReq: socket._reqCount }));
});

server.on('connection', (socket) => {
  socketCount++;
  socket._serverId = socketCount;
  console.log(`${ts()} [SOCK #${socketCount}] New TCP connection from ${socket.remoteAddress}:${socket.remotePort}`);

  socket.on('close', () => {
    console.log(`${ts()} [SOCK #${socket._serverId}] Closed after ${socket._reqCount || 0} request(s)`);
  });
});

const PORT = process.env.PORT || 8070;
const HOST = process.env.HOST || '::';
server.listen(PORT, HOST, () => {
  console.log(`${ts()} HTTP server listening on ${HOST}:${PORT} (${HOST === '::' ? 'dual-stack' : 'IPv4'})`);
});
