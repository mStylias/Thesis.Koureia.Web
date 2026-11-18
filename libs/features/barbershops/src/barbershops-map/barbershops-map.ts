import {
  afterNextRender,
  ApplicationRef,
  ChangeDetectionStrategy,
  Component,
  createComponent,
  DestroyRef,
  EnvironmentInjector,
  effect,
  ElementRef,
  EmbeddedViewRef,
  inject,
  input,
  model,
  signal,
  TemplateRef,
  untracked,
  viewChild,
} from '@angular/core';
import { TranslocoPipe } from '@jsverse/transloco';
import { LucideMaximize } from '@lucide/angular';
import { Banner } from '@ui/banner';
import { Button } from '@ui/button';
import { Tooltip } from '@ui/tooltip';
import type { ComponentRef } from '@angular/core';
import type { Map as MapLibreMap, Marker, Popup } from 'maplibre-gl';
import { BarbershopMarker } from '../barbershop-marker/barbershop-marker';
import { BarbershopsMapSkeleton } from '../barbershops-map-skeleton/barbershops-map-skeleton';
import { CARD_ENTER_TOTAL_MS } from '../card-choreography';
import type { SearchOrigin } from '../data/barbershops.api.types';
import { OriginMarker } from '../origin-marker/origin-marker';
import type { MapShop, MapStatus, ShopMarker } from './barbershops-map.types';

const OPENFREEMAP_STYLE = 'https://tiles.openfreemap.org/styles/liberty';
const ATHENS_CENTER: [longitude: number, latitude: number] = [23.7275, 37.9838];

/**
 * Where the app serves MapLibre's worker from — copied out of the package by the `assets`
 * entries in the app's `project.json`.
 *
 * MapLibre 6 ships the worker as a separate module rather than inlining it, and resolves it
 * from its own `import.meta.url`. Bundled into an app chunk, that resolves to a file next to
 * the chunk that nothing emitted: the request 404s, no tile ever gets parsed, and the map sits
 * on its skeleton forever without raising `error`. Stating the URL is the supported way to
 * point it at the copy that does exist.
 *
 * The globs end in `*` to bring the `.mjs.map` files with them. Both modules end with a
 * `sourceMappingURL` comment, and without the map beside it the browser requests one, receives
 * the 404 page, and prints "Could not read source map" on every load.
 */
const MAPLIBRE_WORKER_URL = '/maplibre/maplibre-gl-worker.mjs';

/** Room around the fitted bounds, so no pin sits under the map chrome. */
const FIT_PADDING = 48;

/** How far a fit may zoom in. One shop alone would otherwise fill the view with one street. */
const FIT_MAX_ZOOM = 14;

/** The zoom a focused map opens at: one street and the ones around it. */
const FOCUS_ZOOM = 16;

/** The zoom an unfocused map opens at, before the first fit. */
const OVERVIEW_ZOOM = 12;

/** Pixels between the pin and its popup, so the popup clears the pin it belongs to. */
const POPUP_OFFSET = 16;

