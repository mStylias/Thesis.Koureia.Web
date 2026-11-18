import { Component, input, signal } from '@angular/core';
import { applicationConfig, moduleMetadata, type Meta, type StoryObj } from '@storybook/angular';
import { provideTransloco } from '@jsverse/transloco';
import { Button } from '@ui/button';
import { Drawer, DrawerFooter, DrawerHeader } from './drawer';
import { DrawerPosition, DrawerSize } from './drawer.types';

const POSITIONS = ['left', 'right', 'top', 'bottom', 'full'] as const;
const SIZES = ['sm', 'md', 'lg'] as const;

/**
 * A per-story description plus the snippet shown under "Show code".
 *
 * Every story renders through a demo wrapper, because a story object
 * cannot hold the signals these examples need — so Storybook's generated
 * source would read `<lib-drawer-demo />`, the scaffolding rather than
 * the API. The trade-off is that the snippet is static: it does not
 * follow the controls, so keep it in step with the demos above.
 */
const doc = (markdown: string, code: string, language = 'html') => ({
  docs: {
    description: { story: markdown },
    source: { code: code.trim(), language },
  },
});

@Component({
  selector: 'lib-drawer-demo',
  imports: [Drawer, DrawerFooter, Button],
  template: `
    <button libButton variant="outlined" (click)="visible.set(true)">Open drawer</button>

    <lib-drawer
      [(visible)]="visible"
      [position]="position()"
      [size]="size()"
      [header]="header()"
      [closable]="closable()"
      [modal]="modal()"
      [dismissible]="dismissible()"
      [showBackdrop]="showBackdrop()"
      [closeOnEscape]="closeOnEscape()"
      [blockScroll]="blockScroll()"
    >
      <p style="margin: 0; color: var(--text-secondary); font-size: var(--text-sm);">
        Skin fade with Kimonas — Friday at 17:30, 30 min, €18.
      </p>

      @if (withFooter()) {
        <div libDrawerFooter style="display: flex; justify-content: flex-end; gap: var(--space-3);">
          <button libButton variant="outlined" severity="secondary" (click)="visible.set(false)">
            Cancel
          </button>
          <button libButton (click)="visible.set(false)">Book it</button>
        </div>
      }
    </lib-drawer>
  `,
})
class DrawerDemo {
  readonly position = input<DrawerPosition>('left');
  readonly size = input<DrawerSize>('md');
  readonly header = input('Your booking');
  readonly closable = input(true);
  readonly modal = input(true);
  readonly dismissible = input(true);
  readonly showBackdrop = input(true);
  readonly closeOnEscape = input(true);
  readonly blockScroll = input(false);
  readonly withFooter = input(false);

  protected readonly visible = signal(false);
}

@Component({
  selector: 'lib-drawer-headless-demo',
  imports: [Drawer, DrawerHeader, Button],
  template: `
    <div style="display: flex; gap: var(--space-3); flex-wrap: wrap;">
      <button libButton variant="outlined" (click)="headlessVisible.set(true)">
        Open headless drawer
      </button>
      <button libButton variant="outlined" severity="secondary" (click)="customVisible.set(true)">
        Open custom header drawer
      </button>
    </div>

    <!-- Headless: no built-in chrome at all; content owns the panel.
         With no header to point aria-labelledby at, ariaLabel is what
         keeps the dialog from being announced unnamed. -->
    <lib-drawer
      [(visible)]="headlessVisible"
      [closable]="false"
      position="right"
      ariaLabel="Koureia"
    >
      <div
        style="display: flex; flex-direction: column; gap: var(--space-4); height: 100%; padding: var(--space-6);"
      >
        <h2 style="margin: 0; font-family: var(--font-display); font-size: var(--text-xl);">
          Koureia
        </h2>
        <p style="margin: 0; color: var(--text-secondary); flex: 1;">
          Fully custom drawer surface — bring your own header, layout, and close affordance.
        </p>
        <button libButton (click)="headlessVisible.set(false)">Close</button>
      </div>
    </lib-drawer>

    <!-- Custom header content next to the built-in × button. -->
    <lib-drawer [(visible)]="customVisible" position="right">
      <div libDrawerHeader style="display: flex; align-items: center; gap: var(--space-3);">
        <strong style="font-family: var(--font-display); font-size: var(--text-lg);">
          Kimonas
        </strong>
        <span style="color: var(--text-muted); font-size: var(--text-sm);">Barber</span>
      </div>
      <p style="margin: 0; color: var(--text-secondary); font-size: var(--text-sm);">
        Next free slot: Friday 17:30.
      </p>
    </lib-drawer>
  `,
})
class DrawerHeadlessDemo {
  protected readonly headlessVisible = signal(false);
  protected readonly customVisible = signal(false);
}

