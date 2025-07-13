import { interpolate } from '@usebruno/common';

export interface InterpolationOptions {
  envVars?: Record<string, any>;
  runtimeVariables?: Record<string, any>;
  processEnvVars?: Record<string, any>;
}

export interface VariableContext {
  globalEnvironmentVariables?: Record<string, any>;
  oauth2CredentialVariables?: Record<string, any>;
  collectionVariables?: Record<string, any>;
  folderVariables?: Record<string, any>;
  requestVariables?: Record<string, any>;
}

const getContentType = (headers: Record<string, any> = {}): string => {
  let contentType = '';
  Object.entries(headers).forEach(([key, value]) => {
    if (key && key.toLowerCase() === 'content-type') {
      contentType = value;
    }
  });
  return contentType;
};

export const interpolateString = (
  str: string,
  { envVars = {}, runtimeVariables = {}, processEnvVars = {} }: InterpolationOptions
): string => {
  if (!str || !str.length || typeof str !== 'string') {
    return str;
  }

  // Clone envVars to avoid modifying the original object
  const clonedEnvVars = { ...envVars };

  // envVars can have values as {{process.env.VAR_NAME}}
  // so we need to interpolate envVars first with processEnvVars
  Object.entries(clonedEnvVars).forEach(([key, value]) => {
    clonedEnvVars[key] = interpolate(value, {
      process: {
        env: {
          ...processEnvVars
        }
      }
    });
  });

  // runtimeVariables take precedence over envVars
  const combinedVars = {
    ...clonedEnvVars,
    ...runtimeVariables,
    process: {
      env: {
        ...processEnvVars
      }
    }
  };

  return interpolate(str, combinedVars);
};

