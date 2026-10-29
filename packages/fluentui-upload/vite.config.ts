import { defineConfig } from 'vite';

/**
 * Emit per-module ESM so consumers import only the upload component. React,
 * Fluent UI and the component library are peers and must stay external to
 * preserve one React and one Griffel instance.
 */
export default defineConfig({
  build: {
    lib: {
      entry: 'src/index.ts',
      formats: ['es'],
    },
    sourcemap: true,
    rollupOptions: {
      external: [
        /^react($|\/)/,
        /^react-dom($|\/)/,
        /^@fluentui\//,
        /^@blendsdk\/upload-/,
        /^@blendsdk\/fluentui-react-components($|\/)/,
        /^react-dropzone($|\/)/,
      ],
      output: {
        preserveModules: true,
        preserveModulesRoot: 'src',
        entryFileNames: '[name].js',
        chunkFileNames: '[name].js',
      },
    },
  },
});
