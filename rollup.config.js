import typescript from '@rollup/plugin-typescript';
import { createFilter } from '@rollup/pluginutils';

function blobLoader(options = {}) {
  const filter = createFilter(
    options.include || '**/*.blob.js', // Default to `.blob.js` files
    options.exclude || 'node_modules/**'
  );

  return {
    name: 'blob-loader',
    transform(code, id) {
      if (!filter(id)) return null;

      const blobContent = JSON.stringify(code);
      const result = `
        const blob = new Blob([${blobContent}], { type: 'application/javascript' });
        export default URL.createObjectURL(blob);
      `;

      return {
        code: result,
        map: { mappings: '' }
      };
    }
  };
}

export default {
  input: 'src/index.ts',
  output: {
    file: 'dist/index.js',
    // format: 'umd', // UMD format for browser and Node.js compatibility
    // name: 'MicKitInput', // Global variable name for the browser
    sourcemap: true,
  },
  plugins: [
    typescript({
      tsconfig: './tsconfig.json'
    }),
    blobLoader()
  ]
};
