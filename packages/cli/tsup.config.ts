import { defineConfig } from 'tsup'

export default defineConfig({
  entry: ['src/index.tsx'],
  format: ['esm'],
  outDir: 'dist',
  target: 'node18',
  sourcemap: true,
  clean: true,
  jsx: 'react-jsx',
})
