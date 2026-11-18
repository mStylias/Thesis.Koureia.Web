import { HttpClient, HttpParams } from '@angular/common/http';
import { Service, inject } from '@angular/core';
import { injectSynaxUrl, toResult } from '@synax/client';
import type { Result } from '@synax/client/core';
import type { Observable } from 'rxjs';

import type {
  CreateCurrentUserReviewRequest,
  ReviewListQuery,
  ReviewPageResponse,
  ReviewResponse,
  UpdateCurrentUserReviewRequest,
} from './customer-reviews.api.types';

/**
 * The signed-in customer's own reviews.
 *
 * A review belongs to one completed visit. Deleting it frees the visit, so the customer can
 * review it again while its review window lasts.
 *
 * ```ts
 * import { CustomerReviewsApi } from '@api/customer-reviews';
 * ```
 */
@Service()
export class CustomerReviewsApi {
  private readonly http = inject(HttpClient);
  private readonly url = injectSynaxUrl();

  /** One page of reviews, newest first. */
  list(query: ReviewListQuery): Observable<Result<ReviewPageResponse>> {
    const params = new HttpParams()
      .set('page', query.page)
      .set('pageSize', query.pageSize)
      .set('languageCode', query.languageCode);

    return this.http
      .get<ReviewPageResponse>(this.url('users/me/reviews'), { params })
      .pipe(toResult<ReviewPageResponse>());
  }

  /** Reviews one visit. `REVIEW_ALREADY_EXISTS` when it already has one. */
  create(
    appointmentId: string,
    body: CreateCurrentUserReviewRequest,
    languageCode: string,
  ): Observable<Result<ReviewResponse>> {
    return this.http
      .post<ReviewResponse>(
        this.url(`users/me/appointments/${encodeURIComponent(appointmentId)}/review`),
        body,
        { params: new HttpParams().set('languageCode', languageCode) },
      )
      .pipe(toResult<ReviewResponse>());
  }

  /** Changes the stars, the comment, or both. */
  update(
    id: string,
    body: UpdateCurrentUserReviewRequest,
    languageCode: string,
  ): Observable<Result<ReviewResponse>> {
    return this.http
      .patch<ReviewResponse>(this.url(`users/me/reviews/${encodeURIComponent(id)}`), body, {
        params: new HttpParams().set('languageCode', languageCode),
      })
      .pipe(toResult<ReviewResponse>());
  }

  /** Deletes it. It stops counting toward the ratings at once. */
  delete(id: string): Observable<Result<null>> {
    return this.http
      .delete<null>(this.url(`users/me/reviews/${encodeURIComponent(id)}`))
      .pipe(toResult<null>());
  }
}

/** The refusals of the review calls. The page branches on codes, not messages. */
export const CustomerReviewErrorCodes = {
  NotFound: 'REVIEW_NOT_FOUND',
  InvalidRating: 'REVIEW_INVALID_RATING',
  InvalidComment: 'REVIEW_INVALID_COMMENT',
  /** The shop has not marked the visit completed. */
  NotReviewable: 'REVIEW_NOT_REVIEWABLE',
  /** More than 30 days after the visit. */
  WindowClosed: 'REVIEW_WINDOW_CLOSED',
  /** The visit already has a review. */
  AlreadyExists: 'REVIEW_ALREADY_EXISTS',
} as const;
