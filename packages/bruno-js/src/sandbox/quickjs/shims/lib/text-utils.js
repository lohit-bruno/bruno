const { marshallToVm } = require('../../utils');
const { TextEncoder, TextDecoder } = require('util');

const addTextUtilsShimToContext = async (vm) => {
  // Create helper functions for TextEncoder/TextDecoder that can be called from evalCode
  let textEncodeHandle = vm.newFunction('__bruno__textEncode', function (stringHandle) {
    try {
      const str = vm.dump(stringHandle);
      if (typeof str !== 'string') {
        throw new TypeError('TextEncoder.encode: argument must be a string');
      }
      
      const nodeTextEncoder = new TextEncoder();
      const uint8Array = nodeTextEncoder.encode(str);
      const byteArray = Array.from(uint8Array);
      
      return marshallToVm(byteArray, vm);
    } catch (error) {
      const vmError = vm.newError(error.message);
      vm.setProp(vmError, 'name', vm.newString(error.name));
      throw vmError;
    }
  });

  let textDecodeHandle = vm.newFunction('__bruno__textDecode', function (arrayHandle, encodingHandle) {
    try {
      let input = null;
      let encoding = 'utf-8';
      
      // Get encoding if provided
      if (encodingHandle && !vm.typeof(encodingHandle).startsWith('undefined')) {
        encoding = vm.dump(encodingHandle) || 'utf-8';
      }
      
      if (arrayHandle && !vm.typeof(arrayHandle).startsWith('undefined')) {
        // Try to get the array data
        const lengthHandle = vm.getProp(arrayHandle, 'length');
        const length = vm.dump(lengthHandle);
        lengthHandle.dispose();
        
        if (typeof length === 'number' && length >= 0) {
          // Extract bytes from the array and create Uint8Array
          const byteArray = [];
          for (let i = 0; i < length; i++) {
            const indexHandle = vm.newNumber(i);
            const valueHandle = vm.getProp(arrayHandle, indexHandle);
            const value = vm.dump(valueHandle);
            byteArray.push(value);
            indexHandle.dispose();
            valueHandle.dispose();
          }
          input = new Uint8Array(byteArray);
        } else {
          // Try to dump the whole thing as a fallback
          const dumped = vm.dump(arrayHandle);
          if (Array.isArray(dumped)) {
            input = new Uint8Array(dumped);
          } else if (dumped instanceof ArrayBuffer || ArrayBuffer.isView(dumped)) {
            // If it's already an ArrayBuffer or ArrayBufferView, use it directly
            input = dumped;
          } else {
            input = new Uint8Array([]);
          }
        }
      }
      
      // Use Node.js TextDecoder with the specified encoding
      const nodeDecoder = new TextDecoder(encoding);
      const result = nodeDecoder.decode(input);
      
      return vm.newString(result);
    } catch (error) {
      const vmError = vm.newError(error.message);
      vm.setProp(vmError, 'name', vm.newString(error.name));
      throw vmError;
    }
  });

  // Set the functions in global context
  vm.setProp(vm.global, '__bruno__textEncode', textEncodeHandle);
  vm.setProp(vm.global, '__bruno__textDecode', textDecodeHandle);
  textEncodeHandle.dispose();
  textDecodeHandle.dispose();

  vm.evalCode(`    
    globalThis.TextEncoder = class TextEncoder {
      constructor() {
        // TextEncoder always uses UTF-8 encoding
        this.encoding = 'utf-8';
      }
      
      encode(input = '') {
        if (typeof input !== 'string') {
          throw new TypeError('TextEncoder.encode: argument must be a string');
        }
        
        const byteArray = globalThis.__bruno__textEncode(input);
        return new Uint8Array(Array.from(byteArray));
      }
    };
    
    globalThis.TextDecoder = class TextDecoder {
      constructor(label = 'utf-8', options = {}) {
        this._encoding = label || 'utf-8';
        this._fatal = options.fatal || false;
        this._ignoreBOM = options.ignoreBOM || false;
      }
      
      decode(input, options = {}) {
        let byteArray = [];
        
        if (input) {
          // Check if input is ArrayBuffer, ArrayBufferView (TypedArray/DataView), or Array
          if (input instanceof ArrayBuffer || ArrayBuffer.isView(input) || input instanceof Array) {
            byteArray = Array.from(input);
          }
        }
        
        return globalThis.__bruno__textDecode(byteArray, this._encoding);
      }
    };
  `);
};

module.exports = addTextUtilsShimToContext;