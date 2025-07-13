const fs = require('fs');
const path = require('path');
const bruToJson = require('../src/bruToJson');
const jsonToBru = require('../src/jsonToBru');
// const bruToJsonChevrotain = require('../src/bruToJsonChevrotain');
const bruToJsonParsimmon = require('../src/bruToJsonParsimmon');

describe('bruToJson', () => {
  it('should parse the bru file', () => {
    const input = fs.readFileSync(path.join(__dirname, 'fixtures', 'request.bru'), 'utf8');
    const expected = require('./fixtures/request.json');
    const output = bruToJson(input);

    expect(output).toEqual(expected);
  });
});

describe('jsonToBru', () => {
  it('should parse the json file', () => {
    const input = require('./fixtures/request.json');
    const expected = fs.readFileSync(path.join(__dirname, 'fixtures', 'request.bru'), 'utf8');
    const output = jsonToBru(input);

    expect(output).toEqual(expected);
  });
});

// describe('bruToJsonChevrotain', () => {
//   it('should parse the bru file', () => {
//     const input = fs.readFileSync(path.join(__dirname, 'fixtures', 'request.bru'), 'utf8');
//     const expected = require('./fixtures/request.json');
//     const output = bruToJsonChevrotain(input);
//     expect(output).toEqual(expected);
//   });
// });

describe('bruToJsonParsimmon', () => {
  it('should parse the bru file 1', () => {
    const input = fs.readFileSync(path.join(__dirname, 'fixtures', 'request.bru'), 'utf8');
    const expected = require('./fixtures/request.json');
    const output = bruToJsonParsimmon(input);
    expect(output).toEqual(expected);
  });

  it('should parse the bru file 2', () => {
    let input = fs.readFileSync(path.join(__dirname, 'fixtures', 'request.bru'), 'utf8');
    const expected = require('./fixtures/request.json');
    input = `${input}
body:json {
  ${Array.from({length: 10000000}).map((_, idx) => idx).join('')}
}  

`
    const output = bruToJsonParsimmon(input);
    console.log(input.length);
    fs.writeFileSync('./input.txt', input, 'utf-8');
    fs.writeFileSync('./output.txt', JSON.stringify(output, null, 2), 'utf-8');
    expect(output).toEqual(``);
  });
});