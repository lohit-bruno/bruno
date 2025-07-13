export { addDigestInterceptor, getOAuth2Token } from './auth';

export * as utils from './utils';

export * as network from './network';

export * as scripting from './scripting';

// Export the main request function for easy access
export { runRequest } from './network/request';
export type { RequestOptions, RequestResult } from './network/request';

// Export key interfaces for script execution
export type { 
  ScriptRuntime,
  VarsRuntime, 
  AssertRuntime,
  ScriptVariables,
  ScriptExecutionOptions,
  ScriptResult 
} from './scripting/script-execution';

// Export key utilities
export {
  interpolateVars,
  interpolateString
} from './utils/interpolation';

export {
  prepareRequest,
  setAuthHeaders
} from './utils/request-preparation';

export {
  configureRequest,
  validateRequest
} from './network/request-configuration';