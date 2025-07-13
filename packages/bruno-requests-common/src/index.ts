// Export core types
export type * from './types';

// Export authentication utilities  
export { addDigestInterceptor, getOAuth2Token } from './auth';

// Export modular utilities (new approach)
export * as utils from './utils';
export * as network from './network';
export * as scripting from './scripting';
export * as execution from './execution';

// Export main request function (new modular approach)
export { runRequestWithContext } from './network/request';

// Export legacy request function for backward compatibility
export { runRequest } from './network/request';

// Export key types for easy access
export type { 
  RequestContext, 
  RequestResponse,
  RequestConfig,
  AuthConfig,
  BodyConfig,
  ScriptOptions,
  ScriptResult,
  ScriptVariables,
  ValidationResult
} from './types';

// Export runtime interfaces for dependency injection
export type { 
  ScriptRuntime,
  VarsRuntime, 
  AssertRuntime
} from './types';

// Export key utilities with object destructuring support
export {
  interpolateRequest,
  interpolateString
} from './utils/interpolation';

export {
  prepareRequest
} from './utils/request-preparation';

export {
  mergeVars,
  mergeHeaders,
  mergeScripts
} from './utils/variable-merging';

export {
  configureRequest,
  validateRequest
} from './network/request-configuration';

export {
  processResponse,
  parseResponseData,
  calculateResponseSize
} from './utils/response-processing';

// Export modular execution functions
export {
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
} from './execution';

// Legacy exports for backward compatibility
export type { RequestOptions, RequestResult } from './network/request';

// Re-export common utilities for convenience
export { interpolateVars } from './utils/interpolation'; // Deprecated - use interpolateRequest