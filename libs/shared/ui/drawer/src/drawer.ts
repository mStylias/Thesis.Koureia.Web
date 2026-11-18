import {
  afterRenderEffect,
  booleanAttribute,
  Component,
  computed,
  contentChild,
  DestroyRef,
  Directive,
  DOCUMENT,
  ElementRef,
  inject,
  input,
  model,
  output,
  signal,
  viewChild,
} from '@angular/core';
import { LucideX } from '@lucide/angular';
import { provideTranslocoScope, TranslocoPipe } from '@jsverse/transloco';
import { UiCopyPipe } from '@util/ui-copy';
import { Button } from '@ui/button';
import { DRAWER_CLOSE_DELAY } from './drawer.constants';
import { DrawerHandoff, keepsPlace, toolbarButtons, toolbarMark } from './drawer-handoff';
import type { DrawerHandoffPass, DrawerToolbarMark } from './drawer-handoff.types';
import { drawerTranslocoScope } from './drawer.i18n';
import { DrawerMode, DrawerPosition, DrawerSize } from './drawer.types';
import { acquireScrollLock, releaseScrollLock } from './scroll-lock';

let nextDrawerId = 0;

/** Marks projected content as the drawer's custom header. */
@Directive({ selector: '[libDrawerHeader]' })
export class DrawerHeader {}

/**
 * Marks projected content as the drawer's pinned toolbar, drawn between the header and the
 * scrolling content. It is the place for actions that belong to the whole panel and must stay
 * reachable while the content scrolls under them.
 */
@Directive({ selector: '[libDrawerToolbar]' })
export class DrawerToolbar {}

/** Marks projected content as the drawer's pinned footer. */
@Directive({ selector: '[libDrawerFooter]' })
export class DrawerFooter {}

/**
 * Panel sliding in from a screen edge, on a native `<dialog>` — focus trap, Escape and
 * top-layer stacking come free in modal mode. Driven by the two-way `visible` binding:
 *
 * ```ts
 * import { Drawer } from '@ui/drawer';
 * ```
 *
 * ```html
 * <lib-drawer [(visible)]="filtersOpen" header="Filters" position="right">
 *   <div libDrawerToolbar>…pinned actions…</div>
 *   …content…
 *   <div libDrawerFooter>…pinned actions…</div>
 * </lib-drawer>
 * ```
 *
 * For a headless drawer omit `header` and set `closable` to `false`. Give it an
 * `ariaLabel` or `ariaLabelledBy` — with no header nothing else names the dialog, and an
 * unnamed one is announced as such.
 */
@Component({
  selector: 'lib-drawer',
  templateUrl: './drawer.html',
  styleUrl: './drawer.scss',
  imports: [Button, LucideX, TranslocoPipe, UiCopyPipe],
  providers: [provideTranslocoScope(drawerTranslocoScope)],
})
export class Drawer {
  /** Two-way visibility. */
  readonly visible = model(false);

  /** Edge to slide in from, or `full` for a full-screen drawer. */
  readonly position = input<DrawerPosition>('left');

  /**
   * `over` floats above the page; `push` renders in flow and displaces siblings, so put
   * the drawer in your own flex/grid container. Push drawers are always non-modal.
   */
  readonly mode = input<DrawerMode>('over');

  /** Panel width (left/right) or height (top/bottom). */
  readonly size = input<DrawerSize>('md');

  /** Title rendered in the built-in header. */
  readonly header = input('');

  /** Shows the × close button. */
  readonly closable = input(true, { transform: booleanAttribute });

  /** Modal mode: mask over the page and focus trapped inside. */
  readonly modal = input(true, { transform: booleanAttribute });

  /** Whether clicking the mask closes the drawer (modal mode only). */
  readonly dismissible = input(true, { transform: booleanAttribute });

  /** Dims the mask (modal only). `false` still traps focus and takes mask clicks. */
  readonly showBackdrop = input(true, { transform: booleanAttribute });

  /** Whether Escape closes the drawer. */
  readonly closeOnEscape = input(true, { transform: booleanAttribute });

  /** Prevents the page behind the drawer from scrolling while open. */
  readonly blockScroll = input(false, { transform: booleanAttribute });

  /**
   * Asked before the ×, Escape or the mask closes the drawer. Resolve `false` to keep it open, as a
   * form with unsaved changes does. A `visible` set to `false` from outside is not asked.
   */
  readonly closeGuard = input<(() => boolean | Promise<boolean>) | null>(null);

  /** Accessible label of the ×. Falls back to the `drawer` Transloco scope. */
  readonly closeAriaLabel = input('');

  /** Names the dialog itself, for headless drawers. Ignored when there is a title. */
  readonly ariaLabel = input('');

  /** Id of an on-screen element naming the dialog. Ignored when there is a title. */
  readonly ariaLabelledby = input('');

  /** Emitted when the drawer becomes visible. */
  readonly opened = output();

  /** Emitted once the exit transition has finished. */
  readonly closed = output();

  protected readonly titleId = `lib-drawer-title-${nextDrawerId++}`;
  protected readonly closing = signal(false);

