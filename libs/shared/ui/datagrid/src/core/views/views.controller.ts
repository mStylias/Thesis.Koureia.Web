/**
 * Named views (§14.4), as a collaborator of the grid shell.
 *
 * The list, the selection, the editor and every write belong to
 * `SavedViewsController` in `@ui/saved-views`. This wrapper adds the two seams
 * the grid reaches it through: a {@link GridStatePersistence} that makes the
 * first data query wait for the document, and the toolbar entry that draws
 * the strip.
 */
import { computed, isDevMode, signal, type Type } from '@angular/core';
import { SavedViewsController } from '@ui/saved-views/core';
import { gridViewStatesEqual } from '../state';
import type { GridStatePersistence } from '../state-persistence.types';
import type { GridState } from '../types/state.types';
import type { ToolbarComponentRenderer } from '../toolbar.types';
import type { GridViewsControllerDeps } from './views.controller.types';
import type { GridTemporaryView } from '../../features.types';
import type { TemporarySavedView } from '@ui/saved-views/core';

export class GridViewsController {
  /** The generic controller the strip renders. */
  readonly views: SavedViewsController<GridState>;

  /** The strip's component, resolved by a dynamic import so it is not in every grid. */
  private readonly componentType = signal<Type<unknown> | null>(null);
  /** Built once: a fresh literal per change detection would churn the outlet's inputs. */
  private readonly inputs: Readonly<Record<string, unknown>>;
  private importing = false;

  constructor(private readonly deps: GridViewsControllerDeps) {
    this.views = new SavedViewsController<GridState>({
      ...deps,
      isState: isGridState,
      statesEqual: gridViewStatesEqual,
    });
    this.inputs = { controller: this.views };
  }

  /** The strip as a toolbar entry's renderer, or `null` until its chunk lands. */
  readonly renderer = computed<ToolbarComponentRenderer | null>(() => {
    const type = this.componentType();
    return type == null ? null : { type, inputs: this.inputs };
  });

  /**
   * The seam the grid's state sync uses.
   *
   * `load` answers with the first view's state, which is what makes the first
   * data query wait for the document — the content of a grid is a consequence
   * of its view, so it cannot go out first. `save` is deliberately inert:
   * views are saved when the user presses save, never as a side effect of
   * moving a column. `clear` is absent for the same reason, so resetting the
   * arrangement cannot destroy the saved views.
   */
  readonly persistence: GridStatePersistence = {
    load: async (key) => {
      void this.loadComponent();
      const temporary = this.deps.temporary();
      return await this.views.load(key, {
        temporary:
          temporary == null
            ? null
            : isPromiseLike(temporary)
              ? Promise.resolve(temporary).then((view) =>
                  view == null ? null : this.resolve(view),
                )
              : this.resolve(temporary),
      });
    },
    save: () => {
      // Views are saved explicitly. See above.
    },
  };

  /** Opens a temporary view while the grid is showing: one apply, so one query. */
  openTemporary(view: GridTemporaryView): void {
    this.views.openTemporary(this.resolve(view));
  }

  closeTemporary(): void {
    this.views.closeTemporary();
  }

  private resolve(view: GridTemporaryView): TemporarySavedView<GridState> {
    return {
      id: view.id,
      name: view.name,
      ...(view.description === undefined ? {} : { description: view.description }),
      ...(view.onLeave === undefined ? {} : { onLeave: view.onLeave }),
      state: view.state(this.deps.state()),
    };
  }

  /**
   * Pulls the strip's chunk in.
   *
   * A real split: `@ui/saved-views` is referenced statically nowhere in the
   * grid — the controller comes from `@ui/saved-views/core` — so a grid that
   * never turns views on downloads neither the strip nor the confirmation
   * dialog it opens.
   */
  private async loadComponent(): Promise<void> {
    if (this.importing || this.componentType() != null) {
      return;
    }
    this.importing = true;
    try {
      const module = await import('@ui/saved-views');
      if (!this.deps.isDestroyed()) {
        this.componentType.set(module.SavedViews);
      }
    } catch (cause) {
      if (isDevMode()) {
        console.warn('datagrid: could not load the views strip.', cause);
      }
    }
  }
}

function isPromiseLike<T>(value: T | PromiseLike<T>): value is PromiseLike<T> {
  return typeof (value as Partial<PromiseLike<T>>).then === 'function';
}

/** Whether a stored value has the two members every `GridState` carries. */
function isGridState(value: unknown): value is GridState {
  if (typeof value !== 'object' || value === null) {
    return false;
  }
  const candidate = value as Partial<GridState>;
  return typeof candidate.version === 'number' && Array.isArray(candidate.columns);
}
