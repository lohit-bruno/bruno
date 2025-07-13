import CryptoJS from 'crypto-js';

export interface RequestItem {
  uid?: string;
  name?: string;
  draft?: {
    request: any;
  };
  request: any;
}

export interface Collection {
  uid?: string;
  name?: string;
  pathname?: string;
  draft?: any;
  root?: any;
  brunoConfig?: {
    scripts?: {
      flow?: string;
    };
  };
  globalEnvironmentVariables?: Record<string, any>;
  oauth2Credentials?: Record<string, any>;
}

const setAuthHeaders = (axiosRequest: any, request: any, collectionRoot: any): any => {
  const collectionAuth = collectionRoot?.request?.auth;
  if (collectionAuth && request.auth?.mode === 'inherit') {
    switch (collectionAuth.mode) {
      case 'basic':
        axiosRequest.basicAuth = {
          username: collectionAuth.basic?.username || '',
          password: collectionAuth.basic?.password || ''
        };
        break;
      case 'bearer':
        axiosRequest.headers['Authorization'] = `Bearer ${collectionAuth.bearer?.token || ''}`;
        break;
      case 'digest':
        axiosRequest.digestConfig = {
          username: collectionAuth.digest?.username || '',
          password: collectionAuth.digest?.password || ''
        };
        break;
      case 'wsse':
        const collectionUsername = collectionAuth.wsse?.username || '';
        const collectionPassword = collectionAuth.wsse?.password || '';

        const ts = new Date().toISOString();
        const nonce = CryptoJS.lib.WordArray.random(16).toString();

        // Create the password digest using SHA-1 as required for WSSE
        const hash = CryptoJS.SHA1(nonce + ts + collectionPassword);
        const digest = CryptoJS.enc.Base64.stringify(hash);

        // Construct the WSSE header
        axiosRequest.headers['X-WSSE'] = `UsernameToken Username="${collectionUsername}", PasswordDigest="${digest}", Nonce="${nonce}", Created="${ts}"`;
        break;
      case 'apikey':
        const collectionApiKeyAuth = collectionAuth.apikey;
        if (collectionApiKeyAuth?.placement === 'header') {
          axiosRequest.headers[collectionApiKeyAuth.key] = collectionApiKeyAuth.value;
        } else if (collectionApiKeyAuth?.placement === 'queryparams') {
          axiosRequest.apiKeyAuthValueForQueryParams = collectionApiKeyAuth;
        }
        break;
    }
  }

  if (request.auth) {
    switch (request.auth.mode) {
      case 'basic':
        axiosRequest.basicAuth = {
          username: request.auth.basic?.username || '',
          password: request.auth.basic?.password || ''
        };
        break;
      case 'bearer':
        axiosRequest.headers['Authorization'] = `Bearer ${request.auth.bearer?.token || ''}`;
        break;
      case 'digest':
        axiosRequest.digestConfig = {
          username: request.auth.digest?.username || '',
          password: request.auth.digest?.password || ''
        };
        break;
      case 'wsse':
        const username = request.auth.wsse?.username || '';
        const password = request.auth.wsse?.password || '';

        const ts = new Date().toISOString();
        const nonce = CryptoJS.lib.WordArray.random(16).toString();

        // Create the password digest using SHA-1 as required for WSSE
        const hash = CryptoJS.SHA1(nonce + ts + password);
        const digest = CryptoJS.enc.Base64.stringify(hash);

        // Construct the WSSE header
        axiosRequest.headers['X-WSSE'] = `UsernameToken Username="${username}", PasswordDigest="${digest}", Nonce="${nonce}", Created="${ts}"`;
        break;
      case 'apikey':
        const apiKeyAuth = request.auth.apikey;
        if (apiKeyAuth?.placement === 'header') {
          axiosRequest.headers[apiKeyAuth.key] = apiKeyAuth.value;
        } else if (apiKeyAuth?.placement === 'queryparams') {
          axiosRequest.apiKeyAuthValueForQueryParams = apiKeyAuth;
        }
        break;
    }
  }

  return axiosRequest;
};

