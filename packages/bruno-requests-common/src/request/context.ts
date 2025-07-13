import { 
  BrunoRequest, 
  BrunoCollection, 
  BrunoItem, 
  BrunoRequestContext,
  BrunoParam,
  BrunoVariables
} from './types';

/**
 * Get the tree path from collection to the specific item
 */
export const getTreePathFromCollectionToItem = ({
  collection,
  item
}: {
  collection: BrunoCollection;
  item: BrunoItem;
}): BrunoItem[] => {
  const path: BrunoItem[] = [];
  
  const findItemPath = (items: BrunoItem[], targetItem: BrunoItem, currentPath: BrunoItem[]): boolean => {
    for (const currentItem of items) {
      const newPath = [...currentPath, currentItem];
      
      if (currentItem.uid === targetItem.uid) {
        path.push(...newPath);
        return true;
      }
      
      if (currentItem.items && currentItem.items.length > 0) {
        if (findItemPath(currentItem.items, targetItem, newPath)) {
          return true;
        }
      }
    }
    return false;
  };
  
  if (collection.items) {
    findItemPath(collection.items, item, []);
  }
  
  return path;
};

/**
 * Merge variables from collection, folder, and request levels
 */
export const mergeVariables = ({
  collection,
  request,
  requestTreePath
}: {
  collection: BrunoCollection;
  request: BrunoRequest;
  requestTreePath: BrunoItem[];
}): {
  collectionVariables: Record<string, any>;
  folderVariables: Record<string, any>;
  requestVariables: Record<string, any>;
} => {
  const collectionVariables: Record<string, any> = {};
  const folderVariables: Record<string, any> = {};
  const requestVariables: Record<string, any> = {};
  
  // Merge collection variables
  const collectionRequestVars = collection.root?.request?.vars?.req || [];
  collectionRequestVars.forEach((variable: BrunoParam) => {
    if (variable.enabled) {
      collectionVariables[variable.name] = variable.value;
    }
  });
  
  // Merge folder variables
  for (const item of requestTreePath) {
    if (item.type === 'folder') {
      const folderVars = item.root?.request?.vars?.req || [];
      folderVars.forEach((variable: BrunoParam) => {
        if (variable.enabled) {
          folderVariables[variable.name] = variable.value;
        }
      });
    }
  }
  
  // Merge request variables
  const requestVars = request.vars?.req || [];
  requestVars.forEach((variable: BrunoParam) => {
    if (variable.enabled) {
      requestVariables[variable.name] = variable.value;
    }
  });
  
  return {
    collectionVariables,
    folderVariables,
    requestVariables
  };
};

/**
 * Merge headers from collection, folder, and request levels
 */
export const mergeHeaders = ({
  collection,
  request,
  requestTreePath
}: {
  collection: BrunoCollection;
  request: BrunoRequest;
  requestTreePath: BrunoItem[];
}): Record<string, string> => {
  const headers = new Map<string, string>();
  
  // Add collection headers
  const collectionHeaders = collection.root?.request?.headers || [];
  collectionHeaders.forEach((header: BrunoParam) => {
    if (header.enabled) {
      if (header.name.toLowerCase() === 'content-type') {
        headers.set('content-type', header.value);
      } else {
        headers.set(header.name, header.value);
      }
    }
  });
  
  // Add folder headers
  for (const item of requestTreePath) {
    if (item.type === 'folder') {
      const folderHeaders = item.root?.request?.headers || [];
      folderHeaders.forEach((header: BrunoParam) => {
        if (header.enabled) {
          if (header.name.toLowerCase() === 'content-type') {
            headers.set('content-type', header.value);
          } else {
            headers.set(header.name, header.value);
          }
        }
      });
    }
  }
  
  // Add request headers
  const requestHeaders = request.headers || {};
  Object.entries(requestHeaders).forEach(([name, value]) => {
    if (name.toLowerCase() === 'content-type') {
      headers.set('content-type', value);
    } else {
      headers.set(name, value);
    }
  });
  
  return Object.fromEntries(headers);
};

/**
 * Merge scripts from collection, folder, and request levels
 */
