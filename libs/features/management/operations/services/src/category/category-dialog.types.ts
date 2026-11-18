import type { ServiceCategoryResponse } from '@api/services';

/** One language's category name. Rows follow the options' language order. */
export interface CategoryTranslationFormValue {
  languageCode: string;
  name: string;
}

export interface CategoryFormValue {
  translations: CategoryTranslationFormValue[];
}

/** What the dialog tells the drawer: a category written, or one deleted. */
export type CategoryChange =
  | { readonly kind: 'saved'; readonly category: ServiceCategoryResponse }
  | { readonly kind: 'deleted'; readonly id: string };
