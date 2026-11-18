import { DOCUMENT, NgTemplateOutlet } from '@angular/common';
import {
  Component,
  ElementRef,
  Injector,
  afterNextRender,
  afterRenderEffect,
  computed,
  inject,
  input,
  linkedSignal,
  signal,
  viewChild,
} from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { TranslocoPipe, TranslocoService } from '@jsverse/transloco';
import { injectUiCopy, UiCopyPipe } from '@util/ui-copy';
import {
  LucideChevronLeft,
  LucideChevronRight,
  LucideCopy,
  LucideEllipsisVertical,
  LucidePencil,
  LucidePlus,
  LucideSave,
  LucideSparkles,
  LucideStar,
  LucideTrash2,
  LucideUndo2,
  LucideX,
} from '@lucide/angular';
import { Button } from '@ui/button';
import { ConfirmationService } from '@ui/confirmation-dialog';
import { ContextMenu, type MenuItem } from '@ui/context-menu';
import { Dialog, DialogFooter } from '@ui/dialog';
import { InputText } from '@ui/input-text';
import { Select, SelectOptionTemplate, SelectedItemTemplate, type SelectOption } from '@ui/select';
import { Tooltip } from '@ui/tooltip';
import {
  VIEW_NAME_MAX_LENGTH,
  isValidViewName,
  viewDropIndex,
  SAVED_VIEWS_HEADROOM,
} from '@ui/saved-views/core';
import type { SavedViewsController, SavedViewsLayout } from '@ui/saved-views/core';
import { dropTabFrom, slideTabFrom } from './saved-views-motion';
import { SAVED_VIEWS_TRANSLOCO_SCOPE } from './saved-views.i18n';
import type { SavedViewDrag, SavedViewSelectValue, SavedViewTab } from './saved-views-strip.types';

/** Pointer travel that turns a press into a reorder rather than a selection. */
const DRAG_THRESHOLD = 4;

/**
 * Fraction of the strip left on screen after an arrow press.
 *
 * The same figure `@ui/tabs` uses. A press that scrolled a whole viewport
 * would leave nothing the eye had already read to place the new tabs against.
 */
const SCROLL_OVERLAP = 0.2;

/**
 * Room the tab strip needs before it is worth drawing, in CSS pixels.
 *
 * Below this the bar has space for two short tabs and the button that adds a
 * third, which is a strip only in name — and the width it is still claiming is
 * the width the rest of the bar is about to want. The listbox costs roughly
 * two thirds as much and holds any number of views, so the swap happens here
 * rather than at the point where the bar starts collapsing items, which is a
 * little later.
 */
const STRIP_MIN_WIDTH = 288;

/**
 * The least the entry will be squeezed to, in CSS pixels.
 *
 * Yielding is right up to a point, and the point is the width at which the
 * field stops saying which view is on screen. Past it the bar is simply
 * over-subscribed, and the answer to that is the overflow menu the toolbar
 * already has — a collapsed button is one press away, where a field showing
 * nothing is a control that has stopped working.
 *
 * The widest the compact form gets: the field's own fixed `11rem`, plus the
 * unsaved pair when it is there — two `sm` icon buttons at 34px and the two
 * gaps in front of them. Not the field alone, because a cap that fits only
 * the field starves it by exactly the pair the moment a view goes dirty, and
 * the field is the half that cannot give: `--select-value-inset-end` is spent
 * before the first character.
 */
const COMPACT_MIN_WIDTH = 176 + 8 + 34 + 8 + 34;

/** The first row of the compact listbox. See {@link SavedViewSelectValue}. */
const ADD_VIEW: SavedViewSelectValue = Symbol('savedViews.add');

let nextId = 0;

/**
 * The named-views strip: a tab per saved preset of the host that owns it.
 *
 * ```ts
 * import { SavedViews, SavedViewsController } from '@ui/saved-views';
 * ```
 * ```html
 * <lib-saved-views [controller]="views" layout="strip" />
 * ```
 *
 * The whole of its state is the controller it is handed — one input rather
 * than a dozen inputs and nine outputs threaded through whatever sits between
 * this and the host. The host builds a `SavedViewsController` over its own
 * state and storage; the strip renders it and calls into it.
 *
 * It draws in one of two shapes. The strip is the wide one; the compact one is
 * a listbox with the same rows, plus the buttons a tab cannot carry once its
 * hover affordances have nowhere to live. `layout` picks, and `auto` picks by
 * the headroom a host publishes through `SAVED_VIEWS_HEADROOM`.
 *
 * A host that wants the strip out of its main chunk imports the controller
 * from `@ui/saved-views/core` and this component through a dynamic
 * `import('@ui/saved-views')`.
 */
