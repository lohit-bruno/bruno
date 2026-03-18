import { execSync } from 'child_process';
import path from 'path';
import fs from 'fs';

const CERT_DIR = path.resolve(__dirname, 'server', 'certs');
const BADSSL_P12_URL = 'https://badssl.com/certs/badssl.com-client.p12';
const BADSSL_PEM_URL = 'https://badssl.com/certs/badssl.com-client.pem';

function download(url: string, dest: string): boolean {
  try {
    execSync(`curl -fsSL -o "${dest}" "${url}"`, { timeout: 30_000 });
    return fs.existsSync(dest) && fs.statSync(dest).size > 0;
  } catch {
    return false;
  }
}

export default function globalSetup() {
  fs.mkdirSync(CERT_DIR, { recursive: true });

  const p12Path = path.join(CERT_DIR, 'badssl-client.p12');
  const pemPath = path.join(CERT_DIR, 'badssl-client.pem');

  if (!fs.existsSync(pemPath) || fs.statSync(pemPath).size === 0) {
    console.log('Downloading badssl client certificate...');
    download(BADSSL_P12_URL, p12Path);
    download(BADSSL_PEM_URL, pemPath);

    if (fs.existsSync(pemPath)) {
      console.log(`badssl client cert downloaded to ${CERT_DIR}`);
    } else {
      console.warn('WARNING: Failed to download badssl client certificate — badssl tests may fail');
    }
  }
}
