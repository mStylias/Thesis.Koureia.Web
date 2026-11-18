# @features/site-layout

The layout of every public page: the page, then the site footer. It also owns the
wordmark (`SiteBrand`) that the landing header and the footer share.

```ts
// apps/<app>/src/app/app.routes.ts
{
  path: ':lang',
  loadChildren: () => import('@features/site-layout').then((m) => m.withSiteLayout(localizedRoutes)),
}
```

`withSiteLayout` preloads the footer copy, so the server render ships it.

## What an app must provide

- A brand, with `provideBrand()` from `@util/brand`. The wordmark reads `wordmark` and `logo`.
- The root keys `brand.landing.label` and `brand.landing.copyright`, typed by
  `LandingBrandCopy` in `@features/landing`.

A route opts out of the footer with `data: { siteFooter: false }`, which covers its children too.

Do not put the layout around `/management`. It has its own shell.
