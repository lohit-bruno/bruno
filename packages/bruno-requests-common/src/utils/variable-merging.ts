import { 
  RequestItem, 
  Collection, 
  VarConfig, 
  ScriptConfig 
} from '../types';

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

export interface CollectionItem {
  type: 'folder' | 'request';
  root?: {
    request?: {
      vars?: VarConfig;
      headers?: HeaderItem[];
      script?: ScriptConfig;
    };
  };
  draft?: {
    request?: {
      vars?: VarConfig;
      headers?: HeaderItem[];
      script?: ScriptConfig;
    };
  };
  request?: {
    vars?: VarConfig;
    headers?: HeaderItem[];
    script?: ScriptConfig;
  };
}

const processVariables = ({ 
  variables = [], 
  targetMap
}: { 
  variables: VariableItem[]; 
  targetMap: Map<string, any> 
}): Map<string, any> => {
  const result = new Map(targetMap);
  
  variables.forEach((variable) => {
    if (variable.enabled) {
      result.set(variable.name, variable.value);
    }
  });
  
  return result;
};

const processHeaders = ({ 
  headers = [], 
  targetMap
}: { 
  headers: HeaderItem[]; 
  targetMap: Map<string, HeaderItem> 
}): Map<string, HeaderItem> => {
  const result = new Map(targetMap);
  
  headers.forEach((header) => {
    if (header.enabled) {
      result.set(header.name.toLowerCase(), header);
    }
  });
  
  return result;
};

const processScripts = ({ 
  scripts = [], 
  scriptType
}: { 
  scripts: string[]; 
  scriptType: 'req' | 'res' 
}): string[] => {
  return scripts.filter(script => script.trim().length > 0);
};

const mergeVariablesByType = ({ 
  collection, 
  requestTreePath = [], 
  varType
}: { 
  collection: Collection; 
  requestTreePath?: CollectionItem[]; 
  varType: 'req' | 'res' 
}): Map<string, any> => {
  let variables = new Map<string, any>();
  
  // Process collection-level variables
  const collectionVars = collection.root?.request?.vars?.[varType] || [];
  variables = processVariables({ 
    variables: collectionVars, 
    targetMap: variables 
  });
  
  // Process tree path variables
  for (const item of requestTreePath) {
    if (item.type === 'folder') {
      const folderVars = item.root?.request?.vars?.[varType] || [];
      variables = processVariables({ 
        variables: folderVars, 
        targetMap: variables 
      });
    } else {
      const requestVars = item.draft?.request?.vars?.[varType] || item.request?.vars?.[varType] || [];
      variables = processVariables({ 
        variables: requestVars, 
        targetMap: variables 
      });
    }
  }
  
  return variables;
};

export const mergeVars = ({ 
  collection, 
  request, 
  requestTreePath = []
}: { 
  collection: Collection; 
  request: any; 
  requestTreePath?: CollectionItem[] 
}): void => {
  // Process request variables
  const reqVars = mergeVariablesByType({ 
    collection, 
    requestTreePath, 
    varType: 'req' 
  });
  
  // Process response variables
  const resVars = mergeVariablesByType({ 
    collection, 
    requestTreePath, 
    varType: 'res' 
  });
  
  // Set merged variables on request
  if (request.vars) {
    request.vars.req = Array.from(reqVars, ([name, value]) => ({
      name,
      value,
      enabled: true,
      type: 'request'
    }));
    
    request.vars.res = Array.from(resVars, ([name, value]) => ({
      name,
      value,
      enabled: true,
      type: 'response'
    }));
  }
  
  // Set categorized variables
  const collectionVariables: Record<string, any> = {};
  const folderVariables: Record<string, any> = {};
  const requestVariables: Record<string, any> = {};
  
  // Process collection variables
  const collectionReqVars = collection.root?.request?.vars?.req || [];
  collectionReqVars.forEach((variable: VariableItem) => {
    if (variable.enabled) {
      collectionVariables[variable.name] = variable.value;
    }
  });
  
  // Process folder variables
  for (const item of requestTreePath) {
    if (item.type === 'folder') {
      const folderVars = item.root?.request?.vars?.req || [];
      folderVars.forEach((variable: VariableItem) => {
        if (variable.enabled) {
          folderVariables[variable.name] = variable.value;
        }
      });
    } else {
      const itemVars = item.draft?.request?.vars?.req || item.request?.vars?.req || [];
      itemVars.forEach((variable: VariableItem) => {
        if (variable.enabled) {
          requestVariables[variable.name] = variable.value;
        }
      });
    }
  }
  
  request.collectionVariables = collectionVariables;
  request.folderVariables = folderVariables;
  request.requestVariables = requestVariables;
};

