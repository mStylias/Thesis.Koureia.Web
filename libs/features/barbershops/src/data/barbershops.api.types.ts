/**
 * The wire shapes of the public barbershop browse. Members are the endpoint's, camel-cased.
 */

/**
 * One barbershop as a customer sees it while choosing where to book, from
 * `GET /api/v1/companies` and `GET /api/v1/companies/all`.
 *
 * `distanceMeters` is measured from the origin the request named, or from the configured
 * default when it named none. It is a property of the query, not of the shop, so it changes
 * whenever the origin does.
 *
 * There is no price and no rating. Neither exists on the endpoint yet.
 */
export interface CompanyCardResponse {
  readonly id: string;
  /** The shop's address segment, `/barbershops/{slug}`. The same in every language. */
  readonly slug: string;
  readonly name: string;
  readonly description: string | null;
  readonly street: string;
  readonly city: string;
  readonly region: string | null;
  readonly postalCode: string;
  readonly countryCode: string;
  readonly logoUrl: string | null;
  /** The first photo in display order. The card shows it, not the logo. */
  readonly mainPhotoUrl: string | null;
  readonly latitude: number;
  readonly longitude: number;
  readonly distanceMeters: number;
  readonly timezone: string;
  readonly currency: string;
  readonly slotIntervalMinutes: number;
  readonly primaryBusinessTypeCode: string | null;
}

/**
 * Where the list is measured and ordered from.
 *
 * There is exactly one at a time and it has two possible sources. `null` in place of an origin
 * means the API's own configured point, the centre of Athens — the page never names those
 * coordinates itself.
 */
export interface SearchOrigin {
  readonly source: 'place' | 'device';
  readonly latitude: number;
  readonly longitude: number;
  /** What the caption and the map pin name. `null` when the device supplied the point. */
  readonly label: string | null;
}

/**
 * What the user narrowed the list to. An empty string and `null` both mean "not set", which is
 * what the controls write when they are cleared.
 */
export interface BarbershopFilters {
  /** Matched against every translated name, folded to ignore case and accents. */
  readonly name: string;
  /** A canonical `YYYY-MM-DD` day, read in each shop's own timezone. Never a past date. */
  readonly date: string | null;
  /**
   * The point to order from. It narrows nothing — a far shop is still in the list, last — so
   * it is not part of {@link isFiltered}. It does decide which endpoint answers.
   */
  readonly origin: SearchOrigin | null;
}

/**
 * One barbershop's home page, from `GET /api/v1/companies/{slug}`. Everything the page shows
 * comes in this one answer.
 */
export interface CompanyDetailsResponse {
  /** For later API calls. Never part of a URL. */
  readonly id: string;
  readonly slug: string;
  readonly name: string;
  /** Not shown on the page. Used for the meta description. */
  readonly description: string | null;
  readonly street: string;
  /** Entered by the shop. The city stands in for it when it is `null`. */
  readonly neighborhood: string | null;
  readonly city: string;
  readonly region: string | null;
  readonly postalCode: string;
  readonly countryCode: string;
  readonly latitude: number;
  readonly longitude: number;
  readonly timezone: string;
  /** ISO 4217. Every price on the page is in it. */
  readonly currency: string;
  readonly logoUrl: string | null;
  /** At most 50, in display order. The first is the main photo. */
  readonly photos: readonly CompanyPhotoViewDto[];
  readonly rating: CompanyRatingViewDto;
  /** In category display order. A category with no service is left out. */
  readonly serviceCategories: readonly CompanyServiceCategoryViewDto[];
  /** Services with no active category. */
  readonly uncategorizedServices: readonly CompanyServiceViewDto[];
  readonly barbers: readonly CompanyStaffMemberViewDto[];
}

export interface CompanyPhotoViewDto {
  readonly url: string;
  readonly width: number;
  readonly height: number;
  /** Translated. The API falls back to the shop name. */
  readonly altText: string;
}

/**
 * The published reviews. The API applies the threshold: `average` is `null` until there are
 * enough reviews for it to mean something.
 */
export interface CompanyRatingViewDto {
  readonly count: number;
  /** 1.0 to 5.0, one decimal. */
  readonly average: number | null;
}

export interface CompanyServiceCategoryViewDto {
  readonly id: string;
  readonly name: string;
  /** Never empty. */
  readonly services: readonly CompanyServiceViewDto[];
}

export interface CompanyServiceViewDto {
  readonly id: string;
  readonly name: string;
  /** The base price, in the shop's currency. */
  readonly price: number;
  /** The base duration, without buffers. */
  readonly durationMinutes: number;
}

export interface CompanyStaffMemberViewDto {
  readonly id: string;
  /** First name and last-name initial, `Γιώργος Π.`. */
  readonly displayName: string;
  /** `ΓΠ`. What the avatar shows without a photo. */
  readonly initials: string;
  readonly avatarUrl: string | null;
}

/** One shop the sitemap lists, from `GET /api/v1/companies/slugs`. */
export interface CompanySitemapEntryResponse {
  readonly slug: string;
  /** ISO 8601, UTC. */
  readonly lastModified: string;
}
