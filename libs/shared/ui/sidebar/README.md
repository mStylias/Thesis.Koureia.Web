# shared-ui-sidebar

The navigation sidebar of the design system. Import from `@ui/sidebar`.

Expanded by default; collapsing it leaves an icon-only rail — the brand icon stays put, the copy fades away, and the options reveal their names in right-side tooltips. Below 1024px it leaves the flow entirely and opens as a modal drawer instead.

**The sidebar ships no trigger for either state.** Both live in `@ui/topbar`: `showSidebarToggle` for the desktop rail, the hamburger for the mobile drawer. Bind one signal per state to both bars. Keeping the collapse toggle outside the panel it resizes is deliberate — mounted on the sidebar it would have to reposition mid-animation, and the eye follows the moving button instead of the panel.

```html
<lib-sidebar #nav [groups]="groups" [(collapsed)]="collapsed" [(mobileOpen)]="navOpen">
  <a *libSidebarBrand routerLink="/">
    <svg lucideScissors></svg>
    <span libSidebarBrandText>Barbershop</span>
  </a>
</lib-sidebar>

<lib-topbar
  [(menuOpen)]="navOpen"
  showSidebarToggle
  [(sidebarCollapsed)]="collapsed"
  [sidebarControls]="nav.navId"
/>
```

```ts
nav: SidebarGroup[] = [
  { items: [{ label: 'Αρχική', icon: LucideHouse, routerLink: '/' }] },
  {
    label: 'Διαχείριση',
    items: [{ label: 'Ρυθμίσεις', icon: LucideSettings, routerLink: '/settings' }],
  },
];
```

- `groups`: `SidebarGroup[]` — groups are separated by hairlines; an optional group `label` renders as a small heading (hidden while collapsed). Items are real `<a>` links (`routerLink` or external `url`/`target`) with `icon`, `disabled`, and `visible`.
- Submenus: give an item `items` (one level) to make it an expandable toggle (`aria-expanded`, animated height); `expanded: true` starts it open. In the collapsed rail, activating a parent expands the sidebar and opens that submenu.
- `[(collapsed)]` (default `false`): icon-rail state — drive it from a toggle outside the sidebar, and persist it if the rail should survive a reload. The sidebar writes back to it in one case: activating a submenu parent in the rail, which has nowhere to put the children.
- `compact` (default `false`): denser rows; desktop only — the mobile drawer keeps 44px touch targets
- `[(mobileOpen)]`: mobile drawer visibility; closes itself on navigation, Escape, and backdrop clicks
- `navId`: id of the `<nav>` landmark, public so an outside toggle can point `aria-controls` at it (`<lib-sidebar #nav />` … `[sidebarControls]="nav.navId"`)
- `ariaLabel`: name of the `navigation` landmark (defaults to a translated string)
- `routerLinkActiveOptions` (default `{ exact: true }`): active-link matching; note exact matching compares query params too
- `(itemSelect)` fires when an enabled option is activated; the active route is marked `aria-current="page"`
- Brand area via `*libSidebarBrand` template (renders in the desktop header and the mobile drawer header); mark the product name with `libSidebarBrandText` so it fades while collapsed. The brand **icon** stays visible in the rail, on the same column as the option icons — put it before the text and give it `flex-shrink: 0`.
- Width via the `--sidebar-width` / `--sidebar-collapsed-width` custom properties (`$component-size` tokens; override them on `lib-sidebar` or any ancestor)

### Collapse motion

One movement in two beats, and the order flips with the direction:

|            | first                                                                          | then                            |
| ---------- | ------------------------------------------------------------------------------ | ------------------------------- |
| collapsing | the copy fades out (`--dur-fast`)                                              | the rail narrows (`--dur-slow`) |
| expanding  | the rail widens (`--dur-slow`), revealing copy that is already at full opacity | —                               |

The asymmetry is deliberate. Collapsing needs the fade or the labels are visibly squeezed and guillotined by the narrowing rail. Expanding needs nothing: the widening rail _is_ the reveal, wiping the copy in from the left under `overflow: hidden`, and a fade layered on top of that read as the letters ghosting in a beat late. Nothing in the header repositions — the brand icon holds its column throughout (measured: x and y identical on every frame of the transition). The width transition is the documented layout-animation exception (reflowing the page content is the point of collapsing); everything else is opacity only. `--dur-slow` rather than `--dur-base` because duration should match distance, and this is the largest travel in the system.

The width uses **`--ease-out`, not `--ease-standard`**, and that was measured rather than reasoned. "On-screen element moving → ease-in-out" is the usual rule, but `--ease-standard` is `cubic-bezier(0.4, 0, 0.2, 1)` — it eases _in_, and across 196px that start ramp is long enough to see: two frames after the click only 2.8% of the width had moved, which reads as the button not having registered the press. On `--ease-out` the rail is 30% across after one frame and 87% after 82ms, then glides into the last few pixels. The rail is responding to a press; it should leave the instant it is pressed.

The fade shares one inherited `--sidebar-copy-transition` across the option labels, group headings, submenu chevrons and the projected brand text, so they move as a unit. Because a transition belongs to the state it moves _toward_, the instant (`opacity 0s`) case lives on the default expanded rules and the collapsed rules supply the fade. It stays an `opacity …` shorthand rather than `none` — `.sidebar-parent-chevron` splices it into a transition _list_, where a `none` entry would invalidate the whole declaration. `prefers-reduced-motion` needs no local block: durations are collapsed globally and nothing here carries a transition-delay.

This library was generated with [Nx](https://nx.dev).

## Running unit tests

Run `nx test shared-ui-sidebar` to execute the unit tests.