@Component({
  selector: 'lib-saved-views',
  templateUrl: './saved-views.html',
  styleUrl: './saved-views.scss',
  imports: [
    NgTemplateOutlet,
    TranslocoPipe,
    UiCopyPipe,
    Button,
    ContextMenu,
    Dialog,
    DialogFooter,
    InputText,
    Select,
    SelectOptionTemplate,
    SelectedItemTemplate,
    Tooltip,
    LucideChevronLeft,
    LucideChevronRight,
    LucideEllipsisVertical,
    LucidePlus,
    LucideSave,
    LucideSparkles,
    LucideStar,
    LucideUndo2,
    LucideX,
  ],
  providers: [SAVED_VIEWS_TRANSLOCO_SCOPE],
  host: {
    class: 'sv-host',
    '[style.max-width.px]': 'widthCap()',
  },
})
export class SavedViews<TState = unknown> {
  private readonly transloco = inject(TranslocoService);
  private readonly copy = injectUiCopy();
  private readonly confirmation = inject(ConfirmationService);
  private readonly injector = inject(Injector);
  private readonly document = inject(DOCUMENT);
  /** Absent when the strip is drawn outside a bar, which is no limit at all. */
  private readonly headroom = inject(SAVED_VIEWS_HEADROOM, { optional: true });

  /** The host's views controller. The strip renders it and calls into it. */
  readonly controller = input.required<SavedViewsController<TState>>();

  /**
   * Which shape to draw. `auto` follows the host's published headroom and
   * falls back to the strip; a host that measures itself binds `strip` or
   * `compact` outright.
   */
  readonly layout = input<SavedViewsLayout>('auto');

  private readonly tabListRef = viewChild<ElementRef<HTMLElement>>('tabList');
  // `read: ElementRef` is not optional: `libInputText` is a component with an
  // attribute selector, so a bare template-reference query answers the
  // component instance and `nativeElement` is quietly `undefined` — the editor
  // then never takes focus, with no error to say why. The generic is given
  // explicitly because with one type argument `read` infers `ElementRef<any>`.
  private readonly editorRef = viewChild<unknown, ElementRef<HTMLInputElement>>('editorInput', {
    read: ElementRef,
  });
  private readonly menuRef = viewChild.required<ContextMenu>('viewMenu');
  private readonly dialogInputRef = viewChild<unknown, ElementRef<HTMLInputElement>>(
    'dialogInput',
    { read: ElementRef },
  );

  /** The backend's cap, enforced in the field as well as on the way out. */
  protected readonly nameMaxLength = VIEW_NAME_MAX_LENGTH;

  /**
   * Names the two descriptions the tabs point at.
   *
   * A description rather than more text in the tab: an accessible name that
   * gains "default" or "unsaved changes" is re-announced mid-interaction, and
   * both facts are about the tab rather than part of what it is called.
   */
  private readonly noteSeed = (nextId++).toString();
  protected readonly dirtyNoteId = `lib-saved-views-dirty-${this.noteSeed}`;
  protected readonly temporaryNoteId = `lib-saved-views-temporary-${this.noteSeed}`;
  protected readonly defaultNoteId = `lib-saved-views-default-${this.noteSeed}`;

  /** The tab holding the roving tab stop. Falls back to the selection, then to the first. */
  private readonly focusedId = signal<string | null>(null);

  private drag: SavedViewDrag | null = null;
  /** The tab under the pointer, as a signal — the template reads it. */
  private readonly draggingId = signal<string | null>(null);
  /** Set by a drag, read by the click it retargets to the host, cleared on the next press. */
  private suppressClick = false;

  protected readonly views = computed(() => this.controller().views());
  protected readonly editor = computed(() => this.controller().editor());
  protected readonly status = computed(() => this.controller().status());
  protected readonly dirty = computed(() => this.controller().dirty());

  /** True once the document has been read, so "no views yet" is never shown over a load. */
  protected readonly ready = computed(() => this.controller().ready());

