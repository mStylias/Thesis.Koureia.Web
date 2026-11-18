import { Component, signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import type { ValidationError } from '@angular/forms/signals';
import { provideTransloco, TranslocoService } from '@jsverse/transloco';
import { provideUiCopy } from '@util/ui-copy';
import { firstValueFrom } from 'rxjs';
import type { Iso2, NumberType } from 'intl-tel-input';
import { PhoneInput } from './phone-input';
import { greekMobileRule } from './phone-rules';
import {
  countryFromNumber,
  loadPhoneCountries,
  loadPhoneUtils,
  validatePhoneValue,
} from './phone-validation';

describe('phone validation core', () => {
  it('resolves countries from dial codes, area codes included', async () => {
    const countries = await loadPhoneCountries();

    expect(countryFromNumber(countries, '+306912345678')).toBe('gr');
    expect(countryFromNumber(countries, '+447400123456')).toBe('gb');
    // +44 7911 is carved out for Guernsey by area code.
    expect(countryFromNumber(countries, '+447911123456')).toBe('gg');
    // +1 is shared: area code decides between the US and Canada.
    expect(countryFromNumber(countries, '+12125551234')).toBe('us');
    expect(countryFromNumber(countries, '+16045551234')).toBe('ca');
    expect(countryFromNumber(countries, '06912345678')).toBeUndefined();
  });

  it('accepts a valid number', async () => {
    const [utils, countries] = await Promise.all([loadPhoneUtils(), loadPhoneCountries()]);

    expect(validatePhoneValue(utils, countries, '+306912345678')).toBeNull();
  });

  it('reports specific reasons for invalid numbers', async () => {
    const [utils, countries] = await Promise.all([loadPhoneUtils(), loadPhoneCountries()]);

    expect(validatePhoneValue(utils, countries, '+30691234')).toEqual({
      kind: 'phoneTooShort',
    });
    expect(validatePhoneValue(utils, countries, '+3069123456789012')).toEqual({
      kind: 'phoneTooLong',
    });
    expect(validatePhoneValue(utils, countries, '0691234')).toEqual({
      kind: 'phoneInvalidCountry',
    });
  });

  it('rejects numbers of a disallowed type', async () => {
    const [utils, countries] = await Promise.all([loadPhoneUtils(), loadPhoneCountries()]);

    // A valid Athens fixed line is not a mobile.
    expect(
      validatePhoneValue(utils, countries, '+302101234567', {
        allowedTypes: 'mobile',
      }),
    ).toEqual({ kind: 'phoneInvalidType' });
    expect(
      validatePhoneValue(utils, countries, '+302101234567', {
        allowedTypes: 'fixedLine',
      }),
    ).toBeNull();
  });

  it('runs country-specific custom rules after built-in checks pass', async () => {
    const [utils, countries] = await Promise.all([loadPhoneUtils(), loadPhoneCountries()]);
    const config = {
      allowedTypes: 'mobile',
      customRules: { gr: greekMobileRule },
    } as const;

    expect(validatePhoneValue(utils, countries, '+306912345678', config)).toBeNull();
    // Custom rules never mask built-in errors.
    expect(validatePhoneValue(utils, countries, '+30691234', config)).toEqual({
      kind: 'phoneTooShort',
    });
  });

  it('greekMobileRule flags non-69 numbers only in mobile-only usages', () => {
    const context = {
      country: 'gr' as Iso2,
      numberType: 'MOBILE' as const,
    };

    expect(
      greekMobileRule({
        ...context,
        value: '+306812345678',
        allowedTypes: 'mobile',
      }),
    ).toEqual({ kind: 'phoneGreekMobile' });
    expect(
      greekMobileRule({
        ...context,
        value: '+306912345678',
        allowedTypes: 'mobile',
      }),
    ).toBeNull();
    expect(
      greekMobileRule({
        ...context,
        value: '+306812345678',
        allowedTypes: 'any',
      }),
    ).toBeNull();
  });
});

@Component({
  imports: [PhoneInput],
  template: `
    <lib-phone-input
      [(value)]="value"
      [(country)]="country"
      [disabled]="disabled()"
      [required]="required()"
      [touched]="touched()"
      [errors]="errors()"
      [ariaDescribedby]="ariaDescribedby()"
      [placeholderNumberType]="placeholderNumberType()"
      (touch)="touchCount = touchCount + 1"
    />
  `,
})
class PhoneInputHost {
  readonly value = signal('');
  readonly country = signal<Iso2 | undefined>(undefined);
  readonly disabled = signal(false);
  readonly required = signal(false);
  readonly touched = signal(false);
  readonly errors = signal<ValidationError.WithOptionalFieldTree[]>([]);
  readonly ariaDescribedby = signal('');
  readonly placeholderNumberType = signal<NumberType>('MOBILE');

  touchCount = 0;
}

describe('PhoneInput', () => {
  let fixture: ComponentFixture<PhoneInputHost>;
  let host: PhoneInputHost;

  function root(): HTMLElement {
    const element = (fixture.nativeElement as HTMLElement).querySelector('lib-phone-input');
    if (!element) {
      throw new Error('lib-phone-input not rendered');
    }
    return element as HTMLElement;
  }

  function input(): HTMLInputElement {
    const element = root().querySelector<HTMLInputElement>('input[type="tel"]');
    if (!element) {
      throw new Error('native input not rendered');
    }
    return element;
  }

  async function settle(): Promise<void> {
    fixture.detectChanges();
    await fixture.whenStable();
  }

  /** Waits for the lazy intl-tel-input init to finish. */
  async function ready(): Promise<void> {
    await settle();
    await vi.waitFor(() => {
      if (!root().querySelector('.iti')) {
        throw new Error('intl-tel-input not initialized yet');
      }
      if (!fixture.componentRef.instance.country()) {
        throw new Error('country not resolved yet');
      }
    });
    await settle();
  }

  async function type(text: string): Promise<void> {
    const element = input();
    element.value = text;
    element.dispatchEvent(new Event('input', { bubbles: true }));
    await settle();
  }

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        provideTransloco({
          config: {
            availableLangs: ['el', 'en'],
            defaultLang: 'en',
            fallbackLang: 'en',
            missingHandler: { useFallbackTranslation: true },
          },
        }),
      ],
    });
    fixture = TestBed.createComponent(PhoneInputHost);
    host = fixture.componentInstance;
  });

  it('initializes lazily with the default country and reports it', async () => {
    await ready();

    expect(root().querySelector('.iti')).toBeTruthy();
    expect(host.country()).toBe('gr');
  });

  it('emits the E.164 value while typing a national number', async () => {
    await ready();

    await type('6912345678');

    expect(host.value()).toBe('+306912345678');
    expect(root().hasAttribute('data-filled')).toBe(true);
  });

  it('switches the country when a dial code is typed into the input', async () => {
    await ready();
    expect(host.country()).toBe('gr');

    await type('+4915123456789');

    expect(host.country()).toBe('de');
    expect(host.value()).toBe('+4915123456789');
  });

  it('derives the country from a seeded value', async () => {
    host.value.set('+447400123456');
    await ready();

    expect(host.country()).toBe('gb');
    expect(input().value).not.toBe('');
  });

  it('clears the value when the input empties', async () => {
    await ready();
    await type('6912345678');

    await type('');

    expect(host.value()).toBe('');
    expect(root().hasAttribute('data-filled')).toBe(false);
  });

  it('honors a country supplied before initialization', async () => {
    host.country.set('cy');
    await ready();

    await vi.waitFor(() => {
      const flag = root().querySelector('.iti__flag');
      if (!flag?.classList.contains('iti__cy')) {
        throw new Error(`selector shows "${flag?.className}", not Cyprus`);
      }
    });
    await settle();
    expect(host.country()).toBe('cy');
  });

  it('follows a change to an init-time option after initialization', async () => {
    await ready();
    await vi.waitFor(() => {
      if (!input().placeholder) {
        throw new Error('example placeholder not seeded yet');
      }
    });
    const mobileExample = input().placeholder;

    host.placeholderNumberType.set('FIXED_LINE');
    await settle();

    await vi.waitFor(() => {
      if (input().placeholder === mobileExample) {
        throw new Error('placeholder still shows the mobile example');
      }
    });
    // Athens fixed lines start 21; Greek mobiles start 69.
    expect(input().placeholder.replace(/\D/g, '')).toMatch(/^21/);
  });

  it('keeps value and country across a language-driven rebuild', async () => {
    host.value.set('+447400123456');
    await ready();
    expect(host.country()).toBe('gb');

    TestBed.inject(TranslocoService).setActiveLang('el');
    await settle();

    await vi.waitFor(() => {
      const flag = root().querySelector('.iti__flag');
      if (!flag?.classList.contains('iti__gb')) {
        throw new Error(`selector shows "${flag?.className}" after rebuild`);
      }
      // The rebuilt instance must re-derive its example number rather
      // than inherit the one the destroyed instance left behind.
      if (!input().placeholder) {
        throw new Error('example placeholder missing after rebuild');
      }
    });
    expect(host.value()).toBe('+447400123456');
    expect(host.country()).toBe('gb');
  });

  it('follows a programmatic country change', async () => {
    await ready();

    host.country.set('de');
    await settle();

    await vi.waitFor(() => {
      const flag = root().querySelector('.iti__flag');
      if (!flag?.classList.contains('iti__de')) {
        throw new Error('country selector did not switch');
      }
    });
  });

  it('uses the translated generic label when none is provided', async () => {
    await ready();

    await vi.waitFor(() => {
      if (input().getAttribute('aria-label') !== 'Phone number') {
        throw new Error('scoped translations not loaded yet');
      }
    });
  });

  it('disables the input through the plugin', async () => {
    await ready();

    host.disabled.set(true);
    await settle();

    expect(input().disabled).toBe(true);
    expect(root().hasAttribute('data-disabled')).toBe(true);
  });

  it('emits touch when focus leaves the component', async () => {
    await ready();

    input().dispatchEvent(new FocusEvent('focusout', { bubbles: true, relatedTarget: null }));
    await settle();

    expect(host.touchCount).toBe(1);
  });

  it('exposes required as aria-required, never the native attribute', async () => {
    host.required.set(true);
    await ready();

    expect(input().getAttribute('aria-required')).toBe('true');
    // The native attribute blocks the submit event outright and raises an
    // OS-locale bubble over the translated message rendered below.
    expect(input().hasAttribute('required')).toBe(false);
    expect(input().required).toBe(false);
    // The mechanism itself: an empty required field fails constraint
    // validation, and that is what suppresses the submit event.
    expect(input().checkValidity()).toBe(true);
  });

  it('appends its error id to the consumer aria-describedby', async () => {
    host.ariaDescribedby.set('phone-hint');
    await ready();

    expect(input().getAttribute('aria-describedby')).toBe('phone-hint');

    host.touched.set(true);
    host.errors.set([{ kind: 'phoneTooShort' }]);
    await settle();

    const describedBy = input().getAttribute('aria-describedby') ?? '';
    const [consumerId, errorId] = describedBy.split(' ');
    expect(consumerId).toBe('phone-hint');
    expect(errorId).toMatch(/^lib-phone-input-error-\d+$/);
    expect(root().querySelector('.phone-input-error')?.id).toBe(errorId);
  });

  it('builds no plugin instance when destroyed mid-initialization', async () => {
    // Init starts on first render and yields at its dynamic imports, so
    // destroying now lands inside that window. Anything built afterwards
    // would outlive the component with nothing left to destroy it.
    fixture.detectChanges();
    const element = root();

    fixture.destroy();
    await new Promise((resolve) => setTimeout(resolve, 200));

    expect(element.querySelector('.iti')).toBeNull();
  });
});

describe('PhoneInput copy', () => {
  it('reads a key the consumer overrides in place of its own', async () => {
    TestBed.configureTestingModule({
      providers: [
        provideTransloco({
          config: { availableLangs: ['el', 'en'], defaultLang: 'en', fallbackLang: 'en' },
        }),
        provideUiCopy({ 'phoneInput.label': 'customer.phone' }),
      ],
    });
    const fixture = TestBed.createComponent(PhoneInputHost);
    const transloco = TestBed.inject(TranslocoService);
    transloco.setTranslation({ customer: { phone: 'Your mobile' } }, 'en', { merge: true });
    fixture.detectChanges();
    await fixture.whenStable();
    await firstValueFrom(transloco.load('phoneInput/en'));
    fixture.detectChanges();

    const input = (fixture.nativeElement as HTMLElement).querySelector('input[type="tel"]');
    expect(input?.getAttribute('aria-label')).toBe('Your mobile');
  });
});
