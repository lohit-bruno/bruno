const parseUrl = require('node:url').parse;
const https = require('node:https');
const { HttpsProxyAgent } = require('https-proxy-agent');
const { SocksProxyAgent } = require('socks-proxy-agent');
const { HttpProxyAgent } = require('http-proxy-agent');
const { isEmpty, get, isUndefined, isNull } = require('lodash');
import { T_LoggerInstance } from '../utils/logger';
import { 
  T_HttpsAgentRequestFields, 
  T_ProxyAgentOptions, 
  T_SetupProxyAgentsConfig, 
  T_SocketConnectionOptions,
  T_SystemProxyEnvVars 
} from './types';

const getSystemProxyEnvVariables = (): T_SystemProxyEnvVars => {
  const { http_proxy, HTTP_PROXY, https_proxy, HTTPS_PROXY, no_proxy, NO_PROXY } = process.env;
  return {
    http_proxy: http_proxy || HTTP_PROXY,
    https_proxy: https_proxy || HTTPS_PROXY,
    no_proxy: no_proxy || NO_PROXY
  }; 
};

const DEFAULT_PORTS: Record<string, number> = {
  ftp: 21,
  gopher: 70,
  http: 80,
  https: 443,
  ws: 80,
  wss: 443
};
/**
 * check for proxy bypass, copied form 'proxy-from-env'
 */
const shouldUseProxy = (url: string, proxyBypass: string): boolean => {
  if (proxyBypass === '*') {
    return false; // Never proxy if wildcard is set.
  }

  // use proxy if no proxyBypass is set
  if (!proxyBypass || typeof proxyBypass !== 'string' || isEmpty(proxyBypass.trim())) {
    return true;
  }

  const parsedUrl = parseUrl(url);
  let proto = parsedUrl.protocol;
  let hostname = parsedUrl.host;
  let port = parsedUrl.port;
  if (typeof hostname !== 'string' || !hostname || typeof proto !== 'string') {
    return false; // Don't proxy URLs without a valid scheme or host.
  }

  proto = proto.split(':', 1)[0];
  // Stripping ports in this way instead of using parsedUrl.hostname to make
  // sure that the brackets around IPv6 addresses are kept.
  hostname = hostname.replace(/:\d*$/, '');
  port = parseInt(port) || DEFAULT_PORTS[proto as keyof typeof DEFAULT_PORTS] || 0;

  return proxyBypass.split(/[,;\s]/).every(function (dontProxyFor: string) {
    if (!dontProxyFor) {
      return true; // Skip zero-length hosts.
    }
    const parsedProxy = dontProxyFor.match(/^(.+):(\d+)$/);
    let parsedProxyHostname = parsedProxy ? parsedProxy[1] : dontProxyFor;
    const parsedProxyPort = parsedProxy ? parseInt(parsedProxy[2]) : 0;
    if (parsedProxyPort && parsedProxyPort !== port) {
      return true; // Skip if ports don't match.
    }

    if (!/^[.*]/.test(parsedProxyHostname)) {
      // No wildcards, so stop proxying if there is an exact match.
      return hostname !== parsedProxyHostname;
    }

    if (parsedProxyHostname.charAt(0) === '*') {
      // Remove leading wildcard.
      parsedProxyHostname = parsedProxyHostname.slice(1);
    }
    // Stop proxying if the hostname ends with the no_proxy host.
    return !hostname.endsWith(parsedProxyHostname);
  });
};

/**
 * Patched version of HttpsProxyAgent to get around a bug that ignores options
 * such as ca and rejectUnauthorized when upgrading the proxied socket to TLS:
 * https://github.com/TooTallNate/proxy-agents/issues/194
 */
class PatchedHttpsProxyAgent extends HttpsProxyAgent {
  private constructorOpts: any;

  constructor(proxy: string, opts: any) {
    super(proxy, opts);
    this.constructorOpts = opts;
  }

  async connect(req: any, opts: any): Promise<any> {
    const combinedOpts = { ...this.constructorOpts, ...opts };
    return super.connect(req, combinedOpts);
  }
}