  protected readonly tabs = computed<readonly SavedViewTab<TState>[]>(() => {
    const controller = this.controller();
    const selectedId = controller.selectedId();
    const editing = controller.editor();
    const dirty = controller.dirty();
    const stored = controller.views().map((view, index) => ({
      view,
      selected: view.id === selectedId,
      isDefault: index === 0,
      dirty: dirty && view.id === selectedId,
      editing: editing?.mode === 'rename' && editing.id === view.id,
      temporary: false,
    }));
    const temporary = controller.temporary();
    if (temporary == null) {
      return stored;
    }
    // After the stored views, so no position it can hold is the default's.
    return [
      ...stored,
      {
        view: temporary,
        selected: temporary.id === selectedId,
        isDefault: false,
        dirty: dirty && temporary.id === selectedId,
        editing: false,
        temporary: true,
      },
    ];
  });

  protected readonly temporaryPresent = computed(() => this.controller().temporary() != null);
  protected readonly temporarySelected = computed(() => this.controller().temporarySelected());

  /** Why the temporary view exists, for the note its tab points at. */
  protected readonly temporaryDescription = computed(
    () => this.controller().temporary()?.description ?? null,
  );

  /** The tab that owns the tab stop, so arrows walk the strip and `Tab` leaves it. */
  protected readonly rovingId = computed(() => {
    const tabs = this.tabs();
    const focused = this.focusedId();
    if (focused != null && tabs.some((tab) => tab.view.id === focused)) {
      return focused;
    }
    return tabs.find((tab) => tab.selected)?.view.id ?? tabs.at(0)?.view.id ?? null;
  });

  /** The notes a tab points at, composed rather than one overwriting the other. */
  protected describedBy(tab: SavedViewTab<TState>): string | null {
    const ids: string[] = [];
    if (tab.isDefault) {
      ids.push(this.defaultNoteId);
    }
    if (tab.dirty) {
      ids.push(this.dirtyNoteId);
    }
    if (tab.temporary) {
      ids.push(this.temporaryNoteId);
    }
    return ids.length === 0 ? null : ids.join(' ');
  }

  protected readonly editorValid = computed(() => {
    const editor = this.editor();
    return editor != null && isValidViewName(editor.name);
  });

  /** Items of the menu now open, built at open time so the scope has loaded. */
  protected readonly menuItems = signal<readonly MenuItem[]>([]);

  /**
   * Whether the bar has room for the strip.
   *
   * Read from the host rather than from a breakpoint: what runs out is the
   * bar's width, and how much of it is left depends on how many items the host
   * declared, not on how wide the window is.
   */
  protected readonly compact = computed(() => {
    const layout = this.layout();
    if (layout !== 'auto') {
      return layout === 'compact';
    }
    return (this.headroom?.() ?? Number.POSITIVE_INFINITY) < STRIP_MIN_WIDTH;
  });

  /**
   * The most width the strip may claim, or `null` for no ceiling.
   *
   * The entry is `overflow: 'never'`, so it is drawn whatever the bar's budget
   * — which means a strip left to its natural width pushes the bar's *buttons*
   * into the overflow menu one at a time as views are added. The buttons come
   * first: they are the host's actions, and a view the user cannot see is one
   * scroll away where a collapsed button is two presses away behind a glyph.
   *
   * Held to exactly what is left, so `rigid + views` can never exceed the
   * budget and no `auto` entry is ever collapsed on the strip's account. The
   * ceiling cannot feed back on itself for the same reason the headroom is
   * safe to read at all: the strip's own width is not in the sum that produces
   * it.
   *
   * Both forms take it, and it stops at {@link COMPACT_MIN_WIDTH}. A bar whose
   * buttons alone overrun it reports no headroom at all, and a cap taken
   * literally there leaves a field too narrow to show the view it holds. The
   * floor hands that case back to the bar: `used` then exceeds the budget, and
   * the split collapses `auto` entries into the overflow surface, which is
   * what that surface is for.
   */
  protected readonly widthCap = computed(() => {
    const headroom = this.headroom?.();
    if (headroom === undefined || !Number.isFinite(headroom)) {
      return null;
    }
    return Math.max(headroom, COMPACT_MIN_WIDTH);
  });

  /** The view the compact form acts on. Its menu, its marks and its dirty pair. */
  protected readonly selectedTab = computed(() => this.tabs().find((tab) => tab.selected) ?? null);

  protected readonly selectDescribedBy = computed(() => {
    const tab = this.selectedTab();
    return tab == null ? null : this.describedBy(tab);
  });

  /**
   * Emits whenever a dictionary lands, so a label read imperatively is read
   * again once there is one.
   *
   * The rest of this component translates through the pipe, which re-renders
   * on its own. The add row cannot: its label is data the listbox holds, and
   * `translate` answers with the key until the lazy scope arrives.
   */
  private readonly translations = toSignal(this.transloco.events$, { initialValue: null });

