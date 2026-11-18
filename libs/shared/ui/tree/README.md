# Tree

`@ui/tree` provides a signal-backed tree model and an accessible Angular UI control built on
`@angular/aria/tree`. `TreeModel` is the single invisible root; `TreeNode` carries stable identity,
generic application data, an optional label, structure, and node-owned expansion/disabled state.

## Basic usage

```ts
import { Tree, TreeModel, TreeNode } from '@ui/tree';

const files = new TreeModel([
  new TreeNode({
    key: 'invoices',
    data: { kind: 'directory' },
    label: 'Invoices',
    expanded: true,
    children: [
      new TreeNode({
        key: 'invoice-2026',
        data: { kind: 'file' },
        label: '2026.pdf',
      }),
    ],
  }),
]);
```

```html
<lib-tree [tree]="files" [(value)]="selectedKeys" ariaLabel="Files" showGuides />
```

`value` is always a `readonly K[]`, including single selection. This keeps the component compatible
with Signal Forms and lets an application switch modes without changing its form schema.

## Remote and flat sources

Bind `source` instead of `tree` to read nodes from a `DataSource` (`@ui/data-source`) — an OData
binding or any other transport — or from a flat array. `tree` wins when both are bound, so adding a
source can never make an already-populated tree fetch.

```html
<lib-tree
  [source]="regionSource"
  key="id"
  parentKey="parentId"
  [displayWith]="regionName"
  [hasChildren]="regionIsBranch"
  [(value)]="selectedKeys"
  ariaLabel="Regions"
/>
```

Which shape applies is decided by what the source implements, never by a flag:

| Source                        | Read                    | Nesting                           |
| ----------------------------- | ----------------------- | --------------------------------- |
| `loadChildren` present        | one level per expansion | the source answers per parent key |
| `load` only, or a plain array | once                    | `parentKey` nests the rows        |

- `key` is required as soon as `source` is bound, and it has to produce a string or a number.
  `displayWith` supplies the row text, `nodeDisabled` the per-item disabled rule.
- `hasChildren` declares which rows are branches. Without it a lazy source treats every row as
  expandable until an empty level proves it a leaf, which costs one request per leaf the user opens.
- A branch awaits its children: the chevron becomes a spinner, the row carries `aria-busy` and
  `data-children-loading`, and the row expands only when its level arrives. A rejected level leaves
  the branch collapsed, marks it `data-children-error`, shows `childrenErrorMessage`, and retries on
  the next expansion.
- A rejected root level replaces the tree with `loadErrorMessage`. `reload()` re-runs it.
- `expandAll()` skips branches whose level has still to load, so one call cannot turn into one
  request per branch.
- An orphan — a `parentKey` naming a row the response does not contain — stays a root rather than
  disappearing.

### A persisted value stays visible

`value` holds node keys, so a form loaded with `regionId: 100` names a node that may sit inside an
unloaded branch. Given `byKeys` and `parentKey`, the control walks up to a loaded ancestor and then
loads every level back down and expands them, so the selection is visible without materializing the
hierarchy. Levels stay either absent or complete: nothing is grafted into a level that was never
loaded.

A key the source cannot place is **kept, never cleared**. The host carries `data-unresolved`, one
counted note reports the missing keys (`unavailableMessage`) and is added to `aria-describedby`, and
`(resolutionFailed)` reports `notFound`, `unsupported` (no `byKeys`, or no `parentKey` to walk up),
or `loadFailed`. `(loadFailed)` reports a level the source refused, with `parent: null` for the root
level.

Two more rules follow from a level that has not loaded:

- **A selected key inside an unloaded level survives a user edit.** Angular Aria models only the
  rendered rows, so `multiple` and `checkbox` re-append the keys the model does not hold rather than
  letting the pattern prune them out of the form value.
- **Checkbox cascading covers loaded nodes only.** Toggling a branch selects the eligible descendants
  the model holds; a level that loads afterwards is not retro-selected, so the branch then reads as
  partial. Selecting a subtree the client has never seen is a server-side operation, not a cascade.

Two boundaries are deliberate: a level is requested in full, so per-level paging and
`LoadResult.hasMore` are not used, and there is no server-side search — narrow the source instead.

## Selection

