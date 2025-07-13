import { AxiosResponse } from 'axios';
import { prepareRequest, RequestItem, Collection } from '../utils/request-preparation';
import { interpolateVars, InterpolationOptions } from '../utils/interpolation';
import { configureRequest, validateRequest, applyDefaultHeaders } from './request-configuration';
import {
  executePreRequestScript,
  executePostResponseScript,
  executeTestScript,
  executePostResponseVars,
  executeAssertions,
  ScriptRuntime,
  VarsRuntime,
  AssertRuntime,
  ScriptVariables
} from '../scripting/script-execution';

export interface RequestOptions {
  item: RequestItem;
  collection?: Collection;
  envVars?: Record<string, any>;
  runtimeVariables?: Record<string, any>;
  processEnvVars?: Record<string, any>;
  collectionUid?: string;
  collectionPath?: string;
  collectionName?: string;
  timeout?: number;
  scriptRuntime?: ScriptRuntime;
  varsRuntime?: VarsRuntime;
  assertRuntime?: AssertRuntime;
  onConsoleLog?: (type: string, args: any[]) => void;
  runRequestByItemPathname?: (pathname: string) => Promise<any>;
  runtime?: string;
}

export interface RequestResult {
  status?: number;
  statusText?: string;
  headers?: Record<string, any>;
  data?: any;
  responseTime?: number;
  size?: number;
  timeline?: any[];
  error?: string | Error;
  isCancel?: boolean;
  nextRequestName?: string;
  skipRequest?: boolean;
  stopExecution?: boolean;
  preRequestResults?: any[];
  postResponseResults?: any[];
  testResults?: any[];
  assertionResults?: any[];
}

/**
 * Parse response data for different content types
 */
const parseResponseData = (response: AxiosResponse): { data: any; size: number } => {
  let data = response.data;
  let size = 0;

  try {
    if (response.data) {
      if (response.data instanceof ArrayBuffer) {
        size = response.data.byteLength;
        // Convert ArrayBuffer to base64 string for isomorphic compatibility
        const uint8Array = new Uint8Array(response.data);
        data = btoa(String.fromCharCode(...uint8Array));
      } else if (typeof response.data === 'string') {
        size = new Blob([response.data]).size;
        data = response.data;
      } else if (typeof response.data === 'object') {
        const jsonString = JSON.stringify(response.data);
        size = new Blob([jsonString]).size;
        data = response.data;
      } else {
        size = new Blob([String(response.data)]).size;
        data = response.data;
      }
    }
  } catch (error) {
    console.warn('Error parsing response data:', error);
    data = response.data;
    size = 0;
  }

  return { data, size };
};

/**
 * Main isomorphic request function
 * Orchestrates the entire request lifecycle similar to runRequest in bruno-electron
 * but without Node.js specific features
 */
