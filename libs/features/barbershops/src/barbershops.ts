import {
  afterNextRender,
  ChangeDetectionStrategy,
  Component,
  computed,
  DestroyRef,
  effect,
  ElementRef,
  inject,
  linkedSignal,
  signal,
  viewChild,
} from '@angular/core';
import { BreakpointObserver } from '@angular/cdk/layout';
import { Location } from '@angular/common';
import { rxResource, takeUntilDestroyed, toObservable, toSignal } from '@angular/core/rxjs-interop';
import { provideTranslocoScope, TranslocoPipe } from '@jsverse/transloco';
import { LucideMap } from '@lucide/angular';
import { asHttpError } from '@synax/client';
import type { HttpError, Result } from '@synax/client/core';
import { Button } from '@ui/button';
import { Drawer } from '@ui/drawer';
import { Paginator, type PaginatorSection } from '@ui/paginator';
import { ActiveLanguage } from '@util/language';
import { debounceTime } from 'rxjs';

import { BarbershopCard } from './barbershop-card/barbershop-card';
import { BarbershopsFilters } from './barbershops-filters/barbershops-filters';
import { BarbershopsList } from './barbershops-list/barbershops-list';
import { BarbershopsMap } from './barbershops-map/barbershops-map';
import { BarbershopsMapSkeleton } from './barbershops-map-skeleton/barbershops-map-skeleton';
import { barbershopsTranslocoScope } from './barbershops.i18n';
import { BarbershopsApi, isFiltered, NO_FILTERS } from './data/barbershops.api';
import type {
  CompanyCardResponse,
  BarbershopFilters,
  SearchOrigin,
} from './data/barbershops.api.types';

/** How many cards a page shows. The API returns the whole set; the slicing happens here. */
const PAGE_SIZE = 20;

/** How long typing settles before a filter reaches the API. */
const FILTER_DEBOUNCE_MS = 300;

const PAGINATOR_LAYOUT: readonly PaginatorSection[] = [
  'prev',
  'pages',
  'next',
  'currentReport',
] as const;

/**
 * Where the map earns a column of its own.
 *
 * `1024px` is `lg` in `libs/shared/styles/src/abstracts/_scale.scss`, repeated here because a
 * Sass map is not readable at runtime and `BreakpointObserver` resolves in TypeScript. The two
 * are kept equal by hand, which is why the source is named — see `CARD_BREAKPOINTS`, which
 * does the same for the datagrid.
 */
const MAP_COLUMN_QUERY = '(min-width: 1024px)';

@Component({
  selector: 'lib-barbershops',
  imports: [
    BarbershopCard,
    BarbershopsFilters,
    BarbershopsList,
    BarbershopsMap,
    BarbershopsMapSkeleton,
    Button,
    Drawer,
    LucideMap,
    Paginator,
    TranslocoPipe,
  ],
  templateUrl: './barbershops.html',
  styleUrl: './barbershops.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
  providers: [provideTranslocoScope(barbershopsTranslocoScope)],
})
export class Barbershops {
  private readonly api = inject(BarbershopsApi);
  private readonly language = inject(ActiveLanguage).value;
  private readonly results = viewChild<ElementRef<HTMLElement>>('results');

  protected readonly pageSize = PAGE_SIZE;
  protected readonly paginatorLayout = PAGINATOR_LAYOUT;

  protected readonly filters = signal<BarbershopFilters>(NO_FILTERS);

  /**
   * The filters the API is actually asked for.
   *
   * `equal` is what keeps the debounce from issuing the first query twice: `toObservable`
   * replays the current value, so the initial filters arrive again as a fresh object once the
   * delay elapses. Without the comparison that second, identical object reloads the list.
   */
  private readonly query = toSignal(
    toObservable(this.filters).pipe(debounceTime(FILTER_DEBOUNCE_MS)),
    { initialValue: NO_FILTERS, equal: sameFilters },
  );

  private readonly shops = rxResource({
    params: () => ({ filters: this.query(), language: this.language() }),
    stream: ({ params }) => this.api.list(params.filters, params.language),
  });

  /**
   * Every shop the filters matched, whatever page is showing.
   *
   * The map draws this, not {@link pageItems}: paging is a reading aid for the list and must
   * not take markers off the map.
   *
   * It keeps the previous answer while the next one loads. The resource clears its value when
   * the query changes, and the list covers that with skeletons — but the map would drop every
   * pin and draw it again, which is a flash on a map that did not move.
   */
  protected readonly all = linkedSignal<
    Result<CompanyCardResponse[]> | undefined,
    readonly CompanyCardResponse[]
  >({
    source: () => this.shops.value(),
    computation: (result, previous) => {
      if (result === undefined) return previous?.value ?? [];
      return result.isSuccess ? (result.data ?? []) : [];
    },
  });

  /**
   * Whether the list has nothing to show but a wait.
   *
   * Only the first answer earns skeletons. A refinement keeps the cards already on screen —
   * `all` holds the previous answer — because swapping a full grid for skeletons and back is
   * two layout jolts for a request that usually returns most of the same shops.
   */
  protected readonly loading = computed(() => this.shops.isLoading() && this.all().length === 0);