  /** Modal semantics only make sense for a drawer floating over the page. */
  protected readonly effectiveModal = computed(() => this.modal() && this.mode() === 'over');

  protected readonly headerContent = contentChild(DrawerHeader);
  protected readonly toolbarContent = contentChild(DrawerToolbar);
  protected readonly footerContent = contentChild(DrawerFooter);
  protected readonly hasHeader = computed(
    () => !!this.header() || !!this.headerContent() || this.closable(),
  );
  protected readonly hasTitle = computed(() => !!this.header() || !!this.headerContent());

  /**
   * An unnamed `<dialog>` is an unnamed landmark, so a headless drawer falls back to the
   * caller's label. A `header` text wins. A projected header yields to `ariaLabelledby`: it can
   * hold buttons and secondary text that do not belong in the name.
   */
  protected readonly labelledBy = computed(() => {
    if (this.header()) return this.titleId;
    if (this.ariaLabelledby()) return this.ariaLabelledby();
    return this.headerContent() ? this.titleId : null;
  });

  protected readonly label = computed(() => (this.labelledBy() ? null : this.ariaLabel() || null));

  /**
   * The native focusing steps run for `show()` as well as `showModal()`, so an `autofocus`
   * × would grab focus on first paint for a push drawer that starts open — furniture, not
   * something the user asked for. Overlay drawers keep it, since their open is an action.
   */
  protected readonly autofocusClose = computed(() => (this.mode() === 'push' ? null : ''));

  private readonly dialog = viewChild.required<ElementRef<HTMLDialogElement>>('dialog');
  private readonly content = viewChild.required<ElementRef<HTMLElement>>('content');
  private readonly document = inject(DOCUMENT);
  private readonly handoff = inject(DrawerHandoff);
  private closeTimeout: ReturnType<typeof setTimeout> | undefined;
  /** When the running exit started, so {@link exit} waits out only the rest of it. */
  private closeStartedAt = 0;
  private scrollBlocked = false;

  /** Set once the open-or-close effect has run, so a later open is not the first render's. */
  private rendered = false;

  /** Set while the guard is asked, so a second Escape does not ask again. */
  private guarding = false;

  /** Ends the running content entrance. */
  private swapDone: ((event: AnimationEvent) => void) | null = null;

  constructor() {
    afterRenderEffect(() => {
      if (this.visible()) {
        this.open();
      } else {
        this.startClose();
      }
      this.rendered = true;
    });

    // Hold the lock through the exit, or the page jumps behind a drawer still sliding out.
    afterRenderEffect(() => {
      this.setScrollBlocked(this.blockScroll() && (this.visible() || this.closing()));
    });

    inject(DestroyRef).onDestroy(() => {
      clearTimeout(this.closeTimeout);
      this.setScrollBlocked(false);
    });
  }

  protected async hide(): Promise<void> {
    const guard = this.closeGuard();
    if (guard !== null) {
      if (this.guarding) return;
      this.guarding = true;
      try {
        if (!(await guard())) return;
      } finally {
        this.guarding = false;
      }
    }
    this.visible.set(false);
  }

  /**
   * Plays the exit on the element as it stands, and resolves when it has played. For a host that
   * is being destroyed and holds its element with `animate.leave`: a destroyed view renders no
   * more bindings, so this writes the exit to the DOM itself. An exit already running is waited
   * out, not restarted.
   *
   * ```ts
   * host: { '(animate.leave)': 'onLeave($event)' }
   * onLeave(event: AnimationCallbackEvent) {
   *   void this.drawer().exit().then(() => event.animationComplete());
   * }
   * ```
   */
  exit(): Promise<void> {
    const dialog = this.dialog().nativeElement;
    if (!dialog.open) return Promise.resolve();
    const remaining = this.closing()
      ? DRAWER_CLOSE_DELAY - (Date.now() - this.closeStartedAt)
      : DRAWER_CLOSE_DELAY;
    dialog.setAttribute('data-closing', '');
    return new Promise((resolve) => {
      setTimeout(
        () => {
          dialog.close();
          resolve();
        },
        Math.max(0, remaining),
      );
    });
  }

  /**
   * Scrolls the content back to its top. For a panel that swaps one record for another in place,
   * so the next record does not open at the scroll offset of the last.
   */
  scrollToTop(): void {
    this.content().nativeElement.scrollTop = 0;
  }

  /** Native `cancel` event — fired by Escape in modal mode. */
  protected onEscape(event: Event): void {
    // Always take over the close so the exit transition runs.
    event.preventDefault();
    if (this.closeOnEscape()) {
      void this.hide();
    }
  }

  /** Non-modal dialogs never receive `cancel`; catch the key directly. */
  protected onEscapeKey(): void {
    if (!this.effectiveModal() && this.closeOnEscape()) {
      void this.hide();
    }
  }

  /** A click on the `<dialog>` element itself lands on the mask. */
  protected onMaskClick(event: MouseEvent): void {
    if (
      this.effectiveModal() &&
      event.target === this.dialog().nativeElement &&
      this.dismissible()
    ) {
      void this.hide();
    }
  }

