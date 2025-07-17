const os = require('os');
const { exec } = require('child_process');
const { promisify } = require('util');

const execAsync = promisify(exec);

class SystemProxyDetector {
  constructor() {
    this.platform = os.platform();
    this.cache = new Map();
    this.cacheTimeout = 30000; // 30 seconds
  }

  async getSystemProxy() {
    const cacheKey = 'system-proxy';
    const cached = this.cache.get(cacheKey);
    
    if (cached && Date.now() - cached.timestamp < this.cacheTimeout) {
      return cached.data;
    }

    const startTime = Date.now();
    
    try {
      const result = await this.getSystemProxyByPlatform();
      
      // Log detection time for performance monitoring
      const detectionTime = Date.now() - startTime;
      if (detectionTime > 5000) { // 5 seconds
        console.warn(`System proxy detection took ${detectionTime}ms`);
      }
      
      this.cache.set(cacheKey, {
        data: result,
        timestamp: Date.now()
      });
      
      return result;
    } catch (error) {
      console.warn(`System proxy detection failed after ${Date.now() - startTime}ms:`, error.message);
      return this.getEnvironmentVariables();
    }
  }

  async getSystemProxyByPlatform() {
    // Add timeout to prevent hanging
    const timeoutPromise = new Promise((_, reject) => {
      setTimeout(() => reject(new Error('System proxy detection timeout')), 10000);
    });

    const detectionPromise = this.getSystemProxyInternal();
    
    return await Promise.race([detectionPromise, timeoutPromise]);
  }

  async getSystemProxyInternal() {
    try {
      switch (this.platform) {
        case 'win32':
          return await this.getWindowsProxy();
        case 'darwin':
          return await this.getMacProxy();
        case 'linux':
        default:
          return this.getLinuxProxy();
      }
    } catch (error) {
      console.warn(`Failed to detect system proxy: ${error.message}`);
      return this.getEnvironmentVariables();
    }
  }

  getEnvironmentVariables() {
    const { http_proxy, HTTP_PROXY, https_proxy, HTTPS_PROXY, no_proxy, NO_PROXY } = process.env;
    return {
      http_proxy: http_proxy || HTTP_PROXY,
      https_proxy: https_proxy || HTTPS_PROXY,
      no_proxy: no_proxy || NO_PROXY,
      source: 'environment'
    };
  }

  // Windows proxy detection
  async getWindowsProxy() {
    // Priority order for Windows:
    // 1. Environment Variables (already handled)
    // 2. Internet Options (Registry)
    // 3. WinHTTP settings

    try {
      // Check Internet Options via Registry
      const internetOptions = await this.getWindowsInternetOptions();
      if (internetOptions) return internetOptions;

      // Check WinHTTP settings
      const winHttpProxy = await this.getWindowsWinHttpProxy();
      if (winHttpProxy) return winHttpProxy;

    } catch (error) {
      console.warn(`Windows proxy detection failed: ${error.message}`);
    }

    return this.getEnvironmentVariables();
  }

  async getWindowsInternetOptions() {
    try {
      // Query registry for Internet Options proxy settings
      const regQuery = 'reg query "HKCU\\Software\\Microsoft\\Windows\\CurrentVersion\\Internet Settings" /v ProxyEnable /v ProxyServer /v ProxyOverride';
      const { stdout } = await execAsync(regQuery);
      
      const lines = stdout.split('\n');
      let proxyEnabled = false;
      let proxyServer = null;
      let proxyOverride = null;

      for (const line of lines) {
        if (line.includes('ProxyEnable') && line.includes('REG_DWORD')) {
          proxyEnabled = line.includes('0x1');
        }
        if (line.includes('ProxyServer') && line.includes('REG_SZ')) {
          const match = line.match(/REG_SZ\s+(.+)/);
          if (match) proxyServer = match[1].trim();
        }
        if (line.includes('ProxyOverride') && line.includes('REG_SZ')) {
          const match = line.match(/REG_SZ\s+(.+)/);
          if (match) proxyOverride = match[1].trim();
        }
      }

      if (proxyEnabled && proxyServer) {
        return this.parseWindowsProxyString(proxyServer, proxyOverride);
      }
    } catch (error) {
      // Registry access might fail, continue to next method
    }
    return null;
  }

