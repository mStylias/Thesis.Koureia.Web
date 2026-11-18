/**
 * Development values. Replaced by `environment.prod.ts` in the production build
 * (`fileReplacements` in `apps/koureia/project.json`).
 */
export const environment = {
  production: false,

  /**
   * The API must list this app's dev origin (6100) in its CORS allowlist. An unlisted
   * origin fails in the browser as a status-0 network error, with nothing in the API log.
   */
  apiUrl: 'http://localhost:7000',
} as const;
