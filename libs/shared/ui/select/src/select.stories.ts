import { Component, input, signal } from '@angular/core';
import { form, FormField, required } from '@angular/forms/signals';
import { applicationConfig, moduleMetadata, type Meta, type StoryObj } from '@storybook/angular';
import { provideTransloco } from '@jsverse/transloco';
import type { DataSource } from '@ui/data-source';
import { FloatLabel, IftaLabel } from '@ui/form-field';
import { Select } from './select';
import { SelectedItemTemplate, SelectOptionTemplate } from './select-templates';
import { SelectOption, SelectSize } from './select.types';

/**
 * A per-story description plus the snippet shown under "Show code".
 *
 * The snippet has to be written by hand: every story renders through a
 * demo wrapper component, because a story object cannot hold the signals
 * these examples need. Storybook's generated source would therefore read
 * `<lib-select-demo />` — the scaffolding, not the API. Overriding
 * `docs.source.code` shows what a consumer would actually paste.
 *
 * The trade-off is that a snippet is static: it does not follow the
 * controls, and it is documentation rather than compiled code, so keep it
 * in step with the demo above it.
 */
const doc = (markdown: string, code: string, language = 'html') => ({
  docs: {
    description: { story: markdown },
    source: { code: code.trim(), language },
  },
});

const SIZES = ['sm', 'md', 'lg'] as const;

const BARBERS: SelectOption<string>[] = [
  { label: 'Kimonas', value: 'kimonas' },
  { label: 'Stavros', value: 'stavros' },
  { label: 'Elena', value: 'elena' },
  { label: 'Michalis', value: 'michalis', disabled: true },
];

interface Service {
  code: string;
  price: number;
  minutes: number;
}

const SERVICES: SelectOption<Service>[] = [
  { label: 'Skin fade', value: { code: 'fade', price: 18, minutes: 30 } },
  { label: 'Beard trim', value: { code: 'beard', price: 10, minutes: 15 } },
  {
    label: 'Hot towel shave',
    value: { code: 'shave', price: 15, minutes: 25 },
  },
];

@Component({
  selector: 'lib-select-demo',
  imports: [Select],
  template: `
    <lib-select
      [options]="options()"
      [(value)]="value"
      [placeholder]="placeholder()"
      [size]="size()"
      [disabled]="disabled()"
      [invalid]="invalid()"
      [required]="required()"
      [loading]="loading()"
      [showClear]="showClear()"
      [emptyMessage]="emptyMessage()"
      ariaLabel="Barber"
    />
    <p style="margin-top: var(--space-4); color: var(--text-secondary); font-size: var(--text-sm);">
      Value: {{ value() ?? '—' }}
    </p>
  `,
})
class SelectDemo {
  readonly options = input<SelectOption<string>[]>(BARBERS);
  readonly placeholder = input('Select a barber');
  readonly size = input<SelectSize>('md');
  readonly disabled = input(false);
  readonly invalid = input(false);
  readonly required = input(false);
  readonly loading = input(false);
  readonly showClear = input(false);
  readonly emptyMessage = input('');

  protected readonly value = signal<string | undefined>(undefined);
}

@Component({
  selector: 'lib-select-templates-demo',
  imports: [Select, SelectOptionTemplate, SelectedItemTemplate],
  template: `
    <lib-select
      [options]="services"
      [(value)]="service"
      placeholder="Select a service"
      showClear
      ariaLabel="Service"
      style="min-width: 18rem;"
    >
      <!-- Custom trigger content -->
      <ng-template libSelectedItem let-option>
        <span style="display: flex; justify-content: space-between; gap: var(--space-3);">
          <span>{{ option.label }}</span>
          <span style="font-family: var(--font-mono); color: var(--text-secondary);">
            €{{ option.value.price }}
          </span>
        </span>
      </ng-template>

      <!-- Custom dropdown rows -->
      <ng-template libSelectOption let-option>
        <span style="display: flex; justify-content: space-between; gap: var(--space-3);">
          <span>{{ option.label }}</span>
          <span
            style="font-family: var(--font-mono); color: var(--text-muted); font-size: var(--text-sm);"
          >
            {{ option.value.minutes }} min • €{{ option.value.price }}
          </span>
        </span>
      </ng-template>
    </lib-select>
  `,
})
class SelectTemplatesDemo {
  protected readonly services = SERVICES;
  protected readonly service = signal<Service | undefined>(undefined);
}

