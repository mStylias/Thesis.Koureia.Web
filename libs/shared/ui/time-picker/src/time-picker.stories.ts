import {
  applicationConfig,
  componentWrapperDecorator,
  type Meta,
  type StoryObj,
} from '@storybook/angular';
import { provideTransloco } from '@jsverse/transloco';
import { TimePicker } from './time-picker';

/** A per-story description for the Docs page. */
const doc = (markdown: string) => ({ docs: { description: { story: markdown } } });

const meta: Meta<TimePicker> = {
  title: 'Forms & input/Time picker',
  component: TimePicker,
  tags: ['autodocs'],
  decorators: [
    // A realistic form width — the inline grid still gets several columns.
    componentWrapperDecorator((story) => `<div style="max-width: 26rem;">${story}</div>`),
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
    interval: 30,
    min: '09:00',
    max: '18:00',
    ariaLabel: 'Appointment time',
  },
};

export default meta;
type Story = StoryObj<TimePicker>;

export const Dropdown: Story = {
  parameters: doc(
    'An editable combobox: the list narrows as you type, and `9`, `930` or `9:30` all normalize to `09:30` on commit. Text the control cannot honour leaves the model empty and reports which of the two problems it is.',
  ),
};

export const InlineAvailability: Story = {
  args: {
    mode: 'inline',
    excludedDisplay: 'disabled',
    excludedRanges: [{ start: '13:00', end: '14:30' }],
    excludedTimes: ['10:30', '16:00'],
  },
  parameters: doc(
    'The same slots as a visible listbox. Unavailable ones stay in place, struck through and `aria-disabled`, so the shape of the day is still legible.',
  ),
};

export const HiddenUnavailable: Story = {
  args: {
    mode: 'inline',
    excludedDisplay: 'hidden',
    excludedRanges: [{ start: '13:00', end: '14:30' }],
    excludedTimes: ['10:30', '16:00'],
  },
  parameters: doc('`excludedDisplay="hidden"` removes unavailable slots instead.'),
};

export const ServerDefinedSlots: Story = {
  args: {
    validTimes: ['09:15', '09:45', '11:15', '15:45', '17:15'],
  },
  parameters: doc('With `validTimes`, `interval` is ignored and only those times are offered.'),
};

export const ReadOnly: Story = {
  args: {
    mode: 'inline',
    readonly: true,
    value: '09:30',
  },
  parameters: doc(
    'Read-only keeps the slots readable but withholds every affordance that would edit the value — no clear button, no dropdown, no selectable slot.',
  ),
};

export const Disabled: Story = {
  args: { disabled: true, value: '09:30' },
  parameters: doc('Nothing is operable, and no clear button is offered.'),
};
