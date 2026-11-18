import type { CompanyPhotoResponse, UpdateCompanyPhotoRequest } from '@api/company';
import { field, fields } from '@util/forms';

import type { AltTextFormValue } from './alt-text.form.types';

/** The API's limit on one language's description. */
export const ALT_TEXT_MAX_LENGTH = 300;

const K = 'managementCompany.photos.alt';

export const ALT_TEXT_FIELDS = fields<AltTextFormValue>({
  el: field({ label: `${K}.el`, maxLength: [ALT_TEXT_MAX_LENGTH, `${K}.tooLong`] }),
  en: field({ label: `${K}.en`, maxLength: [ALT_TEXT_MAX_LENGTH, `${K}.tooLong`] }),
});

export function altTextForm(photo: CompanyPhotoResponse): AltTextFormValue {
  const text = (languageCode: string): string =>
    photo.altTexts.find((entry) => entry.languageCode === languageCode)?.altText ?? '';
  return { el: text('el'), en: text('en') };
}

/** Both languages, so a cleared one is cleared too. An empty text is `null`. */
export function altTextRequest(value: AltTextFormValue): UpdateCompanyPhotoRequest {
  const text = (altText: string): string | null => (altText.trim() === '' ? null : altText.trim());
  return {
    altTexts: [
      { languageCode: 'el', altText: text(value.el) },
      { languageCode: 'en', altText: text(value.en) },
    ],
  };
}

/**
 * Where a refusal on `altTexts[i].altText` belongs: `el` is sent first, `en` second. A refusal on
 * the language code names no field the person can change.
 */
export function altTextPath(
  path: readonly (string | number)[] | undefined,
): readonly string[] | undefined {
  if (path?.[0] !== 'altTexts' || path[2] !== 'altText') return undefined;
  return path[1] === 0 ? ['el'] : path[1] === 1 ? ['en'] : undefined;
}
