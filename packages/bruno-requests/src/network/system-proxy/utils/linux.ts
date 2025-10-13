import { exec, ExecOptions } from 'node:child_process';
import { promisify } from 'node:util';
import { readFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { ProxyConfiguration, ProxyDetector } from '../types';
import { normalizeProxyUrl, normalizeNoProxy } from './common';

const execAsync = promisify(exec);

// Enum of allowed commands to prevent injection
enum AllowedLinuxCommands {
  GSETTINGS_MODE = 'gsettings get org.gnome.system.proxy mode 2>/dev/null',
  GSETTINGS_HTTP_HOST = 'gsettings get org.gnome.system.proxy.http host 2>/dev/null',
  GSETTINGS_HTTP_PORT = 'gsettings get org.gnome.system.proxy.http port 2>/dev/null',
  GSETTINGS_HTTPS_HOST = 'gsettings get org.gnome.system.proxy.https host 2>/dev/null',
  GSETTINGS_HTTPS_PORT = 'gsettings get org.gnome.system.proxy.https port 2>/dev/null',
  GSETTINGS_IGNORE_HOSTS = 'gsettings get org.gnome.system.proxy ignore-hosts 2>/dev/null',
  KDE_PROXY_TYPE = 'kreadconfig5 --group "Proxy Settings" --key "ProxyType" 2>/dev/null',
  KDE_HTTP_PROXY = 'kreadconfig5 --group "Proxy Settings" --key "httpProxy" 2>/dev/null',
  KDE_HTTPS_PROXY = 'kreadconfig5 --group "Proxy Settings" --key "httpsProxy" 2>/dev/null',
  KDE_NO_PROXY = 'kreadconfig5 --group "Proxy Settings" --key "NoProxyFor" 2>/dev/null'
}

export class LinuxProxyDetector implements ProxyDetector {
  async detect(opts?: { timeoutMs?: number }): Promise<ProxyConfiguration> {
    const timeoutMs = opts?.timeoutMs ?? 10000;
    const execOpts: ExecOptions = {
      timeout: timeoutMs,
      maxBuffer: 1024 * 1024
    };

    try {
      // Try different proxy detection methods in order of preference
      const detectionMethods = [
        () => this.getGSettingsProxy(execOpts),
        () => this.getKDEProxy(execOpts),
        () => this.getEnvironmentFileProxy(),
        () => this.getSystemdProxy()
      ];

      for (const method of detectionMethods) {
        try {
          const proxy = await method();
          if (proxy) {
            return proxy;
          }
        } catch (error) {
          // Continue to next method if this one fails
          continue;
        }
      }

      throw new Error('No Linux proxy configuration found');
    } catch (error) {
      throw new Error(`Linux proxy detection failed: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  private async getGSettingsProxy(execOpts: ExecOptions): Promise<ProxyConfiguration | null> {
    try {
      const { stdout: mode } = await execAsync(AllowedLinuxCommands.GSETTINGS_MODE, execOpts);
      if (mode.trim() !== '\'manual\'') {
        return null;
      }

      const { stdout: httpHost } = await execAsync(AllowedLinuxCommands.GSETTINGS_HTTP_HOST, execOpts);
      const { stdout: httpPort } = await execAsync(AllowedLinuxCommands.GSETTINGS_HTTP_PORT, execOpts);
      const { stdout: httpsHost } = await execAsync(AllowedLinuxCommands.GSETTINGS_HTTPS_HOST, execOpts);
      const { stdout: httpsPort } = await execAsync(AllowedLinuxCommands.GSETTINGS_HTTPS_PORT, execOpts);
      const { stdout: ignoreHosts } = await execAsync(AllowedLinuxCommands.GSETTINGS_IGNORE_HOSTS, execOpts);

      const cleanHttpHost = httpHost.trim().replace(/'/g, '');
      const cleanHttpPort = httpPort.trim();
      const cleanHttpsHost = httpsHost.trim().replace(/'/g, '');
      const cleanHttpsPort = httpsPort.trim();
      const cleanIgnoreHosts = ignoreHosts.trim();

      const http_proxy = cleanHttpHost && cleanHttpPort ? normalizeProxyUrl(`${cleanHttpHost}:${cleanHttpPort}`) : null;
      const https_proxy = cleanHttpsHost && cleanHttpsPort ? normalizeProxyUrl(`${cleanHttpsHost}:${cleanHttpsPort}`) : null;

      const rawNoProxy = cleanIgnoreHosts !== '[]' ? cleanIgnoreHosts.replace(/[\[\]']/g, '').replace(/,\s*/g, ',') : null;

      return {
        http_proxy,
        https_proxy,
        no_proxy: normalizeNoProxy(rawNoProxy),
        source: 'linux-system'
      };
    } catch (error) {
      return null;
    }
  }

  private async getKDEProxy(execOpts: ExecOptions): Promise<ProxyConfiguration | null> {
    try {
      // Check if kreadconfig5 is available and get proxy type
      const { stdout: proxyType } = await execAsync(AllowedLinuxCommands.KDE_PROXY_TYPE, execOpts);
      const type = proxyType.trim();

      // ProxyType values:
      // 0 = No proxy
      // 1 = Manual proxy configuration
      // 2 = Automatic proxy configuration via URL
      // 3 = Automatic proxy detection
      // 4 = Use system proxy configuration (environment variables)

      if (type !== '1') {
        // Only handle manual proxy configuration for now
        return null;
      }

      const { stdout: httpProxy } = await execAsync(AllowedLinuxCommands.KDE_HTTP_PROXY, execOpts);
      const { stdout: httpsProxy } = await execAsync(AllowedLinuxCommands.KDE_HTTPS_PROXY, execOpts);
      const { stdout: noProxy } = await execAsync(AllowedLinuxCommands.KDE_NO_PROXY, execOpts);

      const cleanHttpProxy = httpProxy.trim();
      const cleanHttpsProxy = httpsProxy.trim();
      const cleanNoProxy = noProxy.trim();

      const http_proxy = cleanHttpProxy ? normalizeProxyUrl(cleanHttpProxy) : null;
      const https_proxy = cleanHttpsProxy ? normalizeProxyUrl(cleanHttpsProxy) : null;

      return {
        http_proxy,
        https_proxy,
        no_proxy: normalizeNoProxy(cleanNoProxy || null),
        source: 'linux-system'
      };
    } catch (error) {
      return null;
    }
  }

  private async getEnvironmentFileProxy(): Promise<ProxyConfiguration | null> {
    try {
      if (!existsSync('/etc/environment')) {
        return null;
      }
      const content = await readFile('/etc/environment', 'utf8');
      return this.parseProxyFromContent(content);
    } catch (error) {
      return null;
    }
  }

  private async getSystemdProxy(): Promise<ProxyConfiguration | null> {
    try {
      const systemdConfDir = '/etc/systemd/system.conf.d';
      if (!existsSync(systemdConfDir)) {
        return null;
      }

      // Look for systemd proxy configuration files
      const systemdFiles = ['proxy.conf', 'environment.conf'];
      let content = '';

      for (const file of systemdFiles) {
        const filePath = `${systemdConfDir}/${file}`;
        if (existsSync(filePath)) {
          const fileContent = await readFile(filePath, 'utf8');
          content += fileContent + '\n';
        }
      }

      if (!content) {
        return null;
      }

      return this.parseProxyFromContent(content);
    } catch (error) {
      return null;
    }
  }

  private parseProxyFromContent(content: string): ProxyConfiguration | null {
    const proxyVars = ['http_proxy', 'https_proxy', 'no_proxy', 'all_proxy', 'HTTP_PROXY', 'HTTPS_PROXY', 'NO_PROXY', 'ALL_PROXY'];
    const proxies: Record<string, string> = {};

    const lines = content.split('\n');
    for (const line of lines) {
      const trimmedLine = line.trim();

      // Skip comments and empty lines
      if (!trimmedLine || trimmedLine.startsWith('#')) {
        continue;
      }

      // Handle systemd Environment= and DefaultEnvironment= directives
      const systemdEnvMatch = trimmedLine.match(/^(Default)?Environment\s*=\s*(.+)$/i);
      if (systemdEnvMatch) {
        const envVars = systemdEnvMatch[2];
        // Parse key=value pairs from the directive (handles quoted and unquoted values)
        const kvPairs = envVars.match(/([A-Z_]+)=(?:"([^"]*)"|'([^']*)'|(\S+))/gi);
        if (kvPairs) {
          for (const pair of kvPairs) {
            const [key, ...valueParts] = pair.split('=');
            const value = valueParts.join('=').replace(/^["']|["']$/g, '');
            if (proxyVars.some((v) => v.toLowerCase() === key.toLowerCase())) {
              proxies[key.toLowerCase()] = value;
            }
          }
        }
        continue;
      }

      // Handle different formats: VAR=value, export VAR=value, VAR="value", etc.
      for (const varName of proxyVars) {
        const patterns = [
          new RegExp(`^export\\s+${varName}\\s*=\\s*(.+)$`, 'i'),
          new RegExp(`^${varName}\\s*=\\s*(.+)$`, 'i')
        ];

        for (const pattern of patterns) {
          const match = trimmedLine.match(pattern);
          if (match) {
            let value = match[1].trim();
            // Remove surrounding quotes
            value = value.replace(/^["']|["']$/g, '');
            proxies[varName.toLowerCase()] = value;
            break;
          }
        }
      }
    }

    // Convert to ProxyConfiguration format with ALL_PROXY fallback
    const httpProxy = proxies.http_proxy || proxies.all_proxy || null;
    const httpsProxy = proxies.https_proxy || proxies.all_proxy || null;
    const http_proxy = httpProxy ? normalizeProxyUrl(httpProxy) : null;
    const https_proxy = httpsProxy ? normalizeProxyUrl(httpsProxy) : null;
    const no_proxy = proxies.no_proxy || null;

    if (http_proxy || https_proxy) {
      return {
        http_proxy,
        https_proxy,
        no_proxy: normalizeNoProxy(no_proxy),
        source: 'linux-system'
      };
    }

    return null;
  }
}
