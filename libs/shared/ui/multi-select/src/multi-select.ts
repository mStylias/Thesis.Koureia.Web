import {
  afterNextRender,
  afterRenderEffect,
  AnimationCallbackEvent,
  booleanAttribute,
  Component,
  computed,
  contentChild,
  DestroyRef,
  effect,
  ElementRef,
  inject,
  Injector,
  input,
  linkedSignal,
  model,
  numberAttribute,
  output,
  signal,
  viewChild,
  viewChildren,
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
import {
  SelectOption,
  SelectOptionSource,
  SelectOptionTemplate,
  SelectSize,
  type SelectResolutionFailure,
} from '@ui/select';
import { MultiSelectDisplay } from './multi-select.types';

/** What the panel is showing, so the body and the live region agree. */
type MultiSelectPanelState = 'loading' | 'error' | 'empty' | 'ready';

let nextUniqueId = 0;

/** Chip rows the trigger shows. The chips past them fold into one "+N" chip. */
const CHIP_ROWS = 3;

/** Keys the panel's search field hands to the listbox instead of the caret. */
/** Keys that move the active option. A typed character moves it too, by typeahead. */
const NAVIGATION_KEYS = new Set(['ArrowUp', 'Home', 'End', 'PageUp', 'PageDown']);

const LISTBOX_KEYS = new Set(['ArrowUp', 'ArrowDown', 'PageUp', 'PageDown', 'Enter']);

/**
 * Design-system multi select on the headless `@angular/aria` combobox + listbox pattern.
 * Selection is explicit: click or Enter toggles, and the dropdown stays open until Escape,
 * Tab or an outside click.
 *
 * ```ts
 * import { MultiSelect } from '@ui/multi-select';
 * ```
 *
 * ```html
 * <lib-multi-select
 *   [options]="services"
 *   [(value)]="selectedServices"
 *   display="chip"
 *   placeholder="Select services" />
 * ```
 *
 * Implements `FormValueControl` for `T[]` fields, so `[formField]` binds directly. Custom
 * option rows use the same `libSelectOption` template directive as `lib-select`.
 */
@Component({
  selector: 'lib-multi-select',
  templateUrl: './multi-select.html',
  styleUrl: './multi-select.scss',
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
      scope: 'multiSelect',
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
    // Filled contract consumed by the float/IFTA label wrappers.
    '[attr.data-filled]': 'value().length ? "" : null',
    '[attr.data-loading]': 'busy() ? "" : null',
    '[attr.data-unresolved]': 'unresolvedCount() ? "" : null',
    // Mirrors :focus-visible for the aria-activedescendant ring, so the active-option
    // outline shows only for the keyboard. The keyboard half is in `onTriggerKeydown`.
    '[attr.data-modality]': 'modality()',
    '[attr.data-navigated]': 'navigated() ? "" : null',
    '(pointerdown)': 'modality.set("pointer")',
    '(focusout)': 'onFocusout($event)',
    '[style.max-width]': 'maxWidth() || null',
  },
})
export class MultiSelect<T, TItem = unknown> implements FormValueControl<T[]> {
  /** Entries shown in the dropdown. Wins over `source` when both are bound. */
  readonly options = input<readonly SelectOption<T, TItem>[]>([]);

  /**
   * Transport-neutral source of the options. While it is bound and `options` is
   * empty, `value` holds the items' declared keys rather than the items.
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

  /** Selected values; empty array while nothing is selected. */
  readonly value = model<T[]>([]);

  /** How selected options render in the trigger. Defaults to `comma`. */
  readonly display = input<MultiSelectDisplay>('comma');

  /** Text shown in the trigger while nothing is selected. */
  readonly placeholder = input('');

  /** Control size. Defaults to `md`. */
  readonly size = input<SelectSize>('md');

