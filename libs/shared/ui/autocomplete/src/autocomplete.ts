import { NgTemplateOutlet } from '@angular/common';
import {
  CdkConnectedOverlay,
  CdkOverlayOrigin,
  type ConnectedPosition,
} from '@angular/cdk/overlay';
import {
  booleanAttribute,
  Component,
  computed,
  contentChild,
  DestroyRef,
  effect,
  ElementRef,
  inject,
  input,
  linkedSignal,
  model,
  numberAttribute,
  OnChanges,
  output,
  PendingTasks,
  resource,
  signal,
  SimpleChanges,
  viewChild,
} from '@angular/core';
import { Combobox, ComboboxPopup, ComboboxWidget } from '@angular/aria/combobox';
import { Listbox, Option } from '@angular/aria/listbox';
import { FormValueControl, type ValidationError } from '@angular/forms/signals';
import { provideTranslocoScope, TranslocoPipe } from '@jsverse/transloco';
import { UiCopyPipe } from '@util/ui-copy';
import { claimFieldError } from '@util/forms';
import {
  LucideDynamicIcon,
  LucideLoaderCircle,
  LucideSearch,
  LucideX,
  type LucideIconInput,
} from '@lucide/angular';
import { Tooltip } from '@ui/tooltip';
import {
  createArraySource,
  createKeyGetter,
  isDataSource,
  throwIfAborted,
  withAbort,
  type DataInput,
  type DataKey,
  type DataSource,
  type KeySpec,
  type LoadResult,
} from '@ui/data-source';
import { AutocompleteFooterTemplate, AutocompleteOptionTemplate } from './autocomplete-templates';
import type {
  AutocompleteFooterContext,
  AutocompleteResolutionFailure,
  AutocompleteSelection,
  AutocompleteSize,
} from './autocomplete.types';

interface CachedSelection<T> {
  readonly source: DataSource<T>;
  readonly key: DataKey;
  readonly item: T;
}

interface ResolutionRequest<T> {
  readonly source: DataSource<T>;
  readonly key: DataKey;
  readonly cached?: T;
}

type ResolutionResult<T> =
  | { readonly kind: 'idle' }
  | { readonly kind: 'resolved'; readonly key: DataKey; readonly item: T }
  | {
      readonly kind: 'failed';
      readonly key: DataKey;
      readonly failure: AutocompleteResolutionFailure;
    };

interface Announcement {
  readonly kind: 'results' | 'noData' | 'loadError';
  readonly count?: number;
}

const EMPTY_RESOLUTION = { kind: 'idle' } as const;

let nextUniqueId = 0;

/**
 * Editable, selection-only combobox over a local collection or remote data source.
 * The Signal Forms value is a stable key; typed text remains draft state until an
 * option is explicitly committed.
 *
 * ```html
 * <lib-autocomplete
 *   [source]="rolesSource"
 *   key="id"
 *   [displayWith]="roleLabel"
 *   [formField]="form.roleId" />
 * ```
 *
 * `leadingIcon` replaces the search glyph, and `actionIcon` adds one button inside the field —
 * for a field that can also be filled another way, such as from the device location.
 *
 * ```html
 * <lib-autocomplete
 *   [source]="placesSource"
 *   key="id"
 *   [displayWith]="placeLabel"
 *   [leadingIcon]="mapPinIcon"
 *   [actionIcon]="crosshairIcon"
 *   [actionAriaLabel]="'Use my location'"
 *   [actionPending]="locating()"
 *   (action)="locate()" />
 * ```
 */
