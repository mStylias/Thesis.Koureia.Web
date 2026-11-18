import {
  afterNextRender,
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  inject,
  LOCALE_ID,
  model,
  signal,
} from '@angular/core';
import { TranslocoPipe } from '@jsverse/transloco';
import { LucideCrosshair, LucideMapPin, LucideSearch } from '@lucide/angular';
import { Autocomplete, AutocompleteOptionTemplate } from '@ui/autocomplete';
import type { AutocompleteSelection } from '@ui/autocomplete';
import type { DataKey } from '@ui/data-source';
import { DatePicker, todayLocal, type DateValue } from '@ui/date-picker';
import { IconField, InputIcon, InputText } from '@ui/input-text';
import { ActiveLanguage } from '@util/language';

import type { BarbershopFilters, SearchOrigin } from '../data/barbershops.api.types';
import { DeviceLocationError, DeviceLocator } from '../data/device-location';
import type { DeviceLocationFailure } from '../data/device-location.types';
import { createPlaceSource, MIN_PLACE_QUERY_LENGTH, PlacesApi } from '../data/places.api';
import type { PlaceSuggestionResponse } from '../data/places.api.types';
import { ReplayOnChange } from '../replay-on-change';

/**
 * How long typing settles before a place search is sent.
 *
 * Paired with the endpoint's limit of three searches a second: one person typing without pause
 * produces at most 2.94, so the limit sits just above a legitimate typist and well below a
 * script. Changing one without the other breaks that.
 */
const LOCATION_DEBOUNCE_MS = 340;

/**
 * The filter and ordering bar.
 *
 * It owns no query of its own: it writes the filter set and the page decides what that costs.
 * Debouncing the list lives there too, because the page is what issues the request. The place
 * search is the exception — it is this bar's own request, so its delay is here.
 */
