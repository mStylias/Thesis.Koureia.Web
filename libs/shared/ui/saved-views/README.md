# shared-ui-saved-views

Named presets for any screen with an arrangement worth saving: a strip of tabs,
one per saved view, with create, rename, duplicate, reorder, set-default and
delete. The datagrid and the calendar both draw it. Import from `@ui/saved-views`.

```ts
import { SavedViews, SavedViewsController } from '@ui/saved-views';
```

```ts
// The host owns the controller. It says what a state is and how to compare two.
readonly views = new SavedViewsController<MyState>({
  key: () => savedViewsResourceKey('calendar_main'),
  storage: () => inject(SAVED_VIEWS_STORAGE, { optional: true }),
  state: () => this.snapshot(),
  apply: (state) => this.restore(state),
  isDestroyed: () => this.destroyed,
  isState: isMyState,
  statesEqual: (a, b) => JSON.stringify(a) === JSON.stringify(b),
});

// Before the first query, so the first render starts in the default view.
const initial = await this.views.load(key);
```

```html
<lib-saved-views [controller]="views" layout="strip" />
```

## Two entry points

- `@ui/saved-views/core` — `SavedViewsController`, the pure list operations, the
  `SAVED_VIEWS_STORAGE` token and every type. No component.
- `@ui/saved-views` — the strip, plus everything core exports.

A host that wants the strip out of its main chunk imports core statically and
the strip with `await import('@ui/saved-views')`. The datagrid does this.

## Why the store carries `unknown`

One `SavedViewsStorage` serves every host in the application, so it cannot know
any host's state shape. It checks the document envelope and hands the states on.
The controller asks the host's `isState` about each one and drops the rest, so a
document written by another screen, or by an older version of this one, never
applies half way.

## API

### `lib-saved-views`

| Input        | Type                             | Default  | Notes                                                                                   |
| ------------ | -------------------------------- | -------- | --------------------------------------------------------------------------------------- |
| `controller` | `SavedViewsController<TState>`   | required | The whole of the strip's state.                                                         |
| `layout`     | `'auto' \| 'strip' \| 'compact'` | `'auto'` | `auto` reads `SAVED_VIEWS_HEADROOM` when a host provides it and is the strip otherwise. |

The compact form is a listbox whose first row adds a view, with the per-view
menu on a button inside the field and the unsaved pair beside it.

### `SavedViewsController<TState>`

Signals: `views`, `temporary`, `selectedId`, `selected`, `temporarySelected`, `editor`, `status`,
`ready`, `dirty`.
Methods: `load(key, options?)`, `select`, `openTemporary`, `closeTemporary`, `beginCreate`,
`beginRename`, `setEditorName`,
`cancelEditor`, `commitEditor`, `saveChanges`, `revertChanges`, `duplicate`,
`setDefault`, `remove`, `move`, `previewMove`, `commitOrder`.

Every write is optimistic and rolled back whole on failure, selection included.

### A temporary view

`load(key, { temporary })` and `openTemporary(view)` show a view made for one
visit. It is **not a member of `views`**: the first entry of that list is the
default and every list operation works on it, so a temporary view inside it could
be dragged to the front, become the default and be stored by the next write.
Holding it in `temporary` makes that impossible rather than checked. `load` also
takes it as a promise and awaits it beside the document. A rejected promise opens
the default.

The strip draws it after the stored views, marked with a glyph and a described
note. It is not draggable, the last stored view cannot be dragged past it, and
`Ctrl`+arrow skips it. Its menu offers Duplicate (a stored copy at the end of the
list), Close, and Discard changes. `closeTemporary()` applies the default, or
calls the host's `reset` when nothing is stored.

### Storage

`provideSavedViewsStorage(adapter)` registers an application-wide store.
`@features/saved-views` provides the user-resource one. `memorySavedViewsStorage()`
is for stories and specs.

## Accessibility

The strip is a `tablist` of `tab`s with one roving tab stop; arrows move focus,
`Enter` selects, `F2` renames, `Ctrl`+arrows reorder, `Shift`+`F10` opens the
menu. The default and unsaved facts are text through `aria-describedby`, never
the glyph alone. Affordances inside a tab are pointer-only and `aria-hidden`.