@Component({
  selector: 'lib-select-labels-demo',
  imports: [Select, FloatLabel, IftaLabel],
  template: `
    <div style="display: flex; gap: var(--space-8); flex-wrap: wrap; padding-top: var(--space-6);">
      <div libFloatLabel>
        <lib-select
          [options]="options"
          [(value)]="overValue"
          inputId="sel-over"
          ariaLabelledby="sel-over-label"
        />
        <label id="sel-over-label" for="sel-over">Barber (over)</label>
      </div>

      <div libFloatLabel variant="in">
        <lib-select
          [options]="options"
          [(value)]="inValue"
          inputId="sel-in"
          ariaLabelledby="sel-in-label"
        />
        <label id="sel-in-label" for="sel-in">Barber (in)</label>
      </div>

      <div libFloatLabel variant="on">
        <lib-select
          [options]="options"
          [(value)]="onValue"
          inputId="sel-on"
          ariaLabelledby="sel-on-label"
        />
        <label id="sel-on-label" for="sel-on">Barber (on)</label>
      </div>

      <div libIftaLabel>
        <lib-select
          [options]="options"
          [(value)]="iftaValue"
          inputId="sel-ifta"
          ariaLabelledby="sel-ifta-label"
        />
        <label id="sel-ifta-label" for="sel-ifta">Barber (IFTA)</label>
      </div>
    </div>
  `,
})
class SelectLabelsDemo {
  protected readonly options = BARBERS;
  protected readonly overValue = signal<string | undefined>(undefined);
  protected readonly inValue = signal<string | undefined>(undefined);
  protected readonly onValue = signal<string | undefined>(undefined);
  protected readonly iftaValue = signal<string | undefined>('kimonas');
}

@Component({
  selector: 'lib-select-sizes-demo',
  imports: [Select],
  template: `
    <div style="display: flex; gap: var(--space-4); flex-wrap: wrap; align-items: flex-start;">
      @for (size of sizes; track size) {
        <lib-select
          [options]="options"
          [size]="size"
          [placeholder]="'Size ' + size"
          [ariaLabel]="'Barber ' + size"
        />
      }
    </div>
  `,
})
class SelectSizesDemo {
  protected readonly options = BARBERS;
  protected readonly sizes = SIZES;
}

@Component({
  selector: 'lib-select-signal-forms-demo',
  imports: [Select, FormField],
  template: `
    <form style="display: flex; flex-direction: column; gap: var(--space-2); max-width: 20rem;">
      <lib-select
        [formField]="bookingForm.barber"
        [options]="options"
        placeholder="Select a barber"
        showClear
        ariaLabel="Barber"
      />

      @if (bookingForm.barber().touched() && bookingForm.barber().errors().length) {
        <span style="color: var(--error-text); font-size: var(--text-sm);">
          {{ bookingForm.barber().errors()[0].message }}
        </span>
      }

      <span style="color: var(--text-secondary); font-size: var(--text-sm);">
        Model: {{ model().barber || '—' }} • valid:
        {{ bookingForm.barber().valid() }}
      </span>
    </form>
  `,
})
class SelectSignalFormsDemo {
  protected readonly options = BARBERS;
  protected readonly model = signal({ barber: '' });
  protected readonly bookingForm = form(this.model, (schemaPath) => {
    required(schemaPath.barber, { message: 'Pick a barber' });
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
  selector: 'lib-select-source-demo',
  imports: [Select],
  template: `
    <lib-select
      [source]="roles"
      key="id"
      [displayWith]="roleName"
      [pageSize]="15"
      [(value)]="value"
      showClear
      placeholder="Select a role"
      ariaLabel="Role"
    />
    <p style="margin-top: var(--space-4); color: var(--text-secondary); font-size: var(--text-sm);">
      Value: {{ value() ?? '—' }}
    </p>
  `,
})
class SelectSourceDemo {
  protected readonly roles = createRolesSource();
  protected readonly roleName = roleName;

