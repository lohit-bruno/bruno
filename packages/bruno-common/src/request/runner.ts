import { 
  BrunoRequest, 
  BrunoResponse, 
  BrunoRequestContext,
  BrunoRunRequestOptions,
  BrunoRunRequestResult,
  BrunoScriptRuntime,
  BrunoTestRuntime,
  BrunoAssertRuntime,
  BrunoAxiosInstance
} from './types';
import { interpolateRequest, createCombinedVariables } from './interpolation';

// Platform-specific interfaces that need to be implemented
export interface BrunoHttpClient {
  makeRequest(request: BrunoRequest, options?: any): Promise<BrunoResponse>;
}

export interface BrunoRuntimeProvider {
  createScriptRuntime(config?: any): BrunoScriptRuntime;
  createTestRuntime(config?: any): BrunoTestRuntime;
  createAssertRuntime(config?: any): BrunoAssertRuntime;
}

/**
 * Execute pre-request scripts
 */
export const executePreRequestScripts = async (
  context: BrunoRequestContext,
  runtimeProvider: BrunoRuntimeProvider,
  options: BrunoRunRequestOptions = {}
): Promise<{
  updatedRequest: BrunoRequest;
  updatedVariables: BrunoRequestContext['variables'];
  scriptResult: any;
  error?: Error;
}> => {
  const { scripts, request, variables } = context;
  const { 
    collectionPath = '',
    onConsoleLog,
    scriptingConfig,
    runRequestByItemPathname
  } = options;

  let updatedRequest = { ...request };
  let updatedVariables = { ...variables };
  let scriptResult: any = null;
  let error: Error | undefined;

  try {
    // Combine all pre-request scripts
    const combinedScript = scripts.preRequestScripts.join('\n');
    
    if (combinedScript.trim()) {
      const scriptRuntime = runtimeProvider.createScriptRuntime(scriptingConfig);
      
      scriptResult = await scriptRuntime.runRequestScript(
        combinedScript,
        updatedRequest,
        updatedVariables.envVariables,
        updatedVariables.runtimeVariables,
        collectionPath,
        onConsoleLog,
        updatedVariables.processEnvVariables,
        scriptingConfig,
        runRequestByItemPathname,
        context.collection.name
      );

      // Update variables from script result
      if (scriptResult) {
        updatedVariables.envVariables = scriptResult.envVariables || updatedVariables.envVariables;
        updatedVariables.runtimeVariables = scriptResult.runtimeVariables || updatedVariables.runtimeVariables;
        updatedVariables.globalEnvironmentVariables = scriptResult.globalEnvironmentVariables || updatedVariables.globalEnvironmentVariables;
        updatedRequest = scriptResult.request || updatedRequest;
      }
    }
  } catch (err) {
    error = err instanceof Error ? err : new Error(String(err));
  }

  return {
    updatedRequest,
    updatedVariables,
    scriptResult,
    error
  };
};

/**
 * Execute post-response scripts
 */
export const executePostResponseScripts = async (
  context: BrunoRequestContext,
  request: BrunoRequest,
  response: BrunoResponse,
  variables: BrunoRequestContext['variables'],
  runtimeProvider: BrunoRuntimeProvider,
  options: BrunoRunRequestOptions = {}
): Promise<{
  updatedRequest: BrunoRequest;
  updatedResponse: BrunoResponse;
  updatedVariables: BrunoRequestContext['variables'];
  scriptResult: any;
  error?: Error;
}> => {
  const { scripts } = context;
  const { 
    collectionPath = '',
    onConsoleLog,
    scriptingConfig,
    runRequestByItemPathname
  } = options;

  let updatedRequest = { ...request };
  let updatedResponse = { ...response };
  let updatedVariables = { ...variables };
  let scriptResult: any = null;
  let error: Error | undefined;

  try {
    // Combine all post-response scripts
    const combinedScript = scripts.postResponseScripts.join('\n');
    
    if (combinedScript.trim()) {
      const scriptRuntime = runtimeProvider.createScriptRuntime(scriptingConfig);
      
      scriptResult = await scriptRuntime.runResponseScript(
        combinedScript,
        updatedRequest,
        updatedResponse,
        updatedVariables.envVariables,
        updatedVariables.runtimeVariables,
        collectionPath,
        onConsoleLog,
        updatedVariables.processEnvVariables,
        scriptingConfig,
        runRequestByItemPathname,
        context.collection.name
      );

      // Update variables from script result
      if (scriptResult) {
        updatedVariables.envVariables = scriptResult.envVariables || updatedVariables.envVariables;
        updatedVariables.runtimeVariables = scriptResult.runtimeVariables || updatedVariables.runtimeVariables;
        updatedVariables.globalEnvironmentVariables = scriptResult.globalEnvironmentVariables || updatedVariables.globalEnvironmentVariables;
        updatedRequest = scriptResult.request || updatedRequest;
        updatedResponse = scriptResult.response || updatedResponse;
      }
    }
  } catch (err) {
    error = err instanceof Error ? err : new Error(String(err));
  }

  return {
    updatedRequest,
    updatedResponse,
    updatedVariables,
    scriptResult,
    error
  };
};

