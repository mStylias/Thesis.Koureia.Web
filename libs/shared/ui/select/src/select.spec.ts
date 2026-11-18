import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { Component, Directive, getDebugNode, inject, signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { firstValueFrom } from 'rxjs';
import { provideTransloco, TranslocoService } from '@jsverse/transloco';
import { Tooltip } from '@ui/tooltip';
import { FieldLabelSlot } from '@util/forms';
import { provideUiCopy } from '@util/ui-copy';
import type { DataKey, DataSource, LoadRequest } from '@ui/data-source';
import { Select } from './select';
import type { SelectResolutionFailure } from './select-option-source';
import { SelectOptionTemplate } from './select-templates';
import { SelectOption } from './select.types';

/** The text the element's `libTooltip` shows. */
function tooltipOf(element: Element | null | undefined): unknown {
  return element ? getDebugNode(element)?.injector.get(Tooltip).libTooltip() : undefined;
}

const BARBERS: SelectOption<string>[] = [
  { label: 'Kimonas', value: 'kimonas' },
  { label: 'Stavros', value: 'stavros' },
  { label: 'Elena', value: 'elena', disabled: true },
];

interface Role {
  readonly id: number;
  readonly name: string;
}

const ROLES: readonly Role[] = Array.from({ length: 25 }, (_, index) => ({
  id: index + 1,
  name: `Role ${index + 1}`,
}));

interface FakeSource extends DataSource<Role> {
  readonly requests: LoadRequest[];
  readonly lookups: (readonly DataKey[])[];
}

function createRoleSource(items: readonly Role[] = ROLES, withByKeys = true): FakeSource {
  const requests: LoadRequest[] = [];
  const lookups: (readonly DataKey[])[] = [];
  const source: FakeSource = {
    requests,
    lookups,
    load: (request) => {
      requests.push(request);
      const needle = (request.search ?? '').trim().toLocaleLowerCase();
      const matched = needle
        ? items.filter((role) => role.name.toLocaleLowerCase().includes(needle))
        : items;
      const skip = request.skip ?? 0;
      const take = request.take;
      return Promise.resolve({
        rows: matched.slice(skip, take === undefined ? undefined : skip + take),
      });
    },
  };
  if (withByKeys) {
    source.byKeys = (keys) => {
      lookups.push(keys);
      return Promise.resolve(items.filter((role) => keys.includes(role.id)));
    };
  }
  return source;
}

const roleName = (role: Role): string => role.name;

@Component({
  imports: [Select, SelectOptionTemplate],
  template: `
    <lib-select
      [options]="options()"
      [source]="source()"
      key="id"
      [displayWith]="displayWith"
      [pageSize]="pageSize()"
      [debounceMs]="0"
      [(value)]="value"
      [placeholder]="placeholder()"
      [disabled]="disabled()"
      [invalid]="invalid()"
      [frameless]="frameless()"
      [required]="required()"
      [loading]="loading()"
      [showClear]="showClear()"
      [ariaDescribedby]="ariaDescribedby()"
      [emptyMessage]="emptyMessage()"
      [clearAriaLabel]="clearAriaLabel()"
      ariaLabel="Barber"
      (touch)="touchCount = touchCount + 1"
      (resolutionFailed)="failures.push($event)"
    >
      @if (withOptionTemplate()) {
        <ng-template libSelectOption let-option>
          <em class="custom-option">{{ option.label.toUpperCase() }}</em>
        </ng-template>
      }
    </lib-select>
  `,
})
class SelectHost {
  readonly options = signal<SelectOption<string>[]>(BARBERS);
  readonly source = signal<DataSource<Role> | undefined>(undefined);
  readonly pageSize = signal(10);
  readonly displayWith = roleName;
  readonly value = signal<string | number | undefined>(undefined);
  readonly placeholder = signal('Select a barber');
  readonly disabled = signal(false);
  readonly invalid = signal(false);
  readonly frameless = signal(false);
  readonly required = signal(false);
  readonly loading = signal(false);
  readonly showClear = signal(false);
  readonly ariaDescribedby = signal('');
  readonly emptyMessage = signal('');
  readonly clearAriaLabel = signal('');
  readonly withOptionTemplate = signal(false);

  touchCount = 0;
  readonly failures: SelectResolutionFailure[] = [];
}

describe('Select', () => {
  let fixture: ComponentFixture<SelectHost>;
  let host: SelectHost;

  function root(): HTMLElement {
    const element = (fixture.nativeElement as HTMLElement).querySelector('lib-select');
    if (!element) {
      throw new Error('lib-select not rendered');
    }
    return element as HTMLElement;
  }

  function trigger(): HTMLElement {
    const element = root().querySelector<HTMLElement>('[role="combobox"]');
    if (!element) {
      throw new Error('trigger not rendered');
    }
    return element;
  }

  function listOptions(): HTMLElement[] {
    return Array.from(root().querySelectorAll<HTMLElement>('[role="option"]'));
  }

  async function settle(): Promise<void> {
    fixture.detectChanges();
    await fixture.whenStable();
  }

  async function open(): Promise<void> {
    // jsdom's click() does not focus like a real pointer would, and the
    // combobox pattern collapses when neither the trigger nor the popup
    // has focus.
    trigger().focus();
    trigger().click();
    await settle();
  }

  /**
   * Loads the lib's lazy scope. Order matters: a `TranslocoPipe` has to
   * transform first (it supplies the inline loader `load()` needs), or
   * the service caches an empty translation under the key forever.
   */
  async function loadScope(): Promise<void> {
    await firstValueFrom(TestBed.inject(TranslocoService).load('select/en'));
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
    fixture = TestBed.createComponent(SelectHost);
    host = fixture.componentInstance;
    await settle();
  });

  it('renders the placeholder until a value is selected', () => {
    expect(trigger().textContent).toContain('Select a barber');
    expect(root().hasAttribute('data-filled')).toBe(false);
  });

  it('opens on click and lists the options', async () => {
    expect(trigger().getAttribute('aria-expanded')).toBe('false');

    await open();

    expect(trigger().getAttribute('aria-expanded')).toBe('true');
    expect(listOptions().map((o) => o.textContent.trim())).toEqual(['Kimonas', 'Stavros', 'Elena']);
  });

  it('selects an option on click, closes, and reports filled', async () => {
    await open();

    listOptions()[1].click();
    await settle();

    expect(host.value()).toBe('stavros');
    expect(trigger().getAttribute('aria-expanded')).toBe('false');
    expect(trigger().textContent).toContain('Stavros');
    expect(root().hasAttribute('data-filled')).toBe(true);
  });

  it('keeps the dropdown open when a disabled option is clicked', async () => {
    await open();

    listOptions()[2].click();
    await settle();

    expect(host.value()).toBeUndefined();
    expect(trigger().getAttribute('aria-expanded')).toBe('true');
  });

  it('renders the selected option from outside through the value model', async () => {
    host.value.set('kimonas');
    await settle();

    expect(trigger().textContent).toContain('Kimonas');
  });

  it('shows the clear affordance only when clearable and filled', async () => {
    expect(root().querySelector('.select-clear')).toBeNull();

    host.showClear.set(true);
    host.value.set('kimonas');
    await settle();

    const clear = root().querySelector<SVGElement>('.select-clear');
    expect(clear).not.toBeNull();

    clear?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    await settle();

    expect(host.value()).toBeUndefined();
    // The clear click must not toggle the dropdown open.
    expect(trigger().getAttribute('aria-expanded')).toBe('false');
  });

  it('clears with the Delete key while closed', async () => {
    host.showClear.set(true);
    host.value.set('kimonas');
    await settle();

    trigger().dispatchEvent(new KeyboardEvent('keydown', { key: 'Delete', bubbles: true }));
    await settle();

    expect(host.value()).toBeUndefined();
  });

  it('does not open while disabled', async () => {
    host.disabled.set(true);
    await settle();

    expect(root().hasAttribute('data-disabled')).toBe(true);

    await open();
    expect(trigger().getAttribute('aria-expanded')).toBe('false');
  });

  it('reflects invalid on the host and the trigger', async () => {
    host.invalid.set(true);
    await settle();

    expect(root().hasAttribute('data-invalid')).toBe(true);
    expect(trigger().getAttribute('aria-invalid')).toBe('true');
  });

  it('reflects frameless, so a parent can draw the frame for a group', async () => {
    expect(root().hasAttribute('data-frameless')).toBe(false);

    host.frameless.set(true);
    host.invalid.set(true);
    await settle();

    expect(root().hasAttribute('data-frameless')).toBe(true);
    // Invalid still reports: a state the user must notice outranks the one
    // doubled hairline that frameless exists to remove.
    expect(root().hasAttribute('data-invalid')).toBe(true);
  });

  it('swaps the chevron for a spinner while loading', async () => {
    expect(root().querySelector('.select-chevron')).not.toBeNull();

    host.loading.set(true);
    await settle();

    expect(root().querySelector('.select-chevron')).toBeNull();
    expect(root().querySelector('.select-spinner')).not.toBeNull();
  });

  it('falls back to the translated empty message', async () => {
    host.options.set([]);
    await open();
    await loadScope();

    expect(root().querySelector('.select-empty')?.textContent.trim()).toBe('No results found');
  });

  it('labels the pointer-only clear affordance from the lazy scope', async () => {
    host.showClear.set(true);
    host.value.set('kimonas');
    await settle();
    await loadScope();

    // A tooltip, not an `aria-label`: the × is aria-hidden, so an aria-label
    // would be markup the a11y tree never reaches.
    expect(tooltipOf(root().querySelector('.select-clear'))).toBe('Clear selection');
  });

  it('lets a consumer override the translated copy', async () => {
    host.emptyMessage.set('Nothing to book');
    host.clearAriaLabel.set('Reset');
    host.showClear.set(true);
    host.value.set('kimonas');
    await settle();
    await loadScope();

    expect(tooltipOf(root().querySelector('.select-clear'))).toBe('Reset');

    host.options.set([]);
    await open();

    expect(root().querySelector('.select-empty')?.textContent.trim()).toBe('Nothing to book');
  });

  it('exposes required as aria-required, never the native attribute', async () => {
    host.required.set(true);
    await settle();

    expect(trigger().getAttribute('aria-required')).toBe('true');
    // The native attribute would block the submit event outright and
    // raise an OS-locale bubble over the form's translated message.
    expect(trigger().hasAttribute('required')).toBe(false);
  });

  it('passes aria-describedby through to the trigger', async () => {
    host.ariaDescribedby.set('barber-hint');
    await settle();

    expect(trigger().getAttribute('aria-describedby')).toBe('barber-hint');
  });

  it('does not clear on Delete while disabled', async () => {
    host.showClear.set(true);
    host.value.set('kimonas');
    host.disabled.set(true);
    await settle();

    // The combobox pattern disables through `aria-disabled`, so the
    // trigger keeps DOM focus and still receives the shortcut.
    expect(trigger().getAttribute('aria-disabled')).toBe('true');
    trigger().dispatchEvent(new KeyboardEvent('keydown', { key: 'Delete', bubbles: true }));
    await settle();

    expect(host.value()).toBe('kimonas');
  });

  it('withholds the clear affordance while disabled', async () => {
    host.showClear.set(true);
    host.value.set('kimonas');
    host.disabled.set(true);
    await settle();

    expect(root().querySelector('.select-clear')).toBeNull();
  });

  it('tracks the input modality for the active-option ring', async () => {
    expect(root().getAttribute('data-modality')).toBe('keyboard');

    // jsdom has no PointerEvent; MouseEvent carries the type just as well.
    trigger().dispatchEvent(new MouseEvent('pointerdown', { bubbles: true }));
    await settle();
    expect(root().getAttribute('data-modality')).toBe('pointer');

    // Regression: the aria KeyboardEventManager stops propagation for the
    // keys it handles, so a host-level listener never saw the arrows and
    // the ring stayed suppressed for the rest of the interaction.
    trigger().dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true }));
    await settle();
    expect(root().getAttribute('data-modality')).toBe('keyboard');
  });

  // Regression: the listbox always marks an option active, and its ring read as a preselection.
  it('marks no option until the keyboard moves through the list', async () => {
    await open();

    expect(root().hasAttribute('data-navigated')).toBe(false);
    expect(trigger().getAttribute('aria-activedescendant')).toBeNull();

    trigger().dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true }));
    await settle();

    expect(root().hasAttribute('data-navigated')).toBe(true);
    expect(listOptions()[0].getAttribute('data-active')).toBe('true');
    expect(trigger().getAttribute('aria-activedescendant')).toBe(listOptions()[0].id);
  });

  it('closes on Enter without choosing the option it hides', async () => {
    await open();

    trigger().dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
    await settle();

    expect(host.value()).toBeUndefined();
    expect(listOptions()).toHaveLength(0);
  });

  // A consumer that draws something over the closed field needs the clearance
  // on the field, not on its own `libSelectedItem` content: that content stands
  // in for the selected item only, so the placeholder and the unavailable
  // message would keep the whole width and run under whatever is drawn there.
  it('lets a consumer reserve room at the end of the closed field', () => {
    const stylesheet = readFileSync(join(process.cwd(), 'src/select.scss'), 'utf8');
    const value = stylesheet.slice(stylesheet.indexOf('.select-value {'));

    expect(value.slice(0, value.indexOf('}'))).toContain(
      'padding-inline-end: var(--select-value-inset-end, 0)',
    );
  });

  it('renders options through the custom template', async () => {
    host.withOptionTemplate.set(true);
    await open();

    const custom = root().querySelectorAll('.custom-option');
    expect(custom.length).toBe(3);
    expect(custom[0].textContent).toBe('KIMONAS');
  });

  it('emits touch when focus leaves the component', async () => {
    trigger().focus();
    await settle();

    trigger().dispatchEvent(new FocusEvent('focusout', { bubbles: true, relatedTarget: null }));
    await settle();

    expect(host.touchCount).toBe(1);
  });
  describe('bound to a data source', () => {
    let source: FakeSource;

    beforeEach(async () => {
      source = createRoleSource();
      host.options.set([]);
      host.source.set(source);
      await settle();
    });

    function panel(): HTMLElement {
      const element = root().querySelector<HTMLElement>('.select-panel');
      if (!element) {
        throw new Error('panel not rendered');
      }
      return element;
    }

    function type(key: string): void {
      trigger().dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true }));
    }

    it('loads the first page when the panel opens', async () => {
      expect(source.requests).toHaveLength(0);

      await open();

      expect(source.requests).toHaveLength(1);
      // One row past the page proves another page exists without a $count.
      expect(source.requests[0].take).toBe(11);
      expect(listOptions().map((option) => option.textContent.trim())).toEqual(
        ROLES.slice(0, 10).map(roleName),
      );
    });

    it('selects by the declared key, not by item identity', async () => {
      await open();
      listOptions()[2].click();
      await settle();

      expect(host.value()).toBe(3);
      expect(trigger().textContent).toContain('Role 3');
    });

    it('resolves a bound key that no loaded page contains', async () => {
      host.value.set(24);
      await settle();

      expect(source.lookups).toEqual([[24]]);
      expect(trigger().textContent).toContain('Role 24');
      expect(root().hasAttribute('data-unresolved')).toBe(false);
    });

    it('keeps a key the source cannot resolve and reports why', async () => {
      host.value.set(999);
      await settle();

      expect(host.value()).toBe(999);
      expect(root().hasAttribute('data-unresolved')).toBe(true);
      expect(host.failures).toEqual([{ keys: [999], reason: 'notFound' }]);
    });

    it('reports an unsupported lookup rather than clearing the value', async () => {
      host.source.set(createRoleSource(ROLES, false));
      host.value.set(7);
      await settle();

      expect(host.value()).toBe(7);
      expect(host.failures.at(-1)?.reason).toBe('unsupported');
    });

    function searchField(): HTMLInputElement {
      const element = root().querySelector<HTMLInputElement>('.select-search-input');
      if (!element) {
        throw new Error('search field not rendered');
      }
      return element;
    }

    it('opens on a typed character and seeds the panel search with it', async () => {
      // The select-only combobox answers a character with a typeahead; one loaded
      // page is the wrong set to jump inside, so it becomes the query instead.
      type('2');
      await settle();

      expect(trigger().getAttribute('aria-expanded')).toBe('true');
      expect(source.requests.at(-1)?.search).toBe('2');
      expect(searchField().value).toBe('2');
    });

    it('queries the source from the panel search field', async () => {
      await open();
      const field = searchField();
      field.value = '24';
      field.dispatchEvent(new Event('input', { bubbles: true }));
      await settle();

      expect(source.requests.at(-1)?.search).toBe('24');
      expect(listOptions().map((option) => option.textContent.trim())).toEqual(['Role 24']);
    });

    it('still relays navigation keys to the listbox', async () => {
      // Regression: the combobox relays trigger keys to the popup's widget,
      // which is the panel here, so the listbox only sees what the panel hops
      // down to it.
      await open();
      // The first ArrowDown reveals the hidden active option, so the second one moves.
      type('ArrowDown');
      await settle();
      type('ArrowDown');
      await settle();
      await settle();

      expect(listOptions()[1].getAttribute('data-active')).toBe('true');
    });

    it('forwards the search field’s navigation keys to the listbox', async () => {
      await open();
      for (let press = 0; press < 2; press++) {
        searchField().dispatchEvent(
          new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true }),
        );
        await settle();
      }

      expect(listOptions()[1].getAttribute('data-active')).toBe('true');
    });

    it('appends the next page when the panel scrolls', async () => {
      await open();
      expect(listOptions()).toHaveLength(10);

      const element = panel();
      Object.defineProperties(element, {
        scrollHeight: { configurable: true, value: 400 },
        clientHeight: { configurable: true, value: 200 },
        scrollTop: { configurable: true, value: 190 },
      });
      element.dispatchEvent(new Event('scroll'));
      await settle();

      expect(source.requests.at(-1)?.skip).toBe(10);
      expect(listOptions()).toHaveLength(20);
    });

    it('leaves the source idle while options are bound', async () => {
      host.options.set(BARBERS);
      await settle();
      await open();

      expect(source.requests).toHaveLength(0);
      expect(listOptions().map((option) => option.textContent.trim())).toEqual([
        'Kimonas',
        'Stavros',
        'Elena',
      ]);
    });
  });

  // The panel renders inline, so nothing repositions it but the component
  // itself: it measures the room under the trigger and opens upward when the
  // list would be cut off there.
  describe('panel placement', () => {
    const nativeOffsetHeight = Object.getOwnPropertyDescriptor(
      HTMLElement.prototype,
      'offsetHeight',
    );

    function panel(): HTMLElement {
      const element = root().querySelector<HTMLElement>('.select-panel');
      if (!element) {
        throw new Error('panel not rendered');
      }
      return element;
    }

    /** Stubs the one layout the placement reads. jsdom measures nothing. */
    function stubRoom(triggerTop: number, viewport: number, panelHeight: number): void {
      Object.defineProperty(document.documentElement, 'clientHeight', {
        configurable: true,
        get: () => viewport,
      });
      Object.defineProperty(HTMLElement.prototype, 'offsetHeight', {
        configurable: true,
        get(this: HTMLElement): number {
          return this.classList.contains('select-panel') ? panelHeight : 0;
        },
      });
      trigger().getBoundingClientRect = (): DOMRect => new DOMRect(0, triggerTop, 200, 32);
    }

    afterEach(() => {
      Reflect.deleteProperty(document.documentElement, 'clientHeight');
      if (nativeOffsetHeight) {
        Object.defineProperty(HTMLElement.prototype, 'offsetHeight', nativeOffsetHeight);
      }
    });

    it('opens above the trigger when the room below would cut the panel off', async () => {
      host.options.set(BARBERS);
      await settle();
      // 28px under the trigger and 500 over it, for a panel wanting 200.
      stubRoom(540, 600, 200);

      await open();

      expect(panel().classList.contains('select-panel-above')).toBe(true);
    });

    it('stays below the trigger when the panel fits there', async () => {
      host.options.set(BARBERS);
      await settle();
      stubRoom(100, 600, 200);

      await open();

      expect(panel().classList.contains('select-panel-above')).toBe(false);
    });
  });
});

