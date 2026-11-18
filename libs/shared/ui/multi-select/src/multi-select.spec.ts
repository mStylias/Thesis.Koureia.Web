import { Component, getDebugNode, signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { firstValueFrom } from 'rxjs';
import { provideTransloco, TranslocoService } from '@jsverse/transloco';
import { Tooltip } from '@ui/tooltip';
import { provideUiCopy } from '@util/ui-copy';
import type { DataKey, DataSource, LoadRequest } from '@ui/data-source';
import { SelectOption } from '@ui/select';
import { MultiSelect } from './multi-select';
import { MultiSelectDisplay } from './multi-select.types';

/** The text the element's `libTooltip` shows. */
function tooltipOf(element: Element | null | undefined): unknown {
  return element ? getDebugNode(element)?.injector.get(Tooltip).libTooltip() : undefined;
}

const SERVICES: SelectOption<string>[] = [
  { label: 'Skin fade', value: 'fade' },
  { label: 'Beard trim', value: 'beard' },
  { label: 'Hot towel shave', value: 'shave' },
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

function createRoleSource(): FakeSource {
  const requests: LoadRequest[] = [];
  const lookups: (readonly DataKey[])[] = [];
  return {
    requests,
    lookups,
    load: (request) => {
      requests.push(request);
      const needle = (request.search ?? '').trim().toLocaleLowerCase();
      const matched = needle
        ? ROLES.filter((role) => role.name.toLocaleLowerCase().includes(needle))
        : ROLES;
      const skip = request.skip ?? 0;
      const take = request.take;
      return Promise.resolve({
        rows: matched.slice(skip, take === undefined ? undefined : skip + take),
      });
    },
    byKeys: (keys) => {
      lookups.push(keys);
      return Promise.resolve(ROLES.filter((role) => keys.includes(role.id)));
    },
  };
}

const roleName = (role: Role): string => role.name;

@Component({
  imports: [MultiSelect],
  template: `
    <lib-multi-select
      [options]="options()"
      [source]="source()"
      key="id"
      [displayWith]="displayWith"
      [pageSize]="10"
      [debounceMs]="0"
      [(value)]="value"
      [display]="display()"
      [placeholder]="placeholder()"
      [showClear]="showClear()"
      [disabled]="disabled()"
      [required]="required()"
      [ariaDescribedby]="ariaDescribedby()"
      [emptyMessage]="emptyMessage()"
      [clearAriaLabel]="clearAriaLabel()"
      ariaLabel="Services"
    />
  `,
})
class MultiSelectHost {
  readonly options = signal<SelectOption<string>[]>(SERVICES);
  readonly source = signal<DataSource<Role> | undefined>(undefined);
  readonly displayWith = roleName;
  readonly value = signal<(string | number)[]>([]);
  readonly display = signal<MultiSelectDisplay>('comma');
  readonly placeholder = signal('Select services');
  readonly showClear = signal(false);
  readonly disabled = signal(false);
  readonly required = signal(false);
  readonly ariaDescribedby = signal('');
  readonly emptyMessage = signal('');
  readonly clearAriaLabel = signal('');
}

describe('MultiSelect', () => {
  let fixture: ComponentFixture<MultiSelectHost>;
  let host: MultiSelectHost;

  function root(): HTMLElement {
    const element = (fixture.nativeElement as HTMLElement).querySelector('lib-multi-select');
    if (!element) {
      throw new Error('lib-multi-select not rendered');
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
    await firstValueFrom(TestBed.inject(TranslocoService).load('multiSelect/en'));
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
    fixture = TestBed.createComponent(MultiSelectHost);
    host = fixture.componentInstance;
    await settle();
  });

  // Regression: the listbox always marks an option active, and its ring read as a preselection.
  it('marks no option until the keyboard moves through the list', async () => {
    await open();

    expect(root().hasAttribute('data-navigated')).toBe(false);
    expect(trigger().getAttribute('aria-activedescendant')).toBeNull();

    trigger().dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true }));
    await settle();

    expect(root().hasAttribute('data-navigated')).toBe(true);
    expect(trigger().getAttribute('aria-activedescendant')).toBe(listOptions()[0].id);
  });

  it('toggles nothing on Enter while no option is shown active', async () => {
    await open();

    trigger().dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
    await settle();

    expect(host.value()).toEqual([]);
  });

  it('marks the listbox as multi-selectable', async () => {
    await open();

    expect(root().querySelector('[role="listbox"]')?.getAttribute('aria-multiselectable')).toBe(
      'true',
    );
  });

  it('toggles options without closing the dropdown', async () => {
    await open();

    listOptions()[0].click();
    await settle();
    listOptions()[2].click();
    await settle();

    expect(host.value()).toEqual(['fade', 'shave']);
    expect(trigger().getAttribute('aria-expanded')).toBe('true');

    // Clicking a selected option deselects it.
    listOptions()[0].click();
    await settle();
    expect(host.value()).toEqual(['shave']);
  });

  it('joins the selected labels in comma display', async () => {
    host.value.set(['fade', 'beard']);
    await settle();

    expect(trigger().textContent).toContain('Skin fade, Beard trim');
    expect(root().hasAttribute('data-filled')).toBe(true);
  });

  it('renders removable chips in chip display', async () => {
    host.display.set('chip');
    host.value.set(['fade', 'beard']);
    await settle();

    const chips = root().querySelectorAll('.select-chip');
    expect(chips.length).toBe(2);

    chips[0]
      .querySelector('.select-chip-remove')
      ?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    await settle();

    expect(host.value()).toEqual(['beard']);
    // Removing a chip must not toggle the dropdown open.
    expect(trigger().getAttribute('aria-expanded')).toBe('false');
  });

  describe('past three chip rows', () => {
    const MANY: SelectOption<string>[] = Array.from({ length: 8 }, (_, index) => ({
      label: `Service ${(index + 1).toString()}`,
      value: `s${(index + 1).toString()}`,
    }));
    const offsetTop = Object.getOwnPropertyDescriptor(HTMLElement.prototype, 'offsetTop');

    // jsdom has no layout: two visible chips to a row, 20px apart.
    beforeEach(() => {
      Object.defineProperty(HTMLElement.prototype, 'offsetTop', {
        configurable: true,
        get(this: HTMLElement) {
          const parent = this.parentElement;
          if (!parent?.classList.contains('select-chips')) return 0;
          const slots = Array.from(parent.children).filter(
            (child) =>
              !(child as HTMLElement).hidden && !child.classList.contains('select-sr-only'),
          );
          return Math.floor(slots.indexOf(this) / 2) * 20;
        },
      });
    });

    afterEach(() => {
      if (offsetTop) Object.defineProperty(HTMLElement.prototype, 'offsetTop', offsetTop);
    });

    function visibleChips(): string[] {
      return Array.from(root().querySelectorAll<HTMLElement>('.select-chip'))
        .filter((chip) => !chip.hidden)
        .map((chip) => chip.textContent.trim());
    }

    function more(): HTMLElement {
      const element = root().querySelector<HTMLElement>('.select-more');
      if (!element) {
        throw new Error('"+N" chip not rendered');
      }
      return element;
    }

    it('folds the rest into "+N", which takes a slot of the last row', async () => {
      host.options.set(MANY);
      host.display.set('chip');
      host.value.set(MANY.map((option) => option.value));
      await settle();

      expect(visibleChips()).toEqual([
        'Service 1',
        'Service 2',
        'Service 3',
        'Service 4',
        'Service 5',
      ]);
      expect(more().hidden).toBe(false);
      expect(more().dataset['count']).toBe('3');
      expect(tooltipOf(more())).toBe('Service 6, Service 7, Service 8');
    });

    it('shows every chip and no "+N" while three rows hold them', async () => {
      host.options.set(MANY);
      host.display.set('chip');
      host.value.set(MANY.slice(0, 6).map((option) => option.value));
      await settle();

      expect(visibleChips()).toHaveLength(6);
      expect(more().hidden).toBe(true);
    });

    it('still names the whole selection to assistive tech', async () => {
      host.options.set(MANY);
      host.display.set('chip');
      host.value.set(MANY.map((option) => option.value));
      await settle();

      expect(root().querySelector('.select-chips')?.getAttribute('aria-hidden')).toBe('true');
      expect(root().querySelector('.select-sr-only')?.textContent.trim()).toBe(
        MANY.map((option) => option.label).join(', '),
      );
    });
  });

  it('clears the whole selection through the clear affordance', async () => {
    host.showClear.set(true);
    host.value.set(['fade', 'beard']);
    await settle();

    root()
      .querySelector('.select-clear')
      ?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    await settle();

    expect(host.value()).toEqual([]);
    expect(trigger().textContent).toContain('Select services');
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
    host.ariaDescribedby.set('services-hint');
    await settle();

    expect(trigger().getAttribute('aria-describedby')).toBe('services-hint');
  });

  it('does not clear on Delete while disabled', async () => {
    host.showClear.set(true);
    host.value.set(['fade', 'beard']);
    host.disabled.set(true);
    await settle();

    // The combobox pattern disables through `aria-disabled`, so the
    // trigger keeps DOM focus and still receives the shortcut.
    expect(trigger().getAttribute('aria-disabled')).toBe('true');
    trigger().dispatchEvent(new KeyboardEvent('keydown', { key: 'Delete', bubbles: true }));
    await settle();

    expect(host.value()).toEqual(['fade', 'beard']);
  });

  it('withholds both × affordances while disabled', async () => {
    host.display.set('chip');
    host.showClear.set(true);
    host.value.set(['fade']);
    host.disabled.set(true);
    await settle();

    expect(root().querySelector('.select-chip-remove')).toBeNull();
    expect(root().querySelector('.select-clear')).toBeNull();
  });

  it('labels the pointer-only × affordances from the lazy scope', async () => {
    host.display.set('chip');
    host.showClear.set(true);
    host.value.set(['fade']);
    await settle();
    await loadScope();

    // A tooltip, not an `aria-label`: both are aria-hidden, so an aria-label
    // would be markup the a11y tree never reaches.
    expect(tooltipOf(root().querySelector('.select-chip-remove'))).toBe('Remove Skin fade');
    expect(tooltipOf(root().querySelector('.select-clear'))).toBe('Clear selection');
  });

  it('tracks the input modality for the active-option ring', async () => {
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

  it('falls back to the translated empty message', async () => {
    host.options.set([]);
    await open();
    await loadScope();

    expect(root().querySelector('.select-empty')?.textContent.trim()).toBe('No results found');
  });

  it('lets a consumer override the translated copy', async () => {
    host.emptyMessage.set('Nothing to book');
    host.clearAriaLabel.set('Reset');
    host.showClear.set(true);
    host.value.set(['fade']);
    await settle();
    await loadScope();

    expect(tooltipOf(root().querySelector('.select-clear'))).toBe('Reset');

    host.options.set([]);
    await open();

    expect(root().querySelector('.select-empty')?.textContent.trim()).toBe('Nothing to book');
  });
  describe('bound to a data source', () => {
    let source: FakeSource;

    beforeEach(async () => {
      source = createRoleSource();
      host.options.set([]);
      host.source.set(source);
      host.display.set('chip');
      await settle();
    });

    function chips(): string[] {
      return Array.from(root().querySelectorAll<HTMLElement>('.select-chip')).map((chip) =>
        chip.textContent.trim(),
      );
    }

    it('restores chips for values no loaded page contains', async () => {
      host.value.set([24, 25]);
      await settle();

      expect(source.lookups).toEqual([[24, 25]]);
      expect(chips()).toEqual(['Role 24', 'Role 25']);
      expect(root().hasAttribute('data-unresolved')).toBe(false);
    });

    it('keeps values the source cannot display and counts them', async () => {
      host.value.set([1, 999]);
      await open();
      await settle();

      expect(host.value()).toEqual([1, 999]);
      expect(root().hasAttribute('data-unresolved')).toBe(true);
      expect(root().querySelector('.select-unavailable')?.textContent).toContain('(1)');
    });

    it('types a space into the query instead of toggling the active option', async () => {
      // The reason the panel routes keys by hand: relayed to the listbox, Space
      // toggles whatever option is active, mid-word.
      await open();
      trigger().dispatchEvent(new KeyboardEvent('keydown', { key: 'R', bubbles: true }));
      trigger().dispatchEvent(new KeyboardEvent('keydown', { key: ' ', bubbles: true }));
      await settle();
      await settle();

      expect(source.requests.at(-1)?.search).toBe('R ');
      expect(host.value()).toEqual([]);
    });

    it('collapses when focus leaves the control', async () => {
      // The combobox only checks for collapse on the trigger's own focusout, and
      // focus sits in the panel's search field while a source is bound.
      await open();
      expect(trigger().getAttribute('aria-expanded')).toBe('true');

      root().dispatchEvent(new FocusEvent('focusout', { bubbles: true, relatedTarget: null }));
      await settle();

      expect(trigger().getAttribute('aria-expanded')).toBe('false');
    });

    it('keeps a selection the current query filtered out', async () => {
      await open();
      listOptions()[0].click();
      await settle();
      expect(host.value()).toEqual([1]);

      trigger().dispatchEvent(new KeyboardEvent('keydown', { key: '2', bubbles: true }));
      await settle();
      listOptions()[0].click();
      await settle();

      expect(host.value()).toEqual([1, 2]);
      expect(chips()).toEqual(['Role 1', 'Role 2']);
    });
  });
});

describe('MultiSelect copy', () => {
  it('reads a key the consumer overrides in place of its own', async () => {
    TestBed.configureTestingModule({
      providers: [
        provideTransloco({
          config: { availableLangs: ['el', 'en'], defaultLang: 'en', fallbackLang: 'en' },
        }),
        provideUiCopy({ 'multiSelect.clear': 'customer.clear' }),
      ],
    });
    const fixture = TestBed.createComponent(MultiSelectHost);
    const transloco = TestBed.inject(TranslocoService);
    transloco.setTranslation({ customer: { clear: 'Clear your choices' } }, 'en', { merge: true });
    fixture.componentInstance.showClear.set(true);
    fixture.componentInstance.value.set(['fade']);
    fixture.detectChanges();
    await fixture.whenStable();
    await firstValueFrom(transloco.load('multiSelect/en'));
    fixture.detectChanges();

    const clear = (fixture.nativeElement as HTMLElement).querySelector('.select-clear');
    expect(tooltipOf(clear)).toBe('Clear your choices');
  });
});
