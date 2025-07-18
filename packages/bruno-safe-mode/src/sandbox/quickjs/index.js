import addBruShimToContext from './shims/bru.js';
import addBrunoRequestShimToContext from './shims/bruno-request.js';
import addConsoleShimToContext from './shims/console.js';
import addBrunoResponseShimToContext from './shims/bruno-response.js';
import addTestShimToContext from './shims/test.js';
import addLibraryShimsToContext from './shims/lib/index.js';
import addLocalModuleLoaderShimToContext from './shims/local-module.js';
import { newQuickJSWASMModule, memoizePromiseFactory } from 'quickjs-emscripten';

// execute `npm run sandbox:bundle-libraries` if the below file doesn't exist
import getBundledCode from '../bundle-browser-rollup.js';
import addPathShimToContext from './shims/lib/path.js';
import { marshallToVm } from './utils/index.js';

let QuickJSSyncContext;
const loader = memoizePromiseFactory(() => newQuickJSWASMModule());
const getContext = (opts) => loader().then((mod) => (QuickJSSyncContext = mod.newContext(opts)));
getContext();

const toNumber = (value) => {
  const num = Number(value);
  return Number.isInteger(num) ? parseInt(value, 10) : parseFloat(value);
};

const removeQuotes = (str) => {
  if ((str.startsWith('"') && str.endsWith('"')) || (str.startsWith("'") && str.endsWith("'"))) {
    return str.slice(1, -1);
  }
  return str;
};

const executeQuickJsVm = ({ script: externalScript, context: externalContext, scriptType = 'template-literal' }) => {
  if (!externalScript?.length || typeof externalScript !== 'string') {
    return externalScript;
  }
  externalScript = externalScript?.trim();

  if(scriptType === 'template-literal') {
    if (!isNaN(Number(externalScript))) {
      const number = Number(externalScript);

      // Check if the number is too high. Too high number might get altered, see #1000
      if (number > Number.MAX_SAFE_INTEGER) {
        return externalScript;
      }

      return toNumber(externalScript);
    }

    if (externalScript === 'true') return true;
    if (externalScript === 'false') return false;
    if (externalScript === 'null') return null;
    if (externalScript === 'undefined') return undefined;

    externalScript = removeQuotes(externalScript);
  }

  const vm = QuickJSSyncContext;

  try {
    const { bru, req, res, ...variables } = externalContext;

    bru && addBruShimToContext(vm, bru);
    req && addBrunoRequestShimToContext(vm, req);
    res && addBrunoResponseShimToContext(vm, res);

    Object.entries(variables)?.forEach(([key, value]) => {
      vm.setProp(vm.global, key, marshallToVm(value, vm));
    });

    const templateLiteralText = `\`${externalScript}\``;
    const jsExpressionText = `${externalScript}`;

    let scriptText = scriptType === 'template-literal' ? templateLiteralText : jsExpressionText;

    const result = vm.evalCode(scriptText);
    if (result.error) {
      let e = vm.dump(result.error);
      result.error.dispose();
      return e;
    } else {
      let v = vm.dump(result.value);
      result.value.dispose();
      return v;
    }
  } catch (error) {
    console.error('Error executing the script!', error);
  }
};

const executeQuickJsVmAsync = async ({ script: externalScript, context: externalContext, collectionPath }) => {
  console.log("hererererer     ");
  if (!externalScript?.length || typeof externalScript !== 'string') {
    return externalScript;
  }
  externalScript = externalScript?.trim();

  try {
    const module = await newQuickJSWASMModule();
    const vm = module.newContext();

    const bundledCode = getBundledCode?.toString() || '';
    const moduleLoaderCode = function () {
      return `
        globalThis.require = (mod) => {
          let lib = globalThis.requireObject[mod];
          let isModuleAPath = (module) => (module?.startsWith('.') || module?.startsWith?.(bru.cwd()))
          if (lib) {
            return lib;
          }
          else if (isModuleAPath(mod)) {
            // fetch local module
            let localModuleCode = globalThis.__brunoLoadLocalModule(mod);

            // compile local module as iife
            (function (){
              const initModuleExportsCode = "const module = { exports: {} };"
              const copyModuleExportsCode = "\\n;globalThis.requireObject[mod] = module.exports;";
              const patchedRequire = ${`
                "\\n;" +
                "let require = (subModule) => isModuleAPath(subModule) ? globalThis.require(path.resolve(bru.cwd(), mod, '..', subModule)) : globalThis.require(subModule)" +
                "\\n;" 
              `}
              eval(initModuleExportsCode + patchedRequire + localModuleCode + copyModuleExportsCode);
            })();

            // resolve module
            return globalThis.requireObject[mod];
          }
          else {
            throw new Error("Cannot find module " + mod);
          }
        }
      `;
    };

    vm.evalCode(
      `
        (${bundledCode})()
        ${moduleLoaderCode()}
      `
    );

    const { bru, req, res, test, __brunoTestResults, console: consoleFn } = externalContext;
    
    const sleep = vm.newFunction('sleep', (timer) => {
      const t = vm.getString(timer);
      const promise = vm.newPromise();
      setTimeout(() => {
        promise.resolve(vm.newString('slept'));
      }, t);
      promise.settled.then(vm.runtime.executePendingJobs);
      return promise.handle;
    });
    sleep.consume((handle) => vm.setProp(vm.global, 'sleep', handle));
    
    consoleFn && addConsoleShimToContext(vm, consoleFn);
    bru && addBruShimToContext(vm, bru);
    req && addBrunoRequestShimToContext(vm, req);
    res && addBrunoResponseShimToContext(vm, res);
    addLocalModuleLoaderShimToContext(vm, collectionPath);
    addPathShimToContext(vm);

    await addLibraryShimsToContext(vm);

    test && __brunoTestResults && addTestShimToContext(vm, __brunoTestResults);

    const script = `
      (async () => {
        const setTimeout = async (fn, timer) => {
          v = await sleep(timer);
          fn.apply();
        }
        await sleep(0);
        try {
          ${externalScript}
        }
        catch(error) {
          console?.debug?.('quick-js:execution-end:with-error', error?.message);
          throw new Error(error?.message);
        }
        return 'done';
      })()
    `;
    const _result = vm.evalCode(script);
    const promiseHandle = vm.unwrapResult(_result);
    const resolvedResult = await vm.resolvePromise(promiseHandle);
    promiseHandle.dispose();
    const resolvedHandle = vm.unwrapResult(resolvedResult);
    resolvedHandle.dispose();
    return;
  } catch (error) {
    console.error('Error executing the script!', error);
    throw new Error(error);
  }
};

export {
  executeQuickJsVm,
  executeQuickJsVmAsync
};
