import { Component, input, signal } from '@angular/core';
import { form, FormField, required } from '@angular/forms/signals';
import { provideTransloco } from '@jsverse/transloco';
import { applicationConfig, moduleMetadata, type Meta, type StoryObj } from '@storybook/angular';
import { Rating } from './rating';
import { RatingSize } from './rating.types';

const SIZES = ['sm', 'md', 'lg'] as const;

/** A per-story description, plus the snippet "Show code" displays in place of the demo tag. */
const doc = (markdown: string, code: string, language = 'html') => ({
  docs: { description: { story: markdown }, source: { code: code.trim(), language } },
});

const COLUMN = 'display: flex; flex-direction: column; gap: var(--space-4); max-width: 24rem;';
const NOTE = 'color: var(--text-secondary); font-size: var(--text-sm); margin: 0;';

@Component({
  selector: 'lib-rating-demo',
  imports: [Rating],
  template: `
    <div style="${COLUMN}">
      <lib-rating
        [(value)]="value"
        [max]="max()"
        [size]="size()"
        [readonly]="readonly()"
        [disabled]="disabled()"
        [invalid]="invalid()"
        [required]="required()"
      />
      <p style="${NOTE}">Value: {{ value() ?? 'null' }}</p>
    </div>
  `,
})
class RatingDemo {
  readonly max = input(5);
  readonly size = input<RatingSize>('md');
  readonly readonly = input(false);
  readonly disabled = input(false);
  readonly invalid = input(false);
  readonly required = input(false);

  protected readonly value = signal<number | null>(null);
}

@Component({
  selector: 'lib-rating-sizes-demo',
  imports: [Rating],
  template: `
    <div style="${COLUMN}">
      @for (size of sizes; track size) {
        <lib-rating [value]="4" [size]="size" />
      }
    </div>
  `,
})
class RatingSizesDemo {
  protected readonly sizes = SIZES;
}

@Component({
  selector: 'lib-rating-readonly-demo',
  imports: [Rating],
  template: `
    <div style="${COLUMN}">
      <lib-rating [value]="4" readonly size="sm" />
      <lib-rating [value]="2" readonly />
      <lib-rating [value]="5" readonly size="lg" />
    </div>
  `,
})
class RatingReadonlyDemo {}

@Component({
  selector: 'lib-rating-signal-forms-demo',
  imports: [Rating, FormField],
  template: `
    <div style="${COLUMN}">
      <lib-rating [formField]="reviewForm.score" />
      <p style="${NOTE}">
        score: {{ model().score ?? 'null' }} · valid: {{ reviewForm.score().valid() }} · touched:
        {{ reviewForm.score().touched() }}
      </p>
    </div>
  `,
})
class RatingSignalFormsDemo {
  protected readonly model = signal<{ score: number | null }>({ score: null });
  protected readonly reviewForm = form(this.model, (path) => {
    required(path.score, { message: 'review.scoreRequired' });
  });
}

const meta: Meta<RatingDemo> = {
  title: 'Forms & input/Rating',
  component: RatingDemo,
  tags: ['autodocs'],
  decorators: [
    moduleMetadata({
      imports: [RatingDemo, RatingSizesDemo, RatingReadonlyDemo, RatingSignalFormsDemo],
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
    max: { control: { type: 'number', min: 1, max: 10 } },
    size: { control: 'select', options: SIZES },
    readonly: { control: 'boolean' },
    disabled: { control: 'boolean' },
    invalid: { control: 'boolean' },
    required: { control: 'boolean' },
  },
  args: {
    max: 5,
    size: 'md',
    readonly: false,
    disabled: false,
    invalid: false,
    required: false,
  },
};

export default meta;
type Story = StoryObj<RatingDemo>;

export const Playground: Story = {
  parameters: doc(
    'A 1–5 star score. Click a star, or use the arrow keys, `Home` and `End`. ' +
      'Hovering previews the fill without changing the value.',
    `
<lib-rating [(value)]="score" />
`,
  ),
};

export const Sizes: Story = {
  render: () => ({ template: '<lib-rating-sizes-demo />' }),
  parameters: doc(
    'The stars follow the icon scale: `sm`, `md` (default) and `lg`.',
    `
<lib-rating [value]="4" size="sm" />
<lib-rating [value]="4" size="md" />
<lib-rating [value]="4" size="lg" />
`,
  ),
};

export const ReadOnly: Story = {
  render: () => ({ template: '<lib-rating-readonly-demo />' }),
  parameters: doc(
    'A static display for a review that is already given. It is one image whose name is ' +
      'the score ("4 of 5 stars"), with no tab stop. A fractional value rounds to whole stars.',
    `
<lib-rating [value]="review.score" readonly size="sm" />
`,
  ),
};

export const SignalForms: Story = {
  render: () => ({ template: '<lib-rating-signal-forms-demo />' }),
  parameters: doc(
    'Implements `FormValueControl<number | null>`, so `[formField]` binds `value`, ' +
      '`disabled`, `invalid` and `required`. The field is touched once focus leaves the ' +
      'stars, not while it moves between them. `required` surfaces as `aria-required`.',
    `
<lib-rating [formField]="reviewForm.score" />

<!-- … -->

protected readonly model = signal<{ score: number | null }>({ score: null });
protected readonly reviewForm = form(this.model, (path) => {
  required(path.score, { message: 'review.scoreRequired' });
});
`,
  ),
};

export const Accessibility: Story = {
  parameters: doc(
    [
      '- Interactive, the stars are a `role="radiogroup"` of `role="radio"` buttons named ' +
        '"1 star", "2 stars"… with `aria-checked` on the selected one.',
      '- One tab stop: the checked star, or the first. Arrows step by one and stop at the ' +
        'ends, `Home` and `End` jump, `Space` and `Enter` select the focused star.',
      '- The group is named "Rating" unless `ariaLabel` or `ariaLabelledby` is set. ' +
        '`aria-invalid` and `aria-required` sit on the group.',
      '- A filled star is the selected state and an outlined star the empty one, so the ' +
        'state is never color alone. A forced-colors block re-states both.',
      '- Disabled stars are native disabled buttons: no click, no keys, no tab stop.',
    ].join('\n'),
    `
<h3 id="score-heading">Πώς ήταν η επίσκεψη;</h3>
<lib-rating [(value)]="score" ariaLabelledby="score-heading" />
`,
  ),
};
