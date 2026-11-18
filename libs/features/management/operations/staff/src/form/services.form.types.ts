/** One service the form offers. An empty own value follows the service's base one. */
export interface ServiceRowFormValue {
  serviceId: string;
  selected: boolean;
  customPrice: number | null;
  customDurationMinutes: number | null;
}

export interface ServicesFormValue {
  rows: ServiceRowFormValue[];
}

/** A row as the template draws it: the form value's index and what the service is. */
export interface ServiceRowView {
  readonly index: number;
  readonly serviceId: string;
  readonly name: string;
  readonly isActive: boolean;
  readonly price: number;
  readonly durationMinutes: number;
}

/** The rows of one category, in the options' order. */
export interface ServiceGroupView {
  readonly key: string;
  readonly name: string;
  readonly rows: readonly ServiceRowView[];
}
