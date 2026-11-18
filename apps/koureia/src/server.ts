import {
  AngularNodeAppEngine,
  createNodeRequestHandler,
  isMainModule,
  writeResponseToNodeResponse,
} from '@angular/ssr/node';
import express, { Request, RequestHandler } from 'express';
import { join } from 'node:path';
import type { AuthRequestContext } from '@auth/data-access';
import { createAuthRouter, readSession } from './auth/auth-routes';
import { redirectToCanonicalHost } from './canonical-host';
import {
  createRootNegotiation,
  createUnknownLanguageRewrite,
  redirectLegacyPaths,
  renderRobots,
  renderSitemap,
} from './language-routes';
import { createOpenIdAuthClient, loadAuthServerConfig } from './auth/openid-auth-client';
import { environment } from './environments/environment';
import { keepPersonalRenderPrivate } from './personal-render-cache';
import { createSitemapShops } from './sitemap-shops';
import {
  SessionCookieConfig,
  SessionPayload,
  loadSessionCookieKeyring,
  readSessionCookie,
} from './auth/session-cookie';

const browserDistFolder = join(import.meta.dirname, '../browser');

const app = express();
const angularApp = new AngularNodeAppEngine();
let authRouter: ReturnType<typeof createAuthRouter> | undefined;

app.use(redirectToCanonicalHost);

app.use('/auth', (request, response, next) => {
  try {
    getAuthRouter()(request, response, next);
  } catch (error) {
    next(error);
  }
});

/**
 * `/` is the one address with no language, so it is the one that decides per visitor. Answered
 * here and not by Angular, because the session cookie it reads is `HttpOnly`.
 */
app.get('/', createRootNegotiation({ sessionLanguage: readRequestSessionLanguage }));

/** The addresses that were live before the language went into the path. */
app.use(redirectLegacyPaths);

const readSitemapShops = createSitemapShops({ apiUrl: environment.apiUrl });

/**
 * Built from the page list the prerender manifest uses, so the two cannot disagree, plus one
 * home page per barbershop from the API.
 */
app.get('/sitemap.xml', (_request, response, next) => {
  readSitemapShops()
    .then((shops) => {
      response.type('application/xml').send(renderSitemap(shops));
    })
    .catch(next);
});

app.get('/robots.txt', (_request, response) => {
  response.type('text/plain').send(renderRobots());
});

/**
 * Before the static handler, which caches for a year. A cached service worker keeps an old
 * version alive, so the browser must ask again on every visit. The manifest names the icons, so
 * it follows the same rule.
 */
app.get('/sw.js', serveUncached('sw.js', 'text/javascript; charset=utf-8'));
app.get(
  '/manifest.webmanifest',
  serveUncached('manifest.webmanifest', 'application/manifest+json'),
);

app.use(
  express.static(browserDistFolder, {
    maxAge: '1y',
    index: false,
    redirect: false,
  }),
);

/**
 * After the static handler, a first segment that is not a language means an unpublished address.
 * Give it one so the 404 is translated. The status still comes from the wildcard server route.
 */
app.use(createUnknownLanguageRewrite({ sessionLanguage: readRequestSessionLanguage }));

app.use((req, res, next) => {
  const session = readRequestSession(req.headers.cookie);

  angularApp
    .handle(req, { session } satisfies AuthRequestContext)
    .then((response) => {
      if (response) {
        return writeResponseToNodeResponse(
          keepPersonalRenderPrivate(response, session !== null),
          res,
        );
      }
      next();
      return;
    })
    .catch(next);
});

/** Starts only as the main entry point or under PM2. `PORT` defaults to 4000. */
if (isMainModule(import.meta.url) || process.env['pm_id']) {
  getAuthRouter();
  const port = Number(process.env['PORT'] ?? 4000);
  app.listen(port, (error) => {
    if (error) {
      throw error;
    }

    console.log(`Node Express server listening on http://localhost:${port}`);
  });
}

/** The handler the Angular CLI uses for the dev server and the build. */
export const reqHandler = createNodeRequestHandler(app);

/** Serves one build file that the browser must ask for again on every visit. */
function serveUncached(file: string, contentType: string): RequestHandler {
  return (_request, response, next) => {
    response.sendFile(
      join(browserDistFolder, file),
      { headers: { 'Cache-Control': 'no-cache', 'Content-Type': contentType } },
      (error: Error | undefined) => {
        if (error) next(error);
      },
    );
  };
}

function getAuthRouter(): ReturnType<typeof createAuthRouter> {
  if (authRouter !== undefined) return authRouter;

  const config = loadAuthServerConfig(process.env);
  authRouter = createAuthRouter({
    protocol: createOpenIdAuthClient(config),
    keyring: loadSessionCookieKeyring(process.env),
    sessionCookie: config.sessionCookie,
    origin: config.origin,
  });
  return authRouter;
}

/**
 * The stored preference of a signed-in visitor, for negotiating `/`. It already rides in the
 * sealed session cookie, so this costs one unseal and no round trip.
 */
function readRequestSessionLanguage(request: Request): string | null {
  return readRequestSession(request.headers.cookie)?.loc ?? null;
}

function readRequestSession(cookieHeader: string | undefined): SessionPayload | null {
  const sessionCookie = findSessionCookieConfig(cookieHeader);
  if (sessionCookie === null) return null;

  return readSession(cookieHeader, sessionCookie, loadSessionCookieKeyring(process.env)).session;
}

function findSessionCookieConfig(cookieHeader: string | undefined): SessionCookieConfig | null {
  const configs: readonly SessionCookieConfig[] = [
    { name: '__Host-ks', secure: true },
    { name: 'ks', secure: false },
  ];

  return configs.find((config) => readSessionCookie(cookieHeader, config) !== null) ?? null;
}
