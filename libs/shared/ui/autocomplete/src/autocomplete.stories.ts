import { Component, computed, input, signal } from '@angular/core';
import { form, FormField, required } from '@angular/forms/signals';
import { LucideCrosshair, LucideMapPin } from '@lucide/angular';
import { applicationConfig, moduleMetadata, type Meta, type StoryObj } from '@storybook/angular';
import { provideTransloco } from '@jsverse/transloco';
import type { DataInput, DataKey, DataSource, LoadResult } from '@ui/data-source';
import { Autocomplete } from './autocomplete';
import { AutocompleteFooterTemplate, AutocompleteOptionTemplate } from './autocomplete-templates';
import type { AutocompleteSize } from './autocomplete.types';

/**
 * A per-story description plus the snippet shown under "Show code".
 *
 * The snippet has to be written by hand: every story renders through a demo
 * wrapper component, because a story object cannot hold the signals these
 * examples need. Storybook generated source would therefore read
 * `<lib-autocomplete-demo />` — the scaffolding, not the API.
 */
const doc = (markdown: string, code: string, language = 'html') => ({
  docs: {
    description: { story: markdown },
    source: { code: code.trim(), language },
  },
});

const SIZES = ['sm', 'md', 'lg'] as const;

interface Role {
  id: number;
  name: string;
  description: string;
}

const ROLES: readonly Role[] = [
  { id: 1, name: 'Administrator', description: 'Full platform access' },
  { id: 2, name: 'Manager', description: 'Manages one business' },
  { id: 3, name: 'Barber', description: 'Manages appointments' },
  { id: 4, name: 'Reception', description: 'Handles the front desk' },
  ...Array.from({ length: 44 }, (_, index) => ({
    id: index + 5,
    name: `Custom role ${index + 5}`,
    description: `Custom permission set ${index + 5}`,
  })),
];

interface PlaceSuggestion {
  id: string;
  primary: string;
  secondary: string;
}

const PLACES: readonly PlaceSuggestion[] = [
  { id: 'provider:old-port', primary: 'Old Port', secondary: 'Limassol, Cyprus' },
  { id: 'provider:eleftheria', primary: 'Eleftheria Square', secondary: 'Nicosia, Cyprus' },
  { id: 'provider:finikoudes', primary: 'Finikoudes', secondary: 'Larnaca, Cyprus' },
  { id: 'provider:paphos-harbour', primary: 'Paphos Harbour', secondary: 'Paphos, Cyprus' },
];

function delay(milliseconds: number, signal?: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(resolve, milliseconds);
    signal?.addEventListener(
      'abort',
      () => {
        clearTimeout(timer);
        reject(new DOMException('The operation was aborted.', 'AbortError'));
      },
      { once: true },
    );
  });
}

class DemoRoleSource implements DataSource<Role> {
  constructor(private readonly items: readonly Role[] = ROLES) {}

  async load({ search, skip = 0, take = 20, signal }: Parameters<DataSource<Role>['load']>[0]) {
    await delay(350, signal);
    const needle = (search ?? '').trim().toLocaleLowerCase();
    const rows = needle
      ? this.items.filter((role) => role.name.toLocaleLowerCase().includes(needle))
      : this.items;
    return {
      rows: rows.slice(skip, skip + take),
      hasMore: skip + take < rows.length,
    } satisfies LoadResult<Role>;
  }

  async byKeys(keys: readonly DataKey[], signal?: AbortSignal): Promise<readonly Role[]> {
    await delay(250, signal);
    const wanted = new Set(keys);
    return this.items.filter((role) => wanted.has(role.id));
  }
}

@Component({
  selector: 'lib-autocomplete-demo',
  imports: [Autocomplete],
  template: `
    <lib-autocomplete
      [source]="activeSource()"
      key="id"
      [displayWith]="displayRole"
      [(value)]="roleId"
      [size]="size()"
      [placeholder]="placeholder()"
      [pageSize]="pageSize()"
      [debounceMs]="debounceMs()"
      [showClear]="showClear()"
      [frameless]="frameless()"
      [disabled]="disabled()"
      [readonly]="readonly()"
      [invalid]="invalid()"
      [required]="required()"
      [noDataMessage]="noDataMessage()"
      ariaLabel="Role"
    />
    <p class="story-value">Selected key: {{ roleId() || '—' }}</p>
  `,
  styles: `
    :host {
      display: block;
      max-width: 22rem;
    }
    .story-value {
      margin-top: var(--space-4);
      color: var(--text-secondary);
      font-size: var(--text-sm);
    }
  `,
})
class AutocompleteDemo {
  /** Swaps the local array for a source that waits before it answers. */
  readonly remote = input(false);
  /** Items behind both demo sources. */
  readonly items = input<readonly Role[]>(ROLES);
  /** Field density. */
  readonly size = input<AutocompleteSize>('md');
  /** Placeholder shown while there is no committed value or draft query. */
  readonly placeholder = input('Search roles');
  /** Suggestions per page. Scroll the panel to load the next page. */
  readonly pageSize = input(20);
  /** Delay before a typed query loads. */
  readonly debounceMs = input(250);
  /** Shows the clear button while a value or draft query exists. */
  readonly showClear = input(false);
  /** Removes the component frame so a parent can draw one shared field frame. */
  readonly frameless = input(false);
  /** Prevents every edit path. */
  readonly disabled = input(false);
  /** Keeps the value readable while withholding every edit affordance. */
  readonly readonly = input(false);
  /** Invalid state supplied by the host. */
  readonly invalid = input(false);
  /** Required state exposed as `aria-required`. */
  readonly required = input(false);
  /** No-results copy. Empty falls back to the component translation. */
  readonly noDataMessage = input('');

