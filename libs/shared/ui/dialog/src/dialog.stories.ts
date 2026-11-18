import { Component, input, signal } from '@angular/core';
import { provideTransloco } from '@jsverse/transloco';
import { applicationConfig, moduleMetadata, type Meta, type StoryObj } from '@storybook/angular';
import { Button } from '@ui/button';
import { Dialog, DialogFooter, DialogHeader, DialogHeadless } from './dialog';
import { DialogMaxHeight, DialogPosition, DialogSize } from './dialog.types';

const POSITIONS: readonly DialogPosition[] = [
  'center',
  'top',
  'top-right',
  'right',
  'bottom-right',
  'bottom',
  'bottom-left',
  'left',
  'top-left',
];
const SIZES: readonly DialogSize[] = ['sm', 'md', 'lg', 'xl'];
const MAX_HEIGHTS: readonly DialogMaxHeight[] = ['sm', 'md', 'lg', 'viewport'];

/**
 * A per-story description plus the consumer-facing snippet Storybook shows under
 * "Show code". Every story overrides it: the generated source would otherwise be
 * the `<lib-dialog-demo />` scaffolding, which is not the API.
 */
const doc = (markdown: string, code: string, language = 'html') => ({
  docs: {
    description: { story: markdown },
    source: { code: code.trim(), language },
  },
});

@Component({
  selector: 'lib-dialog-demo',
  imports: [Dialog, DialogFooter, Button],
  template: `
    <button libButton variant="outlined" (click)="visible.set(true)">Open dialog</button>

    <lib-dialog
      [(visible)]="visible"
      [position]="position()"
      [size]="size()"
      [maxHeight]="maxHeight()"
      [header]="header()"
      [modal]="modal()"
      [dismissible]="dismissible()"
      [draggable]="draggable()"
      [maximizable]="maximizable()"
      [fullScreen]="fullScreen()"
    >
      <p class="demo-copy">
        Review the booking details before continuing. The dialog stays responsive as the viewport
        narrows.
      </p>

      <ng-template libDialogFooter>
        <button
          libButton
          type="button"
          variant="outlined"
          severity="secondary"
          (click)="visible.set(false)"
        >
          Cancel
        </button>
        <button libButton type="button" (click)="visible.set(false)">Save</button>
      </ng-template>
    </lib-dialog>
  `,
  styles: `
    .demo-copy {
      margin: 0;
      color: var(--text-secondary);
      line-height: var(--leading-normal);
    }
  `,
})
class DialogDemo {
  readonly position = input<DialogPosition>('center');
  readonly size = input<DialogSize>('md');
  readonly maxHeight = input<DialogMaxHeight>('viewport');
  readonly header = input('Edit booking');
  readonly modal = input(true);
  readonly dismissible = input(false);
  readonly draggable = input(false);
  readonly maximizable = input(false);
  readonly fullScreen = input(false);
  protected readonly visible = signal(false);
}

@Component({
  selector: 'lib-dialog-template-demo',
  imports: [Dialog, DialogHeader, DialogFooter, Button],
  template: `
    <button libButton variant="outlined" (click)="visible.set(true)">Open templated dialog</button>

    <lib-dialog [(visible)]="visible" ariaLabel="Kimonas appointment">
      <div libDialogHeader class="custom-heading">
        <span class="avatar" aria-hidden="true">K</span>
        <span>
          <strong>Kimonas</strong>
          <small>Friday, 17:30</small>
        </span>
      </div>

      <p class="body-copy">Skin fade • 30 min • €18</p>

      <ng-template libDialogFooter>
        <button libButton variant="outlined" severity="secondary" (click)="visible.set(false)">
          Not now
        </button>
        <button libButton (click)="visible.set(false)">Confirm</button>
      </ng-template>
    </lib-dialog>
  `,
  styles: `
    .custom-heading {
      display: flex;
      align-items: center;
      gap: var(--space-3);
    }
    .custom-heading > span:last-child {
      display: flex;
      flex-direction: column;
    }
    .custom-heading strong {
      font-family: var(--font-display);
      font-size: var(--text-lg);
    }
    .custom-heading small,
    .body-copy {
      color: var(--text-secondary);
    }
    .avatar {
      display: grid;
      place-items: center;
      width: var(--space-10);
      height: var(--space-10);
      border-radius: var(--radius-pill);
      background: var(--accent-subtle);
      color: var(--accent);
      font-family: var(--font-display);
      font-weight: var(--weight-bold);
    }
    .body-copy {
      margin: 0;
    }
  `,
})
class DialogTemplateDemo {
  protected readonly visible = signal(false);
}

