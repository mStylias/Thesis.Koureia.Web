import { Component, DestroyRef, inject, input, signal } from '@angular/core';
import { moduleMetadata, type Meta, type StoryObj } from '@storybook/angular';
import { LucideLoaderCircle, LucideRefreshCw } from '@lucide/angular';
import { Button } from '@ui/button';
import { Spin } from './spin';

const doc = (markdown: string, code: string, language = 'html') => ({
  docs: {
    description: { story: markdown },
    source: { code: code.trim(), language },
  },
});

const ROW = 'display: flex; align-items: center; gap: var(--space-3); flex-wrap: wrap;';
const HINT = 'color: var(--text-secondary); font-size: var(--text-sm); margin: 0;';

@Component({
  selector: 'lib-spin-demo',
  imports: [Button, Spin, LucideRefreshCw],
  template: `
    <div style="${ROW}">
      <button
        libButton
        type="button"
        severity="secondary"
        variant="text"
        iconOnly
        aria-label="Refresh"
        [attr.aria-busy]="loading() || null"
        (click)="refresh()"
      >
        <svg lucideRefreshCw [libSpin]="loading()" aria-hidden="true"></svg>
      </button>
      <p style="${HINT}">{{ loading() ? 'Loading…' : 'Press to load for ' + ms() + 'ms' }}</p>
    </div>
  `,
})
class SpinDemo {
  /** How long the simulated load takes. */
  readonly ms = input(1500);

  protected readonly loading = signal(false);
  private timer: ReturnType<typeof setTimeout> | undefined;

  constructor() {
    inject(DestroyRef).onDestroy(() => {
      clearTimeout(this.timer);
    });
  }

  protected refresh(): void {
    if (this.loading()) {
      return;
    }
    this.loading.set(true);
    this.timer = setTimeout(() => {
      this.loading.set(false);
    }, this.ms());
  }
}

@Component({
  selector: 'lib-spin-toggle-demo',
  imports: [Button, Spin, LucideRefreshCw, LucideLoaderCircle],
  template: `
    <div style="${ROW}">
      <button libButton type="button" severity="secondary" (click)="busy.set(!busy())">
        {{ busy() ? 'Stop' : 'Start' }}
      </button>
      <svg lucideRefreshCw [libSpin]="busy()" aria-hidden="true"></svg>
      <svg lucideLoaderCircle [libSpin]="busy()" aria-hidden="true"></svg>
    </div>
  `,
})
class SpinToggleDemo {
  protected readonly busy = signal(false);
}

const meta: Meta<SpinDemo> = {
  title: 'Feedback & status/Spin',
  component: SpinDemo,
  decorators: [moduleMetadata({ imports: [SpinDemo, SpinToggleDemo] })],
  tags: ['autodocs'],
};

export default meta;

type Story = StoryObj<SpinDemo>;

export const Refresh: Story = {
  args: { ms: 1500 },
  argTypes: { ms: { control: { type: 'range', min: 50, max: 5000, step: 50 } } },
  render: (args) => ({
    props: args,
    template: `<lib-spin-demo [ms]="ms" />`,
  }),
  parameters: doc(
    'The icon turns while the load runs. When the load ends, the icon finishes its turn and ' +
      'comes to rest where it started. Set a short load to see the one full turn every press gets.',
    `
<button libButton iconOnly [attr.aria-busy]="loading() || null" aria-label="Refresh" (click)="refresh()">
  <svg lucideRefreshCw [libSpin]="loading()" aria-hidden="true"></svg>
</button>
`,
  ),
};

export const StopAnyTime: Story = {
  render: () => ({ template: `<lib-spin-toggle-demo />` }),
  parameters: doc(
    'Stop at any point in a turn. The icon never snaps back: it finishes the turn first. ' +
      'The directive works on any icon.',
    `
<svg lucideRefreshCw [libSpin]="busy()" aria-hidden="true"></svg>
<svg lucideLoaderCircle [libSpin]="busy()" aria-hidden="true"></svg>
`,
  ),
};
