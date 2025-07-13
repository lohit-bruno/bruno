import { InterpolationOptions } from '../types';

const interpolateString = ({ 
  str, 
  variables = {}
}: { 
  str: string; 
  variables?: Record<string, any> 
}): string => {
  if (!str || typeof str !== 'string') {
    return str;
  }

  // Simple variable interpolation using mustache-style syntax
  return str.replace(/\{\{([^}]+)\}\}/g, (match, key) => {
    const trimmedKey = key.trim();
    const value = variables[trimmedKey];
    return value !== undefined ? String(value) : match;
  });
};

const interpolateJSON = ({ 
  data, 
  variables = {},
  escapeJSONStrings = false
}: { 
  data: any; 
  variables?: Record<string, any>;
  escapeJSONStrings?: boolean;
}): any => {
  if (typeof data === 'string') {
    const interpolated = interpolateString({ str: data, variables });
    
    if (escapeJSONStrings) {
      return JSON.stringify(interpolated).slice(1, -1);
    }
    
    return interpolated;
  }
  
  if (Array.isArray(data)) {
    return data.map(item => interpolateJSON({ 
      data: item, 
      variables, 
      escapeJSONStrings 
    }));
  }
  
  if (data && typeof data === 'object') {
    const result: any = {};
    for (const [key, value] of Object.entries(data)) {
      result[key] = interpolateJSON({ 
        data: value, 
        variables, 
        escapeJSONStrings 
      });
    }
    return result;
  }
  
  return data;
};

const createVariableMap = ({ 
  envVars = {},
  runtimeVariables = {},
  processEnvVars = {}
}: InterpolationOptions): Record<string, any> => {
  return {
    ...processEnvVars,
    ...envVars,
    ...runtimeVariables
  };
};

const interpolateAuth = ({ 
  auth, 
  variables
}: { 
  auth: any; 
  variables: Record<string, any> 
}): any => {
  if (!auth) return auth;
  
  const result = { ...auth };
  
  switch (auth.mode) {
    case 'basic':
      if (auth.basic) {
        result.basic = {
          username: interpolateString({ str: auth.basic.username, variables }),
          password: interpolateString({ str: auth.basic.password, variables })
        };
      }
      break;
      
    case 'bearer':
      if (auth.bearer) {
        result.bearer = {
          token: interpolateString({ str: auth.bearer.token, variables })
        };
      }
      break;
      
    case 'digest':
      if (auth.digest) {
        result.digest = {
          username: interpolateString({ str: auth.digest.username, variables }),
          password: interpolateString({ str: auth.digest.password, variables })
        };
      }
      break;
      
    case 'apikey':
      if (auth.apikey) {
        result.apikey = {
          ...auth.apikey,
          key: interpolateString({ str: auth.apikey.key, variables }),
          value: interpolateString({ str: auth.apikey.value, variables })
        };
      }
      break;
      
    case 'wsse':
      if (auth.wsse) {
        result.wsse = {
          username: interpolateString({ str: auth.wsse.username, variables }),
          password: interpolateString({ str: auth.wsse.password, variables })
        };
      }
      break;
      
    case 'ntlm':
      if (auth.ntlm) {
        result.ntlm = {
          username: interpolateString({ str: auth.ntlm.username, variables }),
          password: interpolateString({ str: auth.ntlm.password, variables }),
          domain: interpolateString({ str: auth.ntlm.domain, variables })
        };
      }
      break;
      
    case 'oauth2':
      if (auth.oauth2) {
        result.oauth2 = interpolateJSON({ 
          data: auth.oauth2, 
          variables 
        });
      }
      break;
  }
  
  return result;
};

const interpolateHeaders = ({ 
  headers, 
  variables
}: { 
  headers: Record<string, string>; 
  variables: Record<string, any> 
}): Record<string, string> => {
  const result: Record<string, string> = {};
  
  for (const [key, value] of Object.entries(headers)) {
    result[key] = interpolateString({ str: value, variables });
  }
  
  return result;
};

const interpolateParams = ({ 
  params, 
  variables
}: { 
  params: any[]; 
  variables: Record<string, any> 
}): any[] => {
  return params.map(param => ({
    ...param,
    value: interpolateString({ str: param.value, variables })
  }));
};

