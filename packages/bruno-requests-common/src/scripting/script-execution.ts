// Note: ScriptRuntime should be passed in from the consuming application
// This allows for different runtime implementations (Node.js vs Browser)

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

export interface ScriptRuntime {
  runScript(options: {
    script: string;
    request: any;
    response?: any;
    variables: ScriptVariables;
    assertionResults?: any[];
    collectionName?: string;
    collectionPath?: string;
    onConsoleLog?: (type: string, args: any[]) => void;
    runRequestByItemPathname?: (pathname: string) => Promise<any>;
  }): Promise<any>;
}

export interface VarsRuntime {
  runPostResponseVars(
    vars: any[],
    request: any,
    response: any,
    envVariables: Record<string, any>,
    runtimeVariables: Record<string, any>,
    collectionPath: string,
    processEnvVars: Record<string, any>
  ): any;
}

export interface AssertRuntime {
  runAssertions(
    assertions: any[],
    request: any,
    response: any,
    envVariables: Record<string, any>,
    runtimeVariables: Record<string, any>,
    processEnvVars: Record<string, any>
  ): any[];
}

export interface ScriptExecutionOptions {
  script: string;
  request: any;
  response?: any;
  variables: ScriptVariables;
  assertionResults?: any[];
  collectionName?: string;
  collectionPath?: string;
  onConsoleLog?: (type: string, args: any[]) => void;
  runRequestByItemPathname?: (pathname: string) => Promise<any>;
  runtime?: string;
  scriptRuntime?: ScriptRuntime;
  varsRuntime?: VarsRuntime;
  assertRuntime?: AssertRuntime;
}

export interface ScriptResult {
  request?: any;
  response?: any;
  envVariables: Record<string, any>;
  runtimeVariables: Record<string, any>;
  globalEnvironmentVariables: Record<string, any>;
  results?: any[];
  nextRequestName?: string;
  skipRequest?: boolean;
  stopExecution?: boolean;
  error?: any;
}

/**
 * Execute pre-request script using ScriptRuntime
 */
export const executePreRequestScript = async (options: ScriptExecutionOptions): Promise<ScriptResult> => {
  const {
    script,
    request,
    variables,
    assertionResults = [],
    collectionName = '',
    collectionPath = '',
    onConsoleLog,
    runRequestByItemPathname,
    scriptRuntime
  } = options;

  if (!script || !script.trim()) {
    return {
      request,
      envVariables: variables.envVariables || {},
      runtimeVariables: variables.runtimeVariables || {},
      globalEnvironmentVariables: variables.globalEnvironmentVariables || {},
      results: []
    };
  }

  if (!scriptRuntime) {
    throw new Error('ScriptRuntime is required for script execution');
  }

  try {
    const result = await scriptRuntime.runScript({
      script,
      request,
      variables,
      assertionResults,
      collectionName,
      collectionPath,
      onConsoleLog,
      runRequestByItemPathname
    });

    return {
      request: result.request || request,
      envVariables: result.envVariables || variables.envVariables || {},
      runtimeVariables: result.runtimeVariables || variables.runtimeVariables || {},
      globalEnvironmentVariables: result.globalEnvironmentVariables || variables.globalEnvironmentVariables || {},
      results: result.results || [],
      nextRequestName: result.nextRequestName,
      skipRequest: result.skipRequest,
      stopExecution: result.stopExecution
    };
  } catch (error: unknown) {
    console.error('Pre-request script execution error:', error);
    return {
      request,
      envVariables: variables.envVariables || {},
      runtimeVariables: variables.runtimeVariables || {},
      globalEnvironmentVariables: variables.globalEnvironmentVariables || {},
      results: [],
      error: error instanceof Error ? error : new Error(String(error))
    };
  }
};

/**
 * Execute post-response script using ScriptRuntime
 */
