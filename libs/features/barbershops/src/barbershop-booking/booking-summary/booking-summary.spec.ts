import { Component, signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideTransloco, TranslocoService, type Translation } from '@jsverse/transloco';
import { Injectable } from '@angular/core';
import { TranslocoLoader } from '@jsverse/transloco';
import { firstValueFrom, Observable, of } from 'rxjs';

import { barbershopsInlineLoader } from '../../barbershops.i18n';
import { bookingOptions } from '../booking.fixture';
import type {
  BookingStepId,
  BookingSummaryLayout,
  BookingTotals,
  ChosenService,
} from '../booking.types';
import { BookingSummary } from './booking-summary';

const DICTIONARY: Translation = {
  barbershops: {
    booking: {
      barber: { anyone: 'Οποιοσδήποτε' },
      summary: {
        services: 'Υπηρεσίες',
        barber: 'Κουρέας',
        when: 'Πότε',
        total: 'Σύνολο',
        from: 'από',
        change: '(άλλαξέ το)',
      },
    },
  },
};

@Injectable()
class Loader implements TranslocoLoader {
  getTranslation(): Observable<Translation> {
    return of(DICTIONARY);
  }
}

const HAIRCUT: ChosenService = {
  id: 'service-haircut',
  name: 'Ανδρικό κούρεμα',
  price: 15,
  durationMinutes: 30,
};

@Component({
  imports: [BookingSummary],
  template: `
    <lib-booking-summary
      [shop]="shop()"
      [chosen]="chosen()"
      [totals]="totals()"
      [barberName]="barberName()"
      [date]="date()"
      [time]="time()"
      [step]="step()"
      [layout]="layout()"
      [showTotal]="showTotal()"
    />
  `,
})
class SummaryHost {
  readonly shop = signal(bookingOptions());
  readonly chosen = signal<readonly ChosenService[]>([]);
  readonly totals = signal<BookingTotals>({ durationMinutes: 0, price: 0, exact: true });
  readonly barberName = signal<string | null>(null);
  readonly date = signal<string | null>(null);
  readonly time = signal<string | null>(null);
  readonly step = signal<BookingStepId>('services');
  readonly layout = signal<BookingSummaryLayout>('stacked');
  readonly showTotal = signal(true);
}