  /**
   * Max width (any CSS length). Chips wrap inside it, and past three rows the rest fold
   * into a "+N" chip. Unset by default, so the control grows with its content.
   */
  readonly maxWidth = input('');

  /** Disables interaction. Bound automatically by `[formField]`. */
  readonly disabled = input(false, { transform: booleanAttribute });

  /** Invalid styling. Bound automatically by `[formField]`. */
  readonly invalid = input(false, { transform: booleanAttribute });

  /**
   * Marks a selection mandatory. Exposed as `aria-required`, never the native attribute,
   * which would hand validation to the browser and block the submit event.
   */
  readonly required = input(false, { transform: booleanAttribute });

  /** Shows a spinner in place of the dropdown chevron. A source drives it on its own. */
  readonly loading = input(false, { transform: booleanAttribute });

  /** Shows a × that resets the selection; Delete/Backspace does it from the keyboard. */
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

  /** Message shown in the dropdown when there are no options. Falls back to the translation. */
  readonly emptyMessage = input('');

  /** Source-load error message. Falls back to the translation. */
  readonly loadErrorMessage = input('');

  /** Note shown for selected values the source cannot display. Falls back to the translation. */
  readonly unavailableMessage = input('');

  /** Placeholder of the panel's search field. Falls back to the translation. */
  readonly searchHint = input('');

  /** Accessible name of the panel's search field. Falls back to the translation. */
  readonly searchAriaLabel = input('');

  /** Tooltip on a chip's ×, prefixed to its label. Falls back to "Remove <label>". */
  readonly removeChipAriaLabel = input('');

  /** Tooltip on the clear affordance. Falls back to the translation. */
  readonly clearAriaLabel = input('');

  /** Marks the field as touched for Signal Forms once focus leaves. */
  readonly touch = output();

  /** Bound values were kept but could not be resolved to items for display. */
  readonly resolutionFailed = output<SelectResolutionFailure>();

  protected readonly optionTemplate = contentChild(SelectOptionTemplate);

  protected readonly expanded = signal(false);

  /**
   * The panel carries the widget role, and `ngComboboxWidget` reports the id it
   * finds rather than generating one — without this the trigger's
   * `aria-controls` is empty.
   */
  protected readonly panelId = `lib-multi-select-panel-${nextUniqueId++}`;

  /** Last input modality; drives the active-option outline visibility. */
  protected readonly modality = signal<'keyboard' | 'pointer'>('keyboard');

  /**
   * Hides the active option until the keyboard enters the list. `ngListbox` always makes one
   * option active, and a ring on it reads as a choice the user did not make.
   */
  protected readonly navigated = linkedSignal({ source: this.expanded, computation: () => false });

  /**
   * Chips currently fading out. Keeps the placeholder from flashing in beside the last
   * one, which would grow the trigger for the length of the fade.
   */
  protected readonly leavingChips = signal(0);

  /**
   * The source, once it is the one in charge. `options` wins when both are
   * bound, so adding a source can never make an already-populated control fetch.
   */
  protected readonly dataSource = computed(() =>
    this.options().length ? undefined : this.source(),
  );

  private readonly loader = new SelectOptionSource<TItem>({
    source: () => this.dataSource(),
    key: () => this.key(),
    displayWith: () => this.displayWith(),
    optionDisabled: () => this.optionDisabled(),
    // In source mode the values are the items' declared keys.
    keys: () => this.value() as readonly DataKey[],
    pageSize: () => this.pageSize(),
    debounceMs: () => this.debounceMs(),
    onFailure: (failure) => {
      this.resolutionFailed.emit(failure);
    },
  });

  protected readonly listOptions = computed<readonly SelectOption<T, TItem>[]>(() =>
    this.dataSource()
      ? (this.loader.options() as readonly SelectOption<T, TItem>[])
      : this.options(),
  );