export const executePostResponseScript = async (options: ScriptExecutionOptions): Promise<ScriptResult> => {
  const {
    script,
    request,
    response,
    variables,
    assertionResults = [],
    collectionName = '',
    collectionPath = '',
    onConsoleLog,
    runRequestByItemPathname,
    scriptRuntime
  } = options;

  if (!script || !script.trim()) {
    return {
      request,
      response,
      envVariables: variables.envVariables || {},
      runtimeVariables: variables.runtimeVariables || {},
      globalEnvironmentVariables: variables.globalEnvironmentVariables || {},
      results: []
    };
  }

  if (!scriptRuntime) {
    throw new Error('ScriptRuntime is required for script execution');
  }

  try {
    const result = await scriptRuntime.runScript({
      script,
      request,
      response,
      variables,
      assertionResults,
      collectionName,
      collectionPath,
      onConsoleLog,
      runRequestByItemPathname
    });

    return {
      request: result.request || request,
      response: result.response || response,
      envVariables: result.envVariables || variables.envVariables || {},
      runtimeVariables: result.runtimeVariables || variables.runtimeVariables || {},
      globalEnvironmentVariables: result.globalEnvironmentVariables || variables.globalEnvironmentVariables || {},
      results: result.results || [],
      nextRequestName: result.nextRequestName,
      skipRequest: result.skipRequest,
      stopExecution: result.stopExecution
    };
  } catch (error: unknown) {
    console.error('Post-response script execution error:', error);
    return {
      request,
      response,
      envVariables: variables.envVariables || {},
      runtimeVariables: variables.runtimeVariables || {},
      globalEnvironmentVariables: variables.globalEnvironmentVariables || {},
      results: [],
      error: error instanceof Error ? error : new Error(String(error))
    };
  }
};

/**
 * Execute test script using ScriptRuntime
 */
export const executeTestScript = async (options: ScriptExecutionOptions): Promise<ScriptResult> => {
  const {
    script,
    request,
    response,
    variables,
    assertionResults = [],
    collectionName = '',
    collectionPath = '',
    onConsoleLog,
    runRequestByItemPathname,
    scriptRuntime
  } = options;

  if (!script || !script.trim()) {
    return {
      request,
      response,
      envVariables: variables.envVariables || {},
      runtimeVariables: variables.runtimeVariables || {},
      globalEnvironmentVariables: variables.globalEnvironmentVariables || {},
      results: []
    };
  }

  if (!scriptRuntime) {
    throw new Error('ScriptRuntime is required for script execution');
  }

  try {
    const result = await scriptRuntime.runScript({
      script,
      request,
      response,
      variables,
      assertionResults,
      collectionName,
      collectionPath,
      onConsoleLog,
      runRequestByItemPathname
    });

    return {
      request: result.request || request,
      response: result.response || response,
      envVariables: result.envVariables || variables.envVariables || {},
      runtimeVariables: result.runtimeVariables || variables.runtimeVariables || {},
      globalEnvironmentVariables: result.globalEnvironmentVariables || variables.globalEnvironmentVariables || {},
      results: result.results || [],
      nextRequestName: result.nextRequestName,
      skipRequest: result.skipRequest,
      stopExecution: result.stopExecution
    };
  } catch (error: unknown) {
    console.error('Test script execution error:', error);
    
    // Check if error has partial results
    if (error && typeof error === 'object' && 'partialResults' in error) {
      return {
        ...(error.partialResults as any),
        error: error instanceof Error ? error : new Error(String(error))
      };
    }

    return {
      request,
      response,
      envVariables: variables.envVariables || {},
      runtimeVariables: variables.runtimeVariables || {},
      globalEnvironmentVariables: variables.globalEnvironmentVariables || {},
      results: [],
      error: error instanceof Error ? error : new Error(String(error))
    };
  }
};

/**
 * Execute post-response variables using VarsRuntime
 */
export const executePostResponseVars = (
  vars: any[],
  request: any,
  response: any,
  envVariables: Record<string, any>,
  runtimeVariables: Record<string, any>,
  collectionPath: string,
  processEnvVars: Record<string, any>,
  varsRuntime?: VarsRuntime
): any => {
  if (!varsRuntime) {
    throw new Error('VarsRuntime is required for variable execution');
  }

  try {
    const result = varsRuntime.runPostResponseVars(
      vars,
      request,
      response,
      envVariables,
      runtimeVariables,
      collectionPath,
      processEnvVars
    );

    return result;
  } catch (error: unknown) {
    console.error('Post-response vars execution error:', error);
    return {
      envVariables,
      runtimeVariables,
      globalEnvironmentVariables: request?.globalEnvironmentVariables || {},
      error: error instanceof Error ? error.message : 'Error executing post-response variables'
    };
  }
};

/**
 * Execute assertions using AssertRuntime
 */
export const executeAssertions = (
  assertions: any[],
  request: any,
  response: any,
  envVariables: Record<string, any>,
  runtimeVariables: Record<string, any>,
  processEnvVars: Record<string, any>,
  assertRuntime?: AssertRuntime
): any[] => {
  if (!assertRuntime) {
    throw new Error('AssertRuntime is required for assertion execution');
  }

  try {
    const results = assertRuntime.runAssertions(
      assertions,
      request,
      response,
      envVariables,
      runtimeVariables,
      processEnvVars
    );

    return results || [];
  } catch (error: unknown) {
    console.error('Assertions execution error:', error);
    return [];
  }
}; 