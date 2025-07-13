const Bru = require('../bru');
const BrunoRequest = require('../bruno-request');
const BrunoResponse = require('../bruno-response');
const { cleanJson } = require('../utils');
const { createBruTestResultMethods } = require('../utils/results');

const chai = require('chai');
const { executeQuickJsVmAsync } = require('../sandbox/quickjs');

class ScriptRuntime {
  constructor(props) {
  }

  async runScript({
    script,
    request,
    response,
    variables,
    assertionResults,
    collectionName,
    collectionPath,
    onConsoleLog,
    runRequestByItemPathname // ?
  }) {
    const { 
      processEnvVars,
      envVariables, 
      globalEnvironmentVariables, 
      oauth2CredentialVariables, 
      collectionVariables, 
      folderVariables, 
      requestVariables,
      runtimeVariables
    } = variables;
    const bru = new Bru(envVariables, runtimeVariables, processEnvVars, collectionPath, collectionVariables, folderVariables, requestVariables, globalEnvironmentVariables, oauth2CredentialVariables, collectionName);
    const req = new BrunoRequest(request);

    // extend bru with result getter methods
    const { __brunoTestResults, test } = createBruTestResultMethods(bru, assertionResults, chai);

    const context = {
      bru,
      req,
      test,
      expect: chai.expect,
      assert: chai.assert,
      __brunoTestResults: __brunoTestResults
    };

    if (response) {
      const res = new BrunoResponse(response);
      context.res = res;
    }

    if (onConsoleLog && typeof onConsoleLog === 'function') {
      const customLogger = (type) => {
        return (...args) => {
          onConsoleLog(type, cleanJson(args));
        };
      };
      context.console = {
        log: customLogger('log'),
        debug: customLogger('debug'),
        info: customLogger('info'),
        warn: customLogger('warn'),
        error: customLogger('error')
      };
    }

    if (runRequestByItemPathname) {
      context.bru.runRequest = runRequestByItemPathname;
    }

      await executeQuickJsVmAsync({
        script: script,
        context: context,
        collectionPath
      });

      return {
        request,
        envVariables: cleanJson(envVariables),
        runtimeVariables: cleanJson(runtimeVariables),
        globalEnvironmentVariables: cleanJson(globalEnvironmentVariables),
        results: cleanJson(__brunoTestResults.getResults()),
        nextRequestName: bru.nextRequest,
        skipRequest: bru.skipRequest,
        stopExecution: bru.stopExecution
      };
  }
}

module.exports = ScriptRuntime;