  /** Selected options, in `options` order locally and in value order from a source. */
  protected readonly selectedOptions = computed<readonly SelectOption<T, TItem>[]>(() => {
    const values = this.value();
    if (!this.dataSource()) {
      return this.options().filter((option) => values.includes(option.value));
    }
    // A selection out of the loaded page has no list position to inherit.
    return values
      .map((value) => this.loader.optionFor(value as DataKey) as SelectOption<T, TItem> | undefined)
      .filter((option) => option !== undefined);
  });

  /**
   * Selected values the source could not turn into a chip. Keyed off the
   * reported failure, so a lookup still in flight does not flash the note.
   */
  protected readonly unresolvedCount = computed(() =>
    this.dataSource() && this.loader.failure()
      ? this.value().length - this.selectedOptions().length
      : 0,
  );

  /**
   * Only what the listbox can see. It prunes any value it has no option for and
   * writes the pruned array back, so feeding it a selection from another page
   * would empty that selection on the next render.
   */
  protected readonly listboxValue = computed<T[]>(() => {
    const visible = new Set(this.listOptions().map((option) => option.value));
    return this.value().filter((value) => visible.has(value));
  });

  protected readonly searchText = computed(() => this.loader.search());

  protected readonly busy = computed(
    () =>
      this.loading() ||
      (this.dataSource() !== undefined && (this.loader.loading() || this.loader.resolving())),
  );