@Component({
  selector: 'lib-dialog-long-content-demo',
  imports: [Dialog, DialogFooter, Button],
  template: `
    <button libButton variant="outlined" (click)="visible.set(true)">Read policies</button>
    <lib-dialog [(visible)]="visible" header="Booking policies" size="lg" maxHeight="md">
      @for (paragraph of paragraphs; track $index) {
        <p>{{ paragraph }}</p>
      }
      <ng-template libDialogFooter>
        <button libButton (click)="visible.set(false)">I understand</button>
      </ng-template>
    </lib-dialog>
  `,
  styles: `
    p {
      margin: 0 0 var(--space-4);
      color: var(--text-secondary);
      line-height: var(--leading-normal);
    }
    p:last-child {
      margin-bottom: 0;
    }
  `,
})
class DialogLongContentDemo {
  protected readonly visible = signal(false);
  protected readonly paragraphs = Array.from(
    { length: 12 },
    (_, index) =>
      `Policy ${index + 1}. Please arrive a few minutes before the appointment so the service can begin on time.`,
  );
}

@Component({
  selector: 'lib-dialog-headless-demo',
  imports: [Dialog, DialogHeadless, Button],
  template: `
    <button libButton variant="outlined" (click)="visible.set(true)">Open headless dialog</button>
    <lib-dialog [(visible)]="visible" ariaLabel="Welcome to Koureia" size="sm">
      <ng-template libDialogHeadless let-dialog>
        <section class="headless-card">
          <span class="eyebrow">Koureia</span>
          <h2>Your chair is ready</h2>
          <p>Choose a barber and reserve a time without calling the shop.</p>
          <button libButton (click)="dialog.close()">Find a time</button>
        </section>
      </ng-template>
    </lib-dialog>
  `,
  styles: `
    .headless-card {
      display: grid;
      gap: var(--space-4);
      padding: var(--space-8);
      text-align: center;
    }
    .eyebrow {
      color: var(--accent);
      font-size: var(--text-sm);
      font-weight: var(--weight-bold);
    }
    h2 {
      margin: 0;
      font-family: var(--font-display);
      font-size: var(--text-xl);
    }
    p {
      margin: 0;
      color: var(--text-secondary);
    }
    button {
      justify-self: center;
    }
  `,
})
class DialogHeadlessDemo {
  protected readonly visible = signal(false);
}

const meta: Meta<DialogDemo> = {
  title: 'Overlays/Dialog',
  component: DialogDemo,
  decorators: [
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
      imports: [DialogTemplateDemo, DialogLongContentDemo, DialogHeadlessDemo],
    }),
  ],
  argTypes: {
    position: { control: 'select', options: POSITIONS },
    size: { control: 'select', options: SIZES },
    maxHeight: { control: 'select', options: MAX_HEIGHTS },
    header: { control: 'text' },
    modal: { control: 'boolean' },
    dismissible: { control: 'boolean' },
    draggable: { control: 'boolean' },
    maximizable: { control: 'boolean' },
    fullScreen: { control: 'boolean' },
  },
  args: {
    position: 'center',
    size: 'md',
    maxHeight: 'viewport',
    header: 'Edit booking',
    modal: true,
    dismissible: false,
    draggable: false,
    maximizable: false,
    fullScreen: false,
  },
};

