import CryptoJS from 'crypto-js';
import { RequestItem, Collection, RequestPreparationOptions } from '../types';

const createWSSEHeader = ({ 
  username, 
  password 
}: { 
  username: string; 
  password: string 
}): string => {
  const ts = new Date().toISOString();
  const nonce = CryptoJS.lib.WordArray.random(16).toString();
  const hash = CryptoJS.SHA1(nonce + ts + password);
  const digest = CryptoJS.enc.Base64.stringify(hash);
  return `UsernameToken Username="${username}", PasswordDigest="${digest}", Nonce="${nonce}", Created="${ts}"`;
};

const createBasicAuthHeader = ({ 
  username, 
  password 
}: { 
  username: string; 
  password: string 
}): string => {
  const credentials = `${username}:${password}`;
  const base64Credentials = typeof btoa !== 'undefined' 
    ? btoa(credentials)
    : Buffer.from(credentials).toString('base64');
  return `Basic ${base64Credentials}`;
};

const setAuthHeaders = ({ 
  axiosRequest, 
  request, 
  collectionRoot 
}: { 
  axiosRequest: any; 
  request: any; 
  collectionRoot: any 
}): any => {
  const result = { ...axiosRequest };
  
  // Handle collection-level authentication inheritance
  const collectionAuth = collectionRoot?.request?.auth;
  if (collectionAuth && request.auth?.mode === 'inherit') {
    switch (collectionAuth.mode) {
      case 'basic':
        result.basicAuth = {
          username: collectionAuth.basic?.username || '',
          password: collectionAuth.basic?.password || ''
        };
        break;
        
      case 'bearer':
        result.headers['Authorization'] = `Bearer ${collectionAuth.bearer?.token || ''}`;
        break;
        
      case 'digest':
        result.digestConfig = {
          username: collectionAuth.digest?.username || '',
          password: collectionAuth.digest?.password || ''
        };
        break;
        
      case 'wsse':
        const collectionUsername = collectionAuth.wsse?.username || '';
        const collectionPassword = collectionAuth.wsse?.password || '';
        result.headers['X-WSSE'] = createWSSEHeader({ 
          username: collectionUsername, 
          password: collectionPassword 
        });
        break;
        
      case 'apikey':
        const collectionApiKeyAuth = collectionAuth.apikey;
        if (collectionApiKeyAuth?.placement === 'header') {
          result.headers[collectionApiKeyAuth.key] = collectionApiKeyAuth.value;
        } else if (collectionApiKeyAuth?.placement === 'queryparams') {
          result.apiKeyAuthValueForQueryParams = collectionApiKeyAuth;
        }
        break;
    }
  }

  // Handle request-level authentication
  if (request.auth && request.auth.mode !== 'inherit') {
    switch (request.auth.mode) {
      case 'basic':
        result.basicAuth = {
          username: request.auth.basic?.username || '',
          password: request.auth.basic?.password || ''
        };
        break;
        
      case 'bearer':
        result.headers['Authorization'] = `Bearer ${request.auth.bearer?.token || ''}`;
        break;
        
      case 'digest':
        result.digestConfig = {
          username: request.auth.digest?.username || '',
          password: request.auth.digest?.password || ''
        };
        break;
        
      case 'wsse':
        const username = request.auth.wsse?.username || '';
        const password = request.auth.wsse?.password || '';
        result.headers['X-WSSE'] = createWSSEHeader({ 
          username, 
          password 
        });
        break;
        
      case 'apikey':
        const apiKeyAuth = request.auth.apikey;
        if (apiKeyAuth?.placement === 'header') {
          result.headers[apiKeyAuth.key] = apiKeyAuth.value;
        } else if (apiKeyAuth?.placement === 'queryparams') {
          result.apiKeyAuthValueForQueryParams = apiKeyAuth;
        }
        break;
    }
  }

  return result;
};

const processHeaders = ({ 
  headers, 
  collectionHeaders = []
}: { 
  headers: any[]; 
  collectionHeaders?: any[] 
}): { processedHeaders: Record<string, string>; contentTypeDefined: boolean } => {
  const processedHeaders: Record<string, string> = {};
  let contentTypeDefined = false;

  // Process collection headers first
  collectionHeaders.forEach((h: any) => {
    if (h.enabled && h.name?.toLowerCase() === 'content-type') {
      contentTypeDefined = true;
    }
    if (h.enabled && h.name?.length > 0) {
      processedHeaders[h.name] = h.value;
    }
  });

  // Process request headers (override collection headers)
  headers.forEach((h: any) => {
    if (h.enabled && h.name?.length > 0) {
      processedHeaders[h.name] = h.value;
      if (h.name.toLowerCase() === 'content-type') {
        contentTypeDefined = true;
      }
    }
  });

  return { processedHeaders, contentTypeDefined };
};

