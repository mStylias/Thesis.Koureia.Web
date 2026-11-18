import { ChangeDetectionStrategy, Component, signal } from '@angular/core';
import { LucideCalendar, LucideScissors, LucideSettings, LucideUsers } from '@lucide/angular';

interface ColourToken {
  readonly name: string;
  readonly token: string;
}

interface TypeSample {
  readonly className: string;
  readonly label: string;
  readonly sample: string;
}

interface FoundationToken {
  readonly label: string;
  readonly token: string;
}

@Component({
  selector: 'lib-foundation-colour-showcase',
  template: `
    <section class="foundation" aria-labelledby="colour-title">
      <header class="foundation__header">
        <p class="t-label">Foundation</p>
        <h2 id="colour-title" class="t-h2">Colour</h2>
        <p class="t-body">
          The brand ramp is the system’s only accent. Use semantic tokens in components so every
          colour responds to the toolbar theme.
        </p>
      </header>

      <aside class="foundation-callout">
        <strong>Primary and accent are the same role</strong>
        <p>
          The primary colour is exposed as <code>--accent</code> in CSS. There is no separate
          secondary accent colour; the brand ramp carries interactive emphasis throughout.
        </p>
      </aside>

      @for (group of groups; track group.label) {
        <section class="foundation__section" [attr.aria-labelledby]="group.id">
          <h3 class="t-title" [id]="group.id">{{ group.label }}</h3>
          <div class="colour-grid">
            @for (colour of group.colours; track colour.token) {
              <article class="token-card">
                <div
                  class="colour-swatch"
                  [style.background]="'var(' + colour.token + ')'"
                  aria-hidden="true"
                ></div>
                <div class="token-card__copy">
                  <strong>{{ colour.name }}</strong>
                  <code>{{ colour.token }}</code>
                </div>
              </article>
            }
          </div>
        </section>
      }
    </section>
  `,
  styleUrl: './foundation-showcases.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class FoundationColourShowcase {
  protected readonly groups = [
    {
      id: 'brand-primary-colours',
      label: 'Brand primary',
      colours: [
        { name: 'Primary', token: '--accent' },
        { name: 'Primary hover', token: '--accent-hover' },
        { name: 'Primary active', token: '--accent-active' },
        { name: 'On primary', token: '--accent-fg' },
        { name: 'Primary subtle', token: '--accent-subtle' },
        { name: 'Primary subtle border', token: '--accent-subtle-border' },
      ] satisfies ColourToken[],
    },
    {
      id: 'semantic-colours',
      label: 'Surfaces and content',
      colours: [
        { name: 'Background', token: '--bg' },
        { name: 'Surface', token: '--surface' },
        { name: 'Raised surface', token: '--surface-2' },
        { name: 'Sunken surface', token: '--surface-sunken' },
        { name: 'Primary text', token: '--text-primary' },
        { name: 'Secondary text', token: '--text-secondary' },
        { name: 'Border', token: '--border' },
      ] satisfies ColourToken[],
    },
    {
      id: 'status-colours',
      label: 'Status',
      colours: [
        { name: 'Success', token: '--success' },
        { name: 'Warning', token: '--warning' },
        { name: 'Error', token: '--error' },
        { name: 'Info', token: '--info' },
      ] satisfies ColourToken[],
    },
  ] as const;
}

@Component({
  selector: 'lib-foundation-typography-showcase',
  template: `
    <section class="foundation" aria-labelledby="typography-title">
      <header class="foundation__header">
        <p class="t-label">Foundation</p>
        <h2 id="typography-title" class="t-h2">Typography</h2>
        <p class="t-body">
          Alegreya gives display moments warmth, Alegreya Sans keeps interface copy clear, and
          JetBrains Mono makes times and prices easy to scan.
        </p>
      </header>

      <div class="type-list">
        @for (item of samples; track item.className) {
          <article class="type-sample">
            <div class="type-sample__meta">
              <strong>{{ item.label }}</strong>
              <code>.{{ item.className }}</code>
            </div>
            <p [class]="item.className">{{ item.sample }}</p>
          </article>
        }
      </div>
    </section>
  `,
  styleUrl: './foundation-showcases.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class FoundationTypographyShowcase {
  protected readonly samples: readonly TypeSample[] = [
    { className: 't-display', label: 'Display', sample: 'Barbershop' },
    { className: 't-h1', label: 'Heading 1', sample: 'Your next great haircut' },
    { className: 't-h2', label: 'Heading 2', sample: 'Choose your service' },
    { className: 't-h3', label: 'Heading 3', sample: 'Available barbers' },
    { className: 't-title', label: 'Title', sample: 'Classic haircut' },
    {
      className: 't-body',
      label: 'Body',
      sample: 'Book a time that works for you, in just a few steps.',
    },
    { className: 't-body-sm', label: 'Body small', sample: 'Usually takes 30 minutes.' },
    { className: 't-label', label: 'Label', sample: 'Upcoming appointment' },
    { className: 't-caption', label: 'Caption', sample: 'Prices include VAT' },
    { className: 't-mono', label: 'Mono', sample: '17:30 • €18 • KR-2048' },
  ];
}

@Component({
  selector: 'lib-foundation-spacing-showcase',
  template: `
    <section class="foundation" aria-labelledby="spacing-title">
      <header class="foundation__header">
        <p class="t-label">Foundation</p>
        <h2 id="spacing-title" class="t-h2">Spacing</h2>
        <p class="t-body">
          A four-pixel base grid creates a compact, predictable rhythm. Tokens use rem units so
          spacing respects the user’s font-size preference.
        </p>
      </header>

      <div class="spacing-list">
        @for (space of spaces; track space.token) {
          <div class="spacing-row">
            <code>{{ space.token }}</code>
            <div
              class="spacing-bar"
              [style.width]="'var(' + space.token + ')'"
              aria-hidden="true"
            ></div>
            <span>{{ space.label }}</span>
          </div>
        }
      </div>
    </section>
  `,
  styleUrl: './foundation-showcases.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class FoundationSpacingShowcase {
  protected readonly spaces: readonly FoundationToken[] = [
    { token: '--space-1', label: '4px' },
    { token: '--space-2', label: '8px' },
    { token: '--space-3', label: '12px' },
    { token: '--space-4', label: '16px' },
    { token: '--space-5', label: '20px' },
    { token: '--space-6', label: '24px' },
    { token: '--space-8', label: '32px' },
    { token: '--space-10', label: '40px' },
    { token: '--space-12', label: '48px' },
    { token: '--space-16', label: '64px' },
    { token: '--space-20', label: '80px' },
  ];
}

@Component({
  selector: 'lib-foundation-elevation-showcase',
  template: `
    <section class="foundation" aria-labelledby="elevation-title">
      <header class="foundation__header">
        <p class="t-label">Foundation</p>
        <h2 id="elevation-title" class="t-h2">Elevation</h2>
        <p class="t-body">
          Warm, restrained shadows separate layers. Dark mode automatically shifts toward stronger
          borders and near-black shadows.
        </p>
      </header>

      <div class="elevation-grid">
        @for (level of levels; track level.token) {
          <article class="elevation-card" [style.box-shadow]="'var(' + level.token + ')'">
            <strong>{{ level.label }}</strong>
            <code>{{ level.token }}</code>
            <span>{{ level.use }}</span>
          </article>
        }
      </div>
    </section>
  `,
  styleUrl: './foundation-showcases.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class FoundationElevationShowcase {
  protected readonly levels = [
    { token: '--shadow-sm', label: 'Small', use: 'Chips and subtle lift' },
    { token: '--shadow-md', label: 'Medium', use: 'Cards and menus' },
    { token: '--shadow-lg', label: 'Large', use: 'Dialogs and drawers' },
    { token: '--shadow-accent', label: 'Accent', use: 'Rare call-to-action emphasis' },
  ] as const;
}

@Component({
  selector: 'lib-foundation-motion-showcase',
  template: `
    <section class="foundation" aria-labelledby="motion-title">
      <header class="foundation__header">
        <p class="t-label">Foundation</p>
        <h2 id="motion-title" class="t-h2">Motion</h2>
        <p class="t-body">
          Motion is quick and purposeful: ease out for entry, exit, and anything the user pressed;
          in-out for movement already on screen; only transform or opacity.
        </p>
      </header>

      <div class="motion-tokens">
        @for (duration of durations; track duration.token) {
          <div class="motion-token">
            <strong>{{ duration.label }}</strong>
            <code>{{ duration.token }}</code>
            <span>{{ duration.value }}</span>
          </div>
        }
      </div>

      <section class="foundation__section" aria-labelledby="motion-easing-title">
        <div class="motion-demo__heading">
          <div>
            <h3 id="motion-easing-title" class="t-title">Easing</h3>
            <p class="t-body-sm">
              Every curve, run over the same distance and duration. Watch the first moments, not the
              whole trip: perceived responsiveness is decided in the first two or three frames. Pick
              on <strong>travel distance</strong> as well as category — an in-out ramp that is
              invisible over 20px is glaring over 200px.
            </p>
          </div>
          <button class="foundation-button" type="button" (click)="runEasings()">Play all</button>
        </div>

        @for (family of easingFamilies; track family.label) {
          <div class="easing-family">
            <h4 class="t-label">{{ family.label }}</h4>
            <p class="t-body-sm">{{ family.use }}</p>
            @for (ease of family.tokens; track ease) {
              <div class="easing-row">
                <code>--ease-{{ ease }}</code>
                <div class="easing-track">
                  <span
                    class="easing-dot"
                    [class.is-running]="easingRun()"
                    [style.transition-timing-function]="'var(--ease-' + ease + ')'"
                  ></span>
                </div>
              </div>
            }
          </div>
        }
      </section>

      <section class="foundation__section" aria-labelledby="motion-demo-title">
        <div class="motion-demo__heading">
          <div>
            <h3 id="motion-demo-title" class="t-title">Enter and leave</h3>
            <p class="t-body-sm">Angular waits for the leave animation before removing the card.</p>
          </div>
          <button
            class="foundation-button"
            type="button"
            (click)="visible.update((value) => !value)"
          >
            {{ visible() ? 'Hide example' : 'Show example' }}
          </button>
        </div>

        <div class="motion-stage">
          @if (visible()) {
            <article
              class="motion-card"
              animate.enter="foundation-motion-enter"
              animate.leave="foundation-motion-leave"
            >
              <span class="motion-card__mark" aria-hidden="true"></span>
              <div>
                <strong>Appointment confirmed</strong>
                <p>Saturday at 17:30</p>
              </div>
            </article>
          }
        </div>
      </section>
    </section>
  `,
  styleUrl: './foundation-showcases.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class FoundationMotionShowcase {
  protected readonly visible = signal(true);
  protected readonly durations = [
    { token: '--dur-fast', label: 'Fast', value: '120ms' },
    { token: '--dur-base', label: 'Base', value: '180ms' },
    { token: '--dur-slow', label: 'Slow', value: '260ms' },
    { token: '--dur-slower', label: 'Slower', value: '300ms' },
  ] as const;

  protected readonly easingFamilies = [
    {
      label: 'Semantic defaults',
      use: 'Reach for these first; drop to the scale below only when one is wrong.',
      tokens: ['out', 'standard'],
    },
    {
      label: 'Out — weak to strong',
      use: 'Entrances, exits, and any direct response to a press. Leaves immediately.',
      tokens: ['out-quad', 'out-cubic', 'out-quart', 'out-quint', 'out-expo', 'out-circ'],
    },
    {
      label: 'In-out — weak to strong',
      use: 'On-screen elements moving without direct input. Every one of these eases in — check the ramp against your travel distance.',
      tokens: [
        'in-out-quad',
        'in-out-cubic',
        'in-out-quart',
        'in-out-quint',
        'in-out-expo',
        'in-out-circ',
      ],
    },
    {
      label: 'Springs',
      use: 'A damped oscillator baked into linear(), so the compositor runs it like any other curve — spring feel, no JavaScript. Pair with a slow duration; the tail is the point.',
      tokens: ['spring', 'spring-bounce'],
    },
  ] as const;

  protected readonly easingRun = signal(false);

  /** Retriggers every track at once so the curves can be compared. */
  protected runEasings(): void {
    this.easingRun.update((running) => !running);
  }
}

@Component({
  selector: 'lib-foundation-icons-showcase',
  imports: [LucideCalendar, LucideScissors, LucideSettings, LucideUsers],
  template: `
    <section class="foundation" aria-labelledby="icons-title">
      <header class="foundation__header">
        <p class="t-label">Foundation</p>
        <h2 id="icons-title" class="t-h2">Icons</h2>
        <p class="t-body">
          Use Lucide icons with currentColor, the shared stroke weight, and one of the three size
          tokens. Icons support labels; they do not replace them.
        </p>
      </header>

      <div class="icon-grid">
        <article class="icon-card">
          <svg lucideScissors aria-hidden="true"></svg>
          <strong>Services</strong>
          <code>LucideScissors</code>
        </article>
        <article class="icon-card">
          <svg lucideCalendar aria-hidden="true"></svg>
          <strong>Bookings</strong>
          <code>LucideCalendar</code>
        </article>
        <article class="icon-card">
          <svg lucideUsers aria-hidden="true"></svg>
          <strong>Customers</strong>
          <code>LucideUsers</code>
        </article>
        <article class="icon-card">
          <svg lucideSettings aria-hidden="true"></svg>
          <strong>Settings</strong>
          <code>LucideSettings</code>
        </article>
      </div>

      <section class="foundation__section" aria-labelledby="icon-sizes-title">
        <h3 id="icon-sizes-title" class="t-title">Sizes</h3>
        <div class="icon-sizes">
          @for (size of iconSizes; track size.token) {
            <div>
              <svg
                lucideScissors
                [style.width]="'var(' + size.token + ')'"
                [style.height]="'var(' + size.token + ')'"
                aria-hidden="true"
              ></svg>
              <code>{{ size.token }}</code>
            </div>
          }
        </div>
      </section>
    </section>
  `,
  styleUrl: './foundation-showcases.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class FoundationIconsShowcase {
  protected readonly iconSizes: readonly FoundationToken[] = [
    { token: '--icon-size-sm', label: 'Small' },
    { token: '--icon-size-md', label: 'Medium' },
    { token: '--icon-size-lg', label: 'Large' },
  ];
}
