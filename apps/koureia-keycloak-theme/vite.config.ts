import angular from '@analogjs/vite-plugin-angular';
import { keycloakify } from 'keycloakify/vite-plugin';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vite';

const projectRoot = fileURLToPath(new URL('.', import.meta.url));

export default defineConfig({
  root: projectRoot,
  build: {
    outDir: '../../dist/apps/koureia-keycloak-theme',
    target: ['es2022'],
  },
  css: {
    preprocessorOptions: {
      scss: {
        loadPaths: [resolve(projectRoot, '../../libs/shared/styles/src')],
      },
    },
  },
  resolve: {
    mainFields: ['module'],
    tsconfigPaths: true,
  },
  plugins: [
    angular(),
    keycloakify({
      accountThemeImplementation: 'none',
      themeName: 'koureia',
      // The type requires both ranges. `false` builds no jar for Keycloak 22 to 25.
      keycloakVersionTargets: {
        '22-to-25': false,
        'all-other-versions': 'koureia-keycloak-theme.jar',
      },
      environmentVariables: [
        {
          name: 'KOUREIA_APP_URL',
          default: 'http://localhost:6100',
        },
      ],
    }),
  ],
});