describe('Select copy', () => {
  it('reads a key the consumer overrides in place of its own', async () => {
    TestBed.configureTestingModule({
      providers: [
        provideTransloco({
          config: { availableLangs: ['el', 'en'], defaultLang: 'en', fallbackLang: 'en' },
        }),
        provideUiCopy({ 'select.clear': 'customer.clear' }),
      ],
    });
    const fixture = TestBed.createComponent(SelectHost);
    const transloco = TestBed.inject(TranslocoService);
    transloco.setTranslation({ customer: { clear: 'Clear your choice' } }, 'en', { merge: true });
    fixture.componentInstance.showClear.set(true);
    fixture.componentInstance.value.set('kimonas');
    fixture.detectChanges();
    await fixture.whenStable();
    await firstValueFrom(transloco.load('select/en'));
    fixture.detectChanges();

    const clear = (fixture.nativeElement as HTMLElement).querySelector('.select-clear');
    expect(tooltipOf(clear)).toBe('Clear your choice');
  });
});

/** Stands in for `lib-field`: an element around the control that hands over its label's id. */
@Directive({ selector: '[libFieldLabelStub]', providers: [FieldLabelSlot] })
class FieldLabelStub {
  constructor() {
    inject(FieldLabelSlot).connect(signal('barber-label'));
  }
}