  protected readonly options = computed<readonly SelectOption<SavedViewSelectValue>[]>(() => {
    this.translations();
    return [
      { label: this.loadedCopy('savedViews.create'), value: ADD_VIEW },
      ...this.tabs().map((tab) => ({ label: tab.view.name, value: tab.view.id })),
    ];
  });

  /**
   * A key's text once its dictionary has landed, and `''` until then. Looked up first:
   * `translate` on a key whose scope is still loading logs a missing translation for a gap the
   * next read fills.
   */
  private loadedCopy(key: string): string {
    const resolved = this.copy(key);
    const fallback = this.transloco.config.fallbackLang;
    const lang = [
      this.transloco.getActiveLang(),
      ...(typeof fallback === 'string' ? [fallback] : []),
    ].find((candidate) => resolved in this.transloco.getTranslation(candidate));
    return lang === undefined ? '' : this.transloco.translate(resolved, {}, lang);
  }

  /**
   * What the listbox shows. Tracks the selection, and holds a local write
   * until it does.
   */
  protected readonly selectValue = linkedSignal<SavedViewSelectValue | undefined>(
    () => this.controller().selectedId() ?? undefined,
  );

  protected readonly dialogOpen = computed(() => this.compact() && this.editor() !== null);

  /**
   * Which way the strip has more tabs than it is showing.
   *
   * The arrows replace a scrollbar, which is what a toolbar cannot spare the
   * height for and what a horizontal one is a poor affordance for anyway. The
   * strip still scrolls on a wheel or a trackpad — the bar is hidden, not the
   * scrolling — and the keyboard never needs either, because focusing a tab
   * brings it into view.
   */
  protected readonly canScrollStart = signal(false);
  protected readonly canScrollEnd = signal(false);

  /**
   * Whether the pair is drawn at all.
   *
   * Both or neither, and each is dimmed rather than removed at its own end, so
   * the strip does not resize every time it reaches one. Removing them when
   * nothing overflows cannot flip-flop: hiding them widens the viewport, and a
   * strip that fitted the narrower one fits the wider.
   */
  protected readonly scrollable = computed(() => this.canScrollStart() || this.canScrollEnd());

  constructor() {
    // Every input to the answer is a signal — the views, the width the bar
    // allows, the form in force — so this needs no observer of its own. The
    // scroll position is the exception, and it arrives as an event.
    afterRenderEffect(() => {
      this.tabs();
      this.widthCap();
      this.compact();
      this.updateScroll();
    });
  }

  protected onStripScroll(): void {
    this.updateScroll();
  }

  /** One press, four fifths of what is on screen, in the direction pressed. */
  protected scrollByStep(direction: 1 | -1): void {
    const list = this.tabListRef()?.nativeElement;
    // No `behavior`, so the CSS decides — which is also where the
    // reduced-motion rule that neutralizes it lives.
    list?.scrollBy({ left: list.clientWidth * (1 - SCROLL_OVERLAP) * direction });
  }

  private updateScroll(): void {
    const list = this.tabListRef()?.nativeElement;
    if (list == null) {
      this.canScrollStart.set(false);
      this.canScrollEnd.set(false);
      return;
    }
    // A pixel of slack: a scroller at its end can be a subpixel short of it,
    // and an arrow that never quite goes out is an arrow that does nothing.
    this.canScrollStart.set(list.scrollLeft > 1);
    this.canScrollEnd.set(list.scrollLeft + list.clientWidth < list.scrollWidth - 1);
  }

  /** The tab a listbox row stands for, or `null` for the row that adds one. */
  protected optionRow(value: unknown): SavedViewTab<TState> | null {
    return this.tabs().find((tab) => tab.view.id === value) ?? null;
  }

  /**
   * Takes a row of the listbox.
   *
   * The add row is a command wearing an option, so the field is put back to
   * the view it was showing. That cannot happen in this call: an input binding
   * writes only when the expression differs from what it last pushed, and
   * setting the id straight back here would leave the two agreeing while the
   * listbox holds the row it has already accepted.
   */
  protected onSelectValue(value: SavedViewSelectValue | undefined): void {
    this.selectValue.set(value);
    if (value === ADD_VIEW) {
      afterNextRender(
        () => {
          this.selectValue.set(this.controller().selectedId() ?? undefined);
        },
        { injector: this.injector },
      );
      this.onCreate();
      return;
    }
    if (typeof value === 'string') {
      this.controller().select(value);
    }
  }