@Component({
  selector: 'lib-drawer-push-demo',
  imports: [Drawer, Button],
  template: `
    <div
      style="display: flex; height: 20rem; border: var(--border-width-hairline) solid var(--border); border-radius: var(--radius-lg); overflow: hidden;"
    >
      <lib-drawer [(visible)]="visible" mode="push" position="left" header="Filters">
        <p style="margin: 0; color: var(--text-secondary); font-size: var(--text-sm);">
          The content on the right is pushed aside instead of covered.
        </p>
      </lib-drawer>

      <main style="flex: 1; min-width: 0; padding: var(--space-6);">
        <button libButton variant="outlined" (click)="visible.set(!visible())">
          Toggle push drawer
        </button>
        <p style="color: var(--text-secondary);">
          Page content — it reflows as the drawer opens and closes.
        </p>
      </main>
    </div>
  `,
})
class DrawerPushDemo {
  protected readonly visible = signal(true);
}

const meta: Meta<DrawerDemo> = {
  title: 'Overlays/Drawer',
  component: DrawerDemo,
  decorators: [
    // The drawer ships its own `drawer` Transloco scope, which needs a
    // root config to transpile against; there is no global provider.
    applicationConfig({
      providers: [
        provideTransloco({
          config: {
            availableLangs: ['el', 'en'],
            defaultLang: 'en',
            fallbackLang: 'en',
            missingHandler: { useFallbackTranslation: true },
          },
        }),
      ],
    }),
    moduleMetadata({
      imports: [DrawerDemo, DrawerHeadlessDemo, DrawerPushDemo],
    }),
  ],
  argTypes: {
    position: { control: 'select', options: POSITIONS },
    size: { control: 'select', options: SIZES },
    header: { control: 'text' },
    closable: { control: 'boolean' },
    modal: { control: 'boolean' },
    dismissible: { control: 'boolean' },
    showBackdrop: { control: 'boolean' },
    closeOnEscape: { control: 'boolean' },
    blockScroll: { control: 'boolean' },
    withFooter: { control: 'boolean' },
  },
  args: {
    position: 'left',
    size: 'md',
    header: 'Your booking',
    closable: true,
    modal: true,
    dismissible: true,
    showBackdrop: true,
    closeOnEscape: true,
    blockScroll: false,
    withFooter: false,
  },
};

export default meta;
type Story = StoryObj<DrawerDemo>;

/**
 * Interactive sandbox — click **Open drawer**, then flip any input with the
 * controls below to preview every combination. The rest of this page
 * documents each input in isolation.
 */
export const Playground: Story = {
  parameters: doc(
    'Use the **Controls** tab to combine any inputs, then click **Open ' +
      'drawer** to see the result. Every other example on this page pins a ' +
      'few inputs to isolate one behavior.',
    `
<button libButton variant="outlined" (click)="visible.set(true)">Open drawer</button>

<lib-drawer [(visible)]="visible" header="Your booking">
  <p>Skin fade with Kimonas — Friday at 17:30, 30 min, €18.</p>
</lib-drawer>
    `,
  ),
};

export const Right: Story = {
  args: { position: 'right' },
  parameters: doc(
    'Set `position` to `right` to slide the panel in from the right edge — ' +
      'the common placement for filters and detail panels.',
    `
<lib-drawer [(visible)]="visible" position="right" header="Your booking">…</lib-drawer>
    `,
  ),
};

export const Top: Story = {
  args: { position: 'top', size: 'sm' },
  parameters: doc(
    'With `position="top"` the panel drops down from the top edge. For ' +
      '`top`/`bottom` drawers `size` controls the panel **height**.',
    `
<lib-drawer [(visible)]="visible" position="top" size="sm" header="Your booking">…</lib-drawer>
    `,
  ),
};

export const Bottom: Story = {
  args: { position: 'bottom', size: 'sm' },
  parameters: doc(
    'With `position="bottom"` the panel rises from the bottom edge — a ' +
      'natural fit for mobile-style sheets.',
    `
<lib-drawer [(visible)]="visible" position="bottom" size="sm" header="Your booking">…</lib-drawer>
    `,
  ),
};

export const FullScreen: Story = {
  args: { position: 'full', header: 'Menu' },
  parameters: doc(
    'Set `position` to `full` for a drawer that covers the entire viewport. ' +
      'The `size` input is ignored in this mode.',
    `
<lib-drawer [(visible)]="visible" position="full" header="Menu">…</lib-drawer>
    `,
  ),
};

export const WithFooter: Story = {
  args: { position: 'right', withFooter: true, header: 'Confirm your booking' },
  parameters: doc(
    'Project content with `libDrawerFooter` to pin a footer to the bottom ' +
      'of the panel — ideal for confirm/cancel actions that stay in view ' +
      'while the body scrolls.',
    `
<lib-drawer [(visible)]="visible" position="right" header="Confirm your booking">
  <p>Skin fade with Kimonas — Friday at 17:30, 30 min, €18.</p>

  <div libDrawerFooter style="display: flex; justify-content: flex-end; gap: var(--space-3);">
    <button libButton variant="outlined" severity="secondary" (click)="visible.set(false)">
      Cancel
    </button>
    <button libButton (click)="visible.set(false)">Book it</button>
  </div>
</lib-drawer>
    `,
  ),
};

