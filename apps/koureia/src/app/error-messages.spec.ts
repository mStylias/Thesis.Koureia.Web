import { TestBed } from '@angular/core/testing';
import { provideTransloco, TranslocoService } from '@jsverse/transloco';
import { injectErrorMessageResolver } from '@synax/client';
import { clientSideError, parseHttpError, SyntheticErrorCodes } from '@synax/client/core';

import el from './i18n/el';
import en from './i18n/en';
import { provideAppErrorMessages } from './error-messages';

describe('provideAppErrorMessages', () => {
  function resolver(): (error: ReturnType<typeof parseHttpError>) => string {
    TestBed.configureTestingModule({
      providers: [
        provideTransloco({ config: { availableLangs: ['el', 'en'], defaultLang: 'el' } }),
        provideAppErrorMessages(),
      ],
    });
    const transloco = TestBed.inject(TranslocoService);
    transloco.setTranslation(el, 'el');
    transloco.setTranslation(en, 'en');
    return TestBed.runInInjectionContext(() => injectErrorMessageResolver());
  }

  it('says a request with no response in Greek, not in the English Synax attaches', () => {
    expect(resolver()(parseHttpError(0, null))).toBe('Η σύνδεση απέτυχε.');
  });

  it('has copy for every code the client produces, in both languages', () => {
    for (const code of Object.values(SyntheticErrorCodes)) {
      expect((el['errors'] as Record<string, string>)[code]).toBeTruthy();
      expect((en['errors'] as Record<string, string>)[code]).toBeTruthy();
    }
    expect(resolver()(clientSideError(SyntheticErrorCodes.Timeout))).toBe(
      'Η απάντηση άργησε πολύ.',
    );
  });

  it('leaves a server code to its description', () => {
    const error = parseHttpError(409, { title: 'SOME_CODE', detail: 'From the server.' });
    expect(resolver()(error)).toBe('From the server.');
  });
});
