import type { ServiceCategoryResponse } from '@api/services';

/** The category dialog while it is open: `null` creates one. */
export interface CategoryDialogState {
  readonly category: ServiceCategoryResponse | null;
}

/** A barber who performs the service, as the view lists them. */
export interface ServiceStaffView {
  readonly staffMemberId: string;
  readonly displayName: string;
  readonly isActive: boolean;
  readonly isBookable: boolean;
  readonly customPrice: number | null;
  readonly customDurationMinutes: number | null;
}
