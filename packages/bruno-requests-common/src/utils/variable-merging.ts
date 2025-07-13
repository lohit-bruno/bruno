export interface VariableItem {
  name: string;
  value: any;
  enabled: boolean;
  type?: string;
}

export interface HeaderItem {
  name: string;
  value: string;
  enabled: boolean;
}

export interface ScriptItem {
  req?: string;
  res?: string;
}

export interface CollectionItem {
  type: 'folder' | 'request';
  root?: {
    request?: {
      vars?: {
        req?: VariableItem[];
        res?: VariableItem[];
      };
      headers?: HeaderItem[];
      script?: ScriptItem;
    };
  };
  draft?: {
    request?: {
      vars?: {
        req?: VariableItem[];
        res?: VariableItem[];
      };
      headers?: HeaderItem[];
      script?: ScriptItem;
    };
  };
  request?: {
    vars?: {
      req?: VariableItem[];
      res?: VariableItem[];
    };
    headers?: HeaderItem[];
    script?: ScriptItem;
  };
}

export interface MergeCollection {
  root?: {
    request?: {
      vars?: {
        req?: VariableItem[];
        res?: VariableItem[];
      };
      headers?: HeaderItem[];
      script?: ScriptItem;
    };
  };
}

/**
 * Simplified version of mergeVars for isomorphic environments
 * Note: This is a simplified version that doesn't include all the complex tree traversal logic
 */
export const mergeVars = (
  collection: MergeCollection,
  request: any,
  requestTreePath?: CollectionItem[]
): void => {
  let reqVars = new Map<string, any>();
  let collectionVariables: Record<string, any> = {};
  
  // Process collection-level variables
  const collectionRequestVars = collection.root?.request?.vars?.req || [];
  collectionRequestVars.forEach((variable) => {
    if (variable.enabled) {
      reqVars.set(variable.name, variable.value);
      collectionVariables[variable.name] = variable.value;
    }
  });

  let folderVariables: Record<string, any> = {};
  let requestVariables: Record<string, any> = {};

  // Process tree path if provided (simplified version)
  if (requestTreePath) {
    for (let item of requestTreePath) {
      if (item.type === 'folder') {
        const vars = item.root?.request?.vars?.req || [];
        vars.forEach((variable) => {
          if (variable.enabled) {
            reqVars.set(variable.name, variable.value);
            folderVariables[variable.name] = variable.value;
          }
        });
      } else {
        const vars = item.draft?.request?.vars?.req || item.request?.vars?.req || [];
        vars.forEach((variable) => {
          if (variable.enabled) {
            reqVars.set(variable.name, variable.value);
            requestVariables[variable.name] = variable.value;
          }
        });
      }
    }
  }

  // Set the merged variables on the request
  request.collectionVariables = collectionVariables;
  request.folderVariables = folderVariables;
  request.requestVariables = requestVariables;

  if (request.vars) {
    request.vars.req = Array.from(reqVars, ([name, value]) => ({
      name,
      value,
      enabled: true,
      type: 'request'
    }));
  }

  // Process response variables
  let resVars = new Map<string, any>();
  const collectionResponseVars = collection.root?.request?.vars?.res || [];
  collectionResponseVars.forEach((variable) => {
    if (variable.enabled) {
      resVars.set(variable.name, variable.value);
    }
  });

  // Process tree path response variables if provided
  if (requestTreePath) {
    for (let item of requestTreePath) {
      if (item.type === 'folder') {
        const vars = item.root?.request?.vars?.res || [];
        vars.forEach((variable) => {
          if (variable.enabled) {
            resVars.set(variable.name, variable.value);
          }
        });
      } else {
        const vars = item.draft?.request?.vars?.res || item.request?.vars?.res || [];
        vars.forEach((variable) => {
          if (variable.enabled) {
            resVars.set(variable.name, variable.value);
          }
        });
      }
    }
  }

  if (request.vars) {
    request.vars.res = Array.from(resVars, ([name, value]) => ({
      name,
      value,
      enabled: true,
      type: 'response'
    }));
  }
};

