const crypto = require('node:crypto');
const { marshallToVm } = require('../../utils');

/**
 * Node.js crypto module shim for QuickJS sandbox
 * Implements crypto.randomBytes following Node.js specifications
 * Implements crypto.getRandomValues following Web Crypto API specifications
 */
const addCryptoUtilsShimToContext = async (vm) => {
  let randomBytesHandle = vm.newFunction('randomBytes', function (sizeHandle) {
    try {
      let size = vm.dump(sizeHandle);
      
      if (typeof size !== 'number') {
        throw new TypeError('The "size" argument must be of type number');
      }

      size = Math.trunc(size);

      if (size < 0) {
        throw new RangeError('The "size" argument must be >= 0');
      }

      if (size > 65536) { // 2^31 - 1 (max safe integer for practical use)
        throw new RangeError('The "size" argument is too large');
      }

      if (size === 0) {
        return marshallToVm([], vm);
      }

      const buffer = crypto.randomBytes(size);
      
      const byteArray = Array.from(buffer);
      
      return marshallToVm(byteArray, vm);
      
    } catch (error) {
      const vmError = vm.newError(error.message);
      vm.setProp(vmError, 'name', vm.newString(error.name));
      
      throw vmError;
    }
  });

  // webcrypto api's getRandomValues function
  let getRandomValuesHandle = vm.newFunction('getRandomValues', function (arrayHandle) {
    try {
      // Get the length property directly from the QuickJS handle
      const lengthHandle = vm.getProp(arrayHandle, 'length');
      const length = vm.dump(lengthHandle);
      lengthHandle.dispose();
      
      if (typeof length !== 'number') {
        throw new TypeError('getRandomValues: Argument 1 does not have a length property');
      }
      
      if (length === 0) {
        return arrayHandle;
      }

      // Web Crypto API has a 65536 byte limit
      if (length > 65536) {
        throw new Error('getRandomValues: ArrayBufferView byte length exceeds 65536');
      }

      // Generate cryptographically secure random bytes using Node.js crypto
      const buffer = crypto.randomBytes(length);
      
      // Fill the original array in-place by setting each index
      for (let i = 0; i < length; i++) {
        const indexHandle = vm.newNumber(i);
        const valueHandle = vm.newNumber(buffer[i]);
        vm.setProp(arrayHandle, indexHandle, valueHandle);
        indexHandle.dispose();
        valueHandle.dispose();
      }
      
      return arrayHandle;
      
    } catch (error) {
      const vmError = vm.newError(error.message);
      vm.setProp(vmError, 'name', vm.newString(error.name));
      
      throw vmError;
    }
  });

  // Set the functions in global context
  vm.setProp(vm.global, '__bruno__crypto__randomBytes', randomBytesHandle);
  vm.setProp(vm.global, '__bruno__crypto__getRandomValues', getRandomValuesHandle);
  randomBytesHandle.dispose();
  getRandomValuesHandle.dispose();

  vm.evalCode(`
    // Create crypto module object following Node.js specifications
    const cryptoModule = {
      // Main randomBytes function - Node.js crypto.randomBytes API
      randomBytes: globalThis.__bruno__crypto__randomBytes,
      
      // Web Crypto API getRandomValues function
      getRandomValues: globalThis.__bruno__crypto__getRandomValues,
      
      // Helper to create a Buffer-like object from byte array
      _createBuffer: function(byteArray) {
        const buffer = new Uint8Array(byteArray);
        
        // Add Buffer-like methods for Node.js compatibility
        buffer.toString = function(encoding = 'hex') {
          switch (encoding) {
            case 'hex':
              return Array.from(this)
                .map(byte => byte.toString(16).padStart(2, '0'))
                .join('');
                
            case 'base64':
              return this._encodeBase64();
              
            case 'utf8':
            case 'utf-8':
            default:
              return String.fromCharCode.apply(null, this);
          }
        };
        
        // Base64 encoding implementation
        buffer._encodeBase64 = function() {
          return globalThis.btoa(String.fromCharCode.apply(null, this));
        };
        
        return buffer;
      }
    };
    
    // Override randomBytes to return Buffer-like objects
    const originalRandomBytes = cryptoModule.randomBytes;
    cryptoModule.randomBytes = function(size) {
      const byteArray = originalRandomBytes(size);
      // Convert VM array to native JavaScript array for Uint8Array constructor
      const nativeArray = Array.from(byteArray);
      return cryptoModule._createBuffer(nativeArray);
    };
    
    // Make crypto available globally as noble libraries expect crypto.getRandomValues
    globalThis.crypto = cryptoModule;
  `);
};

module.exports = addCryptoUtilsShimToContext;