export default meta;
type Story = StoryObj<DialogDemo>;

export const Basic: Story = {
  parameters: doc(
    'Visibility is controlled with the two-way `[(visible)]` model.',
    `
<button libButton variant="outlined" (click)="open.set(true)">Open dialog</button>

<lib-dialog [(visible)]="open" header="Edit booking">
  <p>Review the booking details before continuing.</p>

  <ng-template libDialogFooter>
    <button libButton variant="outlined" severity="secondary" (click)="open.set(false)">
      Cancel
    </button>
    <button libButton (click)="open.set(false)">Save</button>
  </ng-template>
</lib-dialog>
    `,
  ),
};

export const Template: Story = {
  render: () => ({ template: '<lib-dialog-template-demo />' }),
  parameters: doc(
    'Project a custom `[libDialogHeader]` and an `<ng-template libDialogFooter>` while retaining the native dialog lifecycle.',
    `
<lib-dialog [(visible)]="open" ariaLabel="Kimonas appointment">
  <div libDialogHeader class="custom-heading">
    <span class="avatar" aria-hidden="true">K</span>
    <span>
      <strong>Kimonas</strong>
      <small>Friday, 17:30</small>
    </span>
  </div>

  <p>Skin fade &bull; 30 min &bull; &euro;18</p>

  <ng-template libDialogFooter>
    <button libButton variant="outlined" severity="secondary" (click)="open.set(false)">
      Not now
    </button>
    <button libButton (click)="open.set(false)">Confirm</button>
  </ng-template>
</lib-dialog>
    `,
  ),
};

export const Draggable: Story = {
  args: { draggable: true, header: 'Move this note' },
  parameters: doc(
    'Drag from the header with a pointer. The move button provides a non-drag, keyboard-accessible chooser for all nine positions.',
    `
<!-- One flag adds both the pointer drag and the accessible position chooser. -->
<lib-dialog [(visible)]="open" header="Move this note" draggable (dragEnded)="onDragEnd($event)">
  <p>Drag me by the header, or use the move button.</p>
</lib-dialog>
    `,
  ),
};

export const Position: Story = {
  args: { position: 'bottom-right', size: 'sm', header: 'Bottom-right dialog' },
  parameters: doc(
    'The typed `position` model covers the center, four edges, and four corners.',
    `
<!-- Two-way: the position chooser writes the user's pick back into your signal. -->
<lib-dialog [(visible)]="open" [(position)]="position" size="sm" header="Bottom-right dialog">
  <p>Placed at one of the nine semantic positions.</p>
</lib-dialog>
    `,
  ),
};

export const Maximizable: Story = {
  args: { maximizable: true, size: 'lg', header: 'Appointment details' },
  parameters: doc(
    '`maximizable` adds a translated maximize control and exposes `[(maximized)]`. The button keeps one stable name and reports its state on `aria-pressed`.',
    `
<lib-dialog
  [(visible)]="open"
  [(maximized)]="maximized"
  size="lg"
  header="Appointment details"
  maximizable
>
  <p>Toggle the maximize control, or drive it from the model.</p>
</lib-dialog>
    `,
  ),
};

export const FullScreen: Story = {
  args: { fullScreen: true, header: 'Gallery' },
  parameters: doc(
    '`fullScreen` permanently fills the dynamic viewport and hides move/maximize controls.',
    `
<lib-dialog [(visible)]="open" header="Gallery" fullScreen>
  <p>Always full-viewport; the move and maximize tools are withheld.</p>
</lib-dialog>
    `,
  ),
};

export const Modal: Story = {
  args: { modal: true, dismissible: true },
  parameters: doc(
    'Modal mode uses native `showModal()`: the page is inert, focus stays inside, and the backdrop can optionally dismiss.',
    `
<!-- modal is the default; dismissible opts into backdrop-click close. -->
<lib-dialog [(visible)]="open" header="Edit booking" dismissible (closed)="onClosed($event)">
  <p>The closed event reports reason: 'backdrop' when the scrim was clicked.</p>
</lib-dialog>
    `,
  ),
};

