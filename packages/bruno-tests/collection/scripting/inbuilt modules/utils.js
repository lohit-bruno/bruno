const doesUint8ArraysWorkAsExpected = () => {
  try {
    const util = require('node:util');
    // node:vm - true
    // vm2 - false
    return util.types.isUint8Array(new Uint8Array(32));
  }
  catch (err) {
    // safe mode [quickjs], will work as expected
    return true;
  }
}

const isUint8Array = (val) => {
  try {
    // developer mode [node:vm and vm2]
    const util = require('node:util');
    return util.types.isUint8Array(val);
  }
  catch (err) {
    // node:util not present in safe mode [quickjs]
    return val instanceof Uint8Array;
  }
}

const getRandomValuesFunction = (typedArray) => {
  try {
    // developer mode [node:vm and vm2]
    const crypto = require('node:crypto');
    return crypto.webcrypto.getRandomValues(typedArray);
  }
  catch (err) {
    // node:crypto not present in safe mode [quickjs] - uses shim
    return crypto.getRandomValues(typedArray);
  }
}

const randomBytesFunction = (num) => {
  try {
    // developer mode [node:vm and vm2]
    const crypto = require('node:crypto');
    return crypto.randomBytes(num);
  }
  catch (err) {
    // node:crypto not present in safe mode [quickjs] - uses shim
    return crypto.randomBytes(num);
  }
}

const getTextEncoder = () => {
  try {
    // developer mode [node:vm and vm2]
    const util = require('node:util');
    const encoder = new util.TextEncoder();
    return encoder;
  }
  catch (err) {
    // node:util not present in safe mode [quickjs]
    // use the TextEncoder class shim
    const encoder = new TextEncoder();
    return encoder;
  }
};

const getTextDecoder = () => {
  try {
    // developer mode [node:vm and vm2]
    const util = require('node:util');
    const decoder = new util.TextDecoder();
    return decoder;
  }
  catch (err) {
    // node:util not present in safe mode [quickjs]
    // use the TextEncoder class shim
    const decoder = new TextDecoder();
    return decoder;
  }
};

module.exports = {
  doesUint8ArraysWorkAsExpected,
  isUint8Array,
  getRandomValuesFunction,
  randomBytesFunction,
  getTextEncoder,
  getTextDecoder
}