  /**
   * The per-view menu, on the selected view, from a real button.
   *
   * It opens with the row that adds a view. The strip states that with a `+`
   * of its own; here the listbox's first row is the only other way in, and a
   * user who has just opened this menu should not have to close it again.
   */
  protected openSelectedMenu(event: MouseEvent): void {
    const tab = this.selectedTab();
    const create: MenuItem = {
      label: this.label('create'),
      icon: LucidePlus,
      command: () => {
        this.onCreate();
      },
    };
    this.menuItems.set(
      tab == null ? [create] : [create, { separator: true }, ...this.buildMenu(tab)],
    );
    this.menuRef().showAt(event.currentTarget as HTMLElement, event, { focusFirstItem: true });
  }

  /**
   * Focus on open.
   *
   * `showModal` focuses the first focusable element, which is the dialog's own
   * close button — correct for a dialog that is read, wrong for one whose
   * whole content is a single field.
   */
  protected focusDialogInput(): void {
    const input = this.dialogInputRef()?.nativeElement;
    input?.focus();
    input?.select();
  }

  /** Escape, the backdrop and the close button all abandon the edit. */
  protected onDialogClosed(): void {
    if (this.editor() !== null) {
      this.controller().cancelEditor();
    }
  }

  protected onCreate(): void {
    this.controller().beginCreate();
    this.focusEditorNextRender();
  }

  protected onEditorInput(event: Event): void {
    const input = event.target;
    if (input instanceof HTMLInputElement) {
      this.controller().setEditorName(input.value);
    }
  }

  protected onEditorKeydown(event: KeyboardEvent): void {
    if (event.key === 'Enter') {
      event.preventDefault();
      this.commitEditor();
      return;
    }
    if (event.key === 'Escape') {
      // Stopped only while the editor is open, so the key still reaches a
      // surrounding dialog every other time.
      event.preventDefault();
      event.stopPropagation();
      this.controller().cancelEditor();
    }
  }

  protected commitEditor(): void {
    if (this.editorValid()) {
      this.controller().commitEditor();
    }
  }

  protected cancelEditor(): void {
    this.controller().cancelEditor();
  }

  protected onTabClick(tab: SavedViewTab<TState>): void {
    if (this.suppressClick) {
      return;
    }
    this.controller().select(tab.view.id);
  }

  protected onTabDoubleClick(tab: SavedViewTab<TState>): void {
    if (tab.temporary) {
      return;
    }
    this.controller().beginRename(tab.view.id);
    this.focusEditorNextRender();
  }

  /**
   * Arrows move focus; `Enter` and `Space` select.
   *
   * Manual activation, unlike `@ui/tabs`, and the reason is the cost of the
   * action: selecting a view applies a state and issues a query, so walking
   * the strip under automatic activation would fire a request per keypress.
   * `Ctrl` with an arrow reorders, the same binding the group panel's chips
   * take.
   */
  protected onTabKeydown(tab: SavedViewTab<TState>, event: KeyboardEvent): void {
    const tabs = this.tabs();
    const index = tabs.findIndex((entry) => entry.view.id === tab.view.id);
    if (index < 0) {
      return;
    }
    if (
      (event.ctrlKey || event.metaKey) &&
      (event.key === 'ArrowLeft' || event.key === 'ArrowRight')
    ) {
      event.preventDefault();
      // Stored views stop before the temporary one, which never moves.
      if (tab.temporary || (event.key === 'ArrowRight' && tabs.at(index + 1)?.temporary === true)) {
        return;
      }
      this.reorder(() => {
        this.controller().move(tab.view.id, index + (event.key === 'ArrowRight' ? 1 : -1));
      });
      this.focusTabNextRender(tab.view.id);
      return;
    }
    switch (event.key) {
      case 'ArrowRight':
        event.preventDefault();
        this.moveFocus(tabs, index + 1);
        break;
      case 'ArrowLeft':
        event.preventDefault();
        this.moveFocus(tabs, index - 1);
        break;
      case 'Home':
        event.preventDefault();
        this.moveFocus(tabs, 0);
        break;
      case 'End':
        event.preventDefault();
        this.moveFocus(tabs, tabs.length - 1);
        break;
      case 'Enter':
      case ' ':
        event.preventDefault();
        this.controller().select(tab.view.id);
        break;
      case 'F2':
        event.preventDefault();
        this.onTabDoubleClick(tab);
        break;
      default:
        break;
    }
  }