export const WithoutModal: Story = {
  args: { modal: false, position: 'right', size: 'sm', header: 'Reference notes' },
  parameters: doc(
    'Non-modal mode uses native `show()`, has no backdrop or focus trap, and leaves the page interactive.',
    `
<lib-dialog
  [(visible)]="open"
  [modal]="false"
  position="right"
  size="sm"
  header="Reference notes"
>
  <p>The page behind stays fully interactive.</p>
</lib-dialog>
    `,
  ),
};

export const LongContent: Story = {
  render: () => ({ template: '<lib-dialog-long-content-demo />' }),
  parameters: doc(
    '`maxHeight="md"` gives this example a stable ceiling. Only the body scrolls; the header and action footer remain pinned.',
    `
<lib-dialog [(visible)]="open" header="Booking policies" size="lg" maxHeight="md">
  @for (paragraph of paragraphs; track $index) {
    <p>{{ paragraph }}</p>
  }

  <ng-template libDialogFooter>
    <button libButton (click)="open.set(false)">I understand</button>
  </ng-template>
</lib-dialog>
    `,
  ),
};

export const Responsive: Story = {
  args: { size: 'xl', header: 'Responsive event editor' },
  parameters: doc(
    'Every size is intrinsically clamped to the dynamic viewport with token-backed gutters; resize the canvas to verify.',
    `
<!-- No media query needed: xl resolves to min(--dialog-size-xl, viewport - gutters). -->
<lib-dialog [(visible)]="open" size="xl" header="Responsive event editor">
  <p>The widest preset, still clamped to the viewport.</p>
</lib-dialog>
    `,
  ),
};

export const Headless: Story = {
  render: () => ({ template: '<lib-dialog-headless-demo />' }),
  parameters: doc(
    '`libDialogHeadless` replaces all built-in chrome and exposes close/maximize/restore/move methods in its template context.',
    `
<!-- Headless drops the header, content and footer regions, so the dialog needs
     an explicit accessible name. -->
<lib-dialog [(visible)]="open" ariaLabel="Welcome to Koureia" size="sm">
  <ng-template libDialogHeadless let-dialog>
    <section class="headless-card">
      <h2>Your chair is ready</h2>
      <p>Choose a barber and reserve a time without calling the shop.</p>
      <button libButton (click)="dialog.close()">Find a time</button>
    </section>
  </ng-template>
</lib-dialog>
    `,
  ),
};

export const Accessibility: Story = {
  args: { draggable: true, maximizable: true },
  parameters: doc(
    [
      'The native `<dialog>` supplies modal focus containment, background inertness, Escape handling, and focus restoration.',
      '',
      '- The built-in or custom heading names the dialog through `aria-labelledby`; `ariaLabel` and `ariaLabelledBy` can override it.',
      '- Control labels ship in Greek and English through the `dialog` Transloco scope, and the icons inside them are `aria-hidden` decoration.',
      '- Long structured content is not forced into `aria-describedby`; opt in with `ariaDescribedBy` only for concise descriptions.',
      '- The maximize control keeps a stable name and carries its state on `aria-pressed`, so the label is never re-announced while the button holds focus.',
      '- `Escape` inside the position chooser dismisses only the chooser — it never closes a non-modal dialog along with it.',
      '- Free dragging is optional and has the move-position chooser as a non-drag alternative.',
    ].join('\n'),
    `
<lib-dialog
  [(visible)]="open"
  header="Edit booking"
  draggable
  maximizable
  ariaDescribedBy="booking-summary"
>
  <p id="booking-summary">Skin fade with Kimonas, Friday at 17:30.</p>
</lib-dialog>
    `,
  ),
};
