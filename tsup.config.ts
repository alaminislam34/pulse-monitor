import { defineConfig } from 'tsup';

export default defineConfig({
  entry: ['src/index.ts'],
  format: ['cjs', 'esm'],
  dts: true,
  clean: false,
  minify: true,
  sourcemap: true,
  external: ['express', '@nestjs/common', '@nestjs/core'],
});