  protected onTabFocus(tab: SavedViewTab<TState>): void {
    this.focusedId.set(tab.view.id);
  }

  /** Opens the per-view menu, at the pointer or anchored for `Shift`+`F10`. */
  protected onTabContextMenu(tab: SavedViewTab<TState>, event: MouseEvent): void {
    this.menuItems.set(this.buildMenu(tab));
    this.menuRef().show(event);
  }

  /**
   * A menu label.
   *
   * Translated imperatively, which is safe here and nowhere else in this
   * component: a menu is built when it is opened, and opening is a user action
   * — long after the lazy dictionary has landed.
   */
  private label(key: string): string {
    return this.transloco.translate(this.copy(`savedViews.${key}`));
  }

  /** The menu both forms open. The compact one hangs it from a button instead. */
  private buildMenu(tab: SavedViewTab<TState>): readonly MenuItem[] {
    const controller = this.controller();
    const label = (key: string): string => this.label(key);
    if (tab.temporary) {
      // Read-only: a stored copy of it, or closing it, and nothing that would write it.
      return [
        {
          label: label('duplicate'),
          icon: LucideCopy,
          command: () => {
            controller.duplicate(tab.view.id);
          },
        },
        {
          label: label('close'),
          icon: LucideX,
          command: () => {
            controller.closeTemporary();
          },
        },
        { separator: true },
        {
          label: label('discardChanges'),
          icon: LucideUndo2,
          disabled: !tab.dirty,
          command: () => {
            controller.revertChanges();
          },
        },
      ];
    }
    return [
      {
        label: label('duplicate'),
        icon: LucideCopy,
        disabled: tab.dirty,
        command: () => {
          this.reorder(() => {
            controller.duplicate(tab.view.id);
          });
        },
      },
      {
        label: label('setDefault'),
        icon: LucideStar,
        disabled: tab.dirty || tab.isDefault,
        command: () => {
          // The same FLIP a drag plays. A view crossing the whole strip to
          // reach the front is the longest travel this control has, and
          // popping it there leaves the reader to work out what moved.
          this.reorder(() => {
            controller.setDefault(tab.view.id);
          });
        },
      },
      {
        label: label('edit'),
        icon: LucidePencil,
        disabled: tab.dirty,
        command: () => {
          controller.beginRename(tab.view.id);
          this.focusEditorNextRender();
        },
      },
      {
        label: label('delete'),
        icon: LucideTrash2,
        disabled: tab.dirty,
        command: () => {
          void this.confirmDelete(tab);
        },
      },
      { separator: true },
      {
        label: label('saveChanges'),
        icon: LucideSave,
        disabled: !tab.dirty,
        command: () => {
          controller.saveChanges();
        },
      },
      {
        label: label('discardChanges'),
        icon: LucideUndo2,
        disabled: !tab.dirty,
        command: () => {
          controller.revertChanges();
        },
      },
    ];
  }

  protected onDelete(tab: SavedViewTab<TState>): void {
    if (tab.temporary) {
      // Nothing stored is lost, so nothing to confirm.
      this.controller().closeTemporary();
      return;
    }
    void this.confirmDelete(tab);
  }

  protected saveChanges(): void {
    this.controller().saveChanges();
  }

  protected revertChanges(): void {
    this.controller().revertChanges();
  }

  /**
   * Starts a reorder.
   *
   * The capture goes on the tab list, never on the tab: a live swap moves the
   * grabbed tab in the DOM, and a moved element loses its pointer capture, so
   * the drag would go deaf after its first swap.
   */
  protected onTabPointerDown(tab: SavedViewTab<TState>, event: PointerEvent): void {
    this.suppressClick = false;
    // The affordances inside a tab are presses of their own. Without this a
    // press on the × or on save begins a drag the moment the hand wobbles.
    if (
      tab.temporary ||
      event.button !== 0 ||
      (event.target as Element | null)?.closest('button') != null
    ) {
      return;
    }
    const element = this.tabElement(tab.view.id);
    if (element == null) {
      return;
    }
    this.drag = {
      id: tab.view.id,
      pointerId: event.pointerId,
      startX: event.clientX,
      clientX: event.clientX,
      grabOffset: event.clientX - element.getBoundingClientRect().left,
      moved: false,
      pendingOffset: null,
      translation: 0,
    };
  }

