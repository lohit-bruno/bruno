const { describe, it, expect } = require('@jest/globals');
const { newQuickJSWASMModule } = require('quickjs-emscripten');

describe('quickjs basic tests', () => {
  it('should create VM and execute simple JavaScript', async () => {
    const module = await newQuickJSWASMModule();
    const vm = module.newContext();
    
    try {
      // Test basic arithmetic
      const result = vm.evalCode('2 + 3');
      const value = vm.dump(vm.unwrapResult(result));
      vm.unwrapResult(result).dispose();
      
      expect(value).toBe(5);
    } finally {
      vm.dispose();
    }
  });

  it('should handle string operations', async () => {
    const module = await newQuickJSWASMModule();
    const vm = module.newContext();
    
    try {
      const result = vm.evalCode('"Hello" + " " + "World"');
      const value = vm.dump(vm.unwrapResult(result));
      vm.unwrapResult(result).dispose();
      
      expect(value).toBe('Hello World');
    } finally {
      vm.dispose();
    }
  });

  it('should handle arrays', async () => {
    const module = await newQuickJSWASMModule();
    const vm = module.newContext();
    
    try {
      const result = vm.evalCode('[1, 2, 3].length');
      const value = vm.dump(vm.unwrapResult(result));
      vm.unwrapResult(result).dispose();
      
      expect(value).toBe(3);
    } finally {
      vm.dispose();
    }
  });
});
