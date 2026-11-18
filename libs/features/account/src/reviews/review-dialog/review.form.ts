import type {
  CreateCurrentUserReviewRequest,
  UpdateCurrentUserReviewRequest,
} from '@api/customer-reviews';
import { field, fields } from '@util/forms';

import type { ReviewFormValue, ReviewTarget } from '../../account.types';

const K = 'account.review';

/** The longest comment the API takes. */
export const REVIEW_COMMENT_MAX_LENGTH = 1000;

export const REVIEW_FIELDS = fields<ReviewFormValue>({
  rating: field({ label: `${K}.rating`, required: `${K}.errors.ratingRequired` }),
  comment: field({
    label: `${K}.comment`,
    hint: `${K}.commentHint`,
    maxLength: REVIEW_COMMENT_MAX_LENGTH,
  }),
});

/** What the form starts from: empty for a new review, the saved one for an edit. */
export function reviewForm(target: ReviewTarget | null): ReviewFormValue {
  return target?.kind === 'edit'
    ? { rating: target.rating, comment: target.comment ?? '' }
    : { rating: null, comment: '' };
}

/** The body of a new review. */
export function createReviewRequest(value: ReviewFormValue): CreateCurrentUserReviewRequest {
  const comment = value.comment.trim();
  return { rating: value.rating ?? 0, comment: comment === '' ? null : comment };
}

/** A merge patch of what changed since the saved review. Empty when nothing did. */
export function updateReviewRequest(
  value: ReviewFormValue,
  saved: Extract<ReviewTarget, { kind: 'edit' }>,
): UpdateCurrentUserReviewRequest {
  const comment = value.comment.trim();
  const nextComment = comment === '' ? null : comment;

  return {
    ...(value.rating === null || value.rating === saved.rating ? {} : { rating: value.rating }),
    ...(nextComment === saved.comment ? {} : { comment: nextComment }),
  };
}
