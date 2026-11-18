import { Component, signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { form, FormField, type ValidationError } from '@angular/forms/signals';
import { firstValueFrom } from 'rxjs';
import { provideTransloco, TranslocoService } from '@jsverse/transloco';
import { provideUiCopy } from '@util/ui-copy';
import { LucideCrosshair, LucideMapPin, type LucideIconInput } from '@lucide/angular';
import type { DataInput, DataKey, DataSource, LoadRequest, LoadResult } from '@ui/data-source';
import { Autocomplete } from './autocomplete';
import { AutocompleteFooterTemplate, AutocompleteOptionTemplate } from './autocomplete-templates';
import type { AutocompleteResolutionFailure, AutocompleteSelection } from './autocomplete.types';

interface Role {
  id: number;
  name: string;
  description: string;
  disabled?: boolean;
}

const ROLES: readonly Role[] = [
  { id: 1, name: 'Administrator', description: 'Full access' },
  { id: 2, name: 'Κουρέας', description: 'Barber' },
  { id: 3, name: 'Reception', description: 'Front desk', disabled: true },
  ...Array.from({ length: 22 }, (_, index) => ({
    id: index + 4,
    name: `Role ${index + 4}`,
    description: `Role ${index + 4} description`,
  })),
];

@Component({
  imports: [Autocomplete, AutocompleteOptionTemplate, AutocompleteFooterTemplate],
  template: `
    <lib-autocomplete
      [source]="source()"
      key="id"
      [displayWith]="displayRole"
      [optionDisabled]="disableRole"
      [(value)]="value"
      [placeholder]="placeholder()"
      [pageSize]="pageSize()"
      [debounceMs]="debounceMs()"
      [showClear]="showClear()"
      [disabled]="disabled()"
      [readonly]="readonly()"
      [invalid]="invalid()"
      [touched]="touched()"
      [required]="required()"
      [errors]="errors()"
      [ariaDescribedby]="ariaDescribedby()"
      [noDataMessage]="noDataMessage()"
      [leadingIcon]="leadingIcon()"
      [actionIcon]="actionIcon()"
      [actionAriaLabel]="actionAriaLabel()"
      [actionPending]="actionPending()"
      [actionDisabled]="actionDisabled()"
      ariaLabel="Role"
      (action)="actions = actions + 1"
      (queryChange)="queries.push($event)"
      (selectionChange)="selections.push($event)"
      (resolutionFailed)="failures.push($event)"
      (touch)="touches = touches + 1"
    >
      @if (customOption()) {
        <ng-template libAutocompleteOption let-role let-query="query">
          <strong class="custom-role">{{ role.name }}</strong>
          <small>{{ role.description }} / {{ query }}</small>
        </ng-template>
      }
      @if (footer()) {
        <ng-template libAutocompleteFooter let-query="query">
          <span class="provider-footer">Provider / {{ query }}</span>
        </ng-template>
      }
    </lib-autocomplete>
  `,
})
class AutocompleteHost {
  readonly source = signal<DataInput<Role>>(ROLES);
  readonly value = signal<DataKey>('');
  readonly placeholder = signal('Search roles');
  readonly pageSize = signal(20);
  readonly debounceMs = signal(0);
  readonly showClear = signal(false);
  readonly disabled = signal(false);
  readonly readonly = signal(false);
  readonly invalid = signal(false);
  readonly touched = signal(false);
  readonly required = signal(false);
  readonly errors = signal<readonly ValidationError.WithOptionalFieldTree[]>([]);
  readonly ariaDescribedby = signal('');
  readonly noDataMessage = signal('');
  readonly customOption = signal(false);
  readonly footer = signal(false);
  readonly leadingIcon = signal<LucideIconInput | null>(null);
  readonly actionIcon = signal<LucideIconInput | null>(null);
  readonly actionAriaLabel = signal('');
  readonly actionPending = signal(false);
  readonly actionDisabled = signal(false);

  readonly queries: string[] = [];
  readonly selections: (AutocompleteSelection<Role> | undefined)[] = [];
  readonly failures: AutocompleteResolutionFailure[] = [];
  touches = 0;
  actions = 0;

  readonly displayRole = (role: Role): string => role.name;
  readonly disableRole = (role: Role): boolean => role.disabled ?? false;
}

@Component({
  imports: [Autocomplete, FormField],
  template: `
    <lib-autocomplete
      [formField]="roleForm.roleId"
      [source]="roles"
      key="id"
      [displayWith]="displayRole"
      ariaLabel="Role"
    />
  `,
})
class SignalFormsHost {
  readonly model = signal<{ roleId: DataKey }>({ roleId: 1 });
  readonly roleForm = form(this.model);
  readonly roles = ROLES;
  readonly displayRole = (role: Role): string => role.name;
}

function deferred<T>(): {
  readonly promise: Promise<T>;
  readonly resolve: (value: T) => void;
  readonly reject: (reason: unknown) => void;
} {
  let resolvePromise!: (value: T) => void;
  let rejectPromise!: (reason: unknown) => void;
  const promise = new Promise<T>((resolve, reject) => {
    resolvePromise = resolve;
    rejectPromise = reject;
  });
  return { promise, resolve: resolvePromise, reject: rejectPromise };
}

describe('Autocomplete', () => {
  let fixture: ComponentFixture<AutocompleteHost>;
  let host: AutocompleteHost;

  function root(): HTMLElement {
    const element = (fixture.nativeElement as HTMLElement).querySelector<HTMLElement>(
      'lib-autocomplete',
    );
    if (!element) {
      throw new Error('lib-autocomplete not rendered');
    }
    return element;
  }

  function input(): HTMLInputElement {
    const element = root().querySelector<HTMLInputElement>('input[role="combobox"]');
    if (!element) {
      throw new Error('autocomplete input not rendered');
    }
    return element;
  }

  function panel(): HTMLElement {
    const element = document.querySelector<HTMLElement>('.autocomplete-panel');
    if (!element) {
      throw new Error('autocomplete panel not rendered');
    }
    return element;
  }

  function options(): HTMLElement[] {
    return Array.from(document.querySelectorAll<HTMLElement>('.autocomplete-option'));
  }

  function action(): HTMLButtonElement | null {
    return root().querySelector<HTMLButtonElement>('.autocomplete-action');
  }

  async function settle(): Promise<void> {
    fixture.detectChanges();
    await fixture.whenStable();
  }

  async function open(): Promise<void> {
    input().focus();
    await settle();
  }

  async function type(value: string): Promise<void> {
    input().value = value;
    input().dispatchEvent(new InputEvent('input', { bubbles: true, data: value }));
    await settle();
  }

  async function loadScope(): Promise<void> {
    await firstValueFrom(TestBed.inject(TranslocoService).load('autocomplete/en'));
    await settle();
  }

  beforeEach(async () => {
    TestBed.configureTestingModule({
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
    });
    fixture = TestBed.createComponent(AutocompleteHost);
    host = fixture.componentInstance;
    await settle();
  });

  afterEach(() => {
    vi.useRealTimers();
    fixture.destroy();
  });

  it('does not load suggestions before the first interaction', async () => {
    let calls = 0;
    host.source.set({
      load: () => {
        calls++;
        return Promise.resolve({ rows: [] });
      },
    });
    await settle();

    expect(calls).toBe(0);
    expect(input().getAttribute('aria-expanded')).toBe('false');
  });

  it('loads and displays the first 20 rows on focus', async () => {
    await open();

    expect(input().getAttribute('aria-expanded')).toBe('true');
    expect(options()).toHaveLength(20);
    expect(options()[0].textContent.trim()).toBe('Administrator');
  });

  it('shows no active option until the keyboard moves into the list', async () => {
    await open();
    await type('role');

    expect(root().hasAttribute('data-navigated')).toBe(false);
    expect(input().hasAttribute('aria-activedescendant')).toBe(false);

    input().dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
    await settle();
    expect(host.value()).toBe('');

    input().dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true }));
    await settle();

    expect(root().hasAttribute('data-navigated')).toBe(true);
    expect(input().getAttribute('aria-activedescendant')).toBe(options()[0].id);
  });

  it('filters local items with case- and diacritic-insensitive contains matching', async () => {
    await open();
    await type('κουρεας');

    expect(options().map((option) => option.textContent.trim())).toEqual(['Κουρέας']);
  });

  it('commits only after an explicit option click', async () => {
    await open();
    await type('role 4');

    expect(host.value()).toBe('');
    options()[0].click();
    await settle();

    expect(host.value()).toBe(4);
    expect(input().value).toBe('Role 4');
    expect(host.selections.at(-1)).toEqual({ key: 4, item: ROLES[3] });
    expect(input().getAttribute('aria-expanded')).toBe('false');
  });

  it('stays closed when the option click blurred the input first', async () => {
    await open();
    await type('role 4');
    const option = options()[0];

    // What a real pointer press does and a synthetic click does not: the option is not
    // focusable, so pressing it blurs the input before the click commits. The panel is
    // captured first because the overlay detaches as soon as change detection runs.
    input().blur();
    option.click();
    await settle();

    expect(host.value()).toBe(4);
    expect(input().getAttribute('aria-expanded')).toBe('false');
  });

  it('restores the committed display text after unmatched input loses focus', async () => {
    host.value.set(1);
    await settle();
    expect(input().value).toBe('Administrator');

    await open();
    await type('not a role');
    input().dispatchEvent(
      new FocusEvent('focusout', { bubbles: true, relatedTarget: document.body }),
    );
    await settle();

    expect(host.value()).toBe(1);
    expect(input().value).toBe('Administrator');
  });

  it('loads more rows near the end and appends by key', async () => {
    await open();
    expect(options()).toHaveLength(20);

    const element = panel();
    Object.defineProperties(element, {
      scrollHeight: { configurable: true, value: 400 },
      clientHeight: { configurable: true, value: 200 },
      scrollTop: { configurable: true, value: 190 },
    });
    element.dispatchEvent(new Event('scroll'));
    await settle();

    expect(options()).toHaveLength(25);
    expect(new Set(options().map((option) => option.textContent.trim())).size).toBe(25);
  });

  it('reaches the last row when the page probe is the final item', async () => {
    host.source.set(ROLES.slice(0, 21));
    await settle();
    await open();
    expect(options()).toHaveLength(20);

    const element = panel();
    Object.defineProperties(element, {
      scrollHeight: { configurable: true, value: 400 },
      clientHeight: { configurable: true, value: 200 },
      scrollTop: { configurable: true, value: 190 },
    });
    element.dispatchEvent(new Event('scroll'));
    await settle();

    expect(options()).toHaveLength(21);
  });

  it('debounces typed remote queries and aborts the superseded request', async () => {
    const requests: LoadRequest[] = [];
    const gates = [deferred<LoadResult<Role>>(), deferred<LoadResult<Role>>()];
    let typedRequest = 0;
    host.debounceMs.set(10);
    host.source.set({
      load: (request) => {
        requests.push(request);
        if (request.search === '') {
          return Promise.resolve({ rows: [] });
        }
        return gates[typedRequest++].promise;
      },
    });
    await settle();

    input().focus();
    await settle();
    input().value = 'a';
    input().dispatchEvent(new InputEvent('input', { bubbles: true, data: 'a' }));
    fixture.detectChanges();
    await new Promise((resolve) => setTimeout(resolve, 15));
    input().value = 'adm';
    input().dispatchEvent(new InputEvent('input', { bubbles: true, data: 'adm' }));
    fixture.detectChanges();
    await new Promise((resolve) => setTimeout(resolve, 15));

    expect(requests).toHaveLength(3);
    expect(requests[1].signal?.aborted).toBe(true);
    gates[1].resolve({ rows: [ROLES[0]], hasMore: false });
    await Promise.resolve();
    await settle();

    expect(options().map((option) => option.textContent.trim())).toEqual(['Administrator']);
  });

  it('resolves an initial remote key without loading suggestions', async () => {
    let loads = 0;
    const keys: (readonly DataKey[])[] = [];
    const source: DataSource<Role> = {
      load: () => {
        loads++;
        return Promise.resolve({ rows: [] });
      },
      byKeys: (requested) => {
        keys.push(requested);
        return Promise.resolve([ROLES[1]]);
      },
    };
    host.source.set(source);
    host.value.set(2);
    await settle();

    expect(loads).toBe(0);
    expect(keys).toEqual([[2]]);
    expect(input().value).toBe('Κουρέας');
    expect(host.touches).toBe(0);
  });

  it('retains an unavailable initial key and reports the resolution failure', async () => {
    host.source.set({
      load: () => Promise.resolve({ rows: [] }),
      byKeys: () => Promise.resolve([]),
    });
    host.value.set(999);
    await settle();
    await loadScope();

    expect(host.value()).toBe(999);
    expect(host.failures.at(-1)).toMatchObject({ key: 999, reason: 'notFound' });
    expect(root().querySelector('.autocomplete-resolution')?.textContent.trim()).toBe(
      'Selected value is unavailable',
    );
  });

  it('reports a source without byKeys as unsupported while retaining the key', async () => {
    host.source.set({ load: () => Promise.resolve({ rows: [] }) });
    host.value.set(7);
    await settle();

    expect(host.value()).toBe(7);
    expect(host.failures.at(-1)).toMatchObject({ key: 7, reason: 'unsupported' });
  });

  it('clears through a real accessible button without reopening', async () => {
    host.showClear.set(true);
    host.value.set(1);
    await settle();
    await loadScope();

    const clear = root().querySelector<HTMLButtonElement>('.autocomplete-clear');
    if (!clear) {
      throw new Error('clear button not rendered');
    }
    expect(clear.getAttribute('aria-label')).toBe('Clear selection');
    clear.click();
    await settle();

    expect(host.value()).toBe('');
    expect(host.selections.at(-1)).toBeUndefined();
    expect(input().getAttribute('aria-expanded')).toBe('false');
  });

  it('withholds every edit path while disabled or readonly', async () => {
    host.showClear.set(true);
    host.value.set(1);
    host.disabled.set(true);
    await settle();

    expect(root().querySelector('.autocomplete-clear')).toBeNull();
    input().focus();
    await settle();
    expect(input().getAttribute('aria-expanded')).toBe('false');

    host.disabled.set(false);
    host.readonly.set(true);
    await settle();
    expect(root().querySelector('.autocomplete-clear')).toBeNull();
    input().click();
    await settle();
    expect(input().getAttribute('aria-expanded')).toBe('false');
  });

  it('renders custom option content and a presentation-only provider footer', async () => {
    host.customOption.set(true);
    host.footer.set(true);
    await settle();
    await open();

    expect(options()[0].querySelector('.custom-role')?.textContent).toBe('Administrator');
    expect(panel().querySelector('.provider-footer')?.textContent.trim()).toBe('Provider /');
    expect(panel().querySelector('.autocomplete-footer')?.getAttribute('role')).toBe(
      'presentation',
    );
  });

  it('composes consumer and validation descriptions after touch', async () => {
    host.ariaDescribedby.set('role-hint');
    host.invalid.set(true);
    host.touched.set(true);
    host.errors.set([{ kind: 'required', message: 'Choose a role' }]);
    await settle();
    // The message goes through the pipe, which renders nothing until the scope loads.
    await loadScope();

    const describedBy = input().getAttribute('aria-describedby') ?? '';
    expect(describedBy).toContain('role-hint');
    expect(describedBy).toContain('lib-autocomplete-error-');
    expect(root().querySelector('[role="alert"]')?.textContent.trim()).toBe('Choose a role');
    expect(input().hasAttribute('required')).toBe(false);
  });

  it('marks touch only after focus leaves the whole component', async () => {
    input().focus();
    input().dispatchEvent(new FocusEvent('focusout', { bubbles: true, relatedTarget: root() }));
    await settle();
    expect(host.touches).toBe(0);

    input().dispatchEvent(
      new FocusEvent('focusout', { bubbles: true, relatedTarget: document.body }),
    );
    await settle();
    expect(host.touches).toBe(1);
  });

  it('draws the search glyph until leadingIcon replaces it', async () => {
    expect(root().querySelector('.autocomplete-search-icon')?.classList).toContain('lucide-search');

    host.leadingIcon.set(LucideMapPin);
    await settle();

    const icon = root().querySelector('.autocomplete-search-icon');
    expect(icon?.classList).toContain('lucide-map-pin');
    expect(icon?.classList).not.toContain('lucide-search');
  });

  it('withholds the action button until it has both an icon and a name', async () => {
    expect(action()).toBeNull();

    host.actionIcon.set(LucideCrosshair);
    await settle();
    expect(action()).toBeNull();

    host.actionAriaLabel.set('Use my location');
    await settle();
    expect(action()?.getAttribute('aria-label')).toBe('Use my location');
  });

  it('puts the action last, past the clear slot, and names it on hover', async () => {
    host.actionIcon.set(LucideCrosshair);
    host.actionAriaLabel.set('Use my location');
    host.showClear.set(true);
    await settle();
    await type('Admin');

    const field = root().querySelector('.autocomplete-field');
    const order = Array.from(field?.children ?? []).map((child) => child.className);
    expect(order.at(-1)).toContain('autocomplete-action');
    expect(order.at(-2)).toContain('autocomplete-adornment');
    expect(field?.querySelector('.autocomplete-clear')).not.toBeNull();

    // The tooltip repeats the accessible name; it never becomes it.
    expect(action()?.getAttribute('aria-label')).toBe('Use my location');
    action()?.dispatchEvent(new MouseEvent('mouseenter'));
    // The tooltip waits out its show delay before it appears.
    await new Promise((resolve) => setTimeout(resolve, 150));
    await settle();
    expect(document.body.textContent).toContain('Use my location');
  });

  it('emits action and collapses the panel', async () => {
    host.actionIcon.set(LucideCrosshair);
    host.actionAriaLabel.set('Use my location');
    await open();
    expect(input().getAttribute('aria-expanded')).toBe('true');

    action()?.click();
    await settle();

    expect(host.actions).toBe(1);
    expect(input().getAttribute('aria-expanded')).toBe('false');
  });

  it('withholds the action button while the control is locked', async () => {
    host.actionIcon.set(LucideCrosshair);
    host.actionAriaLabel.set('Use my location');
    await settle();
    expect(action()).not.toBeNull();

    host.disabled.set(true);
    await settle();
    expect(action()).toBeNull();

    host.disabled.set(false);
    host.readonly.set(true);
    await settle();
    expect(action()).toBeNull();
  });

  it('blocks the action while it is pending or disabled', async () => {
    host.actionIcon.set(LucideCrosshair);
    host.actionAriaLabel.set('Use my location');
    host.actionPending.set(true);
    await settle();

    expect(action()?.disabled).toBe(true);
    expect(action()?.querySelector('.autocomplete-spinner')).not.toBeNull();
    action()?.click();
    await settle();
    expect(host.actions).toBe(0);

    host.actionPending.set(false);
    host.actionDisabled.set(true);
    await settle();

    expect(action()?.disabled).toBe(true);
    action()?.click();
    await settle();
    expect(host.actions).toBe(0);
  });
});