export const runRequest = async (options: RequestOptions): Promise<RequestResult> => {
  const {
    item,
    collection = {},
    envVars = {},
    runtimeVariables = {},
    processEnvVars = {},
    collectionUid = '',
    collectionPath = '',
    collectionName = '',
    timeout = 30000,
    scriptRuntime,
    varsRuntime,
    assertRuntime,
    onConsoleLog,
    runRequestByItemPathname,
    runtime = 'quickjs'
  } = options;

  let preRequestResults: any[] = [];
  let postResponseResults: any[] = [];
  let testResults: any[] = [];
  let assertionResults: any[] = [];
  let nextRequestName: string | undefined;
  let skipRequest = false;
  let stopExecution = false;

  try {
    // Step 1: Prepare the request
    const request = prepareRequest(item, collection);
    request.__bruno__executionMode = 'isomorphic';

    // Step 2: Validate the request
    const validation = validateRequest(request);
    if (!validation.isValid) {
      throw new Error(`Request validation failed: ${validation.errors.join(', ')}`);
    }

    // Step 3: Apply default headers
    applyDefaultHeaders(request);

    // Step 4: Prepare script variables
    const scriptVariables: ScriptVariables = {
      processEnvVars,
      envVariables: envVars,
      globalEnvironmentVariables: collection.globalEnvironmentVariables || {},
      oauth2CredentialVariables: request.oauth2CredentialVariables || {},
      collectionVariables: request.collectionVariables || {},
      folderVariables: request.folderVariables || {},
      requestVariables: request.requestVariables || {},
      runtimeVariables
    };

    // Step 5: Execute pre-request script
    if (request.script?.req) {
      const preRequestResult = await executePreRequestScript({
        script: request.script.req,
        request,
        variables: scriptVariables,
        assertionResults: [],
        collectionName,
        collectionPath,
        onConsoleLog,
        runRequestByItemPathname,
        scriptRuntime
      });

      if (preRequestResult.error) {
        throw preRequestResult.error;
      }

      preRequestResults = preRequestResult.results || [];
      nextRequestName = preRequestResult.nextRequestName;
      skipRequest = preRequestResult.skipRequest || false;
      stopExecution = preRequestResult.stopExecution || false;

      // Update variables from script execution
      Object.assign(scriptVariables.envVariables || {}, preRequestResult.envVariables);
      Object.assign(scriptVariables.runtimeVariables || {}, preRequestResult.runtimeVariables);
      Object.assign(scriptVariables.globalEnvironmentVariables || {}, preRequestResult.globalEnvironmentVariables);
    }

    // Step 6: Check if request should be skipped
    if (skipRequest) {
      return {
        status: 200,
        statusText: 'Request skipped via pre-request script',
        data: null,
        responseTime: 0,
        headers: {},
        skipRequest: true,
        preRequestResults,
        nextRequestName,
        stopExecution
      };
    }

    // Step 7: Interpolate variables in the request
    interpolateVars(request, envVars, runtimeVariables, processEnvVars);

    // Step 8: Handle GraphQL variable parsing
    if (request.mode === 'graphql' && request.data?.variables) {
      try {
        request.data.variables = JSON.parse(request.data.variables);
      } catch (error) {
        console.warn('Failed to parse GraphQL variables:', error);
      }
    }

    // Step 9: Handle form URL encoded data
    if (request.headers['content-type'] === 'application/x-www-form-urlencoded' && typeof request.data === 'object') {
      const params = new URLSearchParams();
      Object.entries(request.data).forEach(([key, value]) => {
        if (Array.isArray(value)) {
          value.forEach(v => params.append(key, String(v)));
        } else {
          params.append(key, String(value));
        }
      });
      request.data = params.toString();
    }

    // Step 10: Configure axios instance
    const axiosInstance = await configureRequest({
      request,
      envVars,
      runtimeVariables,
      processEnvVars,
      collectionUid,
      collectionPath,
      timeout
    });

    // Step 11: Execute the HTTP request
    const startTime = Date.now();
    let response: AxiosResponse;
    let responseTime: number;

    try {
      response = await axiosInstance(request);
      responseTime = Date.now() - startTime;
    } catch (error: any) {
      responseTime = Date.now() - startTime;

      // Handle axios errors
      if (error.response) {
        response = error.response;
      } else {
        // Network or other errors
        return {
          statusText: error.statusText || 'Network Error',
          error: error.message || 'Error occurred while executing the request!',
          responseTime,
          preRequestResults,
          nextRequestName,
          stopExecution
        };
      }
    }

    // Step 12: Parse response data
    const { data, size } = parseResponseData(response);
    response.data = data;

    // Step 13: Execute post-response variables
    if (request.vars?.res && varsRuntime) {
      try {
        const varsResult = executePostResponseVars(
          request.vars.res,
          request,
          response,
          envVars,
          runtimeVariables,
          collectionPath,
          processEnvVars,
          varsRuntime
        );

        if (varsResult) {
          Object.assign(scriptVariables.envVariables || {}, varsResult.envVariables || {});
          Object.assign(scriptVariables.runtimeVariables || {}, varsResult.runtimeVariables || {});
          Object.assign(scriptVariables.globalEnvironmentVariables || {}, varsResult.globalEnvironmentVariables || {});
        }
      } catch (error) {
        console.warn('Post-response variables execution failed:', error);
      }
    }

    // Step 14: Execute post-response script
    if (request.script?.res) {
      const postResponseResult = await executePostResponseScript({
        script: request.script.res,
        request,
        response,
        variables: scriptVariables,
        assertionResults: [],
        collectionName,
        collectionPath,
        onConsoleLog,
        runRequestByItemPathname,
        scriptRuntime
      });

      if (postResponseResult.error) {
        console.warn('Post-response script error:', postResponseResult.error);
      } else {
        postResponseResults = postResponseResult.results || [];
        nextRequestName = postResponseResult.nextRequestName || nextRequestName;
        stopExecution = postResponseResult.stopExecution || stopExecution;

        // Update variables from script execution
        Object.assign(scriptVariables.envVariables || {}, postResponseResult.envVariables);
        Object.assign(scriptVariables.runtimeVariables || {}, postResponseResult.runtimeVariables);
        Object.assign(scriptVariables.globalEnvironmentVariables || {}, postResponseResult.globalEnvironmentVariables);
      }
    }

    // Step 15: Execute assertions
    if (request.assertions && assertRuntime) {
      try {
        assertionResults = executeAssertions(
          request.assertions,
          request,
          response,
          envVars,
          runtimeVariables,
          processEnvVars,
          assertRuntime
        );
      } catch (error) {
        console.warn('Assertions execution failed:', error);
      }
    }

    // Step 16: Execute tests
    if (request.tests) {
      const testResult = await executeTestScript({
        script: request.tests,
        request,
        response,
        variables: scriptVariables,
        assertionResults: [],
        collectionName,
        collectionPath,
        onConsoleLog,
        runRequestByItemPathname,
        scriptRuntime
      });

      if (testResult.error) {
        console.warn('Test script error:', testResult.error);
      } else {
        testResults = testResult.results || [];
        nextRequestName = testResult.nextRequestName || nextRequestName;

        // Update variables from script execution
        Object.assign(scriptVariables.envVariables || {}, testResult.envVariables);
        Object.assign(scriptVariables.runtimeVariables || {}, testResult.runtimeVariables);
        Object.assign(scriptVariables.globalEnvironmentVariables || {}, testResult.globalEnvironmentVariables);
      }
    }

    // Step 17: Return the final result
    return {
      status: response.status,
      statusText: response.statusText,
      headers: response.headers,
      data: response.data,
      responseTime,
      size,
      timeline: (response as any).timeline,
      nextRequestName,
      skipRequest,
      stopExecution,
      preRequestResults,
      postResponseResults,
      testResults,
      assertionResults
    };

  } catch (error: any) {
    return {
      status: error?.status,
      error: error?.message || 'Error occurred while executing the request!',
      nextRequestName,
      skipRequest,
      stopExecution,
      preRequestResults,
      postResponseResults,
      testResults,
      assertionResults
    };
  }
};
