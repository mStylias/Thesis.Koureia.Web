/// <reference types='vitest' />
import angular from '@analogjs/vite-plugin-angular';
import { nxCopyAssetsPlugin } from '@nx/vite/plugins/nx-copy-assets.plugin';
import { nxViteTsPaths } from '@nx/vite/plugins/nx-tsconfig-paths.plugin';
import { defineConfig } from 'vite';

export default defineConfig(() => ({
  root: __dirname,
  cacheDir: '../../../../node_modules/.vite/libs/shared/ui/datetime-picker',
  plugins: [angular(), nxViteTsPaths(), nxCopyAssetsPlugin(['*.md'])],
  test: {
    name: 'shared-ui-datetime-picker',
    watch: false,
    // Nx runs six projects at once (nx.json), so each one takes a fifth of the cores.
    maxWorkers: '20%',
    globals: true,
    environment: 'jsdom',
    include: ['{src,tests}/**/*.{test,spec}.ts'],
    setupFiles: ['src/test-setup.ts'],
    reporters: ['default'],
    coverage: {
      reportsDirectory: '../../../../coverage/libs/shared/ui/datetime-picker',
      provider: 'v8' as const,
    },
  },
}));
