const rollup = require('rollup');
const { nodeResolve } = require('@rollup/plugin-node-resolve');
const commonjs = require('@rollup/plugin-commonjs');
const fs = require('fs');
const { terser } = require('rollup-plugin-terser');

const bundleLibraries = async () => {
  const codeScript = `
    import { expect, assert } from 'chai';
    import { Buffer } from "buffer";
    import moment from "moment";
    import btoa from "btoa";
    import atob from "atob";
    import tv4 from "tv4";

    // @noble/ciphers sub-imports
    import * as nobleArx from '@noble/ciphers/_arx.js';
    import * as noblePoly1305 from '@noble/ciphers/_poly1305.js';
    import * as noblePolyval from '@noble/ciphers/_polyval.js';
    import * as nobleAes from '@noble/ciphers/aes.js';
    import * as nobleChacha from '@noble/ciphers/chacha.js';
    import * as nobleFf1 from '@noble/ciphers/ff1.js';
    import * as nobleSalsa from '@noble/ciphers/salsa.js';
    import * as nobleCipherUtils from '@noble/ciphers/utils.js';

    // @noble/hashes sub-imports
    import * as nobleSha2 from '@noble/hashes/sha2.js';
    import * as nobleSha3 from '@noble/hashes/sha3.js';
    import * as nobleSha3Addons from '@noble/hashes/sha3-addons.js';
    import * as nobleBlake3 from '@noble/hashes/blake3.js';
    import * as nobleBlake2 from '@noble/hashes/blake2.js';
    import * as nobleBlake1 from '@noble/hashes/blake1.js';
    import * as nobleHashesLegacy from '@noble/hashes/legacy.js';
    import * as nobleHmac from '@noble/hashes/hmac.js';
    import * as nobleHkdf from '@noble/hashes/hkdf.js';
    import * as noblePbkdf2 from '@noble/hashes/pbkdf2.js';
    import * as nobleScrypt from '@noble/hashes/scrypt.js';
    import * as nobleArgon2 from '@noble/hashes/argon2.js';
    import * as nobleHashedUtils from '@noble/hashes/utils.js';

    globalThis.expect = expect;
    globalThis.assert = assert;
    globalThis.moment = moment;
    globalThis.btoa = btoa;
    globalThis.atob = atob;
    globalThis.Buffer = Buffer;
    globalThis.tv4 = tv4;
    globalThis.requireObject = {
      ...(globalThis.requireObject || {}),
      'chai': { expect, assert },
      'moment': moment,
      'buffer': { Buffer },
      'btoa': btoa,
      'atob': atob,
      'tv4': tv4,
      '@noble/ciphers/_arx.js': nobleArx,
      '@noble/ciphers/_arx': nobleArx,
      '@noble/ciphers/_poly1305.js': noblePoly1305,
      '@noble/ciphers/_poly1305': noblePoly1305,
      '@noble/ciphers/_polyval.js': noblePolyval,
      '@noble/ciphers/_polyval': noblePolyval,
      '@noble/ciphers/aes.js': nobleAes,
      '@noble/ciphers/aes': nobleAes,
      '@noble/ciphers/chacha.js': nobleChacha,
      '@noble/ciphers/chacha': nobleChacha,
      '@noble/ciphers/ff1.js': nobleFf1,
      '@noble/ciphers/ff1': nobleFf1,
      '@noble/ciphers/salsa.js': nobleSalsa,
      '@noble/ciphers/salsa': nobleSalsa,
      '@noble/ciphers/utils.js': nobleCipherUtils,
      '@noble/ciphers/utils': nobleCipherUtils,
      '@noble/hashes/sha2.js': nobleSha2,
      '@noble/hashes/sha2': nobleSha2,
      '@noble/hashes/sha3.js': nobleSha3,
      '@noble/hashes/sha3': nobleSha3,
      '@noble/hashes/sha3-addons.js': nobleSha3Addons,
      '@noble/hashes/sha3-addons': nobleSha3Addons,
      '@noble/hashes/blake3.js': nobleBlake3,
      '@noble/hashes/blake3': nobleBlake3,
      '@noble/hashes/blake2.js': nobleBlake2,
      '@noble/hashes/blake2': nobleBlake2,
      '@noble/hashes/blake1.js': nobleBlake1,
      '@noble/hashes/blake1': nobleBlake1,
      '@noble/hashes/legacy.js': nobleHashesLegacy,
      '@noble/hashes/legacy': nobleHashesLegacy,
      '@noble/hashes/hmac.js': nobleHmac,
      '@noble/hashes/hmac': nobleHmac,
      '@noble/hashes/hkdf.js': nobleHkdf,
      '@noble/hashes/hkdf': nobleHkdf,
      '@noble/hashes/pbkdf2.js': noblePbkdf2,
      '@noble/hashes/pbkdf2': noblePbkdf2,
      '@noble/hashes/scrypt.js': nobleScrypt,
      '@noble/hashes/scrypt': nobleScrypt,
      '@noble/hashes/argon2.js': nobleArgon2,
      '@noble/hashes/argon2': nobleArgon2
    };
`;

  const config = {
    input: {
      input: 'inline-code',
      plugins: [
        {
          name: 'inline-code-plugin',
          resolveId(id) {
            if (id === 'inline-code') {
              return id;
            }
            return null;
          },
          load(id) {
            if (id === 'inline-code') {
              return codeScript;
            }
            return null;
          }
        },
        nodeResolve({
          preferBuiltins: false,
          browser: false
        }),
        commonjs(),
        terser()
      ]
    },
    output: {
      file: './src/sandbox/bundle-browser-rollup.js',
      format: 'iife',
      name: 'MyBundle'
    }
  };

  try {
    const bundle = await rollup.rollup(config.input);
    const { output } = await bundle.generate(config.output);
    fs.writeFileSync(
      './src/sandbox/bundle-browser-rollup.js',
      `
      const getBundledCode = () => {
        return function(){
          ${output?.map((o) => o.code).join('\n')}
        }()
      }
      module.exports = getBundledCode;
    `
    );
  } catch (error) {
    console.error('Error while bundling:', error);
  }
};

bundleLibraries();

module.exports = bundleLibraries;
