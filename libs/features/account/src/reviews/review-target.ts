import type { AppointmentResponse } from '@api/customer-appointments';
import type { ReviewResponse } from '@api/customer-reviews';

import type { ReviewTarget } from '../account.types';

/** The dialog's target for an appointment: an edit when it has a review, a new one otherwise. */
export function appointmentReviewTarget(appointment: AppointmentResponse): ReviewTarget {
  const visit = {
    shop: appointment.companyName,
    date: appointment.localDate,
    barber: appointment.staffDisplayName,
  };
  return appointment.review === null
    ? { kind: 'create', appointmentId: appointment.id, visit }
    : {
        kind: 'edit',
        reviewId: appointment.review.id,
        rating: appointment.review.rating,
        comment: appointment.review.comment,
        visit,
      };
}

/** The dialog's target for one of the customer's reviews. */
export function reviewTarget(review: ReviewResponse): ReviewTarget {
  return {
    kind: 'edit',
    reviewId: review.id,
    rating: review.rating,
    comment: review.comment,
    visit: { shop: review.companyName, date: review.visitDate, barber: review.staffDisplayName },
  };
}

/** The appointment with the review it now has. A reviewed visit takes no second review. */
export function withReview(
  appointment: AppointmentResponse,
  review: ReviewResponse,
): AppointmentResponse {
  return {
    ...appointment,
    canReview: false,
    review: {
      id: review.id,
      rating: review.rating,
      comment: review.comment,
      createdAt: review.createdAt,
      updatedAt: review.updatedAt,
    },
  };
}
