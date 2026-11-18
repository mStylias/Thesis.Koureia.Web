import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { Injectable } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import { provideTransloco, type Translation, type TranslocoLoader } from '@jsverse/transloco';
import type { AppointmentResponse } from '@api/customer-appointments';
import { provideSynaxApi } from '@synax/client';
import { of, type Observable } from 'rxjs';

import { appointment } from '../../account.fixture';
import type { AppointmentPage } from '../../account.types';
import { AccountAppointment } from './account-appointment';
import { APPOINTMENT_PAGE } from './account-appointment.resolvers';

/** Keys render as themselves, so a test can find each action by its key. */
@Injectable()
class EmptyLoader implements TranslocoLoader {
  getTranslation(): Observable<Translation> {
    return of({});
  }
}

// jsdom has no `IntersectionObserver`, which the map's `@defer (on viewport)` needs.
beforeAll(() => {
  globalThis.IntersectionObserver = class {
    observe(): void {
      // Never fires, so the map stays on its skeleton.
    }
    unobserve(): void {
      // Nothing observed.
    }
    disconnect(): void {
      // Nothing observed.
    }
  } as unknown as typeof IntersectionObserver;
});

describe('AccountAppointment', () => {
  let page: AppointmentPage;

  function open(booked: AppointmentResponse): Promise<HTMLElement> {
    return openPage({ status: 'found', appointment: booked });
  }

  async function openPage(resolved: AppointmentPage): Promise<HTMLElement> {
    page = resolved;
    TestBed.configureTestingModule({
      providers: [
        provideRouter([
          {
            path: 'appointments/:id',
            component: AccountAppointment,
            resolve: { [APPOINTMENT_PAGE]: () => page },
          },
        ]),
        provideHttpClient(),
        provideHttpClientTesting(),
        provideSynaxApi({ baseUrl: 'https://api.test', defaultVersion: 1 }),
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
    const harness = await RouterTestingHarness.create();
    await harness.navigateByUrl('/appointments/appointment-1');
    harness.detectChanges();
    const root = harness.routeNativeElement;
    if (root === null) throw new Error('page not rendered');
    return root;
  }

  function texts(root: HTMLElement): string {
    return Array.from(root.querySelectorAll('a[libButton], button[libButton]'))
      .map((action) => action.textContent.trim())
      .join(' | ');
  }

  it('offers change time and cancel before the cutoff', async () => {
    const root = await open(appointment());

    expect(texts(root)).toContain('account.appointment.changeTime');
    expect(texts(root)).toContain('account.appointment.cancel');
    const change = root.querySelector<HTMLAnchorElement>('a[href*="reschedule=appointment-1"]');
    expect(change?.getAttribute('href')).toContain('/barbershops/barber-house/booking');
  });

  it('offers only the shop phone inside the cutoff', async () => {
    const root = await open(appointment({ canChange: false }));

    expect(texts(root)).not.toContain('account.appointment.cancel');
    expect(root.querySelector('a[href="tel:+302101234567"]')).not.toBeNull();
  });

  it('offers a review and book again for a completed visit', async () => {
    const root = await open(
      appointment({
        status: 'completed',
        canChange: false,
        changeableUntilUtc: null,
        canReview: true,
        reviewableUntilUtc: '2099-10-25T00:00:00Z',
        startsAtUtc: '2000-01-01T10:00:00Z',
      }),
    );

    expect(texts(root)).toContain('account.appointments.rate');
    const again = root.querySelector<HTMLAnchorElement>('a[href*="services=haircut"]');
    expect(again?.getAttribute('href')).toContain('barber=barber-a');
  });

  it('points to the email for the calendar when the server allows it', async () => {
    const root = await open(appointment({ canChange: false }));
    expect(root.querySelector('.appointment-calendar-note')?.textContent.trim()).toBe(
      'account.appointment.calendarNote',
    );
  });

  it('leaves the calendar note out when the server does not allow it', async () => {
    const root = await open(appointment({ canAddToCalendar: false }));
    expect(root.querySelector('.appointment-calendar-note')).toBeNull();
  });

  it('shows the address on two lines and links to the shop’s pin in Google Maps', async () => {
    const root = await open(appointment());

    const address = root.querySelector('address')?.textContent.replace(/\s+/g, ' ').trim();
    expect(address).toBe('Skoufa 12 Kolonaki, Athens');
    const directions = root.querySelector<HTMLAnchorElement>('.shop-map-links__directions');
    expect(directions?.getAttribute('href')).toBe(
      'https://www.google.com/maps/dir/?api=1&destination=37.9794%2C23.7389',
    );
    expect(root.querySelector('lib-shop-map')).not.toBeNull();
  });

  it('says so when the appointment is not the customer’s or does not exist', async () => {
    const root = await openPage({ status: 'not-found' });

    expect(root.textContent).toContain('account.appointment.notFound');
  });
});