@Component({
  selector: 'lib-autocomplete',
  templateUrl: './autocomplete.html',
  styleUrl: './autocomplete.scss',
  imports: [
    CdkConnectedOverlay,
    CdkOverlayOrigin,
    Combobox,
    ComboboxPopup,
    ComboboxWidget,
    Listbox,
    Option,
    NgTemplateOutlet,
    LucideDynamicIcon,
    LucideLoaderCircle,
    LucideX,
    Tooltip,
    TranslocoPipe,
    UiCopyPipe,
  ],
  providers: [
    provideTranslocoScope({
      scope: 'autocomplete',
      loader: {
        el: () => import('./i18n/el'),
        en: () => import('./i18n/en'),
      },
    }),
  ],
  host: {
    '[attr.data-size]': 'size()',
    '[attr.data-disabled]': 'disabled() ? "" : null',
    '[attr.data-readonly]': 'readonly() ? "" : null',
    '[attr.data-invalid]': 'invalid() ? "" : null',
    '[attr.data-frameless]': 'frameless() ? "" : null',
    '[attr.data-filled]': 'value() !== "" ? "" : null',
    '[attr.data-loading]': 'isLoading() ? "" : null',
    '[attr.data-unresolved]': 'resolutionFailureState() ? "" : null',
    '[attr.data-modality]': 'modality()',
    '[attr.data-navigated]': 'navigated() ? "" : null',
    '(pointerdown)': 'modality.set("pointer")',
    '(focusout)': 'onFocusout($event)',
  },
})
export class Autocomplete<T> implements FormValueControl<DataKey>, OnChanges {
  /** Local items or a remote transport-neutral source. */
  readonly source = input.required<DataInput<T>>();
  /** Stable identity used for values, tracking, paging, and restoration. */
  readonly key = input.required<KeySpec<T>>();
  /** Converts an item to the plain text shown in the input and exposed to assistive technology. */
  readonly displayWith = input.required<(item: T) => string>();
  /** Optional local-search text. Defaults to `displayWith(item)`. */
  readonly searchWith = input<((item: T) => string) | undefined>(undefined);
  /** Optional per-item disabled rule. */
  readonly optionDisabled = input<(item: T) => boolean>(() => false);

  /** Selected stable key. The empty string means no selection. */
  readonly value = model<DataKey>('');
  /** Field density. */
  readonly size = input<AutocompleteSize>('md');
  /** Placeholder shown while there is no committed value or draft query. */
  readonly placeholder = input('');
  /** Number of suggestions displayed per page. Defaults to 20. */
  readonly pageSize = input(20, { transform: numberAttribute });
  /** Delay before a typed query loads. The first interaction loads immediately. */
  readonly debounceMs = input(250, { transform: numberAttribute });
  /** Shows the clear button while a value or draft query exists. */
  readonly showClear = input(false, { transform: booleanAttribute });
  /** Removes the component frame so a parent can draw one shared field frame. */
  readonly frameless = input(false, { transform: booleanAttribute });
  /** Prevents every edit path. Bound automatically by Signal Forms. */
  readonly disabled = input(false, { transform: booleanAttribute });
  /** Keeps the value readable while withholding every edit affordance. */
  readonly readonly = input(false, { transform: booleanAttribute });
  /** Invalid state supplied by Signal Forms or the host. */
  readonly invalid = input(false, { transform: booleanAttribute });
  /** Touched state supplied by Signal Forms. */
  readonly touched = input(false, { transform: booleanAttribute });
  /** Required state exposed as `aria-required`, never native validation. */
  readonly required = input(false, { transform: booleanAttribute });
  /** Validation errors supplied by Signal Forms. */
  readonly errors = input<readonly ValidationError.WithOptionalFieldTree[]>([]);

  /** Id of the native text input. */
  readonly inputId = input('');
  /** Name forwarded to the native text input. */
  readonly name = input('');
  /** Native browser autocomplete hint. Defaults to `off`. */
  readonly autocomplete = input('off');
  /** Accessible name of the input. */
  readonly ariaLabel = input('');
  /** Id of the element that labels the input. */
  readonly ariaLabelledby = input('');
  /** Consumer description ids. The control appends its visible state message. */
  readonly ariaDescribedby = input('');