describe('BookingSummary', () => {
  let fixture: ComponentFixture<SummaryHost>;
  let host: SummaryHost;

  async function settle(): Promise<void> {
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
  }

  function element(): HTMLElement {
    return fixture.nativeElement as HTMLElement;
  }

  function rows(): HTMLElement[] {
    return Array.from(element().querySelectorAll<HTMLElement>('.summary__row'));
  }

  function row(index: number): HTMLElement {
    const found = rows().at(index);
    if (found === undefined) throw new Error(`row ${String(index)} not rendered`);
    return found;
  }

  beforeEach(async () => {
    TestBed.configureTestingModule({
      providers: [
        provideTransloco({
          config: { availableLangs: ['el', 'en'], defaultLang: 'el', fallbackLang: 'el' },
          loader: Loader,
        }),
      ],
    });
    await firstValueFrom(TestBed.inject(TranslocoService).load('el'));
    fixture = TestBed.createComponent(SummaryHost);
    host = fixture.componentInstance;
    await settle();

    // The component carries its own scope, so its copy arrives through a dynamic import that
    // no fixture tick waits for. Load it after the first render, never before: a `load` that
    // runs before a pipe has supplied the inline loader caches an empty translation forever.
    await firstValueFrom(
      TestBed.inject(TranslocoService).load('barbershops/el', {
        inlineLoader: barbershopsInlineLoader,
      }),
    );
    await settle();
  });

  it('keeps every row present and waiting before anything is chosen', async () => {
    await settle();

    // Waiting, not absent: the panel must not change height as the flow advances, and the
    // customer can see what is still to come.
    expect(rows()).toHaveLength(3);
    expect(rows().every((entry) => entry.hasAttribute('data-waiting'))).toBe(true);
  });

  it('shows a dash where a step has not been reached', async () => {
    await settle();

    expect(row(2).querySelector('.summary__pending')?.textContent).toBe('—');
  });

  it('states what was chosen and offers no way to change it', async () => {
    host.chosen.set([HAIRCUT]);
    host.step.set('when');
    await settle();

    // Nothing here is a control, at either layout: the stepper and the back button are what
    // move the customer between steps.
    expect(element().querySelector('button')).toBeNull();

    host.layout.set('inline');
    await settle();

    expect(element().querySelector('button')).toBeNull();
  });

  it('withholds the total where the surface around it shows one', async () => {
    host.chosen.set([HAIRCUT]);
    host.totals.set({ durationMinutes: 30, price: 15, exact: true });
    await settle();

    expect(element().querySelector('.summary__total')).not.toBeNull();

    host.showTotal.set(false);
    await settle();

    expect(element().querySelector('.summary__total')).toBeNull();
  });

  it('fills the barber row with Anyone once that step is behind the customer', async () => {
    host.chosen.set([HAIRCUT]);
    host.step.set('when');
    await settle();

    // Anyone is a choice, so the row is filled rather than waiting.
    expect(row(1).hasAttribute('data-waiting')).toBe(false);
    expect(row(1).textContent).toContain('Οποιοσδήποτε');
  });

  it('fills the barber row the moment that step opens, not once it is behind', async () => {
    host.chosen.set([HAIRCUT]);
    host.step.set('barber');
    await settle();

    // Anyone is the standing choice and the step shows it already picked, so a row that
    // stayed empty here would be the only thing on screen disagreeing with it.
    expect(row(1).hasAttribute('data-waiting')).toBe(false);
    expect(row(1).textContent).toContain('Οποιοσδήποτε');

    host.barberName.set('Σωτήρης Δ.');
    await settle();

    expect(row(1).textContent).toContain('Σωτήρης Δ.');
  });

  it('names the barber once one is chosen', async () => {
    host.chosen.set([HAIRCUT]);
    host.barberName.set('Γιώργος Π.');
    host.step.set('confirm');
    await settle();

    expect(row(1).textContent).toContain('Γιώργος Π.');
  });

  it('shows the day alone until a time is chosen', async () => {
    host.chosen.set([HAIRCUT]);
    host.date.set('2026-09-25');
    host.step.set('confirm');
    await settle();

    expect(row(2).textContent).not.toContain(':');

    host.time.set('17:30');
    await settle();

    expect(row(2).textContent).toContain('17:30');
  });

  it('sets a value apart from what is true of it, so the name reads first', async () => {
    host.chosen.set([HAIRCUT]);
    host.date.set('2026-09-25');
    host.time.set('17:30');
    host.step.set('confirm');
    await settle();

    expect(row(0).querySelector('.summary__line')?.textContent).toContain('Ανδρικό κούρεμα');
    expect(row(0).querySelector('.summary__meta')?.textContent).toContain('15');
    // The day is the value; the time is what is true of it.
    expect(row(2).querySelector('.summary__meta')?.textContent.trim()).toBe('17:30');
  });

  it('heads the total with the word stacked and with what makes it up inline', async () => {
    host.chosen.set([HAIRCUT]);
    host.totals.set({ durationMinutes: 30, price: 15, exact: true });
    await settle();

    const heading = () => element().querySelector('.summary__total-label')?.textContent.trim();
    const amount = () => element().querySelector('.summary__total-value')?.textContent.trim();

    expect(heading()).toBe('Σύνολο');
    // Stacked, the amount carries the duration too.
    expect(amount()).toContain('30');

    host.layout.set('inline');
    await settle();

    // Inline, the duration moves up to the heading and the amount is the price alone.
    expect(heading()).toContain('30');
    expect(heading()).toContain('υπηρεσία');
    expect(amount()).not.toContain('30');
  });

  it('qualifies a total the barbers do not agree on', async () => {
    host.chosen.set([HAIRCUT]);
    host.totals.set({ durationMinutes: 30, price: 15, exact: false });
    await settle();

    // `από 15€`: stating one barber's price as the price when another charges more is the
    // thing this avoids.
    expect(element().querySelector('.summary__from')?.textContent.trim()).toBe('από');
  });

  it('states an agreed total plainly', async () => {
    host.chosen.set([HAIRCUT]);
    host.totals.set({ durationMinutes: 30, price: 15, exact: true });
    await settle();

    expect(element().querySelector('.summary__from')).toBeNull();
    expect(element().querySelector('.summary__total-value')?.textContent).toContain('30′');
  });

  it('withholds the total until something is chosen', async () => {
    await settle();

    expect(element().querySelector('.summary__total')).toBeNull();
  });

  it('falls back to initials when the shop has no logo', async () => {
    host.shop.set(bookingOptions({ logoUrl: null }));
    await settle();

    expect(element().querySelector('img.summary__logo')).toBeNull();
    expect(element().querySelector('.summary__logo--empty')?.textContent.trim()).toBe('BH');
  });
});