  protected readonly panelState = computed<MultiSelectPanelState>(() => {
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

  protected readonly joinedLabels = computed(() =>
    this.selectedOptions()
      .map((option) => option.label)
      .join(', '),
  );

  private readonly combobox = viewChild.required<Combobox, ElementRef<HTMLElement>>(Combobox, {
    read: ElementRef,
  });

  private readonly chipEls = viewChildren<ElementRef<HTMLElement>>('chipEl');
  private readonly chipsElement = viewChild<ElementRef<HTMLElement>>('chipsEl');
  private readonly moreElement = viewChild<ElementRef<HTMLElement>>('moreEl');
  /** The labels folded into "+N". A signal is safe here: the tooltip text moves no chip. */
  protected readonly foldedLabels = signal('');

  private readonly panelElement = viewChild<ElementRef<HTMLElement>>('panelEl');
  private readonly listboxElement = viewChild<ElementRef<HTMLElement>>('listboxEl');
  private readonly searchInput = viewChild<ElementRef<HTMLInputElement>>('searchInput');
  private searchFocused = false;

  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);
  private readonly injector = inject(Injector);

  protected onListboxValueChange(values: readonly T[]): void {
    const next = this.reconcile(values);
    this.prepareFlip();
    this.countPendingLeaves(next);
    this.value.set(next);
  }

  /**
   * The listbox only ever answers about the options it rendered. With a source
   * that is one page of one query, so a selection outside it is carried across
   * here rather than read back from the list.
   */
  private reconcile(values: readonly T[]): T[] {
    if (!this.dataSource()) {
      return [...values];
    }
    const visible = new Set(this.listOptions().map((option) => option.value));
    const selected = new Set(values);
    const kept = this.value().filter((value) => !visible.has(value) || selected.has(value));
    return [...kept, ...values.filter((value) => !kept.includes(value))];
  }

  protected removeChip(option: SelectOption<T>, event: Event): void {
    // Keep the trigger from treating the chip × click as a toggle.
    event.stopPropagation();
    // The × is withheld while disabled, so this only guards a stale click.
    if (this.disabled()) {
      return;
    }
    const next = this.value().filter((value) => value !== option.value);
    this.countPendingLeaves(next);
    this.value.set(next);
  }

  /**
   * A leaving chip fades in place, then its slot collapses and the survivors slide in.
   * Driven in JS because the FLIP measurements must bracket the exact moment Angular
   * removes the element.
   */
  protected onChipLeave(event: AnimationCallbackEvent): void {
    const chip = event.target as HTMLElement;
    if (this.skipJsAnimations()) {
      event.animationComplete();
      return;
    }
    // Keeps mid-leave chips out of the FLIP measurements.
    chip.dataset['leaving'] = '';
    const { duration, easeOut } = this.motionTokens();
    const fade = chip.animate(
      [
        { opacity: 1, transform: 'scale(1)' },
        { opacity: 0, transform: 'scale(0.95)' },
      ],
      { duration, easing: easeOut },
    );
    void fade.finished
      .catch(() => undefined)
      .then(() => {
        const first = this.measureChips();
        const firstHeight = this.trigger().getBoundingClientRect().height;
        event.animationComplete();
        this.leavingChips.update((count) => Math.max(0, count - 1));
        // The element is unmounted by the next frame; then refold and slide.
        requestAnimationFrame(() => {
          this.fitChips();
          this.playFlip(first, firstHeight);
        });
      });
  }

  /**
   * Registers how many chips the next value fades out, so the template holds the
   * placeholder back. The guards mirror `onChipLeave`'s instant path, where no fade runs.
   */
  private countPendingLeaves(next: readonly T[]): void {
    if (this.display() !== 'chip' || this.skipJsAnimations()) {
      return;
    }
    const removed = this.selectedOptions().filter((option) => !next.includes(option.value)).length;
    if (removed) {
      this.leavingChips.update((count) => count + removed);
    }
  }

  /**
   * FLIP for selection changes that add chips: measure before the DOM updates, then
   * translate each survivor from its old spot to its new one and ease the trigger's
   * height. The entering chip is excluded — its CSS enter animation holds it invisible
   * for the slide beat, so it materializes last.
   */
  private prepareFlip(): void {
    if (this.display() !== 'chip' || this.skipJsAnimations()) {
      return;
    }
    const first = this.measureChips();
    const firstHeight = this.trigger().getBoundingClientRect().height;
    afterNextRender(
      {
        read: () => {
          this.playFlip(first, firstHeight);
        },
      },
      { injector: this.injector },
    );
  }

  private playFlip(first: Map<HTMLElement, DOMRect>, firstHeight: number): void {
    const { duration, easeStandard } = this.motionTokens();
    const slides: Animation[] = [];
    for (const [chip, after] of this.measureChips()) {
      const before = first.get(chip);
      if (!before) {
        continue; // entering chip — its CSS animation owns it
      }
      const dx = before.left - after.left;
      const dy = before.top - after.top;
      if (dx || dy) {
        slides.push(
          chip.animate([{ transform: `translate(${dx}px, ${dy}px)` }, { transform: 'none' }], {
            duration,
            easing: easeStandard,
          }),
        );
      }
    }
    const trigger = this.trigger();
    const lastHeight = trigger.getBoundingClientRect().height;
    if (Math.abs(lastHeight - firstHeight) > 0.5) {
      // Clip while the height eases so a grown row doesn't spill out.
      trigger.style.overflow = 'hidden';
      const resize = trigger.animate(
        [{ height: `${firstHeight}px` }, { height: `${lastHeight}px` }],
        { duration, easing: easeStandard },
      );
      void resize.finished
        .catch(() => undefined)
        .then(() => {
          trigger.style.removeProperty('overflow');
        });
    }
  }

  /**
   * Shows the chips of the first {@link CHIP_ROWS} rows and folds the rest into "+N". Written
   * straight to the DOM: a signal would re-render, and the next measurement would see its own
   * result. Rows come from `offsetTop`, which the wrapped siblings share per row.
   */
  private fitChips(): void {
    const more = this.moreElement()?.nativeElement;
    if (!more) {
      return;
    }
    const chips = this.chipEls()
      .map((ref) => ref.nativeElement)
      .filter((chip) => !('leaving' in chip.dataset));
    for (const chip of chips) {
      chip.hidden = false;
    }
    more.hidden = true;

    let row = 0;
    let rowTop = chips[0]?.offsetTop ?? 0;
    let lastRowTop = rowTop;
    let shown = chips.length;
    for (const [index, chip] of chips.entries()) {
      if (chip.offsetTop > rowTop) {
        row += 1;
        rowTop = chip.offsetTop;
      }
      if (row === CHIP_ROWS) {
        shown = index;
        break;
      }
      lastRowTop = rowTop;
    }
    if (shown === chips.length) {
      return;
    }

    const fold = (count: number): void => {
      for (const chip of chips.slice(count)) {
        chip.hidden = true;
      }
      more.dataset['count'] = String(chips.length - count);
    };
    more.hidden = false;
    fold(shown);
    // "+N" takes a slot too: give it the last row's chips until it fits there.
    while (shown > 0 && more.offsetTop > lastRowTop) {
      shown -= 1;
      fold(shown);
    }
    this.foldedLabels.set(
      chips
        .slice(shown)
        .map((chip) => chip.querySelector('.select-chip-label')?.textContent.trim() ?? '')
        .join(', '),
    );
  }

  private measureChips(): Map<HTMLElement, DOMRect> {
    const rects = new Map<HTMLElement, DOMRect>();
    for (const ref of this.chipEls()) {
      const chip = ref.nativeElement;
      if (!('leaving' in chip.dataset) && !chip.hidden) {
        rects.set(chip, chip.getBoundingClientRect());
      }
    }
    return rects;
  }

  private trigger(): HTMLElement {
    return this.combobox().nativeElement;
  }

  /**
   * JS animations must honor reduced motion themselves — the base layer only neutralizes
   * CSS — and bow out where the Web Animations API is absent (SSR, jsdom).
   */
  private skipJsAnimations(): boolean {
    return (
      typeof Element === 'undefined' ||
      typeof Element.prototype.animate !== 'function' ||
      (typeof window.matchMedia === 'function' &&
        window.matchMedia('(prefers-reduced-motion: reduce)').matches)
    );
  }

  /** Motion values come from the design-system tokens, never literals. */
  private motionTokens() {
    const styles = getComputedStyle(this.host.nativeElement);
    return {
      duration: parseFloat(styles.getPropertyValue('--dur-fast')) || 120,
      easeOut: styles.getPropertyValue('--ease-out').trim() || 'ease-out',
      easeStandard: styles.getPropertyValue('--ease-standard').trim() || 'ease-in-out',
    };
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
   * otherwise consume — Space included, which would otherwise toggle an option
   * mid-word.
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

    // Refolds after every render that can move a chip: a selection, a display switch.
    afterRenderEffect({
      mixedReadWrite: () => {
        this.selectedOptions();
        this.display();
        this.fitChips();
      },
    });

    // And when the width changes. Folding changes only the height, so it does not loop.
    let width = 0;
    const resize =
      typeof ResizeObserver === 'undefined'
        ? null
        : new ResizeObserver(([entry]) => {
            if (entry.contentRect.width === width) {
              return;
            }
            width = entry.contentRect.width;
            this.fitChips();
          });
    afterRenderEffect({
      read: () => {
        const chips = this.chipsElement()?.nativeElement;
        resize?.disconnect();
        if (chips) {
          resize?.observe(chips);
        }
      },
    });
    inject(DestroyRef).onDestroy(() => {
      resize?.disconnect();
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
      this.expanded.set(false);
      this.loader.closed();
      this.combobox().nativeElement.focus();
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

  /** Re-runs the active source query. No-op on the `options` path. */
  reload(): void {
    this.loader.reload();
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
    this.countPendingLeaves([]);
    this.value.set([]);
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

  /** Signal Forms focuses the control through this on submit errors. */
  focus(options?: FocusOptions): void {
    this.combobox().nativeElement.focus(options);
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
        break;
      default:
        if (event.key.length === 1 || NAVIGATION_KEYS.has(event.key)) {
          this.navigated.set(true);
        }
    }
  }
}
