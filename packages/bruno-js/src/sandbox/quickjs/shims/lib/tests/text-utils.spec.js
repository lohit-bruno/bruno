const { describe, it, expect } = require('@jest/globals');
const { newQuickJSWASMModule } = require('quickjs-emscripten');
const addTextUtilsShimToContext = require('../text-utils');

describe('text-utils shims tests', () => {
  let vm, module;

  beforeAll(async () => {
    module = await newQuickJSWASMModule();
  });

  beforeEach(async () => {
    vm = module.newContext();
    await addTextUtilsShimToContext(vm);
  });

  afterAll(() => {
    // ?
    // vm.dispose();
  });

  it('should provide TextEncoder class', async () => {
    const result = vm.evalCode('typeof TextEncoder');
    const handle = vm.unwrapResult(result);
    const type = vm.dump(handle);
    handle.dispose();
    
    expect(type).toBe('function');
  });

  it('should provide TextDecoder class', async () => {
    const result = vm.evalCode('typeof TextDecoder');
    const handle = vm.unwrapResult(result);
    const type = vm.dump(handle);
    handle.dispose();
    
    expect(type).toBe('function');
  });

  it('should create TextEncoder instance with utf-8 encoding', async () => {
    const result = vm.evalCode('new TextEncoder().encoding');
    const handle = vm.unwrapResult(result);
    const encoding = vm.dump(handle);
    handle.dispose();
    
    expect(encoding).toBe('utf-8');
  });

  it('should encode simple ASCII string', async () => {
    const result = vm.evalCode('new TextEncoder().encode("hello").length');
    const handle = vm.unwrapResult(result);
    const length = vm.dump(handle);
    handle.dispose();
    
    expect(length).toBe(5);
  });

  it('should decode simple ASCII bytes', async () => {
    const result = vm.evalCode(`
      const decoder = new TextDecoder();
      const bytes = new Uint8Array([104, 101, 108, 108, 111]);
      decoder.decode(bytes);
    `);
    const handle = vm.unwrapResult(result);
    const text = vm.dump(handle);
    handle.dispose();
    
    expect(text).toBe('hello');
  });

  it('should encode and decode round-trip', async () => {
    const result = vm.evalCode(`
      const encoder = new TextEncoder();
      const decoder = new TextDecoder();
      const original = 'test';
      const encoded = encoder.encode(original);
      const decoded = decoder.decode(encoded);
      decoded === original;
    `);
    const handle = vm.unwrapResult(result);
    const isEqual = vm.dump(handle);
    handle.dispose();
    
    expect(isEqual).toBe(true);
  });

  it('should handle UTF-8 encoding correctly', async () => {
    const result = vm.evalCode('new TextEncoder().encode("café").length');
    const handle = vm.unwrapResult(result);
    const length = vm.dump(handle);
    handle.dispose();
    
    expect(length).toBe(5); // 'café' = 5 bytes (é is 2 bytes in UTF-8)
  });

  it('should return Uint8Array from encode', async () => {
    const result = vm.evalCode('new TextEncoder().encode("test") instanceof Uint8Array');
    const handle = vm.unwrapResult(result);
    const isUint8Array = vm.dump(handle);
    handle.dispose();
    
    expect(isUint8Array).toBe(true);
  });
});