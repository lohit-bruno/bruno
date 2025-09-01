const chalk = require('chalk');
const { ScriptRuntime } = require('@usebruno/js');

/**
 * Creates a failure execution context with all necessary parameters
 * @param {Object} params - Parameters for creating the context
 * @returns {Object} - The failure execution context
 */
const createFailureExecutionContext = ({
  envVars,
  runtimeVariables,
  collectionPath,
  collection,
  processEnvVars,
  scriptingConfig,
  runSingleRequestByPathname,
  onConsoleLog
}) => {
  return {
    envVars: envVars || {},
    runtimeVariables: runtimeVariables || {},
    collectionPath,
    collection,
    processEnvVars: processEnvVars || {},
    scriptingConfig: scriptingConfig || {},
    runSingleRequestByPathname,
    collectionName: collection?.brunoConfig?.name,
    onConsoleLog: onConsoleLog || (() => {})
  };
};

/**
 * Serializes an error object for safe transmission to script runtime
 * Only includes safe properties to avoid circular references and sensitive data
 */
const serializeErrorForScript = (error) => {
  return {
    message: error.message || 'Unknown error occurred',
    name: error.name || 'Error',
    code: error.code,
    status: error.status,
    statusText: error.statusText,
    // Include additional properties that might be useful for debugging
    errno: error.errno,
    syscall: error.syscall,
    hostname: error.hostname,
    port: error.port
  };
};

/**
 * Creates the onFail handler script wrapper
 * @param {Function} handlerFunction - The original onFail handler function
 * @param {Object} serializedError - The serialized error object
 * @returns {string} - The script to execute
 */
const createOnFailHandlerScript = (handlerFunction, serializedError) => {
  return `
    // Execute the original onFail handler with the error
    const originalHandler = ${handlerFunction.toString()};
    const error = ${JSON.stringify(serializedError)};
    
    try {
      await originalHandler(error);
    } catch (handlerError) {
      // Rethrow handler errors so they can be caught by the outer try-catch
      throw new Error('Handler execution failed: ' + (handlerError.message || handlerError));
    }
  `;
};

/**
 * Executes the custom error handler if it exists on the request
 * This function is specifically designed for handling request failures and executing
 * the onFailHandler defined in Bruno request configurations.
 * 
 * @param {Object} request - The request object that may contain an onFailHandler
 * @param {Error} error - The error that occurred during request execution
 * @param {Object} context - Failure execution context containing necessary parameters
 * @param {Object} context.envVars - Environment variables
 * @param {Object} context.runtimeVariables - Runtime variables
 * @param {string} context.collectionPath - Path to the collection
 * @param {Object} context.scriptingConfig - Scripting configuration
 * @param {Function} context.runSingleRequestByPathname - Function to run other requests
 * @param {string} context.collectionName - Name of the collection
 * @param {Function} [context.onConsoleLog] - Console log handler
 * @param {Object} [context.processEnvVars] - Process environment variables
 * @returns {Object|null} - Returns script execution result with test results, nextRequestName, etc., or null if no handler
 */
const executeRequestOnFailHandler = async (request, error, context) => {
  if (!request || typeof request.onFailHandler !== 'function') {
    return null;
  }

  const serializedError = serializeErrorForScript(error);
  const onFailScript = createOnFailHandlerScript(request.onFailHandler, serializedError);

  try {
    console.log(chalk.yellow('Executing onFail handler for request failure...'));

    // Create script runtime specifically for failure handler execution
    const scriptRuntime = new ScriptRuntime({ runtime: context.scriptingConfig?.runtime });
    
    const result = await scriptRuntime.runRequestScript(
      onFailScript,
      request,
      context.envVars || {},
      context.runtimeVariables || {},
      context.collectionPath,
      context.onConsoleLog || (() => {}),
      context.processEnvVars || {},
      context.scriptingConfig || {},
      context.runSingleRequestByPathname,
      context.collectionName
    );

    console.log(chalk.green('onFail handler executed successfully'));
    return result;

  } catch (handlerError) {
    console.error(chalk.red('Error executing onFail handler:'), handlerError.message || handlerError);
    
    // Enhance the original error message to include handler error details
    // This helps users understand both the original failure and the handler failure
    const originalMessage = error.message || 'Error occurred while executing the request';
    const handlerMessage = handlerError.message || 'Unknown error in onFail handler';
    error.message = `Request Failure: ${originalMessage}\nHandler Failure: ${handlerMessage}`;
    
    return null;
  }
};

module.exports = {
  executeRequestOnFailHandler,
  createFailureExecutionContext
};
