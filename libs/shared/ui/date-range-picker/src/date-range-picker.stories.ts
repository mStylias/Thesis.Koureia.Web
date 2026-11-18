import { Component, input, linkedSignal } from '@angular/core';
import { JsonPipe } from '@angular/common';
import { applicationConfig, moduleMetadata, type Meta, type StoryObj } from '@storybook/angular';
import { provideTransloco } from '@jsverse/transloco';

import { DATE_RANGE_PRESETS, EMPTY_DATE_RANGE } from './core/date-range';
import { DateRangePicker } from './date-range-picker';
import type { DateRangeValue } from './date-range-picker.types';

const doc = (markdown: string, code: string, language = 'html') => ({
  docs: { description: { story: markdown }, source: { code: code.trim(), language } },
});

@Component({
  selector: 'lib-date-range-picker-demo',
  imports: [DateRangePicker, JsonPipe],
  template: `
    <div style="max-width: 24rem;">
      <lib-date-range-picker
        [(value)]="value"
        [presets]="withPresets() ? presets : []"
        [maxDays]="maxDays()"
        [disabled]="disabled()"
        [readonly]="readonly()"
        today="2026-10-04"
        locale="el-GR"
      />
    </div>
    <pre style="margin-top: 1rem; font-size: 0.75rem;">{{ value() | json }}</pre>
  `,
})
class DateRangePickerDemo {
  readonly withPresets = input(true);
  readonly maxDays = input<number | undefined>(undefined);
  readonly disabled = input(false);
  readonly readonly = input(false);
  readonly initial = input<DateRangeValue>(EMPTY_DATE_RANGE);
  readonly presets = DATE_RANGE_PRESETS;
  readonly value = linkedSignal(() => this.initial());
}

const meta: Meta<DateRangePickerDemo> = {
  title: 'Forms & input/Date range picker',
  component: DateRangePickerDemo,
  decorators: [
    moduleMetadata({ imports: [DateRangePickerDemo] }),
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
};
export default meta;

export const WithPresets: StoryObj<DateRangePickerDemo> = {
  args: { initial: { preset: 'last30', from: '2026-09-05', to: '2026-10-04' } },
  parameters: doc(
    'Presets beside a two-month calendar. Two clicks build a draft, and only **Apply** writes it. A preset applies at once. The panel shows one month below 42rem.',
    `
<lib-date-range-picker [(value)]="range" [presets]="presets" [maxDays]="731" />

presets = DATE_RANGE_PRESETS;
range = signal<DateRangeValue>(EMPTY_DATE_RANGE);`,
  ),
};

export const MaxDays: StoryObj<DateRangePickerDemo> = {
  args: { maxDays: 14, withPresets: false },
  parameters: doc(
    'After the first click, the days past `maxDays` are disabled. Typed dates past the limit are refused with a message that names it.',
    `<lib-date-range-picker [(value)]="range" [maxDays]="14" />`,
  ),
};

export const ReadOnly: StoryObj<DateRangePickerDemo> = {
  args: { readonly: true, initial: { preset: null, from: '2026-09-01', to: '2026-09-30' } },
  parameters: doc(
    'The calendar still opens and shows the range, but no day, preset or Apply edits it.',
    `<lib-date-range-picker [(value)]="range" readonly />`,
  ),
};

export const Disabled: StoryObj<DateRangePickerDemo> = {
  args: { disabled: true, initial: { preset: null, from: '2026-09-01', to: '2026-09-30' } },
  parameters: doc('Nothing opens and nothing can be typed.', `<lib-date-range-picker disabled />`),
};
