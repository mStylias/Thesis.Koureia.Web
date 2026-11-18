import type { ReviewTarget } from '../../account.types';
import { createReviewRequest, reviewForm, updateReviewRequest } from './review.form';

const visit = { shop: 'Barber House', date: '2026-09-25', barber: 'George P.' };
const saved: Extract<ReviewTarget, { kind: 'edit' }> = {
  kind: 'edit',
  reviewId: 'review-1',
  rating: 4,
  comment: 'Sharp fade.',
  visit,
};

describe('review form', () => {
  it('starts empty for a new review and from the saved one for an edit', () => {
    expect(reviewForm({ kind: 'create', appointmentId: 'a1', visit })).toEqual({
      rating: null,
      comment: '',
    });
    expect(reviewForm(saved)).toEqual({ rating: 4, comment: 'Sharp fade.' });
  });

  it('sends an empty comment as null', () => {
    expect(createReviewRequest({ rating: 5, comment: '   ' })).toEqual({
      rating: 5,
      comment: null,
    });
  });

  it('patches only what changed', () => {
    expect(updateReviewRequest({ rating: 5, comment: 'Sharp fade.' }, saved)).toEqual({
      rating: 5,
    });
    expect(updateReviewRequest({ rating: 4, comment: '' }, saved)).toEqual({ comment: null });
    expect(updateReviewRequest({ rating: 4, comment: 'Sharp fade.' }, saved)).toEqual({});
  });
});
