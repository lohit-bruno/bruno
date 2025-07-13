import { createRunRequestContext } from "./context";
import { 
  createHttpClient, 
  createRuntimeProvider, 
  runRequest,
  type BrunoHttpClient,
  type BrunoRuntimeProvider
} from "./runner";
import { 
  BrunoCollection, 
  BrunoItem, 
  BrunoRequest, 
  BrunoScriptRuntime,
  BrunoTestRuntime,
  BrunoAssertRuntime
} from "./types";

const makeRequest = async ({
  collection,
  item,
  envVariables = {},
  runtimeVariables = {},
  processEnvVariables = {}
}: {
  collection: BrunoCollection;
  item: BrunoItem;
  envVariables?: Record<string, any>;
  runtimeVariables?: Record<string, any>;
  processEnvVariables?: Record<string, any>;
}) => {

  console.log("make request -- -- ---------");

  const httpClient = createHttpClient();
  const runtimeProvider = createRuntimeProvider();

  const context = createRunRequestContext({
    collection,
    item,
    envVariables,
    runtimeVariables,
    processEnvVariables,
  });

  console.log(context);

  return await runRequest({ 
    context, 
    httpClient, 
    runtimeProvider,
    options: {
      collectionPath: collection.pathname
    }
  });
};

export { makeRequest };