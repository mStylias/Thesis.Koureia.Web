# @features/management-shared-page-sections

The frame of a management page of cards: one centered column where each card loads and fails on
its own. My profile and My company use it.

```ts
@Component({
  providers: [providePageSections({ discardMessage: 'managementCompany.discard.message' })],
  host: { '(window:beforeunload)': 'onBeforeUnload($event)' },
})
export class ManagementCompany {
  private readonly editors = inject(PageEditors);

  constructor() {
    openPageAtFragment();
  }

  canLeave(): Promise<boolean> {
    return this.editors.canLeave();
  }
}
```

```html
<lib-page-section sectionId="hours" [heading]="…" [state]="state()" (retry)="retry()">
  <div libPageSectionActions>…</div>
  …
</lib-page-section>
```

| Piece                 | Holds                                                                        |
| --------------------- | ---------------------------------------------------------------------------- |
| `PageSection`         | A card's heading, hint, actions slot, skeleton and failure with a retry      |
| `PageEditors`         | The cards that edit. `canLeave()` asks once for all of them                  |
| `PageLoading`         | What still loads. `trackPageLoading` adds a source for the caller's lifetime |
| `openPageAtFragment`  | Scrolls to `#<sectionId>` once every card has loaded                         |
| `providePageSections` | The page's providers: the two services and the discard message               |

## What is worth knowing

- **The page owns the discard message.** The title and the buttons are this lib's. The message
  names what the page edits, so the page passes its translation key.
- **The host loads the dictionary.** The discard question is translated imperatively. The page's
  dictionary loader calls `loadPageSectionsDictionaries`.
- **The page scrolls, not the router.** The router's anchor scrolling moves the window. The page
  scrolls inside the shell's content area, and only after every card has loaded, because a card
  above the fragment can grow or go away.
- **A card that loads more than its section reports it.** A list that loads after the card, such
  as time off, calls `trackPageLoading` with its own state.
