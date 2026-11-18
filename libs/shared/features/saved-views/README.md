# @features/saved-views

Stores a host's named views in a user resource. One file, joining two libraries
that may not reach each other.

```ts
// app.config.ts
providers: [provideUserResourceSavedViews()];
```

```ts
// a grid
protected readonly features = [gridViews({ key: 'roles_main_grid' })];
```

## Why it is a library of its own

`@ui/saved-views` may speak no transport and `@api/user-resources` may not
depend on a ui library, and the dependency rules in `eslint.config.mjs` enforce
both. The one file that knows about `SavedViewsStorage` **and** about HTTP
therefore belongs in neither, and a feature library is where it is allowed to
live.

## What it does

- One resource per host, named `<key>_views`. The suffix belongs to
  `@ui/saved-views`, so the convention cannot be spelled two ways on two screens.
- The whole document, every view **and** their order, is the resource's `value`,
  so a create, a rename and a reorder are each one request rather than one for
  the views and one for the order.
- The resource id is learned on the first read and cached for the life of the
  injector, so a save does not look it up again.
- A document from an unreadable version is discarded rather than guessed at. The
  host then starts with no views, which is honest; half-applying somebody's
  saved arrangement is not.
- The states inside a document are opaque here. Each host checks the ones it
  loads with its own guard and drops the rest.
