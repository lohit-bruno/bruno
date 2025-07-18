import Bru from './bru.js';
import BrunoRequest from './bruno-request.js';
import BrunoResponse from './bruno-response.js';
import { cleanJson, cleanCircularJson, evaluateJsExpression, evaluateJsTemplateLiteral } from './utils.js';
import { createBruTestResultMethods } from './utils/results.js';

// Export for CommonJS compatibility
const utils = {
  cleanJson,
  cleanCircularJson,
  evaluateJsExpression,
  evaluateJsTemplateLiteral,
  createBruTestResultMethods
};

// Named exports for ES modules
export {
  Bru,
  BrunoRequest,
  BrunoResponse,
  utils
};

// Also export as default for better compatibility
export default {
  Bru,
  BrunoRequest,
  BrunoResponse,
  utils
};
