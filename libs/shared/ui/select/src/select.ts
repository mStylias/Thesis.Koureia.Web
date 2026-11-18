import {
  afterRenderEffect,
  booleanAttribute,
  Component,
  computed,
  contentChild,
  effect,
  ElementRef,
  input,
  linkedSignal,
  model,
  numberAttribute,
  output,
  signal,
  viewChild,
} from '@angular/core';
import { NgTemplateOutlet } from '@angular/common';
import { Combobox, ComboboxPopup, ComboboxWidget } from '@angular/aria/combobox';
import { Listbox, Option } from '@angular/aria/listbox';
import { FormValueControl } from '@angular/forms/signals';
import { provideTranslocoScope, TranslocoPipe } from '@jsverse/transloco';
import { injectFieldLabelId } from '@util/forms';
import { UiCopyPipe } from '@util/ui-copy';
import { LucideChevronDown, LucideLoaderCircle, LucideSearch, LucideX } from '@lucide/angular';
import type { DataKey, DataSource, KeySpec } from '@ui/data-source';
import { Tooltip } from '@ui/tooltip';
import { SelectOptionSource, type SelectResolutionFailure } from './select-option-source';
import { SelectedItemTemplate, SelectOptionTemplate } from './select-templates';
import { SelectOption, SelectSize } from './select.types';

/** What the panel is showing, so the body and the live region agree. */
type SelectPanelState = 'loading' | 'error' | 'empty' | 'ready';

let nextUniqueId = 0;

/** Keys the panel's search field hands to the listbox instead of the caret. */
/** Keys that move the active option. A typed character moves it too, by typeahead. */
const NAVIGATION_KEYS = new Set(['ArrowUp', 'Home', 'End', 'PageUp', 'PageDown']);

const LISTBOX_KEYS = new Set(['ArrowUp', 'ArrowDown', 'PageUp', 'PageDown', 'Enter']);

/**
 * Room the panel keeps between itself and the edge of the viewport, in CSS
 * pixels. A list flush against the edge reads as a list that continues past
 * it.
 */
const PANEL_MARGIN = 8;

/**
 * Design-system select on the headless `@angular/aria` combobox + listbox pattern, which
 * supplies keyboard navigation, typeahead and the ARIA contract.
 *
 * ```ts
 * import { Select } from '@ui/select';
 * ```
 *
 * ```html
 * <lib-select
 *   [options]="cities"
 *   [(value)]="selectedCity"
 *   placeholder="Select a city" />
 * ```
 *
 * Bind `source` instead of `options` to read from a `DataSource` — OData or any
 * other transport. The value is then the item's declared `key`, the panel pages
 * as it scrolls, and typing queries the server:
 *
 * ```html
 * <lib-select [source]="roles" key="id" [displayWith]="roleName" [(value)]="roleId" />
 * ```
 *
 * Implements `FormValueControl`, so it binds straight to a field:
 *
 * ```html
 * <lib-select [formField]="form.city" [options]="cities" />
 * ```
 *
 * Custom rendering via `libSelectOption` (dropdown rows) and
 * `libSelectedItem` (closed trigger) templates.
 */
@Component({
  selector: 'lib-select',
  templateUrl: './select.html',
  styleUrl: './select.scss',
  imports: [
    Combobox,
    ComboboxPopup,
    ComboboxWidget,
    Listbox,
    Option,
    NgTemplateOutlet,
    LucideChevronDown,
    LucideLoaderCircle,
    LucideSearch,
    LucideX,
    Tooltip,
    TranslocoPipe,
    UiCopyPipe,
  ],
  providers: [
    provideTranslocoScope({
      scope: 'select',
      loader: {
        el: () => import('./i18n/el'),
        en: () => import('./i18n/en'),
      },
    }),
  ],
  host: {
    '[attr.data-size]': 'size()',
    '[attr.data-disabled]': 'disabled() ? "" : null',
    '[attr.data-invalid]': 'invalid() ? "" : null',
    '[attr.data-frameless]': 'frameless() ? "" : null',
    // Filled contract consumed by the float/IFTA label wrappers.
    '[attr.data-filled]': 'hasValue() ? "" : null',
    '[attr.data-loading]': 'busy() ? "" : null',
    '[attr.data-unresolved]': 'unresolved() ? "" : null',
    // Mirrors :focus-visible for the aria-activedescendant ring, so the active-option
    // outline shows only for the keyboard. The keyboard half is in `onTriggerKeydown`.
    '[attr.data-modality]': 'modality()',
    '[attr.data-navigated]': 'navigated() ? "" : null',
    '(pointerdown)': 'modality.set("pointer")',
    '(focusout)': 'onFocusout($event)',
  },
})
export class Select<T, TItem = unknown> implements FormValueControl<T | undefined> {
  /** Entries shown in the dropdown. Wins over `source` when both are bound. */
  readonly options = input<readonly SelectOption<T, TItem>[]>([]);

