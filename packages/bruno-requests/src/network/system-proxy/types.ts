export interface ProxyConfiguration {
  http_proxy?: string | null;
  https_proxy?: string | null;
  no_proxy?: string | null;
  source: 'environment' | 'windows-system' | 'macos-system' | 'linux-system';
}

export interface ProxyDetector {
  detect(opts?: { timeoutMs?: number }): Promise<ProxyConfiguration>;
}

export interface SystemProxyDetectorOptions {
  cacheTimeout?: number;
  commandTimeout?: number;
}