  // Starts on a value no page has loaded yet, so `byKeys` has to resolve it.
  protected readonly value = signal<number | undefined>(31);
}

const meta: Meta<SelectDemo> = {
  title: 'Forms & input/Select',
  component: SelectDemo,
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
      imports: [
        SelectDemo,
        SelectTemplatesDemo,
        SelectLabelsDemo,
        SelectSizesDemo,
        SelectSignalFormsDemo,
        SelectSourceDemo,
      ],
    }),
  ],
  argTypes: {
    size: { control: 'select', options: SIZES },
    placeholder: { control: 'text' },
    disabled: { control: 'boolean' },
    invalid: { control: 'boolean' },
    required: { control: 'boolean' },
    loading: { control: 'boolean' },
    showClear: { control: 'boolean' },
    emptyMessage: { control: 'text' },
  },
  args: {
    placeholder: 'Select a barber',
    size: 'md',
    disabled: false,
    invalid: false,
    required: false,
    loading: false,
    showClear: false,
    emptyMessage: '',
  },
};

export default meta;
type Story = StoryObj<SelectDemo>;

/**
 * The default single-select. Bind `options` (typed `SelectOption<T>[]`) and
 * two-way `value`; the trigger shows the `placeholder` until an option is
 * chosen. Use the **Controls** tab to flip inputs; the other examples on this
 * page isolate one feature each.
 */
export const Basic: Story = {
  parameters: doc(
    'Bind `[options]` and `[(value)]`, and set a `placeholder` for the empty ' +
      'state. The `value` is the selected option’s `value`, matched by ' +
      'reference equality — disabled options (like *Michalis*) cannot be picked.',
    `
<lib-select
  [options]="barbers"
  [(value)]="barber"
  placeholder="Select a barber"
  ariaLabel="Barber" />
`,
  ),
};

export const Clear: Story = {
  args: { showClear: true },
  parameters: doc(
    'Set `showClear` to add a × affordance that resets `value` to ' +
      '`undefined`. Keyboard users clear with `Delete` or `Backspace` while ' +
      'the closed trigger is focused. A disabled control withholds the × ' +
      '*and* ignores the shortcut.',
    `
<lib-select
  [options]="barbers"
  [(value)]="barber"
  showClear
  placeholder="Select a barber"
  ariaLabel="Barber" />
`,
  ),
};

export const Sizes: Story = {
  render: () => ({ template: '<lib-select-sizes-demo />' }),
  parameters: doc(
    'Three control heights — `sm`, `md` (default), and `lg` — matching the ' +
      'shared form-control sizes so the select aligns with inputs and buttons ' +
      'on the same row.',
    `
<lib-select size="sm" [options]="barbers" [(value)]="small" ariaLabel="Barber" />
<lib-select size="md" [options]="barbers" [(value)]="medium" ariaLabel="Barber" />
<lib-select size="lg" [options]="barbers" [(value)]="large" ariaLabel="Barber" />
`,
  ),
};

export const Disabled: Story = {
  args: { disabled: true },
  parameters: doc(
    'Set `disabled` to block interaction. Bound automatically when using ' +
      '`[formField]`. The combobox pattern disables through `aria-disabled`, ' +
      'so the trigger stays focusable and discoverable — every edit path ' +
      're-checks the state.',
    `
<lib-select disabled [options]="barbers" [(value)]="barber" ariaLabel="Barber" />
`,
  ),
};

export const Invalid: Story = {
  args: { invalid: true },
  parameters: doc(
    'Set `invalid` for the error styling. Bound automatically when using ' +
      '`[formField]`, so validation errors light up the control without extra ' +
      'wiring. Pair it with a message and point `ariaDescribedby` at it.',
    `
<lib-select
  invalid
  [options]="barbers"
  [(value)]="barber"
  ariaDescribedby="barber-error"
  ariaLabel="Barber" />
<p id="barber-error">Pick a barber</p>
`,
  ),
};

