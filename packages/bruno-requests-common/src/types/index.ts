// Base types for Bruno requests
export interface RequestConfig {
  url: string;
  method: string;
  headers?: Record<string, string>;
  data?: any;
  timeout?: number;
  auth?: AuthConfig;
  body?: BodyConfig;
  params?: ParamConfig[];
  vars?: VarConfig;
  script?: ScriptConfig;
  tests?: string;
  assertions?: any[];
}

export interface AuthConfig {
  mode: 'none' | 'basic' | 'bearer' | 'digest' | 'oauth2' | 'apikey' | 'wsse' | 'ntlm' | 'inherit';
  basic?: { username: string; password: string };
  bearer?: { token: string };
  digest?: { username: string; password: string };
  oauth2?: Record<string, any>;
  apikey?: { key: string; value: string; placement: 'header' | 'queryparams' };
  wsse?: { username: string; password: string };
  ntlm?: { username: string; password: string; domain: string };
}

export interface BodyConfig {
  mode: 'none' | 'json' | 'text' | 'xml' | 'formUrlEncoded' | 'multipartForm' | 'graphql' | 'sparql';
  json?: any;
  text?: string;
  xml?: string;
  formUrlEncoded?: Array<{ name: string; value: string; enabled: boolean }>;
  multipartForm?: Array<{ name: string; value: string; enabled: boolean; type?: string }>;
  graphql?: { query: string; variables?: string };
  sparql?: string;
}

export interface ParamConfig {
  name: string;
  value: string;
  enabled: boolean;
  type: 'query' | 'path';
}

export interface VarConfig {
  req?: Array<{ name: string; value: any; enabled: boolean }>;
  res?: Array<{ name: string; value: any; enabled: boolean }>;
}

export interface ScriptConfig {
  req?: string;
  res?: string;
}

export interface RequestContext {
  // Core context
  item: RequestItem;
  collection?: Collection;
  
  // Environment variables
  envVars?: Record<string, any>;
  runtimeVariables?: Record<string, any>;
  processEnvVars?: Record<string, any>;
  
  // Collection context
  collectionUid?: string;
  collectionPath?: string;
  collectionName?: string;
  
  // Execution context
  timeout?: number;
  runtime?: string;
  
  // Script runtimes (dependency injection)
  scriptRuntime?: ScriptRuntime;
  varsRuntime?: VarsRuntime;
  assertRuntime?: AssertRuntime;
  
  // Callbacks
  onConsoleLog?: (type: string, args: any[]) => void;
  runRequestByItemPathname?: (pathname: string) => Promise<any>;
}

export interface RequestItem {
  uid?: string;
  name?: string;
  draft?: { request: any };
  request: any;
}

export interface Collection {
  uid?: string;
  name?: string;
  pathname?: string;
  draft?: any;
  root?: any;
  brunoConfig?: {
    scripts?: { flow?: string };
  };
  globalEnvironmentVariables?: Record<string, any>;
  oauth2Credentials?: Record<string, any>;
}

export interface RequestResponse {
  // Core response data
  status?: number;
  statusText?: string;
  headers?: Record<string, any>;
  data?: any;
  
  // Metadata
  responseTime?: number;
  size?: number;
  timeline?: any[];
  
  // Error handling
  error?: string | Error;
  isCancel?: boolean;
  
  // Flow control
  nextRequestName?: string;
  skipRequest?: boolean;
  stopExecution?: boolean;
  
  // Execution results
  preRequestResults?: any[];
  postResponseResults?: any[];
  testResults?: any[];
  assertionResults?: any[];
}

export interface ScriptOptions {
  script: string;
  request: any;
  response?: any;
  variables: ScriptVariables;
  assertionResults?: any[];
  collectionName?: string;
  collectionPath?: string;
  onConsoleLog?: (type: string, args: any[]) => void;
  runRequestByItemPathname?: (pathname: string) => Promise<any>;
  scriptRuntime?: ScriptRuntime;
}

export interface ScriptVariables {
  processEnvVars?: Record<string, any>;
  envVariables?: Record<string, any>;
  globalEnvironmentVariables?: Record<string, any>;
  oauth2CredentialVariables?: Record<string, any>;
  collectionVariables?: Record<string, any>;
  folderVariables?: Record<string, any>;
  requestVariables?: Record<string, any>;
  runtimeVariables?: Record<string, any>;
}

export interface ScriptResult {
  results?: any[];
  error?: Error;
  nextRequestName?: string;
  skipRequest?: boolean;
  stopExecution?: boolean;
  envVariables?: Record<string, any>;
  runtimeVariables?: Record<string, any>;
  globalEnvironmentVariables?: Record<string, any>;
}

// Runtime interfaces (dependency injection)
export interface ScriptRuntime {
  runScript: (options: {
    script: string;
    request: any;
    response?: any;
    variables: ScriptVariables;
    assertionResults?: any[];
    collectionName?: string;
    collectionPath?: string;
    onConsoleLog?: (type: string, args: any[]) => void;
    runRequestByItemPathname?: (pathname: string) => Promise<any>;
  }) => Promise<any>;
}

export interface VarsRuntime {
  runPostResponseVars: (
    vars: any[],
    request: any,
    response: any,
    envVariables: Record<string, any>,
    runtimeVariables: Record<string, any>,
    collectionPath: string,
    processEnvVars: Record<string, any>
  ) => any;
}

export interface AssertRuntime {
  runAssertions: (
    assertions: any[],
    request: any,
    response: any,
    envVariables: Record<string, any>,
    runtimeVariables: Record<string, any>,
    processEnvVars: Record<string, any>
  ) => any[];
}

// Utility types
export interface InterpolationOptions {
  envVars?: Record<string, any>;
  runtimeVariables?: Record<string, any>;
  processEnvVars?: Record<string, any>;
}

export interface ValidationResult {
  isValid: boolean;
  errors: string[];
}

export interface RequestPreparationOptions {
  item: RequestItem;
  collection?: Collection;
  abortController?: AbortController;
}

export interface RequestConfigurationOptions {
  request: any;
  envVars?: Record<string, any>;
  runtimeVariables?: Record<string, any>;
  processEnvVars?: Record<string, any>;
  collectionUid?: string;
  collectionPath?: string;
  timeout?: number;
} 