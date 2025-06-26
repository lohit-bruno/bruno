import { AxiosResponse, InternalAxiosRequestConfig } from 'axios';
import { T_LogEntry, T_LoggerInstance } from '../utils/logger';

export type T_ModifiedInternalAxiosRequestConfig = InternalAxiosRequestConfig & {
  startTime: number;
  timeline?: T_LogEntry[]
}

export type T_ModifiedAxiosResponse = AxiosResponse & {
  responseTime: number;
}

// Proxy configuration types
interface T_ProxyAuth {
  username?: string;
  password?: string;
  enabled?: boolean;
}

export interface T_ProxyConfig {
  protocol?: string;
  hostname?: string;
  port?: string | number;
  bypassProxy?: string;
  auth?: T_ProxyAuth;
  enabled?: boolean | 'global';
  mode?: 'on' | 'off' | 'system';
}

// HTTPS Agent configuration types
export interface T_HttpsAgentRequestFields {
  keepAlive?: boolean;
  rejectUnauthorized?: boolean;
  ca?: string | Buffer;
  cert?: string | Buffer;
  key?: string | Buffer;
  pfx?: string | Buffer;
  passphrase?: string;
  ALPNProtocols?: string[];
  secureProtocol?: string;
  minVersion?: string;
}

// Proxy agent options
export interface T_ProxyAgentOptions extends T_HttpsAgentRequestFields {
  proxy?: string;
}

// Setup proxy agents config
export interface T_SetupProxyAgentsConfig {
  requestConfig: T_ModifiedInternalAxiosRequestConfig;
  proxyMode?: 'on' | 'off' | 'system';
  proxyConfig?: T_ProxyConfig;
  httpsAgentRequestFields: T_HttpsAgentRequestFields;
  timeline: T_LoggerInstance
}

// Socket connection options
export interface T_SocketConnectionOptions {
  host: string;
  port: number;
  [key: string]: any;
}

// System proxy environment variables
export interface T_SystemProxyEnvVars {
  http_proxy?: string;
  https_proxy?: string;
  no_proxy?: string;
}

// Certs and Proxy config
export interface T_CertsAndProxyConfigResult {
  proxyMode: 'on' | 'off' | 'system';
  proxyConfig: T_ProxyConfig;
  httpsAgentRequestFields: T_HttpsAgentRequestFields;
}

// Configuration options for creating an Axios instance
export interface T_AxiosInstanceConfig {
  certsAndProxyConfig: T_CertsAndProxyConfigResult;
  logId: string;
}