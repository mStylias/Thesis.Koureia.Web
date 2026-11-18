import { Component, input, signal } from '@angular/core';
import { form, FormField, minLength } from '@angular/forms/signals';
import { applicationConfig, moduleMetadata, type Meta, type StoryObj } from '@storybook/angular';
import { provideTransloco } from '@jsverse/transloco';
import type { DataSource } from '@ui/data-source';
import { SelectOption, SelectSize } from '@ui/select';
import { MultiSelect } from './multi-select';
import { MultiSelectDisplay } from './multi-select.types';

const SIZES = ['sm', 'md', 'lg'] as const;

/**
 * A per-story description plus the snippet shown under "Show code".
 *
 * The snippet has to be written by hand: every story renders through a
 * demo wrapper component, because a story object cannot hold the signals
 * these examples need. Storybook's generated source would therefore read
 * `<lib-multi-select-demo />` — the scaffolding, not the API. Overriding
 * `docs.source.code` shows what a consumer would actually paste.
 *
 * The trade-off is that a snippet is static: it does not follow the
 * controls, and it is documentation rather than compiled code, so keep it
 * in step with the demo components above.
 */
const doc = (markdown: string, code: string, language = 'html') => ({
  docs: {
    description: { story: markdown },
    source: { code: code.trim(), language },
  },
});

const SERVICES: SelectOption<string>[] = [
  { label: 'Skin fade', value: 'fade' },
  { label: 'Beard trim', value: 'beard' },
  { label: 'Hot towel shave', value: 'shave' },
  { label: 'Kids cut', value: 'kids' },
  { label: 'Hair tattoo', value: 'tattoo', disabled: true },
];

@Component({
  selector: 'lib-multi-select-demo',
  imports: [MultiSelect],
  template: `
    <lib-multi-select
      [options]="options()"
      [(value)]="value"
      [display]="display()"
      [placeholder]="placeholder()"
      [size]="size()"
      [disabled]="disabled()"
      [invalid]="invalid()"
      [loading]="loading()"
      [showClear]="showClear()"
      [maxWidth]="maxWidth()"
      ariaLabel="Services"
      style="min-width: 18rem;"
    />
    <p style="margin-top: var(--space-4); color: var(--text-secondary); font-size: var(--text-sm);">
      Value: {{ value().length ? value().join(', ') : '—' }}
    </p>
  `,
})
class MultiSelectDemo {
  readonly options = input<SelectOption<string>[]>(SERVICES);
  readonly display = input<MultiSelectDisplay>('comma');
  readonly placeholder = input('Select services');
  readonly size = input<SelectSize>('md');
  readonly disabled = input(false);
  readonly invalid = input(false);
  readonly loading = input(false);
  readonly showClear = input(false);
  readonly maxWidth = input('');

  protected readonly value = signal<string[]>([]);
}

@Component({
  selector: 'lib-multi-select-signal-forms-demo',
  imports: [MultiSelect, FormField],
  template: `
    <form style="display: flex; flex-direction: column; gap: var(--space-2); max-width: 22rem;">
      <lib-multi-select
        [formField]="bookingForm.services"
        [options]="options"
        display="chip"
        placeholder="Select at least two services"
        showClear
        ariaLabel="Services"
      />

      @if (bookingForm.services().touched() && bookingForm.services().errors().length) {
        <span style="color: var(--error-text); font-size: var(--text-sm);">
          {{ bookingForm.services().errors()[0].message }}
        </span>
      }

      <span style="color: var(--text-secondary); font-size: var(--text-sm);">
        Model: {{ model().services.join(', ') || '—' }} • valid:
        {{ bookingForm.services().valid() }}
      </span>
    </form>
  `,
})
class MultiSelectSignalFormsDemo {
  protected readonly options = SERVICES;
  protected readonly model = signal({ services: [] as string[] });
  protected readonly bookingForm = form(this.model, (schemaPath) => {
    minLength(schemaPath.services, 2, {
      message: 'Pick at least two services',
    });
  });
}

interface Role {
  readonly id: number;
  readonly name: string;
}

const ROLES: readonly Role[] = Array.from({ length: 48 }, (_, index) => ({
  id: index + 1,
  name: `Role ${index + 1}`,
}));

const roleName = (role: Role): string => role.name;

/**
 * Stands in for an OData endpoint: it answers `load` with one page and `byKeys`
 * with the rows a persisted value names, after a delay, and honours the abort
 * signal the control sends when a newer query supersedes this one.
 */
function createRolesSource(latency = 350): DataSource<Role> {
  const after = <TValue>(value: TValue, signal?: AbortSignal): Promise<TValue> =>
    new Promise<TValue>((resolve, reject) => {
      const timer = setTimeout(() => {
        resolve(value);
      }, latency);
      signal?.addEventListener(
        'abort',
        () => {
          clearTimeout(timer);
          reject(new DOMException('The operation was aborted.', 'AbortError'));
        },
        { once: true },
      );
    });

  return {
    load: ({ search, skip = 0, take, signal }) => {
      const needle = (search ?? '').trim().toLocaleLowerCase();
      const matched = needle
        ? ROLES.filter((role) => role.name.toLocaleLowerCase().includes(needle))
        : ROLES;
      return after(
        { rows: matched.slice(skip, take === undefined ? undefined : skip + take) },
        signal,
      );
    },
    byKeys: (keys, signal) =>
      after(
        ROLES.filter((role) => keys.includes(role.id)),
        signal,
      ),
  };
}

