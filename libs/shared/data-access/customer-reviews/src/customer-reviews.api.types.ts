/** The wire shapes of the customer's own reviews. Members are the endpoint's, camel-cased. */

/** One of the customer's own reviews, with the visit it is about. */
export interface ReviewResponse {
  readonly id: string;
  readonly appointmentId: string;
  readonly companyId: string;
  readonly companySlug: string;
  readonly companyName: string;
  readonly companyLogoUrl: string | null;
  readonly staffMemberId: string;
  readonly staffDisplayName: string;
  /** Shop-local `YYYY-MM-DD`. */
  readonly visitDate: string;
  /** Whole stars, 1 to 5. */
  readonly rating: number;
  readonly comment: string | null;
  readonly createdAt: string;
  readonly updatedAt: string | null;
}

/** One page of `GET /users/me/reviews`, newest first. */
export interface ReviewPageResponse {
  readonly items: readonly ReviewResponse[];
  /** From 1. */
  readonly page: number;
  readonly pageSize: number;
  readonly hasMore: boolean;
}

/** What the list is asked for. */
export interface ReviewListQuery {
  /** From 1. */
  readonly page: number;
  /** At most 50. */
  readonly pageSize: number;
  readonly languageCode: string;
}

/** The body of `POST /users/me/appointments/{id}/review`. */
export interface CreateCurrentUserReviewRequest {
  /** Whole stars, 1 to 5. */
  readonly rating: number;
  /** At most 1,000 characters. `null` when the customer wrote none. */
  readonly comment: string | null;
}

/** The body of `PATCH /users/me/reviews/{id}`. A merge patch: an omitted property is left alone. */
export interface UpdateCurrentUserReviewRequest {
  readonly rating?: number;
  /** `null` clears it. */
  readonly comment?: string | null;
}