export const Loading: Story = {
  args: { loading: true },
  parameters: doc(
    'Set `loading` to swap the dropdown chevron for a spinner while options ' +
      'are being fetched.',
    `
<lib-select
  [loading]="barbers.isLoading()"
  [options]="barbers.value() ?? []"
  [(value)]="barber"
  ariaLabel="Barber" />
`,
  ),
};

export const Empty: Story = {
  args: { options: [] },
  parameters: doc(
    'With no `options`, the open dropdown shows the `emptyMessage`. Left ' +
      "empty it falls back to the lib's own `select` Transloco scope " +
      '(el/en), so nothing is hardcoded English.',
    `
<!-- Translated fallback: "Δεν βρέθηκαν αποτελέσματα" / "No results found" -->
<lib-select [options]="[]" [(value)]="barber" ariaLabel="Barber" />

<!-- …or override it -->
<lib-select
  [options]="[]"
  [(value)]="barber"
  emptyMessage="Nothing to book"
  ariaLabel="Barber" />
`,
  ),
};

export const Required: Story = {
  args: { required: true },
  parameters: doc(
    '`required` is exposed as **`aria-required`**, never the native ' +
      'attribute — the native one hands validation to the browser, which ' +
      'blocks the submit event outright and raises an OS-locale bubble over ' +
      "the form's own translated message. Submit through Signal Forms' " +
      '`submit()` instead, which marks the form touched so the error surfaces.',
    `
<lib-select
  [formField]="bookingForm.barber"
  [options]="barbers"
  ariaDescribedby="barber-error"
  ariaLabel="Barber" />

@if (bookingForm.barber().touched() && bookingForm.barber().errors().length) {
  <p id="barber-error">{{ bookingForm.barber().errors()[0].message }}</p>
}
`,
  ),
};

export const CustomTemplates: Story = {
  render: () => ({ template: '<lib-select-templates-demo />' }),
  parameters: doc(
    'Customize rendering with two content templates: `libSelectOption` for ' +
      'each dropdown row and `libSelectedItem` for the closed trigger. Both ' +
      'receive the `SelectOption` as implicit context, so `value` can be a ' +
      'rich object (here a service with a price and duration).',
    `
<lib-select [options]="services" [(value)]="service" showClear ariaLabel="Service">
  <!-- Closed trigger -->
  <ng-template libSelectedItem let-option>
    <span>{{ option.label }}</span>
    <span>€{{ option.value.price }}</span>
  </ng-template>

  <!-- Dropdown rows -->
  <ng-template libSelectOption let-option>
    <span>{{ option.label }}</span>
    <span>{{ option.value.minutes }} min • €{{ option.value.price }}</span>
  </ng-template>
</lib-select>
`,
  ),
};

export const Labels: Story = {
  render: () => ({ template: '<lib-select-labels-demo />' }),
  parameters: doc(
    'Pair the select with the form-field label wrappers. Set `inputId` so an ' +
      'external `<label for>` targets the trigger, and `ariaLabelledby` so it ' +
      'is named by that label. Shown here with every `libFloatLabel` variant ' +
      '(`over`, `in`, `on`) and `libIftaLabel`. The select reports its filled ' +
      'state through the `data-filled` host attribute, so the label floats on ' +
      'a selection without any placeholder trickery.',
    `
<div libFloatLabel variant="in">
  <lib-select
    [options]="barbers"
    [(value)]="barber"
    inputId="barber"
    ariaLabelledby="barber-label" />
  <label id="barber-label" for="barber">Barber</label>
</div>

<div libIftaLabel>
  <lib-select
    [options]="barbers"
    [(value)]="barber"
    inputId="barber-ifta"
    ariaLabelledby="barber-ifta-label" />
  <label id="barber-ifta-label" for="barber-ifta">Barber</label>
</div>
`,
  ),
};

export const SignalForms: Story = {
  render: () => ({ template: '<lib-select-signal-forms-demo />' }),
  parameters: doc(
    'The select implements the Signal Forms `FormValueControl` contract, so ' +
      '`[formField]` wires up `value`, `disabled`, `invalid`, and `required`, ' +
      'and emits `touch` on blur. Here a `required` validator reports its ' +
      'error once the field is touched.',
    `
<lib-select
  [formField]="bookingForm.barber"
  [options]="barbers"
  showClear
  placeholder="Select a barber"
  ariaLabel="Barber" />

@if (bookingForm.barber().touched() && bookingForm.barber().errors().length) {
  <span>{{ bookingForm.barber().errors()[0].message }}</span>
}
`,
  ),
};

