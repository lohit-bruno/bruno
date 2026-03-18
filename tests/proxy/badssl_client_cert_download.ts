import { test } from '@playwright/test';
import * as fs from 'fs';
import * as path from 'path';
import * as https from 'https';

const BADSSL_P12_URL = 'https://badssl.com/certs/badssl.com-client.p12';
const BADSSL_PEM_URL = 'https://badssl.com/certs/badssl.com-client.pem';
const CERT_DIR = path.join(__dirname, 'server', 'certs');
const P12_PATH = path.join(CERT_DIR, 'badssl-client.p12');
const PEM_PATH = path.join(CERT_DIR, 'badssl-client.pem');

function download(url: string, dest: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const file = fs.createWriteStream(dest);
    https.get(url, (response) => {
      if (response.statusCode === 301 || response.statusCode === 302) {
        const redirectUrl = response.headers.location;
        if (redirectUrl) {
          file.close();
          fs.unlinkSync(dest);
          return download(redirectUrl, dest).then(resolve, reject);
        }
      }
      if (response.statusCode !== 200) {
        file.close();
        fs.unlinkSync(dest);
        return reject(new Error(`Failed to download ${url}: HTTP ${response.statusCode}`));
      }
      response.pipe(file);
      file.on('finish', () => {
        file.close();
        resolve();
      });
    }).on('error', (err) => {
      file.close();
      fs.unlinkSync(dest);
      reject(err);
    });
  });
}

test('download badssl client certificate', async () => {
  await fs.promises.mkdir(CERT_DIR, { recursive: true });

  if (fs.existsSync(PEM_PATH) && (await fs.promises.stat(PEM_PATH)).size > 0) {
    console.log(`badssl client cert already exists at ${CERT_DIR}`);
    return;
  }

  console.log('Downloading badssl client certificate...');
  await download(BADSSL_P12_URL, P12_PATH);
  await download(BADSSL_PEM_URL, PEM_PATH);
  console.log(`Downloaded to ${CERT_DIR}`);
});
