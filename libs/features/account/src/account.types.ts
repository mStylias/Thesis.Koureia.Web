import type { AppointmentResponse } from '@api/customer-appointments';

/** What the details page shows. `not-found` and `failed` say different things. */
export type AppointmentPage =
  | { readonly status: 'found'; readonly appointment: AppointmentResponse }
  | { readonly status: 'not-found' }
  | { readonly status: 'failed' };

/** The state of a list page: its first load, then pages appended by "Show more". */
export type ListStatus = 'idle' | 'loading' | 'ready' | 'failed';

/** A list read page by page. `page` is the last page loaded, from 1. */
export interface PagedList<TItem> {
  readonly status: ListStatus;
  readonly items: readonly TItem[];
  readonly page: number;
  readonly hasMore: boolean;
  /** A "Show more" in flight. The items stay on screen meanwhile. */
  readonly loadingMore: boolean;
  /** "Show more" failed. The loaded items stay. */
  readonly moreFailed: boolean;
}

/** The page shape every list endpoint returns. */
export interface ListPage<TItem> {
  readonly items: readonly TItem[];
  readonly page: number;
  readonly hasMore: boolean;
}

/**
 * Which actions the details page offers, from the server's flags:
 *
 * - `change` — upcoming and before the cutoff: change time, cancel.
 * - `call` — upcoming and inside the cutoff: call the shop.
 * - `review` — completed and still open for a review: rate it, book again.
 * - `past` — anything else: book again.
 */
export type AppointmentActionSet = 'change' | 'call' | 'review' | 'past';

/** The visit a review is about, as the dialog names it. */
export interface ReviewVisit {
  readonly shop: string;
  /** Shop-local `YYYY-MM-DD`. */
  readonly date: string;
  readonly barber: string;
}

/** What the review dialog writes: a new review of a visit, or a change to an existing one. */
export type ReviewTarget =
  | { readonly kind: 'create'; readonly appointmentId: string; readonly visit: ReviewVisit }
  | {
      readonly kind: 'edit';
      readonly reviewId: string;
      readonly rating: number;
      readonly comment: string | null;
      readonly visit: ReviewVisit;
    };

/** The cancel dialog's form. The reason is optional. */
export interface CancelFormValue {
  readonly reason: string;
}

/** The review as the dialog's form edits it. `null` until a star is chosen. */
export interface ReviewFormValue {
  readonly rating: number | null;
  readonly comment: string;
}

/** How a status chip reads: the label key and the tone its tag takes. */
export interface StatusChip {
  readonly labelKey: string;
  readonly tone: 'success' | 'info' | 'warning' | 'error' | 'neutral';
}