export const interpolateVars = (
  request: any,
  envVariables: Record<string, any> = {},
  runtimeVariables: Record<string, any> = {},
  processEnvVars: Record<string, any> = {}
): any => {
  const globalEnvironmentVariables = request?.globalEnvironmentVariables || {};
  const oauth2CredentialVariables = request?.oauth2CredentialVariables || {};
  const collectionVariables = request?.collectionVariables || {};
  const folderVariables = request?.folderVariables || {};
  const requestVariables = request?.requestVariables || {};
  
  // Clone envVariables to avoid modifying the original object
  const clonedEnvVars = { ...envVariables };

  // envVars can have values as {{process.env.VAR_NAME}}
  // so we need to interpolate envVars first with processEnvVars
  Object.entries(clonedEnvVars).forEach(([key, value]) => {
    clonedEnvVars[key] = interpolate(value, {
      process: {
        env: {
          ...processEnvVars
        }
      }
    });
  });

  const _interpolate = (str: string, { escapeJSONStrings = false } = {}): string => {
    if (!str || !str.length || typeof str !== 'string') {
      return str;
    }

    // runtimeVariables take precedence over envVars
    const combinedVars = {
      ...globalEnvironmentVariables,
      ...collectionVariables,
      ...clonedEnvVars,
      ...folderVariables,
      ...requestVariables,
      ...oauth2CredentialVariables,
      ...runtimeVariables,
      process: {
        env: {
          ...processEnvVars
        }
      }
    };

    return interpolate(str, combinedVars, {
      escapeJSONStrings
    });
  };

  request.url = _interpolate(request.url);

  // Interpolate headers
  const newHeaders: Record<string, string> = {};
  Object.entries(request.headers || {}).forEach(([key, value]) => {
    newHeaders[_interpolate(key)] = _interpolate(String(value));
  });
  request.headers = newHeaders;

  const contentType = getContentType(request.headers);

  if (typeof contentType === 'string') {
    // Avoid interpolating buffer values in browser environments
    if (contentType.includes('json') && typeof request.data !== 'undefined' && request.data !== null) {
      if (typeof request.data === 'string') {
        if (request.data.length) {
          request.data = _interpolate(request.data, {
            escapeJSONStrings: true
          });
        }
      } else if (typeof request.data === 'object') {
        try {
          const jsonDoc = JSON.stringify(request.data);
          const parsed = _interpolate(jsonDoc, {
            escapeJSONStrings: true
          });
          request.data = JSON.parse(parsed);
        } catch (err) {
          // Ignore JSON parsing errors
        }
      }
    } else if (contentType === 'application/x-www-form-urlencoded') {
      if (typeof request.data === 'object') {
        try {
          Object.entries(request.data).forEach(([key, value]) => {
            request.data[key] = _interpolate(String(value));
          });
        } catch (err) {
          // Ignore errors
        }
      }
    } else if (contentType === 'multipart/form-data') {
      if (Array.isArray(request.data)) {
        try {
          request.data = request.data.map((d: any) => ({
            ...d,
            value: _interpolate(d?.value)
          }));
        } catch (err) {
          // Ignore errors
        }
      }
    } else {
      request.data = _interpolate(request.data);
    }
  }

  // Interpolate path parameters
  if (request.pathParams?.length) {
    request.pathParams.forEach((param: any) => {
      param.value = _interpolate(param.value);
    });

    let url = request.url;

    if (!url.startsWith('http://') && !url.startsWith('https://')) {
      url = `http://${url}`;
    }

    try {
      const urlObj = new URL(url);
      const urlPathnameInterpolatedWithPathParams = urlObj.pathname
        .split('/')
        .filter((path) => path !== '')
        .map((path) => {
          if (path[0] !== ':') {
            return '/' + path;
          } else {
            const name = path.slice(1);
            const existingPathParam = request.pathParams.find((param: any) => param.type === 'path' && param.name === name);
            return existingPathParam ? '/' + existingPathParam.value : '';
          }
        })
        .join('');

      const trailingSlash = urlObj.pathname.endsWith('/') ? '/' : '';
      request.url = urlObj.origin + urlPathnameInterpolatedWithPathParams + trailingSlash + urlObj.search;
    } catch (e) {
      throw new Error(`Invalid URL format: ${e instanceof Error ? e.message : 'Unknown error'}`);
    }
  }

  // Interpolate basic auth (isomorphic version without Buffer)
  if (request.basicAuth) {
    const username = _interpolate(request.basicAuth.username) || '';
    const password = _interpolate(request.basicAuth.password) || '';
    // Use btoa for base64 encoding in isomorphic environment
    const base64Credentials = typeof btoa !== 'undefined' 
      ? btoa(`${username}:${password}`)
      : Buffer.from(`${username}:${password}`).toString('base64');
    request.headers['Authorization'] = `Basic ${base64Credentials}`;
    delete request.basicAuth;
  }

  // Interpolate OAuth2 config
  if (request?.oauth2?.grantType) {
    switch (request.oauth2.grantType) {
      case 'password':
        request.oauth2.accessTokenUrl = _interpolate(request.oauth2.accessTokenUrl) || '';
        request.oauth2.refreshTokenUrl = _interpolate(request.oauth2.refreshTokenUrl) || '';
        request.oauth2.username = _interpolate(request.oauth2.username) || '';
        request.oauth2.password = _interpolate(request.oauth2.password) || '';
        request.oauth2.clientId = _interpolate(request.oauth2.clientId) || '';
        request.oauth2.clientSecret = _interpolate(request.oauth2.clientSecret) || '';
        request.oauth2.scope = _interpolate(request.oauth2.scope) || '';
        request.oauth2.credentialsPlacement = _interpolate(request.oauth2.credentialsPlacement) || '';
        request.oauth2.credentialsId = _interpolate(request.oauth2.credentialsId) || '';
        request.oauth2.tokenPlacement = _interpolate(request.oauth2.tokenPlacement) || '';
        request.oauth2.tokenHeaderPrefix = _interpolate(request.oauth2.tokenHeaderPrefix) || '';
        request.oauth2.tokenQueryKey = _interpolate(request.oauth2.tokenQueryKey) || '';
        request.oauth2.autoFetchToken = _interpolate(request.oauth2.autoFetchToken);
        request.oauth2.autoRefreshToken = _interpolate(request.oauth2.autoRefreshToken);
        break;
      case 'implicit':
        request.oauth2.callbackUrl = _interpolate(request.oauth2.callbackUrl) || '';
        request.oauth2.authorizationUrl = _interpolate(request.oauth2.authorizationUrl) || '';
        request.oauth2.clientId = _interpolate(request.oauth2.clientId) || '';
        request.oauth2.scope = _interpolate(request.oauth2.scope) || '';
        request.oauth2.state = _interpolate(request.oauth2.state) || '';
        request.oauth2.credentialsId = _interpolate(request.oauth2.credentialsId) || '';
        request.oauth2.tokenPlacement = _interpolate(request.oauth2.tokenPlacement) || '';
        request.oauth2.tokenHeaderPrefix = _interpolate(request.oauth2.tokenHeaderPrefix) || '';
        request.oauth2.tokenQueryKey = _interpolate(request.oauth2.tokenQueryKey) || '';
        request.oauth2.autoFetchToken = _interpolate(request.oauth2.autoFetchToken);
        break;
      case 'authorization_code':
        request.oauth2.callbackUrl = _interpolate(request.oauth2.callbackUrl) || '';
        request.oauth2.authorizationUrl = _interpolate(request.oauth2.authorizationUrl) || '';
        request.oauth2.accessTokenUrl = _interpolate(request.oauth2.accessTokenUrl) || '';
        request.oauth2.refreshTokenUrl = _interpolate(request.oauth2.refreshTokenUrl) || '';
        request.oauth2.clientId = _interpolate(request.oauth2.clientId) || '';
        request.oauth2.clientSecret = _interpolate(request.oauth2.clientSecret) || '';
        request.oauth2.scope = _interpolate(request.oauth2.scope) || '';
        request.oauth2.state = _interpolate(request.oauth2.state) || '';
        request.oauth2.pkce = _interpolate(request.oauth2.pkce) || false;
        request.oauth2.credentialsPlacement = _interpolate(request.oauth2.credentialsPlacement) || '';
        request.oauth2.credentialsId = _interpolate(request.oauth2.credentialsId) || '';
        request.oauth2.tokenPlacement = _interpolate(request.oauth2.tokenPlacement) || '';
        request.oauth2.tokenHeaderPrefix = _interpolate(request.oauth2.tokenHeaderPrefix) || '';
        request.oauth2.tokenQueryKey = _interpolate(request.oauth2.tokenQueryKey) || '';
        request.oauth2.autoFetchToken = _interpolate(request.oauth2.autoFetchToken);
        request.oauth2.autoRefreshToken = _interpolate(request.oauth2.autoRefreshToken);
        break;
      case 'client_credentials':
        request.oauth2.accessTokenUrl = _interpolate(request.oauth2.accessTokenUrl) || '';
        request.oauth2.refreshTokenUrl = _interpolate(request.oauth2.refreshTokenUrl) || '';
        request.oauth2.clientId = _interpolate(request.oauth2.clientId) || '';
        request.oauth2.clientSecret = _interpolate(request.oauth2.clientSecret) || '';
        request.oauth2.scope = _interpolate(request.oauth2.scope) || '';
        request.oauth2.credentialsPlacement = _interpolate(request.oauth2.credentialsPlacement) || '';
        request.oauth2.credentialsId = _interpolate(request.oauth2.credentialsId) || '';
        request.oauth2.tokenPlacement = _interpolate(request.oauth2.tokenPlacement) || '';
        request.oauth2.tokenHeaderPrefix = _interpolate(request.oauth2.tokenHeaderPrefix) || '';
        request.oauth2.tokenQueryKey = _interpolate(request.oauth2.tokenQueryKey) || '';
        request.oauth2.autoFetchToken = _interpolate(request.oauth2.autoFetchToken);
        request.oauth2.autoRefreshToken = _interpolate(request.oauth2.autoRefreshToken);
        break;
      default:
        break;
    }
  }

  // Interpolate AWS v4 config
  if (request.awsv4config) {
    request.awsv4config.accessKeyId = _interpolate(request.awsv4config.accessKeyId) || '';
    request.awsv4config.secretAccessKey = _interpolate(request.awsv4config.secretAccessKey) || '';
    request.awsv4config.sessionToken = _interpolate(request.awsv4config.sessionToken) || '';
    request.awsv4config.service = _interpolate(request.awsv4config.service) || '';
    request.awsv4config.region = _interpolate(request.awsv4config.region) || '';
    request.awsv4config.profileName = _interpolate(request.awsv4config.profileName) || '';
  }

  // Interpolate digest auth config
  if (request.digestConfig) {
    request.digestConfig.username = _interpolate(request.digestConfig.username) || '';
    request.digestConfig.password = _interpolate(request.digestConfig.password) || '';
  }

  // Interpolate WSSE auth config
  if (request.wsse) {
    request.wsse.username = _interpolate(request.wsse.username) || '';
    request.wsse.password = _interpolate(request.wsse.password) || '';
  }

  // Interpolate NTLM auth config
  if (request.ntlmConfig) {
    request.ntlmConfig.username = _interpolate(request.ntlmConfig.username) || '';
    request.ntlmConfig.password = _interpolate(request.ntlmConfig.password) || '';
    request.ntlmConfig.domain = _interpolate(request.ntlmConfig.domain) || '';
  }

  // Clean up auth object
  if (request?.auth) {
    delete request.auth;
  }

  return request;
}; 