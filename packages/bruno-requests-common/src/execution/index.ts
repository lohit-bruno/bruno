import { AxiosResponse } from 'axios';
import { 
  RequestContext, 
  RequestResponse, 
  ScriptOptions, 
  ScriptResult, 
  ValidationResult 
} from '../types';
import { interpolateRequest } from '../utils/interpolation';
import { prepareRequest } from '../utils/request-preparation';
import { configureRequest } from '../network/request-configuration';
import { processResponse } from '../utils/response-processing';
import { 
  executePreRequestScript, 
  executePostResponseScript, 
  executeTestScript, 
  executePostResponseVars, 
  executeAssertions 
} from '../scripting/script-execution';

// Step 1: Request preparation
export const prepareRequestStep = ({ 
  context 
}: { 
  context: RequestContext 
}): any => {
  const request = prepareRequest({
    item: context.item,
    collection: context.collection,
    abortController: undefined // Optional in isomorphic version
  });
  
  request.__bruno__executionMode = 'isomorphic';
  return request;
};

// Step 2: Request validation
export const validateRequestStep = ({ 
  request 
}: { 
  request: any 
}): ValidationResult => {
  const errors: string[] = [];
  
  // Basic validation
  if (!request.url) {
    errors.push('URL is required');
  }
  
  if (!request.method) {
    errors.push('HTTP method is required');
  }
  
  // Validate URL format
  if (request.url) {
    try {
      new URL(request.url.startsWith('http') ? request.url : `http://${request.url}`);
    } catch (error) {
      errors.push('Invalid URL format');
    }
  }
  
  return {
    isValid: errors.length === 0,
    errors
  };
};

// Step 3: Apply default headers
export const applyDefaultHeadersStep = ({ 
  request 
}: { 
  request: any 
}): any => {
  const result = { ...request };
  
  // Apply default headers if not already set
  if (!result.headers) {
    result.headers = {};
  }
  
  // Set default user-agent if not provided
  if (!result.headers['user-agent'] && !result.headers['User-Agent']) {
    result.headers['User-Agent'] = 'Bruno/1.0 (https://www.usebruno.com)';
  }
  
  return result;
};

// Step 4: Prepare script variables
export const prepareScriptVariablesStep = ({ 
  request, 
  context 
}: { 
  request: any; 
  context: RequestContext 
}): any => {
  return {
    processEnvVars: context.processEnvVars || {},
    envVariables: context.envVars || {},
    globalEnvironmentVariables: context.collection?.globalEnvironmentVariables || {},
    oauth2CredentialVariables: request.oauth2CredentialVariables || {},
    collectionVariables: request.collectionVariables || {},
    folderVariables: request.folderVariables || {},
    requestVariables: request.requestVariables || {},
    runtimeVariables: context.runtimeVariables || {}
  };
};

// Step 5: Execute pre-request script
export const executePreRequestScriptStep = async ({ 
  request, 
  scriptVariables, 
  context 
}: { 
  request: any; 
  scriptVariables: any; 
  context: RequestContext 
}): Promise<{ 
  result: ScriptResult; 
  updatedVariables: any 
}> => {
  let result: ScriptResult = { results: [] };
  let updatedVariables = { ...scriptVariables };
  
  if (request.script?.req && context.scriptRuntime) {
    result = await executePreRequestScript({
      script: request.script.req,
      request,
      variables: scriptVariables,
      assertionResults: [],
      collectionName: context.collectionName,
      collectionPath: context.collectionPath,
      onConsoleLog: context.onConsoleLog,
      runRequestByItemPathname: context.runRequestByItemPathname,
      scriptRuntime: context.scriptRuntime
    });
    
    if (result.error) {
      throw result.error;
    }
    
    // Update variables from script execution
    Object.assign(updatedVariables.envVariables, result.envVariables);
    Object.assign(updatedVariables.runtimeVariables, result.runtimeVariables);
    Object.assign(updatedVariables.globalEnvironmentVariables, result.globalEnvironmentVariables);
  }
  
  return { result, updatedVariables };
};

// Step 6: Variable interpolation
export const interpolateVariablesStep = ({ 
  request, 
  context 
}: { 
  request: any; 
  context: RequestContext 
}): any => {
  return interpolateRequest({
    request,
    envVars: context.envVars,
    runtimeVariables: context.runtimeVariables,
    processEnvVars: context.processEnvVars
  });
};