function createTimelineAgentClass(BaseAgentClass: any, timeline: T_LoggerInstance) {
  return class extends BaseAgentClass {
    private alpnProtocols: string[];
    private caProvided: boolean;

    constructor(options: T_ProxyAgentOptions) {
      // For proxy agents, the first argument is the proxy URI and the second is options
      if (options?.proxy) {
        const { proxy: proxyUri, ...agentOptions } = options;
        // Ensure TLS options are properly set
        const tlsOptions = {
          ...agentOptions,
          rejectUnauthorized: agentOptions.rejectUnauthorized ?? true,
        };
        super(proxyUri, tlsOptions);
        this.alpnProtocols = tlsOptions.ALPNProtocols || ['h2', 'http/1.1'];
        this.caProvided = !!tlsOptions.ca;

        // Log TLS verification status
        timeline.add('info', `SSL validation: ${tlsOptions.rejectUnauthorized ? 'enabled' : 'disabled'}`);

        // Log the proxy details
        timeline.add('info', `Using proxy: ${proxyUri}`);
      } else {
        // This is a regular HTTPS agent case
        const tlsOptions = {
          ...options,
          rejectUnauthorized: options.rejectUnauthorized ?? true,
        };   
        super(tlsOptions);
        this.alpnProtocols = options.ALPNProtocols || ['h2', 'http/1.1'];
        this.caProvided = !!options.ca;

        // Log TLS verification status
        timeline.add('info', `SSL validation: ${tlsOptions.rejectUnauthorized ? 'enabled' : 'disabled'}`);
      }
    }


    createConnection(options: T_SocketConnectionOptions, callback: (err?: Error | null, socket?: any) => void) {
      const { host, port } = options;

      // Log ALPN protocols offered
      if (this.alpnProtocols && this.alpnProtocols.length > 0) {
        timeline.add('tls', `ALPN: offers ${this.alpnProtocols.join(', ')}`);
      }

      // Log CAfile and CApath (if possible)
      if (this.caProvided) {
        timeline.add('tls', `CA certificates provided`);
      } else {
        timeline.add('tls', `Using system default CA certificates`);
      }

      // Log "Trying host:port..."
      timeline.add('info', `Trying ${host}:${port}...`);

      let socket: any;
      try {
        socket = super.createConnection(options, callback);
      } catch (error: unknown) {
        const err = error as Error;
        timeline.add('error', `Error creating connection: ${err.message}`);
        (err as any).timeline = timeline.getAll();
        throw err;
      }

      // Attach event listeners to the socket
      socket?.on('lookup', (err: Error | null, address: string, family: string | number, host: string) => {
        if (err) {
          timeline.add('error', `DNS lookup error for ${host}: ${err.message}`);
        } else {
          timeline.add('info', `DNS lookup: ${host} -> ${address}`);
        }
      });

      socket?.on('connect', () => {
        const address = socket.remoteAddress || host;
        const remotePort = socket.remotePort || port;

        timeline.add('info', `Connected to ${host} (${address}) port ${remotePort}`);
      });

      socket?.on('secureConnect', () => {
        const protocol = socket.getProtocol() || 'SSL/TLS';
        const cipher = socket.getCipher();
        const cipherSuite = cipher ? `${cipher.name} (${cipher.version})` : 'Unknown cipher';

        timeline.add('tls', `SSL connection using ${protocol} / ${cipherSuite}`);

        // ALPN protocol
        const alpnProtocol = socket.alpnProtocol || 'None';
        timeline.add('tls', `ALPN: server accepted ${alpnProtocol}`);

        // Server certificate
        const cert = socket.getPeerCertificate(true);
        if (cert) {
          timeline.add('tls', `Server certificate:`);
          if (cert.subject) {
            timeline.add('tls', ` subject: ${Object.entries(cert.subject).map(([k, v]) => `${k}=${v}`).join(', ')}`);
          }
          if (cert.valid_from) {
            timeline.add('tls', ` start date: ${cert.valid_from}`);
          }
          if (cert.valid_to) {
            timeline.add('tls', ` expire date: ${cert.valid_to}`);
          }
          if (cert.subjectaltname) {
            timeline.add('tls', ` subjectAltName: ${cert.subjectaltname}`);
          }
          if (cert.issuer) {
            timeline.add('tls', ` issuer: ${Object.entries(cert.issuer).map(([k, v]) => `${k}=${v}`).join(', ')}`);
          }

          // SSL certificate verify ok
          timeline.add('tls', `SSL certificate verify ok.`);
        }
      });

      socket?.on('error', (err: Error) => {
        timeline.add('error', `Socket error: ${err.message}`);
      });

      return socket;
    }
  };
}