  /**
   * Transport-neutral source of the options. While it is bound and `options` is
   * empty, `value` holds the item's declared key rather than the item.
   */
  readonly source = input<DataSource<TItem> | undefined>(undefined);

  /** Item identity. Required as soon as `source` is bound. */
  readonly key = input<KeySpec<TItem> | undefined>(undefined);

  /** Option text for a source item. */
  readonly displayWith = input<((item: TItem) => string) | undefined>(undefined);

  /** Per-item disabled rule for a source item. */
  readonly optionDisabled = input<((item: TItem) => boolean) | undefined>(undefined);

  /** Rows fetched per page while `source` is bound. Defaults to 20. */
  readonly pageSize = input(20, { transform: numberAttribute });

  /** Delay before typed text queries the source. Defaults to 250 ms. */
  readonly debounceMs = input(250, { transform: numberAttribute });

  /** Selected value; `undefined` while nothing is selected. */
  readonly value = model<T | undefined>(undefined);

  /** Text shown in the trigger while nothing is selected. */
  readonly placeholder = input('');

  /** Control size. Defaults to `md`. */
  readonly size = input<SelectSize>('md');

  /** Disables interaction. Bound automatically by `[formField]`. */
  readonly disabled = input(false, { transform: booleanAttribute });

  /** Invalid styling. Bound automatically by `[formField]`. */
  readonly invalid = input(false, { transform: booleanAttribute });

  /**
   * Hides the trigger's border, background and focus ring, for a select
   * composed into a frame its parent draws — a scope chooser beside a search
   * box, a boolean editor beside an operation chooser. The parent then owns
   * the resting border, the `:focus-within` ring and the invalid border for
   * the whole group.
   *
   * The frame must carry the invalid state, so the user still sees it.
   */
  readonly frameless = input(false, { transform: booleanAttribute });

  /**
   * Marks a selection mandatory. Exposed as `aria-required`, never the native attribute,
   * which would hand validation to the browser and block the submit event.
   */
  readonly required = input(false, { transform: booleanAttribute });

  /** Shows a spinner in place of the dropdown chevron. A source drives it on its own. */
  readonly loading = input(false, { transform: booleanAttribute });

  /** Shows a × that resets the value; Delete/Backspace does it from the keyboard. */
  readonly showClear = input(false, { transform: booleanAttribute });

  /** `id` for the trigger, so an external `<label for>` can reference it. */
  readonly inputId = input('');

  /** Accessible name of the trigger. */
  readonly ariaLabel = input('');

  /** `id` of the element that labels the trigger (e.g. a float label). */
  readonly ariaLabelledby = input('');

  /** The label of the `lib-field` around the control, which `<label for>` cannot reach. */
  private readonly fieldLabelId = injectFieldLabelId();

  /** The consumer's name wins. Under a field without one, the field's label names the control. */
  protected readonly labelledBy = computed(
    () => this.ariaLabelledby() || (this.ariaLabel() ? '' : this.fieldLabelId()),
  );

  /** `id`(s) of elements describing the control, e.g. a hint or error. */
  readonly ariaDescribedby = input('');

  /** Empty-dropdown message. Falls back to the translation. */
  readonly emptyMessage = input('');

  /** Source-load error message. Falls back to the translation. */
  readonly loadErrorMessage = input('');

  /** Text shown for a value the source cannot display. Falls back to the translation. */
  readonly unavailableMessage = input('');

  /** Placeholder of the panel's search field. Falls back to the translation. */
  readonly searchHint = input('');

  /** Accessible name of the panel's search field. Falls back to the translation. */
  readonly searchAriaLabel = input('');

  /** Tooltip on the clear affordance. Falls back to the translation. */
  readonly clearAriaLabel = input('');

  /** Marks the field as touched for Signal Forms once focus leaves. */
  readonly touch = output();

  /** A bound value was kept but could not be resolved to an item for display. */
  readonly resolutionFailed = output<SelectResolutionFailure>();

