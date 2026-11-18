import {
  applicationConfig,
  componentWrapperDecorator,
  type Meta,
  type StoryObj,
} from '@storybook/angular';
import { provideTransloco } from '@jsverse/transloco';
import { DatePicker } from './date-picker';

/** A per-story description for the Docs page. */
const doc = (markdown: string) => ({ docs: { description: { story: markdown } } });

const DATE_PICKER_INPUTS = [
  'value',
  'mode',
  'size',
  'min',
  'max',
  'validDates',
  'excludedDates',
  'excludedRanges',
  'excludedWeekdays',
  'availability',
  'startAt',
  'today',
  'locale',
  'firstDayOfWeek',
  'placeholder',
  'showInput',
  'showToday',
  'compact',
  'disabled',
  'readonly',
  'invalid',
  'touched',
  'required',
  'errors',
  'inputId',
  'name',
  'ariaLabel',
  'ariaLabelledby',
  'ariaDescribedby',
] as const;

const meta: Meta<DatePicker> = {
  title: 'Forms & input/Date picker',
  component: DatePicker,
  tags: ['autodocs'],
  decorators: [
    // A field stretched to the viewport misrepresents the layout; the
    // calendar itself is capped by the panel's own width.
    componentWrapperDecorator((story) => `<div style="max-width: 22rem;">${story}</div>`),
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
  args: {
    locale: 'el-GR',
    today: '2026-07-13',
    startAt: '2026-07-13',
    ariaLabel: 'Appointment date',
  },
  parameters: {
    controls: { include: DATE_PICKER_INPUTS },
  },
};

export default meta;
type Story = StoryObj<DatePicker>;

export const Dropdown: Story = {
  parameters: doc(
    'The default: an editable field that opens the calendar in a popover. Typing a complete, available date updates the model and the visible month immediately.',
  ),
};

export const Inline: Story = {
  args: { mode: 'inline' },
  parameters: doc('The calendar sits in flow, with the field still editable above it.'),
};

export const InlineCalendarOnly: Story = {
  args: { mode: 'inline', showInput: false },
  parameters: doc(
    '`[showInput]="false"` drops the text field in inline mode. Dropdown mode keeps its trigger regardless.',
  ),
};

export const GreekRegionalFormat: Story = {
  args: { value: '2026-07-13' },
  parameters: doc(
    'The canonical value stays `2026-07-13`; only the presentation follows `locale`.',
  ),
};

export const ShopClosures: Story = {
  args: {
    mode: 'inline',
    min: '2026-07-01',
    max: '2026-08-31',
    excludedWeekdays: [7],
    excludedDates: ['2026-07-15'],
    excludedRanges: [{ start: '2026-08-10', end: '2026-08-16' }],
  },
  parameters: doc(
    'Bounds, a recurring day off, a single closure and a holiday range. Unavailable days stay visible, struck through and `aria-disabled`.',
  ),
};

export const BackendAvailability: Story = {
  args: {
    mode: 'inline',
    validDates: [
      '2026-07-13',
      '2026-07-14',
      '2026-07-17',
      '2026-07-21',
      '2026-07-24',
      '2026-07-28',
    ],
  },
  parameters: doc('`validDates` makes a backend-provided list authoritative.'),
};

export const DayAvailabilityTints: Story = {
  args: {
    mode: 'inline',
    availability: {
      '2026-07-13': 0.1,
      '2026-07-14': 0.8,
      '2026-07-15': 0.35,
      '2026-07-16': 0.6,
      '2026-07-17': 0.15,
      '2026-07-18': 0.05,
      '2026-07-20': 1,
      '2026-07-21': 0.45,
      '2026-07-22': 0.25,
    },
  },
  parameters: doc(
    '`availability` tints each day by its free share: above 50% strong, 20% to 50% medium, below 20% faint.',
  ),
};

export const Invalid: Story = {
  args: { invalid: true, value: '2026-07-13' },
  parameters: doc('`invalid` is the consumer-driven state; errors from Signal Forms render below.'),
};

export const Disabled: Story = {
  args: { disabled: true, value: '2026-07-13' },
  parameters: doc('Nothing is operable: the input is locked and the calendar cannot be opened.'),
};

export const ReadOnly: Story = {
  args: { readonly: true, mode: 'inline', value: '2026-07-13' },
  parameters: doc(
    'Read-only keeps the calendar readable and focusable but withholds every affordance that would edit the value — no selectable day, no "today" shortcut.',
  ),
};
