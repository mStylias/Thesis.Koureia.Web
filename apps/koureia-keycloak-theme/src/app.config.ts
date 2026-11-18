import {
  type ApplicationConfig,
  isDevMode,
  provideZonelessChangeDetection,
  Service,
} from '@angular/core';
import { provideTransloco, type Translation, type TranslocoLoader } from '@jsverse/transloco';
import { provideBrand } from '@util/brand';
import { customerUiCopyEl, customerUiCopyEn, provideCustomerUiCopy } from '@util/ui-copy';
import { themeLanguage } from './page-language';

@Service()
class ThemeTranslocoLoader implements TranslocoLoader {
  // The root dictionary holds only the shared-control copy. The pages read Keycloakify's i18n.
  async getTranslation(lang: string): Promise<Translation> {
    switch (lang) {
      case 'el':
        return Promise.resolve({ uiCopy: customerUiCopyEl });
      case 'en':
        return Promise.resolve({ uiCopy: customerUiCopyEn });
      default:
        return Promise.resolve({});
    }
  }
}

const language = themeLanguage(window.kcContext);

export const appConfig: ApplicationConfig = {
  providers: [
    provideZonelessChangeDetection(),
    provideBrand({
      id: 'koureia',
      name: 'Koureia',
      wordmark: 'koureia',
      logo: '/brand/koureia_icon.png',
      heroImage: '/images/barber_tools.webp',
      defaultTheme: 'system',
    }),
    provideTransloco({
      config: {
        availableLangs: ['el', 'en'],
        defaultLang: language,
        fallbackLang: 'en',
        missingHandler: { useFallbackTranslation: true },
        reRenderOnLangChange: true,
        prodMode: !isDevMode(),
      },
      loader: ThemeTranslocoLoader,
    }),
    // Every page here is customer-facing, so shared controls speak the singular app-wide.
    provideCustomerUiCopy(),
  ],
};
