import { Component, inject, input } from '@angular/core';
import { applicationConfig, moduleMetadata, type Meta, type StoryObj } from '@storybook/angular';
import { provideTransloco } from '@jsverse/transloco';
import { Button } from '@ui/button';
import { Toaster } from './toaster';
import { ToasterService } from './toaster.service';
import { ToasterPosition } from './toaster.types';

const POSITIONS = [
  'top-left',
  'top-center',
  'top-right',
  'bottom-left',
  'bottom-center',
  'bottom-right',
] as const;

/**
 * A per-story description plus the snippet shown under "Show code".
 *
 * Every story renders through the demo wrapper below — a story object cannot
 * hold the service calls these examples need — so Storybook's generated source
 * would read `<lib-toaster-demo />`, the scaffolding rather than the API. The
 * trade-off is a static snippet: it does not follow the controls, so keep it in
 * step with the demo.
 */
const doc = (markdown: string, code: string, language = 'html') => ({
  docs: {
    description: { story: markdown },
    source: { code: code.trim(), language },
  },
});

const FIRE_CODE = `
// Once, in the app shell template: <lib-toaster position="bottom-right" />
private readonly toaster = inject(ToasterService);

this.toaster.success('Booking confirmed for Friday at 17:30');
this.toaster.error('That slot was just taken', 'Booking failed');
this.toaster.show({
  severity: 'error',
  title: 'Booking cancelled',
  message: 'Your Friday 17:30 appointment was cancelled.',
  action: { label: 'Undo', onClick: () => restore() },
});
await this.toaster.promise(save(), {
  loading: { message: 'Confirming your booking…' },
  success: { message: 'Booking confirmed', title: 'All set' },
  error: { message: 'Could not confirm booking' },
});
`;

@Component({
  selector: 'lib-toaster-demo',
  imports: [Toaster, Button],
  template: `
    <div
      style="display: flex; flex-direction: column; gap: var(--space-4); align-items: flex-start;"
    >
      <div style="display: flex; gap: var(--space-3); flex-wrap: wrap;">
        <button libButton variant="outlined" severity="secondary" (click)="notify()">
          Default
        </button>
        <button libButton variant="outlined" (click)="primary()">Primary</button>
        <button libButton variant="outlined" severity="success" (click)="success()">Success</button>
        <button libButton variant="outlined" severity="info" (click)="info()">Info</button>
        <button libButton variant="outlined" severity="warning" (click)="warning()">Warning</button>
        <button libButton variant="outlined" severity="error" (click)="error()">Error</button>
      </div>
      <div style="display: flex; gap: var(--space-3); flex-wrap: wrap;">
        <button libButton variant="outlined" severity="secondary" (click)="withTitle()">
          With title
        </button>
        <button libButton variant="outlined" severity="secondary" (click)="withAction()">
          With action
        </button>
        <button libButton variant="outlined" severity="secondary" (click)="sticky()">Sticky</button>
        <button libButton variant="outlined" severity="secondary" (click)="promise()">
          Promise
        </button>
        <button libButton variant="text" severity="secondary" (click)="dismissAll()">
          Dismiss all
        </button>
      </div>
    </div>

    <lib-toaster
      [position]="position()"
      [expand]="expand()"
      [closeButton]="closeButton()"
      [life]="life()"
      [visibleToasts]="visibleToasts()"
    />
  `,
})
class ToasterDemo {
  private readonly toaster = inject(ToasterService);

  readonly position = input<ToasterPosition>('bottom-right');
  readonly expand = input(false);
  readonly closeButton = input(true);
  readonly life = input(4000);
  readonly visibleToasts = input(3);

  protected notify(): void {
    this.toaster.show({ message: 'Your barber is running 10 min late' });
  }

  protected primary(): void {
    this.toaster.show({
      severity: 'primary',
      message: 'New loyalty reward unlocked',
    });
  }

  protected success(): void {
    this.toaster.success('Booking confirmed for Friday at 17:30');
  }

  protected info(): void {
    this.toaster.info('Kimonas has 3 slots left this week');
  }

  protected warning(): void {
    this.toaster.warning('Your booking starts in 15 min');
  }

  protected error(): void {
    this.toaster.error('That slot was just taken');
  }

  protected withTitle(): void {
    this.toaster.success(
      'Friday at 17:30 with Kimonas — skin fade, 30 min, €18',
      'Booking confirmed',
    );
  }

