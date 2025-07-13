const ScriptRuntime = require('./runtime/script-runtime');
const Bru = require('./bru');
const BrunoRequest = require('./bruno-request');
const BrunoResponse = require('./bruno-response');
const { cleanJson, cleanCircularJson, evaluateJsExpression, evaluateJsTemplateLiteral } = require('./utils');
const { createBruTestResultMethods } = require('./utils/results');

// Export for CommonJS compatibility
const utils = {
  cleanJson,
  cleanCircularJson,
  evaluateJsExpression,
  evaluateJsTemplateLiteral,
  createBruTestResultMethods
};

// Named exports for ES modules
module.exports = {
  ScriptRuntime,
  Bru,
  BrunoRequest,
  BrunoResponse,
  utils
};

// Also export as default for better compatibility
module.exports.default = module.exports;
