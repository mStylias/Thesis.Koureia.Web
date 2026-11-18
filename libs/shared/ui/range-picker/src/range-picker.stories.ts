import { Component, input, signal } from '@angular/core';
import { FormField, form } from '@angular/forms/signals';
import { provideTransloco } from '@jsverse/transloco';
import { applicationConfig, moduleMetadata, type Meta, type StoryObj } from '@storybook/angular';
import { RangePicker } from './range-picker';
import type {
  NumberRange,
  RangePickerMode,
  RangePickerSize,
  RangePickerUpdateOn,
} from './range-picker.types';
import { validateNumberRange } from './validate-number-range';

const SIZES = ['sm', 'md', 'lg'] as const;
const UPDATE_MODES = ['change', 'input'] as const;

const doc = (markdown: string, code: string, language = 'html') => ({
  docs: {
    description: { story: markdown },
    source: { code: code.trim(), language },
  },
});

const COLUMN = 'display: flex; flex-direction: column; gap: var(--space-3); max-width: 28rem;';
const HINT = 'color: var(--text-secondary); font-size: var(--text-sm); margin: 0;';

@Component({
  selector: 'lib-range-picker-demo',
  imports: [RangePicker],
  template: `
    <div style="${COLUMN}">
      <lib-range-picker
        [(value)]="value"
        [domainMin]="0"
        [domainMax]="100"
        [step]="5"
        [updateOn]="updateOn()"
        [mode]="mode()"
        [currency]="currency()"
        [locale]="locale()"
        [suffix]="suffix()"
        [size]="size()"
        [disabled]="disabled()"
        [readonly]="readonly()"
        [invalid]="invalid()"
        ariaLabel="Price range"
        (valueCommitted)="lastCommit.set($event)"
      />
      <p style="${HINT}">
        Value: {{ value().start }}–{{ value().end }} • last commit:
        {{ lastCommit()?.start ?? '—' }}–{{ lastCommit()?.end ?? '—' }}
      </p>
    </div>
  `,
})
class RangePickerDemo {
  readonly updateOn = input<RangePickerUpdateOn>('change');
  readonly mode = input<RangePickerMode>('currency');
  readonly currency = input('EUR');
  readonly locale = input('el-GR');
  readonly suffix = input('');
  readonly size = input<RangePickerSize>('md');
  readonly disabled = input(false);
  readonly readonly = input(false);
  readonly invalid = input(false);

  protected readonly value = signal<NumberRange>({ start: 15, end: 60 });
  protected readonly lastCommit = signal<NumberRange | undefined>(undefined);
}

@Component({
  selector: 'lib-range-picker-custom-format-demo',
  imports: [RangePicker],
  template: `
    <div style="${COLUMN}">
      <lib-range-picker
        [(value)]="value"
        [domainMin]="0"
        [domainMax]="5000"
        [step]="100"
        [valueFormatter]="formatDistance"
        ariaLabel="Distance range"
      />
    </div>
  `,
})
class RangePickerCustomFormatDemo {
  protected readonly value = signal<NumberRange>({ start: 500, end: 2500 });
  protected readonly formatDistance = (value: number) => `${String(value / 1000)} km`;
}

@Component({
  selector: 'lib-range-picker-sizes-demo',
  imports: [RangePicker],
  template: `
    <div style="${COLUMN}">
      @for (size of sizes; track size) {
        <lib-range-picker
          [value]="values"
          [size]="size"
          [domainMin]="0"
          [domainMax]="120"
          [step]="5"
          suffix=" min"
          [ariaLabel]="'Duration range (' + size + ')'"
        />
      }
    </div>
  `,
})
class RangePickerSizesDemo {
  protected readonly sizes = SIZES;
  protected readonly values: NumberRange = { start: 20, end: 75 };
}

@Component({
  selector: 'lib-range-picker-signal-forms-demo',
  imports: [RangePicker, FormField],
  template: `
    <div style="${COLUMN}">
      <lib-range-picker
        [formField]="searchForm.price"
        [domainMin]="0"
        [domainMax]="150"
        [step]="5"
        mode="currency"
        currency="EUR"
        locale="el-GR"
        ariaLabel="Price range"
      />
      <p style="${HINT}">
        Model: {{ model().price.start }}–{{ model().price.end }} • valid:
        {{ searchForm.price().valid() }}
      </p>
    </div>
  `,
})
class RangePickerSignalFormsDemo {
  protected readonly model = signal({ price: { start: 10, end: 80 } });
  protected readonly searchForm = form(this.model, (path) => {
    validateNumberRange(path.price, { domainMin: 0, domainMax: 150 });
  });
}