  protected readonly optionTemplate = contentChild(SelectOptionTemplate);
  protected readonly selectedItemTemplate = contentChild(SelectedItemTemplate);

  protected readonly expanded = signal(false);

  /**
   * The panel carries the widget role, and `ngComboboxWidget` reports the id it
   * finds rather than generating one — without this the trigger's
   * `aria-controls` is empty.
   */
  protected readonly panelId = `lib-select-panel-${nextUniqueId++}`;

  /** Last input modality; drives the active-option outline visibility. */
  protected readonly modality = signal<'keyboard' | 'pointer'>('keyboard');

  /**
   * Hides the active option until the keyboard enters the list. `ngListbox` always makes one
   * option active, and a ring on it reads as a choice the user did not make.
   */
  protected readonly navigated = linkedSignal({ source: this.expanded, computation: () => false });

  protected readonly hasValue = computed(() => this.value() !== undefined);

  /**
   * The source, once it is the one in charge. `options` wins when both are
   * bound, so adding a source can never make an already-populated select fetch.
   */
  protected readonly dataSource = computed(() =>
    this.options().length ? undefined : this.source(),
  );

  private readonly loader = new SelectOptionSource<TItem>({
    source: () => this.dataSource(),
    key: () => this.key(),
    displayWith: () => this.displayWith(),
    optionDisabled: () => this.optionDisabled(),
    keys: () => this.selectedKeys(),
    pageSize: () => this.pageSize(),
    debounceMs: () => this.debounceMs(),
    onFailure: (failure) => {
      this.resolutionFailed.emit(failure);
    },
  });

  // A source's option value is the item's declared key, which is what `T` stands
  // for while a source is bound. Nothing else in the control needs to know.
  protected readonly listOptions = computed<readonly SelectOption<T, TItem>[]>(() =>
    this.dataSource()
      ? (this.loader.options() as readonly SelectOption<T, TItem>[])
      : this.options(),
  );

  /** The option matching the current value (reference equality). */
  protected readonly selectedOption = computed(() => {
    const value = this.value();
    if (value === undefined) {
      return undefined;
    }
    const listed = this.listOptions().find((option) => option.value === value);
    if (listed || !this.dataSource()) {
      return listed;
    }
    // Out of the loaded page: `byKeys` is what keeps a persisted id readable.
    return this.loader.optionFor(value as DataKey) as SelectOption<T, TItem> | undefined;
  });

  /**
   * The aria listbox always models selection as an array, and it prunes any
   * value it has no option for. Withholding a value it cannot see keeps it from
   * writing that pruning back.
   */
  protected readonly listboxValue = computed<T[]>(() => {
    const value = this.value();
    if (value === undefined) {
      return [];
    }
    return this.listOptions().some((option) => option.value === value) ? [value] : [];
  });

  protected readonly searchText = computed(() => this.loader.search());

  protected readonly busy = computed(
    () =>
      this.loading() ||
      (this.dataSource() !== undefined && (this.loader.loading() || this.loader.resolving())),
  );

  /**
   * A value the source kept but could not display. Keyed off the reported
   * failure, not off the missing option, so a lookup still in flight does not
   * flash the unavailable text.
   */
  protected readonly unresolved = computed(
    () =>
      this.hasValue() &&
      this.selectedOption() === undefined &&
      this.dataSource() !== undefined &&
      this.loader.failure() !== null,
  );

  protected readonly panelState = computed<SelectPanelState>(() => {
    if (!this.dataSource()) {
      return this.options().length ? 'ready' : 'empty';
    }
    if (this.loader.rows().length) {
      return 'ready';
    }
    if (this.loader.loading()) {
      return 'loading';
    }
    return this.loader.error() === null ? 'empty' : 'error';
  });

  protected readonly resultCount = computed(() => this.listOptions().length);

  private readonly combobox = viewChild.required<Combobox, ElementRef<HTMLElement>>(Combobox, {
    read: ElementRef,
  });

  private readonly panelElement = viewChild<ElementRef<HTMLElement>>('panelEl');
  private readonly listboxElement = viewChild<ElementRef<HTMLElement>>('listboxEl');
  private readonly searchInput = viewChild<ElementRef<HTMLInputElement>>('searchInput');
  private searchFocused = false;

  /** Signal Forms focuses the control through this on submit errors. */
  focus(options?: FocusOptions): void {
    this.combobox().nativeElement.focus(options);
  }

