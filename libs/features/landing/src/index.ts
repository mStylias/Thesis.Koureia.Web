export * from './lib.routes';

export * from './landing';

// The i18n contract an app must satisfy for the brand-bearing copy this
// library does not own.
export type { LandingBrandCopy } from './landing.i18n';
export { LANDING_BRAND_COPY_PREFIX } from './landing.i18n';