export const mergeHeaders = ({ 
  collection, 
  request, 
  requestTreePath = []
}: { 
  collection: Collection; 
  request: any; 
  requestTreePath?: CollectionItem[] 
}): void => {
  let headers = new Map<string, HeaderItem>();
  
  // Process collection-level headers
  const collectionHeaders = collection.root?.request?.headers || [];
  headers = processHeaders({ 
    headers: collectionHeaders, 
    targetMap: headers 
  });
  
  // Process tree path headers
  for (const item of requestTreePath) {
    if (item.type === 'folder') {
      const folderHeaders = item.root?.request?.headers || [];
      headers = processHeaders({ 
        headers: folderHeaders, 
        targetMap: headers 
      });
    } else {
      const requestHeaders = item.draft?.request?.headers || item.request?.headers || [];
      headers = processHeaders({ 
        headers: requestHeaders, 
        targetMap: headers 
      });
    }
  }
  
  // Merge with existing request headers
  const existingHeaders = request.headers || [];
  headers = processHeaders({ 
    headers: existingHeaders, 
    targetMap: headers 
  });
  
  // Convert back to array format
  request.headers = Array.from(headers.values());
};

export const mergeScripts = ({ 
  collection, 
  request, 
  requestTreePath = [], 
  scriptFlow = 'sandwich'
}: { 
  collection: Collection; 
  request: any; 
  requestTreePath?: CollectionItem[]; 
  scriptFlow?: string 
}): void => {
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
  
  // Process tree path scripts
  for (const item of requestTreePath) {
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
  
  // Get request-level scripts
  const requestScript = request.script || {};
  const requestPreRequestScript = requestScript.req || '';
  const requestPostResponseScript = requestScript.res || '';
  
  // Merge scripts based on flow
  if (scriptFlow === 'sandwich') {
    // Collection -> Folders -> Request -> Folders (reverse) -> Collection
    const preRequestParts = processScripts({ 
      scripts: [
        collectionPreRequestScript,
        ...folderPreRequestScripts,
        requestPreRequestScript,
        ...folderPreRequestScripts.reverse(),
        collectionPreRequestScript
      ], 
      scriptType: 'req' 
    });
    
    const postResponseParts = processScripts({ 
      scripts: [
        collectionPostResponseScript,
        ...folderPostResponseScripts,
        requestPostResponseScript,
        ...folderPostResponseScripts.reverse(),
        collectionPostResponseScript
      ], 
      scriptType: 'res' 
    });
    
    request.script = {
      req: preRequestParts.join('\n\n'),
      res: postResponseParts.join('\n\n')
    };
  } else {
    // Default flow: Collection -> Folders -> Request
    const preRequestParts = processScripts({ 
      scripts: [
        collectionPreRequestScript,
        ...folderPreRequestScripts,
        requestPreRequestScript
      ], 
      scriptType: 'req' 
    });
    
    const postResponseParts = processScripts({ 
      scripts: [
        collectionPostResponseScript,
        ...folderPostResponseScripts,
        requestPostResponseScript
      ], 
      scriptType: 'res' 
    });
    
    request.script = {
      req: preRequestParts.join('\n\n'),
      res: postResponseParts.join('\n\n')
    };
  }
}; 