@Component({
  selector: 'lib-barbershops-filters',
  imports: [
    Autocomplete,
    AutocompleteOptionTemplate,
    DatePicker,
    IconField,
    InputIcon,
    InputText,
    LucideSearch,
    ReplayOnChange,
    TranslocoPipe,
  ],
  templateUrl: './barbershops-filters.html',
  styleUrl: './barbershops-filters.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class BarbershopsFilters {
  readonly filters = model.required<BarbershopFilters>();

  /**
   * The locale the page is published in.
   *
   * Stated rather than left to the picker's default, which is the browser's first configured
   * language once hydration has run. On a Greek page in an English browser that reads the
   * field as `mm/dd/yyyy`, and it changes shape after hydration. `LOCALE_ID` is the same
   * locale every date pipe on the page uses — see `provideAppLanguage`.
   */
  protected readonly locale = inject(LOCALE_ID);

  /**
   * The earliest bookable day.
   *
   * The API rejects a past date with a `400`, so the picker refuses it first — a control that
   * offers a value the server will not take is a trap.
   */
  protected readonly today = todayLocal();

  /** The picker writes `''` for empty; the filter set carries `null`. */
  protected readonly date = computed(() => this.filters().date ?? '');

  private readonly locator = inject(DeviceLocator);
  private readonly language = inject(ActiveLanguage).value;

  /** Built once: swapping `source` resets the control's loaded rows and its cached selection. */
  private readonly places = createPlaceSource(inject(PlacesApi), this.language);

  protected readonly placeSource = this.places.source;
  protected readonly placeFailure = this.places.failure;

  protected readonly debounceMs = LOCATION_DEBOUNCE_MS;
  protected readonly mapPinIcon = LucideMapPin;
  protected readonly locateIcon = LucideCrosshair;

  /** The committed suggestion's key. Draft text lives inside the control. */
  protected readonly locationKey = signal<DataKey>('');

  /** The draft text, so the panel can say "keep typing" rather than "nothing matched". */
  private readonly query = signal('');

  protected readonly locating = signal(false);
  protected readonly deviceFailure = signal<DeviceLocationFailure | null>(null);

  /**
   * Whether the device can be asked at all.
   *
   * Answered in the browser, never guessed during the server render: `navigator` does not
   * exist there and an insecure origin refuses the API outright. The same shape the page uses
   * for its map breakpoint.
   */
  protected readonly deviceAvailable = signal(false);

  protected readonly origin = computed(() => this.filters().origin);

  /** Too little typed to search. The panel says so instead of reporting no matches. */
  protected readonly queryTooShort = computed(
    () => this.query().trim().length < MIN_PLACE_QUERY_LENGTH,
  );

  /** A refused permission is not re-asked: the browser answers it without prompting again. */
  protected readonly locateBlocked = computed(() => this.deviceFailure() === 'denied');

  protected readonly captionKey = computed(() => {
    const origin = this.origin();
    if (origin === null) return 'barbershops.filters.orderedFrom';
    return origin.source === 'device'
      ? 'barbershops.filters.orderedFromDevice'
      : 'barbershops.filters.orderedFromPlace';
  });

  protected readonly captionParams = computed(() => ({ place: this.origin()?.label ?? '' }));

  /** What the caption says, as one value the template can key an element on. */
  protected readonly captionId = computed(
    () => `${this.captionKey()}|${this.captionParams().place}`,
  );

  protected readonly deviceFailureKey = computed(() => {
    switch (this.deviceFailure()) {
      case 'denied':
        return 'barbershops.filters.locateDenied';
      case 'timeout':
        return 'barbershops.filters.locateTimeout';
      case 'unavailable':
        return 'barbershops.filters.locateUnavailable';
      default:
        return null;
    }
  });

  /** Stable across renders: the control resets its rows whenever this identity changes. */
  protected readonly placeLabel = (place: PlaceSuggestionResponse): string => place.label;

  constructor() {
    afterNextRender(() => {
      this.deviceAvailable.set(this.locator.available());
    });

    // The origin can be replaced from outside the control — the page clearing every filter, or
    // the device answering. Either leaves a committed suggestion in the field naming a place
    // the list is no longer ordered from.
    effect(() => {
      const origin = this.origin();
      if (origin === null || origin.source === 'device') {
        this.locationKey.set('');
      }
    });
  }

  protected setName(name: string): void {
    this.filters.update((filters) => ({ ...filters, name }));
  }

  protected setDate(date: DateValue): void {
    this.filters.update((filters) => ({ ...filters, date: date === '' ? null : date }));
  }

  protected onNameInput(event: Event): void {
    this.setName((event.target as HTMLInputElement).value);
  }

  protected onQueryChange(query: string): void {
    this.query.set(query);
  }

  /** A committed suggestion, or `undefined` when the field was cleared. */
  protected onPlaceSelected(
    selection: AutocompleteSelection<PlaceSuggestionResponse> | undefined,
  ): void {
    if (selection === undefined) {
      this.setOrigin(null);
      return;
    }

    const place = selection.item;
    this.setOrigin({
      source: 'place',
      latitude: place.latitude,
      longitude: place.longitude,
      label: place.label,
    });
  }

  /**
   * Asks the device where the visitor is.
   *
   * Only ever reached from a press. This is where the browser raises its permission prompt,
   * and a prompt nobody asked for is remembered as a refusal for the whole origin.
   */
  protected async useMyLocation(): Promise<void> {
    if (this.locating() || this.locateBlocked()) return;

    this.locating.set(true);
    this.deviceFailure.set(null);
    try {
      const position = await this.locator.locate();
      this.setOrigin({
        source: 'device',
        latitude: position.latitude,
        longitude: position.longitude,
        // No name is invented for it. Naming the point would mean a second provider call, and
        // the caption says "where you are" instead.
        label: null,
      });
    } catch (error) {
      this.deviceFailure.set(error instanceof DeviceLocationError ? error.kind : 'unavailable');
    } finally {
      this.locating.set(false);
    }
  }

  /** Back to the API's own origin. The one control that clears a device fix. */
  protected clearOrigin(): void {
    this.deviceFailure.set(null);
    this.setOrigin(null);
  }

  private setOrigin(origin: SearchOrigin | null): void {
    this.filters.update((filters) => ({ ...filters, origin }));
  }
}
