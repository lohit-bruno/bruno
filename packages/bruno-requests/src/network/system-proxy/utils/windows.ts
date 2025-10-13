import { exec, ExecOptions } from 'node:child_process';
import { promisify } from 'node:util';
import { ProxyConfiguration, ProxyDetector } from '../types';
import { normalizeProxyUrl, normalizeNoProxy } from './common';

const execAsync = promisify(exec);

// Enum of allowed commands to prevent injection
enum AllowedWindowsCommands {
  INTERNET_SETTINGS = 'reg query "HKCU\\Software\\Microsoft\\Windows\\CurrentVersion\\Internet Settings"',
  WINHTTP_PROXY = 'netsh winhttp show proxy',
  SYSTEM_ENV_PROXY = 'reg query "HKLM\\SYSTEM\\CurrentControlSet\\Control\\Session Manager\\Environment"',
  USER_ENV_PROXY = 'reg query "HKCU\\Environment"'
}

export class WindowsProxyDetector implements ProxyDetector {
  async detect(opts?: { timeoutMs?: number }): Promise<ProxyConfiguration> {
    const timeoutMs = opts?.timeoutMs ?? 10000;
    const execOpts: ExecOptions = {
      timeout: timeoutMs,
      windowsHide: true,
      maxBuffer: 1024 * 1024
    };

    try {
      // Try different detection methods in order of preference
      const detectionMethods = [
        () => this.getInternetOptions(execOpts),
        () => this.getWinHttpProxy(execOpts),
        () => this.getSystemProxyEnvironment(execOpts),
        () => this.getUserEnvironmentProxy(execOpts)
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

      throw new Error('No Windows proxy configuration found');
    } catch (error) {
      throw new Error(`Windows proxy detection failed: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  private async getInternetOptions(execOpts: ExecOptions): Promise<ProxyConfiguration | null> {
    try {
      const { stdout } = await execAsync(AllowedWindowsCommands.INTERNET_SETTINGS, execOpts);

      const lines = stdout.split('\n');
      let proxyEnabled = false;
      let proxyServer: string | null = null;
      let proxyOverride: string | null = null;

      for (const line of lines) {
        const trimmedLine = line.trim();

        if (trimmedLine.includes('ProxyEnable') && trimmedLine.includes('REG_DWORD')) {
          // Extract the value after REG_DWORD
          const match = trimmedLine.match(/ProxyEnable\s+REG_DWORD\s+(0x[0-9a-fA-F]+|\d+)/);
          if (match) {
            const value = match[1];
            proxyEnabled = (value === '0x1' || value === '1');
          }
        }

        if (trimmedLine.includes('ProxyServer') && trimmedLine.includes('REG_SZ')) {
          const match = trimmedLine.match(/ProxyServer\s+REG_SZ\s+(.+)/);
          if (match) proxyServer = match[1].trim();
        }

        if (trimmedLine.includes('ProxyOverride') && trimmedLine.includes('REG_SZ')) {
          const match = trimmedLine.match(/ProxyOverride\s+REG_SZ\s+(.+)/);
          if (match) proxyOverride = match[1].trim();
        }
      }

      if (proxyEnabled && proxyServer) {
        return this.parseProxyString(proxyServer, proxyOverride);
      }

      return null;
    } catch (error) {
      return null;
    }
  }

  private async getWinHttpProxy(execOpts: ExecOptions): Promise<ProxyConfiguration | null> {
    try {
      const { stdout } = await execAsync(AllowedWindowsCommands.WINHTTP_PROXY, execOpts);

      if (stdout.includes('Direct access (no proxy server)')) {
        return null;
      }

      const proxyServerMatch = stdout.match(/Proxy Server\(s\)\s*:\s*(.+)/);
      const bypassListMatch = stdout.match(/Bypass List\s*:\s*(.+)/);

      if (proxyServerMatch) {
        const proxyServer = proxyServerMatch[1].trim();
        const bypassList = bypassListMatch ? bypassListMatch[1].trim() : '';

        return this.parseProxyString(proxyServer, bypassList);
      }

      return null;
    } catch (error) {
      return null;
    }
  }

  private async getSystemProxyEnvironment(execOpts: ExecOptions): Promise<ProxyConfiguration | null> {
    try {
      // Check for system-wide proxy environment variables
      const { stdout } = await execAsync(AllowedWindowsCommands.SYSTEM_ENV_PROXY, execOpts);

      const lines = stdout.split('\n');
      let http_proxy: string | null = null;
      let https_proxy: string | null = null;
      let no_proxy: string | null = null;

      for (const line of lines) {
        const trimmedLine = line.trim();

        if (trimmedLine.includes('HTTP_PROXY') && trimmedLine.includes('REG_SZ')) {
          const match = trimmedLine.match(/HTTP_PROXY\s+REG_SZ\s+(.+)/);
          if (match) http_proxy = match[1].trim();
        }

        if (trimmedLine.includes('HTTPS_PROXY') && trimmedLine.includes('REG_SZ')) {
          const match = trimmedLine.match(/HTTPS_PROXY\s+REG_SZ\s+(.+)/);
          if (match) https_proxy = match[1].trim();
        }

        if (trimmedLine.includes('NO_PROXY') && trimmedLine.includes('REG_SZ')) {
          const match = trimmedLine.match(/NO_PROXY\s+REG_SZ\s+(.+)/);
          if (match) no_proxy = match[1].trim();
        }
      }

      if (http_proxy || https_proxy) {
        return {
          http_proxy,
          https_proxy,
          no_proxy,
          source: 'windows-system'
        };
      }

      return null;
    } catch (error) {
      return null;
    }
  }

  private async getUserEnvironmentProxy(execOpts: ExecOptions): Promise<ProxyConfiguration | null> {
    try {
      // Check for user-specific proxy environment variables in HKCU\Environment
      const { stdout } = await execAsync(AllowedWindowsCommands.USER_ENV_PROXY, execOpts);

      const lines = stdout.split('\n');
      let http_proxy: string | null = null;
      let https_proxy: string | null = null;
      let no_proxy: string | null = null;

      for (const line of lines) {
        const trimmedLine = line.trim();

        if (trimmedLine.includes('HTTP_PROXY') && trimmedLine.includes('REG_SZ')) {
          const match = trimmedLine.match(/HTTP_PROXY\s+REG_SZ\s+(.+)/);
          if (match) http_proxy = match[1].trim();
        }

        if (trimmedLine.includes('HTTPS_PROXY') && trimmedLine.includes('REG_SZ')) {
          const match = trimmedLine.match(/HTTPS_PROXY\s+REG_SZ\s+(.+)/);
          if (match) https_proxy = match[1].trim();
        }

        if (trimmedLine.includes('NO_PROXY') && trimmedLine.includes('REG_SZ')) {
          const match = trimmedLine.match(/NO_PROXY\s+REG_SZ\s+(.+)/);
          if (match) no_proxy = match[1].trim();
        }
      }

      if (http_proxy || https_proxy) {
        return {
          http_proxy,
          https_proxy,
          no_proxy,
          source: 'windows-system'
        };
      }

      return null;
    } catch (error) {
      return null;
    }
  }

  private parseProxyString(proxyServer: string, bypassList: string | null): ProxyConfiguration {
    let http_proxy: string | null = null;
    let https_proxy: string | null = null;

    if (proxyServer.includes('=')) {
      // Protocol-specific format: "http=proxy1:8080;https=proxy2:8080"
      const protocols = proxyServer.split(';');
      for (const protocol of protocols) {
        const [proto, server] = protocol.split('=');
        if (proto === 'http') {
          http_proxy = normalizeProxyUrl(server);
        } else if (proto === 'https') {
          https_proxy = normalizeProxyUrl(server);
        }
      }
    } else {
      // Single proxy for all protocols: "proxy.example.com:8080"
      const proxy = normalizeProxyUrl(proxyServer);
      http_proxy = proxy;
      https_proxy = proxy;
    }

    return {
      http_proxy,
      https_proxy,
      no_proxy: bypassList && bypassList !== '(none)' ? normalizeNoProxy(bypassList) : null,
      source: 'windows-system'
    };
  }
}