  /** A newer answer is on its way while the current one is still readable. */
  protected readonly refreshing = computed(() => this.shops.isLoading() && this.all().length > 0);

  /**
   * The failure to report.
   *
   * An HTTP failure arrives as a value, because the service maps it to a `Result`. Only a
   * programming error reaches the resource's own error channel, so both are read.
   */
  protected readonly error = computed<HttpError | null>(() => {
    const thrown = asHttpError(this.shops.error());
    if (thrown !== null) return thrown;

    const result = this.shops.value();
    return result?.isFailure ? result.error : null;
  });

  protected readonly filtered = computed(() => isFiltered(this.query()));

  /**
   * The page being read, 1-based.
   *
   * It returns to the first page whenever the query changes. A filter that shortens the list
   * would otherwise strand the reader on a page that no longer has anything on it.
   */
  protected readonly page = linkedSignal({ source: this.query, computation: () => 1 });

  protected readonly pageItems = computed<readonly CompanyCardResponse[]>(() => {
    const start = (this.page() - 1) * PAGE_SIZE;
    return this.all().slice(start, start + PAGE_SIZE);
  });

  /** The shop whose popup is open. One value for both maps; only one of them ever exists. */
  protected readonly selectedShopId = signal<string | null>(null);

  /** The small-screen map panel. */
  protected readonly mapOpen = signal(false);

  /**
   * Whether the layout has a column for the map.
   *
   * It gates the `@defer` and nothing else, so the markup is the same on both sides of
   * hydration. It starts `false` and is answered in the browser: `matchMedia` has no answer
   * during a server render, and a guess baked into the HTML would be wrong for half the
   * visitors.
   */
  protected readonly mapInPage = signal(false);

  private readonly location = inject(Location);

  /** Whether the panel's own history entry is still on the stack. */
  private mapEntry = false;

  constructor() {
    const breakpoints = inject(BreakpointObserver);
    const destroyRef = inject(DestroyRef);

    // The panel is a screen, not a control on this one: on a phone it covers everything, so the
    // back gesture has to close it rather than leave the page. It gets a history entry of its
    // own, at the same URL — nothing changes in the address bar, and the router ignores a pop
    // to the URL it is already on — and whatever closes the panel spends that entry again.
    const popped = this.location.subscribe(() => {
      if (!this.mapEntry) return;
      this.mapEntry = false;
      this.mapOpen.set(false);
    });
    destroyRef.onDestroy(() => {
      popped.unsubscribe();
    });

    effect(() => {
      const open = this.mapOpen();

      if (open && !this.mapEntry) {
        // `go` with the URL it is already on: a push, not a route change. `Location.subscribe`
        // hears pops only, so this cannot feed itself.
        this.location.go(this.location.path(true));
        this.mapEntry = true;
        return;
      }

      // Closing by hand — the drawer's own button, Escape, the backdrop, or crossing up into
      // the two-column layout. The entry goes back the way it came, or the next back gesture
      // would land on a panel that is already shut.
      if (!open && this.mapEntry) {
        this.mapEntry = false;
        this.location.back();
      }
    });

    afterNextRender(() => {
      breakpoints
        .observe(MAP_COLUMN_QUERY)
        .pipe(takeUntilDestroyed(destroyRef))
        .subscribe((state) => {
          this.mapInPage.set(state.matches);
          // Crossing back up closes the panel. Leaving it open would hold the scroll lock over
          // a layout that now shows the map beside the list anyway.
          if (state.matches) this.mapOpen.set(false);
        });
    });
  }

  protected reload(): void {
    this.shops.reload();
  }

  protected clearFilters(): void {
    this.filters.set(NO_FILTERS);
  }

  /**
   * Brings the top of the results back into view after a page change.
   *
   * The page scrolls as one document, so landing halfway down the next page reads as nothing
   * having happened. Only a user gesture reaches this, so there is no server render to guard.
   */
  protected scrollToResults(): void {
    this.results()?.nativeElement.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  protected openMap(): void {
    this.mapOpen.set(true);
  }

  /**
   * Points one shop out on the map.
   *
   * The map is what selection means, so where there is no map column the panel opens first.
   * The selection is set either way: the panel's map reads it as it comes up, and opens the
   * popup itself.
   */
  protected locateShop(shop: CompanyCardResponse): void {
    this.selectedShopId.set(shop.id);
    if (!this.mapInPage()) {
      this.mapOpen.set(true);
    }
  }
}

/** Whether two filter sets ask the same question. */
function sameFilters(a: BarbershopFilters, b: BarbershopFilters): boolean {
  return a.name === b.name && a.date === b.date && sameOrigin(a.origin, b.origin);
}

/**
 * Whether two origins are the same point.
 *
 * Compared by value, not identity: every filter edit rebuilds the set, so the same chosen place
 * arrives as a new object each time and reference equality would reload the list on every
 * keystroke in the name field.
 */
function sameOrigin(a: SearchOrigin | null, b: SearchOrigin | null): boolean {
  if (a === null || b === null) return a === b;
  return a.latitude === b.latitude && a.longitude === b.longitude;
}
