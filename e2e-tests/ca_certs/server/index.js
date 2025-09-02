const https = require('node:https');
const fs = require('node:fs');
const path = require('node:path');

var serverOptions = process.platform === 'win32' 
  ? {
      // Windows: Use PKCS#12 bundle
      pfx: fs.readFileSync(path.join(__dirname, './certs/localhost.p12'))
    }
  : {
      // Unix/Linux/macOS: Use PEM files
      key: fs.readFileSync(path.join(__dirname, './certs/localhost-key.pem')),
      cert: fs.readFileSync(path.join(__dirname, './certs/localhost-cert.pem'))
    };

(async () => {
  https.createServer(serverOptions, function (req, res) {
    res.setHeader('Content-Type', 'text/html; charset=UTF-8');
    res.end('ping');
  }).listen(8090, function () {
    console.log('Server is running on port 8090');
  });
})();