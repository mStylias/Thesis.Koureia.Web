/**
 * Which presentation the grid draws, and when `'auto'` changes its mind.
 *
 * A collaborator rather than a computed because it owns state: the media
 * subscription, the last reported view and the user's override all live here.
 *
 * The server and the first client frame resolve to the table, and the flip
 * happens in `afterNextRender`. That is the `@ui/sidebar` precedent, and it is
 * what keeps the hydrated DOM identical to the rendered one — a media query
 * read during rendering would make the server and the browser disagree.
 */
import {
  DestroyRef,
  Injector,
  afterNextRender,
  computed,
  effect,
  inject,
  signal,
  untracked,
  type Signal,
} from '@angular/core';
import { BreakpointObserver } from '@angular/cdk/layout';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { CARD_BREAKPOINTS } from '../datagrid.constants';
import type { DatagridBreakpoint, ResolvedDatagridView } from './types/card.types';
import type { ViewModeDeps } from './view-mode.types';

export class ViewMode {
  /** Whether the viewport is narrower than the card breakpoint. */
  private readonly narrow = signal(false);

  /** The user's own choice, which outranks `'auto'` until the grid is gone. */
  private readonly override = signal<ResolvedDatagridView | null>(null);

  private reported: ResolvedDatagridView | null = null;

  /**
   * Whether a change is worth saying out loud yet.
   *
   * The first answer the breakpoint gives is the initial resolution, not a
   * change: the page is still loading, nothing moved under the reader, and the
   * grid's lazy dictionary has not arrived — so the announcement would ship
   * the message key itself. A later crossing, and a manual switch, are real
   * events and always land after the scope.
   */
  private announceable = false;

  /** Answers the breakpoint has given. The first one is the baseline. */
  private breakpointReads = 0;

  readonly view: Signal<ResolvedDatagridView>;

  constructor(private readonly deps: ViewModeDeps) {
    const injector = inject(Injector);
    const destroyRef = inject(DestroyRef);
    const breakpoints = inject(BreakpointObserver);

    // The user's own choice outranks a pinned `view` as well as `'auto'`. The
    // switch reaches the bar only because the host named it, so a host that
    // pins the view and offers the item has asked for both — and an offered
    // control that does nothing is worse than either.
    this.view = computed(() => {
      const chosen = this.override();
      if (chosen != null) {
        return chosen;
      }
      const declared = this.deps.declared();
      return declared === 'auto' ? (this.narrow() ? 'cards' : 'table') : declared;
    });

    // Browser-only by construction, so nothing here runs during a server render.
    afterNextRender(
      () => {
        effect(
          (onCleanup) => {
            const query = `(max-width: ${(CARD_BREAKPOINTS[this.deps.breakpoint()] - 0.02).toString()}px)`;
            const subscription = breakpoints
              .observe(query)
              .pipe(takeUntilDestroyed(destroyRef))
              .subscribe((result) => {
                if (this.breakpointReads > 0) {
                  this.announceable = true;
                }
                this.breakpointReads += 1;
                this.narrow.set(result.matches);
              });
            onCleanup(() => {
              subscription.unsubscribe();
            });
          },
          { injector },
        );
      },
      { injector },
    );

    // Reports the change rather than the value, so a grid that never switches
    // announces nothing. Reading it here keeps the announcement out of the
    // template, where it would fire on every change detection pass.
    effect(
      () => {
        const view = this.view();
        untracked(() => {
          if (this.announceable && this.reported != null && this.reported !== view) {
            this.deps.onChanged(view);
          }
          this.reported = view;
        });
      },
      { injector },
    );
  }

  /** Switches the presentation by hand. Never persisted: see `datagrid.md`. */
  set(view: ResolvedDatagridView): void {
    // A press is an event whoever made it should hear reported back.
    this.announceable = true;
    this.override.set(view);
  }

  /** Whether a manual choice is in force. */
  overridden(): boolean {
    return this.override() != null;
  }
}

/** Pixel width of a breakpoint name, mirroring the core SCSS scale. */
export function breakpointWidth(name: DatagridBreakpoint): number {
  return CARD_BREAKPOINTS[name];
}
