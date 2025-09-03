const https = require('node:https');
const fs = require('node:fs');
const path = require('node:path');
const { execCommand, execCommandSilent, detectPlatform } = require('./cert-helpers');

/**
 * Simple server helper functions
 */

function killProcessOnPort(port) {
  const platform = detectPlatform();
  
  try {
    switch (platform) {
      case 'macos':
        execCommand(`lsof -ti :${port} | xargs kill -9`);
        break;
      case 'linux':
        execCommand(`fuser -k ${port}/tcp`);
        break;
      case 'windows':
        const result = execCommandSilent(`netstat -ano | findstr :${port}`);
        const lines = result.toString().split('\n');
        for (const line of lines) {
          const match = line.trim().match(/\s+(\d+)$/);
          if (match) {
            execCommandSilent(`taskkill /F /PID ${match[1]}`);
          }
        }
        break;
    }
  } catch (error) {
    // No process on port - this is fine
  }
}

function createServer(certsDir, port = 8090) {
  const serverOptions = {
    key: fs.readFileSync(path.join(certsDir, 'localhost-key.pem')),
    cert: fs.readFileSync(path.join(certsDir, 'localhost-cert.pem'))
  };

  const server = https.createServer(serverOptions, (req, res) => {
    res.setHeader('Content-Type', 'text/html; charset=UTF-8');
    res.end('ping');
  });

  return new Promise((resolve, reject) => {
    server.listen(port, (error) => {
      if (error) {
        reject(error);
      } else {
        resolve(server);
      }
    });
  });
}

async function testServer(port = 8090) {
  return new Promise((resolve) => {
    const req = https.request({
      hostname: 'localhost',
      port: port,
      path: '/',
      method: 'GET',
      rejectUnauthorized: false,
      timeout: 5000
    }, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        resolve(data.trim() === 'ping');
      });
    });

    req.on('error', () => {
      resolve(false);
    });

    req.on('timeout', () => {
      req.destroy();
      resolve(false);
    });

    req.end();
  });
}

function setupGracefulShutdown(server, cleanup) {
  const shutdown = (signal) => {
    console.log(`\nreceived ${signal}, shutting down...`);
    
    if (cleanup) cleanup();
    
    if (server) {
      server.close(() => {
        process.exit(0);
      });
    } else {
      process.exit(0);
    }
  };

  process.on('SIGINT', () => shutdown('SIGINT'));
  process.on('SIGTERM', () => shutdown('SIGTERM'));
}

async function waitForServer(port = 8090, maxAttempts = 10) {
  for (let i = 1; i <= maxAttempts; i++) {
    if (await testServer(port)) {
      return true;
    }
    
    if (i < maxAttempts) {
      await new Promise(resolve => setTimeout(resolve, 2000));
    }
  }
  
  return false;
}

module.exports = {
  killProcessOnPort,
  createServer,
  testServer,
  setupGracefulShutdown,
  waitForServer
};