/**
 * Execute test scripts
 */
export const executeTestScripts = async (
  context: BrunoRequestContext,
  request: BrunoRequest,
  response: BrunoResponse,
  variables: BrunoRequestContext['variables'],
  runtimeProvider: BrunoRuntimeProvider,
  options: BrunoRunRequestOptions = {}
): Promise<{
  updatedVariables: BrunoRequestContext['variables'];
  testResults: any[];
  error?: Error;
}> => {
  const { scripts } = context;
  const { 
    collectionPath = '',
    onConsoleLog,
    scriptingConfig,
    runRequestByItemPathname
  } = options;

  let updatedVariables = { ...variables };
  let testResults: any[] = [];
  let error: Error | undefined;

  try {
    // Combine all test scripts
    const combinedScript = scripts.testScripts.join('\n');
    
    if (combinedScript.trim()) {
      const testRuntime = runtimeProvider.createTestRuntime(scriptingConfig);
      
      const scriptResult = await testRuntime.runTests(
        combinedScript,
        request,
        response,
        updatedVariables.envVariables,
        updatedVariables.runtimeVariables,
        collectionPath,
        onConsoleLog,
        updatedVariables.processEnvVariables,
        scriptingConfig,
        runRequestByItemPathname,
        context.collection.name
      );

      // Update variables from script result
      if (scriptResult) {
        updatedVariables.envVariables = scriptResult.envVariables || updatedVariables.envVariables;
        updatedVariables.runtimeVariables = scriptResult.runtimeVariables || updatedVariables.runtimeVariables;
        updatedVariables.globalEnvironmentVariables = scriptResult.globalEnvironmentVariables || updatedVariables.globalEnvironmentVariables;
        testResults = scriptResult.results || [];
      }
    }
  } catch (err) {
    error = err instanceof Error ? err : new Error(String(err));
  }

  return {
    updatedVariables,
    testResults,
    error
  };
};

/**
 * Execute assertions
 */
export const executeAssertions = (
  request: BrunoRequest,
  response: BrunoResponse,
  variables: BrunoRequestContext['variables'],
  runtimeProvider: BrunoRuntimeProvider,
  options: BrunoRunRequestOptions = {}
): {
  assertionResults: any[];
  error?: Error;
} => {
  let assertionResults: any[] = [];
  let error: Error | undefined;

  try {
    if (request.assertions && request.assertions.length > 0) {
      const assertRuntime = runtimeProvider.createAssertRuntime(options.scriptingConfig);
      
      assertionResults = assertRuntime.runAssertions(
        request.assertions,
        request,
        response,
        variables.envVariables,
        variables.runtimeVariables,
        variables.processEnvVariables
      );
    }
  } catch (err) {
    error = err instanceof Error ? err : new Error(String(err));
  }

  return {
    assertionResults,
    error
  };
};

/**
 * Main runRequest function that orchestrates the entire request execution flow
 */