  protected readonly activeSource = computed<DataInput<Role>>(() =>
    this.remote() ? new DemoRoleSource(this.items()) : this.items(),
  );
  protected readonly roleId = signal<DataKey>('');
  protected readonly displayRole = (role: Role): string => role.name;
}

@Component({
  selector: 'lib-autocomplete-restored-demo',
  imports: [Autocomplete, FormField],
  template: `
    <lib-autocomplete
      [formField]="roleForm.roleId"
      [source]="source"
      key="id"
      [displayWith]="displayRole"
      placeholder="Search roles"
      showClear
      ariaLabel="Role"
    />
    <p class="story-value">The form started with key 3. Suggestions have not loaded yet.</p>
  `,
  styles: `
    :host {
      display: block;
      max-width: 26rem;
    }
    .story-value {
      margin-top: var(--space-4);
      color: var(--text-secondary);
      font-size: var(--text-sm);
    }
  `,
})
class RestoredDemo {
  protected readonly model = signal<{ roleId: DataKey }>({ roleId: 3 });
  protected readonly roleForm = form(this.model, (schema) => {
    required(schema.roleId);
  });
  protected readonly source = new DemoRoleSource();
  protected readonly displayRole = (role: Role): string => role.name;
}

@Component({
  selector: 'lib-autocomplete-provider-demo',
  imports: [Autocomplete, AutocompleteOptionTemplate, AutocompleteFooterTemplate],
  template: `
    <lib-autocomplete
      [source]="places"
      key="id"
      [displayWith]="displayPlace"
      [(value)]="placeId"
      placeholder="Search places"
      showClear
      ariaLabel="Place"
    >
      <ng-template libAutocompleteOption let-place>
        <span class="place-option">
          <strong>{{ place.primary }}</strong>
          <small>{{ place.secondary }}</small>
        </span>
      </ng-template>
      <ng-template libAutocompleteFooter>
        <span>Suggestions supplied by the configured places provider</span>
      </ng-template>
    </lib-autocomplete>
  `,
  styles: `
    :host {
      display: block;
      max-width: 22rem;
    }
    .place-option {
      display: grid;
      gap: var(--space-1);
    }
    .place-option small {
      color: var(--text-muted);
    }
  `,
})
class ProviderDemo {
  protected readonly places = PLACES;
  protected readonly placeId = signal<DataKey>('');
  protected readonly displayPlace = (place: PlaceSuggestion): string => place.primary;
}

@Component({
  selector: 'lib-autocomplete-action-demo',
  imports: [Autocomplete],
  template: `
    <lib-autocomplete
      [source]="places"
      key="id"
      [displayWith]="displayPlace"
      [(value)]="placeId"
      [leadingIcon]="mapPin"
      [actionIcon]="crosshair"
      [actionPending]="locating()"
      actionAriaLabel="Use my location"
      placeholder="Search places"
      showClear
      ariaLabel="Place"
      (action)="locate()"
    />
    <p class="action-note">{{ note() }}</p>
  `,
  styles: `
    :host {
      display: block;
      max-width: 22rem;
    }
    .action-note {
      margin: var(--space-2) 0 0;
      color: var(--text-muted);
      font-size: var(--text-sm);
    }
  `,
})
class FieldActionDemo {
  protected readonly places = PLACES;
  protected readonly placeId = signal<DataKey>('');
  protected readonly displayPlace = (place: PlaceSuggestion): string => place.primary;
  protected readonly mapPin = LucideMapPin;
  protected readonly crosshair = LucideCrosshair;
  protected readonly locating = signal(false);
  protected readonly note = signal('Press the crosshair to fill the field another way.');