  protected onListPointerMove(event: PointerEvent): void {
    const drag = this.drag;
    if (drag?.pointerId !== event.pointerId) {
      return;
    }
    if (!drag.moved) {
      if (Math.abs(event.clientX - drag.startX) < DRAG_THRESHOLD) {
        return;
      }
      // Captured only once the press is a drag: capturing on `pointerdown`
      // retargets the trailing click to the capturing element, which would
      // make every press on a tab arrive looking like a press on the list.
      this.tabListRef()?.nativeElement.setPointerCapture(event.pointerId);
      this.drag = { ...drag, moved: true };
      this.draggingId.set(drag.id);
      this.suppressClick = true;
    }
    this.applyDragMove(event.clientX);
  }

  protected onListPointerUp(event: PointerEvent): void {
    const drag = this.drag;
    this.drag = null;
    this.draggingId.set(null);
    if (drag?.pointerId !== event.pointerId) {
      return;
    }
    const list = this.tabListRef()?.nativeElement;
    if (list?.hasPointerCapture(event.pointerId) === true) {
      list.releasePointerCapture(event.pointerId);
    }
    if (!drag.moved) {
      return;
    }
    // The tab is under the pointer and its place is already correct, so the
    // release is a FLIP of exactly the translation being dropped.
    const element = this.tabElement(drag.id);
    if (element != null) {
      element.style.transform = '';
      element.style.willChange = '';
      dropTabFrom(element, drag.translation);
    }
    this.controller().commitOrder();
  }

  protected isDragging(tab: SavedViewTab<TState>): boolean {
    return this.draggingId() === tab.view.id;
  }

  /**
   * Moves the dragged tab under the pointer and swaps it past its neighbours.
   *
   * The tab itself is what follows the pointer — there is no separate ghost.
   * A ghost would be a second copy of the thing the user is already holding,
   * and the strip lives inside an `overflow-x` scroller that would clip one.
   *
   * Geometry is read with `offsetLeft`/`offsetWidth`, never
   * `getBoundingClientRect`: a swap still sliding into place has to be
   * measured where it lands rather than where it is drawn.
   */
  private applyDragMove(clientX: number): void {
    const drag = this.drag;
    const element = drag == null ? null : this.tabElement(drag.id);
    if (drag == null || element == null) {
      return;
    }
    const offset = element.offsetLeft;
    const translation = this.positionDragged(element, drag, clientX);

    if (drag.pendingOffset === offset) {
      // The previous swap has not reached the DOM yet. Deciding again on the
      // old places would swap the same pair straight back — which is what
      // makes a drag refuse to be dragged home without releasing it first.
      this.drag = { ...drag, clientX, translation };
      return;
    }

    const elements = this.tabElements();
    const fromIndex = elements.indexOf(element);
    if (fromIndex < 0) {
      this.drag = { ...drag, clientX, translation, pendingOffset: null };
      return;
    }
    const centers = elements.map((tab) => tab.offsetLeft + tab.offsetWidth / 2);
    // The dragged tab is drawn away from its own place, so the swap is decided
    // on the box the pointer is holding rather than on the pointer itself: a
    // tab grabbed by its edge would otherwise swap while it still looks put.
    const start = offset + translation;
    const target = viewDropIndex(centers, { start, end: start + element.offsetWidth }, fromIndex);
    if (target === fromIndex) {
      this.drag = { ...drag, clientX, translation, pendingOffset: null };
      return;
    }
    this.drag = { ...drag, clientX, translation, pendingOffset: offset };
    const before = this.tabOffsets();
    this.controller().previewMove(drag.id, target);
    this.playSwap(drag.id, before);
  }

  /**
   * Writes the dragged tab's translation straight to the element.
   *
   * Not through a binding: this runs per pointer frame, and a signal write per
   * frame is a change-detection pass per frame.
   */
  private positionDragged(element: HTMLElement, drag: SavedViewDrag, clientX: number): number {
    const list = this.tabListRef()?.nativeElement;
    if (list == null) {
      return drag.translation;
    }
    const offset = element.offsetLeft;
    // Content coordinates, so a scrolled strip measures the same as an
    // unscrolled one.
    const pointerX = clientX - list.getBoundingClientRect().left + list.scrollLeft;
    // Held inside the stored tabs: a tab dragged past either end would otherwise
    // leave the control it belongs to, or cover the temporary tab it can never pass.
    const last = this.tabElements().at(-1);
    const end = last == null ? list.scrollWidth : last.offsetLeft + last.offsetWidth;
    const translation = Math.min(
      Math.max(pointerX - drag.grabOffset - offset, -offset),
      Math.max(end - element.offsetWidth - offset, 0),
    );
    element.style.willChange = 'transform';
    element.style.transform = `translateX(${translation.toString()}px)`;
    return translation;
  }

