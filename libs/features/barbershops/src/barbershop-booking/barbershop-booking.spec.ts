import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { Injectable, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideLocationMocks } from '@angular/common/testing';
import { Location } from '@angular/common';
import { provideRouter, Router } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import {
  provideTransloco,
  TranslocoLoader,
  TranslocoService,
  type Translation,
} from '@jsverse/transloco';
import { PendingActionStore, SessionStore } from '@auth/data-access';
import { provideBrand } from '@util/brand';
import { firstValueFrom, Observable, of } from 'rxjs';
import type { MockInstance } from 'vitest';

import { barbershopsRoutes } from '../lib.routes';
import { AppointmentErrorCodes } from '../data/booking.api';
import { BookingConfirmFields } from './steps/booking-confirm/booking-confirm-fields';
import { appointment, bookingOptions, dayAvailability, profile } from './booking.fixture';

const SLUG = 'barber-house-kolonaki';
const TODAY = '2026-09-20';
const DATE = '2026-09-25';
const TIMES = ['17:30', '18:00'];

/** A brand, so the draft keys are namespaced the way they are in an app. */
const FAKE_BRAND = {
  id: 'barbershop-x',
  name: 'Barbershop X',
  wordmark: 'barbershop-x',
  logo: '/brand/barbershop-x-icon.png',
  heroImage: '/images/barbershop-x-hero.webp',
  defaultTheme: 'light',
} as const;

const DRAFT_KEY = `barbershop-x.booking.draft.v1.${SLUG}`;

/** `lg`, which is where the footer bar replaces the sheet. Mirrors the page's own query. */
const BAR_QUERY = '(min-width: 1024px)';

/**
 * Which surface the page is on, read once per component by `BreakpointObserver`.
 *
 * Set it **before** `open()`: the page subscribes after its first render and nothing here
 * emits a later change.
 */
let wideViewport = false;

// jsdom does not implement matchMedia, which the CDK's BreakpointObserver needs.
beforeAll(() => {
  window.matchMedia = (query: string): MediaQueryList =>
    ({
      matches: wideViewport && query === BAR_QUERY,
      media: query,
      onchange: null,
      // MediaQueryList still declares the legacy listener methods.
      // oxlint-disable-next-line typescript/no-deprecated
      addListener: () => undefined,
      // oxlint-disable-next-line typescript/no-deprecated
      removeListener: () => undefined,
      addEventListener: () => undefined,
      removeEventListener: () => undefined,
      dispatchEvent: () => false,
    }) as MediaQueryList;
});

const ROOT: Translation = { titles: { booking: 'Κλείσε ραντεβού' } };

@Injectable()
class RootLoader implements TranslocoLoader {
  getTranslation(lang: string): Observable<Translation> {
    return of(lang === 'el' ? ROOT : {});
  }
}

/** A session the test drives, standing in for the real Keycloak-backed one. */
@Injectable()
class FakeSession {
  readonly ready = signal(true);
  readonly signedIn = signal(true);
  readonly verified = signal(true);
  readonly signInCalls: string[] = [];
  readonly signUpCalls: string[] = [];

  isReady = (): boolean => this.ready();
  isSignedIn = (): boolean => this.signedIn();
  isEmailVerified = (): boolean => this.verified();

  signIn(returnUrl: string): void {
    this.signInCalls.push(returnUrl);
  }

  signUp(returnUrl: string): void {
    this.signUpCalls.push(returnUrl);
  }
}

