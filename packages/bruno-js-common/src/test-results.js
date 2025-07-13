import { nanoid } from 'nanoid';

class TestResults {
  constructor() {
    this.results = [];
  }

  addResult(result) {
    result.uid = nanoid();
    this.results.push(result);
  }

  getResults() {
    return this.results;
  }
}

export default TestResults;
