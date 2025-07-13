const { parentPort } = require('worker_threads');
const {
  bruToJsonV2,
  bruToJsonParsimmon,
} = require('@usebruno/lang');

parentPort.on('message', (workerData) => {
  try {
    const bru = workerData;
    const json = bruToJsonParsimmon(bru);
    parentPort.postMessage(json);
  }
  catch(error) {
    console.error(error);
    parentPort.postMessage({ error: error?.message });
  }
});