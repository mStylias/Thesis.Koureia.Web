/** Production values, substituted for `environment.ts` at build time. */
export const environment = {
  production: true,

  /**
   * Empty means same-origin: URLs come out as `/api/v1/...`, so there is no CORS exchange
   * and no origin to keep in step. Giving the API its own hostname means setting it here
   * *and* adding that origin to the API's CORS allowlist; doing one without the other
   * fails in the browser in a way that does not look like a config mistake.
   */
  apiUrl: '',
} as const;