export function setupProxyAgents({
  requestConfig,
  proxyMode = 'off',
  proxyConfig,
  httpsAgentRequestFields,
  timeline
}: T_SetupProxyAgentsConfig): void {
  // Ensure TLS options are properly set
  const tlsOptions: T_HttpsAgentRequestFields = {
    ...httpsAgentRequestFields,
    // Enable all secure protocols by default
    secureProtocol: undefined,
    // Allow Node.js to choose the protocol
    minVersion: 'TLSv1',
    rejectUnauthorized: httpsAgentRequestFields.rejectUnauthorized !== undefined ? httpsAgentRequestFields.rejectUnauthorized : true,
  };

  if (proxyMode === 'on') {
    const shouldProxy = shouldUseProxy(requestConfig.url!, get(proxyConfig, 'bypassProxy', ''));
    if (shouldProxy) {
      // Use already-interpolated values from proxyConfig
      const proxyProtocol = get(proxyConfig, 'protocol', '');
      const proxyHostname = get(proxyConfig, 'hostname', '');
      const proxyPort = get(proxyConfig, 'port', '');
      const proxyAuthEnabled = get(proxyConfig, 'auth.enabled', false);
      const socksEnabled = proxyProtocol.includes('socks');

      let uriPort = isUndefined(proxyPort) || isNull(proxyPort) ? '' : `:${proxyPort}`;
      let proxyUri: string;
      if (proxyAuthEnabled) {
        const proxyAuthUsername = encodeURIComponent(get(proxyConfig, 'auth.username', ''));
        const proxyAuthPassword = encodeURIComponent(get(proxyConfig, 'auth.password', ''));
        proxyUri = `${proxyProtocol}://${proxyAuthUsername}:${proxyAuthPassword}@${proxyHostname}${uriPort}`;
      } else {
        proxyUri = `${proxyProtocol}://${proxyHostname}${uriPort}`;
      }

      if (socksEnabled) {
        const TimelineSocksProxyAgent = createTimelineAgentClass(SocksProxyAgent, timeline);
        requestConfig.httpAgent = new TimelineSocksProxyAgent({ proxy: proxyUri, ...tlsOptions });
        requestConfig.httpsAgent = new TimelineSocksProxyAgent({ proxy: proxyUri, ...tlsOptions });
      } else {
        const TimelineHttpsProxyAgent = createTimelineAgentClass(PatchedHttpsProxyAgent, timeline);
        requestConfig.httpAgent = new HttpProxyAgent(proxyUri); // For http, no need for timeline
        requestConfig.httpsAgent = new TimelineHttpsProxyAgent(
          { proxy: proxyUri, ...tlsOptions }
        );
      }
    } else {
      // If proxy should not be used, set default HTTPS agent
      const TimelineHttpsAgent = createTimelineAgentClass(https.Agent, timeline);
      requestConfig.httpsAgent = new TimelineHttpsAgent(tlsOptions);
    }
  } else if (proxyMode === 'system') {
    const { http_proxy, https_proxy, no_proxy } = getSystemProxyEnvVariables();
    const shouldUseSystemProxy = shouldUseProxy(requestConfig.url!, no_proxy || '');
    if (shouldUseSystemProxy) {
      try {
        if (http_proxy?.length) {
          new URL(http_proxy);
          requestConfig.httpAgent = new HttpProxyAgent(http_proxy);
        }
      } catch (error) {
        throw new Error('Invalid system http_proxy');
      }
      try {
        if (https_proxy?.length) {
          new URL(https_proxy);
          const TimelineHttpsProxyAgent = createTimelineAgentClass(PatchedHttpsProxyAgent, timeline);
          requestConfig.httpsAgent = new TimelineHttpsProxyAgent(
            { proxy: https_proxy, ...tlsOptions }
          );
        }
      } catch (error) {
        throw new Error('Invalid system https_proxy');
      }
    } else {
      const TimelineHttpsAgent = createTimelineAgentClass(https.Agent, timeline);
      requestConfig.httpsAgent = new TimelineHttpsAgent(tlsOptions);
    }
  } else {
    const TimelineHttpsAgent = createTimelineAgentClass(https.Agent, timeline);
    requestConfig.httpsAgent = new TimelineHttpsAgent(tlsOptions);
  }
}