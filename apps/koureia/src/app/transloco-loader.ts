import { Service } from '@angular/core';
import type { Translation, TranslocoLoader } from '@jsverse/transloco';

/**
 * Loads root translations through dynamic `import()` instead of HTTP —
 * translations become lazy chunks that work identically in the browser
 * and during SSR (no absolute-URL fetch on the server).
 */
@Service()
export class AppTranslocoLoader implements TranslocoLoader {
  async getTranslation(lang: string): Promise<Translation> {
    switch (lang) {
      case 'el':
        return (await import('./i18n/el')).default;
      case 'en':
        return (await import('./i18n/en')).default;
      default:
        return {};
    }
  }
}
