/**
 * The head of a page whose title and description come from data, not from the dictionary: a
 * barbershop's name is not a translation key.
 *
 * A route resolves one under {@link PAGE_META} and the app's title strategy and page metadata
 * read it in place of the route's `title` and `data.description` keys.
 */
export interface PageMeta {
  /** The literal page title, without the brand. */
  readonly title: string;
  /** The literal meta description, or `null` for none. */
  readonly description: string | null;
  /** An absolute URL for the share preview (`og:image`), or `null` for none. */
  readonly image: string | null;
  /**
   * Whether the page is published. `true` writes `canonical` and `hreflang`. `false` writes
   * `noindex`, as for any unpublished address.
   */
  readonly indexable: boolean;
}