  protected locate(): void {
    this.locating.set(true);
    this.note.set('Locating…');
    setTimeout(() => {
      this.locating.set(false);
      this.placeId.set('');
      this.note.set('Ordered from where you are.');
    }, 1200);
  }
}

const meta: Meta<AutocompleteDemo> = {
  title: 'Forms & input/Autocomplete',
  component: AutocompleteDemo,
  decorators: [
    moduleMetadata({
      imports: [Autocomplete, AutocompleteDemo, RestoredDemo, ProviderDemo, FieldActionDemo],
    }),
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
  ],
  argTypes: {
    remote: { control: 'boolean' },
    size: { control: 'select', options: SIZES },
    placeholder: { control: 'text' },
    pageSize: { control: { type: 'number', min: 1, step: 1 } },
    debounceMs: { control: { type: 'number', min: 0, step: 50 } },
    showClear: { control: 'boolean' },
    frameless: { control: 'boolean' },
    disabled: { control: 'boolean' },
    readonly: { control: 'boolean' },
    invalid: { control: 'boolean' },
    required: { control: 'boolean' },
    noDataMessage: { control: 'text' },
    items: { control: false },
  },
  args: {
    remote: false,
    size: 'md',
    placeholder: 'Search roles',
    pageSize: 20,
    debounceMs: 250,
    showClear: true,
    frameless: false,
    disabled: false,
    readonly: false,
    invalid: false,
    required: false,
    noDataMessage: '',
    items: ROLES,
  },
};

export default meta;
type Story = StoryObj<AutocompleteDemo>;

/**
 * Bind `source`, `key` and `displayWith`, then two-way `value`. Use the
 * **Controls** tab to flip inputs; the other examples on this page isolate one
 * feature each.
 */
export const Local: Story = {
  parameters: doc(
    'A local array uses the same search, paging, and key-restoration pipeline as a remote source.',
    `<lib-autocomplete
  [source]="roles"
  key="id"
  [displayWith]="displayRole"
  [(value)]="roleId"
  placeholder="Search roles"
  showClear />`,
  ),
};

export const Remote: Story = {
  args: { remote: true, placeholder: 'Search remote roles' },
  parameters: doc(
    'The source waits before it answers, so the loading, debounce, cancellation, and infinite paging states are visible. Raise `debounceMs` to widen the window, or lower `pageSize` to page sooner.',
    `<lib-autocomplete
  [source]="roleSource"
  key="id"
  [displayWith]="displayRole"
  [(value)]="roleId" />`,
  ),
};

export const NoResults: Story = {
  args: { items: [] },
  parameters: doc(
    'With no matching item the open panel shows `noDataMessage`. Left empty it falls back to the `autocomplete` Transloco scope of the lib (el/en), so nothing is hardcoded English.',
    `<lib-autocomplete
  [source]="[]"
  key="id"
  [displayWith]="displayRole"
  [(value)]="roleId"
  noDataMessage="No role matches that name" />`,
  ),
};

export const RestoredSignalFormValue: Story = {
  render: () => ({ template: '<lib-autocomplete-restored-demo />' }),
  parameters: doc(
    'A persisted key resolves through `byKeys()` immediately, independently of suggestion loading.',
    `<lib-autocomplete
  [formField]="roleForm.roleId"
  [source]="roleSource"
  key="id"
  [displayWith]="displayRole" />`,
  ),
};

export const ProviderAdapter: Story = {
  render: () => ({ template: '<lib-autocomplete-provider-demo />' }),
  parameters: doc(
    'Provider DTOs stay outside the control. A template presents normalized suggestions and a presentation-only footer carries attribution.',
    `<lib-autocomplete
  [source]="placesSource"
  key="id"
  [displayWith]="displayPlace"
  [(value)]="placeId">
  <ng-template libAutocompleteOption let-place>...</ng-template>
  <ng-template libAutocompleteFooter>...</ng-template>
</lib-autocomplete>`,
  ),
};

export const FieldAction: Story = {
  render: () => ({ template: '<lib-autocomplete-action-demo />' }),
  parameters: doc(
    'A field that can be filled another way. `leadingIcon` replaces the search glyph and `actionIcon` adds one button inside the field, after the clear slot; pressing it collapses the panel and emits `(action)`. The button is rendered only while it has both an icon and `actionAriaLabel`, is withheld while the control is disabled or readonly, and carries a tooltip repeating its name.',
    `<lib-autocomplete
  [source]="placesSource"
  key="id"
  [displayWith]="displayPlace"
  [leadingIcon]="mapPin"
  [actionIcon]="crosshair"
  [actionPending]="locating()"
  actionAriaLabel="Use my location"
  (action)="locate()" />`,
  ),
};
