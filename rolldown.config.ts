import {defineConfig} from 'rolldown'

export default defineConfig({
  input: ['src/index.ts', 'src/runtime/inject.ts', 'src/runtime/adapters/*.ts'],
  output: {
    dir: 'dist',
    format: 'esm',
  },
});
