# `@features/management-settings-roles`

The company's roles, under `/management/roles`. One library per management screen — see
`@features/management-layout` for how the area is laid out.

```ts
// libs/features/management/layout/src/lib.routes.ts
const PAGE_ROUTES: Readonly<Record<string, Omit<Route, 'path'>>> = {
  roles: rolesRoute,
};
```

## Layout

`src/list/` is the grid screen and `src/details/` is the panel over it. Anything both need is at
`src/`: `roles.api.ts`, `roles.store.ts` and `roles.types.ts`.

## Why the route carries the dictionary

`rolesRoute` is a route body, not a component, so it can bring a resolver that loads the
`managementRoles` dictionary before the page renders. The column captions are built in a
`computed` that tracks the active language rather than the dictionary, so a caption read before
the dictionary arrives would stay the raw key and never correct itself. `provideTranslocoScope`
on the page alone loads too late for that.

## Why the copy is not in the `management` scope

The navigation depends on the pages, so a page must not import from the layout. Its copy
therefore lives here, in its own scope, and the layout dictionary keeps only what the shell
renders — the group headings, the sidebar labels and the placeholder.

## Why view and edit are a signal, not two routes

The panel's route is `:roleId`. View and edit are a `mode` signal on top of it, because a second
route would make the outlet destroy and rebuild the panel, and the drawer would slide shut and
open again on every press of Edit or Cancel. The cost is that edit mode is not bookmarkable and
a reload lands in view; that is the accepted trade.

`mode` is a `linkedSignal` on `roleId`, so arriving at a different address resets it: a create
becomes a view of the role it made, and stepping from one role to another cannot carry an open
editor across.

**Cancel means the mode, not the panel.** In the editor it goes back to view and puts the role's
own values back, so reopening does not show the abandoned edit. Only a create closes the drawer,
because a create has nothing behind it to return to.

## Who can add and edit

`Add role` shows only with `roles:create`. Edit shows only when the server sends
`isEditable: true` **and** the user has `roles:update`. `isEditable` does not read the caller's
codes. Both checks use `StaffAccessStore.has`.

## Why the two trees are different trees

View mode asks what this role can do, and the shortest true answer is the codes it holds. Edit
mode has to offer the whole catalog, because the endpoint replaces rather than patches — the
submitted set is the role's new complete set, so every code that should remain has to be tickable.
`grantedPermissions` narrows the catalog for the first, `buildPermissionTree` takes it whole for
the second.

The view tree is `readonly`, not `disabled`: the rows keep arrow navigation, typeahead and
expansion, so the tree stays readable, and its default status glyphs draw a check rather than a
checkbox so nothing reads as a control that refuses to move. The fields beside it are a `<dl>`
rather than disabled inputs, for the same reason.

A code the role holds that the caller cannot grant shows **checked and disabled**. The server
checks the whole submitted set rather than the diff, so that code will fail the save, and the
user has to be able to see why.

## Why nothing is reported until save is pressed

`saveAttempted` gates every message. The library's usual rule for a control is
`touched() || blurred()`, which reports the moment a field is left — on a two-field form that
accuses the user of an empty name while they are on their way to the permission tree. After the
first press, validation is live: the message appears and clears as the field is typed in, with no
second press needed. It is a `linkedSignal` on `mode`, so a fresh editor starts silent again.

## Why `new` and a role id are one route

The panel's route is `:roleId`, and `new` is a value of it rather than a route of its own. A save
moves the panel from `new` to the role's id, and two route configurations would make the outlet
destroy the component and build it again — the drawer would slide shut and open on a create the
user has just completed. One route means only the parameter changes, so the panel stays put. The
create replaces `new` in history rather than pushing the id, so the back button reaches the list
instead of a blank create form.

## Why the actions are in the drawer's toolbar slot

`.drawer-content` is the scroller. Cancel and Save belong to the whole panel, so they go in
`libDrawerToolbar`, between the drawer's header and the content, and stay reachable however far
the permission tree is scrolled. The slot exists in `@ui/drawer` for this.

## Why there is a store

The panel is a child route, so it can reach nothing the grid declares — and a role it creates is
a row the grid has never read. `RolesStore` is what both address: it holds the roles, the
permission catalog, and a revision the grid watches to re-run its load. It is
`autoProvided: false` and listed in `rolesRoute`, so leaving the screen drops all of it.

The roles are fetched whole and held. The grid runs every operation locally, so a filter
keystroke is a load over what is in hand rather than a request; only a write, or the toolbar's
refresh, drops the collection. A **failure is never held** — the grid's retry is another load,
and a cached refusal would answer it with the same refusal for ever.

The catalog is held idle until the panel asks for it. A reader who only looks at the grid never
opens the panel, and the catalog is the panel's alone; reopening the panel reads the same
response rather than issuing a second request.

## Why the tree's value is not a form field

`permissions` in the request is a list of codes. The tree's `value` is a list of node keys, and
checkbox cascading adds a key per fully selected category — keys this library invents, because
the catalog's `category` is a flat string with no code of its own. Binding that to a form field
named `permissions` would put values in the model that no request may carry, so the form holds
`name` and `description` only and the codes are derived at submit time by
`selectedCodes`.

A code with `canGrant: false` is a disabled row, never an absent one: the catalog omits nothing
so the editor can show why a code is out of reach. A category whose every code is refused is
disabled too.

## Why the row text is not baked into the node

Rebuilding the tree to relabel it would replace every node and discard what the user has ticked,
so the row template reads the label per render and the model is rebuilt only when the catalog
changes.

`TreeModel`'s constructor writes the signals its nodes are made of, so the model cannot be built
in a `computed`. It is a plain signal written from an effect.

## Why the primary cell opens the panel

`name` is the primary column, so the grid makes its cell the thing that opens the record and
answers `Enter` over it in one press. A whole-row gesture would take every click in every column
with it, selection included.

## Why every grid operation is local

A seeded role's name and every permission label are **English in the database and stay English**:
there is no per-language column and no endpoint that edits one, so the visible text is keyed on
the identifier in `roles.labels.ts` and the server's own string is the fallback. See
`i18n/en.ts` for the three key spaces — role `name`, permission `code`, permission `category`.

That is what makes the grid local. The name a reader filters and sorts by exists nowhere the
endpoint can reach, so a server-side `$filter` on `name` would search text the reader never saw.
The page fetches the collection whole — paged at the endpoint's own `$top` cap of 100 — and
declares `remote: false`. A company has a handful of roles, and this is the only way the visible
text and the queried text are the same text.

The toolbar's refresh is the page's own item, not the built-in one: the built-in reloads the grid
over the rows already in hand, and refresh here has to mean fetch again.

`numberOfUsers` counts grants at this company alone and the endpoint projects it in SQL, so it
arrives as an ordinary member and sorts and filters like one.

A company's own role name is tenant free text, already in whatever language the company typed.
It is never looked up — only an `isSystem` row is.

## Why a seeded role has no description

The label a seeded role reads under says what its `description` says: the database stores
`company_admin` in `name` and `Shop owner` in `description`, and the dictionary labels it
`Owner`. Showing both would say the same thing twice, so the
description is withheld for an `isSystem` row — dropped from the grid's rows rather than hidden in
the cell, so the filter, the sort and the export all agree with what is on screen.

The name in view mode comes from a `libFieldView` slot and not from the form model. The model
stays the server's raw string, because it is what a write would carry.
