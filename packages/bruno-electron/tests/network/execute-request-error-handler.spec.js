const { executeRequestOnFailHandler } = require('../../src/ipc/network/index');
const axios = require('axios');

// Mock the ScriptRuntime and other dependencies
jest.mock('@usebruno/js', () => ({
  ScriptRuntime: jest.fn().mockImplementation(() => ({
    runRequestScript: jest.fn()
  }))
}));

// Mock other required functions
jest.mock('../../src/ipc/network/index', () => {
  const actual = jest.requireActual('../../src/ipc/network/index');
  return {
    ...actual,
    getDomainsWithCookies: jest.fn().mockResolvedValue({}),
    safeParseJSON: jest.fn(val => val),
    safeStringifyJSON: jest.fn(val => JSON.stringify(val))
  };
});

describe('executeRequestOnFailHandler', () => {
  let consoleSpy;
  let mockMainWindow;
  let mockContext;
  let mockScriptRuntime;

  beforeEach(() => {
    consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
    
    // Mock mainWindow with webContents.send
    mockMainWindow = {
      webContents: {
        send: jest.fn()
      }
    };

    // Mock context object with required properties
    mockContext = {
      requestUid: 'test-request-uid',
      envVars: {},
      collectionPath: '/test/path',
      collection: { name: 'test-collection' },
      collectionUid: 'test-collection-uid',
      runtimeVariables: {},
      processEnvVars: {},
      scriptingConfig: { runtime: 'javascript' },
      runRequestByItemPathname: jest.fn(),
      onConsoleLog: jest.fn()
    };

    // Reset ScriptRuntime mock
    const { ScriptRuntime } = require('@usebruno/js');
    mockScriptRuntime = {
      runRequestScript: jest.fn().mockResolvedValue({})
    };
    ScriptRuntime.mockImplementation(() => mockScriptRuntime);
  });

  afterEach(() => {
    consoleSpy.mockRestore();
    jest.clearAllMocks();
  });

  it('should do nothing when request is null', async () => {
    const error = new Error('Test error');
    
    await executeRequestOnFailHandler({
      request: null,
      error,
      context: mockContext,
      type: 'test-event',
      mainWindow: mockMainWindow
    });
    
    expect(consoleSpy).not.toHaveBeenCalled();
  });

  it('should do nothing when request is undefined', async () => {
    const error = new Error('Test error');
    
    await executeRequestOnFailHandler({
      request: undefined,
      error,
      context: mockContext,
      type: 'test-event',
      mainWindow: mockMainWindow
    });
    
    expect(consoleSpy).not.toHaveBeenCalled();
  });

  it('should do nothing when onFailHandler is not a function', async () => {
    const request = { onFailHandler: 'not a function' };
    const error = new Error('Test error');
    
    await executeRequestOnFailHandler({
      request,
      error,
      context: mockContext,
      type: 'test-event',
      mainWindow: mockMainWindow
    });
    
    expect(consoleSpy).not.toHaveBeenCalled();
  });

  it('should call onFailHandler when it exists and is a function', async () => {
    const mockHandler = jest.fn();
    const request = { onFailHandler: mockHandler };
    const error = new Error('Test error');
    
    await executeRequestOnFailHandler({
      request,
      error,
      context: mockContext,
      type: 'test-event',
      mainWindow: mockMainWindow
    });
    
    // The new implementation executes scripts, not direct function calls
    expect(mockScriptRuntime.runRequestScript).toHaveBeenCalled();
    expect(consoleSpy).not.toHaveBeenCalled();
  });

  it('should handle errors when onFailHandler fails by mutating the error message', async () => {
    const handlerError = new Error('Handler failed');
    const mockHandler = jest.fn(() => {
      throw handlerError;
    });
    const request = { onFailHandler: mockHandler };
    const error = new Error('Original error');

    // Mock ScriptRuntime to throw an error
    mockScriptRuntime.runRequestScript.mockRejectedValue(handlerError);

    await executeRequestOnFailHandler({
      request,
      error,
      context: mockContext,
      type: 'test-event',
      mainWindow: mockMainWindow
    });

    expect(error.message).toContain('1. Request failed: Original error');
    expect(error.message).toContain('2. Error executing onFail handler: Handler failed');
  });

  it('should pass the correct hard error object to the handler for DNS failure', async () => {
    const mockHandler = jest.fn();
    const request = { onFailHandler: mockHandler };

    let error;
    try {
      await axios.get('https://this-domain-definitely-does-not-exist-12345.com/api/test', {
        timeout: 5000
      });
    } catch (err) {
      error = err;
    }

    // Verify this is actually a hard error (no response)
    expect(error.response).toBeUndefined();

    // Mock ScriptRuntime to capture the serialized error
    let capturedScript;
    mockScriptRuntime.runRequestScript.mockImplementation((script) => {
      capturedScript = script;
      return Promise.resolve({});
    });

    await executeRequestOnFailHandler({
      request,
      error,
      context: mockContext,
      type: 'test-event',
      mainWindow: mockMainWindow
    });

    // Verify the script was created with the error
    expect(capturedScript).toContain('ENOTFOUND');
    expect(mockScriptRuntime.runRequestScript).toHaveBeenCalled();
  });

  it('should pass the correct hard error object to the handler for connection timeout', async () => {
    const mockHandler = jest.fn();
    const request = { onFailHandler: mockHandler };

    let error;
    try {
      await axios.get('http://192.168.255.255:9999/api/test', {
        timeout: 100
      });
    } catch (err) {
      error = err;
    }
    
    // Verify this is actually a hard error (no response)
    expect(error.response).toBeUndefined();
    
    // Mock ScriptRuntime to capture the serialized error
    let capturedScript;
    mockScriptRuntime.runRequestScript.mockImplementation((script) => {
      capturedScript = script;
      return Promise.resolve({});
    });
    
    await executeRequestOnFailHandler({
      request,
      error,
      context: mockContext,
      type: 'test-event',
      mainWindow: mockMainWindow
    });
    
    // Verify the script contains the timeout error information
    expect(capturedScript).toContain('ECONNABORTED');
    expect(mockScriptRuntime.runRequestScript).toHaveBeenCalled();
  });
}); 