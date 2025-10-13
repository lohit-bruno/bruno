import { platform } from 'node:os';
import { ProxyConfiguration, SystemProxyDetectorOptions } from './types';
import { WindowsProxyDetector } from './utils/windows';
import { MacOSProxyDetector } from './utils/macos';
import { LinuxProxyDetector } from './utils/linux';

export class SystemProxyDetector {
  private platform: string;
  private cachedResult: ProxyConfiguration | null = null;
  private cacheTimestamp: number = 0;
  private cacheTimeout: number;
  private commandTimeout: number;
  private activeDetection: Promise<ProxyConfiguration> | null = null;

  constructor(options: SystemProxyDetectorOptions = {}) {
    this.platform = platform();
    this.cacheTimeout = options.cacheTimeout || 60000; // 60 seconds default
    this.commandTimeout = options.commandTimeout || 10000; // 10 seconds default
  }

  async getSystemProxy(): Promise<ProxyConfiguration> {
    // Return cached result if still valid
    if (this.cachedResult && Date.now() - this.cacheTimestamp < this.cacheTimeout) {
      return this.cachedResult;
    }

    // Return active detection if already in progress
    if (this.activeDetection) {
      return this.activeDetection;
    }

    // Start new detection
    this.activeDetection = this.detectSystemProxy();

    try {
      const result = await this.activeDetection;
      this.cachedResult = result;
      this.cacheTimestamp = Date.now();
      return result;
    } finally {
      this.activeDetection = null;
    }
  }

  private async detectSystemProxy(): Promise<ProxyConfiguration> {
    const startTime = Date.now();

    try {
      const result = await this.detectWithTimeout();

      // Log slow detections
      const detectionTime = Date.now() - startTime;
      if (detectionTime > 5000) {
        console.warn(`System proxy detection took ${detectionTime}ms`);
      }

      return result;
    } catch (error) {
      console.warn(`System proxy detection failed after ${Date.now() - startTime}ms:`, error instanceof Error ? error.message : String(error));
      return this.getEnvironmentVariables();
    }
  }

  private async detectWithTimeout(): Promise<ProxyConfiguration> {
    return await this.detectByPlatform();
  }

  private async detectByPlatform(): Promise<ProxyConfiguration> {
    switch (this.platform) {
      case 'win32':
        return await new WindowsProxyDetector().detect({ timeoutMs: this.commandTimeout });
      case 'darwin':
        return await new MacOSProxyDetector().detect({ timeoutMs: this.commandTimeout });
      case 'linux':
        return await new LinuxProxyDetector().detect({ timeoutMs: this.commandTimeout });
      default:
        return this.getEnvironmentVariables();
    }
  }

  getEnvironmentVariables(): ProxyConfiguration {
    const { http_proxy, HTTP_PROXY, https_proxy, HTTPS_PROXY, no_proxy, NO_PROXY, all_proxy, ALL_PROXY } = process.env;

    const httpProxy = http_proxy || HTTP_PROXY || all_proxy || ALL_PROXY || null;
    const httpsProxy = https_proxy || HTTPS_PROXY || all_proxy || ALL_PROXY || null;
    const noProxy = no_proxy || NO_PROXY || null;

    return {
      http_proxy: httpProxy,
      https_proxy: httpsProxy,
      no_proxy: noProxy ? this.normalizeNoProxy(noProxy) : null,
      source: 'environment'
    };
  }

  private normalizeNoProxy(noProxy: string): string {
    return noProxy
      .split(/[;,\s]+/)
      .map((s) => s.trim())
      .filter((s) => s.length > 0)
      .join(',');
  }

  clearCache(): void {
    this.cachedResult = null;
    this.cacheTimestamp = 0;
    this.activeDetection = null;
  }
}

const systemProxyDetector = new SystemProxyDetector();

export async function getSystemProxy(): Promise<ProxyConfiguration> {
  const proxyEnvironmentVariables = systemProxyDetector.getEnvironmentVariables();

  const hasEnvironmentProxy = proxyEnvironmentVariables.http_proxy || proxyEnvironmentVariables.https_proxy;

  if (hasEnvironmentProxy) {
    return proxyEnvironmentVariables;
  }

  try {
    return await systemProxyDetector.getSystemProxy();
  } catch (error) {
    return proxyEnvironmentVariables;
  }
}

export { ProxyConfiguration } from './types';