@Component({
  selector: 'lib-multi-select-source-demo',
  imports: [MultiSelect],
  template: `
    <lib-multi-select
      [source]="roles"
      key="id"
      [displayWith]="roleName"
      [pageSize]="15"
      [(value)]="value"
      display="chip"
      showClear
      maxWidth="24rem"
      placeholder="Select roles"
      ariaLabel="Roles"
    />
    <p style="margin-top: var(--space-4); color: var(--text-secondary); font-size: var(--text-sm);">
      Value: {{ value().join(', ') || '—' }}
    </p>
  `,
})
class MultiSelectSourceDemo {
  protected readonly roles = createRolesSource();
  protected readonly roleName = roleName;

  // Starts on values no page has loaded yet, so `byKeys` has to resolve them.
  protected readonly value = signal<number[]>([31, 44]);
}

const meta: Meta<MultiSelectDemo> = {
  title: 'Forms & input/Multi-select',
  component: MultiSelectDemo,
  decorators: [
    // The lib ships its own Transloco scope, and there is no global
    // provider in Storybook — without this the control fails to render.
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
      imports: [MultiSelectDemo, MultiSelectSignalFormsDemo, MultiSelectSourceDemo],
    }),
  ],
  argTypes: {
    display: { control: 'select', options: ['comma', 'chip'] },
    size: { control: 'select', options: SIZES },
    placeholder: { control: 'text' },
    disabled: { control: 'boolean' },
    invalid: { control: 'boolean' },
    loading: { control: 'boolean' },
    showClear: { control: 'boolean' },
    maxWidth: { control: 'text' },
  },
  args: {
    display: 'comma',
    placeholder: 'Select services',
    size: 'md',
    disabled: false,
    invalid: false,
    loading: false,
    showClear: false,
    maxWidth: '',
  },
};

export default meta;
type Story = StoryObj<MultiSelectDemo>;

/**
 * The default `comma` display: selected options join into a comma-separated
 * summary in the trigger. Selection is explicit — click or press Enter to
 * toggle each option, and the dropdown stays open until Escape, Tab, or an
 * outside click. Bind selection with `[(value)]`, an array of option values.
 */
const OPTIONS_TS = `
const services: SelectOption<string>[] = [
  { label: 'Skin fade', value: 'fade' },
  { label: 'Beard trim', value: 'beard' },
  { label: 'Hot towel shave', value: 'shave' },
  { label: 'Kids cut', value: 'kids' },
  { label: 'Hair tattoo', value: 'tattoo', disabled: true },
];
`;

export const Basic: Story = {
  parameters: doc(
    'The default `comma` `display` — selected options render as a ' +
      'comma-separated summary in the trigger. Selection is explicit and the ' +
      'panel stays open across toggles; bind the chosen values with `[(value)]`.',
    `
<lib-multi-select
  [options]="services"
  [(value)]="selectedServices"
  placeholder="Select services"
  ariaLabel="Services" />
${OPTIONS_TS}`,
  ),
};

export const Chips: Story = {
  args: { display: 'chip' },
  parameters: doc(
    'Set `display="chip"` to render each selection as a removable chip inside ' +
      'the trigger. Clicking the × on a chip removes just that option; ' +
      'keyboard users toggle it back off in the list instead.',
    `
<lib-multi-select
  [options]="services"
  [(value)]="selectedServices"
  display="chip"
  placeholder="Select services"
  ariaLabel="Services" />
`,
  ),
};

export const Clear: Story = {
  args: { showClear: true, display: 'chip' },
  parameters: doc(
    'Set `showClear` to expose a × affordance that resets the whole selection ' +
      'once at least one option is chosen. Keyboard users clear with `Delete` ' +
      'or `Backspace` while the trigger is focused and closed. Both are ' +
      'withheld while the control is disabled.',
    `
<lib-multi-select
  [options]="services"
  [(value)]="selectedServices"
  display="chip"
  showClear
  placeholder="Select services"
  ariaLabel="Services" />
`,
  ),
};

export const MaxWidth: Story = {
  args: { display: 'chip', maxWidth: '20rem' },
  parameters: doc(
    'Set `maxWidth` (any CSS length) to cap the control width. Chips wrap ' +
      'inside it, and past three rows the rest fold into a "+N" chip, whose ' +
      'tooltip names them. A label wider than the control truncates.',
    `
<lib-multi-select
  [options]="services"
  [(value)]="selectedServices"
  display="chip"
  maxWidth="20rem"
  ariaLabel="Services" />
`,
  ),
};

