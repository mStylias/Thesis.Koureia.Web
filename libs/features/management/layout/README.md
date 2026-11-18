# `@features/management-layout`

The frame of the barber's workspace: everything under `/management`. One shell — sidebar on the
left, top bar above the routed page — and one route per sidebar option. The screens themselves
are separate libraries; this one owns the shell, the navigation table and the placeholder.

```ts
// apps/<app>/src/app/app.routes.ts
{
  path: 'management',
  loadChildren: () => import('@features/management-layout').then((m) => m.managementRoutes),
}
```

## How the area is laid out

`libs/features/management/` is a folder, not a library. Under it, `layout/` is this library and
`operations/`, `analytics/` and `settings/` are the three sidebar groups. A page lives in its own
library under its group — `settings/roles/` is the first — so a screen carries its own
dependencies, dictionary and tests, and a change to one page rebuilds and retests one project.

## Adding a page

`src/management-pages.ts` is the navigation, once. The child routes and the sidebar groups are
both built from `MANAGEMENT_SECTIONS`, so a new page is:

1. an entry in the right section — `path`, `titleKey`, `icon`;
2. its label under `nav` in `src/i18n/el.ts` and `en.ts`;
3. a library under the matching group folder, exporting a route body;
4. that route body under its `path` in `PAGE_ROUTES` in `src/lib.routes.ts`.

Stop after step 2 and the page renders `ManagementPlaceholder`, which is what the seven pages
with no screen yet do.

A page library exports `Omit<Route, 'path'>` rather than a bare component, so it can carry its
own resolvers and providers without this library knowing what they are. It must not import from
here: the navigation depends on the pages, so a page depending back on the layout is a cycle.
Copy that reads on a page belongs to the page's own Transloco scope.

`titleKey` is read three times — the sidebar option, the top bar heading and the browser tab —
so the three cannot disagree.

## Why the address carries no language

Every other page in the app is published twice, at `/el/…` and `/en/…`. Management is published
once. It is a private workspace: nothing indexes it, nothing links to it in two languages, and
a barber has one address to bookmark.

The consequence is that `activateLanguage` never runs for these routes, because it hangs off the
`:lang` parameter. Transloco keeps whatever language is already active, which on a cold load is
the configured default. Arriving from an English page keeps English; opening `/management`
directly gets Greek. Both dictionaries ship, so publishing a switcher here later is a change to
this library and not a rewrite of it.

The app owes this library two entries, both listed in `apps/<app>/src/app/language-free-pages.ts`:
the Express rewrite must not prefix a language onto `/management`, and the server route manifest
must claim `management/**` or the 404 wildcard answers it.

## Which shop the workspace shows

No management URL carries a company id. The API resolves the shop from the signed-in account, and
`StaffAccessStore.company()` reports it. A superadmin works at no shop, so the top bar shows them
`WorkspaceShopPicker`. The pick goes into `WorkspaceCompanyChoice` (`sessionStorage`), and
`companyScopeInterceptor` sends it as `X-Company-Id`. A pick reads the workspace again and opens
the home page.

The shell keys `<router-outlet>` on the resolved shop, so a shop change re-creates the page and
its store starts fresh. A page provides its store on its component, never in its route's
`providers`: the router keeps a route's injector after the page is left, so a second visit would
show the first visit's data.

## Why the shell owns both sidebar states

`@ui/sidebar` renders no trigger. The desktop collapse toggle and the mobile hamburger both live
in `@ui/topbar`, so the shell holds one signal per state and binds it to both bars.

## Why the rail's state lives in `localStorage`, and why these pages render in the browser

`SidebarCollapseStore` holds the desktop collapse state and mirrors it to `localStorage` through
an effect. The rail is a working preference, like the width of a pane, so it belongs to the
device rather than the tab, and the expanded default is stored as the absence of the key — a
visitor who never worked the toggle leaves nothing behind. The mobile drawer is deliberately not
persisted: it covers the page it belongs to, so it opens on a press and never on arrival.

No server render can read that, which is why `management/**` is the one `RenderMode.Client` entry
in `apps/<app>/src/app/app.routes.server.ts`. Server-rendered, the shell painted the expanded
rail and the stored state jumped it narrow at hydration — on every single load. The workspace
gives up nothing by rendering in the browser: it is `noindex`, signed-in only, and the pages
behind the shell fetch their data client-side anyway.

Anything else the shell reads from the browser alone belongs in the same place. Moving these
routes back to a server render brings the jump back.

## Why the sidebar labels are built imperatively

`SidebarGroup` carries plain strings, which no pipe can reach, so the labels come from
`TranslocoService.translate` inside a `computed()`. That call answers with the key itself until
the dictionary is loaded, which is why `managementRoutes` resolves the dictionary before the
shell renders rather than leaving it to the scope provider alone.
