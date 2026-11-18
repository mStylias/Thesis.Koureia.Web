/**
 * The view list as plain data.
 *
 * Every rule that decides what the list becomes lives here, with no signals and
 * no storage, so the whole of "what does duplicate name it" and "where does a
 * drop land" is unit-tested without a view. The controller owns the async half
 * and nothing else.
 */
import type { SavedView, SavedViewsDocument } from './saved-views.types';

/** Current schema version of {@link SavedViewsDocument}. */
export const SAVED_VIEWS_VERSION = 1;

/**
 * The document key of a host.
 *
 * The host names itself (`roles_main_grid`, `calendar_main`) and the library
 * appends the resource kind, so the "ends at the type of resource" half of the
 * convention cannot be spelled two ways on two screens.
 */
export function savedViewsResourceKey(hostKey: string): string {
  return `${hostKey}_views`;
}

/**
 * How long a view name may be.
 *
 * A product decision, not a backend one: the name lives inside the resource's
 * `value`, which the backend never reads, so nothing but the strip constrains
 * it. A tab is scanned in a row of tabs, and a name past this length is being
 * used as a description — the strip truncates what it draws either way.
 */
export const VIEW_NAME_MAX_LENGTH = 50;

/**
 * A new view id.
 *
 * `crypto.randomUUID` where the platform has it. The fallback is only reached
 * in an insecure context and during server rendering, and it still has to be
 * collision-safe against ids **already stored**, so it mixes the clock in
 * rather than counting from zero each session.
 */
