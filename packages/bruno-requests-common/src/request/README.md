# Bruno Request Execution Abstractions

This module provides isomorphic abstractions for executing Bruno HTTP requests. It extracts the core request execution logic from `@bruno-electron` to make it reusable across different environments (browser, Node.js, etc.).

## Overview

The module is split into two main parts:

### Part 1: Context Creation (`createRunRequestContext`)
Handles the merging of variables, headers, and scripts from collection, folder, and request levels.

### Part 2: Request Execution (`runRequest`)
Orchestrates the full request execution flow including pre-request scripts, interpolation, HTTP execution, post-response scripts, tests, and assertions.

## Key Features

- **Isomorphic**: Works in both browser and Node.js environments
- **Modular**: Platform-specific implementations can be plugged in
- **Type-safe**: Full TypeScript support
- **Extensible**: Interfaces for custom HTTP clients and runtimes

## Usage

### Part 1: Creating Request Context

```typescript
import { createRunRequestContext } from '@usebruno/common/request';

const context = createRunRequestContext({
  collection,
  item,
  request,
  envVariables: {},
  runtimeVariables: {},
  processEnvVariables: {}
});

// The context contains:
// - Merged variables from collection/folder/request levels
// - Merged headers with proper precedence
// - Merged scripts (pre-request, post-response, tests)
// - Request tree path
```

### Part 2: Running Requests

```typescript
import { 
  runRequest,
  type BrunoHttpClient,
  type BrunoRuntimeProvider 
} from '@usebruno/common/request';

// You need to provide platform-specific implementations
const httpClient: BrunoHttpClient = {
  makeRequest: async (request, options) => {
    // Your HTTP implementation here
    // Could use axios, fetch, or any other HTTP library
  }
};

const runtimeProvider: BrunoRuntimeProvider = {
  createScriptRuntime: (config) => {
    // Your script runtime implementation
    // Could use vm2, QuickJS, or browser's eval
  },
  createTestRuntime: (config) => {
    // Your test runtime implementation
  },
  createAssertRuntime: (config) => {
    // Your assertion runtime implementation
  }
};

// Execute the request
const result = await runRequest(
  context,
  httpClient,
  runtimeProvider,
  {
    collectionPath: '/path/to/collection',
    onConsoleLog: (type, args) => console[type](...args),
    scriptingConfig: { runtime: 'vm2' }
  }
);
```

## Individual Functions

You can also use individual functions for more granular control:

### Context Creation Functions

```typescript
import { 
  mergeVariables,
  mergeHeaders,
  mergeScripts,
  getTreePathFromCollectionToItem 
} from '@usebruno/common/request';

// Get request tree path
const requestTreePath = getTreePathFromCollectionToItem(collection, item);

// Merge variables
const { collectionVariables, folderVariables, requestVariables } = 
  mergeVariables(collection, request, requestTreePath);

// Merge headers
const mergedHeaders = mergeHeaders(collection, request, requestTreePath);

// Merge scripts
const { preRequestScripts, postResponseScripts, testScripts } = 
  mergeScripts(collection, request, requestTreePath, 'sandwich');
```

### Execution Functions

```typescript
import { 
  executePreRequestScripts,
  executePostResponseScripts,
  executeTestScripts,
  executeAssertions 
} from '@usebruno/common/request';

// Execute individual phases
const preResult = await executePreRequestScripts(context, runtimeProvider, options);
const postResult = await executePostResponseScripts(context, request, response, variables, runtimeProvider, options);
const testResult = await executeTestScripts(context, request, response, variables, runtimeProvider, options);
const assertResult = executeAssertions(request, response, variables, runtimeProvider, options);
```

### Interpolation Functions

```typescript
import { 
  interpolateRequest,
  interpolateString,
  createCombinedVariables 
} from '@usebruno/common/request';

// Create combined variables with proper precedence
const combinedVars = createCombinedVariables({
  globalEnvironmentVariables: {},
  collectionVariables: {},
  envVariables: {},
  folderVariables: {},
  requestVariables: {},
  runtimeVariables: {}
});

// Interpolate entire request
const interpolatedRequest = interpolateRequest(request, combinedVars);

// Interpolate individual strings
const interpolatedString = interpolateString('Hello {{name}}', { name: 'World' });
```

## Platform Implementations

To use these abstractions, you need to provide platform-specific implementations:

### HTTP Client Implementation

For Node.js with axios:
```typescript
import axios from 'axios';

const httpClient: BrunoHttpClient = {
  makeRequest: async (request, options) => {
    const response = await axios(request);
    return {
      status: response.status,
      statusText: response.statusText,
      headers: response.headers,
      data: response.data,
      // ... other response properties
    };
  }
};
```

For browser with fetch:
```typescript
const httpClient: BrunoHttpClient = {
  makeRequest: async (request, options) => {
    const response = await fetch(request.url, {
      method: request.method,
      headers: request.headers,
      body: request.data
    });
    return {
      status: response.status,
      statusText: response.statusText,
      headers: Object.fromEntries(response.headers.entries()),
      data: await response.text(),
      // ... other response properties
    };
  }
};
```

### Runtime Provider Implementation

You can use the existing `@usebruno/js` package or create your own:

```typescript
import { ScriptRuntime, TestRuntime, AssertRuntime } from '@usebruno/js';

const runtimeProvider: BrunoRuntimeProvider = {
  createScriptRuntime: (config) => new ScriptRuntime(config),
  createTestRuntime: (config) => new TestRuntime(config),
  createAssertRuntime: (config) => new AssertRuntime(config)
};
```

## Migration from bruno-electron

If you're migrating from the existing bruno-electron implementation:

1. Replace `prepareRequest` + `mergeVars`/`mergeHeaders`/`mergeScripts` calls with `createRunRequestContext`
2. Replace the inline request execution logic with `runRequest`
3. Provide platform-specific HTTP client and runtime implementations
4. Update imports to use `@usebruno/common/request`

## Type Definitions

All types are exported from the main module:

```typescript
import type { 
  BrunoRequest,
  BrunoResponse,
  BrunoRequestContext,
  BrunoRunRequestOptions,
  BrunoRunRequestResult,
  BrunoHttpClient,
  BrunoRuntimeProvider
} from '@usebruno/common/request';
``` 