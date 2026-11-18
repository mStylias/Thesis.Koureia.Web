import type { StorybookConfig } from '@storybook/angular';

const config: StorybookConfig = {
  // One Storybook for the whole design system: picks up stories from
  // every component library under libs/shared/ui/*.
  stories: ['../../*/src/**/*.@(mdx|stories.@(js|jsx|ts|tsx))'],
  addons: ['@storybook/addon-docs'],
  framework: {
    name: '@storybook/angular',
    options: {},
  },
  // Brand-neutral placeholders, NOT a tenant app's assets. This Storybook
  // documents the shared design system, so reaching into `apps/<brand>/public`
  // would pin every story to one brand's identity. Paths stay `/brand` and
  // `/images` so a story reads the same as production markup.
  staticDirs: [
    { from: '../src/assets/brand', to: '/brand' },
    { from: '../src/assets/images', to: '/images' },
  ],
};

export default config;

// To customize your webpack configuration you can use the webpackFinal field.
// Check https://storybook.js.org/docs/react/builders/webpack#extending-storybooks-webpack-config
// and https://nx.dev/recipes/storybook/custom-builder-configs
