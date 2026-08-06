import { defineConfig } from 'tsup';

/**
 * A CommonJS bundle alongside the normal ESM build, purely so the CLI can be compiled into a single
 * native executable: both @yao-pkg/pkg and Node's SEA support require CJS. ESM-only dependencies
 * (chalk) get bundled and down-levelled, so `noExternal` has to cover everything.
 *
 * Not the package entry point - `main`/`bin` still point at the ESM build.
 */
export default defineConfig({
  entry: { cli: 'src/index.ts' },
  outDir: 'dist-cjs',
  format: ['cjs'],
  target: 'node22',
  dts: false,
  clean: true,
  sourcemap: false,
  noExternal: [/.*/],
});
