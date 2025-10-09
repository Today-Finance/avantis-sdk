import typescript from '@rollup/plugin-typescript';
import resolve from '@rollup/plugin-node-resolve';
import commonjs from '@rollup/plugin-commonjs';
import json from '@rollup/plugin-json';
import dts from 'rollup-plugin-dts';

const external = [
  'viem',
  'viem/accounts',
  'viem/chains',
  'decimal.js',
  'axios',
  'ws',
  'isomorphic-ws',
  'eventemitter3',
  'zod',
  'crypto',
  'buffer',
  'stream',
  'util',
  'events'
];

export default [
  // CommonJS build
  {
    input: 'src/index.ts',
    output: {
      file: 'dist/index.js',
      format: 'cjs',
      sourcemap: true,
      exports: 'named'
    },
    plugins: [
      resolve({
        preferBuiltins: true,
        browser: false
      }),
      commonjs(),
      json(),
      typescript({
        tsconfig: './tsconfig.json',
        declaration: false,
        declarationMap: false
      })
    ],
    external
  },
  // ESM build
  {
    input: 'src/index.ts',
    output: {
      file: 'dist/index.mjs',
      format: 'esm',
      sourcemap: true
    },
    plugins: [
      resolve({
        preferBuiltins: true,
        browser: false
      }),
      commonjs(),
      json(),
      typescript({
        tsconfig: './tsconfig.json',
        declaration: false,
        declarationMap: false
      })
    ],
    external
  },
  // Type declarations
  {
    input: 'src/index.ts',
    output: [
      {
        file: 'dist/index.d.ts',
        format: 'es'
      },
      {
        file: 'dist/index.d.mts',
        format: 'es'
      }
    ],
    plugins: [dts()],
    external
  }
];