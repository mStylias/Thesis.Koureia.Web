import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideTransloco, Translation, TranslocoLoader } from '@jsverse/transloco';
import { Observable, of } from 'rxjs';

import { ProfileNotifications } from './profile-notifications';

class EmptyLoader implements TranslocoLoader {
  getTranslation(): Observable<Translation> {
    return of({});
  }
}

describe('ProfileNotifications', () => {
  let fixture: ComponentFixture<ProfileNotifications>;

  beforeEach(async () => {
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        provideTransloco({
          config: {
            availableLangs: ['el', 'en'],
            defaultLang: 'el',
            missingHandler: { logMissingKey: false },
          },
          loader: EmptyLoader,
        }),
      ],
    });
    fixture = TestBed.createComponent(ProfileNotifications);
    await fixture.whenStable();
  });

  function host(): HTMLElement {
    return fixture.nativeElement as HTMLElement;
  }

  it('shows three switches, off and disabled', () => {
    const switches = Array.from(host().querySelectorAll<HTMLInputElement>('input[role="switch"]'));

    expect(switches).toHaveLength(3);
    expect(switches.every((input) => input.disabled && !input.checked)).toBe(true);
  });

  it('describes each switch with its hint', () => {
    for (const input of Array.from(host().querySelectorAll('input[role="switch"]'))) {
      const hint = host().querySelector(`[id="${input.getAttribute('aria-describedby') ?? ''}"]`);
      expect(hint?.textContent).toContain('.hint');
    }
  });

  it('describes the card with the coming-soon note', () => {
    const section = host().querySelector('section');

    expect(section?.getAttribute('aria-describedby')).toBe('notifications-soon');
    expect(host().querySelector('lib-banner#notifications-soon')).not.toBeNull();
  });

  it('makes no request', () => {
    TestBed.inject(HttpTestingController).verify();
  });
});
