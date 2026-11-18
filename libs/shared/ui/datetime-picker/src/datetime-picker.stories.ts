import {
  applicationConfig,
  componentWrapperDecorator,
  type Meta,
  type StoryObj,
} from '@storybook/angular';
import { provideTransloco } from '@jsverse/transloco';
import { DatetimePicker } from './datetime-picker';

const meta: Meta<DatetimePicker> = {
  title: 'Forms & input/Datetime picker',
  component: DatetimePicker,
  tags: ['autodocs'],
  decorators: [
    componentWrapperDecorator((story) => `<div style="max-width: 18rem;">${story}</div>`),
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
    value: new Date(2026, 6, 13, 14, 30),
    timeEnabled: true,
    ariaLabel: 'Starts at',
  },
};

export default meta;
type Story = StoryObj<DatetimePicker>;

export const Default: Story = {
  parameters: {
    docs: {
      description: {
        story: 'Type a localized date with an optional comma and time, or use the panel.',
      },
      source: {
        code: '<lib-datetime-picker [(value)]="startsAt" [(timeEnabled)]="includeTime" />',
        language: 'html',
      },
    },
  },
};
