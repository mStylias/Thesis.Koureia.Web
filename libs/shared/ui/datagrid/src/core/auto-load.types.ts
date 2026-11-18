/** What {@link AutoLoad} reads and does. */
export interface AutoLoadDeps {
  /** Whether another page exists and no load is already running. */
  readonly canLoadMore: () => boolean;
  readonly loadMore: () => void;
}