  async getWindowsWinHttpProxy() {
    try {
      const { stdout } = await execAsync('netsh winhttp show proxy');
      
      if (stdout.includes('Direct access (no proxy server)')) {
        return null;
      }

      const proxyServerMatch = stdout.match(/Proxy Server\(s\)\s*:\s*(.+)/);
      const bypassListMatch = stdout.match(/Bypass List\s*:\s*(.+)/);

      if (proxyServerMatch) {
        const proxyServer = proxyServerMatch[1].trim();
        const bypassList = bypassListMatch ? bypassListMatch[1].trim() : '';
        
        return this.parseWindowsProxyString(proxyServer, bypassList);
      }
    } catch (error) {
      // netsh command might not be available
    }
    return null;
  }

  parseWindowsProxyString(proxyServer, bypassList) {
    // Handle different proxy server formats:
    // "proxy.example.com:8080" (single proxy for all protocols)
    // "http=proxy1:8080;https=proxy2:8080" (protocol-specific)
    
    let http_proxy = null;
    let https_proxy = null;

    if (proxyServer.includes('=')) {
      // Protocol-specific format
      const protocols = proxyServer.split(';');
      for (const protocol of protocols) {
        const [proto, server] = protocol.split('=');
        if (proto === 'http') {
          http_proxy = server.startsWith('http://') ? server : `http://${server}`;
        } else if (proto === 'https') {
          https_proxy = server.startsWith('https://') ? server : `https://${server}`;
        }
      }
    } else {
      // Single proxy for all protocols
      const proxy = proxyServer.startsWith('http://') ? proxyServer : `http://${proxyServer}`;
      http_proxy = proxy;
      https_proxy = proxy;
    }

    return {
      http_proxy,
      https_proxy,
      no_proxy: bypassList && bypassList !== '(none)' ? bypassList.replace(/;/g, ',') : null,
      source: 'windows-system'
    };
  }

  // macOS proxy detection
  async getMacProxy() {
    try {
      // Use scutil to get system proxy settings
      const { stdout } = await execAsync('scutil --proxy');

      console.log("mac", stdout);
      
      return this.parseMacProxyOutput(stdout);
    } catch (error) {
      console.warn(`macOS proxy detection failed: ${error.message}`);
      return this.getEnvironmentVariables();
    }
  }

  parseMacProxyOutput(output) {
    // Handle both array input and string input
    const lines = Array.isArray(output) ? output : output.split('\n');
    
    // Remove empty lines and trim whitespace
    const cleanLines = lines.filter(line => line.trim()).map(line => line.trim());
    
    // Find the start of the dictionary
    const dictStart = cleanLines.findIndex(line => line.includes('<dictionary>'));
    if (dictStart === -1) return null;
    
    const config = {};
    let i = dictStart + 1;
    
    while (i < cleanLines.length && !cleanLines[i].includes('}')) {
      const line = cleanLines[i];
      
      // Skip empty lines
      if (!line.trim()) {
        i++;
        continue;
      }
      
      // Parse key-value pairs
      const keyValueMatch = line.match(/^([^:]+)\s*:\s*(.+)$/);
      if (keyValueMatch) {
        const key = keyValueMatch[1].trim();
        const value = keyValueMatch[2].trim();
        
        // Handle different value types
        if (value === '<array> {') {
          // Parse array
          const array = [];
          i++;
          while (i < cleanLines.length && !cleanLines[i].includes('}')) {
            const arrayLine = cleanLines[i].trim();
            const arrayMatch = arrayLine.match(/^\d+\s*:\s*(.+)$/);
            if (arrayMatch) {
              array.push(arrayMatch[1].trim());
            }
            i++;
          }
          config[key] = array;
        } else if (value.match(/^\d+$/)) {
          // Parse number
          config[key] = parseInt(value, 10);
        } else if (value === '1') {
          // Parse boolean (1 = true, 0 = false)
          config[key] = true;
        } else if (value === '0') {
          config[key] = false;
        } else {
          // Parse string
          config[key] = value;
        }
      }
      
      i++;
    }

    let http_proxy = null;
    let https_proxy = null;
    let no_proxy = null;

    // Check HTTP proxy
    if (config.HTTPEnable === 1 && config.HTTPProxy) {
      const port = config.HTTPPort || 80;
      http_proxy = `http://${config.HTTPProxy}:${port}`;
    }

    // Check HTTPS proxy
    if (config.HTTPSEnable === 1 && config.HTTPSProxy) {
      const port = config.HTTPSPort || 443;
      https_proxy = `https://${config.HTTPSProxy}:${port}`;
    }

    // Check bypass list
    if (config.ExceptionsList && Array.isArray(config.ExceptionsList)) {
      no_proxy = config.ExceptionsList.join(',');
    }

    // Handle "exclude simple hostnames" setting
    if (config.ExcludeSimpleHostnames === 1) {
      no_proxy = no_proxy ? `${no_proxy},<local>` : '<local>';
    }

    return {
      http_proxy,
      https_proxy,
      no_proxy,
      source: 'macos-system'
    };
  }


