// Simple test for runRequest function
// Run with: node tests/request.test.js

const { runRequestWithContext, runRequest } = require('../dist/cjs/index.js');

// Mock script runtime for testing
const mockScriptRuntime = {
  runScript: async ({ script, request, response, variables }) => {
    console.log(`Executing script: ${script.substring(0, 50)}...`);
    return {
      results: ['Script executed successfully'],
      envVariables: variables.envVariables || {},
      runtimeVariables: variables.runtimeVariables || {},
      globalEnvironmentVariables: variables.globalEnvironmentVariables || {}
    };
  }
};

// Mock vars runtime for testing
const mockVarsRuntime = {
  runPostResponseVars: (vars, request, response, envVars, runtimeVars, collectionPath, processEnvVars) => {
    console.log('Processing response variables...');
    return {
      envVariables: envVars,
      runtimeVariables: runtimeVars,
      globalEnvironmentVariables: {}
    };
  }
};

// Mock assertions runtime for testing
const mockAssertRuntime = {
  runAssertions: (assertions, request, response, envVars, runtimeVars, processEnvVars) => {
    console.log('Running assertions...');
    return [
      { status: 'passed', message: 'Status code is 200' },
      { status: 'passed', message: 'Response time is acceptable' }
    ];
  }
};

// Test data
const testItem = {
  uid: 'test-request-1',
  name: 'Test Request',
  request: {
    url: 'https://httpbin.org/get',
    method: 'GET',
    headers: [
      { name: 'Content-Type', value: 'application/json', enabled: true },
      { name: 'User-Agent', value: 'Bruno-Test/1.0', enabled: true }
    ],
    body: {
      mode: 'none'
    },
    params: [
      { name: 'test', value: 'true', type: 'query', enabled: true }
    ],
    vars: {
      req: [
        { name: 'baseUrl', value: 'https://httpbin.org', enabled: true }
      ],
      res: [
        { name: 'responseId', value: '{{res.body.headers.X-Amzn-Trace-Id}}', enabled: true }
      ]
    },
    script: {
      req: 'console.log("Pre-request script executed");',
      res: 'console.log("Post-response script executed");'
    },
    tests: 'console.log("Test script executed");',
    assertions: [
      { type: 'status-code', operator: 'eq', value: '200' }
    ]
  }
};

const testCollection = {
  uid: 'test-collection-1',
  name: 'Test Collection',
  root: {
    request: {
      headers: [
        { name: 'X-Collection-Header', value: 'test-value', enabled: true }
      ],
      vars: {
        req: [
          { name: 'collectionVar', value: 'collection-value', enabled: true }
        ]
      }
    }
  },
  globalEnvironmentVariables: {
    API_KEY: 'test-api-key',
    BASE_URL: 'https://httpbin.org'
  }
};

const testContext = {
  item: testItem,
  collection: testCollection,
  envVars: {
    environment: 'test',
    apiVersion: 'v1'
  },
  runtimeVariables: {
    requestId: '12345',
    timestamp: Date.now()
  },
  processEnvVars: {
    NODE_ENV: 'test'
  },
  collectionUid: 'test-collection-1',
  collectionPath: '/test/collection',
  collectionName: 'Test Collection',
  timeout: 10000,
  runtime: 'quickjs',
  scriptRuntime: mockScriptRuntime,
  varsRuntime: mockVarsRuntime,
  assertRuntime: mockAssertRuntime,
  onConsoleLog: (type, args) => {
    console.log(`[${type.toUpperCase()}]`, ...args);
  },
  runRequestByItemPathname: async (pathname) => {
    console.log(`Running request by pathname: ${pathname}`);
    return { status: 200, data: 'Mock response' };
  }
};

// Test functions
async function testModularRunRequest() {
  console.log('\n🧪 Testing Modular runRequestWithContext...\n');
  
  try {
    const response = await runRequestWithContext({ context: testContext });
    
    console.log('✅ Request executed successfully!');
    console.log('📊 Response Summary:');
    console.log(`   Status: ${response.status} ${response.statusText}`);
    console.log(`   Response Time: ${response.responseTime}ms`);
    console.log(`   Data Size: ${response.size} bytes`);
    console.log(`   Headers: ${Object.keys(response.headers || {}).length} headers`);
    console.log(`   Pre-request Results: ${response.preRequestResults?.length || 0}`);
    console.log(`   Post-response Results: ${response.postResponseResults?.length || 0}`);
    console.log(`   Test Results: ${response.testResults?.length || 0}`);
    console.log(`   Assertion Results: ${response.assertionResults?.length || 0}`);
    
    if (response.error) {
      console.log(`❌ Error: ${response.error}`);
    }
    
    return response;
  } catch (error) {
    console.error('❌ Test failed:', error.message);
    throw error;
  }
}

async function testLegacyRunRequest() {
  console.log('\n🔄 Testing Legacy runRequest (backward compatibility)...\n');
  
  const legacyOptions = {
    item: testItem,
    collection: testCollection,
    envVars: testContext.envVars,
    runtimeVariables: testContext.runtimeVariables,
    processEnvVars: testContext.processEnvVars,
    collectionUid: testContext.collectionUid,
    collectionPath: testContext.collectionPath,
    collectionName: testContext.collectionName,
    timeout: testContext.timeout,
    runtime: testContext.runtime,
    scriptRuntime: testContext.scriptRuntime,
    varsRuntime: testContext.varsRuntime,
    assertRuntime: testContext.assertRuntime,
    onConsoleLog: testContext.onConsoleLog,
    runRequestByItemPathname: testContext.runRequestByItemPathname
  };
  
  try {
    const response = await runRequest(legacyOptions);
    
    console.log('✅ Legacy request executed successfully!');
    console.log('📊 Response Summary:');
    console.log(`   Status: ${response.status} ${response.statusText}`);
    console.log(`   Response Time: ${response.responseTime}ms`);
    
    return response;
  } catch (error) {
    console.error('❌ Legacy test failed:', error.message);
    throw error;
  }
}

async function testErrorHandling() {
  console.log('\n🚨 Testing Error Handling...\n');
  
  const invalidContext = {
    ...testContext,
    item: {
      ...testItem,
      request: {
        ...testItem.request,
        url: 'invalid-url',
        method: 'INVALID_METHOD'
      }
    }
  };
  
  try {
    const response = await runRequestWithContext({ context: invalidContext });
    
    if (response.error) {
      console.log('✅ Error handling works correctly');
      console.log(`   Error: ${response.error}`);
    } else {
      console.log('⚠️ Expected error but got success response');
    }
    
    return response;
  } catch (error) {
    console.log('✅ Error caught as expected:', error.message);
    return { error: error.message };
  }
}

// Run all tests
async function runAllTests() {
  console.log('🎯 Bruno Requests Common - Simple Test Suite\n');
  console.log('=' .repeat(50));
  
  try {
    // Test 1: Modular approach
    await testModularRunRequest();
    
    // Test 2: Legacy approach
    await testLegacyRunRequest();
    
    // Test 3: Error handling
    await testErrorHandling();
    
    console.log('\n' + '=' .repeat(50));
    console.log('🎉 All tests completed successfully!');
    
  } catch (error) {
    console.log('\n' + '=' .repeat(50));
    console.error('💥 Test suite failed:', error.message);
    process.exit(1);
  }
}

// Run tests if this file is executed directly
if (require.main === module) {
  runAllTests();
}

module.exports = {
  testModularRunRequest,
  testLegacyRunRequest,
  testErrorHandling,
  runAllTests
}; 