// Step 7: Handle GraphQL variables
export const handleGraphQLVariablesStep = ({ 
  request 
}: { 
  request: any 
}): any => {
  const result = { ...request };
  
  if (result.mode === 'graphql' && result.data?.variables) {
    try {
      result.data.variables = JSON.parse(result.data.variables);
    } catch (error) {
      console.warn('Failed to parse GraphQL variables:', error);
    }
  }
  
  return result;
};

// Step 8: Handle form URL encoding
export const handleFormURLEncodingStep = ({ 
  request 
}: { 
  request: any 
}): any => {
  const result = { ...request };
  
  if (result.headers['content-type'] === 'application/x-www-form-urlencoded' && typeof result.data === 'object') {
    const params = new URLSearchParams();
    Object.entries(result.data).forEach(([key, value]) => {
      if (Array.isArray(value)) {
        value.forEach(v => params.append(key, String(v)));
      } else {
        params.append(key, String(value));
      }
    });
    result.data = params.toString();
  }
  
  return result;
};

// Step 9: Execute HTTP request
export const executeHttpRequestStep = async ({ 
  request, 
  context 
}: { 
  request: any; 
  context: RequestContext 
}): Promise<{ 
  response: AxiosResponse; 
  responseTime: number 
}> => {
  const axiosInstance = await configureRequest({
    request,
    envVars: context.envVars,
    runtimeVariables: context.runtimeVariables,
    processEnvVars: context.processEnvVars,
    collectionUid: context.collectionUid,
    collectionPath: context.collectionPath,
    timeout: context.timeout
  });
  
  const startTime = Date.now();
  
  try {
    const response = await axiosInstance(request);
    const responseTime = Date.now() - startTime;
    return { response, responseTime };
  } catch (error: any) {
    const responseTime = Date.now() - startTime;
    
    if (error.response) {
      return { response: error.response, responseTime };
    } else {
      throw {
        ...error,
        responseTime,
        statusText: error.statusText || 'Network Error',
        message: error.message || 'Error occurred while executing the request!'
      };
    }
  }
};

// Step 10: Process response
export const processResponseStep = ({ 
  response, 
  request 
}: { 
  response: AxiosResponse; 
  request: any 
}): { 
  processedResponse: any; 
  size: number 
} => {
  const { processedResponse, size } = processResponse(response, request);
  response.data = processedResponse.data;
  return { processedResponse, size };
};

// Step 11: Execute post-response variables
export const executePostResponseVariablesStep = ({ 
  request, 
  response, 
  scriptVariables, 
  context 
}: { 
  request: any; 
  response: AxiosResponse; 
  scriptVariables: any; 
  context: RequestContext 
}): any => {
  let updatedVariables = { ...scriptVariables };
  
  if (request.vars?.res && context.varsRuntime) {
    try {
      const varsResult = context.varsRuntime.runPostResponseVars(
        request.vars.res,
        request,
        response,
        context.envVars || {},
        context.runtimeVariables || {},
        context.collectionPath || '',
        context.processEnvVars || {}
      );
      
      if (varsResult) {
        Object.assign(updatedVariables.envVariables, varsResult.envVariables || {});
        Object.assign(updatedVariables.runtimeVariables, varsResult.runtimeVariables || {});
        Object.assign(updatedVariables.globalEnvironmentVariables, varsResult.globalEnvironmentVariables || {});
      }
    } catch (error) {
      console.warn('Post-response variables execution failed:', error);
    }
  }
  
  return updatedVariables;
};

// Step 12: Execute post-response script
export const executePostResponseScriptStep = async ({ 
  request, 
  response, 
  scriptVariables, 
  context 
}: { 
  request: any; 
  response: AxiosResponse; 
  scriptVariables: any; 
  context: RequestContext 
}): Promise<{ 
  result: ScriptResult; 
  updatedVariables: any 
}> => {
  let result: ScriptResult = { results: [] };
  let updatedVariables = { ...scriptVariables };
  
  if (request.script?.res && context.scriptRuntime) {
    result = await executePostResponseScript({
      script: request.script.res,
      request,
      response,
      variables: scriptVariables,
      assertionResults: [],
      collectionName: context.collectionName,
      collectionPath: context.collectionPath,
      onConsoleLog: context.onConsoleLog,
      runRequestByItemPathname: context.runRequestByItemPathname,
      scriptRuntime: context.scriptRuntime
    });
    
    if (result.error) {
      console.warn('Post-response script error:', result.error);
    } else {
      // Update variables from script execution
      Object.assign(updatedVariables.envVariables, result.envVariables);
      Object.assign(updatedVariables.runtimeVariables, result.runtimeVariables);
      Object.assign(updatedVariables.globalEnvironmentVariables, result.globalEnvironmentVariables);
    }
  }
  
  return { result, updatedVariables };
};