  // Linux proxy detection
  getLinuxProxy() {
    // On Linux, we primarily rely on environment variables
    // But also check common configuration files

    const envVars = this.getEnvironmentVariables();
    
    // Try to read from common configuration files
    const gsettingsProxy = this.getGSettingsProxy();

    // Environment variables take precedence
    return {
      http_proxy: envVars.http_proxy || gsettingsProxy?.http_proxy,
      https_proxy: envVars.https_proxy || gsettingsProxy?.https_proxy,
      no_proxy: envVars.no_proxy || gsettingsProxy?.no_proxy,
      source: envVars.http_proxy ? 'environment' : 'linux-system'
    };
  }

  getGSettingsProxy() {
    // GNOME/GTK applications proxy settings
    try {
      const { execSync } = require('child_process');
      
      const mode = execSync('gsettings get org.gnome.system.proxy mode 2>/dev/null', { encoding: 'utf8' }).trim();
      if (mode !== "'manual'") {
        return null;
      }

      const httpHost = execSync('gsettings get org.gnome.system.proxy.http host 2>/dev/null', { encoding: 'utf8' }).trim().replace(/'/g, '');
      const httpPort = execSync('gsettings get org.gnome.system.proxy.http port 2>/dev/null', { encoding: 'utf8' }).trim();
      const httpsHost = execSync('gsettings get org.gnome.system.proxy.https host 2>/dev/null', { encoding: 'utf8' }).trim().replace(/'/g, '');
      const httpsPort = execSync('gsettings get org.gnome.system.proxy.https port 2>/dev/null', { encoding: 'utf8' }).trim();
      const ignoreHosts = execSync('gsettings get org.gnome.system.proxy ignore-hosts 2>/dev/null', { encoding: 'utf8' }).trim();

      return {
        http_proxy: httpHost && httpPort ? `http://${httpHost}:${httpPort}` : null,
        https_proxy: httpsHost && httpsPort ? `https://${httpsHost}:${httpsPort}` : null,
        no_proxy: ignoreHosts !== '[]' ? ignoreHosts.replace(/[\[\]']/g, '').replace(/,\s*/g, ',') : null
      };
    } catch (error) {
      // gsettings not available or failed
      return null;
    }
  }

  // Clear cache
  clearCache() {
    this.cache.clear();
  }
}

const systemProxyDetector = new SystemProxyDetector();

async function getSystemProxy() {
  try {
    return await systemProxyDetector.getSystemProxy();
  } catch (error) {
    return systemProxyDetector.getEnvironmentVariables();
  }
}

module.exports = {
  getSystemProxy
};