  /** Re-runs the active source query. No-op on the `options` path. */
  reload(): void {
    this.loader.reload();
  }

  private selectedKeys(): readonly DataKey[] {
    const value = this.value();
    // In source mode the value is the item's declared key.
    return value === undefined ? [] : [value as DataKey];
  }

  protected onListboxValueChange(values: readonly T[]): void {
    // Explicit selection can toggle an option off, but a single select keeps its value
    // until another is chosen — the × is how you empty it.
    if (values.length) {
      this.value.set(values[0]);
    }
  }

  /** A click on an enabled option commits the selection. */
  protected onListClick(event: MouseEvent): void {
    const option = (event.target as HTMLElement).closest('[role="option"]');
    if (option && option.getAttribute('aria-disabled') !== 'true') {
      this.close();
    }
  }

  /** Enter commits the active option (the pattern already selected it). */
  protected onEnter(): void {
    this.close();
  }

  protected onExpandedChange(expanded: boolean): void {
    this.expanded.set(expanded);
    if (!expanded) {
      this.loader.closed();
      return;
    }
    this.loader.open();
  }

  constructor() {
    // The panel relays every key to the list. Capture on the panel runs before the list's own
    // handler, which a template listener cannot.
    effect((onCleanup) => {
      const panel = this.panelElement()?.nativeElement;
      if (panel === undefined) {
        return;
      }
      const guard = (event: KeyboardEvent): void => {
        this.guardListKeydown(event);
      };
      panel.addEventListener('keydown', guard, { capture: true });
      onCleanup(() => {
        panel.removeEventListener('keydown', guard, { capture: true });
      });
    });

    // Which side of the trigger the panel opens on.
    //
    // Both phases run in the frame the panel mounts, before it is painted: the
    // read needs the panel's drawn height, and a side corrected one frame
    // later is a jump the user sees. The height read is `offsetHeight` and
    // not the content — the panel scrolls at its own maximum, and that
    // maximum is what has to fit.
    //
    // It re-runs while the panel is open, so a list narrowed by a search, or
    // a window that has since been resized, is placed again.
    afterRenderEffect({
      earlyRead: () => {
        const panel = this.panelElement()?.nativeElement;
        if (!this.expanded() || panel == null) {
          return false;
        }
        const trigger = this.combobox().nativeElement.getBoundingClientRect();
        const viewport = panel.ownerDocument.documentElement.clientHeight;
        const below = viewport - trigger.bottom - PANEL_MARGIN;
        const above = trigger.top - PANEL_MARGIN;
        return panel.offsetHeight > below && above > below;
      },
      write: (opensAbove) => {
        // Written to the element rather than bound: the value is read from the
        // same element in the phase before this one, and a binding would put
        // that read a whole change detection pass away from the write.
        this.panelElement()?.nativeElement.classList.toggle('select-panel-above', opensAbove());
      },
    });

    // The panel mounts a tick after `expanded` flips, so the caret cannot be moved
    // from the handler that opened it. The flag keeps a later render from pulling
    // focus back out of wherever the user has since put it.
    afterRenderEffect({
      write: () => {
        const field = this.searchInput()?.nativeElement;
        if (!this.expanded() || !field) {
          this.searchFocused = false;
          return;
        }
        if (this.searchFocused) {
          return;
        }
        this.searchFocused = true;
        field.focus();
        // A character typed on the closed trigger seeded the query; the caret
        // belongs after it, not before it.
        field.setSelectionRange(field.value.length, field.value.length);
      },
    });
  }

  protected onSearchInput(event: Event): void {
    this.loader.setSearch((event.target as HTMLInputElement).value);
  }

  /**
   * The search field owns the caret, so the listbox only sees the keys that are
   * not text editing. `Home`/`End` stay with the field.
   */
  protected onSearchFieldKeydown(event: KeyboardEvent): void {
    this.modality.set('keyboard');
    if (event.key === 'Escape') {
      event.preventDefault();
      this.close();
      return;
    }
    if (LISTBOX_KEYS.has(event.key)) {
      event.preventDefault();
      this.listboxElement()?.nativeElement.dispatchEvent(new KeyboardEvent(event.type, event));
    }
  }

  /** Clicking anywhere in the search row lands the caret in its field. */
  protected onSearchRowPointerdown(event: Event): void {
    event.preventDefault();
    this.searchInput()?.nativeElement.focus();
  }