const meta: Meta<RangePickerDemo> = {
  title: 'Forms & input/Range picker',
  component: RangePickerDemo,
  decorators: [
    moduleMetadata({
      imports: [
        RangePickerDemo,
        RangePickerCustomFormatDemo,
        RangePickerSizesDemo,
        RangePickerSignalFormsDemo,
      ],
    }),
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
  ],
  argTypes: {
    updateOn: { control: 'select', options: UPDATE_MODES },
    mode: { control: 'select', options: ['decimal', 'currency'] },
    currency: { control: 'text' },
    locale: { control: 'text' },
    suffix: { control: 'text' },
    size: { control: 'select', options: SIZES },
    disabled: { control: 'boolean' },
    readonly: { control: 'boolean' },
    invalid: { control: 'boolean' },
  },
  args: {
    updateOn: 'change',
    mode: 'currency',
    currency: 'EUR',
    locale: 'el-GR',
    suffix: '',
    size: 'md',
    disabled: false,
    readonly: false,
    invalid: false,
  },
};

export default meta;

export const PriceFilter: StoryObj<RangePickerDemo> = {
  parameters: doc(
    'A public-search price filter. The default `updateOn="change"` keeps the ' +
      'slider responsive while delaying the bound value until pointer release or field blur.',
    `
<lib-range-picker
  [(value)]="priceRange"
  [domainMin]="0"
  [domainMax]="100"
  [step]="5"
  mode="currency"
  currency="EUR"
  locale="el-GR"
  ariaLabel="Price range"
  (valueCommitted)="search($event)" />
    `,
  ),
};

export const LiveUpdates: StoryObj<RangePickerDemo> = {
  args: { updateOn: 'input', mode: 'decimal', suffix: ' min' },
  parameters: doc(
    '`updateOn="input"` writes the range continuously while dragging or typing. ' +
      '`valueCommitted` still identifies the end of each interaction.',
    `
<lib-range-picker
  [(value)]="durationRange"
  [domainMin]="0"
  [domainMax]="100"
  [step]="5"
  updateOn="input"
  suffix=" min" />
    `,
  ),
};

export const CustomFormatter: StoryObj<RangePickerDemo> = {
  render: () => ({ template: '<lib-range-picker-custom-format-demo />' }),
  parameters: doc(
    'A formatter replaces the `Intl.NumberFormat` result in both endpoint fields ' +
      'and both slider `aria-valuetext` values.',
    `
protected readonly formatDistance = (value: number) => \`\${value / 1000} km\`;

// Template
// <lib-range-picker
//   [(value)]="distanceRange"
//   [domainMin]="0"
//   [domainMax]="5000"
//   [step]="100"
//   [valueFormatter]="formatDistance" />
    `,
    'ts',
  ),
};

export const Sizes: StoryObj<RangePickerDemo> = {
  render: () => ({ template: '<lib-range-picker-sizes-demo />' }),
  parameters: doc(
    'The endpoint fields use the shared `sm`, `md`, and `lg` form-control sizes. ' +
      'The slider keeps the same accessible pointer target in every size.',
    `
<lib-range-picker [(value)]="range" size="sm" />
<lib-range-picker [(value)]="range" />
<lib-range-picker [(value)]="range" size="lg" />
    `,
  ),
};

export const Disabled: StoryObj<RangePickerDemo> = {
  args: { disabled: true },
  parameters: doc(
    'Disabled blocks both native sliders, both number fields, and track dragging.',
    `<lib-range-picker [(value)]="range" disabled />`,
  ),
};

export const Readonly: StoryObj<RangePickerDemo> = {
  args: { readonly: true },
  parameters: doc(
    'Read-only keeps the values and thumbs focusable while blocking every edit path.',
    `<lib-range-picker [(value)]="range" readonly />`,
  ),
};

export const Invalid: StoryObj<RangePickerDemo> = {
  args: { invalid: true },
  parameters: doc(
    'Invalid state reaches both slider thumbs and endpoint fields. Signal Forms ' +
      'supplies the translated group-level message after touch.',
    `<lib-range-picker [(value)]="range" invalid />`,
  ),
};

export const SignalForms: StoryObj<RangePickerDemo> = {
  render: () => ({ template: '<lib-range-picker-signal-forms-demo />' }),
  parameters: doc(
    'The object value round-trips through `FormValueControl<NumberRange>`. ' +
      'Range validation stays in the schema.',
    `
import { form } from '@angular/forms/signals';
import { validateNumberRange } from '@ui/range-picker';

protected readonly model = signal({
  price: { start: 10, end: 80 },
});

protected readonly searchForm = form(this.model, (path) => {
  validateNumberRange(path.price, { domainMin: 0, domainMax: 150 });
});

// Template
// <lib-range-picker
//   [formField]="searchForm.price"
//   [domainMin]="0"
//   [domainMax]="150"
//   mode="currency"
//   currency="EUR" />
    `,
    'ts',
  ),
};