const interpolateBody = ({ 
  body, 
  variables
}: { 
  body: any; 
  variables: Record<string, any> 
}): any => {
  if (!body || typeof body !== 'object') {
    return interpolateString({ str: body, variables });
  }
  
  const result = { ...body };
  
  switch (body.mode) {
    case 'json':
      if (body.json) {
        result.json = interpolateJSON({ 
          data: body.json, 
          variables, 
          escapeJSONStrings: true 
        });
      }
      break;
      
    case 'text':
      if (body.text) {
        result.text = interpolateString({ str: body.text, variables });
      }
      break;
      
    case 'xml':
      if (body.xml) {
        result.xml = interpolateString({ str: body.xml, variables });
      }
      break;
      
    case 'sparql':
      if (body.sparql) {
        result.sparql = interpolateString({ str: body.sparql, variables });
      }
      break;
      
    case 'formUrlEncoded':
      if (body.formUrlEncoded) {
        result.formUrlEncoded = body.formUrlEncoded.map((item: any) => ({
          ...item,
          value: interpolateString({ str: item.value, variables })
        }));
      }
      break;
      
    case 'multipartForm':
      if (body.multipartForm) {
        result.multipartForm = body.multipartForm.map((item: any) => ({
          ...item,
          value: interpolateString({ str: item.value, variables })
        }));
      }
      break;
      
    case 'graphql':
      if (body.graphql) {
        result.graphql = {
          query: interpolateString({ str: body.graphql.query, variables }),
          variables: body.graphql.variables
        };
      }
      break;
  }
  
  return result;
};

const interpolatePathParams = ({ 
  url, 
  pathParams, 
  variables
}: { 
  url: string; 
  pathParams: any[]; 
  variables: Record<string, any> 
}): string => {
  if (!pathParams || pathParams.length === 0) {
    return url;
  }
  
  let result = url;
  
  // Create a map of path parameters
  const pathParamMap = new Map();
  pathParams.forEach(param => {
    if (param.type === 'path' && param.enabled) {
      pathParamMap.set(param.name, interpolateString({ 
        str: param.value, 
        variables 
      }));
    }
  });
  
  // Replace path parameters in URL
  return result.replace(/:([^\/\?]+)/g, (match, paramName) => {
    const value = pathParamMap.get(paramName);
    return value !== undefined ? value : match;
  });
};

// Main interpolation functions
export const interpolateRequest = ({ 
  request, 
  envVars = {},
  runtimeVariables = {},
  processEnvVars = {}
}: { 
  request: any; 
  envVars?: Record<string, any>;
  runtimeVariables?: Record<string, any>;
  processEnvVars?: Record<string, any>;
}): any => {
  const variables = createVariableMap({ 
    envVars, 
    runtimeVariables, 
    processEnvVars 
  });
  
  const result = { ...request };
  
  // Interpolate URL
  result.url = interpolateString({ str: request.url, variables });
  
  // Interpolate headers
  if (request.headers) {
    result.headers = interpolateHeaders({ 
      headers: request.headers, 
      variables 
    });
  }
  
  // Interpolate authentication
  if (request.auth) {
    result.auth = interpolateAuth({ 
      auth: request.auth, 
      variables 
    });
  }
  
  // Interpolate body
  if (request.body) {
    result.body = interpolateBody({ 
      body: request.body, 
      variables 
    });
  }
  
  // Interpolate parameters
  if (request.params) {
    result.params = interpolateParams({ 
      params: request.params, 
      variables 
    });
  }
  
  // Interpolate path parameters in URL
  if (request.pathParams) {
    result.url = interpolatePathParams({ 
      url: result.url, 
      pathParams: request.pathParams, 
      variables 
    });
  }
  
  return result;
};

// Legacy support - deprecated
export const interpolateVars = (
  request: any,
  envVars: Record<string, any>,
  runtimeVariables: Record<string, any>,
  processEnvVars: Record<string, any>
): any => {
  console.warn('interpolateVars is deprecated. Use interpolateRequest instead.');
  return interpolateRequest({ 
    request, 
    envVars, 
    runtimeVariables, 
    processEnvVars 
  });
};

export { InterpolationOptions, interpolateString }; 