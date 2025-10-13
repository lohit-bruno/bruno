import { exec, ExecOptions } from 'node:child_process';
import { promisify } from 'node:util';
import { ProxyConfiguration, ProxyDetector } from '../types';
import { normalizeProxyUrl, normalizeNoProxy } from './common';

const execAsync = promisify(exec);

export class MacOSProxyDetector implements ProxyDetector {
  async detect(opts?: { timeoutMs?: number }): Promise<ProxyConfiguration> {
    const timeoutMs = opts?.timeoutMs ?? 10000;
    const execOpts: ExecOptions = {
      timeout: timeoutMs,
      maxBuffer: 1024 * 1024
    };

    try {
      const { stdout } = await execAsync('scutil --proxy', execOpts);
      return this.parseScutilOutput(stdout);
    } catch (error) {
      throw new Error(`macOS proxy detection failed: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  private parseScutilOutput(output: string): ProxyConfiguration {
    if (typeof output !== 'string') {
      throw new Error('Invalid scutil --proxy output');
    }

    const cleanLines = output.split('\n')
      .map((line) => line.trim())
      .filter((line) => line.length > 0);

    const dictStart = cleanLines.findIndex((line) => line.includes('<dictionary>'));
    if (dictStart === -1) {
      throw new Error('Invalid scutil --proxy output format');
    }
    const config = this.parseConfiguration(cleanLines, dictStart);
    return this.buildProxyConfiguration(config);
  }

  private parseConfiguration(lines: string[], startIndex: number): Record<string, any> {
    const config: Record<string, any> = {};
    let i = startIndex + 1;

    while (i < lines.length && !lines[i].includes('}')) {
      const line = lines[i];

      if (!line.trim()) {
        i++;
        continue;
      }

      const keyValueMatch = line.match(/^([^:]+)\s*:\s*(.+)$/);
      if (keyValueMatch) {
        const key = keyValueMatch[1].trim();
        const value = keyValueMatch[2].trim();

        if (value === '<array> {') {
          // Parse array
          const array: string[] = [];
          i++;
          while (i < lines.length && !lines[i].includes('}')) {
            const arrayLine = lines[i].trim();
            const arrayMatch = arrayLine.match(/^\d+\s*:\s*(.+)$/);
            if (arrayMatch) {
              array.push(arrayMatch[1].trim());
            }
            i++;
          }
          config[key] = array;
        } else if (value.match(/^\d+$/)) {
          config[key] = parseInt(value, 10);
        } else if (value === '1') {
          config[key] = true;
        } else if (value === '0') {
          config[key] = false;
        } else {
          config[key] = value;
        }
      }

      i++;
    }

    return config;
  }

  private buildProxyConfiguration(config: Record<string, any>): ProxyConfiguration {
    let http_proxy: string | null = null;
    let https_proxy: string | null = null;
    let no_proxy: string | null = null;

    // Check HTTP proxy
    if (config.HTTPEnable === 1 && config.HTTPProxy) {
      const port = config.HTTPPort || 80;
      http_proxy = normalizeProxyUrl(`${config.HTTPProxy}:${port}`);
    }

    // Check HTTPS proxy
    if (config.HTTPSEnable === 1 && config.HTTPSProxy) {
      const port = config.HTTPSPort || 443;
      https_proxy = normalizeProxyUrl(`${config.HTTPSProxy}:${port}`);
    }

    // Check bypass list
    if (config.ExceptionsList && Array.isArray(config.ExceptionsList) && config.ExceptionsList.length > 0) {
      no_proxy = config.ExceptionsList.join(',');
    }

    // Handle "exclude simple hostnames" setting
    if (config.ExcludeSimpleHostnames === 1) {
      no_proxy = no_proxy ? `${no_proxy},<local>` : '<local>';
    }

    return {
      http_proxy,
      https_proxy,
      no_proxy: normalizeNoProxy(no_proxy),
      source: 'macos-system'
    };
  }
}