export const NonModal: Story = {
  args: { modal: false, header: 'Notes' },
  parameters: doc(
    'Set `modal` to `false` for a non-modal drawer: no mask, no focus trap, ' +
      'and the page behind stays interactive. Rendered with the native ' +
      '`<dialog>` `show()` instead of `showModal()`.',
    `
<lib-drawer [(visible)]="visible" [modal]="false" header="Notes">…</lib-drawer>
    `,
  ),
};

export const NoBackdrop: Story = {
  args: { showBackdrop: false, header: 'Notes' },
  parameters: doc(
    'Set `showBackdrop` to `false` to keep the drawer modal — focus is still ' +
      'trapped and mask clicks still close it — while leaving the page ' +
      'behind visually undimmed.',
    `
<lib-drawer [(visible)]="visible" [showBackdrop]="false" header="Notes">…</lib-drawer>
    `,
  ),
};

export const Headless: Story = {
  render: () => ({
    template: '<lib-drawer-headless-demo />',
  }),
  parameters: doc(
    'Omit `header` and set `closable` to `false` for a headless drawer with ' +
      'no built-in chrome — the projected content owns the whole panel. Name ' +
      'it with `ariaLabel` (or point `ariaLabelledby` at your own heading), ' +
      'since there is no built-in title to label the dialog. The second ' +
      'button shows projecting a custom header with `libDrawerHeader` ' +
      'alongside the built-in × close button.',
    `
<!-- Headless: ariaLabel is the only thing naming the dialog. -->
<lib-drawer [(visible)]="headlessVisible" [closable]="false" position="right" ariaLabel="Koureia">
  <div style="padding: var(--space-6);">
    <h2>Koureia</h2>
    <button libButton (click)="headlessVisible.set(false)">Close</button>
  </div>
</lib-drawer>

<!-- Custom header content next to the built-in × button. -->
<lib-drawer [(visible)]="customVisible" position="right">
  <div libDrawerHeader>
    <strong>Kimonas</strong>
    <span>Barber</span>
  </div>
  <p>Next free slot: Friday 17:30.</p>
</lib-drawer>
    `,
  ),
};

export const Push: Story = {
  render: () => ({
    template: '<lib-drawer-push-demo />',
  }),
  parameters: doc(
    'Set `mode` to `push` so the drawer participates in layout and pushes ' +
      'sibling content aside instead of floating over it. Place the drawer ' +
      'inside your own flex/grid container. Push drawers are always ' +
      'non-modal, and never take focus on open — they can start open as ' +
      'page furniture.',
    `
<div style="display: flex; height: 20rem;">
  <lib-drawer [(visible)]="visible" mode="push" position="left" header="Filters">
    <p>The content on the right is pushed aside instead of covered.</p>
  </lib-drawer>

  <main style="flex: 1; min-width: 0;">
    <button libButton variant="outlined" (click)="visible.set(!visible())">
      Toggle push drawer
    </button>
  </main>
</div>
    `,
  ),
};

export const Accessibility: Story = {
  args: { position: 'right', header: 'Your booking', withFooter: true },
  parameters: doc(
    [
      'The drawer is built on a native `<dialog>`, so modal accessibility ' +
        'behaviors come from the platform rather than hand-rolled scripting.',
      '',
      '- In modal mode it opens with `showModal()`, which **traps focus** ' +
        'inside the panel and marks everything behind it inert.',
      '- **`Escape` closes** the drawer while `closeOnEscape` is `true` ' +
        '(default); the exit transition still plays before it tears down.',
      '- Closing returns **focus to the element** that had it before the ' +
        'drawer opened, via the native `dialog.close()`.',
      '- The panel is labelled by its header — the title is wired to the ' +
        'dialog through `aria-labelledby` so screen readers announce it. ' +
        'A headless drawer has no title, so name it with **`ariaLabel`** or ' +
        '**`ariaLabelledby`**; a dialog with no name is announced unnamed.',
      '- The × close button always carries an accessible name: ' +
        "`closeAriaLabel`, falling back to the lib's own `drawer` Transloco " +
        'scope (Greek and English shipped) when it is left empty.',
      '- Opening lands focus on the × button — except in `push` mode, where ' +
        'a drawer can start open and would otherwise take focus on first ' +
        'paint.',
      '- Clicking the mask closes the drawer when `dismissible` is `true`; ' +
        'set `blockScroll` to stop the page behind from scrolling.',
    ].join('\n'),
    `
<lib-drawer
  [(visible)]="visible"
  position="right"
  header="Your booking"
  [closeAriaLabel]="'booking.closeDrawer' | transloco">
  …
</lib-drawer>

<!-- No header? Name the dialog yourself. -->
<lib-drawer [(visible)]="visible" [closable]="false" ariaLabel="Filters">…</lib-drawer>
    `,
  ),
};