describe('Booking page', () => {
  let harness: RouterTestingHarness;
  let http: HttpTestingController;
  let session: FakeSession;
  let navigate: MockInstance<Router['navigate']>;
  /** What `GET /users/me/booking-access/{slug}` answers. */
  let access: { canBookOnline: boolean; shopPhone: string };

  beforeEach(async () => {
    access = { canBookOnline: true, shopPhone: '+302101234567' };
    localStorage.clear();
    vi.useFakeTimers({ shouldAdvanceTime: true });
    vi.setSystemTime(new Date(`${TODAY}T08:00:00Z`));

    await TestBed.configureTestingModule({
      providers: [
        provideRouter(barbershopsRoutes),
        provideLocationMocks(),
        provideBrand(FAKE_BRAND),
        provideHttpClient(),
        provideHttpClientTesting(),
        FakeSession,
        { provide: SessionStore, useExisting: FakeSession },
        provideTransloco({
          config: { availableLangs: ['el', 'en'], defaultLang: 'el', fallbackLang: 'en' },
          loader: RootLoader,
        }),
      ],
    }).compileComponents();

    await firstValueFrom(TestBed.inject(TranslocoService).load('el'));
    harness = await RouterTestingHarness.create();
    http = TestBed.inject(HttpTestingController);
    session = TestBed.inject(FakeSession);

    // This harness mounts the feature's routes at the root, so the language-prefixed addresses
    // the app navigates to match nothing here. Stubbed, so a test asserts the decision the page
    // made rather than a URL this route table could never produce. `navigateByUrl`, which
    // `open` uses, is untouched.
    navigate = vi.spyOn(TestBed.inject(Router), 'navigate').mockResolvedValue(true);
  });

  afterEach(() => {
    vi.useRealTimers();
    localStorage.clear();
    wideViewport = false;
  });

  function element(): HTMLElement {
    return harness.fixture.nativeElement as HTMLElement;
  }

  function query(selector: string): HTMLElement {
    const found = element().querySelector<HTMLElement>(selector);
    if (found === null) throw new Error(`${selector} not rendered`);
    return found;
  }

  /**
   * Settles the page, answering any availability the last choice triggered.
   *
   * `whenStable` waits on in-flight requests, so a selection change that fires the availability
   * resources never settles until they are answered. Answering them here keeps every test about
   * the behaviour it is named for.
   */
  async function settle(): Promise<void> {
    for (let round = 0; round < 3; round++) {
      harness.detectChanges();
      for (const request of http.match((candidate) =>
        candidate.url.includes('/availability/days'),
      )) {
        request.flush({ from: TODAY, to: TODAY, timezone: 'Europe/Athens', days: [DATE] });
      }
      for (const request of http.match((candidate) =>
        candidate.url.includes('/availability/slots'),
      )) {
        request.flush(dayAvailability(DATE, TIMES));
      }
      for (const request of http.match((candidate) =>
        candidate.url.includes('/users/me/booking-access/'),
      )) {
        request.flush(access);
      }
      // The confirm step reads the profile to decide whether to offer the phone field.
      for (const request of http.match(
        (candidate) => candidate.method === 'GET' && candidate.url.endsWith('users/me'),
      )) {
        request.flush(profile());
      }
      await harness.fixture.whenStable();
    }
    harness.detectChanges();
  }

  /** Opens the page with the shop's options answered. */
  async function open(): Promise<void> {
    const navigation = harness.navigateByUrl(`/${SLUG}/booking`);
    await vi.waitFor(() => {
      http
        .expectOne((candidate) => candidate.url.endsWith(`/companies/${SLUG}/booking-options`))
        .flush(bookingOptions());
    });
    await navigation;
    await settle();
  }

  function services(): HTMLElement[] {
    return Array.from(element().querySelectorAll<HTMLElement>('.services__card'));
  }

  /** Walks the flow to the confirm step with one service, Anyone and a slot chosen. */
  async function reachConfirm(): Promise<void> {
    await open();
    services()[0]?.click();
    await settle();

    // services -> barber -> when
    query('.booking__continue').click();
    await settle();
    query('.booking__continue').click();
    await settle();

    query(`.date-day[data-date="${DATE}"]`).click();
    await settle();

    query(`.time-option`).click();
    await settle();

    query('.booking__continue').click();
    await settle();
  }

  describe('the page', () => {
    it('renders the stepper with the barbershop step locked', async () => {
      await open();

      const steps = Array.from(element().querySelectorAll<HTMLElement>('.stepper__step'));
      expect(steps).toHaveLength(5);
      expect(steps[0]?.dataset['state']).toBe('locked');
      expect(steps[0]?.querySelector('.stepper__header')?.tagName).not.toBe('BUTTON');
      expect(steps[1]?.dataset['state']).toBe('active');
    });

    it('names every step and every summary row in Greek, in the panel and in the sheet', async () => {
      await open();

      // `translateSignal` prefixes the nearest `TRANSLOCO_SCOPE` itself, so a key written with
      // the scope already on it resolves to `barbershops.barbershops.…` — and to
      // `bottomSheet.…` for the copy inside the sheet, whose scope is the nearest one there.
      // Both rendered the raw key on screen.
      const labels = Array.from(element().querySelectorAll<HTMLElement>('.stepper__label')).map(
        (label) => label.textContent.trim(),
      );
      expect(labels[0]).toContain('Κουρείο');
      expect(labels[3]).toContain('Πότε');

      for (const surface of ['.booking__bar', '.booking__sheet']) {
        const rows = Array.from(
          query(surface).querySelectorAll<HTMLElement>('.summary__label'),
        ).map((label) => label.textContent.trim());
        expect(rows).toEqual(['Υπηρεσίες', 'Κουρέας', 'Πότε']);
      }
    });

    it('names the shop once in the sheet, where the collapsed bar already carries it', async () => {
      await open();

      expect(query('.booking__sheet .peek__name').textContent).toContain('Barber House');
      expect(query('.booking__sheet').querySelector('.summary__shop')).toBeNull();
      // The wide bar has no second line above it, so there it is the summary's own job.
      expect(query('.booking__bar .summary__shop')).toBeTruthy();
    });

    it('shows the selection summary at both sizes, from one component', async () => {
      await open();

      // The wide bar and the narrow sheet each hold one. CSS decides which is visible; both are
      // rendered so the server never has to guess the viewport.
      expect(element().querySelectorAll('lib-booking-summary')).toHaveLength(2);
      expect(query('.booking__bar lib-booking-summary')).toBeTruthy();
      expect(query('.booking__sheet lib-booking-summary')).toBeTruthy();
    });

    it('lays the wide surface out as a footer bar, with the actions at its end', async () => {
      await open();

      const bar = query('.booking__bar');
      // Inline, so every choice reads across one line rather than down a column.
      expect(bar.querySelector('lib-booking-summary')?.getAttribute('data-layout')).toBe('inline');
      // The actions are the bar's last child: nothing of the summary sits to their right.
      expect(bar.querySelector('.booking__bar-inner')?.lastElementChild?.className).toContain(
        'booking__advance',
      );
    });

    it('names the reset button in words, in the bar and inside the sheet', async () => {
      await open();
      services()[0]?.click();
      await settle();

      const resets = Array.from(element().querySelectorAll<HTMLElement>('.booking__reset'));
      // One per surface, and CSS shows one surface. Neither is an unlabelled icon.
      expect(resets).toHaveLength(2);
      for (const reset of resets) {
        expect(reset.textContent.trim()).toBe('Καθαρισμός επιλογών');
      }
      // The sheet's copy is in the panel, not in the row that moves the flow on.
      expect(query('.booking__sheet-reset .booking__reset')).toBeTruthy();
      expect(query('.booking__sheet-actions').querySelector('.booking__reset')).toBeNull();
    });

    it('sums the choices up in the collapsed bar rather than listing them', async () => {
      await open();
      services()[0]?.click();
      await settle();

      expect(query('.peek__name').textContent).toContain('Barber House');
      // What they add up to. The names are in the panel, one line each.
      expect(query('.peek__choices-tail').textContent).toContain('1 υπηρεσία');
      expect(query('.peek__choices-tail').textContent).not.toContain('Ανδρικό κούρεμα');
    });

    it('states the amount under what it is the sum of, not beside the button', async () => {
      await open();

      // Nothing chosen, so there is no amount to state.
      expect(element().querySelector('.booking__sheet-total')).toBeNull();

      services()[0]?.click();
      await settle();

      // In the panel, under the rows. The actions row is the one forward button and nothing
      // else, because at anything less than the full width its words wrap.
      expect(query('.booking__sheet-total-value').textContent).toContain('15');
      expect(query('.booking__sheet-actions').querySelector('.booking__sheet-total')).toBeNull();
      expect(query('.booking__sheet-actions .booking__continue')).toBeTruthy();
      // The summary does not carry a second copy.
      expect(query('.booking__sheet').querySelector('.summary__total')).toBeNull();
    });

    it('drops the day from the bar once the sheet is open', async () => {
      await open();
      services()[0]?.click();
      await settle();
      query('.booking__continue').click();
      await settle();
      query('.booking__continue').click();
      await settle();
      query(`.date-day[data-date="${DATE}"]`).click();
      await settle();
      query('.time-option').click();
      await settle();

      const tail = (): string => query('.peek__choices-tail').textContent.trim();
      expect(tail()).toContain('17:30');

      query('.booking__sheet .sheet__toggle').click();
      await settle();

      // The rows below now say when, so the bar stops repeating it.
      expect(tail()).not.toContain('17:30');
      expect(tail()).toContain('1 υπηρεσία');
    });

    it('walks the stepper back one section at a time, and no further', async () => {
      await reachConfirm();

      const stepAt = (index: number): string | null =>
        element().querySelectorAll('.stepper__step')[index].getAttribute('data-state');

      // On `confirm`: `when` is the one step behind and the only one that can be returned to.
      expect(stepAt(3)).toBe('completed');
      expect(stepAt(0)).toBe('locked');
      expect(stepAt(1)).toBe('locked');
      expect(stepAt(2)).toBe('locked');
      expect(stepAt(4)).toBe('active');
    });

    it('keeps the stepper sequential after a back press', async () => {
      await reachConfirm();

      // All the way back to the services, which is where the customer picked a time and then
      // changed their mind about what they were booking.
      const location = TestBed.inject(Location);
      for (let press = 0; press < 3; press++) {
        location.back();
        await settle();
      }

      const states = Array.from(element().querySelectorAll('.stepper__step')).map((step) =>
        step.getAttribute('data-state'),
      );
      // Done is a run from the start, never a set with holes in it: `When` must not read as
      // ticked while `Barber` behind it does not.
      expect(states).toEqual(['locked', 'active', 'upcoming', 'upcoming', 'upcoming']);
      // And the choices made along the way survived the walk back.
      expect(query('.peek__choices').textContent).toContain('1 υπηρεσία');
      expect(query('.peek__choices').textContent).toContain('17:30');
    });

    it('goes back one section from the control in the sheet’s bar', async () => {
      await open();
      services()[0]?.click();
      await settle();
      query('.booking__continue').click();
      await settle();

      expect(query('.stepper__step[data-state="active"]').textContent).toContain('Κουρέας');

      query('.booking__sheet .booking__back').click();
      await settle();

      expect(query('.stepper__step[data-state="active"]').textContent).toContain('Υπηρεσίες');
    });

    it('holds a summary row open and inert until its step is behind the customer', async () => {
      await open();

      const rows = Array.from(
        query('.booking__bar').querySelectorAll<HTMLElement>('.summary__row'),
      );
      expect(rows).toHaveLength(3);
      // Waiting, not absent: the panel must not change height as the flow advances.
      expect(rows.every((row) => row.hasAttribute('data-waiting'))).toBe(true);
      expect(query('.booking__bar').querySelector('.summary__jump')).toBeNull();
    });

    it('offers no way forward until a service is chosen', async () => {
      await open();
      const advance = query('.booking__continue') as HTMLButtonElement;
      expect(advance.disabled).toBe(true);

      services()[0]?.click();
      await settle();

      expect((query('.booking__continue') as HTMLButtonElement).disabled).toBe(false);
    });

    it('hides start-over until something has been chosen', async () => {
      await open();
      expect(element().querySelector('.booking__reset')).toBeNull();

      services()[0]?.click();
      await settle();

      expect(element().querySelector('.booking__reset')).not.toBeNull();
    });
  });

  describe('availability', () => {
    it('never asks for availability on the server render', async () => {
      await open();

      // Nothing is chosen, so there is nothing to ask about — and the resolver asked for none.
      http.expectNone((candidate) => candidate.url.includes('/availability/'));
    });

    it('asks again when the selection changes the duration', async () => {
      await open();
      services()[0]?.click();
      await settle();

      services()[1]?.click();
      await settle();

      // Two services take longer than one, so the day list is no longer the right answer and
      // the resource asked again. `settle` answered it, which is why nothing is outstanding.
      http.verify();
    });
  });

  describe('submitting', () => {
    it('sends the slot instant verbatim and lands on the appointment', async () => {
      await reachConfirm();

      query('.booking__commit').click();
      await settle();

      const request = http.expectOne((candidate) => candidate.url.endsWith('/appointments'));
      expect(request.request.body).toMatchObject({
        companyId: 'company-1',
        serviceIds: ['service-haircut'],
        staffMemberId: null,
        // Echoed from the slot. The page never computes an instant.
        startsAtUtc: '2026-09-25T17:30:00Z',
        notes: null,
      });
      request.flush(appointment());
      await settle();

      expect(navigate).toHaveBeenCalledWith(
        ['/el/barbershops/barber-house-kolonaki/booking/appointment-1'],
        // Replaced, so the back button cannot return to a booking already made.
        { replaceUrl: true },
      );
    });

    it('clears the stored draft once it has become an appointment', async () => {
      await reachConfirm();
      expect(localStorage.getItem(DRAFT_KEY)).not.toBeNull();

      query('.booking__commit').click();
      await settle();
      http.expectOne((candidate) => candidate.url.endsWith('/appointments')).flush(appointment());
      await settle();

      expect(localStorage.getItem(DRAFT_KEY)).toBeNull();
    });

    it.each([
      [AppointmentErrorCodes.SlotTaken, 'when'],
      [AppointmentErrorCodes.SlotUnavailable, 'when'],
      [AppointmentErrorCodes.LeadTime, 'when'],
      [AppointmentErrorCodes.TooFarAhead, 'when'],
      [AppointmentErrorCodes.StaffUnavailable, 'barber'],
      [AppointmentErrorCodes.ServiceUnavailable, 'services'],
    ])('moves back to the %s step and keeps the draft', async (errorCode, step) => {
      await reachConfirm();

      query('.booking__commit').click();
      await settle();
      http
        .expectOne((candidate) => candidate.url.endsWith('/appointments'))
        .flush({ title: errorCode, status: 409 }, { status: 409, statusText: 'Conflict' });
      await settle();

      const all = Array.from(element().querySelectorAll('.stepper__step'));
      const index = all.findIndex((entry) => entry.getAttribute('data-state') === 'active');
      expect(['shop', 'services', 'barber', 'when', 'confirm'][index]).toBe(step);
      // A failed submit is not a lost booking.
      expect(localStorage.getItem(DRAFT_KEY)).not.toBeNull();
    });

    it('stays put and says so when the customer already has that time', async () => {
      await reachConfirm();

      query('.booking__commit').click();
      await settle();
      http
        .expectOne((candidate) => candidate.url.endsWith('/appointments'))
        .flush(
          { title: AppointmentErrorCodes.OverlapsExisting, status: 409 },
          { status: 409, statusText: 'Conflict' },
        );
      await settle();

      expect(query('lib-banner[role="alert"]').textContent).toContain('Έχεις ήδη ραντεβού');
    });
  });

  describe('a shop that blocked the customer', () => {
    it("says so before the first step, in the singular, with the shop's phone", async () => {
      access = { canBookOnline: false, shopPhone: '+302101234567' };
      await open();

      const notice = query('.booking-shop-refusal');
      expect(notice.textContent).toContain('Τηλεφώνησε στο κατάστημα');
      expect(notice.textContent).not.toContain('αποκλε');
      expect(notice.querySelector('a')?.getAttribute('href')).toBe('tel:+302101234567');
      expect(element().querySelector('lib-stepper')).toBeNull();
    });

    it('never asks for an anonymous visitor', async () => {
      session.signedIn.set(false);
      await open();

      http.expectNone((candidate) => candidate.url.includes('/booking-access/'));
      expect(element().querySelector('lib-stepper')).not.toBeNull();
    });

    it('shows the same notice when the submit is refused for it', async () => {
      await reachConfirm();

      query('.booking__commit').click();
      await settle();
      http
        .expectOne((candidate) => candidate.url.endsWith('/appointments'))
        .flush(
          { title: AppointmentErrorCodes.CustomerBlockedByShop, status: 403 },
          { status: 403, statusText: 'Forbidden' },
        );
      access = { canBookOnline: false, shopPhone: '+302101234567' };
      await settle();

      expect(query('.booking-shop-refusal').textContent).toContain('Κάλεσε το +302101234567');
    });

    it('keeps the platform ban on its own message', async () => {
      await reachConfirm();

      query('.booking__commit').click();
      await settle();
      http
        .expectOne((candidate) => candidate.url.endsWith('/appointments'))
        .flush(
          { title: AppointmentErrorCodes.CustomerBanned, status: 403 },
          { status: 403, statusText: 'Forbidden' },
        );
      await settle();

      expect(element().querySelector('.booking-shop-refusal')).toBeNull();
      expect(query('lib-banner[role="alert"]').textContent).toContain('Δεν μπορείς να κλείσεις');
    });
  });

  describe('the confirm step', () => {
    it('commits from the same row the flow advanced from', async () => {
      await reachConfirm();

      // The button moves surface, not place: it is in the actions row every other step used.
      expect(query('.booking__advance .booking__commit').textContent).toContain(
        'Κλείσε το ραντεβού',
      );
      expect(element().querySelector('.booking__continue')).toBeNull();
      // Both surfaces render the row; CSS shows one.
      expect(element().querySelectorAll('.booking__commit')).toHaveLength(2);
    });

    it('empties the step and pins the sheet open on a phone', async () => {
      await reachConfirm();

      // The step body holds nothing: the sheet below is the screen, and the fields that were
      // in the body are in it.
      expect(element().querySelector('lib-booking-confirm')).toBeNull();
      expect(query('.booking__step').textContent.trim()).toBe('');
      expect(query('.booking__sheet lib-booking-confirm-fields')).toBeTruthy();

      // Pinned: expanded, with nothing offering to close it.
      expect(query('lib-bottom-sheet').hasAttribute('data-expanded')).toBe(true);
      expect(element().querySelector('.sheet__toggle')).toBeNull();
      expect(element().querySelector('.sheet__backdrop')).toBeNull();
    });

    it('repeats the action at the end of the step on a wide screen', async () => {
      wideViewport = true;
      await reachConfirm();

      // Wide, the step has a body again and ends with the same words the bar's button uses.
      const inBody = query('.confirm__commit-button');
      expect(inBody.textContent).toContain('Κλείσε το ραντεβού');
      expect(element().querySelector('.booking__sheet lib-booking-confirm-fields')).toBeNull();

      inBody.click();
      await settle();
      http.expectOne((candidate) => candidate.url.endsWith('/appointments'));
    });

    it('counts the note against its 400 characters and caps it there', async () => {
      await reachConfirm();

      const textarea = query('.fields__note textarea') as HTMLTextAreaElement;
      const count = query('.fields__count');
      expect(count.textContent.trim()).toBe('0 / 400 χαρακτήρες');
      expect(textarea.getAttribute('maxlength')).toBe('400');
      expect(textarea.getAttribute('aria-describedby')).toBe(count.id);

      textarea.value = 'x'.repeat(450);
      textarea.dispatchEvent(new Event('input'));
      await settle();

      expect(count.textContent.trim()).toBe('400 / 400 χαρακτήρες');
    });

    it('offers the phone above the note, and saves it only once the booking exists', async () => {
      await reachConfirm();

      const phone = query('lib-booking-confirm-fields lib-phone-input');
      const note = query('.fields__note');
      // `DOCUMENT_POSITION_FOLLOWING` is 4: the note comes after the field.
      expect(phone.compareDocumentPosition(note) & Node.DOCUMENT_POSITION_FOLLOWING).toBe(4);
      expect(query('.fields__hint').textContent).toContain('μόνο για να επικοινωνήσουμε');

      const fields = harness.fixture.debugElement.query(
        (node) => node.name === 'lib-booking-confirm-fields',
      ).componentInstance as BookingConfirmFields;
      fields.phone.set('6900000000');
      await settle();

      // Nothing is written while the customer is still typing.
      http.expectNone((candidate) => candidate.method === 'PATCH');

      query('.booking__commit').click();
      await settle();
      http
        .expectOne((candidate) => candidate.url.endsWith('/appointments'))
        .flush(appointment({ id: 'appointment-1' }));
      await settle();

      const patch = http.expectOne(
        (candidate) => candidate.method === 'PATCH' && candidate.url.endsWith('users/me'),
      );
      expect(patch.request.body).toEqual({ phoneNumber: '6900000000' });
      patch.flush(profile({ phoneNumber: '6900000000' }));
    });

    it('withholds the phone field from someone who is not signed in yet', async () => {
      session.signedIn.set(false);
      await reachConfirm();

      // There is no profile to write to, and a number typed before a redirect is lost.
      expect(element().querySelector('lib-phone-input')).toBeNull();
    });
  });

  describe('the auth detour', () => {
    it('offers sign-in to an anonymous customer and keeps the selection', async () => {
      session.signedIn.set(false);
      await reachConfirm();

      expect(query('lib-banner[role="status"]').textContent).toContain(
        'θα διατηρηθούν μετά τη σύνδεση',
      );

      query('.booking__commit').click();
      await settle();

      expect(session.signInCalls).toHaveLength(1);
      // One way in. A separate sign-up button asked the customer to choose before they could act.
      expect(session.signUpCalls).toHaveLength(0);
      expect(element().textContent).not.toContain('Δημιούργησε λογαριασμό');
      // Saved before the redirect, never after and never on unload.
      expect(localStorage.getItem(DRAFT_KEY)).not.toBeNull();
    });

    it('leaves the verify screen a summary it can render without knowing what a booking is', async () => {
      session.signedIn.set(false);
      await reachConfirm();

      query('.booking__commit').click();
      await settle();

      const action = TestBed.inject(PendingActionStore).peek();
      expect(action?.kind).toBe('booking');
      expect(action?.title).toContain('Τελευταίο βήμα');
      expect(action?.rows.map((row) => row.label)).toEqual(['Υπηρεσίες', 'Κουρέας', 'Πότε']);
    });

    it('sends an unverified customer to verify rather than to the API', async () => {
      session.verified.set(false);
      await reachConfirm();

      query('.booking__commit').click();
      await settle();

      http.expectNone((candidate) => candidate.url.endsWith('/appointments'));
      expect(navigate).toHaveBeenCalledWith(['/el/verify-email'], {
        queryParams: { returnUrl: '/barber-house-kolonaki/booking' },
      });
    });
  });

  describe('resuming', () => {
    it('keeps what survives and says what did not', async () => {
      localStorage.setItem(
        DRAFT_KEY,
        JSON.stringify({
          version: 1,
          slug: SLUG,
          serviceIds: ['service-haircut', 'service-gone'],
          staffMemberId: null,
          date: null,
          time: null,
          startsAtUtc: null,
          notes: '',
          step: 'when',
          savedAt: new Date().toISOString(),
        }),
      );

      await open();

      expect(query('.booking__notice').textContent).toContain('Κρατήσαμε τις υπόλοιπες');
      // The surviving service is still chosen, and the flow is back at the step that lost one.
      expect(services()[0]?.getAttribute('aria-pressed')).toBe('true');
    });
  });

  describe('moving an appointment', () => {
    const MOVE_URL = `/${SLUG}/booking?reschedule=appointment-1`;

    /** Opens the page to move `appointment-1`, with the shop and the appointment answered. */
    async function openMove(overrides: Parameters<typeof appointment>[0] = {}): Promise<string[]> {
      const navigation = harness.navigateByUrl(MOVE_URL);
      await vi.waitFor(() => {
        http
          .expectOne((candidate) => candidate.url.endsWith(`/companies/${SLUG}/booking-options`))
          .flush(bookingOptions());
      });
      await vi.waitFor(() => {
        http
          .expectOne((candidate) => candidate.url.endsWith('/users/me/appointments/appointment-1'))
          .flush(appointment({ id: 'appointment-1', ...overrides }));
      });
      await navigation;
      harness.detectChanges();
      const days = await vi.waitFor(() =>
        http.expectOne((candidate) => candidate.url.includes('/availability/days')),
      );
      const asked = [days.request.url];
      days.flush({ from: TODAY, to: TODAY, timezone: 'Europe/Athens', days: [DATE] });
      await settle();
      return asked;
    }

    async function reachMoveConfirm(): Promise<void> {
      await openMove();
      query(`.date-day[data-date="${DATE}"]`).click();
      await settle();
      query('.time-option').click();
      await settle();
      query('.booking__continue').click();
      await settle();
    }

    it('opens at the date step, with the barber and services behind it', async () => {
      await openMove();

      const states = Array.from(element().querySelectorAll<HTMLElement>('.stepper__step')).map(
        (step) => step.dataset['state'],
      );
      expect(states[3]).toBe('active');
      // Only the step directly behind is reachable; the services follow from there.
      expect(states[2]).toBe('completed');
      expect(states[1]).toBe('locked');
      expect(query('.booking__notice').textContent).toContain('Αλλάζεις το ραντεβού σου');
    });

    it('asks the move\u2019s own availability, which counts its current time as free', async () => {
      const asked = await openMove();

      expect(
        asked.some((url) => url.endsWith('/users/me/appointments/appointment-1/availability/days')),
      ).toBe(true);
      expect(asked.some((url) => url.includes(`/companies/${SLUG}/availability`))).toBe(false);
    });

    it('never stores the move as a booking draft', async () => {
      await openMove();
      query(`.date-day[data-date="${DATE}"]`).click();
      await settle();

      expect(localStorage.getItem(DRAFT_KEY)).toBeNull();
    });

    it('shows the appointment before and after the change on the confirm step', async () => {
      await reachMoveConfirm();

      const compare = query('.compare');
      expect(compare.textContent).toContain('Πριν');
      expect(compare.textContent).toContain('Μετά');
      expect(compare.textContent).toContain(TIMES[0]);
    });

    it('moves it with the total shown and opens the appointment', async () => {
      await reachMoveConfirm();

      query('.booking__commit').click();
      const request = await vi.waitFor(() =>
        http.expectOne((candidate) =>
          candidate.url.endsWith('/users/me/appointments/appointment-1/reschedule'),
        ),
      );
      expect(request.request.body).toMatchObject({
        serviceIds: ['service-haircut'],
        staffMemberId: 'barber-a',
        expectedTotalPrice: 15,
      });
      request.flush(appointment({ id: 'appointment-1' }));
      await settle();

      expect(navigate).toHaveBeenCalledWith(['/el/account/appointments/appointment-1'], {
        replaceUrl: true,
      });
    });

    it('shows a new total the server names, and confirms that one next', async () => {
      await reachMoveConfirm();

      query('.booking__commit').click();
      (
        await vi.waitFor(() => http.expectOne((candidate) => candidate.url.endsWith('/reschedule')))
      ).flush(
        { title: 'APPOINTMENT_PRICE_CHANGED', status: 409, totalPrice: 20, currency: 'EUR' },
        { status: 409, statusText: 'Conflict' },
      );
      await settle();

      expect(element().textContent).toContain('20');
      expect(navigate).not.toHaveBeenCalled();
      // The button keeps its spinner for a minimum time, and ignores a press until it ends.
      await vi.advanceTimersByTimeAsync(2000);
      await settle();

      query('.booking__commit').click();
      const again = await vi.waitFor(() =>
        http.expectOne((candidate) => candidate.url.endsWith('/reschedule')),
      );
      expect(again.request.body).toMatchObject({ expectedTotalPrice: 20 });
    });

    it('says the appointment can no longer change when its window has closed', async () => {
      const navigation = harness.navigateByUrl(MOVE_URL);
      await vi.waitFor(() => {
        http
          .expectOne((candidate) => candidate.url.endsWith(`/companies/${SLUG}/booking-options`))
          .flush(bookingOptions());
      });
      await vi.waitFor(() => {
        http
          .expectOne((candidate) => candidate.url.endsWith('/users/me/appointments/appointment-1'))
          .flush(appointment({ id: 'appointment-1', canChange: false }));
      });
      await navigation;
      await settle();

      expect(element().textContent).toContain('δεν μπορεί πια να αλλάξει');
      expect(element().querySelector('.stepper__step')).toBeNull();
    });
  });

  describe('book again', () => {
    it('opens at the date step with the services and barber of the old appointment', async () => {
      const navigation = harness.navigateByUrl(
        `/${SLUG}/booking?services=service-haircut&barber=barber-a`,
      );
      await vi.waitFor(() => {
        http
          .expectOne((candidate) => candidate.url.endsWith(`/companies/${SLUG}/booking-options`))
          .flush(bookingOptions());
      });
      await navigation;
      await settle();

      const states = Array.from(element().querySelectorAll<HTMLElement>('.stepper__step')).map(
        (step) => step.dataset['state'],
      );
      expect(states[3]).toBe('active');
      expect(JSON.parse(localStorage.getItem(DRAFT_KEY) ?? '{}')).toMatchObject({
        serviceIds: ['service-haircut'],
        staffMemberId: 'barber-a',
      });
    });
  });

  describe('the success screen', () => {
    async function openSuccess(canAddToCalendar: boolean): Promise<void> {
      const navigation = harness.navigateByUrl(`/${SLUG}/booking/appointment-1`);
      // The lazy route loads first. On a busy machine that takes longer than the default second.
      await vi.waitFor(
        () => {
          http
            .expectOne((candidate) =>
              candidate.url.endsWith('/users/me/appointments/appointment-1'),
            )
            .flush(appointment({ id: 'appointment-1', canAddToCalendar }));
        },
        { timeout: 5000 },
      );
      await navigation;
      await settle();
    }

    it('points to the email for the calendar when the server allows it', async () => {
      await openSuccess(true);
      expect(query('.success__calendar').textContent).toContain('από το email που σου στείλαμε');
    });

    it('leaves the calendar note out when the server does not allow it', async () => {
      await openSuccess(false);
      expect(element().querySelector('.success__calendar')).toBeNull();
    });
  });
});