const processBody = ({ 
  body, 
  contentTypeDefined 
}: { 
  body: any; 
  contentTypeDefined: boolean 
}): { data: any; headers: Record<string, string> } => {
  const headers: Record<string, string> = {};
  let data = null;

  if (!body || body.mode === 'none') {
    if (!contentTypeDefined) {
      headers['content-type'] = 'false';
    }
    return { data, headers };
  }

  switch (body.mode) {
    case 'json':
      if (!contentTypeDefined) {
        headers['content-type'] = 'application/json';
      }
      data = body.json;
      break;

    case 'text':
      if (!contentTypeDefined) {
        headers['content-type'] = 'text/plain';
      }
      data = body.text;
      break;

    case 'xml':
      if (!contentTypeDefined) {
        headers['content-type'] = 'application/xml';
      }
      data = body.xml;
      break;

    case 'sparql':
      if (!contentTypeDefined) {
        headers['content-type'] = 'application/sparql-query';
      }
      data = body.sparql;
      break;

    case 'formUrlEncoded':
      if (!contentTypeDefined) {
        headers['content-type'] = 'application/x-www-form-urlencoded';
      }
      const enabledParams = (body.formUrlEncoded || []).filter((p: any) => p.enabled);
      data = enabledParams.map((param: any) => 
        `${encodeURIComponent(param.name)}=${encodeURIComponent(param.value)}`
      ).join('&');
      break;

    case 'multipartForm':
      if (!contentTypeDefined) {
        headers['content-type'] = 'multipart/form-data';
      }
      data = (body.multipartForm || []).filter((p: any) => p.enabled);
      break;

    case 'graphql':
      if (!contentTypeDefined) {
        headers['content-type'] = 'application/json';
      }
      data = {
        query: body.graphql?.query,
        variables: body.graphql?.variables || '{}'
      };
      break;
  }

  return { data, headers };
};

const extractRequestParameters = ({ 
  params = []
}: { 
  params?: any[] 
}): any[] => {
  return params.filter((param: any) => param.type === 'path');
};

const mergeGlobalEnvironmentVariables = ({ 
  request, 
  collection 
}: { 
  request: any; 
  collection: Collection 
}): any => {
  const result = { ...request };
  
  if (collection.globalEnvironmentVariables) {
    result.globalEnvironmentVariables = collection.globalEnvironmentVariables;
  }
  
  return result;
};

const attachRequestMetadata = ({ 
  request, 
  item 
}: { 
  request: any; 
  item: RequestItem 
}): any => {
  const result = { ...request };
  
  // Attach additional request properties
  if (request.script) {
    result.script = request.script;
  }

  if (request.tests) {
    result.tests = request.tests;
  }

  // Attach variables
  result.vars = request.vars;
  result.collectionVariables = request.collectionVariables;
  result.folderVariables = request.folderVariables;
  result.requestVariables = request.requestVariables;
  result.globalEnvironmentVariables = request.globalEnvironmentVariables;
  result.oauth2CredentialVariables = request.oauth2CredentialVariables;
  result.assertions = request.assertions;
  result.oauth2Credentials = request.oauth2Credentials;
  
  return result;
};

export const prepareRequest = ({ 
  item, 
  collection = {}, 
  abortController 
}: RequestPreparationOptions): any => {
  const request = item.draft ? item.draft.request : item.request;
  const collectionRoot = collection?.draft ? collection.draft : collection.root || {};
  
  // Merge global environment variables
  const requestWithGlobals = mergeGlobalEnvironmentVariables({ 
    request, 
    collection 
  });
  
  // Process headers
  const collectionHeaders = collectionRoot?.request?.headers || [];
  const { processedHeaders, contentTypeDefined } = processHeaders({ 
    headers: request.headers || [], 
    collectionHeaders 
  });
  
  // Process body
  const { data, headers: bodyHeaders } = processBody({ 
    body: request.body, 
    contentTypeDefined 
  });
  
  // Create base axios request
  let axiosRequest: any = {
    mode: request.body?.mode,
    method: request.method,
    url: request.url,
    headers: { ...processedHeaders, ...bodyHeaders },
    name: item.name,
    pathParams: extractRequestParameters({ params: request.params }),
    responseType: 'arraybuffer' as const,
    data
  };

  // Apply authentication
  axiosRequest = setAuthHeaders({ 
    axiosRequest, 
    request: requestWithGlobals, 
    collectionRoot 
  });
  
  // Attach metadata
  axiosRequest = attachRequestMetadata({ 
    request: axiosRequest, 
    item 
  });
  
  // Attach original request properties
  axiosRequest.vars = requestWithGlobals.vars;
  axiosRequest.collectionVariables = requestWithGlobals.collectionVariables;
  axiosRequest.folderVariables = requestWithGlobals.folderVariables;
  axiosRequest.requestVariables = requestWithGlobals.requestVariables;
  axiosRequest.globalEnvironmentVariables = requestWithGlobals.globalEnvironmentVariables;
  axiosRequest.oauth2CredentialVariables = requestWithGlobals.oauth2CredentialVariables;
  axiosRequest.assertions = requestWithGlobals.assertions;
  axiosRequest.oauth2Credentials = requestWithGlobals.oauth2Credentials;

  return axiosRequest;
};

export { setAuthHeaders }; 