- `single` (default): one selected key.
- `multiple`: normal click toggles each row; Ctrl/Cmd is not required.
- `checkbox`: toggling a branch cascades through enabled/selectable descendants. Ancestors are
  selected when all eligible descendants are selected and mixed when only some are selected.

Disabled and non-selectable nodes do not participate in checkbox propagation. `readonly` keeps
focus, arrow navigation, typeahead, and expansion available while preventing selection changes.
Readonly checkbox trees use standalone status glyphs by default: a check for selected, a minus for
partially selected, and a reserved empty slot for unselected. They have no control outline or
background, so they do not resemble editable toggles. Set `readonlyIndicator="checkbox"` only when
checkbox-shaped read-only presentation is intentional. Readonly rows also suppress selection hover
and pointer feedback; the chevron and remaining branch-row space still communicate expansion.

```html
<lib-tree [tree]="permissions" selectionMode="checkbox" [value]="grantedKeys" readonly />
```

## Custom rows and empty state

```html
<lib-tree [tree]="files" [(value)]="selectedKeys" ariaLabel="Files">
  <ng-template
    libTreeNode
    let-node
    let-selected="selected"
    let-partial="partiallySelected"
    let-level="level"
  >
    {{ node.label() }} · level {{ level }}
  </ng-template>

  <ng-template libTreeEmpty>No files found.</ng-template>
</lib-tree>
```

The node template also receives `selectionState`, `expanded`, `active`, `disabled`, and `readonly`.
Treeitem descendants are presentational, so custom rows should not add buttons, links, or other tab
stops. Use `nodeActivated` or `nodeContextMenu` to connect row actions.

## Signal Forms

`Tree<T, K>` implements `FormValueControl<readonly K[]>`:

```html
<lib-tree
  [tree]="files"
  [formField]="form.selectedFiles"
  ariaLabel="Files"
  ariaDescribedby="selected-files-error"
/>
```

Signal Forms binds `value`, `disabled`, `required`, `invalid`, `touched`, and `errors`. The component
does not render validation copy; the form owns translated error text and connects it with
`ariaDescribedby`.

## Expansion and events

On a branch row, a pointer click on the node text or checkbox changes selection only, and a click
on the chevron or the remaining row space changes expansion only. A leaf has nothing to disclose,
so its whole row selects: the label is a fraction of the row width, and splitting a leaf row would
leave most of it dead. Arrow keys provide the standard tree navigation model.
`expandAll()`, `collapseAll()`, `toggle(nodeOrKey)`, `focus()`, and
`scrollActiveItemIntoView()` are public imperative helpers.

The control emits `nodeActivated`, `nodeExpanded`, `nodeCollapsed`, `nodeContextMenu`, and, while a
source is bound, `resolutionFailed` and `loadFailed`. Context
menu events do not call `preventDefault`, so the consumer decides whether to replace the browser
menu.

## Model invariants

Nodes keep stable identities for Angular Aria registration and `@for` key tracking. Data and
node-owned UI state are writable signals; parent/child collections are read-only signals changed
through model methods. Duplicate keys, cycles, multiple parents, invalid indices, and implicit
cross-tree moves are rejected.

Both model and node support traversal, search, sorting, cloning, and JSON snapshots. Cloning requires
a key factory so copied subtrees cannot collide when attached. `toJSON()` includes `expanded`,
`disabled`, and `selectable`; use `serialize({includeUiState: false})` for structure and application
data only. `expandable` keeps a childless node a branch, which is what an unloaded level needs, and
it is structure rather than UI state, so a state-free snapshot still carries it.

## Accessibility notes

The inner list is the single `role="tree"`; recursive lists are `role="group"`. Angular Aria owns
roving focus/activedescendant focus, typeahead, orientation, wrapping, disabled navigation, levels,
set sizes, and positions. Checkbox mode exposes `aria-checked="true|mixed|false"` instead of
`aria-selected`. Supply `ariaLabel` or `ariaLabelledby`; otherwise the library provides a translated
fallback name. An empty model renders no tree landmark.

Pointer expansion rotates the branch chevron and fades the revealed child rows over a short 4px
rise. Collapse is immediate, with no child-row exit animation. Initial rendering, keyboard
expansion, and imperative expansion remain motionless; branches with more than 20 visible
descendants keep the chevron feedback but skip child-row motion. `ngTreeItemGroup` removes collapsed
descendants while its group directive remains registered so Angular Aria still recognizes the
collapsed row as expandable.
