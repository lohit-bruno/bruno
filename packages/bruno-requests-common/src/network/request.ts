import { AxiosResponse } from 'axios';
import { RequestContext, RequestResponse } from '../types';
import {
  prepareRequestStep,
  validateRequestStep,
  applyDefaultHeadersStep,
  prepareScriptVariablesStep,
  executePreRequestScriptStep,
  interpolateVariablesStep,
  handleGraphQLVariablesStep,
  handleFormURLEncodingStep,
  executeHttpRequestStep,
  processResponseStep,
  executePostResponseVariablesStep,
  executePostResponseScriptStep,
  executeAssertionsStep,
  executeTestScriptStep,
  createFinalResponseStep,
  createErrorResponse,
  createSkipResponse
} from '../execution';

export const runRequestWithContext = async ({ 
  context 
}: { 
  context: RequestContext 
}): Promise<RequestResponse> => {
  // Initialize execution state
  let preRequestResults: any[] = [];
  let postResponseResults: any[] = [];
  let testResults: any[] = [];
  let assertionResults: any[] = [];
  let nextRequestName: string | undefined;
  let skipRequest = false;
  let stopExecution = false;
  let responseTime = 0;

  try {
    // Step 1: Prepare the request
    let request = prepareRequestStep({ context });

    // Step 2: Validate the request
    const validation = validateRequestStep({ request });
    if (!validation.isValid) {
      throw new Error(`Request validation failed: ${validation.errors.join(', ')}`);
    }

    // Step 3: Apply default headers
    request = applyDefaultHeadersStep({ request });

    // Step 4: Prepare script variables
    let scriptVariables = prepareScriptVariablesStep({ request, context });

    // Step 5: Execute pre-request script
    if (request.script?.req && context.scriptRuntime) {
      const { result: preRequestResult, updatedVariables } = await executePreRequestScriptStep({
        request,
        scriptVariables,
        context
      });

      preRequestResults = preRequestResult.results || [];
      nextRequestName = preRequestResult.nextRequestName;
      skipRequest = preRequestResult.skipRequest || false;
      stopExecution = preRequestResult.stopExecution || false;
      scriptVariables = updatedVariables;
    }

    // Step 6: Check if request should be skipped
    if (skipRequest) {
      return createSkipResponse({
        preRequestResults,
        nextRequestName,
        stopExecution
      });
    }

    // Step 7: Interpolate variables in the request
    request = interpolateVariablesStep({ request, context });

    // Step 8: Handle GraphQL variable parsing
    request = handleGraphQLVariablesStep({ request });

    // Step 9: Handle form URL encoded data
    request = handleFormURLEncodingStep({ request });

    // Step 10: Execute the HTTP request
    const { response, responseTime: reqTime } = await executeHttpRequestStep({
      request,
      context
    });
    responseTime = reqTime;

    // Step 11: Process response data
    const { size } = processResponseStep({ response, request });

    // Step 12: Execute post-response variables
    if (request.vars?.res && context.varsRuntime) {
      scriptVariables = executePostResponseVariablesStep({
        request,
        response,
        scriptVariables,
        context
      });
    }

    // Step 13: Execute post-response script
    if (request.script?.res && context.scriptRuntime) {
      const { result: postResponseResult, updatedVariables } = await executePostResponseScriptStep({
        request,
        response,
        scriptVariables,
        context
      });

      postResponseResults = postResponseResult.results || [];
      nextRequestName = postResponseResult.nextRequestName || nextRequestName;
      stopExecution = postResponseResult.stopExecution || stopExecution;
      scriptVariables = updatedVariables;
    }

    // Step 14: Execute assertions
    if (request.assertions && context.assertRuntime) {
      assertionResults = executeAssertionsStep({
        request,
        response,
        context
      });
    }

    // Step 15: Execute test script
    if (request.tests && context.scriptRuntime) {
      const { result: testResult, updatedVariables } = await executeTestScriptStep({
        request,
        response,
        scriptVariables,
        context
      });

      testResults = testResult.results || [];
      nextRequestName = testResult.nextRequestName || nextRequestName;
      scriptVariables = updatedVariables;
    }

    // Step 16: Create final response
    return createFinalResponseStep({
      response,
      responseTime,
      size,
      preRequestResults,
      postResponseResults,
      testResults,
      assertionResults,
      nextRequestName,
      skipRequest,
      stopExecution
    });

  } catch (error: any) {
    return createErrorResponse({
      error,
      responseTime,
      preRequestResults,
      postResponseResults,
      testResults,
      assertionResults,
      nextRequestName,
      skipRequest,
      stopExecution
    });
  }
};

// Legacy support - Create wrapper for backward compatibility
export const runRequestLegacy = async (options: any): Promise<RequestResponse> => {
  const context: RequestContext = {
    item: options.item,
    collection: options.collection,
    envVars: options.envVars,
    runtimeVariables: options.runtimeVariables,
    processEnvVars: options.processEnvVars,
    collectionUid: options.collectionUid,
    collectionPath: options.collectionPath,
    collectionName: options.collectionName,
    timeout: options.timeout,
    runtime: options.runtime,
    scriptRuntime: options.scriptRuntime,
    varsRuntime: options.varsRuntime,
    assertRuntime: options.assertRuntime,
    onConsoleLog: options.onConsoleLog,
    runRequestByItemPathname: options.runRequestByItemPathname
  };

  return runRequestWithContext({ context });
};

// Export types for external use
export type { RequestContext, RequestResponse };

// Export legacy types for backward compatibility  
export interface RequestOptions {
  item: any;
  collection?: any;
  envVars?: Record<string, any>;
  runtimeVariables?: Record<string, any>;
  processEnvVars?: Record<string, any>;
  collectionUid?: string;
  collectionPath?: string;
  collectionName?: string;
  timeout?: number;
  scriptRuntime?: any;
  varsRuntime?: any;
  assertRuntime?: any;
  onConsoleLog?: (type: string, args: any[]) => void;
  runRequestByItemPathname?: (pathname: string) => Promise<any>;
  runtime?: string;
}

export interface RequestResult extends RequestResponse {}

// Re-export the main function as the default export
export { runRequestWithContext as runRequestModular, runRequestLegacy as runRequest };
