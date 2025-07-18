import { nodeResolve } from '@rollup/plugin-node-resolve';
import commonjs from '@rollup/plugin-commonjs';
import { terser } from 'rollup-plugin-terser';
import peerDepsExternal from 'rollup-plugin-peer-deps-external';
import json from '@rollup/plugin-json';
import { readFileSync } from 'fs';

const packageJson = JSON.parse(readFileSync('./package.json', 'utf8'));

export default [
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