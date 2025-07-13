const { interpolate } = require('@usebruno/common');
import { BrunoRequest, BrunoInterpolationOptions, BrunoVariables } from './types';

/**
 * Get the content type from headers in a case-insensitive manner
 */
export const getContentType = (headers: Record<string, string> = {}): string => {
  let contentType = '';
  Object.entries(headers).forEach(([key, value]) => {
    if (key && key.toLowerCase() === 'content-type') {
      contentType = value;
    }
  });
  return contentType;
};

/**
 * Interpolate variables in a string using the provided context
 */
export const interpolateString = (
  str: string,
  variables: Record<string, any>,
  options: { escapeJSONStrings?: boolean } = {}
): string => {
  if (!str || typeof str !== 'string') {
    return str;
  }

  return interpolate(str, variables, { escapeJSONStrings: options.escapeJSONStrings || false });
};

/**
 * Interpolate variables in request headers
 */
export const interpolateHeaders = (
  headers: Record<string, string>,
  variables: Record<string, any>
): Record<string, string> => {
  const interpolatedHeaders: Record<string, string> = {};
  
  Object.entries(headers).forEach(([key, value]) => {
    const interpolatedKey = interpolateString(key, variables);
    const interpolatedValue = interpolateString(value, variables);
    interpolatedHeaders[interpolatedKey] = interpolatedValue;
  });

  return interpolatedHeaders;
};

/**
 * Interpolate variables in request data based on content type
 */
export const interpolateRequestData = (
  data: any,
  contentType: string,
  variables: Record<string, any>
): any => {
  if (!data) {
    return data;
  }

  if (typeof contentType === 'string') {
    // JSON content type
    if (contentType.includes('json')) {
      if (typeof data === 'string') {
        if (data.length) {
          return interpolateString(data, variables, { escapeJSONStrings: true });
        }
        return data;
      } else if (typeof data === 'object' && data !== null) {
        try {
          const jsonDoc = JSON.stringify(data);
          const parsed = interpolateString(jsonDoc, variables, { escapeJSONStrings: true });
          return JSON.parse(parsed);
        } catch (err) {
          return data;
        }
      }
    }
    // URL encoded content type
    else if (contentType === 'application/x-www-form-urlencoded') {
      if (typeof data === 'object' && data !== null) {
        try {
          const interpolatedData: Record<string, any> = {};
          Object.entries(data).forEach(([key, value]) => {
            interpolatedData[key] = interpolateString(String(value), variables);
          });
          return interpolatedData;
        } catch (err) {
          return data;
        }
      }
    }
    // Multipart form data
    else if (contentType === 'multipart/form-data') {
      if (Array.isArray(data)) {
        try {
          return data.map(item => ({
            ...item,
            value: interpolateString(String(item.value), variables)
          }));
        } catch (err) {
          return data;
        }
      }
    }
    // Default case - interpolate as string
    else {
      return interpolateString(String(data), variables);
    }
  }

  return data;
};

/**
 * Interpolate path parameters in URL
 */
export const interpolatePathParams = (
  url: string,
  pathParams: Array<{ name: string; value: string; type?: string }>,
  variables: Record<string, any>
): string => {
  if (!pathParams || pathParams.length === 0) {
    return url;
  }

  // Interpolate path param values first
  const interpolatedPathParams = pathParams.map(param => ({
    ...param,
    value: interpolateString(param.value, variables)
  }));

  let processedUrl = url;

  // Ensure URL has protocol
  if (!processedUrl.startsWith('http://') && !processedUrl.startsWith('https://')) {
    processedUrl = `http://${processedUrl}`;
  }

  try {
    const urlObj = new URL(processedUrl);
    
    const urlPathnameInterpolatedWithPathParams = urlObj.pathname
      .split('/')
      .filter(path => path !== '')
      .map(path => {
        if (path[0] !== ':') {
          return '/' + path;
        } else {
          const name = path.slice(1);
          const existingPathParam = interpolatedPathParams.find(
            param => param.type === 'path' && param.name === name
          );
          return existingPathParam ? '/' + existingPathParam.value : '';
        }
      })
      .join('');

    const trailingSlash = urlObj.pathname.endsWith('/') ? '/' : '';
    return urlObj.origin + urlPathnameInterpolatedWithPathParams + trailingSlash + urlObj.search;
  } catch (e) {
    // If URL parsing fails, return original URL
    return url;
  }
};

/**
 * Interpolate all variables in a request object
 */
export const interpolateRequest = (
  request: BrunoRequest,
  variables: Record<string, any>,
  options: BrunoInterpolationOptions = {}
): BrunoRequest => {
  const interpolatedRequest = { ...request };

  // Combine all variables with proper precedence
  const combinedVariables = {
    ...variables,
    ...(options.processEnvVars && {
      process: {
        env: options.processEnvVars
      }
    })
  };

  // Interpolate URL
  interpolatedRequest.url = interpolateString(request.url, combinedVariables);

  // Interpolate headers
  interpolatedRequest.headers = interpolateHeaders(request.headers, combinedVariables);

  // Get content type for data interpolation
  const contentType = getContentType(interpolatedRequest.headers);

  // Interpolate data
  interpolatedRequest.data = interpolateRequestData(
    request.data,
    contentType,
    combinedVariables
  );

  // Interpolate path parameters
  if (request.pathParams && request.pathParams.length > 0) {
    interpolatedRequest.url = interpolatePathParams(
      interpolatedRequest.url,
      request.pathParams,
      combinedVariables
    );
  }

  return interpolatedRequest;
};

/**
 * Create combined variables object with proper precedence
 */
export const createCombinedVariables = (
  variables: BrunoVariables
): Record<string, any> => {
  return {
    ...variables.globalEnvironmentVariables,
    ...variables.collectionVariables,
    ...variables.envVariables,
    ...variables.folderVariables,
    ...variables.requestVariables,
    ...variables.oauth2CredentialVariables,
    ...variables.runtimeVariables,
    ...(variables.processEnvVariables && {
      process: {
        env: variables.processEnvVariables
      }
    })
  };
}; 