export const runRequest = async (
  context: BrunoRequestContext,
  httpClient: BrunoHttpClient,
  runtimeProvider: BrunoRuntimeProvider,
  options: BrunoRunRequestOptions = {}
): Promise<BrunoRunRequestResult> => {
  const startTime = Date.now();
  let currentRequest = { ...context.request };
  let currentVariables = { ...context.variables };
  let response: BrunoResponse | undefined;
  let error: string | undefined;
  
  // Results tracking
  let testResults: any[] = [];
  let assertionResults: any[] = [];
  let preRequestTestResults: any[] = [];
  let postResponseTestResults: any[] = [];
  let skipRequest = false;
  let stopExecution = false;

  try {
    // Step 1: Execute pre-request scripts
    const preRequestResult = await executePreRequestScripts(
      context,
      runtimeProvider,
      options
    );
    
    if (preRequestResult.error) {
      throw preRequestResult.error;
    }
    
    currentRequest = preRequestResult.updatedRequest;
    currentVariables = preRequestResult.updatedVariables;
    
    // Check if request should be skipped
    if (preRequestResult.scriptResult?.skipRequest) {
      skipRequest = true;
      return {
        request: currentRequest,
        variables: {
          envVariables: currentVariables.envVariables,
          runtimeVariables: currentVariables.runtimeVariables,
          globalEnvironmentVariables: currentVariables.globalEnvironmentVariables
        },
        preRequestTestResults: preRequestResult.scriptResult?.results || [],
        duration: Date.now() - startTime,
        skipRequest: true,
        stopExecution: preRequestResult.scriptResult?.stopExecution || false
      };
    }
    
    // Step 2: Interpolate variables in request
    const combinedVariables = createCombinedVariables(currentVariables);
    const interpolatedRequest = interpolateRequest(
      currentRequest,
      combinedVariables,
      { processEnvVars: currentVariables.processEnvVariables }
    );
    
    // Step 3: Execute HTTP request
    response = await httpClient.makeRequest(interpolatedRequest, options);
    
    // Step 4: Execute post-response scripts
    const postResponseResult = await executePostResponseScripts(
      context,
      interpolatedRequest,
      response,
      currentVariables,
      runtimeProvider,
      options
    );
    
    if (postResponseResult.error) {
      console.error('Post-response script error:', postResponseResult.error);
      // Don't throw here, continue with tests and assertions
    }
    
    currentRequest = postResponseResult.updatedRequest;
    response = postResponseResult.updatedResponse;
    currentVariables = postResponseResult.updatedVariables;
    postResponseTestResults = postResponseResult.scriptResult?.results || [];
    
    // Step 5: Execute test scripts
    const testResult = await executeTestScripts(
      context,
      currentRequest,
      response,
      currentVariables,
      runtimeProvider,
      options
    );
    
    if (testResult.error) {
      console.error('Test script error:', testResult.error);
      // Don't throw here, continue with assertions
    }
    
    currentVariables = testResult.updatedVariables;
    testResults = testResult.testResults;
    
    // Step 6: Execute assertions
    const assertionResult = executeAssertions(
      currentRequest,
      response,
      currentVariables,
      runtimeProvider,
      options
    );
    
    if (assertionResult.error) {
      console.error('Assertion error:', assertionResult.error);
      // Don't throw here, just log
    }
    
    assertionResults = assertionResult.assertionResults;
    
  } catch (err) {
    error = err instanceof Error ? err.message : String(err);
    console.error('Request execution error:', err);
  }

  const duration = Date.now() - startTime;

  return {
    request: currentRequest,
    response,
    error,
    variables: {
      envVariables: currentVariables.envVariables,
      runtimeVariables: currentVariables.runtimeVariables,
      globalEnvironmentVariables: currentVariables.globalEnvironmentVariables
    },
    testResults,
    assertionResults,
    preRequestTestResults,
    postResponseTestResults,
    duration,
    timeline: response?.timeline,
    skipRequest,
    stopExecution
  };
};

/**
 * Utility function to create a simple HTTP client interface
 * This is a placeholder that needs to be implemented for each platform
 */
export const createHttpClient = (config?: any): BrunoHttpClient => {
  return {
    makeRequest: async (request: BrunoRequest, options?: any): Promise<BrunoResponse> => {
      throw new Error('HTTP client not implemented. Please provide a platform-specific implementation.');
    }
  };
};

/**
 * Utility function to create a simple runtime provider interface
 * This is a placeholder that needs to be implemented for each platform
 */
export const createRuntimeProvider = (config?: any): BrunoRuntimeProvider => {
  return {
    createScriptRuntime: (config?: any): BrunoScriptRuntime => {
      throw new Error('Script runtime not implemented. Please provide a platform-specific implementation.');
    },
    createTestRuntime: (config?: any): BrunoTestRuntime => {
      throw new Error('Test runtime not implemented. Please provide a platform-specific implementation.');
    },
    createAssertRuntime: (config?: any): BrunoAssertRuntime => {
      throw new Error('Assert runtime not implemented. Please provide a platform-specific implementation.');
    }
  };
}; 