export const Disabled: Story = {
  args: { disabled: true },
  parameters: doc(
    'Set `disabled` to block all interaction. When bound through Signal Forms, ' +
      '`[formField]` toggles this automatically from the disabled state of the field.',
    `
<lib-multi-select
  [options]="services"
  [(value)]="selectedServices"
  disabled
  ariaLabel="Services" />
`,
  ),
};

export const Invalid: Story = {
  args: { invalid: true },
  parameters: doc(
    'Set `invalid` to apply error styling and `aria-invalid` on the trigger. ' +
      '`[formField]` drives this automatically from the validity of the field.',
    `
<lib-multi-select
  [options]="services"
  [(value)]="selectedServices"
  invalid
  ariaLabel="Services" />
`,
  ),
};

export const Loading: Story = {
  args: { loading: true },
  parameters: doc(
    'Set `loading` to swap the dropdown chevron for a spinner while options ' +
      'are being fetched.',
    `
<lib-multi-select
  [options]="services"
  [(value)]="selectedServices"
  [loading]="services.isLoading()"
  ariaLabel="Services" />
`,
  ),
};

export const SignalForms: Story = {
  render: () => ({ template: '<lib-multi-select-signal-forms-demo />' }),
  parameters: doc(
    'The component implements the Signal Forms `FormValueControl<T[]>` ' +
      'contract, so `[formField]` wires up the `T[]` value, `disabled`, ' +
      '`invalid` and `required` states and marks the field touched on blur. ' +
      'This example validates with `minLength(2)` and shows the error once ' +
      'the field is touched.',
    `
<lib-multi-select
  [formField]="bookingForm.services"
  [options]="services"
  display="chip"
  showClear
  ariaLabel="Services" />

<!-- … -->

protected readonly model = signal({ services: [] as string[] });
protected readonly bookingForm = form(this.model, (path) => {
  minLength(path.services, 2, { message: 'Pick at least two services' });
});
`,
  ),
};

export const Accessibility: Story = {
  parameters: doc(
    [
      'Built on the headless `@angular/aria` combobox + listbox pattern, so ' +
        'the widget follows the APG multi-select combobox roles and keyboard ' +
        'model out of the box.',
      '',
      '- **Give the trigger an accessible name** via `ariaLabel`, ' +
        '`ariaLabelledby`, or an external `<label for>` targeting `inputId`.',
      '- The popup list is a `role="listbox"` with `aria-multiselectable`; each ' +
        'option exposes `aria-selected` so its checked state is announced.',
      '- **Keyboard**: open with `Enter`/`Space`/arrows, move with the arrow ' +
        'keys, toggle the active option with `Enter`, and close with `Escape` ' +
        'or `Tab`. Focus is tracked with `aria-activedescendant`, so the ' +
        'trigger keeps DOM focus throughout.',
      '- When closed, `Delete`/`Backspace` clears the selection (with ' +
        '`showClear`); the × affordances are pointer-only and `aria-hidden`, ' +
        'since a nested button would break the combobox contract. Their ' +
        'labels are therefore `title` tooltips — an `aria-label` would be ' +
        'markup the a11y tree never reaches — and they come from the lib’s ' +
        '`multiSelect` Transloco scope unless you override them.',
      '- **Disabled** options and the disabled control expose the correct ' +
        'disabled semantics and are skipped by keyboard navigation. A ' +
        'disabled control withholds both × affordances *and* ignores the ' +
        '`Delete`/`Backspace` shortcut, which the `aria-disabled` trigger ' +
        'still receives.',
      '- `required` surfaces as **`aria-required`** on the trigger, never the ' +
        'native attribute, which would block the submit event and raise an ' +
        'OS-locale bubble. Point `ariaDescribedby` at your own hint or error; ' +
        'the control never overwrites it.',
      '- Focus rings and color contrast meet **WCAG AA** in both light and ' +
        'dark themes, and a `forced-colors` block re-states the focus ring, ' +
        'the active option and the selected row.',
    ].join('\n'),
    `
<p id="services-hint">Διαλέξτε τουλάχιστον δύο υπηρεσίες.</p>

<lib-multi-select
  [options]="services"
  [(value)]="selectedServices"
  required
  display="chip"
  showClear
  ariaLabel="Services"
  ariaDescribedby="services-hint" />
`,
  ),
};

/**
 * Bind `source` instead of `options` to read from a `DataSource` — the contract
 * `@data/odata-source` and any other transport implement. `value` holds the
 * items' declared keys, `byKeys` restores chips for selections no page has
 * loaded (this demo starts on roles 31 and 44), typing queries the source, and
 * the panel pages as it scrolls.
 *
 * A selection the current query filters out **stays selected**: the listbox
 * only ever answers about the options it rendered, so the control carries the
 * rest across itself.
 */
export const FromASource: Story = {
  render: () => ({ template: '<lib-multi-select-source-demo />' }),
  parameters: doc(
    'Remote options, keyed selection, server-side search and paging.',
    `
<lib-multi-select
  [source]="roles"
  key="id"
  [displayWith]="roleName"
  [pageSize]="15"
  [(value)]="roleIds"
  display="chip"
  showClear
  maxWidth="24rem"
  placeholder="Select roles"
  ariaLabel="Roles" />
`,
  ),
};