describe('Autocomplete with Signal Forms', () => {
  it('round-trips the stable key through FormValueControl', async () => {
    TestBed.configureTestingModule({
      providers: [
        provideTransloco({
          config: { availableLangs: ['en'], defaultLang: 'en', fallbackLang: 'en' },
        }),
      ],
    });
    const fixture = TestBed.createComponent(SignalFormsHost);
    await fixture.whenStable();

    const input = (fixture.nativeElement as HTMLElement).querySelector<HTMLInputElement>(
      'input[role="combobox"]',
    );
    if (!input) {
      throw new Error('autocomplete input not rendered');
    }
    input.focus();
    await fixture.whenStable();
    const option = document.querySelectorAll<HTMLElement>('.autocomplete-option')[1];
    option.click();
    await fixture.whenStable();

    expect(fixture.componentInstance.model().roleId).toBe(2);
    fixture.componentInstance.model.set({ roleId: 1 });
    await fixture.whenStable();
    expect(input.value).toBe('Administrator');

    fixture.destroy();
  });
});

describe('Autocomplete copy', () => {
  it('reads a key the consumer overrides in place of its own', async () => {
    TestBed.configureTestingModule({
      providers: [
        provideTransloco({
          config: { availableLangs: ['el', 'en'], defaultLang: 'en', fallbackLang: 'en' },
        }),
        provideUiCopy({ 'autocomplete.invalid': 'customer.invalid' }),
      ],
    });
    const fixture = TestBed.createComponent(AutocompleteHost);
    const transloco = TestBed.inject(TranslocoService);
    transloco.setTranslation({ customer: { invalid: 'Pick one from the list' } }, 'en', {
      merge: true,
    });
    const host = fixture.componentInstance;
    host.invalid.set(true);
    host.touched.set(true);
    host.errors.set([{ kind: 'required' }]);
    fixture.detectChanges();
    await fixture.whenStable();
    await firstValueFrom(transloco.load('autocomplete/en'));
    fixture.detectChanges();
    await fixture.whenStable();

    const alert = (fixture.nativeElement as HTMLElement).querySelector('[role="alert"]');
    expect(alert?.textContent.trim()).toBe('Pick one from the list');
  });
});