  private open(): void {
    const dialog = this.dialog().nativeElement;
    if (this.closing()) {
      // Reopened mid-exit: cancel the pending teardown.
      clearTimeout(this.closeTimeout);
      this.closing.set(false);
    }
    if (dialog.open) {
      return;
    }
    // Another drawer left this place without its exit, so this one appears without its entrance.
    const handedOff = this.handoff.take();
    if (handedOff !== null) {
      dialog.setAttribute('data-instant', '');
    }
    if (this.effectiveModal()) {
      dialog.showModal();
    } else if (this.mode() === 'push') {
      this.showInPlace(dialog, !this.rendered);
    } else {
      dialog.show();
    }
    if (handedOff !== null) {
      // Commit the open style before the transition comes back, or it runs anyway.
      void dialog.offsetWidth;
      dialog.removeAttribute('data-instant');
      // The panel stays where the last one was. Only what it shows changes.
      this.playSwap(handedOff);
    }
    this.opened.emit();
  }

  /**
   * Plays the content entrance from its start: the heading, the content and the footer through
   * `data-swap`, the toolbar button by button. The attribute comes off and goes on again around a
   * forced style, or a second change during the first would not restart it.
   */
  private playSwap(pass: DrawerHandoffPass): void {
    const dialog = this.dialog().nativeElement;
    const content = this.content().nativeElement;
    // Reduced motion draws no animation, so no `animationend` takes the last listener off.
    if (this.swapDone !== null) content.removeEventListener('animationend', this.swapDone);
    this.swapDone = null;
    dialog.removeAttribute('data-swap');
    // A panel at the same level swaps at once.
    if (pass.direction === 'none') return;
    void dialog.offsetWidth;
    dialog.setAttribute('data-swap', pass.direction);
    const done = (event: AnimationEvent): void => {
      // Descendants' animations bubble here too.
      if (event.target !== content) return;
      content.removeEventListener('animationend', done);
      this.swapDone = null;
      dialog.removeAttribute('data-swap');
    };
    this.swapDone = done;
    content.addEventListener('animationend', done);
    this.driftToolbar(dialog, pass.toolbar);
  }

  /**
   * The toolbar's buttons drift in one by one, so a button drawn the same in the same place as
   * before stays still and does not flash. Script, not CSS: the buttons are projected content,
   * which the drawer's styles do not reach. It reads the same tokens the CSS entrance uses.
   */
  private driftToolbar(dialog: HTMLDialogElement, before: readonly DrawerToolbarMark[]): void {
    const view = this.document.defaultView;
    // jsdom has neither `matchMedia` nor `animate`.
    if (view === null || typeof view.matchMedia !== 'function') return;
    if (view.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const style = getComputedStyle(dialog);
    const duration = Number.parseFloat(style.getPropertyValue('--dur-slow'));
    if (Number.isNaN(duration)) return;
    const keyframes: Keyframe[] = [
      {
        opacity: 0,
        transform: `translateX(${style.getPropertyValue('--drawer-swap-from').trim()})`,
      },
      { opacity: 1, transform: 'none' },
    ];
    const easing = style.getPropertyValue('--ease-out').trim() || 'ease-out';
    for (const button of toolbarButtons([dialog])) {
      if (keepsPlace(toolbarMark(button), before) || typeof button.animate !== 'function') continue;
      button.animate(keyframes, { duration, easing, fill: 'backwards' });
    }
  }

  /**
   * `show()` without the focus move. The dialog focusing steps focus the first
   * focusable descendant even with no `autofocus`, so a push drawer that starts
   * open would take focus on first paint. Focus goes back where it was.
   *
   * A push drawer open on its first render is part of the page, so `instant`
   * skips the entrance: the sibling content would slide across on load.
   */
  private showInPlace(dialog: HTMLDialogElement, instant: boolean): void {
    const previous = this.document.activeElement;
    if (instant) {
      dialog.setAttribute('data-instant', '');
    }
    dialog.show();
    if (instant) {
      // Commit the open style before the transition comes back, or it runs anyway.
      void dialog.offsetWidth;
      dialog.removeAttribute('data-instant');
    }
    const current = this.document.activeElement;
    if (current === previous || !(current instanceof HTMLElement) || !dialog.contains(current)) {
      return;
    }
    if (previous instanceof HTMLElement && previous !== this.document.body) {
      previous.focus({ preventScroll: true });
    } else {
      current.blur();
    }
  }

  private startClose(): void {
    const dialog = this.dialog().nativeElement;
    if (!dialog.open || this.closing()) {
      return;
    }

    this.closing.set(true);
    this.closeStartedAt = Date.now();

    // Play the exit, then close for real; native close() also restores focus.
    this.closeTimeout = setTimeout(() => {
      dialog.close();
      this.closing.set(false);
      this.closed.emit();
    }, DRAWER_CLOSE_DELAY);
  }

  private setScrollBlocked(blocked: boolean): void {
    if (blocked === this.scrollBlocked) {
      return;
    }
    this.scrollBlocked = blocked;
    if (blocked) {
      acquireScrollLock(this.document);
    } else {
      releaseScrollLock(this.document);
    }
  }
}
