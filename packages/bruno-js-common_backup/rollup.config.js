const { nodeResolve } = require('@rollup/plugin-node-resolve');
const commonjs = require('@rollup/plugin-commonjs');
const { terser } = require('rollup-plugin-terser');
const peerDepsExternal = require('rollup-plugin-peer-deps-external');
const json = require('@rollup/plugin-json');

const packageJson = require('./package.json');

module.exports = [
  {
    input: 'src/index.js',
    output: [
      {
        file: packageJson.main,
        format: 'cjs',
        sourcemap: true,
        exports: 'named',
        interop: 'auto'
      },
      {
        file: packageJson.module,
        format: 'esm',
        sourcemap: true,
        exports: 'named',
        interop: 'auto'
      }
    ],
    plugins: [
      peerDepsExternal(),
      nodeResolve({
        extensions: ['.js', '.json'],
        browser: true, // Prefer browser-compatible versions
        preferBuiltins: false // Don't prefer Node.js built-ins
      }),
      // commonjs({
      //   requireReturnsDefault: 'auto' // Handle CommonJS modules properly
      // }),
      json(),
      terser()
    ],
    external: [
      // Keep large dependencies external
      'quickjs-emscripten',
      'axios',
      'crypto-js',
      'cheerio',
      'xml2js',
      'lodash',
      'moment',
      'uuid',
      'nanoid',
      'chai',
      'chai-string',
      'tv4',
      'ajv',
      'ajv-formats',
      'json-query',
      '@usebruno/common',
      '@usebruno/query',
      '@usebruno/crypto-js',
      '@usebruno/requests-common',
      '@usebruno/vm2',
      // Node.js built-ins
      'path',
      'fs',
      'util',
      'stream',
      'crypto',
      'os'
    ]
  }
]; 