export const Accessibility: Story = {
  parameters: doc(
    [
      'Built on the headless `@angular/aria` combobox + listbox pattern, so ' +
        'the roles, keyboard model, and ARIA state come from Angular.',
      '',
      '- **Give the trigger a name** — set `ariaLabel`, or `inputId` + ' +
        '`ariaLabelledby` to associate a visible `<label>`.',
      '- The trigger exposes the **combobox** role and toggles ' +
        '`aria-expanded`; the panel is a **listbox** of `option`s, with the ' +
        'chosen row marked `aria-selected`.',
      '- **Keyboard**: arrow keys move the active option, typeahead jumps to ' +
        'options by `label`, `Enter` commits, and `Escape` closes and returns ' +
        'focus to the trigger.',
      '- **Disabled options** carry `aria-disabled` and are skipped by ' + 'keyboard navigation.',
      '- With `showClear`, the value can be reset from the keyboard with ' +
        '`Delete`/`Backspace` on the focused trigger. The × is an ' +
        '`aria-hidden` pointer-only `<svg>` (a nested button would break the ' +
        "combobox's ARIA contract), so its label is a `title` tooltip.",
      '- A **disabled** control withholds the × *and* ignores the ' +
        '`Delete`/`Backspace` shortcut: the pattern disables through ' +
        '`aria-disabled`, so the trigger keeps DOM focus and would otherwise ' +
        'still be editable from the keyboard.',
      '- **`required` is exposed as `aria-required`**, so the a11y tree ' +
        'reports the field as required without the browser taking over ' +
        'validation.',
      '- `ariaDescribedby` is passed through untouched — the control renders ' +
        'no error text of its own.',
      '- The active-option ring only renders during keyboard interaction (the ' +
        'host mirrors `:focus-visible` through `data-modality`).',
      '- Focus rings and color contrast meet **WCAG AA** in both light and ' +
        'dark themes, and a `forced-colors` block re-states the focus ring, ' +
        'the active option and the selected row that a forced palette would ' +
        'otherwise drop along with the box-shadows.',
    ].join('\n'),
    `
<!-- Named by a visible label -->
<div libFloatLabel>
  <lib-select
    [options]="barbers"
    [(value)]="barber"
    inputId="barber"
    ariaLabelledby="barber-label" />
  <label id="barber-label" for="barber">Barber</label>
</div>

<!-- Named directly, with a hint associated -->
<lib-select
  [options]="barbers"
  [(value)]="barber"
  ariaLabel="Barber"
  ariaDescribedby="barber-hint" />
<p id="barber-hint">Pick whoever cut your hair last time</p>
`,
  ),
};

/**
 * Bind `source` instead of `options` to read from a `DataSource` — the contract
 * `@data/odata-source` and any other transport implement. Four things change,
 * and nothing else does:
 *
 * - **`value` is the item's declared `key`**, never the item, so a reloaded page
 *   still matches its own selection.
 * - **`byKeys` resolves a value no page has loaded.** This demo starts on role
 *   31, which is on the third page.
 * - **Typing queries the source**, debounced and aborting the superseded
 *   request. The panel's search row shows what the query is; focus never leaves
 *   the trigger, so the combobox keeps its ARIA contract.
 * - **The panel pages as it scrolls**, asking for one row more than it shows to
 *   learn whether another page exists.
 *
 * A value the source cannot display is **kept**, not cleared, and reported
 * through `(resolutionFailed)`.
 */
export const FromASource: Story = {
  render: () => ({ template: '<lib-select-source-demo />' }),
  parameters: doc(
    'Remote options, keyed selection, server-side search and paging.',
    `
<lib-select
  [source]="roles"
  key="id"
  [displayWith]="roleName"
  [pageSize]="15"
  [(value)]="roleId"
  showClear
  placeholder="Select a role"
  ariaLabel="Role" />
`,
  ),
};