export const prepareRequest = (
  item: RequestItem,
  collection: Collection = {},
  // abortController is optional in isomorphic version
  abortController?: AbortController
): any => {
  const request = item.draft ? item.draft.request : item.request;
  const collectionRoot = collection?.draft ? collection.draft : collection.root || {};
  const headers: Record<string, string> = {};
  let contentTypeDefined = false;
  let url = request.url;

  // Check if content-type is defined in collection headers
  const collectionHeaders = collectionRoot?.request?.headers || [];
  collectionHeaders.forEach((h: any) => {
    if (h.enabled && h.name?.toLowerCase() === 'content-type') {
      contentTypeDefined = true;
    }
  });

  // Note: In isomorphic version, we skip the complex merging logic that requires file system access
  // This would need to be handled by the caller if needed
  if (collection.globalEnvironmentVariables) {
    request.globalEnvironmentVariables = collection.globalEnvironmentVariables;
  }

  // Process request headers
  const requestHeaders = request.headers || [];
  requestHeaders.forEach((h: any) => {
    if (h.enabled && h.name.length > 0) {
      headers[h.name] = h.value;
      if (h.name.toLowerCase() === 'content-type') {
        contentTypeDefined = true;
      }
    }
  });

  let axiosRequest: any = {
    mode: request.body?.mode,
    method: request.method,
    url,
    headers,
    name: item.name,
    pathParams: request.params?.filter((param: any) => param.type === 'path'),
    responseType: 'arraybuffer' as const
  };

  axiosRequest = setAuthHeaders(axiosRequest, request, collectionRoot);

  // Handle different body modes
  if (request.body?.mode === 'json') {
    if (!contentTypeDefined) {
      axiosRequest.headers['content-type'] = 'application/json';
    }
    try {
      // Simple JSON processing for isomorphic version
      axiosRequest.data = request.body.json;
    } catch (error) {
      axiosRequest.data = request.body.json;
    }
  }

  if (request.body?.mode === 'text') {
    if (!contentTypeDefined) {
      axiosRequest.headers['content-type'] = 'text/plain';
    }
    axiosRequest.data = request.body.text;
  }

  if (request.body?.mode === 'xml') {
    if (!contentTypeDefined) {
      axiosRequest.headers['content-type'] = 'application/xml';
    }
    axiosRequest.data = request.body.xml;
  }

  if (request.body?.mode === 'sparql') {
    if (!contentTypeDefined) {
      axiosRequest.headers['content-type'] = 'application/sparql-query';
    }
    axiosRequest.data = request.body.sparql;
  }

  if (request.body?.mode === 'formUrlEncoded') {
    if (!contentTypeDefined) {
      axiosRequest.headers['content-type'] = 'application/x-www-form-urlencoded';
    }
    const enabledParams = (request.body.formUrlEncoded || []).filter((p: any) => p.enabled);
    // Simple form encoding for isomorphic version
    const formData = enabledParams.map((param: any) => `${encodeURIComponent(param.name)}=${encodeURIComponent(param.value)}`).join('&');
    axiosRequest.data = formData;
  }

  if (request.body?.mode === 'multipartForm') {
    if (!contentTypeDefined) {
      axiosRequest.headers['content-type'] = 'multipart/form-data';
    }
    const enabledParams = (request.body.multipartForm || []).filter((p: any) => p.enabled);
    axiosRequest.data = enabledParams;
  }

  if (request.body?.mode === 'graphql') {
    const graphqlQuery = {
      query: request.body.graphql?.query,
      variables: request.body.graphql?.variables || '{}'
    };
    if (!contentTypeDefined) {
      axiosRequest.headers['content-type'] = 'application/json';
    }
    axiosRequest.data = graphqlQuery;
  }

  // if the mode is 'none' then set the content-type header to false
  if (request.body?.mode === 'none') {
    if (!contentTypeDefined) {
      (axiosRequest.headers as any)['content-type'] = false;
    }
  }

  // Attach additional request properties
  if (request.script) {
    axiosRequest.script = request.script;
  }

  if (request.tests) {
    axiosRequest.tests = request.tests;
  }

  axiosRequest.vars = request.vars;
  axiosRequest.collectionVariables = request.collectionVariables;
  axiosRequest.folderVariables = request.folderVariables;
  axiosRequest.requestVariables = request.requestVariables;
  axiosRequest.globalEnvironmentVariables = request.globalEnvironmentVariables;
  axiosRequest.oauth2CredentialVariables = request.oauth2CredentialVariables;
  axiosRequest.assertions = request.assertions;
  axiosRequest.oauth2Credentials = request.oauth2Credentials;

  return axiosRequest;
};

export { setAuthHeaders }; 