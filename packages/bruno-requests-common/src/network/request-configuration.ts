import { AxiosRequestConfig } from 'axios';
import { makeAxiosInstance } from './axios-instance';
import { addDigestInterceptor } from '../auth';
import { interpolateString } from '../utils/interpolation';

export interface RequestConfigOptions {
  request: any;
  envVars?: Record<string, any>;
  runtimeVariables?: Record<string, any>;
  processEnvVars?: Record<string, any>;
  collectionUid?: string;
  collectionPath?: string;
  timeout?: number;
}

export interface IsomorphicAxiosConfig extends AxiosRequestConfig {
  maxRedirects?: number;
  timeout?: number;
}

/**
 * Simplified isomorphic version of configureRequest
 * Excludes Node.js specific features like:
 * - File system operations (certificates)
 * - TLS/HTTPS agent configuration
 * - Complex proxy configuration
 * - Cookie management
 */
export const configureRequest = async (options: RequestConfigOptions) => {
  const {
    request,
    envVars = {},
    runtimeVariables = {},
    processEnvVars = {},
    timeout = 30000
  } = options;

  // Ensure protocol is present
  const protocolRegex = /^([-+\w]{1,25})(:?\/\/|:)/;
  if (!protocolRegex.test(request.url)) {
    request.url = `http://${request.url}`;
  }

  // Handle redirects
  let requestMaxRedirects = request.maxRedirects;
  request.maxRedirects = 0;
  
  // Set default value for requestMaxRedirects if not explicitly set
  if (requestMaxRedirects === undefined) {
    requestMaxRedirects = 5; // Default to 5 redirects
  }

  const interpolationOptions = {
    envVars,
    runtimeVariables,
    processEnvVars
  };

  // Create basic axios instance for isomorphic environment
  const axiosInstance = makeAxiosInstance({
    maxRedirects: requestMaxRedirects,
    timeout
  } as IsomorphicAxiosConfig);

  // Handle OAuth2 configuration
  if (request.oauth2) {
    const { oauth2: { grantType, tokenPlacement, tokenHeaderPrefix, tokenQueryKey } = {} } = request || {};
    
    // Note: OAuth2 token fetching would need to be handled by the consuming application
    // as it often requires Node.js specific features or browser-specific APIs
    
    // For now, we'll just apply existing credentials if they're available
    if (request.oauth2Credentials?.credentials?.access_token) {
      const credentials = request.oauth2Credentials.credentials;
      
      if (tokenPlacement === 'header' && credentials?.access_token) {
        request.headers['Authorization'] = `${tokenHeaderPrefix} ${credentials.access_token}`.trim();
      } else {
        try {
          const url = new URL(request.url);
          url?.searchParams?.set(tokenQueryKey, credentials?.access_token);
          request.url = url?.toString();
        } catch (error) {
          // Ignore URL parsing errors
        }
      }
    }
  }

  // Handle digest authentication
  if (request.digestConfig) {
    addDigestInterceptor(axiosInstance, request);
  }

  // Set timeout
  request.timeout = timeout;

  // Add API key to the URL for query params placement
  if (request.apiKeyAuthValueForQueryParams && request.apiKeyAuthValueForQueryParams.placement === 'queryparams') {
    const urlObj = new URL(request.url);

    // Interpolate key and value as they can be variables before adding to the URL
    const key = interpolateString(request.apiKeyAuthValueForQueryParams.key, interpolationOptions);
    const value = interpolateString(request.apiKeyAuthValueForQueryParams.value, interpolationOptions);

    urlObj.searchParams.set(key, value);
    request.url = urlObj.toString();
  }

  // Remove pathParams, already processed in URL (Issue #2439)
  delete request.pathParams;

  // Remove apiKeyAuthValueForQueryParams, already interpolated and added to URL
  delete request.apiKeyAuthValueForQueryParams;

  return axiosInstance;
};

/**
 * Basic request validation
 */
export const validateRequest = (request: any): { isValid: boolean; errors: string[] } => {
  const errors: string[] = [];

  if (!request) {
    errors.push('Request object is required');
    return { isValid: false, errors };
  }

  if (!request.url) {
    errors.push('Request URL is required');
  }

  if (!request.method) {
    errors.push('Request method is required');
  }

  return {
    isValid: errors.length === 0,
    errors
  };
};

/**
 * Prepare request headers for isomorphic environment
 */
export const prepareHeaders = (headers: Record<string, any> = {}): Record<string, string> => {
  const preparedHeaders: Record<string, string> = {};

  Object.entries(headers).forEach(([key, value]) => {
    if (key && value !== undefined && value !== null) {
      preparedHeaders[key] = String(value);
    }
  });

  return preparedHeaders;
};

/**
 * Apply default headers for isomorphic requests
 */
export const applyDefaultHeaders = (request: any): void => {
  if (!request.headers) {
    request.headers = {};
  }

  // Set user-agent for identification (browsers will override this)
  if (!request.headers['User-Agent'] && !request.headers['user-agent']) {
    request.headers['User-Agent'] = 'bruno-requests-common/1.0.0';
  }

  // Ensure content-type is properly set for JSON requests
  if (request.data && typeof request.data === 'object' && !request.headers['content-type']) {
    request.headers['content-type'] = 'application/json';
  }
}; 