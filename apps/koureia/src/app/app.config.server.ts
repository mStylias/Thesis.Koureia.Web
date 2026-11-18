import { mergeApplicationConfig, ApplicationConfig } from '@angular/core';
import { provideServerRendering, withRoutes } from '@angular/ssr';
import { appConfig } from './app.config';
import { serverRoutes } from './app.routes.server';

/**
 * HTTP needs nothing here: `provideApi` works on both sides because `environment.apiUrl`
 * is absolute, and a server render has no document to resolve a relative URL against.
 * Override `SYNAX_API_CONFIG` here if SSR ever needs a host only the server can resolve.
 */
const serverConfig: ApplicationConfig = {
  providers: [provideServerRendering(withRoutes(serverRoutes))],
};

export const config = mergeApplicationConfig(appConfig, serverConfig);