  protected withAction(): void {
    this.toaster.show({
      severity: 'error',
      title: 'Booking cancelled',
      message: 'Your Friday 17:30 appointment was cancelled.',
      action: { label: 'Undo' },
    });
  }

  protected sticky(): void {
    this.toaster.show({
      severity: 'warning',
      title: 'Shop closed on 15 Aug',
      message: 'Bookings for that day will be rescheduled.',
      sticky: true,
    });
  }

  protected promise(): void {
    void this.toaster
      .promise(new Promise((resolve) => setTimeout(resolve, 2000)), {
        loading: { message: 'Confirming your booking…' },
        success: { message: 'Booking confirmed', title: 'All set' },
        error: { message: 'Could not confirm booking' },
      })
      .catch(() => undefined);
  }

  protected dismissAll(): void {
    this.toaster.dismissAll();
  }
}

const meta: Meta<ToasterDemo> = {
  title: 'Feedback & status/Toast',
  component: ToasterDemo,
  decorators: [
    // The toaster ships its own `toaster` Transloco scope for the stack's and
    // the close button's names, and needs a root config to transpile against.
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
    moduleMetadata({ imports: [ToasterDemo] }),
  ],
  argTypes: {
    position: { control: 'select', options: POSITIONS },
    expand: { control: 'boolean' },
    closeButton: { control: 'boolean' },
    life: { control: 'number' },
    visibleToasts: { control: 'number' },
  },
  args: {
    position: 'bottom-right',
    expand: false,
    closeButton: true,
    life: 4000,
    visibleToasts: 3,
  },
};

export default meta;
type Story = StoryObj<ToasterDemo>;

/**
 * Interactive sandbox — trigger toasts with the buttons and flip any
 * toaster input with the controls below. Toasts are fired through
 * `ToasterService`; the `<lib-toaster>` renders the stack for all of them.
 */
export const Playground: Story = {
  parameters: doc(
    'Fire toasts with the buttons, then use the **Controls** tab to change ' +
      '`position`, `expand`, `closeButton`, `life`, and `visibleToasts`. The ' +
      'top row shows one toast per severity; the bottom row shows toasts with ' +
      'a title, an action button, a sticky toast, and a `promise()` toast that ' +
      'resolves from loading into success.',
    FIRE_CODE,
    'ts',
  ),
};

export const TopCenter: Story = {
  args: { position: 'top-center' },
  parameters: doc(
    'Set `position` to anchor the stack to any of the six screen corners — ' +
      'here `top-center`. New toasts enter from the anchored edge and older ' +
      'ones stack away from it.',
    `<lib-toaster position="top-center" />`,
  ),
};

export const Expanded: Story = {
  args: { expand: true },
  parameters: doc(
    'Set `expand` to keep the stack fully open instead of collapsing older ' +
      'toasts behind the front one. When collapsed (the default), hovering the ' +
      'stack expands it temporarily.',
    `<lib-toaster expand />`,
  ),
};

export const Accessibility: Story = {
  parameters: doc(
    [
      'Toasts announce themselves to assistive tech and stay operable by ' +
        'keyboard and pointer alike.',
      '',
      '- Each toast is announced through an `aria-live` region so screen ' +
        'readers hear it **without moving focus** — the current task is never ' +
        'interrupted.',
      '- The severity is carried by the **icon shape** as well as its colour, ' +
        'and the message always says what happened, so nothing depends on ' +
        'colour alone.',
      '- The close button on sticky toasts is a real `<button>`, reachable by ' +
        'keyboard, named from the lib’s own translations unless ' +
        '`closeAriaLabel` overrides it.',
      '- Auto-dismiss **pauses while the stack is hovered, while a toast holds ' +
        'keyboard focus, and while the tab is hidden**, so a toast never ' +
        'disappears out from under whoever is reading it.',
      '- Dismissing the toast that holds focus **moves focus on** — to the next ' +
        'toast in the stack, or back to whatever had it before — rather than ' +
        'dropping it on `<body>`.',
      '- Text and icon color contrast meet **WCAG AA** in both light and dark ' +
        'themes across every severity, and both buttons keep a visible border ' +
        'under a forced palette.',
    ].join('\n'),
    `
<!-- The stack and the close button are named from the lib's translations;
     override either when the app has better words for them. -->
<lib-toaster ariaLabel="Booking updates" closeAriaLabel="Dismiss" />
`,
  ),
};