@Component({
  selector: 'lib-barbershops-map',
  imports: [Banner, Button, BarbershopsMapSkeleton, LucideMaximize, Tooltip, TranslocoPipe],
  templateUrl: './barbershops-map.html',
  styleUrl: './barbershops-map.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class BarbershopsMap {
  private readonly mapContainer = viewChild.required<ElementRef<HTMLElement>>('mapContainer');
  private readonly destroyRef = inject(DestroyRef);
  private readonly appRef = inject(ApplicationRef);
  private readonly environmentInjector = inject(EnvironmentInjector);

  private map?: MapLibreMap;
  private popup?: Popup;
  private popupView?: EmbeddedViewRef<{ $implicit: MapShop }>;
  private readonly markers = new Map<string, ShopMarker>();
  private originMarker?: Marker;
  private originRef?: ComponentRef<OriginMarker>;

  /** Where the origin pin currently sits, so a label edit alone does not move the camera. */
  private originAt = '';

  /**
   * The result set the view was last framed for, as its ids.
   *
   * A new set is a new frame: filtering to three shops must bring those three into view. The
   * signature is what keeps a pan from being undone — the effect re-runs for reasons other
   * than the results changing, and refitting then would move the map out from under whoever
   * had just moved it.
   */
  private framedFor = '';

  /** Ends a pending wait for the cards, so teardown never leaves a timer running. */
  private cancelSettle?: () => void;

  /** Every shop to pin. The page hands over the whole result set, not the visible page. */
  readonly shops = input<readonly MapShop[]>([]);

  /** What a marker's popup renders. Declared by the page, so the card markup stays with it. */
  readonly popupTemplate = input<TemplateRef<{ $implicit: MapShop }> | undefined>(undefined);

  /** The shop whose popup is open. Two-way, so the page can open and close one itself. */
  readonly selectedId = model<string | null>(null);

  /**
   * The point the list is ordered from, or `null` for the API's own default.
   *
   * Setting one pins it and pans to it. It also **takes the camera off automatic framing**:
   * the visitor has said where to look from, and a fit to every marker on the next filter
   * change would move the view off it. The recenter button is the way back.
   */
  readonly origin = input<SearchOrigin | null>(null);

  /** What the origin pin reads. The page resolves it, because the device fix has no name. */
  readonly originLabel = input('');

  /**
   * One shop the map is about, or `null` for a map of the whole result set.
   *
   * A focused map opens on that shop at street level and never frames itself again, so it does
   * not wait for cards or fit to its pins, and it offers no recenter control.
   */
  readonly focus = input<MapShop | null>(null);

  protected readonly status = signal<MapStatus>('loading');

  constructor() {
    afterNextRender(() => {
      void this.initializeMap();
    });

    // `status` is read first on purpose: it is the signal that flips once `map` exists, so
    // this re-runs the moment there is something to draw on.
    effect(() => {
      const ready = this.status() === 'ready';
      const shops = this.shops();
      if (!ready) return;

      untracked(() => void this.syncMarkers(shops));
    });

    effect(() => {
      const selected = this.selectedId();
      const ready = this.status() === 'ready';
      const shops = this.shops();
      if (!ready) return;

      untracked(() => void this.syncPopup(shops.find((shop) => shop.id === selected) ?? null));
    });

    effect(() => {
      const origin = this.origin();
      const label = this.originLabel();
      const ready = this.status() === 'ready';
      if (!ready) return;

      untracked(() => void this.syncOrigin(origin, label));
    });

    this.destroyRef.onDestroy(() => {
      this.cancelSettle?.();
      this.closePopup();
      this.removeOrigin();
      for (const entry of this.markers.values()) {
        entry.marker.remove();
        this.appRef.detachView(entry.ref.hostView);
        entry.ref.destroy();
      }
      this.markers.clear();
      this.map?.remove();
    });
  }

  /**
   * Brings every pin back into view, the origin among them.
   *
   * A gesture, so it waits for nothing: the cards are long settled by the time anyone reaches
   * for this, and a control that pauses before it moves reads as broken.
   */
  protected recenter(): void {
    const shops = this.shops();
    if (shops.length === 0) return;

    void this.fit(shops, this.origin());
  }

  private async initializeMap(): Promise<void> {
    try {
      const { Map, NavigationControl, setWorkerUrl } = await import('maplibre-gl');

      if (this.destroyRef.destroyed) {
        return;
      }

      setWorkerUrl(MAPLIBRE_WORKER_URL);

      const focus = this.focus();
      const map = new Map({
        container: this.mapContainer().nativeElement,
        style: OPENFREEMAP_STYLE,
        center: focus === null ? ATHENS_CENTER : [focus.longitude, focus.latitude],
        zoom: focus === null ? OVERVIEW_ZOOM : FOCUS_ZOOM,
        // Collapsed to an expandable ⓘ button; required OSM/OpenFreeMap
        // attribution stays reachable without covering the map on load.
        attributionControl: { compact: true },
      });

      this.map = map;
      map.addControl(new NavigationControl({ showCompass: false }), 'top-right');
      void map.once('load', () => {
        this.status.set('ready');
      });
      void map.once('error', () => {
        if (this.status() === 'loading') {
          this.status.set('error');
        }
      });
    } catch {
      this.status.set('error');
    }
  }

  /**
   * Brings the pins in step with `shops`, by id.
   *
   * Add, remove, keep — never rebuild. Replacing every marker on each filter change closes the
   * open popup and flashes the whole layer, which is visible on a map that did not move.
   */
  private async syncMarkers(shops: readonly MapShop[]): Promise<void> {
    const map = this.map;
    if (!map) return;

    const { Marker } = await import('maplibre-gl');
    if (this.destroyRef.destroyed) return;

    const wanted = new Set(shops.map((shop) => shop.id));

    for (const [id, entry] of this.markers) {
      if (wanted.has(id)) continue;
      entry.marker.remove();
      this.appRef.detachView(entry.ref.hostView);
      entry.ref.destroy();
      this.markers.delete(id);
    }

    for (const shop of shops) {
      const existing = this.markers.get(shop.id);
      if (existing) {
        existing.marker.setLngLat([shop.longitude, shop.latitude]);
        existing.ref.setInput('name', shop.name);
        continue;
      }

      // Created detached and registered with `ApplicationRef`, never through a
      // `ViewContainerRef`. MapLibre owns where the element goes, so there is no container
      // position to hold — and a container would be actively wrong: destroying one of its
      // views by hand corrupts its bookkeeping and takes the neighbouring views with it.
      const ref = createComponent(BarbershopMarker, {
        environmentInjector: this.environmentInjector,
      });
      this.appRef.attachView(ref.hostView);
      ref.setInput('name', shop.name);

      // Tied to the ref, not left to the output's own teardown: the subscription outlives the
      // component otherwise, and a click arriving on a pin already taken off the map emits into
      // a destroyed output.
      const activation = ref.instance.activate.subscribe(() => {
        this.selectedId.update((open) => (open === shop.id ? null : shop.id));
      });
      ref.onDestroy(() => {
        activation.unsubscribe();
      });

      // `ComponentRef.location` is an `ElementRef<any>`; the marker option wants an element.
      const element = ref.location.nativeElement as HTMLElement;
      const marker = new Marker({ element }).setLngLat([shop.longitude, shop.latitude]).addTo(map);

      this.markers.set(shop.id, { marker, ref });
    }

    this.paintSelection();

    const signature = shops.map((shop) => shop.id).join();
    if (signature === this.framedFor) return;

    this.framedFor = signature;
    if (shops.length === 0) return;

    // A focused map opened on its shop and keeps the camera where the visitor puts it.
    if (this.focus() !== null) return;

    // An origin owns the camera. Setting one reorders the whole list, so the signature above
    // changes on the very interaction that just panned to the origin — fitting here would
    // undo it in the same breath.
    if (this.origin() !== null) return;

    await this.settleCards();

    // A newer result set may have arrived during the wait. It carries its own fit, and `fit`
    // checks the teardown itself.
    if (this.framedFor !== signature) return;

    // An open popup outranks the frame. `syncPopup` centres on the chosen shop, and a fit
    // landing after it would pull that shop back out to the edge — or off screen. The set
    // counts as framed either way, so closing the popup does not set the camera moving again.
    if (this.selectedId() !== null) return;

    await this.fit(shops);
  }

  /**
   * Waits out the list's card entrance.
   *
   * The same filter change starts both, and a camera flying while cards are still arriving reads
   * as two unrelated things happening at once. The map is the larger surface, so it goes second
   * rather than sharing the frame. Reduced motion removes the entrance, so nothing is left to
   * wait for and the fit stays immediate.
   */
  private settleCards(): Promise<void> {
    this.cancelSettle?.();

    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      return Promise.resolve();
    }

    return new Promise<void>((resolve) => {
      const timer = setTimeout(resolve, CARD_ENTER_TOTAL_MS);
      this.cancelSettle = () => {
        clearTimeout(timer);
        resolve();
      };
    });
  }

  private async fit(shops: readonly MapShop[], origin: SearchOrigin | null = null): Promise<void> {
    const map = this.map;
    if (!map) return;

    const { LngLatBounds } = await import('maplibre-gl');
    if (this.destroyRef.destroyed) return;

    const bounds = new LngLatBounds();
    for (const shop of shops) {
      bounds.extend([shop.longitude, shop.latitude]);
    }
    if (origin !== null) {
      bounds.extend([origin.longitude, origin.latitude]);
    }

    map.fitBounds(bounds, { padding: FIT_PADDING, maxZoom: FIT_MAX_ZOOM });
  }

  /**
   * Pins the origin and pans to it.
   *
   * `easeTo` with a centre and no zoom: the zoom is the visitor's and only the centre moves.
   * The pan is skipped when only the label changed, so re-rendering the pin does not drag a
   * map the visitor has since moved.
   */
  private async syncOrigin(origin: SearchOrigin | null, label: string): Promise<void> {
    const map = this.map;
    if (!map) return;

    if (origin === null) {
      this.removeOrigin();
      return;
    }

    const { Marker } = await import('maplibre-gl');
    if (this.destroyRef.destroyed) return;

    const position: [longitude: number, latitude: number] = [origin.longitude, origin.latitude];

    if (this.originRef === undefined) {
      // Detached and registered with `ApplicationRef`, for the reason `syncMarkers` gives.
      const ref = createComponent(OriginMarker, {
        environmentInjector: this.environmentInjector,
      });
      this.appRef.attachView(ref.hostView);
      this.originRef = ref;
      const element = ref.location.nativeElement as HTMLElement;
      this.originMarker = new Marker({ element }).setLngLat(position).addTo(map);
    }

    this.originRef.setInput('label', label);
    this.originMarker?.setLngLat(position);

    const at = position.join();
    if (at === this.originAt) return;

    this.originAt = at;
    map.easeTo({ center: position });
  }

  private removeOrigin(): void {
    this.originAt = '';
    this.originMarker?.remove();
    this.originMarker = undefined;
    if (this.originRef === undefined) return;

    this.appRef.detachView(this.originRef.hostView);
    this.originRef.destroy();
    this.originRef = undefined;
  }

  /** Opens the chosen shop's popup, or closes whatever is open when nothing is chosen. */
  private async syncPopup(shop: MapShop | null): Promise<void> {
    const map = this.map;
    const template = this.popupTemplate();
    this.paintSelection();

    if (map === undefined || shop === null || template === undefined) {
      this.closePopup();
      return;
    }

    const { Popup } = await import('maplibre-gl');
    if (this.destroyRef.destroyed) return;

    // The old view goes before the new one, so a popup swapped between two shops never leaves
    // a view attached to the application.
    this.destroyPopupView();

    const view = template.createEmbeddedView({ $implicit: shop });
    this.appRef.attachView(view);
    view.detectChanges();

    const host = document.createElement('div');
    host.className = 'shop-popup';
    for (const node of view.rootNodes as Node[]) {
      host.append(node);
    }
    this.popupView = view;

    // One popup for the life of the map. `on` returns a subscription rather than the popup, so
    // it cannot be chained onto the construction.
    if (this.popup === undefined) {
      const popup = new Popup({
        closeButton: true,
        // A click anywhere else on the map dismisses it. Marker clicks do not reach the map —
        // see `BarbershopMarker.onActivate`.
        closeOnClick: true,
        offset: POPUP_OFFSET,
        // CSS owns the width. MapLibre's own cap is 240px, and a card wider than that would
        // paint outside the box the anchor was computed from — which is how a popup ends up
        // half off the screen.
        maxWidth: 'none',
      });
      popup.on('close', () => {
        // Teardown closes the popup too, and MapLibre raises `close` for that as much as for a
        // dismissal. Writing the model then emits into an output the framework has already
        // destroyed.
        if (this.destroyRef.destroyed) return;
        this.selectedId.set(null);
      });
      this.popup = popup;
    }

    const popup = this.popup;
    popup.setLngLat([shop.longitude, shop.latitude]).setDOMContent(host);

    // `addTo` on an open popup removes it first, and removing fires `close` — which would
    // clear the very selection being made, so switching pins would shut the popup and open
    // nothing. An open popup only has to be moved.
    if (!popup.isOpen()) {
      popup.addTo(map);
    }

    // MapLibre chooses the popup's anchor from where the pin sits and never pans to fit, so the
    // camera must make the room. The popup re-anchors on every frame of the pan. Camera
    // animations already honour `prefers-reduced-motion`.
    map.easeTo({
      center: [shop.longitude, shop.latitude],
      offset: [0, this.popupRoom(popup, shop.id)],
    });
  }

  /**
   * How far above the middle the pin must sit for its popup to fit, in pixels.
   *
   * A centred pin leaves half the map for the popup, and MapLibre opens it above the pin when it
   * fits there. A taller popup opens below the pin and runs off the bottom edge. Centre the pin
   * and the popup as one block instead, and keep the pin in view when the block is taller than
   * the map.
   */
  private popupRoom(popup: Popup, shopId: string): number {
    const mapHeight = this.mapContainer().nativeElement.clientHeight;
    const popupHeight = popup.getElement().offsetHeight;
    if (popupHeight <= mapHeight / 2 - POPUP_OFFSET) return 0;

    const pin = this.markers.get(shopId)?.ref.location.nativeElement as HTMLElement | undefined;
    const pinHalf = (pin?.offsetHeight ?? 0) / 2;
    const block = pinHalf + POPUP_OFFSET + popupHeight;
    const pinY = Math.max((mapHeight - block) / 2, 0) + pinHalf;
    return pinY - mapHeight / 2;
  }

  private closePopup(): void {
    this.popup?.remove();
    this.destroyPopupView();
  }

  private destroyPopupView(): void {
    if (this.popupView === undefined) return;
    this.appRef.detachView(this.popupView);
    this.popupView.destroy();
    this.popupView = undefined;
  }

  private paintSelection(): void {
    const selected = this.selectedId();
    for (const [id, entry] of this.markers) {
      entry.ref.setInput('selected', id === selected);
    }
  }
}