/**
 * Simplified version of mergeHeaders for isomorphic environments
 */
export const mergeHeaders = (
  collection: MergeCollection,
  request: any,
  requestTreePath?: CollectionItem[]
): void => {
  const headers = new Map<string, HeaderItem>();

  // Process collection-level headers
  const collectionHeaders = collection.root?.request?.headers || [];
  collectionHeaders.forEach((header) => {
    if (header.enabled) {
      headers.set(header.name.toLowerCase(), header);
    }
  });

  // Process tree path headers if provided
  if (requestTreePath) {
    for (let item of requestTreePath) {
      if (item.type === 'folder') {
        const itemHeaders = item.root?.request?.headers || [];
        itemHeaders.forEach((header) => {
          if (header.enabled) {
            headers.set(header.name.toLowerCase(), header);
          }
        });
      } else {
        const itemHeaders = item.draft?.request?.headers || item.request?.headers || [];
        itemHeaders.forEach((header) => {
          if (header.enabled) {
            headers.set(header.name.toLowerCase(), header);
          }
        });
      }
    }
  }

  // Merge with existing request headers
  const requestHeaders = request.headers || [];
  requestHeaders.forEach((header: HeaderItem) => {
    if (header.enabled) {
      headers.set(header.name.toLowerCase(), header);
    }
  });

  // Convert back to array format
  request.headers = Array.from(headers.values());
};

/**
 * Simplified version of mergeScripts for isomorphic environments
 */
export const mergeScripts = (
  collection: MergeCollection,
  request: any,
  requestTreePath?: CollectionItem[],
  scriptFlow: string = 'sandwich'
): void => {
  let collectionPreRequestScript = '';
  let collectionPostResponseScript = '';

  // Process collection-level scripts
  const collectionScript = collection.root?.request?.script;
  if (collectionScript) {
    collectionPreRequestScript = collectionScript.req || '';
    collectionPostResponseScript = collectionScript.res || '';
  }

  let folderPreRequestScripts: string[] = [];
  let folderPostResponseScripts: string[] = [];

  // Process tree path scripts if provided
  if (requestTreePath) {
    for (let item of requestTreePath) {
      if (item.type === 'folder') {
        const itemScript = item.root?.request?.script;
        if (itemScript) {
          if (itemScript.req) {
            folderPreRequestScripts.push(itemScript.req);
          }
          if (itemScript.res) {
            folderPostResponseScripts.push(itemScript.res);
          }
        }
      }
    }
  }

  // Get request-level scripts
  const requestScript = request.script || {};
  const requestPreRequestScript = requestScript.req || '';
  const requestPostResponseScript = requestScript.res || '';

  // Merge scripts based on flow
  if (scriptFlow === 'sandwich') {
    // Collection -> Folders -> Request -> Folders (reverse) -> Collection
    const preRequestParts = [
      collectionPreRequestScript,
      ...folderPreRequestScripts,
      requestPreRequestScript,
      ...folderPreRequestScripts.reverse(),
      collectionPreRequestScript
    ].filter(script => script.trim().length > 0);

    const postResponseParts = [
      collectionPostResponseScript,
      ...folderPostResponseScripts,
      requestPostResponseScript,
      ...folderPostResponseScripts.reverse(),
      collectionPostResponseScript
    ].filter(script => script.trim().length > 0);

    request.script = {
      req: preRequestParts.join('\n\n'),
      res: postResponseParts.join('\n\n')
    };
  } else {
    // Default flow: Collection -> Folders -> Request
    const preRequestParts = [
      collectionPreRequestScript,
      ...folderPreRequestScripts,
      requestPreRequestScript
    ].filter(script => script.trim().length > 0);

    const postResponseParts = [
      collectionPostResponseScript,
      ...folderPostResponseScripts,
      requestPostResponseScript
    ].filter(script => script.trim().length > 0);

    request.script = {
      req: preRequestParts.join('\n\n'),
      res: postResponseParts.join('\n\n')
    };
  }
}; 