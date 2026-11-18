/** One language's name and description. Rows follow the options' language order. */
export interface ServiceTranslationFormValue {
  languageCode: string;
  name: string;
  description: string;
}

/**
 * One barber the form offers. `selected` is whether they perform the service. An empty own value
 * follows the base one.
 */
export interface ServiceStaffFormValue {
  staffMemberId: string;
  selected: boolean;
  customPrice: number | null;
  customDurationMinutes: number | null;
}

/** The drawer's form. `categoryId` is `''` for "Uncategorized", which is what the select writes. */
export interface ServiceFormValue {
  translations: ServiceTranslationFormValue[];
  categoryId: string;
  price: number | null;
  durationMinutes: number | null;
  bufferBeforeMinutes: number | null;
  bufferAfterMinutes: number | null;
  isActive: boolean;
  staff: ServiceStaffFormValue[];
}

/** A barber row as the form draws it: the form value and who the barber is. */
export interface ServiceStaffRow {
  readonly index: number;
  readonly staffMemberId: string;
  readonly displayName: string;
  readonly isActive: boolean;
  readonly isBookable: boolean;
}