  /**
   * Runs a reorder and slides every tab it displaced.
   *
   * The pointer path has its own version inside the drag, because there the
   * dragged tab is exempt. Here nothing is exempt: the view being moved
   * travels furthest and is the one the reader is following.
   */
  private reorder(change: () => void): void {
    const before = this.tabOffsets();
    change();
    afterNextRender(
      () => {
        for (const element of this.tabElements()) {
          const id = element.dataset['viewId'];
          const previous = id === undefined ? undefined : before.get(id);
          if (previous !== undefined) {
            slideTabFrom(element, previous - element.offsetLeft);
          }
        }
      },
      { injector: this.injector },
    );
  }

  /** Every tab's `offsetLeft`, as the "First" half of the swap's FLIP. */
  private tabOffsets(): Map<string, number> {
    const offsets = new Map<string, number>();
    for (const element of this.tabElements()) {
      const id = element.dataset['viewId'];
      if (id != null) {
        offsets.set(id, element.offsetLeft);
      }
    }
    return offsets;
  }

  /**
   * Slides the tabs the swap displaced, once they have reached their new
   * places, and re-anchors the dragged one.
   *
   * `afterNextRender` rather than the handler: the swap is a signal write, and
   * the DOM it describes does not exist until the render that follows. The
   * dragged tab plays nothing — it is following the pointer, and a slide would
   * fight the hand holding it — but its translation is measured from its own
   * `offsetLeft`, which the swap has just changed, so it is rewritten here or
   * the tab jumps for the frame before the next pointer move.
   */
  private playSwap(draggedId: string, before: ReadonlyMap<string, number>): void {
    afterNextRender(
      () => {
        const drag = this.drag;
        for (const element of this.tabElements()) {
          const id = element.dataset['viewId'];
          if (id === undefined) {
            continue;
          }
          if (id === draggedId) {
            if (drag != null) {
              this.drag = {
                ...drag,
                translation: this.positionDragged(element, drag, drag.clientX),
              };
            }
            continue;
          }
          const previous = before.get(id);
          if (previous !== undefined) {
            slideTabFrom(element, previous - element.offsetLeft);
          }
        }
      },
      { injector: this.injector },
    );
  }

  private async confirmDelete(tab: SavedViewTab<TState>): Promise<void> {
    const result = await this.confirmation.open({
      title: this.transloco.translate(this.copy('savedViews.confirmDeleteTitle')),
      message: this.transloco.translate(this.copy('savedViews.confirmDelete'), {
        name: tab.view.name,
      }),
      severity: 'error',
      confirmLabel: this.transloco.translate(this.copy('savedViews.delete')),
      dismissible: true,
    });
    if (result === 'confirmed') {
      this.controller().remove(tab.view.id);
    }
  }

  private moveFocus(tabs: readonly SavedViewTab<TState>[], index: number): void {
    const wrapped = ((index % tabs.length) + tabs.length) % tabs.length;
    const next = tabs.at(wrapped);
    if (next == null) {
      return;
    }
    this.focusedId.set(next.view.id);
    this.tabElement(next.view.id)?.focus();
  }

  private tabElements(): HTMLElement[] {
    const list = this.tabListRef()?.nativeElement;
    return list == null ? [] : [...list.querySelectorAll<HTMLElement>('[data-view-id]')];
  }

  private tabElement(id: string): HTMLElement | null {
    // `CSS.escape` is absent in jsdom, so the selector is built as a string.
    return (
      this.tabListRef()?.nativeElement.querySelector<HTMLElement>(
        `[data-view-id="${id}"], [data-temporary-id="${id}"]`,
      ) ?? null
    );
  }

  /**
   * Focus after the render that draws the editor.
   *
   * Moving a focused element in the DOM drops focus to `document.body`, and a
   * rename replaces the tab with an input, so focusing in the handler is undone
   * by the render that follows it. Same reason a reordered tab is re-focused
   * once it has reached its new place.
   */
  private focusEditorNextRender(): void {
    afterNextRender(
      () => {
        const input = this.editorRef()?.nativeElement;
        if (input != null && this.document.activeElement !== input) {
          input.focus();
          input.select();
        }
      },
      { injector: this.injector },
    );
  }

  private focusTabNextRender(id: string): void {
    afterNextRender(
      () => {
        this.tabElement(id)?.focus();
      },
      { injector: this.injector },
    );
  }
}