  /** No-results copy. Falls back to the component translation. */
  readonly noDataMessage = input('');
  /** Suggestion-load error copy. Falls back to the component translation. */
  readonly loadErrorMessage = input('');
  /** Missing selected-value copy. Falls back to the component translation. */
  readonly unavailableMessage = input('');
  /** Selected-value load error copy. Falls back to the component translation. */
  readonly resolutionErrorMessage = input('');
  /** Clear-button accessible name. Falls back to the component translation. */
  readonly clearAriaLabel = input('');

  /** Icon drawn at the start of the field, in place of the default search glyph. */
  readonly leadingIcon = input<LucideIconInput | null>(null);
  /** Icon of an optional action button in the field. The button exists only while this is set. */
  readonly actionIcon = input<LucideIconInput | null>(null);
  /** Accessible name of the action button. An unnamed button is not rendered. */
  readonly actionAriaLabel = input('');
  /** Draws a spinner in the action button and blocks it while the action runs. */
  readonly actionPending = input(false, { transform: booleanAttribute });
  /** Blocks the action button while the action cannot be taken. */
  readonly actionDisabled = input(false, { transform: booleanAttribute });
  /** Action tooltip. Defaults to `actionAriaLabel`, which an icon-only button always needs. */
  readonly actionTooltip = input('');

  /** Draft search text after a user edit. It is not the Signal Forms value. */
  readonly queryChange = output<string>();
  /** User-committed item and key. Clear emits `undefined`. */
  readonly selectionChange = output<AutocompleteSelection<T> | undefined>();
  /** A persisted key was retained but could not be resolved for display. */
  readonly resolutionFailed = output<AutocompleteResolutionFailure>();
  /** The action button was pressed. The panel collapses first — see the button's JSDoc. */
  readonly action = output();
  /** Marks the Signal Forms field touched after focus leaves the whole control. */
  readonly touch = output();

  protected readonly optionTemplate = contentChild<AutocompleteOptionTemplate<T>>(
    AutocompleteOptionTemplate,
  );
  protected readonly footerTemplate = contentChild(AutocompleteFooterTemplate);

  protected readonly expanded = signal(false);
  protected readonly rows = signal<readonly T[]>([]);
  protected readonly searchLoading = signal(false);
  protected readonly loadError = signal<unknown>(null);
  protected readonly hasMore = signal(false);
  protected readonly modality = signal<'keyboard' | 'pointer'>('keyboard');
  protected readonly blurred = signal(false);
  protected readonly announcement = signal<Announcement | null>(null);
  protected readonly editing = signal(false);
  /**
   * Whether the user has moved through the open list with the keyboard.
   *
   * The listbox always makes an option active, so until then the control hides it: no ring,
   * no `aria-activedescendant`, and Enter commits nothing the user cannot see.
   */
  protected readonly navigated = linkedSignal({ source: this.expanded, computation: () => false });

  /** The default leading glyph. A value, not a directive, so `leadingIcon` can replace it. */
  protected readonly searchIcon = LucideSearch;

  /**
   * Whether the field draws its action button.
   *
   * An action with no accessible name is withheld rather than rendered nameless, and the
   * button goes with every other edit affordance while the control is locked.
   */
  protected readonly showAction = computed(
    () =>
      this.actionIcon() !== null &&
      this.actionAriaLabel() !== '' &&
      !this.disabled() &&
      !this.readonly(),
  );

  protected readonly fieldId = `lib-autocomplete-field-${nextUniqueId}`;
  protected readonly errorId = `lib-autocomplete-error-${nextUniqueId}`;
  protected readonly resolutionId = `lib-autocomplete-resolution-${nextUniqueId++}`;

  protected readonly dropdownPositions: ConnectedPosition[] = [
    { originX: 'start', originY: 'bottom', overlayX: 'start', overlayY: 'top', offsetY: 4 },
    { originX: 'start', originY: 'top', overlayX: 'start', overlayY: 'bottom', offsetY: -4 },
  ];

