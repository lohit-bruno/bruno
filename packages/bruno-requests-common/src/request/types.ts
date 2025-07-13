// Request Types
export interface BrunoRequest {
  method: string;
  url: string;
  headers: Record<string, string>;
  data?: any;
  params?: BrunoParam[];
  body?: BrunoRequestBody;
  auth?: BrunoAuth;
  script?: BrunoScript;
  tests?: string;
  vars?: BrunoVars;
  assertions?: BrunoAssertion[];
  mode?: string;
  timeout?: number;
  pathParams?: BrunoParam[];
  globalEnvironmentVariables?: Record<string, any>;
  oauth2CredentialVariables?: Record<string, any>;
  collectionVariables?: Record<string, any>;
  folderVariables?: Record<string, any>;
  requestVariables?: Record<string, any>;
}

export interface BrunoParam {
  name: string;
  value: string;
  enabled: boolean;
  type?: string;
}

export interface BrunoRequestBody {
  mode: string;
  json?: string;
  text?: string;
  xml?: string;
  sparql?: string;
  formUrlEncoded?: BrunoParam[];
  multipartForm?: BrunoParam[];
  file?: BrunoFile[];
  graphql?: {
    query: string;
    variables: string;
  };
}

export interface BrunoFile {
  name: string;
  filePath: string;
  contentType: string;
  selected: boolean;
}

export interface BrunoAuth {
  mode: string;
  basic?: {
    username: string;
    password: string;
  };
  bearer?: {
    token: string;
  };
  awsv4?: {
    accessKeyId: string;
    secretAccessKey: string;
    sessionToken?: string;
    service: string;
    region: string;
    profileName?: string;
  };
  digest?: {
    username: string;
    password: string;
  };
  ntlm?: {
    username: string;
    password: string;
    domain: string;
  };
}

export interface BrunoScript {
  req?: string;
  res?: string;
}

export interface BrunoVars {
  req?: BrunoParam[];
  res?: BrunoParam[];
}

export interface BrunoAssertion {
  name: string;
  value: string;
  enabled: boolean;
}

// Collection Types
export interface BrunoCollection {
  uid: string;
  name: string;
  pathname: string;
  root?: BrunoCollectionRoot;
  globalEnvironmentVariables?: Record<string, any>;
  oauth2Credentials?: Record<string, any>;
  runtimeVariables?: Record<string, any>;
  brunoConfig?: BrunoBrunoConfig;
  items?: BrunoItem[];
}

export interface BrunoCollectionRoot {
  request?: {
    headers?: BrunoParam[];
    auth?: BrunoAuth;
    script?: BrunoScript;
    vars?: BrunoVars;
    tests?: string;
  };
}

export interface BrunoBrunoConfig {
  scripts?: {
    flow?: string;
    runtime?: string;
    filesystemAccess?: {
      allow?: boolean;
    };
    moduleWhitelist?: string[];
    additionalContextRoots?: string[];
  };
}

export interface BrunoItem {
  uid: string;
  name: string;
  type: string;
  seq: number;
  request: BrunoRequest;
  draft?: {
    request: BrunoRequest;
  };
  items?: BrunoItem[];
  root?: BrunoCollectionRoot;
  requestUid?: string;
}

export interface BrunoVariables {
  envVariables: Record<string, any>;
  runtimeVariables: Record<string, any>;
  processEnvVariables?: Record<string, any>;
  collectionVariables: Record<string, any>;
  folderVariables: Record<string, any>;
  requestVariables: Record<string, any>;
  globalEnvironmentVariables: Record<string, any>;
  oauth2CredentialVariables: Record<string, any>;
}

// Context Types
export interface BrunoRequestContext {
  collectionName: string;
  request: BrunoRequest;
  variables: BrunoVariables;
  scripts: {
    preRequestScripts: string[];
    postResponseScripts: string[];
    testScripts: string[];
  };
}

export interface BrunoResponse {
  status: number;
  statusText: string;
  headers: Record<string, string>;
  data: any;
  dataBuffer?: Buffer | string;
  size?: number;
  duration?: number;
  timeline?: any[];
}

export interface BrunoRunRequestOptions {
  collectionPath?: string;
  onConsoleLog?: (type: string, args: any[]) => void;
  scriptingConfig?: BrunoBrunoConfig['scripts'];
  runRequestByItemPathname?: (pathname: string) => Promise<BrunoResponse>;
  runInBackground?: boolean;
  abortController?: AbortController;
}

export interface BrunoRunRequestResult {
  request: BrunoRequest;
  response?: BrunoResponse;
  error?: string;
  variables: {
    envVariables: Record<string, any>;
    runtimeVariables: Record<string, any>;
    globalEnvironmentVariables: Record<string, any>;
  };
  testResults?: any[];
  assertionResults?: any[];
  preRequestTestResults?: any[];
  postResponseTestResults?: any[];
  duration?: number;
  timeline?: any[];
  skipRequest?: boolean;
  stopExecution?: boolean;
}

// Runtime Types
export interface BrunoScriptRuntime {
  runScript: ({
    script,
    request,
    response,
    variables,
    assertionResults,
    collectionName,
    collectionPath,
    onConsoleLog,
    runRequestByItemPathname
  }: {
    script: string;
    request: BrunoRequest;
    response?: BrunoResponse;
    variables: BrunoVariables;
    assertionResults?: any[];
    collectionName: string;
    collectionPath: string;
    onConsoleLog?: (type: string, args: any[]) => void;
    runRequestByItemPathname?: (pathname: string) => Promise<BrunoResponse>;
  }) => Promise<any>;
}

export interface BrunoTestRuntime {
  runTests: ({
    testsFile,
    request,
    response,
    variables,
    collectionPath,
    onConsoleLog,
    scriptingConfig,
    runRequestByItemPathname,
    collectionName
  }: {
    testsFile: string;
    request: BrunoRequest;
    response: BrunoResponse;
    variables: BrunoVariables;
    collectionPath: string;
    onConsoleLog?: (type: string, args: any[]) => void;
    scriptingConfig?: BrunoBrunoConfig['scripts'];
    runRequestByItemPathname?: (pathname: string) => Promise<BrunoResponse>;
    collectionName?: string;
  }) => Promise<any>;
}

export interface BrunoAssertRuntime {
  runAssertions: ({
    assertions,
    request,
    response,
    variables
  }: {
    assertions: BrunoAssertion[];
    request: BrunoRequest;
    response: BrunoResponse;
    variables: BrunoVariables;
  }) => any[];
}

// Utility Types
export interface BrunoRequestTreePathItem {
  type: 'folder' | 'request';
  uid: string;
  name: string;
  root?: BrunoCollectionRoot;
  request?: BrunoRequest;
  draft?: {
    request: BrunoRequest;
  };
}

export interface BrunoInterpolationOptions {
  envVars?: Record<string, any>;
  runtimeVariables?: Record<string, any>;
  processEnvVars?: Record<string, any>;
  escapeJSONStrings?: boolean;
}

export interface BrunoAxiosInstance {
  (config: any): Promise<BrunoResponse>;
  defaults: any;
  interceptors: {
    request: any;
    response: any;
  };
}

export interface BrunoMergeOptions {
  scriptFlow?: string;
} 