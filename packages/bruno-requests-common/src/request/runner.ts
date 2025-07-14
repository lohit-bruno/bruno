import { 
  BrunoRequest, 
  BrunoResponse, 
  BrunoRequestContext,
  BrunoRunRequestOptions,
  BrunoRunRequestResult,
  BrunoScriptRuntime,
  BrunoTestRuntime,
  BrunoAssertRuntime,
  BrunoVariables
} from './types';
import { interpolateRequest, createCombinedVariables } from './interpolation';
import { AxiosRequestConfig } from 'axios';
import { makeAxiosInstance } from '../network';
const { ScriptRuntime } = require('@usebruno/js-common');

// Platform-specific interfaces that need to be implemented
export interface BrunoHttpClient {
  makeRequest({ request, options }: { request: any; options?: any }): Promise<any>; // ?
}

export interface BrunoRuntimeProvider {
  createScriptRuntime({ config }: { config?: any }): BrunoScriptRuntime;
  createTestRuntime({ config }: { config?: any }): BrunoTestRuntime;
  createAssertRuntime({ config }: { config?: any }): BrunoAssertRuntime;
}

/**
 * Unified function to run scripts (pre-request, post-response, tests)
 */
export const runScripts = async ({
  scripts,
  request,
  response,
  variables,
  runtimeProvider,
  options
}: {
  scripts: string[];
  request: BrunoRequest;
  response?: BrunoResponse;
  variables: BrunoVariables;
  runtimeProvider: BrunoRuntimeProvider;
  options: BrunoRunRequestOptions & { collectionName: string };
}): Promise<{
  updatedRequest: BrunoRequest;
  updatedResponse?: BrunoResponse;
  updatedVariables: BrunoVariables;
  scriptResult: any;
  error?: Error;
}> => {
  const { 
    collectionPath = '',
    onConsoleLog,
    scriptingConfig,
    runRequestByItemPathname,
    collectionName
  } = options;

  let updatedRequest = { ...request };
  let updatedResponse = response ? { ...response } : undefined;
  let updatedVariables = { ...variables };
  let scriptResult: any = null;
  let error: Error | undefined;

  try {
    // Combine all scripts
    const combinedScript = scripts.join('\n');
    
    if (combinedScript.trim()) {
      const scriptRuntime = runtimeProvider.createScriptRuntime({ config: scriptingConfig });
      
      scriptResult = await scriptRuntime.runScript({
        script: combinedScript,
        request: updatedRequest,
        response: updatedResponse,
        variables: updatedVariables,
        assertionResults: [],
        collectionName,
        collectionPath,
        onConsoleLog,
        runRequestByItemPathname
      });

      // Update variables from script result
      if (scriptResult) {
        updatedVariables.envVariables = scriptResult.envVariables || updatedVariables.envVariables;
        updatedVariables.runtimeVariables = scriptResult.runtimeVariables || updatedVariables.runtimeVariables;
        updatedVariables.globalEnvironmentVariables = scriptResult.globalEnvironmentVariables || updatedVariables.globalEnvironmentVariables;
        updatedRequest = scriptResult.request || updatedRequest;
        if (updatedResponse) {
          updatedResponse = scriptResult.response || updatedResponse;
        }
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
export const executeTestScripts = async ({
  context,
  request,
  response,
  variables,
  runtimeProvider,
  options
}: {
  context: BrunoRequestContext;
  request: BrunoRequest;
  response: BrunoResponse;
  variables: BrunoVariables;
  runtimeProvider: BrunoRuntimeProvider;
  options: BrunoRunRequestOptions;
}): Promise<{
  updatedVariables: BrunoVariables;
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
      const testRuntime = runtimeProvider.createTestRuntime({ config: scriptingConfig });
      
      const scriptResult = await testRuntime.runTests({
        testsFile: combinedScript,
        request,
        response,
        variables: updatedVariables,
        collectionPath,
        onConsoleLog,
        scriptingConfig,
        runRequestByItemPathname,
        collectionName: context.collectionName
      });

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
export const executeAssertions = ({
  request,
  response,
  variables,
  runtimeProvider,
  options
}: {
  request: BrunoRequest;
  response: BrunoResponse;
  variables: BrunoVariables;
  runtimeProvider: BrunoRuntimeProvider;
  options: BrunoRunRequestOptions;
}): {
  assertionResults: any[];
  error?: Error;
} => {
  let assertionResults: any[] = [];
  let error: Error | undefined;

  try {
    if (request.assertions && request.assertions.length > 0) {
      const assertRuntime = runtimeProvider.createAssertRuntime({ config: options.scriptingConfig });
      
      assertionResults = assertRuntime.runAssertions({
        assertions: request.assertions,
        request,
        response,
        variables
      });
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
export const runRequest = async ({
  context,
  httpClient,
  runtimeProvider,
  options = {}
}: {
  context: BrunoRequestContext;
  httpClient: BrunoHttpClient;
  runtimeProvider: BrunoRuntimeProvider;
  options?: BrunoRunRequestOptions;
}): Promise<BrunoRunRequestResult> => {
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
    const preRequestResult = await runScripts({
      scripts: context.scripts.preRequestScripts,
      request: currentRequest,
      variables: currentVariables,
      runtimeProvider,
      options: { ...options, collectionName: context.collectionName }
    });
    
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

    console.log("make request", interpolatedRequest, options);
    
    // Step 3: Execute HTTP request
    response = await httpClient.makeRequest({ request: interpolatedRequest, options });

    console.log("make request done", response);
    
    // Step 4: Execute post-response scripts
    const postResponseResult = await runScripts({
      scripts: context.scripts.postResponseScripts,
      request: interpolatedRequest,
      response,
      variables: currentVariables,
      runtimeProvider,
      options: { ...options, collectionName: context.collectionName }
    });
    
    if (postResponseResult.error) {
      console.error('Post-response script error:', postResponseResult.error);
      // Don't throw here, continue with tests and assertions
    }
    
    currentRequest = postResponseResult.updatedRequest;
    response = postResponseResult.updatedResponse || response;
    currentVariables = postResponseResult.updatedVariables;
    postResponseTestResults = postResponseResult.scriptResult?.results || [];
    
    // Step 5: Execute test scripts
    if (response) {
      const testResult = await executeTestScripts({
        context,
        request: currentRequest,
        response,
        variables: currentVariables,
        runtimeProvider,
        options
      });
      
      if (testResult.error) {
        console.error('Test script error:', testResult.error);
        // Don't throw here, continue with assertions
      }
      
      currentVariables = testResult.updatedVariables;
      testResults = testResult.testResults;
    }
    
    // Step 6: Execute assertions
    if (response) {
      const assertionResult = executeAssertions({
        request: currentRequest,
        response,
        variables: currentVariables,
        runtimeProvider,
        options
      });
      
      if (assertionResult.error) {
        console.error('Assertion error:', assertionResult.error);
        // Don't throw here, just log
      }
      
      if (assertionResult.error) {
        console.error('Assertion error:', assertionResult.error);
        // Don't throw here, just log
      }
      
      assertionResults = assertionResult.assertionResults;
    }
    
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
  // ?
  const requestConfig: Partial<AxiosRequestConfig> = {
    ...config
  }
  const axiosInstance = makeAxiosInstance(requestConfig);
  return {
    makeRequest: async (request: any, options?: any): Promise<any> => { // ?
      return await axiosInstance(request);
      // throw new Error('HTTP client not implemented. Please provide a platform-specific implementation.');
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
      const scriptRuntime = new ScriptRuntime(config);
      return {
        runScript: async ({
          script,
          request,
          response,
          variables,
          assertionResults = [],
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
        }) => {
          return await scriptRuntime.runScript({
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
        }
      };
    },
    createTestRuntime: (config?: any): BrunoTestRuntime => {
      const scriptRuntime = new ScriptRuntime(config);
      return {
        runTests: async ({
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
          scriptingConfig?: any;
          runRequestByItemPathname?: (pathname: string) => Promise<BrunoResponse>;
          collectionName?: string;
        }) => {
          // Use the script runtime for tests - the test context is provided via the 'test' method
          return await scriptRuntime.runScript({
            script: testsFile,
            request,
            response,
            variables,
            assertionResults: [],
            collectionName: collectionName || 'unknown',
            collectionPath,
            onConsoleLog,
            runRequestByItemPathname
          });
        }
      };
    },
    createAssertRuntime: (config?: any): BrunoAssertRuntime => {
      return {
        runAssertions: ({
          assertions,
          request,
          response,
          variables
        }: {
          assertions: any[];
          request: BrunoRequest;
          response: BrunoResponse;
          variables: BrunoVariables;
        }) => {
          // For now, return empty assertion results
          // This would need to be implemented based on the assertion format
          console.warn('Assertion runtime not fully implemented yet');
          return [];
        }
      };
    }
  };
}; 