@Component({
  imports: [FieldLabelStub, Select],
  template: `
    <div libFieldLabelStub>
      <lib-select [options]="options" [ariaLabel]="ariaLabel()" />
    </div>
  `,
})
class FieldLabelHost {
  readonly options = BARBERS;
  readonly ariaLabel = signal('');
}

describe('Select under a field', () => {
  function trigger(fixture: ComponentFixture<FieldLabelHost>): HTMLElement {
    const element = (fixture.nativeElement as HTMLElement).querySelector<HTMLElement>(
      '[role="combobox"]',
    );
    if (!element) throw new Error('trigger not rendered');
    return element;
  }

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideTransloco({ config: { availableLangs: ['en'], defaultLang: 'en' } })],
    });
  });

  it("takes its name from the field's label, which <label for> cannot give a div", () => {
    const fixture = TestBed.createComponent(FieldLabelHost);
    fixture.detectChanges();

    expect(trigger(fixture).getAttribute('aria-labelledby')).toBe('barber-label');
  });

  it("leaves the name to the consumer's own aria-label", () => {
    const fixture = TestBed.createComponent(FieldLabelHost);
    fixture.componentInstance.ariaLabel.set('Barber');
    fixture.detectChanges();

    expect(trigger(fixture).getAttribute('aria-labelledby')).toBeNull();
    expect(trigger(fixture).getAttribute('aria-label')).toBe('Barber');
  });
});