  /**
   * Bound on the trigger, not the host: `KeyboardEventManager` defaults to
   * `stopPropagation`, so keys it handles never reach an ancestor. A sibling listener on
   * the same element still runs, which keeps the modality flag honest.
   */
  protected onTriggerKeydown(event: KeyboardEvent): void {
    this.modality.set('keyboard');
    if (
      this.showClear() &&
      !this.expanded() &&
      (event.key === 'Delete' || event.key === 'Backspace')
    ) {
      event.preventDefault();
      this.clear();
      return;
    }
    this.onSearchKeydown(event);
  }

  /**
   * The select-only combobox pattern answers a typed character with a typeahead.
   * With a source bound, the same characters are the query instead: the loaded
   * page is one page of many, so jumping inside it would search the wrong set.
   */
  private onSearchKeydown(event: KeyboardEvent): void {
    if (!this.dataSource() || this.disabled() || event.ctrlKey || event.metaKey || event.altKey) {
      return;
    }
    if (event.key === 'Backspace') {
      if (!this.expanded()) {
        return;
      }
      event.preventDefault();
      this.loader.setSearch(this.loader.search().slice(0, -1));
      return;
    }
    if (event.key.length !== 1) {
      return;
    }
    this.expanded.set(true);
    this.loader.setSearch(this.loader.search() + event.key);
  }

  /**
   * The combobox relays the trigger's keys to the popup's widget element, which is
   * the panel rather than the list, so navigation hops down one level here. Routing
   * it by hand is what lets the query keep the characters the local typeahead would
   * otherwise consume.
   */
  protected onPanelKeydown(event: KeyboardEvent): void {
    // The hop re-enters this handler on the way back up.
    if (event.target !== event.currentTarget) {
      return;
    }
    const typed = event.key.length === 1 && !event.ctrlKey && !event.metaKey && !event.altKey;
    if (this.dataSource() && typed) {
      return;
    }
    this.listboxElement()?.nativeElement.dispatchEvent(new KeyboardEvent(event.type, event));
  }

  protected onPanelScroll(event: Event): void {
    const panel = event.currentTarget as HTMLElement;
    const remaining = panel.scrollHeight - panel.scrollTop - panel.clientHeight;
    if (remaining <= panel.clientHeight / 2) {
      this.loader.loadMore();
    }
  }

  protected clearSearch(event: Event): void {
    event.stopPropagation();
    if (this.disabled()) {
      return;
    }
    this.loader.clearSearch();
    this.searchInput()?.nativeElement.focus();
  }

  protected clear(event?: Event): void {
    // Keep the trigger from treating the × click as an open/close toggle.
    event?.stopPropagation();
    // A disabled combobox keeps DOM focus (the pattern uses `aria-disabled`), so it still
    // receives Delete/Backspace, and the × survives a moment past the state flipping.
    // Neither may edit a control the user cannot edit.
    if (this.disabled()) {
      return;
    }
    this.value.set(undefined);
  }

  protected onFocusout(event: FocusEvent): void {
    const target = event.relatedTarget as Node | null;
    const host = (event.currentTarget as HTMLElement | null) ?? undefined;
    if (host?.contains(target)) {
      return;
    }
    // The combobox only checks whether to collapse on the *trigger's* focusout,
    // and focus sits in the panel's search field while a source is bound. Without
    // this, clicking outside leaves the panel open.
    this.expanded.set(false);
    this.loader.closed();
    this.touch.emit();
  }

  private close(): void {
    this.onExpandedChange(false);
    // Collapsing destroys the panel; hand focus back to the trigger.
    this.combobox().nativeElement.focus();
  }

  private guardListKeydown(event: KeyboardEvent): void {
    // Only the last hop, into the list: the relay reaches the panel first.
    if (this.navigated() || event.target !== this.listboxElement()?.nativeElement) {
      return;
    }
    switch (event.key) {
      // The hidden active option is already the first one. Reveal it instead of moving past it.
      case 'ArrowDown':
        event.stopImmediatePropagation();
        this.navigated.set(true);
        break;
      // Nothing the user can see is active, so there is nothing to choose.
      case 'Enter':
      case ' ':
        event.stopImmediatePropagation();
        this.close();
        break;
      default:
        if (event.key.length === 1 || NAVIGATION_KEYS.has(event.key)) {
          this.navigated.set(true);
        }
    }
  }
}