export function createViewId(): string {
  const uuid = globalThis.crypto as { randomUUID?: () => string } | undefined;
  if (typeof uuid?.randomUUID === 'function') {
    return uuid.randomUUID();
  }
  return `view-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

/** Trims and caps a typed name. Empty after trimming means "not a name". */
export function normalizeViewName(name: string): string {
  return name.trim().slice(0, VIEW_NAME_MAX_LENGTH);
}

/** Whether a typed name can be saved. */
export function isValidViewName(name: string): boolean {
  return normalizeViewName(name).length > 0;
}

/**
 * A name not already in the list: `Name`, then `Name (2)`, `Name (3)`.
 *
 * The backend allows duplicate names and the UI keys on id, so this is a
 * courtesy rather than a constraint — two tabs reading the same word are
 * indistinguishable to the person looking at them, which is the real problem.
 */
export function uniqueViewName(views: readonly SavedView<unknown>[], base: string): string {
  const taken = new Set(views.map((view) => view.name));
  if (!taken.has(base)) {
    return base;
  }
  for (let suffix = 2; ; suffix += 1) {
    const candidate = `${base} (${suffix.toString()})`;
    if (!taken.has(candidate)) {
      return candidate;
    }
  }
}

/** The list with `view` appended. */
export function addView<TState>(
  views: readonly SavedView<TState>[],
  view: SavedView<TState>,
): SavedView<TState>[] {
  return [...views, view];
}

/** The list with `id` removed. Unknown ids are left alone. */
export function removeView<TState>(
  views: readonly SavedView<TState>[],
  id: string,
): SavedView<TState>[] {
  return views.filter((view) => view.id !== id);
}

/** The list with one view's members replaced. Unknown ids are left alone. */
export function updateView<TState>(
  views: readonly SavedView<TState>[],
  id: string,
  changes: Partial<Omit<SavedView<TState>, 'id'>>,
): SavedView<TState>[] {
  return views.map((view) => (view.id === id ? { ...view, ...changes } : view));
}

/**
 * `id` inserted directly after `afterId`, or appended when that is unknown.
 * A duplicate belongs beside its original, not at the end of a long strip.
 */
export function insertViewAfter<TState>(
  views: readonly SavedView<TState>[],
  afterId: string,
  view: SavedView<TState>,
): SavedView<TState>[] {
  const index = views.findIndex((entry) => entry.id === afterId);
  if (index < 0) {
    return addView(views, view);
  }
  return [...views.slice(0, index + 1), view, ...views.slice(index + 1)];
}

/**
 * `id` moved to `toIndex`, with the rest closing the gap.
 *
 * The index is clamped rather than refused: a drag past the last tab means the
 * end of the strip, which is what the pointer is over.
 */
export function moveView<TState>(
  views: readonly SavedView<TState>[],
  id: string,
  toIndex: number,
): SavedView<TState>[] {
  const from = views.findIndex((view) => view.id === id);
  if (from < 0) {
    return [...views];
  }
  const target = Math.min(Math.max(toIndex, 0), views.length - 1);
  if (target === from) {
    return [...views];
  }
  const next = [...views];
  const moved = next.splice(from, 1);
  next.splice(target, 0, ...moved);
  return next;
}

/**
 * `id` moved to the front, which is the whole of "set as default": the first
 * view is what a fresh load applies, so being default is a position.
 */
export function setDefaultView<TState>(
  views: readonly SavedView<TState>[],
  id: string,
): SavedView<TState>[] {
  return moveView(views, id, 0);
}

/** A copy of `id`, named apart from every existing view. */
export function duplicateView<TState>(
  views: readonly SavedView<TState>[],
  id: string,
): SavedView<TState>[] {
  const source = views.find((view) => view.id === id);
  if (source === undefined) {
    return [...views];
  }
  return insertViewAfter(views, id, {
    id: createViewId(),
    name: uniqueViewName(views, source.name),
    state: source.state,
  });
}

/**
 * Where a drag holding the tab at `fromIndex` over `dragged` should put it.
 *
 * The **leading and trailing edges** decide, never the centre, and that is not
 * a refinement: a tab wider than its neighbour can never move its own centre
 * past that neighbour's centre once the drag is clamped to the strip, so the
 * widest tab could not be dropped last. Covering half of the neighbour is the
 * rule instead — trailing edge past its centre going right, leading edge past
 * it going left — which every pair of widths can satisfy.
 *
 * One swap per crossing, never on contact: a narrow tab dropped onto a wide
 * one leaves the pointer inside the wide tab after it moves aside, and on
 * contact the pair oscillates for as long as the pointer rests there. Only the
 * neighbour in the direction of travel is tested, so a tab spanning both
 * cannot swap two ways at once.
 *
 * `centers` are the tab centres in strip order, in the same coordinate space
 * as `dragged`, and `centers[fromIndex]` is the slot the dragged tab is
 * travelling away from.
 */
export function viewDropIndex(
  centers: readonly number[],
  dragged: { readonly start: number; readonly end: number },
  fromIndex: number,
): number {
  const slot = centers.at(fromIndex);
  if (slot === undefined) {
    return fromIndex;
  }
  if ((dragged.start + dragged.end) / 2 > slot) {
    const next = fromIndex + 1 < centers.length ? centers.at(fromIndex + 1) : undefined;
    return next !== undefined && dragged.end > next ? fromIndex + 1 : fromIndex;
  }
  const previous = fromIndex > 0 ? centers.at(fromIndex - 1) : undefined;
  return previous !== undefined && dragged.start < previous ? fromIndex - 1 : fromIndex;
}

/** A document holding `views`, at the current schema version. */
export function savedViewsDocument<TState>(
  views: readonly SavedView<TState>[],
): SavedViewsDocument<TState> {
  return { version: SAVED_VIEWS_VERSION, views: [...views] };
}

/**
 * The views of a loaded document, or `null` when it cannot be read.
 *
 * A document from another version is discarded rather than guessed at: the
 * views are the user's saved arrangements, and half-applying one is worse than
 * starting from none.
 *
 * Checks the envelope only. Each view's `state` is an opaque object here, and
 * the controller that loads it asks the host whether it is one it can apply.
 */
export function readSavedViewsDocument(value: unknown): SavedView<unknown>[] | null {
  if (typeof value !== 'object' || value === null) {
    return null;
  }
  const candidate = value as Partial<SavedViewsDocument<unknown>>;
  if (candidate.version !== SAVED_VIEWS_VERSION || !Array.isArray(candidate.views)) {
    return null;
  }
  return candidate.views.filter(isSavedView).map((view) => ({
    id: view.id,
    name: view.name,
    state: view.state,
  }));
}

function isSavedView(value: unknown): value is SavedView<unknown> {
  if (typeof value !== 'object' || value === null) {
    return false;
  }
  const candidate = value as Partial<SavedView<unknown>>;
  return (
    typeof candidate.id === 'string' &&
    typeof candidate.name === 'string' &&
    typeof candidate.state === 'object' &&
    candidate.state !== null
  );
}
