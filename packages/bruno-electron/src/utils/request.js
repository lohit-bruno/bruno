const { uuid } = require('./common');

const runWorkflowRequest = async ({ item, collection, variables, uid, runInBackground = false }) => {
  const { envVars, processEnvVars, runtimeVariables } = variables
  const { uid: collectionUid, pathname: collectionPath } = collection;

  const cancelTokenUid = uuid();
  const requestUid = uuid();

  const runRequestByItemPathname = async (relativeItemPathname) => {
    return new Promise(async (resolve, reject) => {
      let itemPathname = path.join(collection?.pathname, relativeItemPathname);
      if (itemPathname && !itemPathname?.endsWith('.bru')) {
        itemPathname = `${itemPathname}.bru`;
      }
      const _item = cloneDeep(findItemInCollectionByPathname(collection, itemPathname));
      if(_item) {
        const res = await runWorkflowRequest({ item: _item, collection, variables, uid, runInBackground: true });
        resolve(res);
      }
      reject(`bru.runRequest: invalid request path - ${itemPathname}`);
    });
  }

  !runInBackground && mainWindow.webContents.send('main:run-workflow-request-event', {
    type: 'request-queued',
    requestUid,
    collectionUid,
    itemUid: item.uid,
    workflowNodeUid: uid,
    cancelTokenUid
  });

  const abortController = new AbortController();

  const request = await prepareRequest(item, collection, abortController);

  request.__bruno__executionMode = 'workflow';

  const brunoConfig = getBrunoConfig(collectionUid);

  const scriptingConfig = get(brunoConfig, 'scripts', {});

  scriptingConfig.runtime = getJsSandboxRuntime(collection);

  try {
    request.signal = abortController.signal;
    saveCancelToken(cancelTokenUid, abortController);

    
    try {
      await runPreRequest(
        request,
        requestUid,
        envVars,
        collectionPath,
        collection,
        collectionUid,
        runtimeVariables,
        processEnvVars,
        scriptingConfig,
        runRequestByItemPathname
      );

      !runInBackground && mainWindow.webContents.send('main:run-workflow-request-event', {
        type: 'pre-request-script-execution',
        requestUid,
        collectionUid,
        itemUid: item.uid,
        workflowNodeUid: uid,
        errorMessage: null,
      });

    } catch (error) {
      !runInBackground && mainWindow.webContents.send('main:run-workflow-request-event', {
        type: 'pre-request-script-execution',
        requestUid,
        collectionUid,
        itemUid: item.uid,
        workflowNodeUid: uid,
        errorMessage: error?.message || 'An error occurred in pre-request script',
      });
      return Promise.reject(error);
    }
    const axiosInstance = await configureRequest(
      collectionUid,
      request,
      envVars,
      runtimeVariables,
      processEnvVars,
      collectionPath
    );

    const { data: requestData, dataBuffer: requestDataBuffer } = parseDataFromRequest(request);
    let requestSent = {
      url: request.url,
      method: request.method,
      headers: request.headers,
      data: requestData,
      dataBuffer: requestDataBuffer
    }

    !runInBackground && mainWindow.webContents.send('main:run-workflow-request-event', {
      type: 'request-sent',
      requestSent,
      collectionUid,
      itemUid: item.uid,
      workflowNodeUid: uid,
      requestUid,
      cancelTokenUid
    });

    if (request?.oauth2Credentials) {
      mainWindow.webContents.send('main:credentials-update', {
        credentials: request?.oauth2Credentials?.credentials,
        url: request?.oauth2Credentials?.url,
        collectionUid,
        credentialsId: request?.oauth2Credentials?.credentialsId,
        ...(request?.oauth2Credentials?.folderUid ? { folderUid: request.oauth2Credentials.folderUid } : { itemUid: item.uid }),
        debugInfo: request?.oauth2Credentials?.debugInfo,
      });
    }

    let response, responseTime;
    try {
      /** @type {import('axios').AxiosResponse} */
      response = await axiosInstance(request);

      // Prevents the duration on leaking to the actual result
      responseTime = response.headers.get('request-duration');
      response.headers.delete('request-duration');
    } catch (error) {
      deleteCancelToken(cancelTokenUid);

      // if it's a cancel request, don't continue
      if (axios.isCancel(error)) {
        // we are not rejecting the promise here and instead returning a response object with `error` which is handled in the `send-http-request` invocation
        // timeline prop won't be accessible in the usual way in the renderer process if we reject the promise
        return {
          statusText: 'REQUEST_CANCELLED',
          isCancel: true,
          error: 'REQUEST_CANCELLED',
          timeline: error.timeline
        };
      }

      if (error?.response) {
        response = error.response;

        // Prevents the duration on leaking to the actual result
        responseTime = response.headers.get('request-duration');
        response.headers.delete('request-duration');
      } else {
        // if it's not a network error, don't continue
        // we are not rejecting the promise here and instead returning a response object with `error` which is handled in the `send-http-request` invocation
        // timeline prop won't be accessible in the usual way in the renderer process if we reject the promise
        return {
          statusText: error.statusText,
          error: error.message,
          timeline: error.timeline
        }
      }
    }

    // Continue with the rest of the request lifecycle - post response vars, script, assertions, tests

    const { data, dataBuffer } = parseDataFromResponse(response, request.__brunoDisableParsingResponseJson);
    response.data = data;

    response.responseTime = responseTime;

    // save cookies
    if (preferencesUtil.shouldStoreCookies()) {
      saveCookies(request.url, response.headers);
    }

    // send domain cookies to renderer
    const domainsWithCookies = await getDomainsWithCookies();

    mainWindow.webContents.send('main:cookies-update', safeParseJSON(safeStringifyJSON(domainsWithCookies)));

    try {
      await runPostResponse(
        request,
        response,
        requestUid,
        envVars,
        collectionPath,
        collection,
        collectionUid,
        runtimeVariables,
        processEnvVars,
        scriptingConfig,
        runRequestByItemPathname
      );
      !runInBackground && mainWindow.webContents.send('main:run-workflow-request-event', {
        type: 'post-response-script-execution',
        requestUid,
        collectionUid,
        errorMessage: null,
        itemUid: item.uid,
        workflowNodeUid: uid,
      });
    } catch (error) {
      console.error('Post-response script error:', error);

      // Format a more readable error message
      const errorMessage = error?.message || 'An error occurred in post-response script';

      !runInBackground && mainWindow.webContents.send('main:run-workflow-request-event', {
        type: 'post-response-script-execution',
        requestUid,
        errorMessage,
        collectionUid,
        itemUid: item.uid,
        workflowNodeUid: uid,
      });
    }

    // run assertions
    const assertions = get(request, 'assertions');
    if (assertions) {
      const assertRuntime = new AssertRuntime({ runtime: scriptingConfig?.runtime });
      const results = assertRuntime.runAssertions(
        assertions,
        request,
        response,
        envVars,
        runtimeVariables,
        processEnvVars
      );

      !runInBackground && mainWindow.webContents.send('main:run-workflow-request-event', {
        type: 'assertion-results',
        results: results,
        itemUid: item.uid,
        requestUid,
        collectionUid,
        workflowNodeUid: uid,
      });
    }

    const testFile = get(request, 'tests');
    if (typeof testFile === 'string') {
      const testRuntime = new TestRuntime({ runtime: scriptingConfig?.runtime });
      const testResults = await testRuntime.runTests(
        decomment(testFile),
        request,
        response,
        envVars,
        runtimeVariables,
        collectionPath,
        onConsoleLog,
        processEnvVars,
        scriptingConfig,
        runRequestByItemPathname
      );

      !runInBackground && mainWindow.webContents.send('main:run-workflow-request-event', {
        type: 'test-results',
        results: testResults.results,
        itemUid: item.uid,
        requestUid,
        collectionUid,
        workflowNodeUid: uid,
      });

      mainWindow.webContents.send('main:script-environment-update', {
        envVariables: testResults.envVariables,
        runtimeVariables: testResults.runtimeVariables,
        requestUid,
        collectionUid,
        workflowNodeUid: uid,
      });

      mainWindow.webContents.send('main:global-environment-variables-update', {
        globalEnvironmentVariables: testResults.globalEnvironmentVariables
      });

      collection.globalEnvironmentVariables = testResults.globalEnvironmentVariables;
    }

    return {
      status: response.status,
      statusText: response.statusText,
      headers: response.headers,
      data: response.data,
      dataBuffer: dataBuffer.toString('base64'),
      size: Buffer.byteLength(dataBuffer),
      duration: responseTime ?? 0,
      timeline: response.timeline
    };
  } catch (error) {
    deleteCancelToken(cancelTokenUid);

    // we are not rejecting the promise here and instead returning a response object with `error` which is handled in the `send-http-request` invocation
    // timeline prop won't be accessible in the usual way in the renderer process if we reject the promise
    return {
      status: error?.status,
      error: error?.message || 'an error ocurred: debug',
      timeline: error?.timeline
    };
  }
}