  private readonly destroyRef = inject(DestroyRef);
  private readonly pendingTasks = inject(PendingTasks);
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);
  private readonly inputElement = viewChild.required<ElementRef<HTMLInputElement>>('inputElement');
  private readonly panelElement = viewChild<ElementRef<HTMLElement>>('panelElement');
  private readonly keyOf = computed(() => createKeyGetter(this.key()));
  private readonly dataSource = computed<DataSource<T>>(() => {
    const source = this.source();
    if (isDataSource(source)) {
      return source;
    }
    const searchText = this.searchWith() ?? this.displayWith();
    return createArraySource(source, { key: this.key(), searchText });
  });
  private readonly cachedSelection = signal<CachedSelection<T> | null>(null);
  private readonly safePageSize = computed(() => {
    const value = this.pageSize();
    return Number.isFinite(value) && value > 0 ? Math.max(1, Math.floor(value)) : 20;
  });
  private readonly safeDebounce = computed(() => {
    const value = this.debounceMs();
    return Number.isFinite(value) && value > 0 ? value : 0;
  });

  /**
   * Set while the control takes focus back after a commit.
   *
   * A pointer press on an option blurs the input, so the focus the commit restores arrives as a
   * fresh focus event — which would open the panel again on the very interaction that chose an
   * option. Only a real browser does that blur, so no synthetic click reproduces it.
   */
  private refocusing = false;

  private searchController: AbortController | null = null;
  private searchTimer: ReturnType<typeof setTimeout> | null = null;
  private searchGeneration = 0;
  private activeSearch = '';
  private interacted = false;
  private composing = false;
  private pendingKey: DataKey | undefined;

  private readonly resolutionResource = resource<
    ResolutionResult<T>,
    ResolutionRequest<T> | undefined
  >({
    params: () => {
      const key = this.value();
      if (key === '') {
        return undefined;
      }
      const source = this.dataSource();
      const cached = this.cachedSelection();
      return {
        source,
        key,
        ...(cached?.source === source && cached.key === key ? { cached: cached.item } : {}),
      };
    },
    defaultValue: EMPTY_RESOLUTION,
    loader: async ({ params, abortSignal }) => {
      if (params.cached !== undefined) {
        return { kind: 'resolved', key: params.key, item: params.cached };
      }
      if (params.source.byKeys === undefined) {
        return this.failedResolution(params.key, 'unsupported');
      }
      try {
        const items = await withAbort(params.source.byKeys([params.key], abortSignal), abortSignal);
        throwIfAborted(abortSignal);
        const item = items.find((candidate) => this.keyOf()(candidate) === params.key);
        return item === undefined
          ? this.failedResolution(params.key, 'notFound')
          : { kind: 'resolved', key: params.key, item };
      } catch (cause) {
        if (abortSignal.aborted) {
          throw cause;
        }
        return this.failedResolution(params.key, 'loadFailed', cause);
      }
    },
  });

  protected readonly selectedItem = computed(() => {
    const key = this.value();
    if (key === '') {
      return undefined;
    }
    const source = this.dataSource();
    const cached = this.cachedSelection();
    if (cached?.source === source && cached.key === key) {
      return cached.item;
    }
    const resolution = this.resolutionResource.value();
    return resolution.kind === 'resolved' && resolution.key === key ? resolution.item : undefined;
  });
  protected readonly displayValue = computed(() => {
    const item = this.selectedItem();
    return item === undefined ? '' : this.displayWith()(item);
  });
  protected readonly query = linkedSignal<
    { key: DataKey; display: string; editing: boolean },
    string
  >({
    source: () => ({
      key: this.value(),
      display: this.displayValue(),
      editing: this.editing(),
    }),
    computation: (source, previous) =>
      source.editing && previous?.source.key === source.key ? previous.value : source.display,
  });
  // `ngListbox` takes a mutable array, so this cannot be `readonly`. Each call builds a new one.
  protected readonly listboxValue = computed<DataKey[]>(() => {
    const value = this.value();
    return value === '' ? [] : [value];
  });
  protected readonly resolutionFailureState = computed(() => {
    const key = this.value();
    const result = this.resolutionResource.value();
    return key !== '' && result.kind === 'failed' && result.key === key
      ? result.failure
      : undefined;
  });
  protected readonly resolutionLoading = computed(
    () => this.value() !== '' && this.resolutionResource.isLoading(),
  );
  protected readonly isLoading = computed(() => this.searchLoading() || this.resolutionLoading());
  protected readonly initialized = computed(
    () => this.value() === '' || !this.resolutionResource.isLoading(),
  );
  protected readonly firstError = computed(() => this.errors().at(0));
  protected readonly showError = computed(
    () =>
      this.initialized() &&
      this.invalid() &&
      (this.touched() || this.blurred()) &&
      this.firstError() !== undefined,
  );
  protected readonly describedBy = computed(() =>
    [
      this.ariaDescribedby(),
      this.showError() ? this.errorId : '',
      this.resolutionFailureState() ? this.resolutionId : '',
    ]
      .filter(Boolean)
      .join(' '),
  );
  protected readonly footerContext = computed<AutocompleteFooterContext>(() => ({
    query: this.activeSearch,
    loading: this.searchLoading(),
    hasMore: this.hasMore(),
  }));

  constructor() {
    claimFieldError();
    this.destroyRef.onDestroy(() => {
      this.cancelSearch();
    });
    // The combobox relays input keys to the listbox as synthetic events. Capture on the panel
    // is the only place that runs before the listbox handler, so a template listener cannot do it.
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
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (
      'source' in changes ||
      'key' in changes ||
      'displayWith' in changes ||
      'searchWith' in changes
    ) {
      this.cancelSearch();
      this.rows.set([]);
      this.hasMore.set(false);
      this.loadError.set(null);
      this.cachedSelection.set(null);
      this.interacted = false;
    }
  }

  /** Focuses the native editable input. */
  focus(options?: FocusOptions): void {
    this.inputElement().nativeElement.focus(options);
  }

  /** Re-runs the current suggestion query. */
  reload(): void {
    if (this.disabled() || this.readonly()) {
      return;
    }
    this.interacted = true;
    this.startSearch(this.editing() ? this.query() : '', false, 0);
  }

  /** Clears the committed value and current query. */
  clear(event?: Event): void {
    event?.preventDefault();
    event?.stopPropagation();
    if (this.disabled() || this.readonly()) {
      return;
    }
    this.cachedSelection.set(null);
    this.value.set('');
    this.editing.set(false);
    this.query.set('');
    this.expanded.set(false);
    this.queryChange.emit('');
    this.selectionChange.emit(undefined);
  }

  /**
   * Runs the field action.
   *
   * The panel collapses first. An action in the field takes over from the suggestion list, so
   * leaving the list open would hang stale suggestions over whatever the action produced.
   */
  protected onAction(event: Event): void {
    event.preventDefault();
    event.stopPropagation();
    // The button is withheld while the control is locked, so this only guards a stale click.
    if (!this.showAction() || this.actionDisabled() || this.actionPending()) {
      return;
    }
    this.expanded.set(false);
    this.action.emit();
  }

  protected itemKey(item: T): DataKey {
    return this.keyOf()(item);
  }

  protected itemLabel(item: T): string {
    return this.displayWith()(item);
  }

  protected isOptionDisabled(item: T): boolean {
    return this.optionDisabled()(item);
  }

  protected onInputFocus(): void {
    this.blurred.set(false);
    if (this.refocusing) {
      this.refocusing = false;
      return;
    }
    this.ensureSuggestions();
  }

  protected onInputClick(): void {
    this.ensureSuggestions();
  }

  protected onExpandedChange(expanded: boolean): void {
    if (expanded && (this.disabled() || this.readonly())) {
      this.expanded.set(false);
      return;
    }
    this.expanded.set(expanded);
    if (expanded) {
      this.ensureSuggestions();
    }
  }

  protected onQueryChange(value: string): void {
    this.query.set(value);
    this.editing.set(true);
    this.queryChange.emit(value);
    if (this.composing || this.disabled() || this.readonly()) {
      return;
    }
    this.expanded.set(true);
    this.interacted = true;
    this.startSearch(value, false, this.safeDebounce());
  }

  protected onCompositionStart(): void {
    this.composing = true;
  }

  protected onCompositionEnd(): void {
    this.composing = false;
    if (!this.disabled() && !this.readonly()) {
      this.expanded.set(true);
      this.interacted = true;
      this.startSearch(this.query(), false, this.safeDebounce());
    }
  }

  protected onInputKeydown(event: KeyboardEvent): void {
    this.modality.set('keyboard');
    if (event.key === 'Escape') {
      this.restoreCommittedDisplay();
      return;
    }
    if (event.key === 'ArrowDown' && !this.expanded()) {
      this.ensureSuggestions();
    }
  }

  protected onListboxValueChange(values: readonly DataKey[]): void {
    this.pendingKey = values.at(0);
  }

  protected onListClick(event: MouseEvent): void {
    const option = (event.target as HTMLElement).closest('[role="option"]');
    if (option && option.getAttribute('aria-disabled') !== 'true') {
      this.commitPendingSelection();
    }
  }

  protected onEnter(): void {
    this.commitPendingSelection();
  }

  protected onOutsideClick(event: MouseEvent): void {
    if (this.host.nativeElement.contains(event.target as Node)) {
      return;
    }
    this.expanded.set(false);
  }

  protected onPanelScroll(event: Event): void {
    const panel = event.currentTarget as HTMLElement;
    const remaining = panel.scrollHeight - panel.scrollTop - panel.clientHeight;
    if (remaining <= panel.clientHeight / 2) {
      this.loadMore();
    }
  }

  protected onFocusout(event: FocusEvent): void {
    const related = event.relatedTarget as Node | null;
    if (this.host.nativeElement.contains(related)) {
      return;
    }
    this.blurred.set(true);
    this.expanded.set(false);
    this.restoreCommittedDisplay();
    this.touch.emit();
  }

  private guardListKeydown(event: KeyboardEvent): void {
    if (this.navigated()) {
      return;
    }
    switch (event.key) {
      // The hidden active option is already the first one. Reveal it instead of moving past it.
      case 'ArrowDown':
        event.stopImmediatePropagation();
        this.navigated.set(true);
        break;
      case 'Enter':
        event.stopImmediatePropagation();
        break;
      case 'ArrowUp':
      case 'Home':
      case 'End':
      case 'PageUp':
      case 'PageDown':
        this.navigated.set(true);
        break;
    }
  }

  private ensureSuggestions(): void {
    if (this.disabled() || this.readonly()) {
      return;
    }
    this.expanded.set(true);
    if (!this.interacted || this.loadError() !== null) {
      this.interacted = true;
      this.startSearch(this.editing() ? this.query() : '', false, 0);
    }
  }

  private restoreCommittedDisplay(): void {
    if (!this.editing()) {
      return;
    }
    const restored = this.displayValue();
    this.editing.set(false);
    this.query.set(restored);
    this.queryChange.emit(restored);
  }

  private commitPendingSelection(): void {
    const key = this.pendingKey;
    if (key === undefined || this.disabled() || this.readonly()) {
      return;
    }
    const item = this.rows().find((candidate) => this.keyOf()(candidate) === key);
    if (item === undefined || this.optionDisabled()(item)) {
      return;
    }
    const source = this.dataSource();
    this.cachedSelection.set({ source, key, item });
    this.value.set(key);
    this.editing.set(false);
    const label = this.displayWith()(item);
    this.query.set(label);
    this.expanded.set(false);
    this.pendingKey = undefined;
    this.queryChange.emit(label);
    this.selectionChange.emit({ key, item });

    this.refocusing = true;
    this.inputElement().nativeElement.focus();
    // Cleared here too: an input that never lost focus raises no event, and a flag left set
    // would swallow the next genuine focus instead.
    this.refocusing = false;
  }

  private loadMore(): void {
    if (!this.expanded() || !this.hasMore() || this.searchLoading()) {
      return;
    }
    this.startSearch(this.activeSearch, true, 0);
  }

  private startSearch(search: string, append: boolean, delay: number): void {
    this.cancelSearch();
    const source = this.dataSource();
    const generation = ++this.searchGeneration;
    const controller = new AbortController();
    this.searchController = controller;
    this.activeSearch = search;
    this.loadError.set(null);
    this.searchLoading.set(true);
    if (!append) {
      this.rows.set([]);
      this.hasMore.set(false);
      this.navigated.set(false);
    }

    const run = (): void => {
      this.searchTimer = null;
      this.pendingTasks.run(() => this.loadPage(source, search, append, generation, controller));
    };
    if (delay > 0) {
      this.searchTimer = setTimeout(run, delay);
    } else {
      run();
    }
  }

  private async loadPage(
    source: DataSource<T>,
    search: string,
    append: boolean,
    generation: number,
    controller: AbortController,
  ): Promise<void> {
    const pageSize = this.safePageSize();
    const skip = append ? this.rows().length : 0;
    try {
      const result = await withAbort(
        source.load({
          search,
          skip,
          take: pageSize + 1,
          signal: controller.signal,
        }),
        controller.signal,
      );
      if (controller.signal.aborted || generation !== this.searchGeneration) {
        return;
      }
      this.applyPage(source, result, skip, pageSize, append);
    } catch (error) {
      if (controller.signal.aborted || generation !== this.searchGeneration) {
        return;
      }
      this.loadError.set(error);
      this.announcement.set({ kind: 'loadError' });
    } finally {
      if (generation === this.searchGeneration) {
        this.searchLoading.set(false);
      }
    }
  }

  private applyPage(
    source: DataSource<T>,
    result: LoadResult<T>,
    skip: number,
    pageSize: number,
    append: boolean,
  ): void {
    const page = result.rows.slice(0, pageSize);
    const merged = append ? this.mergeRows(this.rows(), page) : page;
    this.rows.set(merged);
    // The over-fetched row outranks the source's own answer: a `hasMore` computed
    // over the probe row reports `false` on the page that withheld it.
    this.hasMore.set(
      result.rows.length > pageSize ||
        (result.hasMore ??
          (result.totalCount === undefined ? false : skip + page.length < result.totalCount)),
    );
    const selectedKey = this.value();
    if (selectedKey !== '') {
      const selected = merged.find((item) => this.keyOf()(item) === selectedKey);
      if (selected !== undefined) {
        this.cachedSelection.set({ source, key: selectedKey, item: selected });
      }
    }
    this.announcement.set(
      merged.length === 0 ? { kind: 'noData' } : { kind: 'results', count: merged.length },
    );
  }

  private mergeRows(current: readonly T[], page: readonly T[]): readonly T[] {
    const keys = new Set(current.map((item) => this.keyOf()(item)));
    return [...current, ...page.filter((item) => !keys.has(this.keyOf()(item)))];
  }

  private cancelSearch(): void {
    if (this.searchTimer !== null) {
      clearTimeout(this.searchTimer);
      this.searchTimer = null;
    }
    this.searchController?.abort();
    this.searchController = null;
    this.searchLoading.set(false);
  }

  private failedResolution(
    key: DataKey,
    reason: AutocompleteResolutionFailure['reason'],
    cause?: unknown,
  ): ResolutionResult<T> {
    const failure: AutocompleteResolutionFailure = {
      key,
      reason,
      ...(cause === undefined ? {} : { cause }),
    };
    this.resolutionFailed.emit(failure);
    return { kind: 'failed', key, failure };
  }
}
