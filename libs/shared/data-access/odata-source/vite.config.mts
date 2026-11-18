/// <reference types='vitest' />
import { defineConfig } from 'vite';
import { nxViteTsPaths } from '@nx/vite/plugins/nx-tsconfig-paths.plugin';
import { nxCopyAssetsPlugin } from '@nx/vite/plugins/nx-copy-assets.plugin';

// No Angular plugin and no jsdom: this lib builds query strings and adapts a fetch the app
// supplies. It never touches the DOM and never calls Angular.
export default defineConfig(() => ({
  root: __dirname,
  cacheDir: '../../../../node_modules/.vite/libs/shared/data-access/odata-source',
  plugins: [nxViteTsPaths(), nxCopyAssetsPlugin(['*.md'])],
  test: {
    name: 'shared-data-access-odata-source',
    watch: false,
    // Nx runs six projects at once (nx.json), so each one takes a fifth of the cores.
    maxWorkers: '20%',
    globals: true,
    environment: 'node',
    include: ['{src,tests}/**/*.{test,spec}.{js,mjs,cjs,ts,mts,cts,jsx,tsx}'],
    reporters: ['default'],
    coverage: {
      reportsDirectory: '../../../../coverage/libs/shared/data-access/odata-source',
      provider: 'v8' as const,
    },
  },
}));
