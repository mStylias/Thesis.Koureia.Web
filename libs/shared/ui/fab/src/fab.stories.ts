import { Component } from '@angular/core';
import { moduleMetadata, type Meta, type StoryObj } from '@storybook/angular';
import { LucideCalendarDays, LucidePlus } from '@lucide/angular';
import { Fab } from './fab';
import { FabGroup } from './fab-group';

const doc = (markdown: string, code: string, language = 'html') => ({
  docs: {
    description: { story: markdown },
    source: { code: code.trim(), language },
  },
});

const ROW = 'display: flex; align-items: center; gap: var(--space-4); flex-wrap: wrap;';
const FRAME =
  'position: relative; height: 22rem; max-width: 24rem; border: var(--border-width-hairline) solid var(--border); border-radius: var(--radius-lg); background: var(--surface);';

@Component({
  selector: 'lib-fab-sizes-demo',
  imports: [Fab, LucidePlus],
  template: `
    <div style="${ROW}">
      <button libFab type="button" size="sm" aria-label="New">
        <svg lucidePlus aria-hidden="true"></svg>
      </button>
      <button libFab type="button" aria-label="New">
        <svg lucidePlus aria-hidden="true"></svg>
      </button>
      <button libFab type="button" size="lg" aria-label="New">
        <svg lucidePlus aria-hidden="true"></svg>
      </button>
      <button libFab type="button" severity="secondary" aria-label="New">
        <svg lucidePlus aria-hidden="true"></svg>
      </button>
      <button libFab type="button" disabled aria-label="New">
        <svg lucidePlus aria-hidden="true"></svg>
      </button>
    </div>
  `,
})
class FabSizesDemo {}

@Component({
  selector: 'lib-fab-group-demo',
  imports: [Fab, FabGroup, LucideCalendarDays, LucidePlus],
  template: `
    <div style="${FRAME}">
      <lib-fab-group position="absolute">
        <button libFab type="button" size="sm" severity="secondary" aria-label="Change view">
          <svg lucideCalendarDays aria-hidden="true"></svg>
        </button>
        <button libFab type="button" aria-label="New appointment">
          <svg lucidePlus aria-hidden="true"></svg>
        </button>
      </lib-fab-group>
    </div>
  `,
})
class FabGroupDemo {}

const meta: Meta = {
  title: 'Actions/Fab',
  component: Fab,
  decorators: [moduleMetadata({ imports: [FabSizesDemo, FabGroupDemo] })],
};
export default meta;

export const Sizes: StoryObj = {
  render: () => ({ template: '<lib-fab-sizes-demo />' }),
  parameters: doc(
    '`sm`, `md` (the default) and `lg`, then the `secondary` surface and a disabled button.',
    `
<button libFab size="sm" aria-label="New"><svg lucidePlus aria-hidden="true"></svg></button>
<button libFab aria-label="New"><svg lucidePlus aria-hidden="true"></svg></button>
<button libFab size="lg" aria-label="New"><svg lucidePlus aria-hidden="true"></svg></button>
<button libFab severity="secondary" aria-label="New"><svg lucidePlus aria-hidden="true"></svg></button>
`,
  ),
};

export const Group: StoryObj = {
  render: () => ({ template: '<lib-fab-group-demo />' }),
  parameters: doc(
    'A main action with a second one over it, pinned to the corner of its container.',
    `
<lib-fab-group position="absolute">
  <button libFab size="sm" severity="secondary" aria-label="Change view">
    <svg lucideCalendarDays aria-hidden="true"></svg>
  </button>
  <button libFab aria-label="New appointment">
    <svg lucidePlus aria-hidden="true"></svg>
  </button>
</lib-fab-group>
`,
  ),
};
