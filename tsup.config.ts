import { defineConfig } from 'tsup';

export default defineConfig({
  entry: {
    index: 'src/index.ts',
    express: 'src/adapters/ExpressAdapter.ts',
    nestjs: 'src/adapters/NestJSAdapter.ts'
  },
  format: ['cjs', 'esm'],
  dts: true,
  clean: false,
  minify: true,
  sourcemap: true,
  external: ['express', '@nestjs/common', '@nestjs/core'],
});
