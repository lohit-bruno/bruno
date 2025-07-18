import { executeQuickJsVmAsync } from '../sandbox/quickjs/index.js';

class ScriptRuntime {
  constructor(props) {
  }

  async runJs({
    script,
    context
  }) {
    console.log("run js", script);
    try {
      await executeQuickJsVmAsync({
        script: script,
        context: { console, ...context },
        collectionPath: './'
      });
    }
    catch(err) {
      console.log(err);
    }
  }
}

export default ScriptRuntime;
