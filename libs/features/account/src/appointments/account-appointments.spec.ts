import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { Injectable } from '@angular/core';
import { TestBed, type ComponentFixture } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { provideTransloco, type Translation, type TranslocoLoader } from '@jsverse/transloco';
import { provideSynaxApi } from '@synax/client';
import { of, type Observable } from 'rxjs';

import { appointment } from '../account.fixture';
import { AccountAppointments } from './account-appointments';

@Injectable()
class EmptyLoader implements TranslocoLoader {
  getTranslation(): Observable<Translation> {
    return of({});
  }
}

describe('AccountAppointments', () => {
  let fixture: ComponentFixture<AccountAppointments>;
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        provideRouter([]),
        provideHttpClient(),
        provideHttpClientTesting(),
        provideSynaxApi({ baseUrl: 'https://api.test', defaultVersion: 1 }),
        provideTransloco({
          config: { availableLangs: ['el', 'en'], defaultLang: 'el' },
          loader: EmptyLoader,
        }),
      ],
    });
    http = TestBed.inject(HttpTestingController);
    fixture = TestBed.createComponent(AccountAppointments);
  });

  afterEach(() => {
    http.verify();
  });

  async function settle(): Promise<void> {
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
  }

  function answer(period: 'Upcoming' | 'Past', items: unknown[]): void {
    http
      .expectOne(
        (request) =>
          request.url.endsWith('/users/me/appointments') && request.params.get('period') === period,
      )
      .flush({ items, page: 1, pageSize: 20, hasMore: false });
  }

  function element(): HTMLElement {
    return fixture.nativeElement as HTMLElement;
  }

  it('loads both lists at once and shows upcoming first, then the past ones', async () => {
    fixture.detectChanges();
    answer('Upcoming', [appointment({ id: 'u1', companyName: 'Upcoming Shop' })]);
    answer('Past', [
      appointment({ id: 'p1', companyName: 'Past Shop', status: 'completed', canChange: false }),
    ]);
    await settle();

    const sections = Array.from(element().querySelectorAll('section'));
    expect(sections).toHaveLength(2);
    expect(sections[0]?.textContent).toContain('Upcoming Shop');
    expect(sections[1]?.textContent).toContain('Past Shop');
    expect(sections[1]?.id).toBe('past');
  });

  it('offers a barbershop search when nothing is upcoming', async () => {
    fixture.detectChanges();
    answer('Upcoming', []);
    answer('Past', []);
    await settle();

    const upcoming = element().querySelector('section');
    expect(upcoming?.querySelector('a[href$="/barbershops"]')).not.toBeNull();
  });
});