export const mergeScripts = ({
  collection,
  request,
  requestTreePath,
  scriptFlow = 'sandwich'
}: {
  collection: BrunoCollection;
  request: BrunoRequest;
  requestTreePath: BrunoItem[];
  scriptFlow?: string;
}): {
  preRequestScripts: string[];
  postResponseScripts: string[];
  testScripts: string[];
} => {
  const collectionPreReqScript = collection.root?.request?.script?.req || '';
  const collectionPostResScript = collection.root?.request?.script?.res || '';
  const collectionTests = collection.root?.request?.tests || '';
  
  const combinedPreReqScript: string[] = [];
  const combinedPostResScript: string[] = [];
  const combinedTests: string[] = [];
  
  // Add folder scripts
  for (const item of requestTreePath) {
    if (item.type === 'folder') {
      const preReqScript = item.root?.request?.script?.req || '';
      if (preReqScript && preReqScript.trim() !== '') {
        combinedPreReqScript.push(preReqScript);
      }
      
      const postResScript = item.root?.request?.script?.res || '';
      if (postResScript && postResScript.trim() !== '') {
        combinedPostResScript.push(postResScript);
      }
      
      const tests = item.root?.request?.tests || '';
      if (tests && tests.trim() !== '') {
        combinedTests.push(tests);
      }
    }
  }
  
  // Build pre-request scripts (always collection -> folder -> request)
  const preRequestScripts = [
    collectionPreReqScript,
    ...combinedPreReqScript,
    request.script?.req || ''
  ].filter(script => script && script.trim() !== '');
  
  // Build post-response scripts based on script flow
  let postResponseScripts: string[];
  if (scriptFlow === 'sequential') {
    postResponseScripts = [
      collectionPostResScript,
      ...combinedPostResScript,
      request.script?.res || ''
    ].filter(script => script && script.trim() !== '');
  } else {
    // sandwich flow (default)
    postResponseScripts = [
      request.script?.res || '',
      ...combinedPostResScript.reverse(),
      collectionPostResScript
    ].filter(script => script && script.trim() !== '');
  }
  
  // Build test scripts based on script flow
  let testScripts: string[];
  if (scriptFlow === 'sequential') {
    testScripts = [
      collectionTests,
      ...combinedTests,
      request.tests || ''
    ].filter(script => script && script.trim() !== '');
  } else {
    // sandwich flow (default)
    testScripts = [
      request.tests || '',
      ...combinedTests.reverse(),
      collectionTests
    ].filter(script => script && script.trim() !== '');
  }
  
  return {
    preRequestScripts,
    postResponseScripts,
    testScripts
  };
};

/**
 * Create run request context by merging collection, folder, and request data
 */
export const createRunRequestContext = ({
  collection,
  item,
  envVariables = {},
  runtimeVariables = {},
  processEnvVariables = {}
}: {
  collection: BrunoCollection;
  item: BrunoItem;
  envVariables?: Record<string, any>;
  runtimeVariables?: Record<string, any>;
  processEnvVariables?: Record<string, any>;
}): BrunoRequestContext => {
  // Get the tree path from collection to the item
  const requestTreePath = getTreePathFromCollectionToItem({ collection, item });
  const request = item.draft ? item.draft.request : item.request;
  
  // Determine script flow
  const scriptFlow = collection.brunoConfig?.scripts?.flow || 'sandwich';
  
  // Merge variables from different levels
  const { collectionVariables, folderVariables, requestVariables } = mergeVariables({
    collection,
    request,
    requestTreePath
  });
  
  // Merge headers from different levels
  const mergedHeaders = mergeHeaders({ collection, request, requestTreePath });
  
  // Merge scripts from different levels
  const { preRequestScripts, postResponseScripts, testScripts } = mergeScripts({
    collection,
    request,
    requestTreePath,
    scriptFlow
  });
  
  // Create the variables object
  const variables: BrunoVariables = {
    envVariables,
    runtimeVariables,
    processEnvVariables,
    collectionVariables,
    folderVariables,
    requestVariables,
    globalEnvironmentVariables: collection.globalEnvironmentVariables || {},
    oauth2CredentialVariables: {} // TODO: Implement OAuth2 credentials formatting
  };
  
  // Create the context object
  const context: BrunoRequestContext = {
    collectionName: collection.name,
    request: {
      ...request,
      headers: mergedHeaders,
      collectionVariables,
      folderVariables,
      requestVariables,
      globalEnvironmentVariables: collection.globalEnvironmentVariables || {},
      oauth2CredentialVariables: {} // TODO: Implement OAuth2 credentials formatting
    },
    variables,
    scripts: {
      preRequestScripts,
      postResponseScripts,
      testScripts
    }
  };
  
  return context;
}; 