// Step 13: Execute assertions
export const executeAssertionsStep = ({ 
  request, 
  response, 
  context 
}: { 
  request: any; 
  response: AxiosResponse; 
  context: RequestContext 
}): any[] => {
  let assertionResults: any[] = [];
  
  if (request.assertions && context.assertRuntime) {
    try {
      assertionResults = context.assertRuntime.runAssertions(
        request.assertions,
        request,
        response,
        context.envVars || {},
        context.runtimeVariables || {},
        context.processEnvVars || {}
      );
    } catch (error) {
      console.warn('Assertions execution failed:', error);
    }
  }
  
  return assertionResults;
};

// Step 14: Execute test script
export const executeTestScriptStep = async ({ 
  request, 
  response, 
  scriptVariables, 
  context 
}: { 
  request: any; 
  response: AxiosResponse; 
  scriptVariables: any; 
  context: RequestContext 
}): Promise<{ 
  result: ScriptResult; 
  updatedVariables: any 
}> => {
  let result: ScriptResult = { results: [] };
  let updatedVariables = { ...scriptVariables };
  
  if (request.tests && context.scriptRuntime) {
    result = await executeTestScript({
      script: request.tests,
      request,
      response,
      variables: scriptVariables,
      assertionResults: [],
      collectionName: context.collectionName,
      collectionPath: context.collectionPath,
      onConsoleLog: context.onConsoleLog,
      runRequestByItemPathname: context.runRequestByItemPathname,
      scriptRuntime: context.scriptRuntime
    });
    
    if (result.error) {
      console.warn('Test script error:', result.error);
    } else {
      // Update variables from script execution
      Object.assign(updatedVariables.envVariables, result.envVariables);
      Object.assign(updatedVariables.runtimeVariables, result.runtimeVariables);
      Object.assign(updatedVariables.globalEnvironmentVariables, result.globalEnvironmentVariables);
    }
  }
  
  return { result, updatedVariables };
};

// Step 15: Create final response
export const createFinalResponseStep = ({ 
  response, 
  responseTime, 
  size, 
  preRequestResults = [], 
  postResponseResults = [], 
  testResults = [], 
  assertionResults = [], 
  nextRequestName, 
  skipRequest = false, 
  stopExecution = false 
}: { 
  response: AxiosResponse; 
  responseTime: number; 
  size: number; 
  preRequestResults?: any[]; 
  postResponseResults?: any[]; 
  testResults?: any[]; 
  assertionResults?: any[]; 
  nextRequestName?: string; 
  skipRequest?: boolean; 
  stopExecution?: boolean 
}): RequestResponse => {
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
};

// Utility function to create error response
export const createErrorResponse = ({ 
  error, 
  responseTime, 
  preRequestResults = [], 
  postResponseResults = [], 
  testResults = [], 
  assertionResults = [], 
  nextRequestName, 
  skipRequest = false, 
  stopExecution = false 
}: { 
  error: any; 
  responseTime?: number; 
  preRequestResults?: any[]; 
  postResponseResults?: any[]; 
  testResults?: any[]; 
  assertionResults?: any[]; 
  nextRequestName?: string; 
  skipRequest?: boolean; 
  stopExecution?: boolean 
}): RequestResponse => {
  return {
    status: error?.status,
    statusText: error?.statusText,
    error: error?.message || 'Error occurred while executing the request!',
    responseTime,
    nextRequestName,
    skipRequest,
    stopExecution,
    preRequestResults,
    postResponseResults,
    testResults,
    assertionResults
  };
};

// Utility function to create skip response
export const createSkipResponse = ({ 
  preRequestResults = [], 
  nextRequestName, 
  stopExecution = false 
}: { 
  preRequestResults?: any[]; 
  nextRequestName?: string; 
  stopExecution?: boolean 
}): RequestResponse => {
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
}; 